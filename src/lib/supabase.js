import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Cookie-based browser client (via @supabase/ssr). This stores the session and
// the PKCE code-verifier in cookies, so the server-side middleware and
// /auth/callback route can read them and complete exchangeCodeForSession().
// (Previously this used createClient(), which kept them in localStorage where
// the server could not see them — the cause of the failed login / auth_failed.)
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

async function googleOAuth() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  })
  if (error) throw error
}

export const signInWithGoogle = googleOAuth
export const signUpWithGoogle = googleOAuth

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}
