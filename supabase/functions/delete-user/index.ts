import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts' // A best practice for sharing CORS headers

// The main function that will be served.
serve(async (req) => {
  // This is a pre-flight request. It's a security check browsers do before making the actual request.
  // We must handle this correctly for the function to work from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // --- 1. Parse Incoming Request ---
    const { userId } = await req.json()
    console.log(`Received request to delete user: ${userId}`);
    
    // Validate that a userId was actually provided.
    if (!userId) {
      throw new Error("User ID (userId) is required in the request body.");
    }

    // --- 2. Create a Secure Admin Client ---
    // This client uses the Service Role Key, granting it full admin privileges.
    // NEVER expose the Service Role Key in the browser.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    console.log('Admin client created.');

    // --- 3. The Core Logic: Delete the User ---
    // This action deletes the user from the `auth.users` table.
    // Your database schema should have a trigger or cascade to delete the corresponding `profiles` row.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (error) {
      console.error('Error deleting user from Supabase Auth:', error.message);
      throw error // This will be caught by the catch block below.
    }
    console.log(`Successfully deleted user ${userId} from Supabase Auth.`);

    // --- 4. Send a Success Response ---
    return new Response(JSON.stringify({ success: true, message: `User ${userId} deleted successfully.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    // --- 5. Handle Any Errors ---
    console.error('An error occurred in the delete-user function:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400, // Use 400 for client errors, 500 for server errors
    })
  }
})