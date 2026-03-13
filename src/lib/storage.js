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
  // For local courses: store metadata only — no file content, no handles
  // File handles stay in IndexedDB on the user's browser
  const { error } = await supabase
    .from('courses')
    .upsert({
      id: course.id,
      user_id: userId,
      type: course.type || 'youtube',
      playlist_id: course.playlistId || null,
      title: course.title,
      channel: course.channelTitle,
      thumbnail: course.thumbnail || null,
      video_count: course.videoCount,
      // For local courses: store item metadata (names, types) but NOT file handles
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
    type: row.type || 'youtube',
    playlistId: row.playlist_id,
    title: row.title,
    channelTitle: row.channel,
    thumbnail: row.thumbnail,
    videoCount: row.video_count,
    videos: row.videos || [],
    sections: row.sections || null,
    addedAt: row.added_at,
    progress: {
      watchedVideos: row.watched_videos || [],
      percentage: row.percentage || 0,
      lastWatched: row.last_watched,
      lastWatchedAt: row.last_watched_at,
    }
  }
}