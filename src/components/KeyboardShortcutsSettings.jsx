import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Save, RotateCcw, AlertTriangle, Check } from 'lucide-react'
import { shortcutsApi } from '../utils/api'

const DEFAULT_SHORTCUTS = {
  c: 'Rush',
  r: 'Reception',
  t: 'Tackle Solo',
  a: 'Tackle Assist',
  p: 'Pass Comp',
  m: 'Pass Inc',
  i: 'INT',
  f: 'Fumble',
  s: 'Sack',
  l: 'TFL',
  b: 'PBU',
  y: 'Return',
  q: 'Sack Taken',
}

const DEFAULT_COMBOS = {
  RT: 'Rush TD',
  CT: 'Rec TD',
  PT: 'Pass TD',
}

const ALL_STATS = Object.values(DEFAULT_SHORTCUTS)

function KeyboardShortcutsSettings({ isOpen, onClose, currentShortcuts, currentCombos, onSave }) {
  const modalRef = useRef(null)
  const [shortcuts, setShortcuts] = useState({})
  const [combos, setCombos] = useState({})
  const [recording, setRecording] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setShortcuts({ ...(currentShortcuts || DEFAULT_SHORTCUTS) })
      setCombos({ ...(currentCombos || DEFAULT_COMBOS) })
      setError(null)
      setRecording(null)
      setSaved(false)
    }
  }, [isOpen, currentShortcuts, currentCombos])

  useEffect(() => {
    if (!isOpen) return
    function handleEsc(e) {
      if (e.key === 'Escape') {
        if (recording) {
          setRecording(null)
        } else {
          onClose()
        }
      }
    }
    function handleClickOutside(e) {
      if (modalRef.current && !modalRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('keydown', handleEsc)
    document.addEventListener('mousedown', handleClickOutside)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.removeEventListener('mousedown', handleClickOutside)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose, recording])

  // Duplicate detection
  const duplicates = (() => {
    const keyCount = {}
    Object.keys(shortcuts).forEach((key) => {
      keyCount[key] = (keyCount[key] || 0) + 1
    })
    return new Set(Object.keys(keyCount).filter((k) => keyCount[k] > 1))
  })()

  const handleRecordKey = useCallback(
    (e) => {
      if (!recording) return
      e.preventDefault()
      e.stopPropagation()
      const key = e.key.toLowerCase()

      if (['shift', 'control', 'alt', 'meta', 'tab', 'enter', ' ', '?'].includes(key) || e.key.length > 1) {
        if (key === 'escape') setRecording(null)
        return
      }

      // Remove old key for this stat, assign new one
      const newShortcuts = { ...shortcuts }
      const oldKey = Object.entries(newShortcuts).find(([, val]) => val === recording)?.[0]
      if (oldKey) delete newShortcuts[oldKey]
      newShortcuts[key] = recording

      setShortcuts(newShortcuts)
      setRecording(null)
      setError(null)
    },
    [recording, shortcuts]
  )

  useEffect(() => {
    if (recording) {
      window.addEventListener('keydown', handleRecordKey, true)
      return () => window.removeEventListener('keydown', handleRecordKey, true)
    }
  }, [recording, handleRecordKey])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await shortcutsApi.save({ shortcuts, combo_shortcuts: combos })
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        onSave({ shortcuts, combos })
        onClose()
      }, 800)
    } catch (err) {
      setError(err.message || 'Failed to save shortcuts')
    }
    setSaving(false)
  }

  const handleReset = async () => {
    setSaving(true)
    setError(null)
    try {
      await shortcutsApi.reset()
      setShortcuts({ ...DEFAULT_SHORTCUTS })
      setCombos({ ...DEFAULT_COMBOS })
      onSave(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (err) {
      setError(err.message || 'Failed to reset shortcuts')
    }
    setSaving(false)
  }

  if (!isOpen) return null

  // Reverse map: stat → key
  const statToKey = {}
  Object.entries(shortcuts).forEach(([key, stat]) => {
    statToKey[stat] = key
  })

  return (
    <div className="modal-overlay">
      <div className="modal-content shortcuts-modal" ref={modalRef} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h2>Customize Shortcuts</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '16px 24px', maxHeight: '60vh', overflowY: 'auto' }}>
          {error && (
            <div style={{ background: 'var(--color-danger)', color: 'white', padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '12px', fontSize: '13px' }}>
              {error}
            </div>
          )}

          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
            Click a row then press the key you want to assign. Press Escape to cancel.
          </p>

          <div className="shortcuts-settings-grid">
            {ALL_STATS.map((stat) => {
              const key = statToKey[stat]
              const isDuplicate = key && duplicates.has(key)
              const isRecording = recording === stat
              return (
                <div
                  key={stat}
                  className={`shortcut-setting-row${isRecording ? ' recording' : ''}${isDuplicate ? ' duplicate' : ''}`}
                  onClick={() => setRecording(stat)}
                >
                  <span className="shortcut-setting-label">{stat}</span>
                  <span className="shortcut-setting-key">
                    {isRecording ? (
                      <kbd className="shortcut-key-recording">...</kbd>
                    ) : key ? (
                      <kbd>{key.toUpperCase()}</kbd>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>—</span>
                    )}
                  </span>
                  {isDuplicate && (
                    <AlertTriangle size={13} style={{ color: 'var(--color-warning)' }} />
                  )}
                </div>
              )
            })}
          </div>

          <h4 style={{ fontSize: '13px', fontWeight: 600, margin: '16px 0 6px', color: 'var(--color-text-secondary)' }}>
            Combo Keys
          </h4>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
            Used in quick entry field (e.g., "20RT"). Not remappable.
          </p>
          <div className="shortcuts-settings-grid">
            {Object.entries(combos).map(([combo, stat]) => (
              <div key={combo} className="shortcut-setting-row" style={{ cursor: 'default', opacity: 0.7 }}>
                <span className="shortcut-setting-label">{stat}</span>
                <span className="shortcut-setting-key"><kbd>{combo}</kbd></span>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 24px', borderTop: '1px solid var(--color-border)' }}>
          <button className="btn-ghost" onClick={handleReset} disabled={saving}>
            <RotateCcw size={14} />
            Reset Defaults
          </button>
          <button
            className={saved ? 'btn-saved' : 'btn-primary'}
            onClick={handleSave}
            disabled={saving || saved || duplicates.size > 0}
          >
            {saved ? (
              <><Check size={14} /> Saved!</>
            ) : (
              <><Save size={14} /> Save</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default KeyboardShortcutsSettings
