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

// GET /api/notes?courseId=xxx — all notes for one course (many per video).
// GET /api/notes (no courseId) — per-course note counts: [{ course_id, count }].
export async function GET(request) {
  const { supabase, user, error } = await getSupabaseUser()
  if (error || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const courseId = searchParams.get('courseId')

  if (!courseId) {
    // Count only non-empty notes, grouped per course.
    const { data, error: dbError } = await supabase
      .from('notes')
      .select('course_id')
      .eq('user_id', user.id)
      .neq('body', '')

    if (dbError) return Response.json({ error: 'Failed to load note counts' }, { status: 500 })
    const counts = {}
    for (const row of data || []) {
      counts[row.course_id] = (counts[row.course_id] || 0) + 1
    }
    return Response.json(
      Object.entries(counts).map(([course_id, count]) => ({ course_id, count }))
    )
  }

  const { data, error: dbError } = await supabase
    .from('notes')
    .select('id, video_id, body, created_at, updated_at')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .order('created_at', { ascending: true })

  if (dbError) return Response.json({ error: 'Failed to load notes' }, { status: 500 })
  return Response.json(data || [])
}

// POST /api/notes — create a new note. Returns { id, created_at, updated_at }.
export async function POST(request) {
  const { supabase, user, error } = await getSupabaseUser()
  if (error || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId, videoId, body } = await request.json()
  if (!courseId || !videoId) {
    return Response.json({ error: 'Missing courseId or videoId' }, { status: 400 })
  }

  const { data, error: dbError } = await supabase
    .from('notes')
    .insert({
      user_id: user.id,
      course_id: courseId,
      video_id: videoId,
      body: typeof body === 'string' ? body : '',
    })
    .select('id, created_at, updated_at')
    .single()

  if (dbError) return Response.json({ error: 'Failed to create note' }, { status: 500 })
  return Response.json(data)
}

// PATCH /api/notes — update one note's body by id.
export async function PATCH(request) {
  const { supabase, user, error } = await getSupabaseUser()
  if (error || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, body } = await request.json()
  if (!id) return Response.json({ error: 'Missing note id' }, { status: 400 })

  const { error: dbError } = await supabase
    .from('notes')
    .update({ body: typeof body === 'string' ? body : '', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (dbError) return Response.json({ error: 'Failed to update note' }, { status: 500 })
  return Response.json({ ok: true })
}

// DELETE /api/notes?id=xxx — delete one note by id.
export async function DELETE(request) {
  const { supabase, user, error } = await getSupabaseUser()
  if (error || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Missing note id' }, { status: 400 })

  const { error: dbError } = await supabase
    .from('notes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (dbError) return Response.json({ error: 'Failed to delete note' }, { status: 500 })
  return Response.json({ ok: true })
}
