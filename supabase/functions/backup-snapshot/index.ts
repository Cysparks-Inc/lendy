import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function toCsv(rows: any[]): string {
  if (!rows || rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const esc = (v: any) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const lines = [headers.join(',')]
  for (const r of rows) lines.push(headers.map(h => esc(r[h])).join(','))
  return lines.join('\n')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const admin = createClient(supabaseUrl, serviceRoleKey)

    // Identify caller
    let actor: string | null = null
    try {
      const authHeader = req.headers.get('Authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const jwt = authHeader.split(' ')[1]
        const { data } = await admin.auth.getUser(jwt)
        actor = data.user?.id || null
      }
    } catch {}

    // Only admins/super_admins
    if (actor) {
      const { data: prof } = await admin.from('profiles').select('role').eq('id', actor).maybeSingle()
      if (!prof || !['super_admin','admin'].includes(prof.role)) {
        return new Response(JSON.stringify({ success: false, error: 'Not authorized' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 })
      }
    }

    const date = new Date()
    const y = date.getFullYear()
    const m = String(date.getMonth()+1).padStart(2,'0')
    const d = String(date.getDate()).padStart(2,'0')
    const prefix = `${y}-${m}-${d}`

    const tables = [
      'members',
      'loans',
      'loan_payments',
      'groups',
      'branches',
      'profiles',
      'expenses'
    ]

    let totalSize = 0
    let count = 0

    for (const table of tables) {
      // Skip missing tables gracefully
      try {
        const { data, error } = await admin.from(table as any).select('*')
        if (error) continue
        const csv = toCsv(data || [])
        const bytes = new TextEncoder().encode(csv)
        const path = `${prefix}/${table}.csv`
        const { error: upErr } = await admin.storage.from('backups').upload(path, bytes, { contentType: 'text/csv', upsert: true })
        if (!upErr) { totalSize += bytes.length; count++ }
      } catch {}
    }

    // Record metadata
    try {
      await admin.from('backup_metadata').insert({
        created_by: actor,
        path: prefix,
        object_count: count,
        total_size_bytes: totalSize,
        status: 'success'
      })
    } catch {}

    return new Response(JSON.stringify({ success: true, path: prefix, objects: count, total_size_bytes: totalSize }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message || 'Unknown error' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})


