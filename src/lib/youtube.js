// MyTube · FocusLearn — calls server-side API route

export function parseYouTubeInput(input) {
  input = input.trim()
  const match = input.match(/[?&]list=([a-zA-Z0-9_-]+)/)
  if (match) return { type: 'playlist', id: match[1] }
  if (/^(PL|UU|FL|RD|OL)[a-zA-Z0-9_-]+$/.test(input)) {
    return { type: 'playlist', id: input }
  }
  return null
}

export async function fetchPlaylistData(playlistId) {
  const res = await fetch(`/api/playlist?id=${playlistId}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to fetch playlist')
  return data
}

export function generateCourseId() {
  return `course_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}
