import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom'
import { Home, Users, Plus, Moon, Sun, HelpCircle, Settings, FileText, UserCheck, Bell, ClipboardList, BarChart3 } from 'lucide-react'
import Dashboard from './components/Dashboard'
import GameReview from './components/GameReview'
import PlayerManagement from './components/PlayerManagement'
import { createGame, isUsingFallback } from './utils/storage'
import PlayerStats from './components/PlayerStats'
import Login from './components/Login'
import ForgotPassword from './components/ForgotPassword'
import ResetPassword from './components/ResetPassword'
import { authApi, shortcutsApi } from './utils/api'
import UserManagement from './components/UserManagement'
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal'
import AuditLog from './components/AuditLog'
import ScoutAssignments from './components/ScoutAssignments'
import RecruitsReport from './components/RecruitsReport'
import Notifications from './components/Notifications'
import Analytics from './components/Analytics'
import PlayerProfile from './components/PlayerProfile'
import KeyboardShortcutsSettings from './components/KeyboardShortcutsSettings'

function App() {
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false)
  const [shortcutsSettingsOpen, setShortcutsSettingsOpen] = useState(false)
  const [userShortcuts, setUserShortcuts] = useState(null)
  const [userCombos, setUserCombos] = useState(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [showFallbackWarning, setShowFallbackWarning] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      setAuthChecked(true)
      return
    }
    authApi.me()
      .then((u) => {
        setUser(u)
        shortcutsApi.get()
          .then((data) => {
            if (data?.shortcuts) setUserShortcuts(data.shortcuts)
            if (data?.combo_shortcuts) setUserCombos(data.combo_shortcuts)
          })
          .catch(() => {})
      })
      .catch(() => {
        localStorage.removeItem('auth_token')
      })
      .finally(() => setAuthChecked(true))
  }, [])

  // Check if using localStorage fallback periodically
  useEffect(() => {
    const check = () => setShowFallbackWarning(isUsingFallback())
    check()
    const interval = setInterval(check, 10000)
    return () => clearInterval(interval)
  }, [])

  // Global keyboard shortcut for ? to open shortcuts modal
  const handleGlobalKeyDown = useCallback((e) => {
    // Don't trigger if user is typing in an input, textarea, or select
    const tagName = e.target.tagName.toLowerCase()
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
      return
    }

    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      setShortcutsModalOpen(true)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [handleGlobalKeyDown])

  if (!authChecked) {
    return (
      <div className="page">
        <p>Checking session...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <Router>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Login onAuthSuccess={setUser} />} />
        </Routes>
      </Router>
    )
  }

  return (
    <Router>
      <div className="app">
        {showFallbackWarning && (
          <div style={{
            background: '#f59e0b',
            color: '#000',
            textAlign: 'center',
            padding: '6px 12px',
            fontSize: '14px',
            fontWeight: 500,
          }}>
            Server unavailable — showing cached data
          </div>
        )}
        <NavBar
          user={user}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((prev) => !prev)}
          onLogout={() => {
            localStorage.removeItem('auth_token')
            setUser(null)
          }}
          onShowShortcuts={() => setShortcutsModalOpen(true)}
          onShowSettings={() => setShortcutsSettingsOpen(true)}
          onShowNotifications={() => setNotificationsOpen(true)}
        />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/review/:gameId?" element={<GameReview />} />
            <Route path="/players" element={<PlayerManagement />} />
            <Route path="/player/:playerId" element={<PlayerProfile />} />
            <Route path="/player/:playerId/stats" element={<PlayerStats />} />
            <Route path="/recruits-report" element={<RecruitsReport />} />
            <Route path="/analytics" element={<Analytics />} />
            {user?.role === 'admin' ? (
              <>
                <Route path="/admin/users" element={<UserManagement />} />
                <Route path="/admin/assignments" element={<ScoutAssignments />} />
                <Route path="/admin/audit-log" element={<AuditLog />} />
              </>
            ) : null}
          </Routes>
        </main>
        <KeyboardShortcutsModal
          isOpen={shortcutsModalOpen}
          onClose={() => setShortcutsModalOpen(false)}
          shortcuts={userShortcuts}
          comboShortcuts={userCombos}
        />
        <KeyboardShortcutsSettings
          isOpen={shortcutsSettingsOpen}
          onClose={() => setShortcutsSettingsOpen(false)}
          currentShortcuts={userShortcuts}
          currentCombos={userCombos}
          onSave={(data) => {
            if (data) {
              setUserShortcuts(data.shortcuts)
              setUserCombos(data.combos)
            } else {
              setUserShortcuts(null)
              setUserCombos(null)
            }
          }}
        />
        {notificationsOpen && (
          <Notifications onClose={() => setNotificationsOpen(false)} />
        )}
      </div>
    </Router>
  )
}

function NavBar({ user, darkMode, onToggleDarkMode, onLogout, onShowShortcuts, onShowSettings, onShowNotifications }) {
  const navigate = useNavigate()
  const [activePath, setActivePath] = useState(window.location.pathname)

  useEffect(() => {
    const handleLocationChange = () => setActivePath(window.location.pathname)
    window.addEventListener('popstate', handleLocationChange)
    return () => window.removeEventListener('popstate', handleLocationChange)
  }, [])

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <h1>BYU Scouting</h1>
      </div>
      <div className="navbar-links">
        <Link
          to="/"
          className={activePath === '/' ? 'active' : ''}
          onClick={() => setActivePath('/')}
        >
          <Home size={20} />
          Dashboard
        </Link>
        <Link
          to="/players"
          className={activePath === '/players' ? 'active' : ''}
          onClick={() => setActivePath('/players')}
        >
          <Users size={20} />
          Players
        </Link>
        <Link
          to="/recruits-report"
          className={activePath === '/recruits-report' ? 'active' : ''}
          onClick={() => setActivePath('/recruits-report')}
        >
          <FileText size={20} />
          Recruits Report
        </Link>
        <Link
          to="/analytics"
          className={activePath === '/analytics' ? 'active' : ''}
          onClick={() => setActivePath('/analytics')}
        >
          <BarChart3 size={20} />
          Analytics
        </Link>
        {user?.role === 'admin' ? (
          <>
            <Link
              to="/admin/users"
              className={activePath === '/admin/users' ? 'active' : ''}
              onClick={() => setActivePath('/admin/users')}
            >
              <Users size={20} />
              Users
            </Link>
            <Link
              to="/admin/assignments"
              className={activePath === '/admin/assignments' ? 'active' : ''}
              onClick={() => setActivePath('/admin/assignments')}
            >
              <UserCheck size={20} />
              Assignments
            </Link>
            <Link
              to="/admin/audit-log"
              className={activePath === '/admin/audit-log' ? 'active' : ''}
              onClick={() => setActivePath('/admin/audit-log')}
            >
              <FileText size={20} />
              Audit Log
            </Link>
          </>
        ) : null}
        <button
          className="btn-ghost"
          onClick={onShowNotifications}
          title="Notifications"
        >
          <Bell size={20} />
        </button>
        <button
          className="btn-primary"
          onClick={async () => {
            const newGame = {
              opponent: '',
              date: new Date().toISOString().slice(0, 10),
              location: '',
              competitionLevel: '',
              videoUrl: '',
              notes: '',
              playerIds: []
            }
            const created = await createGame(newGame)
            const gameId = created?.id ? String(created.id) : Date.now().toString()
            navigate(`/review/${gameId}`)
            setActivePath(`/review/${gameId}`)
          }}
        >
          <Plus size={20} />
          New Game Review
        </button>
        <button
          className="btn-ghost"
          onClick={onShowShortcuts}
          title="Keyboard shortcuts (?)"
        >
          <HelpCircle size={20} />
        </button>
        <button
          className="btn-ghost"
          onClick={onShowSettings}
          title="Customize shortcuts"
        >
          <Settings size={20} />
        </button>
        <button
          className="btn-ghost"
          onClick={onToggleDarkMode}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button className="btn-ghost" onClick={onLogout}>
          Log out
        </button>
      </div>
    </nav>
  )
}

export default App
