'use client'
import { useState } from 'react'
import { useApp } from '@/lib/context'
import { parseYouTubeInput, fetchPlaylistData, generateCourseId } from '@/lib/youtube'
import { addLocalCourse } from '@/lib/localCourse'

export default function AddCourseModal({ onClose }) {
  const { addCourse } = useApp()
  const [url, setUrl] = useState('')
  const [step, setStep] = useState('input') // input | fetching | error
  const [error, setError] = useState('')
  const [mode, setMode] = useState('youtube') // youtube | local

  async function handleAddYouTube() {
    if (!url.trim()) return setError('Please enter a YouTube playlist URL')

    const parsed = parseYouTubeInput(url)
    if (!parsed || parsed.type !== 'playlist') {
      return setError('Please enter a valid YouTube playlist URL (must contain a playlist, not just a single video)')
    }

    setStep('fetching')
    setError('')

    try {
      const playlist = await fetchPlaylistData(parsed.id)
      const course = {
        id: generateCourseId(),
        type: 'youtube',
        playlistId: parsed.id,
        title: playlist.title,
        channelTitle: playlist.channelTitle,
        thumbnail: playlist.thumbnail,
        videoCount: playlist.videoCount,
        videos: playlist.videos,
        addedAt: new Date().toISOString(),
        progress: {
          watchedVideos: [],
          percentage: 0,
          lastWatched: null,
        }
      }
      await addCourse(course)
      onClose()
    } catch (e) {
      setStep('input')
      setError(e.message || 'Failed to fetch playlist. Make sure the playlist is public.')
    }
  }

  async function handleAddLocal() {
    setError('')
    try {
      const course = await addLocalCourse(generateCourseId)
      if (!course) return // user cancelled picker
      setStep('fetching')
      await addCourse(course)
      onClose()
    } catch (e) {
      setStep('input')
      setError(e.message || 'Failed to read folder.')
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="fade-up"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 32,
          width: '100%',
          maxWidth: 500,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'var(--accent-dim)',
            border: '1px solid rgba(74,222,128,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>🎓</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1 }}>
            Add a Course
          </h2>
        </div>

        {/* Mode tabs */}
        <div style={{
          display: 'flex', gap: 0, marginBottom: 24,
          border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden',
        }}>
          {[
            { key: 'youtube', label: '▶  YouTube Playlist' },
            { key: 'local', label: '📁  Local Folder' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setMode(tab.key); setError('') }}
              style={{
                flex: 1, padding: '10px 0', cursor: 'pointer',
                border: 'none', fontSize: 13, fontWeight: 500,
                background: mode === tab.key ? 'var(--accent-dim)' : 'transparent',
                color: mode === tab.key ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: mode === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* YouTube mode */}
        {mode === 'youtube' && (
          <>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
              Paste any public YouTube playlist URL.
            </p>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                YouTube Playlist URL
              </span>
              <input
                value={url}
                onChange={e => { setUrl(e.target.value); setError('') }}
                placeholder="https://youtube.com/playlist?list=..."
                onKeyDown={e => e.key === 'Enter' && handleAddYouTube()}
                autoFocus
                style={{
                  width: '100%', background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  padding: '11px 14px', color: 'var(--text-primary)',
                  fontSize: 14, outline: 'none', transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </label>
            <div style={{
              background: 'var(--bg)', border: '1px solid var(--border-subtle)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 20,
            }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                💡 On YouTube, open any playlist → copy the URL from your browser address bar.
                Make sure the playlist is set to <strong style={{ color: 'var(--text-secondary)' }}>Public</strong>.
              </p>
            </div>
          </>
        )}

        {/* Local folder mode */}
        {mode === 'local' && (
          <>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
              Open a folder from your computer. Videos, PDFs, images and text files will all be shown.
              Your files never leave your machine.
            </p>
            <div style={{
              background: 'var(--bg)', border: '1px solid var(--border-subtle)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 20,
            }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                💡 Subfolders become sections. Files are sorted by name — prefix them with numbers
                (e.g. <strong style={{ color: 'var(--text-secondary)' }}>01 - Intro.mp4</strong>) to control order.
              </p>
            </div>
            <div style={{
              background: 'rgba(251,191,36,0.06)',
              border: '1px solid rgba(251,191,36,0.2)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 20,
            }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                ⚠️ Works in <strong style={{ color: 'var(--text-secondary)' }}>Chrome, Edge, and Brave</strong> only.
                Firefox and Safari are not supported.
              </p>
            </div>
          </>
        )}

        {error && (
          <div style={{
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.25)',
            borderRadius: 8, padding: '10px 14px',
            color: 'var(--danger)', fontSize: 13, marginBottom: 16,
          }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', borderRadius: 8,
              padding: '10px 20px', cursor: 'pointer', fontSize: 14,
            }}
          >
            Cancel
          </button>

          {mode === 'youtube' ? (
            <button
              onClick={handleAddYouTube}
              disabled={step === 'fetching'}
              style={{
                background: step === 'fetching' ? 'var(--border)' : 'var(--accent)',
                color: step === 'fetching' ? 'var(--text-secondary)' : '#0e0f11',
                border: 'none', borderRadius: 8, padding: '10px 24px',
                cursor: step === 'fetching' ? 'not-allowed' : 'pointer',
                fontWeight: 600, fontSize: 14,
                display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
              }}
            >
              {step === 'fetching' ? (
                <><Spinner /> Importing...</>
              ) : 'Import Course'}
            </button>
          ) : (
            <button
              onClick={handleAddLocal}
              disabled={step === 'fetching'}
              style={{
                background: step === 'fetching' ? 'var(--border)' : 'var(--accent)',
                color: step === 'fetching' ? 'var(--text-secondary)' : '#0e0f11',
                border: 'none', borderRadius: 8, padding: '10px 24px',
                cursor: step === 'fetching' ? 'not-allowed' : 'pointer',
                fontWeight: 600, fontSize: 14,
                display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
              }}
            >
              {step === 'fetching' ? (
                <><Spinner /> Reading folder...</>
              ) : '📁 Choose Folder'}
            </button>
          )}
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <span style={{
      width: 14, height: 14, borderRadius: '50%',
      border: '2px solid var(--text-muted)',
      borderTop: '2px solid var(--text-secondary)',
      display: 'inline-block',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}