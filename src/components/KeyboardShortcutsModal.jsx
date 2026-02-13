import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

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

const GENERAL_SHORTCUTS = [
  { key: '\u2318/Ctrl + Z', action: 'Undo last action' },
  { key: '\u2318/Ctrl + Y', action: 'Redo action' },
  { key: '?', action: 'Show this help' },
  { key: 'Esc', action: 'Close modal / Cancel' },
]

function KeyboardShortcutsModal({ isOpen, onClose, shortcuts, comboShortcuts }) {
  const modalRef = useRef(null)
  const activeShortcuts = shortcuts || DEFAULT_SHORTCUTS
  const activeCombos = comboShortcuts || DEFAULT_COMBOS

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    function handleClickOutside(e) {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.addEventListener('mousedown', handleClickOutside)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const categories = [
    {
      title: 'Stat Entry',
      shortcuts: Object.entries(activeShortcuts).map(([key, action]) => ({
        key,
        action,
      })),
    },
    {
      title: 'Combo Stats',
      description: 'Hold keys together',
      shortcuts: Object.entries(activeCombos).map(([key, action]) => ({
        key: key.split('').join(' + '),
        action,
      })),
    },
    {
      title: 'General',
      shortcuts: GENERAL_SHORTCUTS,
    },
  ]

  return (
    <div className="modal-overlay">
      <div className="modal-content shortcuts-modal" ref={modalRef}>
        <div className="modal-header">
          <h2>Keyboard Shortcuts</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="shortcuts-grid">
          {categories.map((category) => (
            <div key={category.title} className="shortcut-category">
              <h3>{category.title}</h3>
              {category.description && (
                <p className="shortcut-category-desc">{category.description}</p>
              )}
              <div className="shortcut-list">
                {category.shortcuts.map((shortcut) => (
                  <div key={shortcut.key} className="shortcut-item">
                    <kbd>{shortcut.key}</kbd>
                    <span>{shortcut.action}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <p className="shortcuts-note">
            Stat shortcuts work when a player is selected during game review.
          </p>
        </div>
      </div>
    </div>
  )
}

export default KeyboardShortcutsModal
