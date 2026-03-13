'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import CourseCard from '@/components/CourseCard'
import AddCourseModal from '@/components/AddCourseModal'

export default function HomePage() {
  const router = useRouter()
  const { user, courses, isLoading, signInWithGoogle, signOut } = useApp()
  const [showModal, setShowModal] = useState(false)

  // ── Not logged in ─────────────────────────────────────────────────────────
  if (!isLoading && !user) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', padding: 20,
      }}>
        <div className="fade-up" style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: '48px 40px',
          width: '100%', maxWidth: 400,
          textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, margin: '0 auto 20px',
          }}>
            🎯
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, marginBottom: 4 }}>
            MyTube
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8, letterSpacing: '0.08em' }}>
            FOCUSLEARN
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 36, lineHeight: 1.6 }}>
            Watch YouTube playlists like a focused course.<br />
            No recommendations. No distractions.
          </p>
          <button
            onClick={signInWithGoogle}
            style={{
              width: '100%',
              background: '#fff', color: '#1a1a1a',
              border: 'none', borderRadius: 10,
              padding: '13px 20px',
              fontWeight: 600, fontSize: 15,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 10,
              transition: 'all 0.2s',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 20 }}>
            Your courses are saved to your account.<br />Access from any device.
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '2px solid var(--border)', borderTop: '2px solid var(--accent)',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalVideos = courses.reduce((sum, c) => sum + (c.progress?.watchedVideos?.length || 0), 0)
  const completed = courses.filter(c => c.progress?.percentage === 100).length

  // ── Dashboard ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Navbar */}
      <header style={{
        height: 60, background: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 24px', gap: 16,
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>
            🎯
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>MyTube</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 11, letterSpacing: '0.08em' }}>FOCUSLEARN</span>
        </div>

        <button
          onClick={() => setShowModal(true)}
          style={{
            background: 'var(--accent)', color: '#0e0f11',
            border: 'none', borderRadius: 8,
            padding: '8px 16px', cursor: 'pointer',
            fontWeight: 600, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          + Add Course
        </button>

        <button
          onClick={signOut}
          style={{
            background: 'transparent', color: 'var(--text-muted)',
            border: '1px solid var(--border)', borderRadius: 8,
            padding: '8px 14px', cursor: 'pointer', fontSize: 13,
          }}
        >
          Sign out
        </button>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* Welcome + stats */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 4 }}>
            Your Courses
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
            {user?.email}
          </p>

          {courses.length > 0 && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'Courses', value: courses.length },
                { label: 'Videos watched', value: totalVideos },
                { label: 'Completed', value: completed },
              ].map(stat => (
                <div key={stat.label} style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 10, padding: '12px 20px',
                  minWidth: 100,
                }}>
                  <p style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>
                    {stat.value}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stat.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Course grid */}
        {courses.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '80px 20px',
            border: '1px dashed var(--border)',
            borderRadius: 16,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎓</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 8 }}>
              No courses yet
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
              Add a YouTube playlist or a local folder to get started.
            </p>
            <button
              onClick={() => setShowModal(true)}
              style={{
                background: 'var(--accent)', color: '#0e0f11',
                border: 'none', borderRadius: 8,
                padding: '12px 24px', cursor: 'pointer',
                fontWeight: 600, fontSize: 14,
              }}
            >
              + Add your first course
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 20,
          }}>
            {courses.map(course => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </main>

      {/* Add Course Modal */}
      {showModal && <AddCourseModal onClose={() => setShowModal(false)} />}
    </div>
  )
}