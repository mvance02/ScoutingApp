import { useEffect, useMemo, useState } from 'react'
import { Calendar as CalendarIcon, MapPin, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { visitsApi, playersApi } from '../utils/api'

const VISIT_TYPES = [
  'Official',
  'Unofficial',
  'Gameday',
  'Junior Day',
  'Camp',
  'Practice',
  'Meeting',
  'Home Visit',
  'Other',
]

function startOfMonth(date) {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

function addMonths(date, delta) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + delta)
  return d
}

function VisitCalendar() {
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()))
  const [events, setEvents] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    player_id: '',
    visit_date: '',
    visit_type: VISIT_TYPES[0],
    location: '',
    notes: '',
  })

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [upcoming, allPlayers] = await Promise.all([
          visitsApi.getUpcoming().catch(() => []),
          playersApi.getAll().catch(() => []),
        ])
        setEvents(upcoming || [])
        setPlayers(Array.isArray(allPlayers) ? allPlayers : [])
      } catch (err) {
        console.error('Visit calendar load error:', err)
        setStatus('Failed to load visit calendar')
        setTimeout(() => setStatus(''), 3000)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const monthLabel = useMemo(() => {
    return monthCursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }, [monthCursor])

  const calendarDays = useMemo(() => {
    const start = startOfMonth(monthCursor)
    const firstWeekday = start.getDay() // 0-6
    const days = []
    const cursor = new Date(start)
    cursor.setDate(cursor.getDate() - firstWeekday)
    for (let i = 0; i < 42; i += 1) {
      days.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    return days
  }, [monthCursor])

  const eventsByDate = useMemo(() => {
    const map = {}
    events.forEach((evt) => {
      const key = String(evt.visit_date || '').split('T')[0]
      if (!key) return
      if (!map[key]) map[key] = []
      map[key].push(evt)
    })
    return map
  }, [events])

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => a.name.localeCompare(b.name))
  }, [players])

  const handleDayClick = (dateStr) => {
    setSelectedDate(dateStr)
    setForm((prev) => ({
      ...prev,
      visit_date: dateStr,
    }))
  }

  const handleOpenForm = (dateStr) => {
    setSelectedDate(dateStr)
    setForm((prev) => ({
      ...prev,
      visit_date: dateStr,
    }))
    setShowForm(true)
  }

  const resetForm = () => {
    setForm({
      player_id: '',
      visit_date: selectedDate,
      visit_type: VISIT_TYPES[0],
      location: '',
      notes: '',
    })
  }

  const handleCreate = async () => {
    if (!form.player_id || !form.visit_date) {
      setStatus('Player and date are required')
      setTimeout(() => setStatus(''), 2500)
      return
    }
    try {
      const created = await visitsApi.create({
        player_id: Number(form.player_id),
        visit_date: form.visit_date,
        visit_type: form.visit_type,
        location: form.location || null,
        notes: form.notes || null,
      })
      setEvents((prev) => [...prev, created].sort((a, b) => new Date(a.visit_date) - new Date(b.visit_date)))
      resetForm()
      setShowForm(false)
      setStatus('Visit scheduled')
      setTimeout(() => setStatus(''), 2500)
    } catch (err) {
      console.error('Create visit error:', err)
      setStatus('Failed to schedule visit')
      setTimeout(() => setStatus(''), 3000)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton-block analytics-skeleton-header" />
        <div className="skeleton-block analytics-skeleton-panel-full" />
      </div>
    )
  }

  const selectedDayEvents = eventsByDate[selectedDate] || []

  const visitTypeColor = (type) => {
    const map = {
      'Official': '#002E5D',
      'Unofficial': '#D97706',
      'Gameday': '#16A34A',
      'Junior Day': '#7C3AED',
      'Camp': '#EA580C',
      'Practice': '#475569',
      'Meeting': '#0891B2',
      'Home Visit': '#BE185D',
      'Other': '#6B7280',
    }
    return map[type] || '#6B7280'
  }

  return (
    <div className="page vc-page">

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="vc-header">
        <div className="vc-header-left">
          <span className="vc-eyebrow">BYU Football · Recruiting Ops</span>
          <h1 className="vc-title">Visit Calendar</h1>
        </div>
        <div className="vc-header-center">
          <button className="vc-nav-btn" onClick={() => setMonthCursor(prev => addMonths(prev, -1))}>
            <ChevronLeft size={16} />
          </button>
          <span className="vc-month-label">{monthLabel}</span>
          <button className="vc-nav-btn" onClick={() => setMonthCursor(prev => addMonths(prev, 1))}>
            <ChevronRight size={16} />
          </button>
          <button className="vc-today-btn" onClick={() => {
            setMonthCursor(startOfMonth(new Date()))
            setSelectedDate(new Date().toISOString().split('T')[0])
          }}>Today</button>
        </div>
        <div className="vc-header-right">
          {status && <span className="vc-status">{status}</span>}
          <button className="vc-schedule-btn" onClick={() => handleOpenForm(selectedDate)}>
            <Plus size={14} /> Schedule Visit
          </button>
        </div>
      </div>

      {/* ── BODY ─────────────────────────────────────────────────── */}
      <div className="vc-body">

        {/* Calendar Grid */}
        <div className="vc-grid-panel">
          <div className="vc-dow-row">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(dow => (
              <div key={dow} className="vc-dow">{dow}</div>
            ))}
          </div>
          <div className="vc-grid">
            {calendarDays.map(date => {
              const dateStr = date.toISOString().split('T')[0]
              const inMonth = date.getMonth() === monthCursor.getMonth()
              const isToday = dateStr === new Date().toISOString().split('T')[0]
              const dayEvents = eventsByDate[dateStr] || []
              const isSelected = dateStr === selectedDate
              return (
                <button
                  key={dateStr + String(date.getMonth())}
                  type="button"
                  className={[
                    'vc-day',
                    !inMonth ? 'vc-day-muted' : '',
                    isToday ? 'vc-day-today' : '',
                    isSelected ? 'vc-day-selected' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => handleDayClick(dateStr)}
                >
                  <span className="vc-day-num">{date.getDate()}</span>
                  <div className="vc-day-pills">
                    {dayEvents.slice(0, 2).map(evt => (
                      <span
                        key={evt.id}
                        className="vc-pill"
                        style={{ '--pill-color': visitTypeColor(evt.visit_type) }}
                        title={`${evt.visit_type}${evt.player_name ? ' · ' + evt.player_name : ''}`}
                      >
                        {evt.visit_type || 'Visit'}
                      </span>
                    ))}
                    {dayEvents.length > 2 && (
                      <span className="vc-pill-more">+{dayEvents.length - 2}</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="vc-sidebar">
          <div className="vc-sidebar-header">
            <div>
              <div className="vc-sidebar-weekday">
                {selectedDate
                  ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })
                  : 'Select a day'}
              </div>
              <div className="vc-sidebar-date">
                {selectedDate
                  ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                  : ''}
              </div>
            </div>
            <button className="vc-add-day-btn" onClick={() => handleOpenForm(selectedDate)}>
              <Plus size={13} />
            </button>
          </div>

          {selectedDayEvents.length === 0 ? (
            <div className="vc-sidebar-empty">
              <CalendarIcon size={28} strokeWidth={1.2} />
              <span>No visits scheduled</span>
            </div>
          ) : (
            <ul className="vc-event-list">
              {selectedDayEvents.map(evt => (
                <li key={evt.id} className="vc-event-card" style={{ '--evt-color': visitTypeColor(evt.visit_type) }}>
                  <div className="vc-event-type-bar" />
                  <div className="vc-event-body">
                    <div className="vc-event-top">
                      <span className="vc-event-type" style={{ color: visitTypeColor(evt.visit_type) }}>{evt.visit_type || 'Visit'}</span>
                      {evt.player_name && <span className="vc-event-player">{evt.player_name}</span>}
                    </div>
                    {evt.school && (
                      <div className="vc-event-meta"><GraduationCapIcon />{evt.school}</div>
                    )}
                    {evt.location && (
                      <div className="vc-event-meta"><MapPin size={11} />{evt.location}</div>
                    )}
                    {evt.notes && <p className="vc-event-notes">{evt.notes}</p>}
                    <div className="vc-event-footer">Added by {evt.created_by_name || 'Unknown'}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Legend */}
          <div className="vc-legend">
            {VISIT_TYPES.map(type => (
              <div key={type} className="vc-legend-item">
                <span className="vc-legend-dot" style={{ background: visitTypeColor(type) }} />
                <span className="vc-legend-label">{type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MODAL ─────────────────────────────────────────────────── */}
      {showForm && (
        <div className="vc-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className="vc-modal">
            <div className="vc-modal-header">
              <span className="vc-modal-title">Schedule Visit / Event</span>
              <button className="vc-modal-close" onClick={() => setShowForm(false)}>
                <X size={15} />
              </button>
            </div>
            <div className="vc-modal-body">
              <div className="vc-modal-grid">
                <label className="field">
                  Date
                  <input type="date" value={form.visit_date}
                    onChange={e => setForm(prev => ({ ...prev, visit_date: e.target.value }))} />
                </label>
                <label className="field">
                  Player
                  <select value={form.player_id}
                    onChange={e => setForm(prev => ({ ...prev, player_id: e.target.value }))}>
                    <option value="">Select player…</option>
                    {sortedPlayers.map(p => (
                      <option key={p.id} value={p.id}>{p.name}{p.school ? ` · ${p.school}` : ''}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Visit Type
                  <select value={form.visit_type}
                    onChange={e => setForm(prev => ({ ...prev, visit_type: e.target.value }))}>
                    {VISIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="field">
                  Location
                  <input type="text" value={form.location}
                    onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="BYU, high school, facility…" />
                </label>
                <label className="field" style={{ gridColumn: '1 / -1' }}>
                  Notes
                  <textarea rows={3} value={form.notes}
                    onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Key people, agenda, logistics…" />
                </label>
              </div>
            </div>
            <div className="vc-modal-footer">
              <button className="vc-modal-cancel" onClick={() => { resetForm(); setShowForm(false) }}>Cancel</button>
              <button className="vc-modal-submit" onClick={handleCreate}>Schedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GraduatedCapIcon() {
  return null
}

function GraduationCapIcon() {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>🎓</span>
}

export default VisitCalendar

