import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const SAFE_ERROR_MESSAGES = {
  missing_code:        'missing_code',
  bad_oauth_state:     'auth_failed',
  bad_oauth_callback:  'auth_failed',
  flow_state_expired:  'link_expired',
  otp_expired:         'link_expired',
}

function safeError(err) {
  if (!err) return 'auth_failed'
  const code = err.code || ''
  return SAFE_ERROR_MESSAGES[code] || 'auth_failed'
}

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('Auth callback error:', error.message)
    return NextResponse.redirect(`${origin}/login?error=${safeError(error)}`)
  }

  return NextResponse.redirect(`${origin}/`)
}
