import { useState, useEffect, useCallback } from 'react'
import { Save, RotateCcw, AlertTriangle, Check } from 'lucide-react'
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

function KeyboardShortcutsSettings() {
  const [shortcuts, setShortcuts] = useState({ ...DEFAULT_SHORTCUTS })
  const [combos, setCombos] = useState({ ...DEFAULT_COMBOS })
  const [recording, setRecording] = useState(null) // stat type being recorded
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    shortcutsApi.get()
      .then((data) => {
        if (data?.shortcuts) setShortcuts(data.shortcuts)
        if (data?.combo_shortcuts) setCombos(data.combo_shortcuts)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Find duplicate keys
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
      const key = e.key.toLowerCase()

      // Ignore modifier keys and special keys
      if (['shift', 'control', 'alt', 'meta', 'tab', 'enter', 'escape', ' ', '?'].includes(key) || e.key.length > 1) {
        if (key === 'escape') setRecording(null)
        return
      }

      // Find and remove the old key for this stat type
      const oldKey = Object.entries(shortcuts).find(([, val]) => val === recording)?.[0]
      const newShortcuts = { ...shortcuts }
      if (oldKey) delete newShortcuts[oldKey]
      newShortcuts[key] = recording

      setShortcuts(newShortcuts)
      setRecording(null)
    },
    [recording, shortcuts]
  )

  useEffect(() => {
    if (recording) {
      window.addEventListener('keydown', handleRecordKey)
      return () => window.removeEventListener('keydown', handleRecordKey)
    }
  }, [recording, handleRecordKey])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await shortcutsApi.update({ shortcuts, combo_shortcuts: combos })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err.message || 'Failed to save shortcuts')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    setSaving(true)
    setError(null)
    try {
      await shortcutsApi.reset()
      setShortcuts({ ...DEFAULT_SHORTCUTS })
      setCombos({ ...DEFAULT_COMBOS })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err.message || 'Failed to reset shortcuts')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p>Loading shortcuts...</p>
      </div>
    )
  }

  // Build a reverse map: stat type -> key
  const statToKey = {}
  Object.entries(shortcuts).forEach(([key, stat]) => {
    statToKey[stat] = key
  })

  // All stat types from defaults (use this as the canonical list of remappable stats)
  const allStats = Object.values(DEFAULT_SHORTCUTS)

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h2>Keyboard Shortcuts</h2>
          <p>Customize the keys used for quick stat entry during game review.</p>
        </div>
        <div className="action-row">
          <button className="btn-ghost" onClick={handleReset} disabled={saving}>
            <RotateCcw size={16} />
            Reset to Defaults
          </button>
          <button
            className={saved ? 'btn-saved' : 'btn-primary'}
            onClick={handleSave}
            disabled={saving || saved || duplicates.size > 0}
          >
            {saved ? (
              <><Check size={16} /> Saved!</>
            ) : (
              <><Save size={16} /> Save Shortcuts</>
            )}
          </button>
        </div>
      </header>

      {error && (
        <div className="panel" style={{ background: 'var(--color-danger)', color: 'white', padding: '12px 16px' }}>
          {error}
        </div>
      )}

      <section className="panel">
        <h3>Stat Entry Keys</h3>
        <p className="helper-text">
          Click a stat row, then press the key you want to assign. Press Escape to cancel.
        </p>

        <div className="table">
          <div className="table-row table-header">
            <span>Stat Type</span>
            <span>Key</span>
            <span />
          </div>
          {allStats.map((stat) => {
            const key = statToKey[stat]
            const isDuplicate = key && duplicates.has(key)
            const isRecording = recording === stat
            return (
              <div
                key={stat}
                className={`table-row ${isRecording ? 'active' : ''}`}
                onClick={() => setRecording(stat)}
                style={{ cursor: 'pointer' }}
              >
                <span>{stat}</span>
                <span>
                  {isRecording ? (
                    <kbd style={{ background: 'var(--color-primary)', color: 'white', animation: 'pulse 1s infinite' }}>
                      Press a key...
                    </kbd>
                  ) : key ? (
                    <kbd>{key.toUpperCase()}</kbd>
                  ) : (
                    <span style={{ color: 'var(--color-text-muted)' }}>Not assigned</span>
                  )}
                </span>
                <span>
                  {isDuplicate && (
                    <span style={{ color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                      <AlertTriangle size={14} />
                      Duplicate key
                    </span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="panel">
        <h3>Combo Keys</h3>
        <p className="helper-text">
          Combo shortcuts are used in the quick entry field (e.g., "20RT" for a 20-yard Rush TD).
          These use two-letter combinations and are not remappable.
        </p>
        <div className="table">
          <div className="table-row table-header">
            <span>Combo</span>
            <span>Stat Type</span>
          </div>
          {Object.entries(combos).map(([combo, stat]) => (
            <div key={combo} className="table-row">
              <span><kbd>{combo}</kbd></span>
              <span>{stat}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default KeyboardShortcutsSettings
