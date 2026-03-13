'use client'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'

export default function CourseCard({ course }) {
  const router = useRouter()
  const { deleteCourse } = useApp()
  const pct = course.progress?.percentage || 0
  const watched = course.progress?.watchedVideos?.length || 0

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
        position: 'relative',
      }}
      onClick={() => router.push(`/course/${course.id}`)}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.borderColor = 'rgba(74,222,128,0.3)'
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden', background: '#111' }}>
        {course.thumbnail ? (
          <img
            src={course.thumbnail}
            alt={course.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-hover)',
          }}>
            <span style={{ fontSize: 40 }}>🎓</span>
          </div>
        )}
        {/* Progress overlay */}
        {pct > 0 && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: 3, background: 'rgba(0,0,0,0.5)',
          }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: 'var(--accent)',
              transition: 'width 0.6s ease',
            }} />
          </div>
        )}
        {/* Completion badge */}
        {pct === 100 && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: 'var(--accent)', color: '#0e0f11',
            borderRadius: 20, padding: '3px 10px',
            fontSize: 11, fontWeight: 700,
          }}>
            ✓ Complete
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '14px 16px 16px' }}>
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 16, lineHeight: 1.3,
          marginBottom: 4,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {course.title}
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 12 }}>
          {course.channelTitle}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            {watched}/{course.videoCount} videos
          </span>
          <span style={{
            color: pct === 100 ? 'var(--accent)' : pct > 0 ? 'var(--warning)' : 'var(--text-muted)',
            fontSize: 12, fontWeight: 600,
          }}>
            {pct}%
          </span>
        </div>

        <div className="progress-bar" style={{ marginTop: 8 }}>
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Delete button */}
      <button
        onClick={e => {
          e.stopPropagation()
          if (confirm(`Delete "${course.title}"?`)) deleteCourse(course.id)
        }}
        style={{
          position: 'absolute', top: 10, left: 10,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          border: 'none', borderRadius: 6,
          color: 'var(--text-muted)', cursor: 'pointer',
          padding: '4px 8px', fontSize: 12,
          opacity: 0, transition: 'opacity 0.2s',
        }}
        className="delete-btn"
      >
        ✕
      </button>

      <style>{`
        div:hover .delete-btn { opacity: 1 !important; }
      `}</style>
    </div>
  )
}
