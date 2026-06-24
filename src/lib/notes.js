// Notes go through the server-side /api/notes route so ownership is enforced
// server-side (user session + RLS), mirroring how storage.js handles courses.

export async function loadNotes(courseId) {
  const res = await fetch(`/api/notes?courseId=${encodeURIComponent(courseId)}`)
  if (!res.ok) throw new Error('Failed to load notes')
  return res.json()
}

export async function saveNote(courseId, videoId, body, attempt = 1) {
  const res = await fetch('/api/notes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseId, videoId, body }),
  })
  if (!res.ok) {
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 500 * attempt))
      return saveNote(courseId, videoId, body, attempt + 1)
    }
    throw new Error('Failed to save note')
  }
}
