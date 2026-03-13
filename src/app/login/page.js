'use client'
import { signInWithGoogle } from '@/lib/supabase'
import { useState } from 'react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogleLogin() {
    setLoading(true)
    setError('')
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
      padding: 20,
    }}>
      <div className="fade-up" style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: '48px 40px',
        width: '100%', maxWidth: 400,
        textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, margin: '0 auto 20px',
        }}>
          🎯
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 32, marginBottom: 4,
        }}>
          MyTube
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8, letterSpacing: '0.08em' }}>
          FOCUSLEARN
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 36, lineHeight: 1.6 }}>
          Watch YouTube playlists like a focused course.<br />
          No recommendations. No distractions.
        </p>

        {error && (
          <div style={{
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.25)',
            borderRadius: 8, padding: '10px 14px',
            color: 'var(--danger)', fontSize: 13, marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: '100%',
            background: loading ? 'var(--border)' : '#fff',
            color: '#1a1a1a',
            border: 'none', borderRadius: 10,
            padding: '13px 20px',
            fontWeight: 600, fontSize: 15,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 10,
            transition: 'all 0.2s',
          }}
        >
          {loading ? (
            <>
              <span style={{
                width: 18, height: 18, borderRadius: '50%',
                border: '2px solid #ccc', borderTop: '2px solid #666',
                display: 'inline-block',
                animation: 'spin 0.7s linear infinite',
              }} />
              Connecting...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </>
          )}
        </button>

        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 20 }}>
          Your courses are saved to your account.<br />Access from any device.
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
