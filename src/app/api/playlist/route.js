// Server-side API route — avoids CORS issues with Piped API

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.in',
  'https://piped-api.privacy.com.de',
  'https://piped.adminforge.de/api',
]

async function pipedFetch(path) {
  let lastError
  for (const instance of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${instance}${path}`, {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 3600 },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${instance}`)
      const data = await res.json()
      if (data && (data.relatedStreams || data.name)) return data
      throw new Error('Empty response')
    } catch (e) {
      lastError = e
      continue
    }
  }
  throw new Error(`All Piped instances failed: ${lastError?.message}`)
}

function parseDuration(seconds) {
  if (!seconds) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${m}:${String(s).padStart(2,'0')}`
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const playlistId = searchParams.get('id')

  if (!playlistId) {
    return Response.json({ error: 'Missing playlist ID' }, { status: 400 })
  }

  try {
    const data = await pipedFetch(`/playlists/${playlistId}`)

    if (!data?.relatedStreams) {
      return Response.json({ error: 'Playlist not found or is private' }, { status: 404 })
    }

    const videos = data.relatedStreams
      .filter(v => v.url && v.title)
      .map((v, idx) => {
        const videoId = v.url.match(/[?&]v=([a-zA-Z0-9_-]{11})/)?.[1]
        return {
          id: videoId,
          title: v.title,
          thumbnail: v.thumbnail,
          duration: parseDuration(v.duration),
          channelTitle: v.uploaderName || data.uploader,
          position: idx,
        }
      })
      .filter(v => v.id)

    return Response.json({
      id: playlistId,
      title: data.name,
      channelTitle: data.uploader,
      thumbnail: videos[0]?.thumbnail || '',
      videoCount: videos.length,
      videos,
    })

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
