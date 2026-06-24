// Notes go through the server-side /api/notes route so ownership is enforced
// server-side (user session + RLS), mirroring how storage.js handles courses.
// A video can have many notes; each is its own row keyed by `id`.

export async function loadNotes(courseId) {
  const res = await fetch(`/api/notes?courseId=${encodeURIComponent(courseId)}`)
  if (!res.ok) throw new Error('Failed to load notes')
  return res.json()
}

// Per-course note counts for the current user: [{ course_id, count }].
export async function loadNoteCounts() {
  const res = await fetch('/api/notes')
  if (!res.ok) throw new Error('Failed to load note counts')
  return res.json()
}

// Create a new note. Returns { id, created_at, updated_at }.
export async function createNote(courseId, videoId, body) {
  const res = await fetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseId, videoId, body }),
  })
  if (!res.ok) throw new Error('Failed to create note')
  return res.json()
}

export async function updateNote(id, body, attempt = 1) {
  const res = await fetch('/api/notes', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, body }),
  })
  if (!res.ok) {
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 500 * attempt))
      return updateNote(id, body, attempt + 1)
    }
    throw new Error('Failed to update note')
  }
}

export async function deleteNote(id) {
  const res = await fetch(`/api/notes?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete note')
}
