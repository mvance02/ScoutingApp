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

  return (
    <div className="page visit-calendar-page">
      <header className="page-header">
        <div>
          <h2>
            <CalendarIcon size={20} style={{ marginRight: 8 }} />
            Visit Calendar
          </h2>
          <p>Plan official/unofficial visits, practices, meetings, and more.</p>
        </div>
        <div className="visit-calendar-header-controls">
          <button
            className="btn-secondary"
            onClick={() => {
              setMonthCursor(startOfMonth(new Date()))
              setSelectedDate(new Date().toISOString().split('T')[0])
            }}
          >
            Today
          </button>
          <button className="btn-secondary" onClick={() => setMonthCursor((prev) => addMonths(prev, -1))}>
            <ChevronLeft size={16} />
          </button>
          <span className="visit-calendar-month-label">{monthLabel}</span>
          <button className="btn-secondary" onClick={() => setMonthCursor((prev) => addMonths(prev, 1))}>
            <ChevronRight size={16} />
          </button>
          <button className="btn-primary" onClick={() => handleOpenForm(selectedDate)}>
            <Plus size={16} /> Schedule
          </button>
        </div>
        {status && <span className="helper-text">{status}</span>}
      </header>

      <div className="visit-calendar-layout">
        <section className="panel visit-calendar-grid-panel">
          <div className="visit-calendar-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dow) => (
              <div key={dow} className="visit-calendar-dow">
                {dow}
              </div>
            ))}
            {calendarDays.map((date) => {
              const dateStr = date.toISOString().split('T')[0]
              const inMonth = date.getMonth() === monthCursor.getMonth()
              const isToday = dateStr === new Date().toISOString().split('T')[0]
              const dayEvents = eventsByDate[dateStr] || []
              const isSelected = dateStr === selectedDate
              return (
                <button
                  key={dateStr + String(date.getMonth())}
                  type="button"
                  className={`visit-calendar-day${inMonth ? '' : ' muted'}${
                    isToday ? ' today' : ''
                  }${isSelected ? ' selected' : ''}`}
                  onClick={() => handleDayClick(dateStr)}
                >
                  <div className="visit-calendar-day-header">
                    <span>{date.getDate()}</span>
                    {dayEvents.length > 0 && (
                      <span className="visit-calendar-day-count">{dayEvents.length}</span>
                    )}
                  </div>
                  <div className="visit-calendar-day-events">
                    {dayEvents.slice(0, 3).map((evt) => (
                      <span key={evt.id} className="visit-calendar-pill">
                        {evt.visit_type || 'Visit'}
                      </span>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="visit-calendar-more">+{dayEvents.length - 3} more</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <section className="panel visit-calendar-sidebar">
          <div className="visit-calendar-sidebar-header">
            <h3>
              {selectedDate
                ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Selected Day'}
            </h3>
            <button className="btn-ghost" onClick={() => handleOpenForm(selectedDate)}>
              <Plus size={14} /> Schedule
            </button>
          </div>
          {selectedDayEvents.length === 0 ? (
            <p className="empty-state">No events on this day yet.</p>
          ) : (
            <ul className="visit-calendar-event-list">
              {selectedDayEvents.map((evt) => (
                <li key={evt.id} className="visit-calendar-event">
                  <div className="visit-calendar-event-main">
                    <div className="visit-calendar-event-title">
                      <strong>{evt.visit_type || 'Visit'}</strong>
                      {evt.player_name && <span> · {evt.player_name}</span>}
                    </div>
                    {evt.school && (
                      <div className="visit-calendar-event-meta">
                        <GraduationCapIcon /> {evt.school}
                      </div>
                    )}
                    {evt.location && (
                      <div className="visit-calendar-event-meta">
                        <MapPin size={14} /> {evt.location}
                      </div>
                    )}
                    {evt.notes && <p className="visit-calendar-event-notes">{evt.notes}</p>}
                  </div>
                  <div className="visit-calendar-event-footer">
                    <span className="visit-calendar-event-created">
                      Added by {evt.created_by_name || 'Unknown'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h3>Schedule Visit / Event</h3>
              <button className="btn-ghost" onClick={() => setShowForm(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <label className="field">
                  Date
                  <input
                    type="date"
                    value={form.visit_date}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        visit_date: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="field">
                  Player
                  <select
                    value={form.player_id}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        player_id: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select player…</option>
                    {sortedPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.school ? `· ${p.school}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Type
                  <select
                    value={form.visit_type}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        visit_type: e.target.value,
                      }))
                    }
                  >
                    {VISIT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Location
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        location: e.target.value,
                      }))
                    }
                    placeholder="BYU, high school, facility, etc."
                  />
                </label>
                <label className="field" style={{ gridColumn: '1 / -1' }}>
                  Notes
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    placeholder="Key people to meet, agenda, logistics…"
                  />
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={handleCreate}>
                Schedule
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  resetForm()
                  setShowForm(false)
                }}
              >
                Cancel
              </button>
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

