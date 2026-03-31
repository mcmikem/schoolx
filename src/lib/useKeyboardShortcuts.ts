'use client'
import { useEffect, useCallback, useState } from 'react'

interface Shortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  action: () => void
  description: string
  preventDefault?: boolean
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in input fields
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // Only allow Ctrl+S and Escape in input fields
      if (!(event.ctrlKey || event.metaKey)) return
    }

    for (const shortcut of shortcuts) {
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
      const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !(event.ctrlKey || event.metaKey)
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey
      const altMatch = shortcut.alt ? event.altKey : !event.altKey

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault()
        }
        shortcut.action()
        return
      }
    }
  }, [shortcuts])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

// Global shortcuts that work everywhere
export function useGlobalShortcuts(router: { push: (path: string) => void }, searchModal: { open: () => void }) {
  const [showHelp, setShowHelp] = useState(false)

  const shortcuts: Shortcut[] = [
    {
      key: 'k',
      ctrl: true,
      action: () => searchModal.open(),
      description: 'Open search (⌘K)',
    },
    {
      key: '/',
      action: () => searchModal.open(),
      description: 'Open search (/)',
    },
    {
      key: 'd',
      ctrl: true,
      action: () => router.push('/dashboard'),
      description: 'Go to dashboard (⌘D)',
    },
    {
      key: 'Escape',
      action: () => setShowHelp(false),
      description: 'Close modals (Esc)',
    },
    {
      key: '?',
      shift: true,
      action: () => setShowHelp(!showHelp),
      description: 'Show keyboard shortcuts (⌘?)',
    },
  ]

  useKeyboardShortcuts(shortcuts)

  return { showHelp, setShowHelp, shortcuts }
}

// Form shortcuts
export function useFormShortcuts({
  onSave,
  onReset,
  onCancel,
}: {
  onSave: () => void
  onReset?: () => void
  onCancel?: () => void
}) {
  const shortcuts: Shortcut[] = [
    {
      key: 's',
      ctrl: true,
      action: onSave,
      description: 'Save (⌘S)',
    },
    {
      key: 'Enter',
      ctrl: true,
      action: onSave,
      description: 'Save (⌘Enter)',
    },
  ]

  if (onReset) {
    shortcuts.push({
      key: 'r',
      ctrl: true,
      shift: true,
      action: onReset,
      description: 'Reset form (⌘⇧R)',
    })
  }

  if (onCancel) {
    shortcuts.push({
      key: 'Escape',
      action: onCancel,
      description: 'Cancel (Esc)',
    })
  }

  useKeyboardShortcuts(shortcuts)
}

// Keyboard help component
export function KeyboardHelpModal({ shortcuts, onClose }: { shortcuts: Shortcut[]; onClose: () => void }) {
  return (
    <div 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        background: 'rgba(0,0,0,0.5)', 
        zIndex: 200, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: 16
      }}
      onClick={onClose}
    >
      <div 
        style={{ 
          background: 'var(--surface)', 
          borderRadius: 16, 
          padding: 24, 
          maxWidth: 400, 
          width: '100%',
          maxHeight: '80vh',
          overflow: 'auto'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)' }}>Keyboard Shortcuts</h2>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--t3)' }}>close</span>
          </button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shortcuts.map((shortcut, i) => (
            <div 
              key={i}
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: i < shortcuts.length - 1 ? '1px solid var(--border)' : 'none'
              }}
            >
              <span style={{ fontSize: 14, color: 'var(--t2)' }}>{shortcut.description}</span>
              <kbd style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 12,
                fontFamily: 'DM Mono, monospace',
                color: 'var(--t1)'
              }}>
                {shortcut.ctrl && '⌘+'}
                {shortcut.shift && '⇧+'}
                {shortcut.alt && '⌥+'}
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>
        
        <p style={{ fontSize: 12, color: 'var(--t4)', marginTop: 20, textAlign: 'center' }}>
          Press <kbd style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', fontFamily: 'DM Mono' }}>?</kbd> to toggle this help
        </p>
      </div>
    </div>
  )
}
