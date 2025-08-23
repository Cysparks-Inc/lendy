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
    console.log('=== CREATE USER FUNCTION STARTED ===')
    console.log('Request method:', req.method)
    console.log('Request headers:', Object.fromEntries(req.headers.entries()))

    // Initialize Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    console.log('Environment variables check:')
    console.log('- SUPABASE_URL exists:', !!supabaseUrl)
    console.log('- SUPABASE_SERVICE_ROLE_KEY exists:', !!serviceRoleKey)
    console.log('- SUPABASE_URL length:', supabaseUrl?.length || 0)
    console.log('- SERVICE_ROLE_KEY length:', serviceRoleKey?.length || 0)

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing environment variables!')
      throw new Error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('Supabase admin client created successfully')

    const requestBody = await req.json()
    console.log('Request body received:', JSON.stringify(requestBody, null, 2))

    const { email, password, userData = {} } = requestBody

    console.log('Parsed request data:')
    console.log('- Email:', email)
    console.log('- Password length:', password?.length || 0)
    console.log('- User data:', JSON.stringify(userData, null, 2))

    if (!email || !password) {
      console.error('Missing required fields: email or password')
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
      console.error('Invalid email format:', email)
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
      console.error('Password too short:', password.length)
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

    console.log('=== STEP 1: CREATING AUTH USER ===')
    console.log('Creating user with email:', email)

    // Create the auth user first
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        full_name: userData.full_name || userData.name || '',
        phone_number: userData.phone_number || userData.phone || '',
        role: userData.role || 'staff',
        branchId: userData.branchId || null,
        created_by: userData.created_by || null,
        ...userData
      },
      email_confirm: true // Auto-confirm email for admin-created users
    })

    if (authError) {
      console.error('=== AUTH USER CREATION FAILED ===')
      console.error('Auth error details:', JSON.stringify(authError, null, 2))
      
      // Handle the specific email_exists error with a user-friendly message
      if (authError.message.includes('email_exists') || authError.code === 'email_exists') {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'This email address is already registered in our system. If you recently deleted a user with this email, please wait a few minutes or use a different email address.',
            code: 'EMAIL_ALREADY_EXISTS',
            suggestion: 'Try using a different email address or wait a few minutes if you recently deleted a user with this email.',
            alternative: 'You can also try adding a number or suffix to the email (e.g., user2@example.com)'
          }),
          { 
            status: 409, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      // Translate other common errors to user-friendly messages
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
          code: authError.status || 'AUTH_ERROR',
          details: authError.message
        }),
        { 
          status: statusCode, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('=== AUTH USER CREATED SUCCESSFULLY ===')
    console.log('User ID:', authData.user?.id)
    console.log('User email:', authData.user?.email)
    console.log('User metadata:', JSON.stringify(authData.user?.user_metadata, null, 2))

    // DIRECT APPROACH: Create profile manually instead of relying on trigger
    console.log('=== STEP 2: CREATING PROFILE ===')
    let profile = null
    try {
      console.log('Attempting to create profile for user:', authData.user!.id)
      
      const profileData = {
        id: authData.user!.id,
        email: authData.user!.email || '',
        full_name: userData.full_name || userData.name || '',
        phone_number: userData.phone_number || userData.phone || '',
        role: userData.role || null,
        branch_id: userData.branchId || null,
        created_by: userData.created_by || null
      }
      
      console.log('Profile data to insert:', JSON.stringify(profileData, null, 2))

      const { data: profileDataResult, error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert(profileData)
        .select()
        .single()

      if (profileError) {
        console.error('=== PROFILE CREATION FAILED ===')
        console.error('Profile error details:', JSON.stringify(profileError, null, 2))
        console.error('Profile error message:', profileError.message)
        console.error('Profile error code:', profileError.code)
        console.error('Profile error details:', profileError.details)
        console.error('Profile error hint:', profileError.hint)
        throw new Error(`Profile creation failed: ${profileError.message}`)
      }

      profile = profileDataResult
      console.log('=== PROFILE CREATED SUCCESSFULLY ===')
      console.log('Profile data:', JSON.stringify(profile, null, 2))
    } catch (profileError) {
      console.error('=== PROFILE CREATION ERROR HANDLING ===')
      console.error('Profile creation error:', profileError)
      console.error('Error message:', profileError.message)
      console.error('Error stack:', profileError.stack)
      
      // Try to get existing profile if it was created by trigger
      console.log('Checking if profile already exists (created by trigger)...')
      const { data: existingProfile, error: getError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', authData.user!.id)
        .single()

      if (existingProfile) {
        profile = existingProfile
        console.log('=== PROFILE ALREADY EXISTS (CREATED BY TRIGGER) ===')
        console.log('Existing profile data:', JSON.stringify(profile, null, 2))
      } else {
        console.error('=== NO EXISTING PROFILE FOUND ===')
        console.error('Get profile error:', getError)
        throw new Error(`Failed to create profile: ${profileError.message}`)
      }
    }

    console.log('=== STEP 3: ROLE STORED IN PROFILE ===')
    console.log('Role is now stored directly in the profile table')
    console.log('Role assigned:', userData.role || 'No role specified')
    const roleCreated = !!userData.role

    // Final verification
    console.log('=== STEP 4: FINAL VERIFICATION ===')
    console.log('Final profile data:', JSON.stringify(profile, null, 2))
    console.log('Role created:', roleCreated)
    console.log('User ID:', authData.user!.id)
    console.log('User email:', authData.user!.email)

    // Return success response
    const responseData = {
      success: true, 
      user: {
        id: authData.user!.id,
        email: authData.user!.email,
        profile: profile,
        role: userData.role || null,
        roleCreated: roleCreated
      },
      message: 'User created successfully with profile and role'
    }
    
    console.log('=== SUCCESS RESPONSE ===')
    console.log('Response data:', JSON.stringify(responseData, null, 2))
    console.log('=== CREATE USER FUNCTION COMPLETED SUCCESSFULLY ===')

    return new Response(
      JSON.stringify(responseData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('=== UNEXPECTED ERROR IN CREATE USER FUNCTION ===')
    console.error('Error type:', typeof error)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    console.error('Full error object:', JSON.stringify(error, null, 2))
    
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
    } else if (error.message.toLowerCase().includes('profile creation failed')) {
      userFriendlyMessage = 'User account was created but profile setup failed. Please contact your administrator.'
      statusCode = 500
    } else if (error.message.toLowerCase().includes('role creation failed')) {
      userFriendlyMessage = 'User account and profile were created but role assignment failed. Please contact your administrator.'
      statusCode = 500
    }

    const errorResponse = {
      success: false, 
      error: userFriendlyMessage,
      code: 'UNEXPECTED_ERROR',
      details: error.message,
      stack: error.stack
    }

    console.error('=== ERROR RESPONSE ===')
    console.error('Error response:', JSON.stringify(errorResponse, null, 2))
    console.log('=== CREATE USER FUNCTION FAILED ===')

    return new Response(
      JSON.stringify(errorResponse),
      { 
        status: statusCode, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})