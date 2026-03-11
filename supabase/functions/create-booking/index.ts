import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // User client (respects RLS)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client (bypasses RLS for rate limit checks)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse and validate input
    const body = await req.json();
    const { barber_id, booking_date, booking_time, service_id } = body;

    if (!barber_id || !booking_date || !booking_time || !service_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(barber_id) || !uuidRegex.test(service_id)) {
      return new Response(JSON.stringify({ error: "Invalid ID format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate date is not in the past
    const bookingDate = new Date(booking_date + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      return new Response(
        JSON.stringify({ error: "Cannot book in the past" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate time format (HH:MM)
    if (!/^\d{2}:\d{2}$/.test(booking_time)) {
      return new Response(
        JSON.stringify({ error: "Invalid time format. Use HH:MM" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate service belongs to barber
    const { data: service, error: svcErr } = await adminClient
      .from("services")
      .select("id, barber_id")
      .eq("id", service_id)
      .eq("barber_id", barber_id)
      .maybeSingle();

    if (svcErr || !service) {
      return new Response(
        JSON.stringify({
          error: "Service not found or does not belong to this salon",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Rate limit: max 5 bookings per user in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countErr } = await adminClient
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneHourAgo);

    if (!countErr && count !== null && count >= 5) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded. Max 5 bookings per hour.",
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use existing RPC for atomic booking
    const { data, error } = await userClient.rpc("place_hold", {
      p_barber_id: barber_id,
      p_booking_date: booking_date,
      p_booking_time: booking_time,
      p_user_id: user.id,
      p_service_id: service_id,
    });

    if (error) {
      const msg = error.message || "";
      if (msg.includes("BOOKING_LIMIT")) {
        return new Response(
          JSON.stringify({ error: "Maximum 2 active bookings allowed" }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      return new Response(
        JSON.stringify({ error: "Slot unavailable or already booked" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch booking details
    const { data: bookingData } = await userClient
      .from("bookings")
      .select("*, barbers (name), services (name, price)")
      .eq("id", data)
      .single();

    return new Response(JSON.stringify({ booking: bookingData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
