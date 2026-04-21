'use client'
import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('App error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 16, padding: 32,
        }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>Something went wrong</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center', maxWidth: 360 }}>
            An unexpected error occurred. Your progress data is safe.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/' }}
            style={{
              background: 'var(--accent)', color: '#0e0f11',
              border: 'none', borderRadius: 10, padding: '11px 28px',
              fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}
          >
            Back to home
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
