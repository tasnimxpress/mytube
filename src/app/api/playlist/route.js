import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const YT_API_KEY = process.env.YOUTUBE_API_KEY
const SUPADATA_KEY = process.env.SUPADATA_API_KEY

const PLAYLIST_ID_RE = /^[a-zA-Z0-9_-]{10,64}$/

function isValidPlaylistId(id) {
  return PLAYLIST_ID_RE.test(id)
}

function parseDuration(iso) {
  if (!iso) return ''
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return ''
  const h = parseInt(match[1] || 0)
  const m = parseInt(match[2] || 0)
  const s = parseInt(match[3] || 0)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function getBestThumbnail(thumbnails) {
  return thumbnails?.maxres?.url || thumbnails?.high?.url ||
    thumbnails?.medium?.url || thumbnails?.default?.url || ''
}

// Supabase-backed rate limiter — survives serverless cold starts and
// concurrent instances. Max 20 requests per user per 60-second window.
// Requires a `rate_limits` table in Supabase (see README / setup notes).
const RATE_LIMIT = 20
const RATE_WINDOW_SEC = 60

async function isRateLimited(supabase, userId) {
  const windowStart = new Date(Date.now() - RATE_WINDOW_SEC * 1000).toISOString()

  const { count, error } = await supabase
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('requested_at', windowStart)

  if (error) {
    // If the table doesn't exist yet, fail open rather than blocking all users
    console.warn('Rate limit check failed:', error.message)
    return false
  }

  if (count >= RATE_LIMIT) return true

  await supabase.from('rate_limits').insert({ user_id: userId })
  return false
}

async function fetchViaYouTube(playlistId) {
  const videos = []
  let pageToken = ''
  let playlistTitle = ''
  let channelTitle = ''

  const infoRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${YT_API_KEY}`
  )
  if (!infoRes.ok) throw new Error('Failed to fetch playlist info')
  const info = await infoRes.json()
  if (!info.items?.length) throw new Error('Playlist not found or is private')
  playlistTitle = info.items[0].snippet.title
  channelTitle = info.items[0].snippet.channelTitle

  do {
    const tokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50&key=${YT_API_KEY}${tokenParam}`
    const res = await fetch(url)
    if (!res.ok) throw new Error('Failed to fetch playlist items')
    const data = await res.json()

    const validItems = data.items.filter(
      i => i.snippet.title !== 'Private video' && i.snippet.title !== 'Deleted video'
    )
    const videoIds = validItems.map(i => i.contentDetails.videoId)

    if (videoIds.length) {
      const detRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoIds.join(',')}&key=${YT_API_KEY}`
      )
      const detData = await detRes.json()
      const detMap = {}
      detData.items?.forEach(v => { detMap[v.id] = v })

      validItems.forEach((item, idx) => {
        const vid = item.contentDetails.videoId
        const det = detMap[vid]
        videos.push({
          id: vid,
          title: item.snippet.title,
          thumbnail: getBestThumbnail(item.snippet.thumbnails),
          duration: det ? parseDuration(det.contentDetails.duration) : '',
          description: det?.snippet?.description || '',
          channelTitle: item.snippet.videoOwnerChannelTitle || channelTitle,
          position: videos.length + idx,
        })
      })
    }
    pageToken = data.nextPageToken || ''
  } while (pageToken)

  return {
    id: playlistId,
    title: playlistTitle,
    channelTitle,
    thumbnail: videos[0]?.thumbnail || '',
    videoCount: videos.length,
    videos,
  }
}

async function fetchViaSupadata(playlistId) {
  const metaRes = await fetch(
    `https://api.supadata.ai/v1/youtube/playlist?id=${playlistId}`,
    { headers: { 'x-api-key': SUPADATA_KEY } }
  )
  if (!metaRes.ok) throw new Error('Failed to fetch playlist metadata')
  const meta = await metaRes.json()

  const videosRes = await fetch(
    `https://api.supadata.ai/v1/youtube/playlist/videos?id=${playlistId}`,
    { headers: { 'x-api-key': SUPADATA_KEY } }
  )
  if (!videosRes.ok) throw new Error('Failed to fetch playlist videos')
  const videosData = await videosRes.json()

  const items = videosData?.items || []
  const videos = items.map((v, idx) => ({
    id: v.id,
    title: v.title || `Video ${idx + 1}`,
    thumbnail: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
    duration: v.duration ? `${Math.floor(v.duration / 60)}:${String(v.duration % 60).padStart(2, '0')}` : '',
    channelTitle: meta?.channel?.name || '',
    position: idx,
  }))

  return {
    id: playlistId,
    title: meta?.title || 'Untitled Playlist',
    channelTitle: meta?.channel?.name || '',
    thumbnail: videos[0]?.thumbnail || '',
    videoCount: videos.length,
    videos,
  }
}

export async function GET(request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (await isRateLimited(supabase, user.id)) {
    return Response.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const playlistId = searchParams.get('id')

  if (!playlistId) {
    return Response.json({ error: 'Missing playlist ID' }, { status: 400 })
  }

  if (!isValidPlaylistId(playlistId)) {
    return Response.json({ error: 'Invalid playlist ID format' }, { status: 400 })
  }

  if (YT_API_KEY) {
    try {
      const data = await fetchViaYouTube(playlistId)
      return Response.json({ ...data, source: 'youtube' })
    } catch (e) {
      console.warn('YouTube API failed, trying Supadata:', e.message)
    }
  }

  if (SUPADATA_KEY) {
    try {
      const data = await fetchViaSupadata(playlistId)
      return Response.json({ ...data, source: 'supadata' })
    } catch (e) {
      console.warn('Supadata failed:', e.message)
    }
  }

  return Response.json({ error: 'Failed to fetch playlist. Make sure it is public.' }, { status: 500 })
}
