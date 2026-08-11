import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

// Fires when a slot frees up (cancellation). Notifies customers who opted into
// last-minute alerts and already hold a LATER booking that same day at the salon.
const BodySchema = z.object({
  salonId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().min(4).max(8),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
    if (!token) return json({ error: "Unauthorized" }, 401);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { salonId, date } = parsed.data;
    const time = parsed.data.time.slice(0, 5);

    // The freed slot must genuinely be free before we advertise it.
    const { data: stillTaken } = await admin
      .from("bookings")
      .select("id")
      .eq("barber_id", salonId)
      .eq("booking_date", date)
      .eq("booking_time", `${time}:00`)
      .in("status", ["upcoming", "CONFIRMED", "ON_HOLD", "pending", "completed"])
      .limit(1);
    if (stillTaken && stillTaken.length > 0) return json({ ok: true, sent: 0, reason: "slot_taken" });

    const { data: later } = await admin
      .from("bookings")
      .select("user_id, booking_time")
      .eq("barber_id", salonId)
      .eq("booking_date", date)
      .in("status", ["upcoming", "CONFIRMED", "pending"])
      .gt("booking_time", `${time}:00`);
    const candidates = [...new Set((later ?? []).map((b) => b.user_id as string))];
    if (candidates.length === 0) return json({ ok: true, sent: 0, reason: "no_candidates" });

    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("user_id, last_minute_alerts")
      .in("user_id", candidates)
      .eq("last_minute_alerts", true);
    const recipients = (prefs ?? []).map((p) => p.user_id as string);
    if (recipients.length === 0) return json({ ok: true, sent: 0, reason: "no_optins" });

    const { data: salon } = await admin.from("barbers").select("name").eq("id", salonId).maybeSingle();
    const name = salon?.name ?? "your salon";

    const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        userIds: recipients,
        title: "Earlier slot just opened",
        body: `A ${time} slot at ${name} just became free. Reschedule now if you want to come in earlier.`,
        url: "/",
        notificationType: "last_minute",
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("send-push failed", res.status, text);
      return json({ error: "Push dispatch failed", status: res.status, details: text }, res.status);
    }
    return json({ ok: true, notified: recipients.length });
  } catch (e) {
    console.error("notify-last-minute error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
