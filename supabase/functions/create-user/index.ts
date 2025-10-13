import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to create user-friendly error messages
function createUserFriendlyError(error: any, context: string = 'user creation') {
  const errorCode = error.code || error.status || 'UNKNOWN_ERROR'
  const errorMessage = error.message || 'Unknown error occurred'
  
  // Common error patterns and their user-friendly messages
  const errorPatterns = {
    // Email-related errors
    'email_exists': {
      message: 'This email address is already registered in our system.',
      suggestion: 'Please use a different email address or contact support if you believe this is an error.',
      alternatives: [
        'Try adding a number or suffix to your email (e.g., user2@example.com)',
        'Use a different email address from another provider',
        'If you recently deleted a user with this email, wait a few minutes before trying again'
      ],
      statusCode: 409
    },
    'user_already_registered': {
      message: 'A user with this email address already exists.',
      suggestion: 'Please use a different email address or check if you already have an account.',
      alternatives: [
        'Try logging in with your existing account',
        'Use the "Forgot Password" feature if you can\'t remember your password',
        'Contact support if you need help accessing your account'
      ],
      statusCode: 409
    },
    'invalid_email': {
      message: 'The email address format is not valid.',
      suggestion: 'Please check your email address and try again.',
      alternatives: [
        'Make sure you\'ve included the @ symbol',
        'Check that the domain is correct (e.g., .com, .org, .net)',
        'Avoid spaces or special characters in the email address'
      ],
      statusCode: 400
    },
    
    // Password-related errors
    'password_too_short': {
      message: 'Password is too short.',
      suggestion: 'Please use a password with at least 6 characters.',
      alternatives: [
        'Use a mix of letters, numbers, and symbols',
        'Avoid common words or personal information',
        'Consider using a passphrase for better security'
      ],
      statusCode: 400
    },
    'password_too_weak': {
      message: 'Password is too weak.',
      suggestion: 'Please use a stronger password.',
      alternatives: [
        'Include uppercase and lowercase letters',
        'Add numbers and special characters',
        'Avoid common patterns or sequences'
      ],
      statusCode: 400
    },
    
    // Rate limiting and network errors
    'rate_limit': {
      message: 'Too many requests. Please wait a moment before trying again.',
      suggestion: 'This helps protect our system from abuse.',
      alternatives: [
        'Wait 1-2 minutes before trying again',
        'Check your internet connection',
        'Contact support if the problem persists'
      ],
      statusCode: 429
    },
    'network_error': {
      message: 'Network connection error.',
      suggestion: 'Please check your internet connection and try again.',
      alternatives: [
        'Verify your internet connection is working',
        'Try refreshing the page',
        'Check if other websites are accessible'
      ],
      statusCode: 503
    },
    
    // Database and server errors
    'database_error': {
      message: 'A system error occurred.',
      suggestion: 'Please try again in a few moments.',
      alternatives: [
        'Wait a few minutes before trying again',
        'Check if the system is experiencing issues',
        'Contact support if the problem continues'
      ],
      statusCode: 503
    },
    'server_error': {
      message: 'The server is temporarily unavailable.',
      suggestion: 'Please try again later.',
      alternatives: [
        'Wait a few minutes before trying again',
        'Check our status page for system updates',
        'Contact support if the problem persists'
      ],
      statusCode: 503
    },
    
    // Permission and validation errors
    'permission_denied': {
      message: 'You do not have permission to create users.',
      suggestion: 'Please contact your administrator for access.',
      alternatives: [
        'Ask your administrator to grant you user creation permissions',
        'Have an administrator create the user for you',
        'Contact support to request access'
      ],
      statusCode: 403
    },
    'validation_error': {
      message: 'Some information provided is not valid.',
      suggestion: 'Please check all fields and try again.',
      alternatives: [
        'Review the error messages below each field',
        'Make sure all required fields are filled',
        'Check that phone numbers and other data are in the correct format'
      ],
      statusCode: 400
    }
  }
  
  // Try to match the error with known patterns
  let matchedError = null
  
  // Check for exact code matches first
  if (errorPatterns[errorCode as keyof typeof errorPatterns]) {
    matchedError = errorPatterns[errorCode as keyof typeof errorPatterns]
  } else {
    // Check for pattern matches in the error message
    const lowerMessage = errorMessage.toLowerCase()
    
    if (lowerMessage.includes('email') && lowerMessage.includes('exists')) {
      matchedError = errorPatterns['email_exists']
    } else if (lowerMessage.includes('user') && lowerMessage.includes('registered')) {
      matchedError = errorPatterns['user_already_registered']
    } else if (lowerMessage.includes('invalid') && lowerMessage.includes('email')) {
      matchedError = errorPatterns['invalid_email']
    } else if (lowerMessage.includes('password') && lowerMessage.includes('short')) {
      matchedError = errorPatterns['password_too_short']
    } else if (lowerMessage.includes('password') && lowerMessage.includes('weak')) {
      matchedError = errorPatterns['password_too_weak']
    } else if (lowerMessage.includes('rate') && lowerMessage.includes('limit')) {
      matchedError = errorPatterns['rate_limit']
    } else if (lowerMessage.includes('network') || lowerMessage.includes('connection')) {
      matchedError = errorPatterns['network_error']
    } else if (lowerMessage.includes('database') || lowerMessage.includes('db')) {
      matchedError = errorPatterns['database_error']
    } else if (lowerMessage.includes('permission') || lowerMessage.includes('unauthorized')) {
      matchedError = errorPatterns['permission_denied']
    } else if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
      matchedError = errorPatterns['validation_error']
    }
  }
  
  // If we found a match, use it; otherwise, provide a generic error
  if (matchedError) {
    return {
      success: false,
      error: matchedError.message,
      suggestion: matchedError.suggestion,
      alternatives: matchedError.alternatives,
      code: errorCode,
      technicalDetails: errorMessage,
      statusCode: matchedError.statusCode
    }
  } else {
    // Generic error for unknown cases
    return {
      success: false,
      error: `Unable to ${context}. Please try again.`,
      suggestion: 'If the problem persists, contact support for assistance.',
      alternatives: [
        'Check that all information is correct',
        'Try again in a few moments',
        'Contact support if the problem continues'
      ],
      code: errorCode,
      technicalDetails: errorMessage,
      statusCode: 500
    }
  }
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
      const errorResponse = createUserFriendlyError({
        code: 'CONFIGURATION_ERROR',
        message: 'Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
      }, 'configure the system')
      
      return new Response(
        JSON.stringify(errorResponse),
        { 
          status: 200, // Return 200 so Supabase doesn't throw an error
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
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

    // Validate required fields
    if (!email || !password) {
      console.error('Missing required fields')
      const errorResponse = createUserFriendlyError({
        code: 'MISSING_REQUIRED_FIELDS',
        message: 'Email and password are required to create a user.'
      }, 'create user')
      
      return new Response(
        JSON.stringify(errorResponse),
        { 
          status: 200, // Return 200 so Supabase doesn't throw an error
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      console.error('Invalid email format:', email)
      const errorResponse = createUserFriendlyError({
        code: 'invalid_email',
        message: 'Invalid email format'
      }, 'create user')
      
      return new Response(
        JSON.stringify(errorResponse),
        { 
          status: 200, // Return 200 so Supabase doesn't throw an error
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate password length
    if (password.length < 6) {
      console.error('Password too short:', password.length)
      const errorResponse = createUserFriendlyError({
        code: 'password_too_short',
        message: 'Password must be at least 6 characters long'
      }, 'create user')
      
      return new Response(
        JSON.stringify(errorResponse),
        { 
          status: 200, // Return 200 so Supabase doesn't throw an error
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('=== CREATING USER IN SUPABASE AUTH ===')
    
    // Create the user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: password,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        full_name: userData.full_name || '',
        role: userData.role || 'user'
      }
    })

    if (authError) {
      console.error('Auth error details:', JSON.stringify(authError, null, 2))
      
      // Create user-friendly error response
      const errorResponse = createUserFriendlyError(authError, 'create user')
      
      return new Response(
        JSON.stringify(errorResponse),
        { 
          status: 200, // Return 200 so Supabase doesn't throw an error
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('=== USER CREATED IN AUTH SUCCESSFULLY ===')
    console.log('User ID:', authData.user!.id)
    console.log('User email:', authData.user!.email)

    // Create the user profile in the profiles table
    console.log('=== CREATING USER PROFILE ===')
    
    const profileData = {
      id: authData.user!.id,
      email: authData.user!.email!,
      full_name: userData.full_name || '',
      phone_number: userData.phone_number || null,
      role: userData.role || 'user',
      branch_id: userData.branchId || null,
      created_by: userData.created_by || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    console.log('Profile data to insert:', JSON.stringify(profileData, null, 2))

    // Check if profile already exists first
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', authData.user!.id)
      .single()

    let profile;
    let profileError;

    if (existingProfile) {
      // Profile exists - just fetch it without updating
      const result = await supabaseAdmin
        .from('profiles')
        .select()
        .eq('id', authData.user!.id)
        .single()
      profile = result.data
      profileError = result.error
    } else {
      // Profile doesn't exist - create it
      const result = await supabaseAdmin
        .from('profiles')
        .insert(profileData)
        .select()
        .single()
      profile = result.data
      profileError = result.error
    }

    if (profileError) {
      console.error('Profile creation failed:', profileError)
      
      // Try to clean up the auth user since profile creation failed
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user!.id)
        console.log('Cleaned up auth user after profile creation failure')
      } catch (cleanupError) {
        console.warn('Failed to cleanup auth user:', cleanupError)
      }
      
      const errorResponse = createUserFriendlyError({
        code: 'PROFILE_CREATION_FAILED',
        message: profileError.message
      }, 'create user profile')
      
      return new Response(
        JSON.stringify(errorResponse),
        { 
          status: 200, // Return 200 so Supabase doesn't throw an error
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('=== PROFILE CREATED SUCCESSFULLY ===')
    console.log('Profile data:', JSON.stringify(profile, null, 2))

    // Return success response
    const responseData = {
      success: true, 
      user: {
        id: authData.user!.id,
        email: authData.user!.email,
        profile: profile,
        role: userData.role || null
      },
      message: 'User created successfully with profile'
    }
    
    console.log('=== SUCCESS RESPONSE ===')
    console.log('Response data:', JSON.stringify(responseData, null, 2))
    console.log('=== CREATE USER FUNCTION COMPLETED SUCCESSFULLY ===')

    return new Response(
      JSON.stringify(responseData),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('=== UNEXPECTED ERROR IN CREATE USER FUNCTION ===')
    console.error('Error type:', typeof error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    console.error('Full error object:', JSON.stringify(error, null, 2))
    
    // Create user-friendly error response for unexpected errors
    const errorResponse = createUserFriendlyError({
      code: 'UNEXPECTED_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 'create user')
    
    console.error('=== ERROR RESPONSE ===')
    console.error('Error response:', JSON.stringify(errorResponse, null, 2))
    console.log('=== CREATE USER FUNCTION FAILED ===')

    return new Response(
      JSON.stringify(errorResponse),
      { 
        status: 200, // Return 200 so Supabase doesn't throw an error
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})