'use client'
import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { requestFolderAccess, saveFolderHandle, getFileUrl, getFileText, getFileIcon } from '@/lib/localCourse'

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

function CoursePlayer({ courseId }) {
  const router = useRouter()
  const { getCourse, markVideoWatched, setLastWatched, isLoading, saveError, setSaveError } = useApp()
  const [course, setCourse] = useState(null)
  const [activeItemId, setActiveItemId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [tab, setTab] = useState('content')
  const [descOpen, setDescOpen] = useState(false)
  const [embedBlocked, setEmbedBlocked] = useState(false)

  // Local course state
  const [folderHandle, setFolderHandle] = useState(null)
  const [localFileUrl, setLocalFileUrl] = useState(null)
  const [localTextContent, setLocalTextContent] = useState(null)
  const [localError, setLocalError] = useState(null)
  const [needsPermission, setNeedsPermission] = useState(false)

  const playerRef = useRef(null)
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

      if (c.type === 'local') {
        requestFolderAccess(courseId).then(handle => {
          if (handle) setFolderHandle(handle)
          else setNeedsPermission(true)
        })
      }
    }
  }, [isLoading, courseId, getCourse])

  useEffect(() => {
    if (!isLoading) {
      const c = getCourse(courseId)
      if (c) setCourse(c)
    }
  }, [isLoading, getCourse])

  useEffect(() => {
    setEmbedBlocked(false)
  }, [activeItemId])

  // ── Load local file when active item changes ────────────────────────────────
  useEffect(() => {
    if (!course || course.type !== 'local' || !activeItemId || !folderHandle) return

    // Revoke previous blob URL before creating a new one
    if (localFileUrl) {
      URL.revokeObjectURL(localFileUrl)
      blobUrlsRef.current = blobUrlsRef.current.filter(u => u !== localFileUrl)
    }
    setLocalFileUrl(null)
    setLocalTextContent(null)
    setLocalError(null)

    const item = course.videos.find(v => v.id === activeItemId)
    if (!item) return

    loadLocalFile(item)
  }, [activeItemId, folderHandle, course?.type])

  async function loadLocalFile(item) {
    try {
      const fileHandle = await findFileInFolder(folderHandle, item.fullName, course.sections, item.id)
      if (!fileHandle) { setLocalError(`File not found: ${item.fullName}`); return }

      // FIX: HTML files are shown as raw source text instead of opening as
      // a blob: URL in a new tab. blob: URLs inherit the app's origin, so a
      // malicious HTML file could access localStorage, cookies, and make
      // same-origin requests. Showing raw source is safe and still useful.
      if (item.fileType === 'text' || item.fileType === 'html') {
        const text = await getFileText(fileHandle)
        setLocalTextContent(text)
      } else {
        const url = await getFileUrl(fileHandle)
        // FIX: Register every blob URL so it is revoked on unmount
        blobUrlsRef.current.push(url)
        setLocalFileUrl(url)
      }
    } catch (e) {
      setLocalError(`Could not open file: ${e.message}`)
    }
  }

  async function findFileInFolder(rootHandle, fileName, sections, itemId) {
    // First try to find in the specific section derived from the item id
    // Item IDs are structured as: dirName__fileName__timestamp__random
    // so we can extract the section folder from the id prefix
    if (itemId) {
      const sectionName = itemId.split('__')[0]
      if (sectionName && sectionName !== rootHandle.name) {
        try {
          const subDir = await rootHandle.getDirectoryHandle(sectionName)
          const handle = await subDir.getFileHandle(fileName)
          return handle
        } catch (_) { }
      }
    }
    // Fallback: try root
    try { return await rootHandle.getFileHandle(fileName) } catch (_) { }
    // Fallback: search all sections
    if (sections) {
      for (const section of sections) {
        if (!section.title) continue
        try {
          const subDir = await rootHandle.getDirectoryHandle(section.title)
          return await subDir.getFileHandle(fileName)
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

  async function handleItemSelect(itemId) {
    setActiveItemId(itemId)
    await setLastWatched(courseId, itemId)
    const c = getCourse(courseId)
    if (c) setCourse(c)
  }

  async function handleToggleWatched(itemId, e) {
    e?.stopPropagation()
    const isWatched = course.progress?.watchedVideos?.includes(itemId)
    await markVideoWatched(courseId, itemId, !isWatched)
    const c = getCourse(courseId)
    if (c) setCourse(c)
  }

  async function handleMarkAndNext(itemId) {
    const isWatched = course.progress?.watchedVideos?.includes(itemId)
    if (!isWatched) await markVideoWatched(courseId, itemId, true)
    const allItems = course.videos || []
    const idx = allItems.findIndex(v => v.id === itemId)
    const next = allItems[idx + 1]
    if (next) handleItemSelect(next.id)
    const c = getCourse(courseId)
    if (c) setCourse(c)
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

  const embedUrl = !isLocal && activeItemId
    ? `https://www.youtube.com/embed/${activeItemId}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&color=white`
    : ''

  // FIX: HTML files are now rendered as raw text (see loadLocalFile), not
  // opened as blob: URLs. isHtmlFile is kept only to show the correct icon/label.
  const isHtmlFile =
    activeItem?.fileType === 'html' ||
    (activeItem?.fileType === 'other' && /\.html?$/i.test(activeItem?.fullName || ''))

  const isOtherFile =
    activeItem?.fileType === 'other' && !/\.html?$/i.test(activeItem?.fullName || '')

  // HTML files now render the same way as text files (raw source view)
  const isTextOrHtml = activeItem?.fileType === 'text' || isHtmlFile

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
                      {embedUrl && !embedBlocked && (
                        <iframe
                          ref={playerRef}
                          key={activeItemId}
                          src={embedUrl}
                          style={MEDIA_INNER}
                          title={activeItem?.title || 'YouTube video'}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          onError={() => setEmbedBlocked(true)}
                        />
                      )}

                      {embedUrl && embedBlocked && (
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
                  {isLocal && !needsPermission && activeItem?.fileType === 'video' && (
                    <div style={mw()}>
                      {localFileUrl ? (
                        <video key={localFileUrl} src={localFileUrl} controls autoPlay style={MEDIA_INNER} />
                      ) : !localError && (
                        <div style={{ ...MEDIA_INNER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--border)', borderTop: '2px solid var(--accent)', animation: 'spin 0.8s linear infinite' }} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Local: image */}
                  {isLocal && !needsPermission && activeItem?.fileType === 'image' && (
                    <div style={mw()}>
                      {localFileUrl && (
                        <img src={localFileUrl} alt={activeItem.name} style={{ ...MEDIA_INNER, objectFit: 'contain' }} />
                      )}
                    </div>
                  )}

                  {/* Local: PDF */}
                  {isLocal && !needsPermission && activeItem?.fileType === 'pdf' && (
                    <div style={mw()}>
                      {localFileUrl && (
                        <iframe src={localFileUrl} style={MEDIA_INNER} title={activeItem.name} sandbox="allow-scripts" />
                      )}
                    </div>
                  )}

                  {/* Local: text + HTML (both rendered as raw source — safe) */}
                  {isLocal && !needsPermission && isTextOrHtml && (
                    <div style={mw({ background: 'var(--bg-card)' })}>
                      <div style={{ ...MEDIA_INNER, overflowY: 'auto', padding: 24 }}>
                        {isHtmlFile && (
                          <div style={{
                            marginBottom: 12, padding: '6px 12px',
                            background: 'rgba(251,191,36,0.08)',
                            border: '1px solid rgba(251,191,36,0.2)',
                            borderRadius: 6, fontSize: 12,
                            color: 'var(--warning)',
                          }}>
                            🌐 HTML source — shown as plain text for security
                          </div>
                        )}
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

                  {/* Local: other file type */}
                  {isLocal && !needsPermission && isOtherFile && (
                    <div style={mw({ background: 'var(--bg-card)' })}>
                      <div style={{ ...MEDIA_INNER, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: 48 }}>📎</div>
                        <p style={{ fontSize: 16 }}>{activeItem.fullName}</p>
                        <p style={{ fontSize: 13 }}>This file type cannot be previewed in the browser.</p>
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
                      ? <>{getFileIcon(activeItem?.fileType)} {activeItem?.name}</>
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
                </div>
              )}
              {tab === 'content' && (
                <div style={{ display: sidebarOpen ? 'none' : 'block' }}>
                  <ItemList
                    course={course}
                    activeItemId={activeItemId}
                    watched={watched}
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
              padding: '14px 16px', borderBottom: '1px solid var(--border)',
              fontWeight: 600, fontSize: 14,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexShrink: 0,
            }}>
              <span>Course content</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 400 }}>
                {watched.length}/{course.videoCount}
              </span>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <ItemList
                course={course}
                activeItemId={activeItemId}
                watched={watched}
                onSelect={handleItemSelect}
                onToggle={handleToggleWatched}
              />
            </div>
          </aside>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Item list ─────────────────────────────────────────────────────────────────
function ItemList({ course, activeItemId, watched, onSelect, onToggle }) {
  const isLocal = course.type === 'local'

  if (isLocal && course.sections?.length) {
    return (
      <div>
        {course.sections.map((section, sIdx) => (
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
            {section.items.map((item, idx) => (
              <ItemRow
                key={item.id}
                item={item}
                idx={idx}
                isActive={item.id === activeItemId}
                isWatched={watched.includes(item.id)}
                isLocal={true}
                onSelect={onSelect}
                onToggle={onToggle}
              />
            ))}
          </div>
        ))}
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
          isLocal={false}
          onSelect={onSelect}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}

function ItemRow({ item, idx, isActive, isWatched, isLocal, onSelect, onToggle }) {
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
          {getFileIcon(item.fileType)}
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
      </div>
    </div>
  )
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

export default function CoursePage({ params }) {
  const { id } = use(params)
  return <CoursePlayer courseId={id} />
}
