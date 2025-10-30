// File: supabase/functions/reset-user-password/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers for browser compatibility
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests. This is a security requirement for browsers.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Parse the incoming request body
    const { userId, newPassword } = await req.json()
    console.log(`Received request to reset password for user: ${userId}`);

    // 2. Validate the input
    if (!userId) throw new Error("User ID (userId) is required.");
    if (!newPassword || newPassword.length < 6) {
      throw new Error("New password is required and must be at least 6 characters long.");
    }

    // 3. Create a secure, admin-level Supabase client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Use the powerful service role key
    )
    console.log('Admin client created for password reset.');

    // 4. Perform the core administrative action
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )

    if (error) {
      console.error('Error updating user password in Supabase Auth:', error.message);
      throw error;
    }
    console.log(`Successfully updated password for user ${data.user.email}`);

    // 5. Insert a notification for the affected user
    try {
      const { error: notifError } = await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: userId,
          title: 'Password Changed',
          message: 'Your password was reset by an administrator. If this was not you, please contact support immediately.',
          type: 'info',
          related_entity_type: 'profile',
          related_entity_id: userId
        });
      if (notifError) {
        console.warn('Failed to insert password change notification:', notifError.message);
      }
    } catch(_e) {
      console.warn('Notification insertion failed.');
    }

    // 6. Send a success response
    return new Response(JSON.stringify({ success: true, message: `Password for user ${data.user.email} has been reset.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    // 6. Handle any errors gracefully
    console.error('An error occurred in the reset-user-password function:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})