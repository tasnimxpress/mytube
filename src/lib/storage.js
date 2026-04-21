// All database operations go through server-side API routes.
// The Supabase client is never called directly from this file,
// so ownership enforcement happens server-side on every request.

export async function loadCourses() {
  const res = await fetch('/api/courses')
  if (!res.ok) throw new Error('Failed to load courses')
  return res.json()
}

export async function saveCourse(course) {
  const res = await fetch('/api/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(course),
  })
  if (!res.ok) throw new Error('Failed to save course')
}

export async function deleteCourse(courseId) {
  const res = await fetch(`/api/courses?id=${encodeURIComponent(courseId)}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete course')
}

export async function updateProgress(courseId, progress, attempt = 1) {
  const res = await fetch('/api/courses', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseId, progress }),
  })
  if (!res.ok) {
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 500 * attempt))
      return updateProgress(courseId, progress, attempt + 1)
    }
    throw new Error('Failed to update progress')
  }
}

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
