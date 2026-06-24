// MyTube · FocusLearn — calls server-side API route

export function parseYouTubeInput(input) {
  input = input.trim()

  // Playlist takes precedence: a watch URL can contain both v= and list=,
  // and in that case the user almost certainly wants the whole playlist.
  const listMatch = input.match(/[?&]list=([a-zA-Z0-9_-]+)/)
  if (listMatch) return { type: 'playlist', id: listMatch[1] }

  // Single video: watch?v=, youtu.be/<id>, /shorts/<id>, /embed/<id>.
  // YouTube video IDs are exactly 11 chars.
  const videoMatch =
    input.match(/[?&]v=([a-zA-Z0-9_-]{11})/) ||
    input.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/) ||
    input.match(/\/shorts\/([a-zA-Z0-9_-]{11})/) ||
    input.match(/\/embed\/([a-zA-Z0-9_-]{11})/)
  if (videoMatch) return { type: 'video', id: videoMatch[1] }

  // Bare 11-char ID → single video.
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return { type: 'video', id: input }

  // Other bare IDs (PL/UU/FL/RD/OL prefixes, community/mix lists, etc.)
  // are playlists. The server validates further.
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

export async function fetchVideoData(videoId) {
  const res = await fetch(`/api/playlist?videoId=${encodeURIComponent(videoId)}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to fetch video')
  return data
}

export function generateCourseId() {
  return `course_${crypto.randomUUID()}`
}
