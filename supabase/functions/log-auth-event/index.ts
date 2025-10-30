import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { event_type, user_id } = await req.json()
    const allowed = ['login','logout','login_failed','mfa_enrolled','mfa_disabled']
    if (!event_type || !allowed.includes(event_type)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid event_type' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // Attempt to resolve user from headers if not passed
    let actor = user_id
    try {
      const authHeader = req.headers.get('Authorization')
      if (!actor && authHeader?.startsWith('Bearer ')) {
        const jwt = authHeader.split(' ')[1]
        const { data } = await supabaseAdmin.auth.getUser(jwt)
        actor = data.user?.id || actor
      }
    } catch {}

    // actor may be null for login_failed before authentication

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
    const userAgent = req.headers.get('user-agent') || ''

    // Insert log
    const { error: insertError } = await supabaseAdmin
      .from('auth_logs')
      .insert({ user_id: actor || null, event: event_type, ip, user_agent: userAgent })
    if (insertError) throw insertError

    // Presence update on login/logout
    if (actor) {
      const isOnline = event_type === 'login'
      const { error: presenceError } = await supabaseAdmin
        .from('profiles')
        .update({ is_online: isOnline, last_seen: new Date().toISOString() })
        .eq('id', actor)
      if (presenceError) throw presenceError
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message || 'Unknown error' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})


