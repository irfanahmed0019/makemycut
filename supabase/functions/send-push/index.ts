import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { sendWebPush } from "../_shared/webpush.ts";

const NOTIFICATION_TYPES = [
  "appointment_booked",
  "appointment_confirmed",
  "appointment_cancelled",
  "appointment_rescheduled",
  "appointment_reminder",
  "appointment_accepted",
  "payment_successful",
  "account_update",
  "promotion",
  "last_minute",
  "test",
] as const;

const BodySchema = z.object({
  userId: z.string().uuid().optional(),
  userIds: z.array(z.string().uuid()).max(500).optional(),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(400),
  url: z.string().max(500).optional(),
  appointmentId: z.string().uuid().optional(),
  notificationType: z.enum(NOTIFICATION_TYPES),
});

// Which preference switch gates each notification type.
const PREF_FOR_TYPE: Record<string, "appointment_updates" | "appointment_reminders" | "promotions" | null> = {
  appointment_booked: "appointment_updates",
  appointment_confirmed: "appointment_updates",
  appointment_cancelled: "appointment_updates",
  appointment_rescheduled: "appointment_updates",
  appointment_accepted: "appointment_updates",
  payment_successful: "appointment_updates",
  appointment_reminder: "appointment_reminders",
  promotion: "promotions",
  account_update: null,
  last_minute: null,
  test: null,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_EMAIL");
  if (!publicKey || !privateKey || !subject) {
    return json({ error: "Push is not configured (missing VAPID environment variables)" }, 500);
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Unauthorized" }, 401);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { title, body, url, appointmentId, notificationType } = parsed.data;

    const targets = parsed.data.userIds ?? (parsed.data.userId ? [parsed.data.userId] : []);
    if (targets.length === 0) return json({ error: "No recipients specified" }, 400);

    // Authorization: either trusted server-to-server (service role key), or a
    // signed-in staff member (admin / salon owner / barber). Regular customers
    // may only send to themselves (used by the "send test notification" button).
    let allowed = token === serviceKey;
    if (!allowed) {
      const authed = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData } = await authed.auth.getUser();
      const caller = userData?.user;
      if (!caller) return json({ error: "Unauthorized" }, 401);

      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", caller.id);
      const isStaff = (roles ?? []).some((r) => ["admin", "moderator", "barber"].includes(r.role as string));
      const { data: ownedSalon } = await admin.from("barbers").select("id").eq("owner_id", caller.id).limit(1);
      const isOwner = (ownedSalon ?? []).length > 0;
      const selfOnly = targets.length === 1 && targets[0] === caller.id;

      allowed = isStaff || isOwner || selfOnly;
      if (!allowed) return json({ error: "Forbidden" }, 403);
    }

    const prefKey = PREF_FOR_TYPE[notificationType];
    let recipients = targets;
    if (prefKey) {
      const { data: prefs } = await admin
        .from("notification_preferences")
        .select(`user_id, ${prefKey}`)
        .in("user_id", targets);
      const optedOut = new Set(
        (prefs ?? []).filter((p: Record<string, unknown>) => p[prefKey] === false).map((p: Record<string, unknown>) => p.user_id as string),
      );
      recipients = targets.filter((id) => !optedOut.has(id));
    }
    if (recipients.length === 0) return json({ ok: true, sent: 0, skipped: targets.length });

    const { data: subs, error: subsErr } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", recipients)
      .eq("is_active", true);
    if (subsErr) return json({ error: subsErr.message }, 500);
    if (!subs || subs.length === 0) return json({ ok: true, sent: 0, noSubscriptions: true });

    const payload = { title, body, url: url ?? "/", appointmentId: appointmentId ?? null, notificationType };

    const results = await Promise.all(
      subs.map((s) =>
        sendWebPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload, {
          publicKey,
          privateKey,
          subject,
        }).then((r) => ({ ...r, id: s.id })),
      ),
    );

    const expiredIds = results.filter((r) => r.expired).map((r) => r.id);
    if (expiredIds.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", expiredIds);
    }

    const sent = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok && !r.expired);
    if (failed.length > 0) console.error("web-push failures", failed.map((f) => ({ status: f.status, error: f.error })));

    return json({ ok: true, sent, removed: expiredIds.length, failed: failed.length });
  } catch (e) {
    console.error("send-push error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});