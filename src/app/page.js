'use client'
import { useState } from 'react'
import { AppProvider, useApp } from '@/lib/context'
import CourseCard from '@/components/CourseCard'
import AddCourseModal from '@/components/AddCourseModal'

const Logo = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="8" width="92" height="84" rx="22" fill="#2d7dd2" />
    <polygon points="50,22 22,62 78,62" fill="white" />
    <rect x="28" y="70" width="44" height="10" rx="5" fill="white" />
  </svg>
)

function HomePage() {
  const { user, courses, isLoading, signInWithGoogle, signOut } = useApp()
  const [showModal, setShowModal] = useState(false)

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '2px solid var(--border)', borderTop: '2px solid var(--accent)',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Login screen ─────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 20,
      }}>
        <div className="fade-up" style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ margin: '0 auto 24px', width: 'fit-content' }}>
            <Logo size={72} />
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 40, lineHeight: 1.1, marginBottom: 8,
          }}>
            MyTube
          </h1>
          <p style={{
            color: 'var(--accent)', fontSize: 13,
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16,
          }}>
            focuslearn
          </p>
          <p style={{
            color: 'var(--text-secondary)', fontSize: 16,
            lineHeight: 1.7, marginBottom: 40,
          }}>
            Watch YouTube playlists like a focused course.
            No recommendations. No distractions.
          </p>
          <button
            onClick={signInWithGoogle}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: '#fff', color: '#111',
              border: 'none', borderRadius: 12,
              padding: '14px 28px', cursor: 'pointer',
              fontWeight: 600, fontSize: 15,
              margin: '0 auto',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.4-4z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.2 0-9.6-3-11.3-7.3l-6.5 5C9.6 39.6 16.3 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.8l6.2 5.2C41 35.8 44 30.3 44 24c0-1.3-.1-2.7-.4-4z" />
            </svg>
            Continue with Google
          </button>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 20 }}>
            Your courses are saved to your account — access from any device.
          </p>
        </div>
      </div>
    )
  }

  // ── Main app ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', paddingBottom: 60 }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 32px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(14,15,17,0.9)', backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo size={36} />
          <div>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 20,
              display: 'block', lineHeight: 1.1,
            }}>MyTube</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              focuslearn
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {user.user_metadata?.avatar_url && (
              <img
                src={user.user_metadata.avatar_url}
                alt="avatar"
                style={{ width: 28, height: 28, borderRadius: '50%' }}
              />
            )}
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {user.user_metadata?.full_name?.split(' ')[0] || 'You'}
            </span>
          </div>
          <button
            onClick={signOut}
            style={{
              background: 'transparent', color: 'var(--text-muted)',
              border: '1px solid var(--border)', borderRadius: 8,
              padding: '6px 12px', fontSize: 13, cursor: 'pointer',
            }}
          >
            Sign out
          </button>
          <button
            onClick={() => setShowModal(true)}
            style={{
              background: 'var(--accent)', color: '#0e0f11',
              border: 'none', borderRadius: 8,
              padding: '8px 18px', fontWeight: 600,
              fontSize: 14, cursor: 'pointer',
            }}
          >
            + Add Course
          </button>
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px 0' }}>
        {courses.length > 0 && (
          <div style={{
            display: 'flex', gap: 24, marginBottom: 32,
            padding: '16px 20px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
          }}>
            <Stat label="Courses" value={courses.length} />
            <div style={{ width: 1, background: 'var(--border)' }} />
            <Stat label="Videos Total" value={courses.reduce((s, c) => s + (c.videoCount || 0), 0)} />
            <div style={{ width: 1, background: 'var(--border)' }} />
            <Stat label="Watched" value={courses.reduce((s, c) => s + (c.progress?.watchedVideos?.length || 0), 0)} />
            <div style={{ width: 1, background: 'var(--border)' }} />
            <Stat label="Completed" value={courses.filter(c => c.progress?.percentage === 100).length} accent />
          </div>
        )}

        {courses.length === 0 ? (
          <EmptyState onAdd={() => setShowModal(true)} />
        ) : (
          <>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22, marginBottom: 20, color: 'var(--text-secondary)',
            }}>
              My Courses
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 20,
            }}>
              {courses.map((course, i) => (
                <div key={course.id} className="fade-up"
                  style={{ animationDelay: `${i * 60}ms`, opacity: 0 }}>
                  <CourseCard course={course} />
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {showModal && <AddCourseModal onClose={() => setShowModal(false)} />}
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div>
      <p style={{
        fontSize: 22, fontWeight: 700,
        fontFamily: 'var(--font-display)',
        color: accent ? 'var(--accent)' : 'var(--text-primary)',
      }}>{value}</p>
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</p>
    </div>
  )
}

function EmptyState({ onAdd }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', gap: 16, textAlign: 'center',
    }}>
      <Logo size={80} />
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28 }}>
        No distractions.<br />Just learning.
      </h2>
      <p style={{ color: 'var(--text-secondary)', maxWidth: 360, lineHeight: 1.7 }}>
        Paste any public YouTube playlist — MyTube turns it into a focused course.
        No chaos. Just progress.
      </p>
      <button onClick={onAdd} style={{
        background: 'var(--accent)', color: '#0e0f11',
        border: 'none', borderRadius: 10,
        padding: '12px 28px', fontWeight: 700,
        fontSize: 15, cursor: 'pointer', marginTop: 8,
      }}>
        + Add Your First Course
      </button>
    </div>
  )
}

export default function Page() {
  return <AppProvider><HomePage /></AppProvider>
}