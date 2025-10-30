// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type DisableMfaRequest = {
  userId?: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      // CORS preflight
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      console.warn("disable-user-mfa: wrong method", req.method);
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const bodyText = await req.text();
    console.log("disable-user-mfa: raw body", bodyText);
    const { userId } = (bodyText ? JSON.parse(bodyText) : {}) as DisableMfaRequest;
    console.log("disable-user-mfa: parsed userId", userId);
    if (!userId) {
      console.error("disable-user-mfa: missing userId");
      return jsonResponse({ error: "userId is required" }, 400);
    }

    const base = `${SUPABASE_URL}/auth/v1`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    } as HeadersInit;

    // 1) List factors for the user
    console.log("disable-user-mfa: listing factors", { url: `${base}/admin/users/${userId}/factors` });
    const listRes = await fetch(`${base}/admin/users/${userId}/factors`, {
      method: "GET",
      headers,
    });
    console.log("disable-user-mfa: list factors status", listRes.status);
    if (!listRes.ok) {
      const text = await listRes.text();
      console.error("disable-user-mfa: list factors failed", text);
      return jsonResponse({ error: `Failed to list factors: ${text}` }, 500);
    }
    const factors = (await listRes.json()) as Array<{ id: string; friendly_name?: string; type?: string }>;
    console.log("disable-user-mfa: factors", factors);

    // 2) Delete each factor
    for (const factor of factors) {
      console.log("disable-user-mfa: deleting factor", factor.id);
      const delRes = await fetch(`${base}/admin/users/${userId}/factors/${factor.id}`, {
        method: "DELETE",
        headers,
      });
      console.log("disable-user-mfa: delete status", factor.id, delRes.status);
      if (!delRes.ok) {
        const text = await delRes.text();
        console.error("disable-user-mfa: delete failed", factor.id, text);
        return jsonResponse({ error: `Failed to delete factor ${factor.id}: ${text}` }, 500);
      }
    }

    console.log("disable-user-mfa: success", { removed: factors.length });

    // Insert a notification and auth log
    try {
      const admin = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          apikey: SERVICE_ROLE_KEY,
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          user_id: userId,
          title: 'MFA Disabled',
          message: 'Multi-factor authentication was disabled for your account by an administrator.',
          type: 'warning',
          related_entity_type: 'profile',
          related_entity_id: userId
        })
      });
      console.log('disable-user-mfa: notification insert status', admin.status);
    } catch(e) { console.warn('disable-user-mfa: notification insert failed'); }

    try {
      await fetch(`${SUPABASE_URL}/functions/v1/log-auth-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ event_type: 'mfa_disabled', user_id: userId })
      });
    } catch(e) { console.warn('disable-user-mfa: log-auth-event failed'); }

    return jsonResponse({ success: true, removed: factors.length }, 200);
  } catch (err: any) {
    console.error("disable-user-mfa: error", err?.message || String(err));
    return jsonResponse({ error: err?.message || String(err) }, 500);
  }
});


