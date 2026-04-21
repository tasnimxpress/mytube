import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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

// GET /api/courses — load all courses for the authenticated user
export async function GET() {
  const { supabase, user, error } = await getSupabaseUser()
  if (error || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error: dbError } = await supabase
    .from('courses')
    .select('*')
    .eq('user_id', user.id)
    .order('added_at', { ascending: false })

  if (dbError) return Response.json({ error: 'Failed to load courses' }, { status: 500 })
  return Response.json(data || [])
}

// POST /api/courses — upsert a course
export async function POST(request) {
  const { supabase, user, error } = await getSupabaseUser()
  if (error || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const course = await request.json()

  const { error: dbError } = await supabase
    .from('courses')
    .upsert({
      id: course.id,
      user_id: user.id,
      type: course.type || 'youtube',
      playlist_id: course.playlistId || course.id,
      title: course.title,
      channel: course.channelTitle,
      thumbnail: course.thumbnail || null,
      video_count: course.videoCount,
      videos: course.type === 'local'
        ? course.videos.map(v => ({ id: v.id, name: v.name, fullName: v.fullName, fileType: v.fileType }))
        : course.videos,
      sections: course.type === 'local'
        ? course.sections.map(s => ({
          title: s.title,
          items: s.items.map(i => ({ id: i.id, name: i.name, fullName: i.fullName, fileType: i.fileType }))
        }))
        : null,
      watched_videos: course.progress?.watchedVideos || [],
      percentage: course.progress?.percentage || 0,
      last_watched: course.progress?.lastWatched || null,
      added_at: course.addedAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

  if (dbError) return Response.json({ error: 'Failed to save course' }, { status: 500 })
  return Response.json({ ok: true })
}

// PATCH /api/courses — update progress
export async function PATCH(request) {
  const { supabase, user, error } = await getSupabaseUser()
  if (error || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId, progress } = await request.json()
  if (!courseId) return Response.json({ error: 'Missing courseId' }, { status: 400 })

  const { error: dbError } = await supabase
    .from('courses')
    .update({
      watched_videos: progress.watchedVideos,
      percentage: progress.percentage,
      last_watched: progress.lastWatched,
      last_watched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', courseId)
    .eq('user_id', user.id)

  if (dbError) return Response.json({ error: 'Failed to update progress' }, { status: 500 })
  return Response.json({ ok: true })
}

// DELETE /api/courses?id=xxx
export async function DELETE(request) {
  const { supabase, user, error } = await getSupabaseUser()
  if (error || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const courseId = searchParams.get('id')
  if (!courseId) return Response.json({ error: 'Missing course id' }, { status: 400 })

  const { error: dbError } = await supabase
    .from('courses')
    .delete()
    .eq('id', courseId)
    .eq('user_id', user.id)

  if (dbError) return Response.json({ error: 'Failed to delete course' }, { status: 500 })
  return Response.json({ ok: true })
}
