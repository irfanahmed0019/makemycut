import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

// Reminder lead times (minutes before the slot): 24h, 30m, 5m.
// Adaptive — a lead time is skipped when the booking was made after it passed.
const OFFSETS = [1440, 30, 5];
// Salon timezone offset (IST) in minutes — booking_date/booking_time are local.
const TZ_OFFSET_MIN = 330;

const message = (o: number, salon: string) => {
  if (o === 1440) return { title: "Appointment tomorrow", body: `Your appointment at ${salon} is tomorrow. See you then!` };
  if (o === 30) return { title: "Appointment coming up", body: `Your appointment at ${salon} is in 30 minutes — time to head over.` };
  return { title: "Appointment in 5 minutes", body: `Your appointment at ${salon} starts in 5 minutes.` };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const now = Date.now();
    const today = new Date(now + TZ_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
    const tomorrow = new Date(now + TZ_OFFSET_MIN * 60_000 + 86_400_000).toISOString().slice(0, 10);

    const { data: bookings, error } = await admin
      .from("bookings")
      .select("id, user_id, barber_id, booking_date, booking_time, status, created_at")
      .in("booking_date", [today, tomorrow])
      .in("status", ["upcoming", "CONFIRMED", "pending"]);
    if (error) return json({ error: error.message }, 500);
    if (!bookings?.length) return json({ ok: true, sent: 0 });

    const { data: sentRows } = await admin
      .from("booking_reminders")
      .select("booking_id, offset_minutes")
      .in("booking_id", bookings.map((b) => b.id));
    const alreadySent = new Set((sentRows ?? []).map((r) => `${r.booking_id}:${r.offset_minutes}`));

    const salonIds = [...new Set(bookings.map((b) => b.barber_id))];
    const { data: salons } = await admin.from("barbers").select("id, name").in("id", salonIds);
    const salonName = new Map((salons ?? []).map((s) => [s.id, s.name as string]));

    let sent = 0;
    for (const b of bookings) {
      const slotUtc = Date.parse(`${b.booking_date}T${String(b.booking_time).slice(0, 8)}Z`) - TZ_OFFSET_MIN * 60_000;
      const minutesUntil = (slotUtc - now) / 60_000;
      if (minutesUntil < 0) continue;

      const createdAt = Date.parse(b.created_at as string);
      // Adaptive: only use lead times that were still in the future when booked.
      const usable = OFFSETS.filter((o) => createdAt <= slotUtc - o * 60_000);
      const due = usable.filter((o) => minutesUntil <= o && !alreadySent.has(`${b.id}:${o}`));
      if (due.length === 0) continue;
      // Send only the closest applicable reminder; mark skipped larger ones as done.
      const target = Math.min(...due);

      const name = salonName.get(b.barber_id) ?? "your salon";
      const msg = message(target, name);
      const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: b.user_id,
          title: msg.title,
          body: msg.body,
          url: "/",
          appointmentId: b.id,
          notificationType: "appointment_reminder",
        }),
      });
      if (!res.ok) {
        console.error("send-push failed", res.status, await res.text());
        continue;
      }
      sent++;
      await admin
        .from("booking_reminders")
        .upsert(due.map((o) => ({ booking_id: b.id, offset_minutes: o })), { onConflict: "booking_id,offset_minutes" });
    }

    return json({ ok: true, sent });
  } catch (e) {
    console.error("send-booking-reminders error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
