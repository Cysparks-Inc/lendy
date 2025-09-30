import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // --- NEW: Check for secrets first ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Function is missing required environment variables (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    
    const { name, email, phone, branch_id, password } = await req.json();

    if (!name || !email || !branch_id || !password) {
      throw new Error("Missing required fields: name, email, branch_id, and password are required.");
    }

    // 1. Create a new user in auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
    });
    if (authError) throw authError;
    const userId = authData.user.id;

    // 2. Upsert a profile for the new user
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: userId, full_name: name, phone_number: phone });
    if (profileError) throw profileError;
    
    // 3. Assign the loan officer role and branch
    const { error: roleError } = await supabaseAdmin
      .from('user_branch_roles')
      .insert({
        user_id: userId,
        branch_id: branch_id,
        role: 'loan_officer'
      });
    if (roleError) throw roleError;

    return new Response(JSON.stringify({ message: `Successfully created loan officer ${name}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500, // Use 500 for internal server errors
    });
  }
})