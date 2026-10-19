// Mizan — Strava connection (Supabase Edge Function "strava").
// Secrets used: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET (set in Supabase > Edge Functions > Secrets).
// Actions: start, exchange, status, sync, disconnect.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function serviceKey(): string {
  const k = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (k) return k;
  try {
    const o = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    return o.default || Object.values(o)[0] as string;
  } catch { return ""; }
}
const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), { auth: { persistSession: false } });
const CLIENT_ID = Deno.env.get("STRAVA_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET") || "";

async function userFrom(req: Request) {
  const h = req.headers.get("Authorization") || "";
  const jwt = h.replace(/^Bearer\s+/i, "");
  if (!jwt || jwt.startsWith("sb_")) return null;
  const { data, error } = await admin.auth.getUser(jwt);
  return error ? null : data.user;
}

async function tokenRequest(params: Record<string, string>) {
  const r = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.message || "Strava refused the request (" + r.status + ")");
  return body;
}

async function freshToken(row: any) {
  const now = Math.floor(Date.now() / 1000);
  if (row.access_token && row.expires_at > now + 120) return row.access_token;
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: row.refresh_token });
  await admin.from("strava_links").update({
    access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at, updated_at: new Date().toISOString(),
  }).eq("user_id", row.user_id);
  return t.access_token;
}

async function strava(path: string, token: string) {
  const r = await fetch("https://www.strava.com/api/v3" + path, { headers: { Authorization: "Bearer " + token } });
  if (r.status === 429) throw new Error("Strava is busy right now. Try again in 15 minutes.");
  if (!r.ok) throw new Error("Strava error " + r.status);
  return r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (!CLIENT_ID || !CLIENT_SECRET) return json({ error: "Strava is not set up on the server yet." }, 500);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // The browser that returns from Strava may not have the Mizan session (iPhone home-screen apps),
    // so the code exchange is matched by a one-time state value instead of the session.
    if (action === "exchange") {
      const state = String(body.state || "");
      if (!state || !body.code) return json({ error: "Missing code" }, 400);
      const { data: row } = await admin.from("strava_links").select("user_id, state_expires").eq("oauth_state", state).maybeSingle();
      if (!row || new Date(row.state_expires).getTime() < Date.now()) return json({ error: "This Strava link has expired. Tap Connect Strava again." }, 400);
      const t = await tokenRequest({ grant_type: "authorization_code", code: String(body.code) });
      const a = t.athlete || {};
      await admin.from("strava_links").update({
        athlete_id: a.id, athlete_name: [a.firstname, a.lastname].filter(Boolean).join(" "),
        access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at,
        oauth_state: null, state_expires: null, updated_at: new Date().toISOString(),
      }).eq("user_id", row.user_id);
      return json({ connected: true, athlete: a.firstname || "" });
    }

    const user = await userFrom(req);
    if (!user) return json({ error: "Please sign in again." }, 401);

    if (action === "start") {
      const state = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const { error } = await admin.from("strava_links").upsert({
        user_id: user.id, oauth_state: state, state_expires: new Date(Date.now() + 15 * 60 * 1000).toISOString(), updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
      const url = "https://www.strava.com/oauth/authorize?" + new URLSearchParams({
        client_id: CLIENT_ID, response_type: "code", redirect_uri: String(body.redirect || ""),
        approval_prompt: "auto", scope: "read,activity:read_all", state,
      });
      return json({ url });
    }

    const { data: row } = await admin.from("strava_links").select("*").eq("user_id", user.id).maybeSingle();
    const connected = !!(row && row.refresh_token);

    if (action === "status") return json({ connected, athlete: connected ? row.athlete_name : null });

    if (action === "disconnect") {
      if (connected) {
        try {
          await fetch("https://www.strava.com/oauth/deauthorize", { method: "POST", headers: { Authorization: "Bearer " + (await freshToken(row)) } });
        } catch (_) { /* best effort */ }
      }
      await admin.from("strava_links").delete().eq("user_id", user.id);
      return json({ connected: false });
    }

    if (action === "sync") {
      if (!connected) return json({ connected: false, activities: [] });
      const token = await freshToken(row);
      const after = Math.max(0, Number(body.after) || Math.floor(Date.now() / 1000) - 14 * 86400);
      const skip = new Set((Array.isArray(body.skip) ? body.skip : []).map(String));
      const list: any[] = await strava(`/athlete/activities?after=${after}&per_page=60`, token);
      const out = [];
      let details = 0;
      for (const a of list) {
        const id = String(a.id);
        if (skip.has(id)) continue;
        let calories = null;
        if (details < 25) {
          details++;
          try { const d = await strava(`/activities/${id}`, token); calories = d.calories ?? null; } catch (_) { /* keep summary */ }
        }
        out.push({
          id, name: a.name, type: a.sport_type || a.type, start: a.start_date_local,
          moving: a.moving_time, elapsed: a.elapsed_time, distance: a.distance,
          calories, kilojoules: a.kilojoules ?? null, device: a.device_name ?? null,
        });
      }
      return json({ connected: true, athlete: row.athlete_name, activities: out });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message || "Something went wrong" }, 500);
  }
});
