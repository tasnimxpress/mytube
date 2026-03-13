// MyTube · FocusLearn — YouTube utilities via Piped API (no API key needed)

// Piped API public instances — tried in order if one fails
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.in',
  'https://piped-api.privacy.com.de',
]

async function pipedFetch(path) {
  let lastError
  for (const instance of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${instance}${path}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (e) {
      lastError = e
    }
  }
  throw new Error(`All Piped instances failed: ${lastError?.message}`)
}

export function parseYouTubeInput(input) {
  input = input.trim()

  // Playlist URL patterns
  const match = input.match(/[?&]list=([a-zA-Z0-9_-]+)/)
  if (match) return { type: 'playlist', id: match[1] }

  // Plain playlist ID
  if (/^(PL|UU|FL|RD|OL)[a-zA-Z0-9_-]+$/.test(input)) {
    return { type: 'playlist', id: input }
  }

  return null
}

function parseDuration(seconds) {
  if (!seconds) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${m}:${String(s).padStart(2,'0')}`
}

export async function fetchPlaylistData(playlistId) {
  const data = await pipedFetch(`/playlists/${playlistId}`)

  if (!data || !data.relatedStreams) {
    throw new Error('Playlist not found or is private')
  }

  const videos = data.relatedStreams
    .filter(v => v.url && v.title)
    .map((v, idx) => {
      // Piped returns /watch?v=ID
      const videoId = v.url.match(/[?&]v=([a-zA-Z0-9_-]{11})/)?.[1] || v.url.split('v=')[1]
      return {
        id: videoId,
        title: v.title,
        thumbnail: v.thumbnail,
        duration: parseDuration(v.duration),
        channelTitle: v.uploaderName || data.uploader,
        position: idx,
      }
    })

  return {
    id: playlistId,
    title: data.name,
    channelTitle: data.uploader,
    thumbnail: videos[0]?.thumbnail || '',
    videoCount: videos.length,
    videos,
  }
}

export function generateCourseId() {
  return `course_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}
