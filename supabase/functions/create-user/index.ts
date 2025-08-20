import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { email, password, userData = {} } = await req.json()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email and password are required to create a user.',
          code: 'MISSING_REQUIRED_FIELDS'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Please enter a valid email address.',
          code: 'INVALID_EMAIL_FORMAT'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Basic password validation
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Password must be at least 6 characters long.',
          code: 'PASSWORD_TOO_SHORT'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Creating user with email:', email)

    // Create the auth user - this will automatically trigger profile creation via database trigger
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        full_name: userData.full_name || userData.name || '',
        phone_number: userData.phone_number || userData.phone || '',
        ...userData
      },
      email_confirm: true // Auto-confirm email for admin-created users
    })

    if (authError) {
      console.error('Auth error:', authError)
      
      // Translate common errors to user-friendly messages
      let userFriendlyMessage = 'Failed to create user'
      let statusCode = 400

      if (authError.message.toLowerCase().includes('user already registered')) {
        userFriendlyMessage = 'A user with this email address already exists. Please use a different email or check if the user is already in the system.'
        statusCode = 409 // Conflict
      } else if (authError.message.toLowerCase().includes('invalid email')) {
        userFriendlyMessage = 'Please enter a valid email address.'
      } else if (authError.message.toLowerCase().includes('password')) {
        if (authError.message.toLowerCase().includes('too short')) {
          userFriendlyMessage = 'Password is too short. Please use at least 6 characters.'
        } else if (authError.message.toLowerCase().includes('too weak')) {
          userFriendlyMessage = 'Password is too weak. Please use a stronger password with a mix of letters, numbers, and symbols.'
        } else {
          userFriendlyMessage = 'Password does not meet the required criteria. Please use at least 6 characters.'
        }
      } else if (authError.message.toLowerCase().includes('rate limit')) {
        userFriendlyMessage = 'Too many requests. Please wait a moment and try again.'
        statusCode = 429 // Too Many Requests
      } else if (authError.message.toLowerCase().includes('network')) {
        userFriendlyMessage = 'Network connection error. Please check your internet connection and try again.'
        statusCode = 503 // Service Unavailable
      } else if (authError.message.toLowerCase().includes('database')) {
        userFriendlyMessage = 'Database error occurred. Please try again in a few moments.'
        statusCode = 503 // Service Unavailable
      } else {
        // For unknown errors, provide a generic but helpful message
        userFriendlyMessage = `Unable to create user: ${authError.message}. Please check the information and try again.`
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: userFriendlyMessage,
          code: authError.status || 'AUTH_ERROR'
        }),
        { 
          status: statusCode, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('User created successfully:', authData.user?.id)

    // Wait a moment for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Verify the profile was created by the trigger
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authData.user!.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Profile check error:', profileError)
      // Profile creation failed, but user exists - try to create it manually as fallback
      const { error: manualProfileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: authData.user!.id,
          email: authData.user!.email || '',
          full_name: userData.full_name || userData.name || '',
          phone_number: userData.phone_number || userData.phone || ''
        })

      if (manualProfileError) {
        console.error('Manual profile creation failed:', manualProfileError)
        
        // Translate profile creation errors
        let profileErrorMessage = 'User account was created but profile setup failed.'
        
        if (manualProfileError.message.toLowerCase().includes('duplicate')) {
          profileErrorMessage = 'User account was created successfully, but there was a profile synchronization issue. The user should be able to log in normally.'
        } else if (manualProfileError.message.toLowerCase().includes('permission')) {
          profileErrorMessage = 'User account was created but profile permissions need to be set up. Please contact your system administrator.'
        }
        
        // Return success but with a warning about profile issues
        return new Response(
          JSON.stringify({ 
            success: true, 
            user: {
              id: authData.user!.id,
              email: authData.user!.email,
              profile: null
            },
            warning: profileErrorMessage
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    // Optionally assign user to a branch/role if provided
    if (userData.branchId && userData.role) {
      const { error: roleError } = await supabaseAdmin
        .from('user_branch_roles')
        .insert({
          user_id: authData.user!.id,
          role: userData.role,
          branch_id: userData.branchId,
          assigned_by: authData.user!.id // or pass the admin user ID
        })

      if (roleError) {
        console.error('Role assignment error:', roleError)
        
        let roleErrorMessage = 'User was created successfully, but role assignment failed.'
        
        if (roleError.message.toLowerCase().includes('foreign key')) {
          roleErrorMessage = 'User was created successfully, but the specified branch does not exist. Please assign the user to a branch manually.'
        } else if (roleError.message.toLowerCase().includes('duplicate')) {
          roleErrorMessage = 'User was created successfully. Role assignment was skipped as the user already has a role for this branch.'
        }
        
        // Return success but with a warning about role assignment
        return new Response(
          JSON.stringify({ 
            success: true, 
            user: {
              id: authData.user!.id,
              email: authData.user!.email,
              profile: profile || null
            },
            warning: roleErrorMessage
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: authData.user!.id,
          email: authData.user!.email,
          profile: profile || null
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    
    // Translate common unexpected errors
    let userFriendlyMessage = 'An unexpected error occurred while creating the user.'
    let statusCode = 500

    if (error.message.toLowerCase().includes('fetch')) {
      userFriendlyMessage = 'Unable to connect to the server. Please check your internet connection and try again.'
      statusCode = 503
    } else if (error.message.toLowerCase().includes('timeout')) {
      userFriendlyMessage = 'The request timed out. Please try again.'
      statusCode = 408
    } else if (error.message.toLowerCase().includes('json')) {
      userFriendlyMessage = 'Invalid data format received. Please check the information and try again.'
      statusCode = 400
    } else if (error.message.toLowerCase().includes('permission')) {
      userFriendlyMessage = 'You do not have permission to create users. Please contact your administrator.'
      statusCode = 403
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: userFriendlyMessage,
        code: 'UNEXPECTED_ERROR'
      }),
      { 
        status: statusCode, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})