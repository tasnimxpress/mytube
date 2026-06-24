import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Same server-side auth pattern as /api/courses: the Supabase client runs with
// the user's session cookies, so RLS + the explicit user_id filters enforce
// that a user can only ever touch their own notes.
async function getSupabaseUser() {
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
  const { data: { user }, error } = await supabase.auth.getUser()
  return { supabase, user, error }
}

// GET /api/notes?courseId=xxx — all notes for one course, for the current user
export async function GET(request) {
  const { supabase, user, error } = await getSupabaseUser()
  if (error || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const courseId = searchParams.get('courseId')
  if (!courseId) return Response.json({ error: 'Missing courseId' }, { status: 400 })

  const { data, error: dbError } = await supabase
    .from('notes')
    .select('video_id, body, updated_at')
    .eq('user_id', user.id)
    .eq('course_id', courseId)

  if (dbError) return Response.json({ error: 'Failed to load notes' }, { status: 500 })
  return Response.json(data || [])
}

// PUT /api/notes — upsert the note for a single (course, video)
export async function PUT(request) {
  const { supabase, user, error } = await getSupabaseUser()
  if (error || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId, videoId, body } = await request.json()
  if (!courseId || !videoId) {
    return Response.json({ error: 'Missing courseId or videoId' }, { status: 400 })
  }

  const { error: dbError } = await supabase
    .from('notes')
    .upsert({
      user_id: user.id,
      course_id: courseId,
      video_id: videoId,
      body: typeof body === 'string' ? body : '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,course_id,video_id' })

  if (dbError) return Response.json({ error: 'Failed to save note' }, { status: 500 })
  return Response.json({ ok: true })
}
