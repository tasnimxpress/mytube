'use client'
import { useState, useRef } from 'react'
import { AppProvider, useApp } from '@/lib/context'
import CourseCard from '@/components/CourseCard'
import AddCourseModal from '@/components/AddCourseModal'
import StorageSetupBanner from '@/components/StorageSetupBanner'

function HomePage() {
  const { data, isLoading, storageType, handleExport, handleImport } = useApp()
  const [showModal, setShowModal] = useState(false)
  const importRef = useRef()

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '2px solid var(--border)',
          borderTop: '2px solid var(--accent)',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading your courses...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const courses = data?.courses || []

  return (
    <div style={{ minHeight: '100vh', padding: '0 0 60px' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 32px',
        height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(14,15,17,0.9)',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>
            🎯
          </div>
          <div>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 20, letterSpacing: '-0.02em',
              display: 'block', lineHeight: 1.1,
            }}>
              MyTube
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              focuslearn
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={async e => {
              const file = e.target.files[0]
              if (file) await handleImport(file)
              e.target.value = ''
            }}
          />
          <button
            onClick={() => importRef.current?.click()}
            style={ghostBtn}
            title="Import data"
          >
            ↑ Import
          </button>
          <button onClick={handleExport} style={ghostBtn} title="Export data">
            ↓ Export
          </button>
          <button
            onClick={() => setShowModal(true)}
            style={{
              background: 'var(--accent)', color: '#0e0f11',
              border: 'none', borderRadius: 8,
              padding: '8px 18px', fontWeight: 600,
              fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ fontSize: 16 }}>+</span> Add Course
          </button>
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px 0' }}>
        <StorageSetupBanner />

        {/* Stats bar */}
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
            <Stat
              label="Videos Total"
              value={courses.reduce((s, c) => s + (c.videoCount || 0), 0)}
            />
            <div style={{ width: 1, background: 'var(--border)' }} />
            <Stat
              label="Watched"
              value={courses.reduce((s, c) => s + (c.progress?.watchedVideos?.length || 0), 0)}
            />
            <div style={{ width: 1, background: 'var(--border)' }} />
            <Stat
              label="Completed"
              value={courses.filter(c => c.progress?.percentage === 100).length}
              accent
            />
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {storageType === 'file' ? '💾 Saved to file' : '🗄️ Saved in browser'}
              </span>
            </div>
          </div>
        )}

        {/* Course grid */}
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
                <div
                  key={course.id}
                  className="fade-up"
                  style={{ animationDelay: `${i * 60}ms`, opacity: 0 }}
                >
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
      }}>
        {value}
      </p>
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
      <div style={{
        width: 80, height: 80, borderRadius: 20,
        background: 'var(--accent-dim)',
        border: '1px solid rgba(74,222,128,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36,
      }}>
        🎓
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28 }}>
        No distractions.<br />Just learning.
      </h2>
      <p style={{ color: 'var(--text-secondary)', maxWidth: 360, lineHeight: 1.7 }}>
        Paste any public YouTube playlist — MyTube turns it into a focused course.
        No API key. No account. No chaos.
      </p>
      <button
        onClick={onAdd}
        style={{
          background: 'var(--accent)', color: '#0e0f11',
          border: 'none', borderRadius: 10,
          padding: '12px 28px', fontWeight: 700,
          fontSize: 15, cursor: 'pointer',
          marginTop: 8,
        }}
      >
        + Add Your First Course
      </button>
    </div>
  )
}

const ghostBtn = {
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '7px 14px',
  fontSize: 13, cursor: 'pointer',
}

export default function Page() {
  return (
    <AppProvider>
      <HomePage />
    </AppProvider>
  )
}
