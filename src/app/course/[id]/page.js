'use client'
import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { AppProvider, useApp } from '@/lib/context'

function CoursePlayer({ courseId }) {
  const router = useRouter()
  const { getCourse, markVideoWatched, setLastWatched, isLoading, courses } = useApp()
  const [course, setCourse] = useState(null)
  const [activeVideoId, setActiveVideoId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [tab, setTab] = useState('content') // content | overview
  const playerRef = useRef(null)

  useEffect(() => {
    if (!isLoading) {
      const c = getCourse(courseId)
      if (!c) { router.push('/'); return }
      setCourse(c)
      // Resume last watched or start from first unwatched
      const lastWatched = c.progress?.lastWatched
      if (lastWatched && c.videos.find(v => v.id === lastWatched)) {
        setActiveVideoId(lastWatched)
      } else {
        const firstUnwatched = c.videos.find(v => !c.progress?.watchedVideos?.includes(v.id))
        setActiveVideoId(firstUnwatched?.id || c.videos[0]?.id)
      }
    }
  }, [isLoading, courseId])

  // Refresh course data when it changes
  useEffect(() => {
    if (!isLoading) {
      const c = getCourse(courseId)
      if (c) setCourse(c)
    }
  }, [isLoading])

  async function handleVideoSelect(videoId) {
    setActiveVideoId(videoId)
    await setLastWatched(courseId, videoId)
    // Refresh
    const c = getCourse(courseId)
    if (c) setCourse(c)
  }

  async function handleToggleWatched(videoId, e) {
    e?.stopPropagation()
    const isWatched = course.progress?.watchedVideos?.includes(videoId)
    await markVideoWatched(courseId, videoId, !isWatched)
    const c = getCourse(courseId)
    if (c) setCourse(c)
  }

  async function handleMarkAndNext(videoId) {
    const isWatched = course.progress?.watchedVideos?.includes(videoId)
    if (!isWatched) {
      await markVideoWatched(courseId, videoId, true)
    }
    // Go to next
    const idx = course.videos.findIndex(v => v.id === videoId)
    const next = course.videos[idx + 1]
    if (next) handleVideoSelect(next.id)
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

  const activeVideo = course.videos.find(v => v.id === activeVideoId)
  const pct = course.progress?.percentage || 0
  const watched = course.progress?.watchedVideos || []
  const activeIdx = course.videos.findIndex(v => v.id === activeVideoId)

  const embedUrl = activeVideoId
    ? `https://www.youtube.com/embed/${activeVideoId}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&color=white`
    : ''

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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
          {course.title}
        </h1>

        {/* Progress */}
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

        {/* Toggle sidebar */}
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
        {/* Video area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto' }}>
          {/* Video player */}
          <div style={{
            background: '#000',
            position: 'relative',
            width: '100%',
            paddingTop: sidebarOpen ? '52%' : '56.25%',
          }}>
            {embedUrl && (
              <iframe
                ref={playerRef}
                key={activeVideoId}
                src={embedUrl}
                style={{
                  position: 'absolute', top: 0, left: 0,
                  width: '100%', height: '100%',
                  border: 'none',
                }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>

          {/* Video controls bar */}
          <div style={{
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border)',
            padding: '12px 24px',
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{
                fontSize: 16, fontWeight: 600,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {activeIdx + 1}. {activeVideo?.title}
              </h2>
              {activeVideo?.duration && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {activeVideo.duration}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {activeIdx > 0 && (
                <button
                  onClick={() => handleVideoSelect(course.videos[activeIdx - 1].id)}
                  style={navBtn}
                >
                  ← Prev
                </button>
              )}
              <button
                onClick={() => handleToggleWatched(activeVideoId)}
                style={{
                  ...navBtn,
                  background: watched.includes(activeVideoId) ? 'var(--accent-dim)' : 'transparent',
                  color: watched.includes(activeVideoId) ? 'var(--accent)' : 'var(--text-secondary)',
                  borderColor: watched.includes(activeVideoId) ? 'var(--accent)' : 'var(--border)',
                }}
              >
                {watched.includes(activeVideoId) ? '✓ Watched' : 'Mark watched'}
              </button>
              {activeIdx < course.videos.length - 1 && (
                <button
                  onClick={() => handleMarkAndNext(activeVideoId)}
                  style={{ ...navBtn, background: 'var(--accent)', color: '#0e0f11', border: 'none', fontWeight: 600 }}
                >
                  Next →
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ borderBottom: '1px solid var(--border)', padding: '0 24px', display: 'flex', gap: 0 }}>
            {['content', 'overview'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                  color: tab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  fontSize: 14, fontWeight: tab === t ? 600 : 400,
                  textTransform: 'capitalize',
                }}
              >
                {t === 'content' ? 'Course content' : 'Overview'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ padding: 24, flex: 1 }}>
            {tab === 'overview' && (
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 12 }}>
                  {course.title}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
                  by {course.channelTitle}
                </p>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 12, marginBottom: 20,
                }}>
                  <InfoTile label="Total Videos" value={course.videoCount} />
                  <InfoTile label="Watched" value={watched.length} />
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
                <VideoList
                  videos={course.videos}
                  activeVideoId={activeVideoId}
                  watched={watched}
                  onSelect={handleVideoSelect}
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

        {/* Sidebar */}
        {sidebarOpen && (
          <aside style={{
            width: 360, flexShrink: 0,
            background: 'var(--bg-sidebar)',
            borderLeft: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border)',
              fontWeight: 600, fontSize: 14,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>Course content</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 400 }}>
                {watched.length}/{course.videoCount}
              </span>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <VideoList
                videos={course.videos}
                activeVideoId={activeVideoId}
                watched={watched}
                onSelect={handleVideoSelect}
                onToggle={handleToggleWatched}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

function VideoList({ videos, activeVideoId, watched, onSelect, onToggle }) {
  return (
    <div>
      {videos.map((video, idx) => {
        const isActive = video.id === activeVideoId
        const isWatched = watched.includes(video.id)
        return (
          <div
            key={video.id}
            onClick={() => onSelect(video.id)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '12px 14px',
              cursor: 'pointer',
              background: isActive ? 'rgba(74,222,128,0.06)' : 'transparent',
              borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
          >
            {/* Checkbox */}
            <div
              className={`video-check ${isWatched ? 'checked' : ''}`}
              onClick={e => onToggle(video.id, e)}
              style={{ marginTop: 2 }}
            >
              {isWatched && (
                <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                  <path d="M1 4L4 7.5L10 1" stroke="#0e0f11" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>

            {/* Thumbnail */}
            <div style={{
              width: 80, height: 46, flexShrink: 0,
              background: '#111', borderRadius: 4, overflow: 'hidden',
              position: 'relative',
            }}>
              {video.thumbnail && (
                <img src={video.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
              {isActive && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(74,222,128,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 8, color: '#0e0f11', marginLeft: 2 }}>▶</span>
                  </div>
                </div>
              )}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 13, lineHeight: 1.4,
                color: isActive ? 'var(--accent)' : isWatched ? 'var(--text-secondary)' : 'var(--text-primary)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {idx + 1}. {video.title}
              </p>
              {video.duration && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                  ▶ {video.duration}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function InfoTile({ label, value, accent }) {
  return (
    <div style={{
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '12px 16px', textAlign: 'center',
    }}>
      <p style={{
        fontSize: 24, fontWeight: 700,
        fontFamily: 'var(--font-display)',
        color: accent ? 'var(--accent)' : 'var(--text-primary)',
      }}>{value}</p>
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</p>
    </div>
  )
}

const navBtn = {
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 7, padding: '7px 14px',
  cursor: 'pointer', fontSize: 13,
  transition: 'all 0.15s',
}

export default function CoursePage({ params }) {
  const { id } = use(params)
  return (
    <AppProvider>
      <CoursePlayer courseId={id} />
    </AppProvider>
  )
}
