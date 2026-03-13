import { supabase } from './supabase'

// ── Courses ───────────────────────────────────────────────────────────────────

export async function loadCourses(userId) {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('user_id', userId)
    .order('added_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function saveCourse(course, userId) {
  const { error } = await supabase
    .from('courses')
    .upsert({
      id: course.id,
      user_id: userId,
      playlist_id: course.playlistId,
      title: course.title,
      channel: course.channelTitle,
      thumbnail: course.thumbnail,
      video_count: course.videoCount,
      videos: course.videos,
      watched_videos: course.progress?.watchedVideos || [],
      percentage: course.progress?.percentage || 0,
      last_watched: course.progress?.lastWatched || null,
      added_at: course.addedAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  if (error) throw error
}

export async function deleteCourse(courseId) {
  const { error } = await supabase
    .from('courses')
    .delete()
    .eq('id', courseId)
  if (error) throw error
}

export async function updateProgress(courseId, userId, progress) {
  const { error } = await supabase
    .from('courses')
    .update({
      watched_videos: progress.watchedVideos,
      percentage: progress.percentage,
      last_watched: progress.lastWatched,
      last_watched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', courseId)
    .eq('user_id', userId)
  if (error) throw error
}

// ── Map DB row → app shape ────────────────────────────────────────────────────
export function rowToCourse(row) {
  return {
    id: row.id,
    playlistId: row.playlist_id,
    title: row.title,
    channelTitle: row.channel,
    thumbnail: row.thumbnail,
    videoCount: row.video_count,
    videos: row.videos || [],
    addedAt: row.added_at,
    progress: {
      watchedVideos: row.watched_videos || [],
      percentage: row.percentage || 0,
      lastWatched: row.last_watched,
      lastWatchedAt: row.last_watched_at,
    }
  }
}
