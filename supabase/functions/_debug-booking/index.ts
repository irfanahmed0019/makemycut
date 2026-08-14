import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(url, svc);
  const email = `debug${Date.now()}@makemycut.test`;
  const password = "Debug12345!x";
  const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (cErr) return Response.json({ step: "createUser", error: cErr.message }, { status: 500 });
  const pub = createClient(url, anon);
  const { data: sess, error: sErr } = await pub.auth.signInWithPassword({ email, password });
  if (sErr) return Response.json({ step: "signIn", error: sErr.message, anonPrefix: anon.slice(0, 12) }, { status: 500 });
  return Response.json({ userId: created.user?.id, token: sess.session?.access_token });
});
