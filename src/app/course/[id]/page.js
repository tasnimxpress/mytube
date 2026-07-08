'use client'
import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { requestFolderAccess, saveFolderHandle, getFileUrl, getFileText, getSubtitleUrl, getFileIcon, getFileType, isSubtitleFile } from '@/lib/localCourse'
import { loadNotes, createNote, updateNote, deleteNote } from '@/lib/notes'

const NAV_H = 56
const CTRL_H = 49
const SIDEBAR_OFFSET = 32

function mediaHeight(sidebarOpen) {
  const offset = sidebarOpen ? SIDEBAR_OFFSET : 0
  return `calc(100vh - ${NAV_H}px - ${CTRL_H}px - ${offset}px)`
}

const MEDIA_WRAPPER_BASE = {
  background: '#000',
  width: '100%',
  flexShrink: 0,
  position: 'relative',
  overflow: 'hidden',
}

const MEDIA_INNER = {
  position: 'absolute',
  top: 0, left: 0,
  width: '100%', height: '100%',
  border: 'none',
}

// How often (ms) a playing video reports its position back for saving.
const POSITION_SAVE_INTERVAL = 60000

// Resolve a local item's kind. We keep BOTH sources: trust a specific stored
// `fileType` (set correctly for newly (re)imported courses), but when it's
// missing or the generic "other" (older imports saved html/text/code/audio as
// "other"), re-derive it from the filename. So a course works whether or not
// it has been re-imported.
function resolveFileType(item) {
  if (!item) return 'other'
  if (item.fileType && item.fileType !== 'other') return item.fileType
  return getFileType(item.fullName || item.name || '')
}

// ── YouTube IFrame Player API ───────────────────────────────────────────────
// A plain <iframe> embed is cross-origin and opaque — you can't read the
// playback position from it. To support resume, we drive the player through
// YouTube's IFrame API, which lets us pass a `start` second and poll
// getCurrentTime(). The API script is a singleton loaded once per page.
let ytApiPromise = null
function loadYouTubeApi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT)
  if (ytApiPromise) return ytApiPromise
  ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev()
      resolve(window.YT)
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
  return ytApiPromise
}

// Drives one YouTube video. Auto-seeks to `startAt` seconds, reports position
// via onProgress every few seconds while playing (and on pause), and reports
// blocked/embed-disabled videos via onBlocked. Remount (via key) per video.
function YouTubePlayer({ videoId, startAt, onProgress, onBlocked }) {
  const hostRef = useRef(null)
  // Keep the latest callbacks/props in refs so the polling interval and API
  // callbacks always see current values without re-running the effect.
  const onProgressRef = useRef(onProgress)
  const onBlockedRef = useRef(onBlocked)
  const startAtRef = useRef(startAt)
  onProgressRef.current = onProgress
  onBlockedRef.current = onBlocked

  useEffect(() => {
    let destroyed = false
    let player = null
    let interval = null

    const flush = () => {
      try {
        const t = player?.getCurrentTime?.()
        if (typeof t === 'number' && t > 0) onProgressRef.current(t)
      } catch (_) { /* player torn down mid-call */ }
    }
    const stopPolling = () => { if (interval) { clearInterval(interval); interval = null } }

    loadYouTubeApi().then((YT) => {
      if (destroyed || !hostRef.current) return
      player = new YT.Player(hostRef.current, {
        width: '100%', height: '100%',
        videoId,
        playerVars: {
          autoplay: 1, rel: 0, modestbranding: 1,
          iv_load_policy: 3, color: 'white',
          start: Math.max(0, Math.floor(startAtRef.current || 0)),
        },
        events: {
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) {
              stopPolling()
              interval = setInterval(flush, POSITION_SAVE_INTERVAL)
            } else if (e.data === YT.PlayerState.ENDED) {
              stopPolling()
              onProgressRef.current(0) // finished → start over next time
            } else {
              stopPolling()
              if (e.data === YT.PlayerState.PAUSED) flush()
            }
          },
          onError: () => onBlockedRef.current?.(),
        },
      })
    })

    return () => {
      destroyed = true
      stopPolling()
      flush() // save where we left off before tearing the player down
      try { player?.destroy?.() } catch (_) { }
    }
  }, [videoId])

  // The API replaces this inner node with its iframe; the wrapper keeps our
  // absolute-fill sizing regardless of what YouTube injects.
  return (
    <div style={MEDIA_INNER}>
      <div ref={hostRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

// Native <video> wrapper that resumes from `startAt` and reports position via
// onProgress while playing / on pause / on unmount. Remount (via key) per file.
// `subtitleSrc` (a WebVTT blob: URL, optional) is shown as captions.
function LocalVideoPlayer({ src, subtitleSrc, startAt, onProgress }) {
  const ref = useRef(null)
  const onProgressRef = useRef(onProgress)
  const startAtRef = useRef(startAt)
  const lastSaved = useRef(0)
  onProgressRef.current = onProgress

  useEffect(() => {
    const v = ref.current
    if (!v) return

    const seekToStart = () => {
      const s = startAtRef.current
      // Don't seek if we're essentially at the end — let it start over.
      if (s > 0 && (!v.duration || s < v.duration - 1)) {
        try { v.currentTime = s } catch (_) { }
      }
    }
    const onTime = () => {
      const t = v.currentTime
      if (Math.abs(t - lastSaved.current) >= POSITION_SAVE_INTERVAL / 1000) {
        lastSaved.current = t
        onProgressRef.current(t)
      }
    }
    const onPause = () => { if (v.currentTime > 0) onProgressRef.current(v.currentTime) }
    const onEnded = () => onProgressRef.current(0) // finished → start over next time

    // Metadata may already be loaded (cached blob) by the time this runs.
    if (v.readyState >= 1) seekToStart()
    v.addEventListener('loadedmetadata', seekToStart)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('pause', onPause)
    v.addEventListener('ended', onEnded)

    return () => {
      v.removeEventListener('loadedmetadata', seekToStart)
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('ended', onEnded)
      if (v.currentTime > 0) onProgressRef.current(v.currentTime)
    }
  }, [src])

  // Show captions when a subtitle track is present. The `default` attribute is
  // only honored for tracks present at initial parse; the subtitle loads a tick
  // after the video, so the added track needs its mode set explicitly.
  useEffect(() => {
    const v = ref.current
    if (!v || !subtitleSrc) return
    const show = () => { const t = v.textTracks?.[0]; if (t) t.mode = 'showing' }
    show()
    const id = setTimeout(show, 0)
    return () => clearTimeout(id)
  }, [subtitleSrc])

  return (
    <video ref={ref} src={src} controls autoPlay style={MEDIA_INNER}>
      {subtitleSrc && <track kind="subtitles" src={subtitleSrc} srcLang="en" label="Subtitles" default />}
    </video>
  )
}

function CoursePlayer({ courseId }) {
  const router = useRouter()
  const { getCourse, markVideoWatched, setLastWatched, savePosition, isLoading, saveError, setSaveError } = useApp()
  const [course, setCourse] = useState(null)
  const [activeItemId, setActiveItemId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [tab, setTab] = useState('content')
  const [descOpen, setDescOpen] = useState(false)
  const [embedBlocked, setEmbedBlocked] = useState(false)

  // Notes: a flat list of note rows for this course (many per video). Loaded
  // once per course. sidebarView toggles the sidebar between the content list
  // and the notes editor so notes can be written while the video keeps playing.
  const [allNotes, setAllNotes] = useState([])
  const [sidebarView, setSidebarView] = useState('content')

  // Local course state
  const [folderHandle, setFolderHandle] = useState(null)
  const [localFileUrl, setLocalFileUrl] = useState(null)
  const [subtitleUrl, setSubtitleUrl] = useState(null)
  const [localTextContent, setLocalTextContent] = useState(null)
  const [localError, setLocalError] = useState(null)
  const [needsPermission, setNeedsPermission] = useState(false)

  // FIX: Track ALL blob URLs created this session so we can revoke them all
  // on unmount, preventing memory leaks for large video/PDF/image files.
  const blobUrlsRef = useRef([])

  // ── Revoke all blob URLs on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
      blobUrlsRef.current = []
    }
  }, [])

  // ── Init course ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading) {
      const c = getCourse(courseId)
      if (!c) { router.push('/'); return }
      setCourse(c)
      const lastWatched = c.progress?.lastWatched
      const allItems = c.videos || []
      if (lastWatched && allItems.find(v => v.id === lastWatched)) {
        setActiveItemId(lastWatched)
      } else {
        const first = allItems.find(v => !c.progress?.watchedVideos?.includes(v.id))
        setActiveItemId(first?.id || allItems[0]?.id)
      }
    }
  }, [isLoading, courseId, getCourse, router])

  // ── Request folder access ONCE per course ───────────────────────────────────
  // Kept out of the init effect (which re-runs on every `getCourse` identity
  // change, i.e. every position save). Re-requesting here would hand back a new
  // FileSystemDirectoryHandle object each time, changing `folderHandle`, which
  // would re-run the file loader below and remount the <video> mid-playback —
  // making local videos stutter/freeze every time a position is saved. The
  // `folderHandle` guard ensures this fires only until access is granted.
  useEffect(() => {
    if (isLoading || folderHandle) return
    const c = getCourse(courseId)
    if (!c || c.type !== 'local') return
    requestFolderAccess(courseId).then(handle => {
      if (handle) setFolderHandle(handle)
      else setNeedsPermission(true)
    })
    // getCourse is intentionally omitted: including it would re-run this on every
    // course update (e.g. each position save), re-requesting folder access and
    // remounting the <video>. courseId is only read to fetch a stable course.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, courseId, folderHandle])

  useEffect(() => {
    if (!isLoading) {
      const c = getCourse(courseId)
      if (c) setCourse(c)
    }
  }, [isLoading, courseId, getCourse])

  useEffect(() => {
    setEmbedBlocked(false)
  }, [activeItemId])

  // ── Load notes once the course is known ─────────────────────────────────────
  useEffect(() => {
    if (isLoading || !course) return
    let cancelled = false
    loadNotes(courseId)
      .then(rows => { if (!cancelled) setAllNotes(rows) })
      .catch(e => console.error('Failed to load notes:', e))
    return () => { cancelled = true }
    // `course` is only read for a null-guard; course?.id is the real dependency.
    // Depending on the whole object would reload notes on every course update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, courseId, course?.id])

  // ── Load local file when active item changes ────────────────────────────────
  useEffect(() => {
    if (!course || course.type !== 'local' || !activeItemId || !folderHandle) return

    // Revoke previous blob URLs (file + subtitle) before creating new ones
    if (localFileUrl) {
      URL.revokeObjectURL(localFileUrl)
      blobUrlsRef.current = blobUrlsRef.current.filter(u => u !== localFileUrl)
    }
    if (subtitleUrl) {
      URL.revokeObjectURL(subtitleUrl)
      blobUrlsRef.current = blobUrlsRef.current.filter(u => u !== subtitleUrl)
    }
    setLocalFileUrl(null)
    setSubtitleUrl(null)
    setLocalTextContent(null)
    setLocalError(null)

    const item = course.videos.find(v => v.id === activeItemId)
    if (!item) return

    loadLocalFile(item)
    // Deps are deliberately narrow. `course` (full object), localFileUrl and
    // subtitleUrl change on every position save / URL swap; depending on them
    // would revoke the blob and remount the <video> mid-playback. course?.type
    // is the only course field that should re-trigger a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItemId, folderHandle, course?.type])

  async function loadLocalFile(item) {
    try {
      const found = await findFileInFolder(folderHandle, item.fullName, course.sections, item.id)
      if (!found) { setLocalError(`File not found: ${item.fullName}`); return }
      const { file: fileHandle, dir } = found

      // text → raw source in a <pre>; html → source text used as iframe srcDoc.
      // Resolve by filename fallback so older imports (stored as "other") work.
      const type = resolveFileType(item)
      if (type === 'text' || type === 'html') {
        const text = await getFileText(fileHandle)
        setLocalTextContent(text)
      } else {
        const url = await getFileUrl(fileHandle)
        // FIX: Register every blob URL so it is revoked on unmount
        blobUrlsRef.current.push(url)
        setLocalFileUrl(url)
        // Attach the matching subtitle (found at import) as captions. Captions
        // are optional — a failure here must never block video playback.
        if (type === 'video' && item.subtitle && dir) {
          try {
            const subUrl = await getSubtitleUrl(dir, item.subtitle)
            blobUrlsRef.current.push(subUrl)
            setSubtitleUrl(subUrl)
          } catch (_) { /* no captions — ignore */ }
        }
      }
    } catch (e) {
      setLocalError(`Could not open file: ${e.message}`)
    }
  }

  // Resolve a file to { file: FileSystemFileHandle, dir: FileSystemDirectoryHandle }.
  // The dir is returned so sidecars (e.g. subtitles) can be read from the same folder.
  async function findFileInFolder(rootHandle, fileName, sections, itemId) {
    const tryDir = async (dir) => {
      try { return { file: await dir.getFileHandle(fileName), dir } } catch (_) { return null }
    }
    // First try the specific section derived from the item id.
    // Item IDs are structured as: dirName__fileName__timestamp__random
    // so we can extract the section folder from the id prefix.
    if (itemId) {
      const sectionName = itemId.split('__')[0]
      if (sectionName && sectionName !== rootHandle.name) {
        try {
          const subDir = await rootHandle.getDirectoryHandle(sectionName)
          const r = await tryDir(subDir); if (r) return r
        } catch (_) { }
      }
    }
    // Fallback: try root
    const rootResult = await tryDir(rootHandle); if (rootResult) return rootResult
    // Fallback: search all sections
    if (sections) {
      for (const section of sections) {
        if (!section.title) continue
        try {
          const subDir = await rootHandle.getDirectoryHandle(section.title)
          const r = await tryDir(subDir); if (r) return r
        } catch (_) { }
      }
    }
    return null
  }

  async function handleGrantAccess() {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'read' })
      await saveFolderHandle(courseId, dirHandle)
      setFolderHandle(dirHandle)
      setNeedsPermission(false)
      // FIX: Clear any stale mid-session error when user re-grants access
      setLocalError(null)
    } catch (e) {
      if (e.name !== 'AbortError') setLocalError('Could not open folder.')
    }
  }

  // These handlers only update context (via markVideoWatched / setLastWatched).
  // The local `course` mirror is refreshed by the sync effect above, which runs
  // whenever context's `getCourse` identity changes. We must NOT re-read
  // getCourse(courseId) here: this closure captured the pre-update getCourse, so
  // it would read stale data and clobber the change (making the button need a
  // second click to appear to work).
  async function handleItemSelect(itemId) {
    setActiveItemId(itemId)
    await setLastWatched(courseId, itemId)
  }

  async function handleToggleWatched(itemId, e) {
    e?.stopPropagation()
    const isWatched = course.progress?.watchedVideos?.includes(itemId)
    await markVideoWatched(courseId, itemId, !isWatched)
  }

  async function handleMarkAndNext(itemId) {
    const isWatched = course.progress?.watchedVideos?.includes(itemId)
    if (!isWatched) await markVideoWatched(courseId, itemId, true)
    const allItems = course.videos || []
    const idx = allItems.findIndex(v => v.id === itemId)
    const next = allItems[idx + 1]
    if (next) handleItemSelect(next.id)
  }

  // The videoId is captured in the closure, so a debounced save still targets
  // the right video even if the user switches videos before it fires.
  // Create a new note for a video. Returns true on success.
  async function handleAddNote(videoId, body) {
    try {
      const created = await createNote(courseId, videoId, body)
      setAllNotes(prev => [...prev, {
        id: created.id, video_id: videoId, body,
        created_at: created.created_at, updated_at: created.updated_at,
      }])
      return true
    } catch (e) {
      console.error('Failed to create note:', e)
      return false
    }
  }

  // Update note body in local state (the actual debounced save to the server is
  // owned by the NoteCard). Keeps indicators/counts/previews live as you type.
  function handleUpdateNote(id, body) {
    setAllNotes(prev => prev.map(n =>
      n.id === id ? { ...n, body, updated_at: new Date().toISOString() } : n
    ))
  }

  async function handleRemoveNote(id) {
    setAllNotes(prev => prev.filter(n => n.id !== id)) // optimistic
    try { await deleteNote(id) }
    catch (e) { console.error('Failed to delete note:', e) }
  }

  if (!course) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '2px solid var(--border)', borderTop: '2px solid var(--accent)',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const allItems = course.videos || []
  const activeItem = allItems.find(v => v.id === activeItemId)
  const activeIdx = allItems.findIndex(v => v.id === activeItemId)
  const pct = course.progress?.percentage || 0
  const watched = course.progress?.watchedVideos || []
  const isLocal = course.type === 'local'

  // Ids of items that currently have at least one non-empty note (for list
  // indicators and the "All notes" overview).
  const notedIds = new Set(
    allNotes.filter(n => (n.body || '').trim()).map(n => n.video_id)
  )

  // Jump straight to a video's note from the overview list.
  function openNoteFor(itemId) {
    handleItemSelect(itemId)
    setSidebarOpen(true)
    setSidebarView('notes')
  }

  // Seconds to resume from for the active item (0 = start from the beginning).
  const startAt = Math.floor(course.progress?.positions?.[activeItemId] || 0)

  // Persist the current playback position for the active item. Passed to both
  // players; each calls it periodically while playing and on pause/leave.
  function handlePosition(seconds) {
    savePosition(courseId, activeItemId, seconds)
  }

  // Kind of the active local item, resolved from stored type + filename.
  const activeType = resolveFileType(activeItem)
  const isHtmlFile = activeType === 'html'
  const isAudio = activeType === 'audio'
  // Plain-text / code / data files: shown as raw source.
  const isTextFile = activeType === 'text'
  const isOtherFile = activeType === 'other'

  return (
    <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {saveError && (
        <div style={{
          background: 'rgba(251,191,36,0.08)', borderBottom: '1px solid rgba(251,191,36,0.25)',
          padding: '8px 20px', fontSize: 13,
          color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>⚠️ {saveError}</span>
          <button onClick={() => setSaveError(null)} style={{ background: 'transparent', border: 'none', color: 'var(--warning)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>✕</button>
        </div>
      )}
      {/* Top navbar */}
      <header style={{
        height: 56, background: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 16,
        position: 'sticky', top: 0, zIndex: 200, flexShrink: 0,
      }}>
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'transparent', border: 'none',
            color: 'var(--text-secondary)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 14, padding: '4px 8px', borderRadius: 6,
          }}
        >
          ← Back
        </button>

        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 15, flex: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          color: 'var(--text-primary)',
        }}>
          {isLocal && <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>📁</span>}
          {course.title}
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {watched.length}/{course.videoCount} · {pct}%
            </p>
            <div style={{ width: 120, height: 4, background: 'var(--border)', borderRadius: 2 }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: 'var(--accent)', borderRadius: 2,
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Your progress</span>
        </div>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 6, color: 'var(--text-secondary)',
            cursor: 'pointer', padding: '5px 10px', fontSize: 12,
          }}
        >
          {sidebarOpen ? '☰ Hide' : '☰ Show'}
        </button>
      </header>

      {/* Main layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* Content area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>

            {(() => {
              const mw = (extra) => ({ ...MEDIA_WRAPPER_BASE, height: mediaHeight(sidebarOpen), ...extra })

              return (
                <>
                  {/* Local: needs permission */}
                  {isLocal && needsPermission && (
                    <div style={mw({
                      background: 'var(--bg-card)',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40,
                    })}>
                      <div style={{ fontSize: 48 }}>📁</div>
                      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>Re-open your course folder</h2>
                      <p style={{ color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center', maxWidth: 360 }}>
                        Browser security requires you to re-select the folder once per session.
                        Your progress is saved — this is just to re-grant file access.
                      </p>
                      <button
                        onClick={handleGrantAccess}
                        style={{
                          background: 'var(--accent)', color: '#0e0f11',
                          border: 'none', borderRadius: 10, padding: '12px 28px',
                          fontWeight: 700, fontSize: 15, cursor: 'pointer',
                        }}
                      >
                        📁 Choose Folder
                      </button>
                    </div>
                  )}

                  {/* YouTube player */}
                  {!isLocal && (
                    <div style={mw()}>
                      {activeItemId && !embedBlocked && (
                        <YouTubePlayer
                          key={activeItemId}
                          videoId={activeItemId}
                          startAt={startAt}
                          onProgress={handlePosition}
                          onBlocked={() => setEmbedBlocked(true)}
                        />
                      )}

                      {activeItemId && embedBlocked && (
                        <div style={{
                          ...MEDIA_INNER,
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          gap: 16, padding: 32, background: '#0e0f11',
                        }}>
                          {activeItem?.thumbnail && (
                            <div style={{ position: 'relative', marginBottom: 8 }}>
                              <img
                                src={activeItem.thumbnail}
                                alt={activeItem.title}
                                style={{ width: 280, borderRadius: 10, opacity: 0.5 }}
                              />
                              <div style={{
                                position: 'absolute', inset: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <div style={{
                                  width: 56, height: 56, borderRadius: '50%',
                                  background: 'rgba(255,255,255,0.15)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 22,
                                }}>🔒</div>
                              </div>
                            </div>
                          )}
                          <p style={{ color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center', maxWidth: 340, lineHeight: 1.6 }}>
                            The owner of this video has disabled embedding on external sites.
                            You can still watch it directly on YouTube.
                          </p>
                          <a
                            href={`https://www.youtube.com/watch?v=${activeItemId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 8,
                              background: '#ff0000', color: '#fff',
                              borderRadius: 8, padding: '11px 24px',
                              fontWeight: 600, fontSize: 14,
                              textDecoration: 'none',
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z" />
                            </svg>
                            Watch on YouTube
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Local: video */}
                  {isLocal && !needsPermission && activeType === 'video' && (
                    <div style={mw()}>
                      {localFileUrl ? (
                        <LocalVideoPlayer
                          key={localFileUrl}
                          src={localFileUrl}
                          subtitleSrc={subtitleUrl}
                          startAt={startAt}
                          onProgress={handlePosition}
                        />
                      ) : !localError && (
                        <div style={{ ...MEDIA_INNER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--border)', borderTop: '2px solid var(--accent)', animation: 'spin 0.8s linear infinite' }} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Local: image */}
                  {isLocal && !needsPermission && activeType === 'image' && (
                    <div style={mw()}>
                      {localFileUrl && (
                        <img src={localFileUrl} alt={activeItem.name} style={{ ...MEDIA_INNER, objectFit: 'contain' }} />
                      )}
                    </div>
                  )}

                  {/* Local: audio */}
                  {isLocal && !needsPermission && isAudio && (
                    <div style={mw({ background: 'var(--bg-card)' })}>
                      <div style={{ ...MEDIA_INNER, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 }}>
                        <div style={{ fontSize: 64 }}>🎵</div>
                        <p style={{ fontSize: 16, color: 'var(--text-primary)', textAlign: 'center', wordBreak: 'break-word' }}>{activeItem.name}</p>
                        {localFileUrl && (
                          <audio src={localFileUrl} controls autoPlay style={{ width: '100%', maxWidth: 480 }} />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Local: PDF */}
                  {isLocal && !needsPermission && activeType === 'pdf' && (
                    <div style={mw()}>
                      {/* Chrome blocks PDFs inside *any* sandboxed iframe
                          ("This page has been blocked by Chrome"), so we don't
                          sandbox here. It's safe: the file is the user's own local
                          PDF from a same-origin blob: URL, and Chrome's PDF viewer
                          already isolates any script embedded in the PDF itself. */}
                      {localFileUrl && (
                        <iframe src={localFileUrl} style={MEDIA_INNER} title={activeItem.name} />
                      )}
                    </div>
                  )}

                  {/* Local: text / code / data — raw source view */}
                  {isLocal && !needsPermission && isTextFile && (
                    <div style={mw({ background: 'var(--bg-card)' })}>
                      <div style={{ ...MEDIA_INNER, overflowY: 'auto', padding: 24 }}>
                        <pre style={{
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          fontSize: 14, lineHeight: 1.7,
                          color: 'var(--text-primary)',
                          fontFamily: 'monospace', margin: 0,
                        }}>
                          {localTextContent || 'Loading...'}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Local: HTML — rendered (not raw source) so the file actually
                      "opens". It runs in a sandboxed iframe via srcDoc, which gives
                      the page a unique opaque origin: its scripts can run for the
                      page itself but CANNOT reach the app's cookies, storage, or
                      make same-origin API calls. srcDoc avoids needing a
                      same-origin blob: URL (which a sandbox would block). */}
                  {isLocal && !needsPermission && isHtmlFile && (
                    <div style={mw({ background: '#fff' })}>
                      {localTextContent != null ? (
                        <iframe
                          srcDoc={localTextContent}
                          style={MEDIA_INNER}
                          title={activeItem?.name || 'HTML'}
                          sandbox="allow-scripts"
                        />
                      ) : (
                        <div style={{ ...MEDIA_INNER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--border)', borderTop: '2px solid var(--accent)', animation: 'spin 0.8s linear infinite' }} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Local: other file type (xlsx, pptx, docx, zip, …). Browsers
                      can't render these inline, and uploading them to a web viewer
                      would send the user's local files off-device. Instead we hand
                      the file to the OS via Open (new tab) / Download so the native
                      app (Excel, PowerPoint, …) can open it. */}
                  {isLocal && !needsPermission && isOtherFile && (
                    <div style={mw({ background: 'var(--bg-card)' })}>
                      <div style={{ ...MEDIA_INNER, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center' }}>
                        <div style={{ fontSize: 56 }}>{getFileIcon(activeType)}</div>
                        <p style={{ fontSize: 16, color: 'var(--text-primary)', wordBreak: 'break-word', maxWidth: 480 }}>{activeItem.fullName}</p>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 420 }}>
                          This file type opens in its own app. Download it or open it in a new tab.
                        </p>
                        {localFileUrl ? (
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                            <a
                              href={localFileUrl}
                              download={activeItem.fullName}
                              style={{
                                background: 'var(--accent)', color: '#0e0f11',
                                border: 'none', borderRadius: 8, padding: '10px 22px',
                                fontWeight: 600, fontSize: 14, textDecoration: 'none',
                              }}
                            >
                              ⬇ Download
                            </a>
                            <a
                              href={localFileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                background: 'transparent', color: 'var(--text-secondary)',
                                border: '1px solid var(--border)', borderRadius: 8, padding: '10px 22px',
                                fontWeight: 600, fontSize: 14, textDecoration: 'none',
                              }}
                            >
                              ↗ Open in new tab
                            </a>
                          </div>
                        ) : (
                          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--border)', borderTop: '2px solid var(--accent)', animation: 'spin 0.8s linear infinite' }} />
                        )}
                      </div>
                    </div>
                  )}
                </>
              )
            })()}

            {/* Local: file error with re-select option */}
            {isLocal && localError && (
              <div style={{ padding: 24 }}>
                <div style={{
                  background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
                  borderRadius: 8, padding: '12px 16px', color: 'var(--danger)', fontSize: 13,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                }}>
                  <span>⚠️ {localError}</span>
                  {/* FIX: Show re-select button whenever there's a file error (not just
                      on initial mount) so users can recover from mid-session permission
                      revocation or folder moves without needing to reload. */}
                  <button
                    onClick={handleGrantAccess}
                    style={{
                      background: 'var(--danger)', color: '#fff',
                      border: 'none', borderRadius: 6,
                      padding: '6px 14px', fontSize: 12,
                      cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    Re-select folder
                  </button>
                </div>
              </div>
            )}

            {/* Controls bar */}
            {(!isLocal || !needsPermission) && (
              <div style={{
                background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
                padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                flexShrink: 0,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {isLocal
                      ? <>{getFileIcon(activeType)} {activeItem?.name}</>
                      : <>{activeIdx + 1}. {activeItem?.title}</>
                    }
                  </h2>
                  {!isLocal && activeItem?.duration && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{activeItem.duration}</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {activeIdx > 0 && (
                    <button onClick={() => handleItemSelect(allItems[activeIdx - 1].id)} style={navBtn}>← Prev</button>
                  )}
                  <button
                    onClick={() => handleToggleWatched(activeItemId)}
                    style={{
                      ...navBtn,
                      background: watched.includes(activeItemId) ? 'var(--accent-dim)' : 'transparent',
                      color: watched.includes(activeItemId) ? 'var(--accent)' : 'var(--text-secondary)',
                      borderColor: watched.includes(activeItemId) ? 'var(--accent)' : 'var(--border)',
                    }}
                  >
                    {watched.includes(activeItemId) ? '✓ Done' : 'Mark done'}
                  </button>
                  {activeIdx < allItems.length - 1 && (
                    <button
                      onClick={() => handleMarkAndNext(activeItemId)}
                      style={{ ...navBtn, background: 'var(--accent)', color: '#0e0f11', border: 'none', fontWeight: 600 }}
                    >
                      Next →
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* YouTube description */}
            {!isLocal && activeItem?.description && (
              <div style={{ padding: '0 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <button
                  onClick={() => setDescOpen(!descOpen)}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--text-secondary)', fontSize: 13,
                    padding: '10px 0', display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {descOpen ? '▾' : '▸'} Description
                </button>
                {descOpen && (
                  <div style={{ paddingBottom: 16, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {activeItem.description.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
                      /^https:\/\//.test(part)
                        ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{part}</a>
                        : part
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tabs */}
            <div style={{ borderBottom: '1px solid var(--border)', padding: '0 24px', display: 'flex', gap: 0, flexShrink: 0 }}>
              {['content', 'overview'].map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    background: 'transparent', border: 'none',
                    borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                    color: tab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
                    padding: '12px 16px', cursor: 'pointer',
                    fontSize: 14, fontWeight: tab === t ? 600 : 400,
                    textTransform: 'capitalize',
                  }}
                >
                  {t === 'content' ? 'Course content' : 'Overview'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ padding: 24 }}>
              {tab === 'overview' && (
                <div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 12 }}>{course.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
                    {isLocal ? '📁 Local Course' : `by ${course.channelTitle}`}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
                    <InfoTile label="Total Items" value={course.videoCount} />
                    <InfoTile label="Done" value={watched.length} />
                    <InfoTile label="Remaining" value={course.videoCount - watched.length} />
                    <InfoTile label="Progress" value={`${pct}%`} accent />
                  </div>
                  <div className="progress-bar" style={{ height: 8, borderRadius: 4 }}>
                    <div className="progress-bar-fill" style={{ width: `${pct}%`, borderRadius: 4 }} />
                  </div>

                  {/* All notes for this course */}
                  {(() => {
                    const visibleNotes = allNotes.filter(n => (n.body || '').trim())
                    return (
                      <div style={{ marginTop: 28 }}>
                        <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 16, marginBottom: 12 }}>
                          Your notes{' '}
                          <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 13 }}>
                            ({visibleNotes.length})
                          </span>
                        </h4>
                        {visibleNotes.length === 0 ? (
                          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                            No notes yet. Open a video and use the Notes tab in the sidebar to add one.
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {visibleNotes.map(n => {
                              const it = allItems.find(i => i.id === n.video_id)
                              return (
                                <button
                                  key={n.id}
                                  onClick={() => openNoteFor(n.video_id)}
                                  style={{
                                    textAlign: 'left', width: '100%',
                                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                                    borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                      {it ? (it.name || it.title) : 'Note'}
                                    </span>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                                      {formatNoteTime(n.updated_at)}
                                    </span>
                                  </div>
                                  <p style={{
                                    fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5,
                                    whiteSpace: 'pre-wrap',
                                    display: '-webkit-box', WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                  }}>
                                    {n.body}
                                  </p>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}
              {tab === 'content' && (
                <div style={{ display: sidebarOpen ? 'none' : 'block' }}>
                  <ItemList
                    course={course}
                    activeItemId={activeItemId}
                    watched={watched}
                    notedIds={notedIds}
                    onSelect={handleItemSelect}
                    onToggle={handleToggleWatched}
                  />
                </div>
              )}
              {tab === 'content' && sidebarOpen && (
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                  Course content is shown in the sidebar →
                </p>
              )}
            </div>

          </div>
        </div>

        {/* Sidebar */}
        {sidebarOpen && (
          <aside style={{
            width: 360, flexShrink: 0,
            background: 'var(--bg-sidebar)',
            borderLeft: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', height: '100%',
          }}>
            <div style={{
              padding: '10px 12px', borderBottom: '1px solid var(--border)',
              display: 'flex', gap: 6, alignItems: 'center',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                <button onClick={() => setSidebarView('content')} style={sidebarTab(sidebarView === 'content')}>
                  Content
                </button>
                <button onClick={() => setSidebarView('notes')} style={sidebarTab(sidebarView === 'notes')}>
                  Notes
                </button>
              </div>
              {sidebarView === 'content' && (
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {watched.length}/{course.videoCount}
                </span>
              )}
            </div>

            {sidebarView === 'content' ? (
              <div style={{ overflowY: 'auto', flex: 1 }}>
                <ItemList
                  course={course}
                  activeItemId={activeItemId}
                  watched={watched}
                  notedIds={notedIds}
                  onSelect={handleItemSelect}
                  onToggle={handleToggleWatched}
                />
              </div>
            ) : (
              <NotesPanel
                activeItem={activeItem}
                activeItemId={activeItemId}
                isLocal={isLocal}
                allItems={allItems}
                allNotes={allNotes}
                onAdd={handleAddNote}
                onUpdate={handleUpdateNote}
                onDelete={handleRemoveNote}
              />
            )}
          </aside>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Item list ─────────────────────────────────────────────────────────────────
function ItemList({ course, activeItemId, watched, notedIds, onSelect, onToggle }) {
  const isLocal = course.type === 'local'

  if (isLocal && course.sections?.length) {
    return (
      <div>
        {course.sections.map((section, sIdx) => {
          // Hide subtitle sidecars from already-imported courses too (newer
          // imports already exclude them at scan time).
          const items = section.items.filter(i => !isSubtitleFile(i.fullName || ''))
          if (items.length === 0) return null
          return (
          <div key={sIdx}>
            {section.title && (
              <div style={{
                padding: '10px 14px 6px',
                fontSize: 11, fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg)',
              }}>
                📁 {section.title}
              </div>
            )}
            {items.map((item, idx) => (
              <ItemRow
                key={item.id}
                item={item}
                idx={idx}
                isActive={item.id === activeItemId}
                isWatched={watched.includes(item.id)}
                hasNote={notedIds?.has(item.id)}
                isLocal={true}
                onSelect={onSelect}
                onToggle={onToggle}
              />
            ))}
          </div>
          )
        })}
      </div>
    )
  }

  return (
    <div>
      {(course.videos || []).map((video, idx) => (
        <ItemRow
          key={video.id}
          item={video}
          idx={idx}
          isActive={video.id === activeItemId}
          isWatched={watched.includes(video.id)}
          hasNote={notedIds?.has(video.id)}
          isLocal={false}
          onSelect={onSelect}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}

function ItemRow({ item, idx, isActive, isWatched, hasNote, isLocal, onSelect, onToggle }) {
  return (
    <div
      onClick={() => onSelect(item.id)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '12px 14px', cursor: 'pointer',
        background: isActive ? 'rgba(74,222,128,0.06)' : 'transparent',
        borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
    >
      <div
        className={`video-check ${isWatched ? 'checked' : ''}`}
        onClick={e => onToggle(item.id, e)}
        style={{ marginTop: 2, flexShrink: 0 }}
      >
        {isWatched && (
          <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
            <path d="M1 4L4 7.5L10 1" stroke="#0e0f11" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {!isLocal ? (
        <div style={{ width: 80, height: 46, flexShrink: 0, background: '#111', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
          {item.thumbnail && <img src={item.thumbnail} alt={item.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          {isActive && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(74,222,128,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 8, color: '#0e0f11', marginLeft: 2 }}>▶</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{
          width: 36, height: 36, flexShrink: 0, borderRadius: 6,
          background: isActive ? 'rgba(74,222,128,0.15)' : 'var(--bg)',
          border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
        }}>
          {getFileIcon(resolveFileType(item))}
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 13, lineHeight: 1.4,
          color: isActive ? 'var(--accent)' : isWatched ? 'var(--text-secondary)' : 'var(--text-primary)',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {!isLocal && `${idx + 1}. `}{item.name || item.title}
        </p>
        {!isLocal && item.duration && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>▶ {item.duration}</p>
        )}
        {isLocal && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{item.fileType}</p>
        )}
        {hasNote && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11, color: 'var(--accent)', marginTop: 4,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }} />
            Note
          </span>
        )}
      </div>
    </div>
  )
}

// ── Notes panel (sidebar) ───────────────────────────────────────────────────
function formatNoteTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ` +
    `${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

function NotesPanel({
  activeItem, activeItemId, isLocal, allItems, allNotes, onAdd, onUpdate, onDelete,
}) {
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const title = isLocal ? activeItem?.name : activeItem?.title
  const allVisible = allNotes.filter(n => (n.body || '').trim())
  const titleOf = (vid) => {
    const it = (allItems || []).find(i => i.id === vid)
    return it ? (isLocal ? it.name : it.title) : 'Note'
  }

  async function submitDraft() {
    if (!draft.trim() || !activeItemId || adding) return
    setAdding(true)
    const ok = await onAdd(activeItemId, draft)
    setAdding(false)
    if (ok) setDraft('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto' }}>
      {/* All notes in this course (collapsible) */}
      <div style={{ flexShrink: 0 }}>
        <button
          onClick={() => setShowAll(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 13, padding: '12px 16px',
            position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'var(--bg-sidebar)',
          }}
        >
          <span>All notes in this course{' '}
            <span style={{ color: 'var(--text-muted)' }}>({allVisible.length})</span>
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{showAll ? '▾' : '▸'}</span>
        </button>
        {showAll && (
          allVisible.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 12, padding: '0 16px 12px' }}>
              No notes yet. Add one below.
            </p>
          ) : (
            <div style={{ padding: '0 12px 12px' }}>
              {allVisible.map(n => (
                <NoteItem
                  key={n.id}
                  note={n}
                  title={titleOf(n.video_id)}
                  isActive={n.video_id === activeItemId}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Composer for the active video */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        {activeItemId ? (
          <>
            <p style={{
              fontSize: 11, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
            }}>
              New note for
            </p>
            <p style={{
              fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {title || 'this video'}
            </p>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submitDraft() }}
              placeholder="Write a new note…"
              rows={3}
              style={{
                width: '100%', resize: 'vertical', minHeight: 60,
                background: 'var(--bg)', color: 'var(--text-primary)',
                border: '1px solid var(--border)', borderRadius: 8,
                padding: 10, fontSize: 14, lineHeight: 1.6,
                fontFamily: 'inherit', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
              <button
                onClick={submitDraft}
                disabled={!draft.trim() || adding}
                style={{
                  background: draft.trim() ? 'var(--accent)' : 'var(--border)',
                  color: draft.trim() ? '#0e0f11' : 'var(--text-muted)',
                  border: 'none', borderRadius: 7, padding: '7px 14px',
                  fontSize: 13, fontWeight: 600,
                  cursor: draft.trim() && !adding ? 'pointer' : 'default',
                }}
              >
                {adding ? 'Adding…' : '+ Add note'}
              </button>
            </div>
          </>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Select a video to take notes.</p>
        )}
      </div>
    </div>
  )
}

// A note in the "all notes" list: collapsed to title + time; click to expand
// the body, where Edit (autosaving textarea) and Delete live.
function NoteItem({ note, title, isActive, onUpdate, onDelete }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState('idle') // idle | saving | saved | error
  const [confirmDel, setConfirmDel] = useState(false)
  const timer = useRef(null)
  const pending = useRef(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
      if (pending.current != null) updateNote(note.id, pending.current).catch(() => {})
    }
  }, [note.id])

  function change(value) {
    onUpdate(note.id, value) // lift to parent so previews/counts stay live
    setStatus('saving')
    pending.current = value
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      pending.current = null
      updateNote(note.id, value).then(() => setStatus('saved')).catch(() => setStatus('error'))
    }, 800)
  }

  function flush() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    if (pending.current == null) return
    const v = pending.current
    pending.current = null
    setStatus('saving')
    updateNote(note.id, v).then(() => setStatus('saved')).catch(() => setStatus('error'))
  }

  const meta = status === 'saving' ? 'Saving…'
    : status === 'saved' ? 'Saved ✓'
    : status === 'error' ? 'Could not save'
    : formatNoteTime(note.updated_at)

  return (
    <div style={{
      marginBottom: 6, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
      background: isActive ? 'var(--accent-dim)' : 'transparent',
    }}>
      <button
        onClick={() => setOpen(o => { if (o) setEditing(false); return !o })}
        style={{
          display: 'block', textAlign: 'left', width: '100%',
          background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px 10px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: isActive ? 'var(--accent)' : 'var(--text-primary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {title}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
            {open ? '▾' : '▸'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 2 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatNoteTime(note.updated_at)}</span>
        </div>
        {!open && (
          <p style={{
            margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {note.body}
          </p>
        )}
      </button>

      {open && (
        <div style={{ padding: '0 10px 10px' }}>
          {editing ? (
            <textarea
              value={note.body}
              autoFocus
              onChange={e => change(e.target.value)}
              onBlur={flush}
              placeholder="Write a note…"
              rows={3}
              style={{
                width: '100%', resize: 'vertical', minHeight: 60,
                background: 'var(--bg)', color: 'var(--text-primary)',
                border: '1px solid var(--border)', borderRadius: 6,
                padding: 10, fontSize: 14, lineHeight: 1.6,
                fontFamily: 'inherit', outline: 'none',
              }}
            />
          ) : (
            <p style={{
              margin: 0, fontSize: 13, lineHeight: 1.6,
              color: note.body ? 'var(--text-primary)' : 'var(--text-muted)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {note.body || 'Empty note'}
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 11, color: status === 'error' ? 'var(--danger)' : 'var(--text-muted)' }}>
              {meta}
            </span>
            <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {editing ? (
                <button onClick={() => { flush(); setEditing(false) }} style={{ ...noteLinkBtn, color: 'var(--accent)' }}>
                  Done
                </button>
              ) : (
                <button onClick={() => setEditing(true)} style={noteLinkBtn}>Edit</button>
              )}
              {!confirmDel ? (
                <button onClick={() => setConfirmDel(true)} style={noteLinkBtn}>Delete</button>
              ) : (
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={() => onDelete(note.id)} style={{ ...noteLinkBtn, color: 'var(--danger)' }}>
                    Confirm
                  </button>
                  <button onClick={() => setConfirmDel(false)} style={noteLinkBtn}>Cancel</button>
                </span>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

const noteLinkBtn = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: 'var(--text-muted)', fontSize: 12, padding: 0,
}

function InfoTile({ label, value, accent }) {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
      <p style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-display)', color: accent ? 'var(--accent)' : 'var(--text-primary)' }}>{value}</p>
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</p>
    </div>
  )
}

const navBtn = {
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border)', borderRadius: 7,
  padding: '7px 14px', cursor: 'pointer', fontSize: 13,
  transition: 'all 0.15s',
}

const sidebarTab = (active) => ({
  flex: 1,
  background: active ? 'var(--accent-dim)' : 'transparent',
  color: active ? 'var(--accent)' : 'var(--text-secondary)',
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
  borderRadius: 7, padding: '7px 10px',
  cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400,
  transition: 'all 0.15s',
})

export default function CoursePage({ params }) {
  const { id } = use(params)
  return <CoursePlayer courseId={id} />
}
