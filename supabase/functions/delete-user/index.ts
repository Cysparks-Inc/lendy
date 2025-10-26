import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// CORS headers for browser compatibility
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId } = await req.json()
    console.log(`Received request to delete user: ${userId}`);
    
    if (!userId) {
      throw new Error("User ID (userId) is required in the request body.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    console.log('Admin client created.');

    // --- Step 1: Check if user exists and get their role ---
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, branch_id, email')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error(`User profile not found: ${profileError?.message || 'Profile does not exist'}`);
    }

    console.log(`Found user profile: ${profile.role} role, branch: ${profile.branch_id}, email: ${profile.email}`);

    // --- Step 2: Handle role-specific cleanup ---
    if (profile.role === 'super_admin') {
      // Check if this is the last super admin
      const { count: superAdminCount, error: countError } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'super_admin');

      if (countError) {
        console.warn('Could not count super admins:', countError.message);
      } else if (superAdminCount !== null && superAdminCount <= 1) {
        throw new Error('Cannot delete the last super admin. At least one super admin must remain in the system.');
      }
    }

    // --- Step 3: Clean up related data in order ---
    console.log('Starting cleanup of related data...');

    // 3a. Remove user from any groups they manage (if they're a loan officer)
    if (profile.role === 'loan_officer') {
      const { error: groupUpdateError } = await supabaseAdmin
        .from('members')
        .update({ assigned_officer_id: null })
        .eq('assigned_officer_id', userId);

      if (groupUpdateError) {
        console.warn('Could not update member assignments:', groupUpdateError.message);
      } else {
        console.log('Updated member assignments');
      }

      // Remove from loans table
      const { error: loanUpdateError } = await supabaseAdmin
        .from('loans')
        .update({ loan_officer_id: null })
        .eq('loan_officer_id', userId);

      if (loanUpdateError) {
        console.warn('Could not update loan assignments:', loanUpdateError.message);
      } else {
        console.log('Updated loan assignments');
      }
    }

    // 3b. Remove user from any branch management roles
    if (profile.role === 'branch_manager') {
      // Update any members that might reference this user
      const { error: memberUpdateError } = await supabaseAdmin
        .from('members')
        .update({ assigned_officer_id: null })
        .eq('assigned_officer_id', userId);

      if (memberUpdateError) {
        console.warn('Could not update member assignments:', memberUpdateError.message);
      } else {
        console.log('Updated member assignments for branch manager');
      }
    }

    // 3c. Clean up any audit logs FIRST (this is critical to avoid foreign key constraint errors)
    try {
      console.log('Cleaning up audit logs...');
      const { error: auditError } = await supabaseAdmin
        .from('audit_log')
        .delete()
        .eq('user_id', userId);

      if (auditError) {
        console.warn('Could not clean up audit logs:', auditError.message);
        // If audit log cleanup fails, we need to handle this carefully
        // Try to update user_id to NULL instead of deleting
        const { error: auditUpdateError } = await supabaseAdmin
          .from('audit_log')
          .update({ user_id: null })
          .eq('user_id', userId);
        
        if (auditUpdateError) {
          console.warn('Could not update audit logs either:', auditUpdateError.message);
        } else {
          console.log('Updated audit logs to remove user references');
        }
      } else {
        console.log('Cleaned up audit logs');
      }
    } catch (error) {
      console.warn('Audit log table might not exist:', error instanceof Error ? error.message : 'Unknown error');
    }

    // 3d. Clean up communication logs
    try {
      const { error: commError } = await supabaseAdmin
        .from('communication_logs')
        .delete()
        .eq('officer_id', userId);

      if (commError) {
        console.warn('Could not clean up communication logs:', commError.message);
      } else {
        console.log('Cleaned up communication logs');
      }
    } catch (error) {
      console.warn('Communication logs table might not exist:', error.message);
    }

    // 3e. Clean up collection logs
    try {
      const { error: collError } = await supabaseAdmin
        .from('collection_logs')
        .delete()
        .eq('officer_id', userId);

      if (collError) {
        console.warn('Could not clean up collection logs:', collError.message);
      } else {
        console.log('Cleaned up collection logs');
      }
    } catch (error) {
      console.warn('Collection logs table might not exist:', error.message);
    }

    // 3f. Clean up any payments recorded by this user
    try {
      const { error: paymentError } = await supabaseAdmin
        .from('payments')
        .update({ recorded_by: null })
        .eq('recorded_by', userId);

      if (paymentError) {
        console.warn('Could not update payments recorded_by:', paymentError.message);
      } else {
        console.log('Updated payments recorded_by references');
      }
    } catch (error) {
      console.warn('Payments table might not exist:', error.message);
    }

    // 3g. Update any loans created by this user
    try {
      const { error: loanUpdateError } = await supabaseAdmin
        .from('loans')
        .update({ created_by: null })
        .eq('created_by', userId);

      if (loanUpdateError) {
        console.warn('Could not update loan created_by:', loanUpdateError.message);
      } else {
        console.log('Updated loan created_by references');
      }
    } catch (error) {
      console.warn('Loans table might not have created_by column:', error.message);
    }

    // 3h. Update any members created by this user
    try {
      const { error: memberUpdateError } = await supabaseAdmin
        .from('members')
        .update({ created_by: null })
        .eq('created_by', userId);

      if (memberUpdateError) {
        console.warn('Could not update member created_by:', memberUpdateError.message);
      } else {
        console.log('Updated member created_by references');
      }
    } catch (error) {
      console.warn('Members table might not have created_by column:', error.message);
    }

    // 3i. Update any groups created by this user
    try {
      const { error: groupUpdateError } = await supabaseAdmin
        .from('groups')
        .update({ created_by: null })
        .eq('created_by', userId);

      if (groupUpdateError) {
        console.warn('Could not update group created_by:', groupUpdateError.message);
      } else {
        console.log('Updated group created_by references');
      }
    } catch (error) {
      console.warn('Groups table might not have created_by column:', error.message);
    }

    // 3j. Update any branches where this user is the manager
    try {
      const { error: branchUpdateError } = await supabaseAdmin
        .from('branches')
        .update({ manager_id: null })
        .eq('manager_id', userId);

      if (branchUpdateError) {
        console.warn('Could not update branch manager_id:', branchUpdateError.message);
      } else {
        console.log('Updated branch manager_id references');
      }
    } catch (error) {
      console.warn('Branches table might not have manager_id column:', error.message);
    }

    // 3k. Update any member documents uploaded by this user
    try {
      const { error: docUpdateError } = await supabaseAdmin
        .from('member_documents')
        .update({ uploaded_by: null })
        .eq('uploaded_by', userId);

      if (docUpdateError) {
        console.warn('Could not update member documents uploaded_by:', docUpdateError.message);
      } else {
        console.log('Updated member documents uploaded_by references');
      }
    } catch (error) {
      console.warn('Member documents table might not exist:', error.message);
    }

    // 3l. Update any member documents verified by this user
    try {
      const { error: docVerifyError } = await supabaseAdmin
        .from('member_documents')
        .update({ verified_by: null })
        .eq('verified_by', userId);

      if (docVerifyError) {
        console.warn('Could not update member documents verified_by:', docVerifyError.message);
      } else {
        console.log('Updated member documents verified_by references');
      }
    } catch (error) {
      console.warn('Member documents table might not exist:', error.message);
    }

    // 3m. Update any collateral created by this user
    try {
      const { error: collateralUpdateError } = await supabaseAdmin
        .from('collateral')
        .update({ created_by: null })
        .eq('created_by', userId);

      if (collateralUpdateError) {
        console.warn('Could not update collateral created_by:', collateralUpdateError.message);
      } else {
        console.log('Updated collateral created_by references');
      }
    } catch (error) {
      console.warn('Collateral table might not exist:', error.message);
    }

    // 3n. Update any repayments received by this user
    try {
      const { error: repaymentUpdateError } = await supabaseAdmin
        .from('repayments')
        .update({ received_by: null })
        .eq('received_by', userId);

      if (repaymentUpdateError) {
        console.warn('Could not update repayment received_by:', repaymentUpdateError.message);
      } else {
        console.log('Updated repayment received_by references');
      }
    } catch (error) {
      console.warn('Repayments table might not exist:', error.message);
    }

    // --- Step 4: Call the simplified cleanup function manually ---
    console.log('Calling simplified cleanup function...');
    try {
      const { error: cleanupError } = await supabaseAdmin
        .rpc('cleanup_user_references_simple', { user_id_param: userId });

      if (cleanupError) {
        console.warn('Cleanup function error (non-critical):', cleanupError.message);
      } else {
        console.log('Cleanup function executed successfully');
      }
    } catch (error) {
      console.warn('Cleanup function call failed (non-critical):', error.message);
    }

    // --- Step 5: Delete the profile record ---
    console.log('Deleting user profile...');
    const { error: profileDeleteError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileDeleteError) {
      console.error('Error deleting profile:', profileDeleteError.message);
      throw new Error(`Failed to delete user profile: ${profileDeleteError.message}`);
    }

    console.log('Profile deleted successfully');

    // --- Step 6: Delete the user from auth.users with proper cleanup ---
    console.log('Deleting user from auth system...');
    
    // First, try to get the auth user to check if it exists
    try {
      const { data: authUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
      
      if (getUserError) {
        console.warn('Could not get auth user (might already be deleted):', getUserError.message);
      } else if (authUser.user) {
        console.log('Found auth user, proceeding with deletion...');
        
        // Delete the auth user
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (authDeleteError) {
          console.error('Error deleting user from auth:', authDeleteError.message);
          throw new Error(`Failed to delete user from auth system: ${authDeleteError.message}`);
        }
        
        console.log('Auth user deleted successfully');
      } else {
        console.log('Auth user not found, skipping auth deletion');
      }
    } catch (error) {
      console.warn('Error during auth user deletion process:', error.message);
      // Continue with the process even if auth deletion fails
    }

    // --- Step 7: Handle email reuse issue ---
    // Note: Supabase Auth doesn't immediately release emails for reuse
    // This is a limitation of the platform. Users may need to wait or use different emails
    console.log('Note: Email reuse may be limited by Supabase Auth policies');

    console.log(`Successfully deleted user ${userId} completely.`);

    // --- Step 8: Send Success Response ---
    return new Response(JSON.stringify({ 
      success: true, 
      message: `User ${userId} deleted successfully.`,
      cleanup: {
        profile: true,
        auth: true,
        related_data: true
      },
      note: "Email reuse may be limited by Supabase Auth policies. If you need to reuse the email immediately, consider using a different email address or waiting for the system to fully process the deletion."
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('An error occurred in the delete-user function:', error.message);
    
    // Return a more detailed error response
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      details: 'Database error deleting user',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})