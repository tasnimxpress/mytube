// Server-side API route — Supadata primary, Invidious fallback

const SUPADATA_API_KEY = process.env.SUPADATA_API_KEY
const SUPADATA_BASE = 'https://api.supadata.ai/v1'

// Invidious fallback instances
const INVIDIOUS_INSTANCES = [
  'https://invidious.snopyta.org',
  'https://invidious.kavin.rocks',
  'https://y.com.sb',
  'https://invidious.nerdvpn.de',
]

function parseDuration(seconds) {
  if (!seconds) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function buildThumbnail(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

// ── Supadata fetch ────────────────────────────────────────────────────────────
async function fetchViaSupadata(playlistId) {
  // Call 1: playlist metadata
  const metaRes = await fetch(`${SUPADATA_BASE}/youtube/playlist?id=${playlistId}`, {
    headers: { 'x-api-key': SUPADATA_API_KEY, 'Accept': 'application/json' },
  })
  if (!metaRes.ok) throw new Error(`Supadata metadata failed: ${metaRes.status}`)
  const meta = await metaRes.json()

  // Call 2: playlist video IDs
  const videosRes = await fetch(`${SUPADATA_BASE}/youtube/playlist/videos?id=${playlistId}`, {
    headers: { 'x-api-key': SUPADATA_API_KEY, 'Accept': 'application/json' },
  })
  if (!videosRes.ok) throw new Error(`Supadata videos failed: ${videosRes.status}`)
  const videosData = await videosRes.json()

  const videoIds = videosData?.items?.map(v => v.id) || videosData?.videoIds || []
  if (!videoIds.length) throw new Error('No videos found in playlist')

  const videos = videoIds.map((id, idx) => ({
    id,
    title: videosData?.items?.[idx]?.title || `Video ${idx + 1}`,
    thumbnail: buildThumbnail(id),
    duration: videosData?.items?.[idx]?.duration
      ? parseDuration(videosData.items[idx].duration)
      : '',
    channelTitle: meta?.channel?.name || meta?.channelTitle || '',
    position: idx,
  }))

  return {
    id: playlistId,
    title: meta?.title || 'Untitled Playlist',
    channelTitle: meta?.channel?.name || meta?.channelTitle || '',
    thumbnail: buildThumbnail(videoIds[0]),
    videoCount: videos.length,
    videos,
  }
}

// ── Invidious fallback ────────────────────────────────────────────────────────
async function fetchViaInvidious(playlistId) {
  let lastError
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const res = await fetch(
        `${instance}/api/v1/playlists/${playlistId}?fields=title,author,videos`,
        { signal: controller.signal }
      )
      clearTimeout(timeout)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!data?.videos?.length) throw new Error('No videos')

      const videos = data.videos.map((v, idx) => ({
        id: v.videoId,
        title: v.title,
        thumbnail: buildThumbnail(v.videoId),
        duration: parseDuration(v.lengthSeconds),
        channelTitle: v.author || data.author,
        position: idx,
      }))

      return {
        id: playlistId,
        title: data.title,
        channelTitle: data.author,
        thumbnail: buildThumbnail(videos[0]?.id),
        videoCount: videos.length,
        videos,
      }
    } catch (e) {
      lastError = e
      continue
    }
  }
  throw new Error(`Invidious fallback failed: ${lastError?.message}`)
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const playlistId = searchParams.get('id')

  if (!playlistId) {
    return Response.json({ error: 'Missing playlist ID' }, { status: 400 })
  }

  // Try Supadata first
  if (SUPADATA_API_KEY) {
    try {
      const data = await fetchViaSupadata(playlistId)
      return Response.json({ ...data, source: 'supadata' })
    } catch (e) {
      console.warn('Supadata failed, trying Invidious:', e.message)
    }
  }

  // Fallback to Invidious
  try {
    const data = await fetchViaInvidious(playlistId)
    return Response.json({ ...data, source: 'invidious' })
  } catch (e) {
    return Response.json({
      error: 'Failed to fetch playlist. Make sure it is public and try again.',
    }, { status: 500 })
  }
}
