'use client'
import { useState } from 'react'
import { useApp } from '@/lib/context'

export default function StorageSetupBanner() {
  const { needsSetup, storageType, handleSetupFile, handleExport, handleImport } = useApp()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  if (needsSetup && storageType === 'file') {
    return (
      <div style={{
        background: 'linear-gradient(135deg, rgba(74,222,128,0.08), rgba(74,222,128,0.04))',
        border: '1px solid rgba(74,222,128,0.25)',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1 }}>
          <p style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
            💾 Save your data to a local file
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Choose a folder once — your courses & progress will auto-save there every time.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleSetupFile}
            style={{
              background: 'var(--accent)',
              color: '#0e0f11',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Choose Folder
          </button>
          <button
            onClick={() => setDismissed(true)}
            style={{
              background: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Skip
          </button>
        </div>
      </div>
    )
  }

  return null
}
