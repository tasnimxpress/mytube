// MyTube · FocusLearn — calls server-side API route

export function parseYouTubeInput(input) {
  input = input.trim()

  // First: try to extract a list= param from any URL shape
  const listMatch = input.match(/[?&]list=([a-zA-Z0-9_-]+)/)
  if (listMatch) return { type: 'playlist', id: listMatch[1] }

  // FIX: The old regex only accepted IDs starting with PL/UU/FL/RD/OL,
  // which excluded community playlists, mix lists, and other valid formats.
  // Now we accept any bare string that looks like a valid YouTube ID
  // (alphanumeric + hyphens/underscores, 10–64 chars) so users can paste
  // a raw ID regardless of prefix. The server validates it further.
  if (/^[a-zA-Z0-9_-]{10,64}$/.test(input)) {
    return { type: 'playlist', id: input }
  }

  return null
}

export async function fetchPlaylistData(playlistId) {
  const res = await fetch(`/api/playlist?id=${encodeURIComponent(playlistId)}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to fetch playlist')
  return data
}

export function generateCourseId() {
  return `course_${crypto.randomUUID()}`
}
