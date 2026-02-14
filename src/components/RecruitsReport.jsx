import { useEffect, useMemo, useState } from 'react'
import { Plus, Save, Filter, FileText, Mail, Search } from 'lucide-react'
import { recruitReportsApi, recruitNotesApi, emailApi } from '../utils/api'
import { exportRecruitsReportPDF, exportRecruitsReportPDFBlob, exportRecruitsReportPDFByCoach } from '../utils/exportUtils'

const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'DE', 'LB', 'C', 'S', 'K', 'P']
const SIDE_OF_BALL = {
  OFFENSE: ['QB', 'RB', 'WR', 'TE', 'OL'],
  DEFENSE: ['DL', 'DE', 'LB', 'C', 'S'],
  SPECIAL: ['K', 'P'],
}

const COACH_MAP = {
  QB: 'Aaron Roderick',
  RB: 'Harvey Unga',
  WR: 'Fesi Sitake',
  TE: 'Kevin Gilbride',
  OL: 'TJ Woods',
  DL: "Sione Po'uha",
  DE: "Sione Po'uha",
  LB: "Kelly Poppinga / Chad Kauha'aha'a",
  C: 'Lewis Walker',
  S: 'Demario Warren',
  K: 'Justin Ena',
  P: 'Justin Ena',
}

const COACH_GROUPS = {
  QB: { label: `QB — ${COACH_MAP.QB}`, positions: ['QB'] },
  RB: { label: `RB — ${COACH_MAP.RB}`, positions: ['RB'] },
  WR: { label: `WR — ${COACH_MAP.WR}`, positions: ['WR'] },
  TE: { label: `TE — ${COACH_MAP.TE}`, positions: ['TE'] },
  OL: { label: `OL — ${COACH_MAP.OL}`, positions: ['OL'] },
  DL: { label: `DL/DE — ${COACH_MAP.DL}`, positions: ['DL', 'DE'] },
  LB: { label: `LB — ${COACH_MAP.LB}`, positions: ['LB'] },
  DB: { label: `C/S — ${COACH_MAP.C} / ${COACH_MAP.S}`, positions: ['C', 'S'] },
  ST: { label: `K/P — ${COACH_MAP.K}`, positions: ['K', 'P'] },
}

const STAT_FIELDS = {
  QB: [
    ['passComp', 'Pass Comp'],
    ['passAtt', 'Pass Att'],
    ['completionPct', 'Comp %'],
    ['passYards', 'Pass Yds'],
    ['passTD', 'Pass TD'],
    ['rushYards', 'Rush Yds'],
    ['rushTD', 'Rush TD'],
    ['interceptions', 'INT'],
    ['fumbles', 'Fumbles'],
  ],
  RB: [
    ['carries', 'Carries'],
    ['rushYds', 'Rush Yds'],
    ['rushTD', 'Rush TD'],
    ['receptions', 'Receptions'],
    ['recYds', 'Rec Yds'],
    ['recTD', 'Rec TD'],
    ['fumbles', 'Fumbles'],
  ],
  WR: [
    ['receptions', 'Receptions'],
    ['recYds', 'Rec Yds'],
    ['recTD', 'Rec TD'],
    ['carries', 'Carries'],
    ['rushYds', 'Rush Yds'],
    ['rushTD', 'Rush TD'],
    ['fumbles', 'Fumbles'],
  ],
  TE: [
    ['receptions', 'Receptions'],
    ['recYds', 'Rec Yds'],
    ['tds', 'TD'],
    ['fumbles', 'Fumbles'],
  ],
  OL: [],
  DL: [
    ['tackles', 'Tackles'],
    ['tfl', 'TFL'],
    ['pbu', 'PBU'],
    ['sack', 'Sack'],
    ['ff', 'FF'],
  ],
  DE: [
    ['tackles', 'Tackles'],
    ['tfl', 'TFL'],
    ['pbu', 'PBU'],
    ['sack', 'Sack'],
    ['ff', 'FF'],
  ],
  LB: [
    ['tackles', 'Tkl'],
    ['pbu', 'PBU'],
    ['ff', 'FF'],
    ['interceptions', 'INT'],
    ['sack', 'Sack'],
    ['tfl', 'TFL'],
  ],
  S: [
    ['pbu', 'PBU'],
    ['tackles', 'Tkl'],
    ['interceptions', 'INT'],
  ],
  C: [
    ['pbu', 'PBU'],
    ['tackles', 'Tkl'],
    ['interceptions', 'INT'],
  ],
  K: [
    ['patAtt', 'PAT Att'],
    ['patMade', 'PAT Made'],
    ['fgAtt', 'FG Att'],
    ['fgMade', 'FG Made'],
  ],
  P: [
    ['punts', 'Punts'],
    ['netAvg', 'Net Avg'],
  ],
}

function toTitleCase(str) {
  return String(str)
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const NOTE_SOURCES = ['247Sports', 'ON3', 'Rivals', 'ESPN', 'X', 'Instagram']
const STATUS_OPTIONS = [
  'COMMITTED',
  'OFFERED',
  'COMMITTED ELSEWHERE',
  'RECRUIT',
  'EVALUATED',
  'SIGNED',
  'PASSED',
  'WATCHING',
]

function getWeekStart(dateStr) {
  const date = new Date(dateStr + 'T00:00:00')
  const day = date.getDay()
  const diff = (day - 2 + 7) % 7
  date.setDate(date.getDate() - diff)
  return date.toISOString().split('T')[0]
}

function getWeekEnd(weekStart) {
  const date = new Date(weekStart + 'T00:00:00')
  date.setDate(date.getDate() + 5)
  return date.toISOString().split('T')[0]
}

function dateToWeekKey(dateStr) {
  const date = new Date(dateStr + 'T00:00:00')
  const day = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - day + 3)
  const firstThursday = new Date(date.getFullYear(), 0, 4)
  const week = 1 + Math.round(
    ((date - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7
  )
  const year = date.getFullYear()
  return `${year}-W${String(week).padStart(2, '0')}`
}

function weekKeyToTuesday(weekKey) {
  const [yearStr, weekStr] = weekKey.split('-W')
  const year = Number(yearStr)
  const week = Number(weekStr)
  const jan4 = new Date(year, 0, 4)
  const jan4Day = (jan4.getDay() + 6) % 7
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - jan4Day + (week - 1) * 7)
  const tuesday = new Date(monday)
  tuesday.setDate(monday.getDate() + 1)
  return tuesday.toISOString().split('T')[0]
}

function RecruitsReport() {
  const [weekKey, setWeekKey] = useState(dateToWeekKey(new Date().toISOString().split('T')[0]))
  const weekStart = weekKeyToTuesday(weekKey)
  const weekEnd = getWeekEnd(weekStart)

  const [recruits, setRecruits] = useState([])
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    side: 'All',
    position: 'All',
    coach: 'All',
  })
  const [selectedStatuses, setSelectedStatuses] = useState([])
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)

  const [coachEmailOpen, setCoachEmailOpen] = useState(false)
  const [selectedCoaches, setSelectedCoaches] = useState(Object.keys(COACH_GROUPS))

  const [drafts, setDrafts] = useState({})

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { recruits: reportRecruits, notes: reportNotes } =
          await recruitReportsApi.getForWeek(weekStart)
        setRecruits(reportRecruits)
        setNotes(reportNotes)
        const initialDrafts = {}
        reportRecruits.forEach((rec) => {
          initialDrafts[rec.id] = {
            last_game_date: rec.last_game_date || '',
            last_game_opponent: rec.last_game_opponent || '',
            last_game_score: rec.last_game_score || '',
            last_game_result: rec.last_game_result || '',
            next_game_date: rec.next_game_date || '',
            next_game_time: rec.next_game_time || '',
            next_game_opponent: rec.next_game_opponent || '',
            next_game_location: rec.next_game_location || '',
            stats: rec.stats || {},
            other_stats: rec.other_stats || [],
            report_notes: rec.report_notes || '',
          }
        })
        setDrafts(initialDrafts)
      } catch (err) {
        console.error('Report load error:', err)
        setStatus('Failed to load report')
        setTimeout(() => setStatus(''), 3000)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [weekStart])

  const notesByRecruit = useMemo(() => {
    const map = {}
    notes.forEach((note) => {
      if (!map[note.recruit_id]) map[note.recruit_id] = []
      map[note.recruit_id].push(note)
    })
    return map
  }, [notes])

  const positionsAvailable = useMemo(() => {
    const set = new Set(recruits.map((r) => r.position).filter(Boolean))
    return ['All', ...POSITION_ORDER.filter((p) => set.has(p))]
  }, [recruits])

  const statusesAvailable = useMemo(() => {
    return ['All', ...STATUS_OPTIONS]
  }, [])

  const coachesAvailable = useMemo(() => {
    const set = new Set(recruits.map((r) => r.assigned_coach).filter(Boolean))
    return ['All', ...Array.from(set)]
  }, [recruits])

  const filteredRecruits = useMemo(() => {
    const q = search.toLowerCase().trim()
    return recruits.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !(r.school || '').toLowerCase().includes(q)) return false
      if (filters.side !== 'All' && r.side_of_ball !== filters.side) return false
      if (filters.position !== 'All' && r.position !== filters.position) return false
      if (selectedStatuses.length > 0) {
        const list = r.status_list || r.recruiting_statuses || []
        const normalized = Array.isArray(list) ? list : [list]
        const effective = normalized.length > 0 ? normalized : (r.status ? [r.status] : [])
        if (!effective.some((status) => selectedStatuses.includes(status))) return false
      }
      if (filters.coach !== 'All' && r.assigned_coach !== filters.coach) return false
      return true
    })
  }, [recruits, filters, search, selectedStatuses])

  const groupedRecruits = useMemo(() => {
    const groups = { OFFENSE: {}, DEFENSE: {}, SPECIAL: {} }
    filteredRecruits.forEach((rec) => {
      let side = 'SPECIAL'
      if (SIDE_OF_BALL.OFFENSE.includes(rec.position)) side = 'OFFENSE'
      else if (SIDE_OF_BALL.DEFENSE.includes(rec.position)) side = 'DEFENSE'
      groups[side][rec.position] = groups[side][rec.position] || []
      groups[side][rec.position].push(rec)
    })
    return groups
  }, [filteredRecruits])

  const handleDraftChange = (recruitId, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [recruitId]: {
        ...prev[recruitId],
        [field]: value,
      },
    }))
  }

  const handleStatChange = (recruitId, key, value) => {
    setDrafts((prev) => ({
      ...prev,
      [recruitId]: {
        ...prev[recruitId],
        stats: {
          ...(prev[recruitId]?.stats || {}),
          [key]: value,
        },
      },
    }))
  }

  const addOtherStat = (recruitId) => {
    setDrafts((prev) => ({
      ...prev,
      [recruitId]: {
        ...prev[recruitId],
        other_stats: [...(prev[recruitId]?.other_stats || []), { label: '', value: '' }],
      },
    }))
  }

  const updateOtherStat = (recruitId, index, key, value) => {
    setDrafts((prev) => {
      const existing = prev[recruitId]?.other_stats || []
      const next = existing.map((item, idx) =>
        idx === index ? { ...item, [key]: value } : item
      )
      return {
        ...prev,
        [recruitId]: {
          ...prev[recruitId],
          other_stats: next,
        },
      }
    })
  }

  const handleSaveReport = async (recruit) => {
    const draft = drafts[recruit.id]
    if (!draft) return
    setStatus('Saving report...')
    try {
      await recruitReportsApi.upsert(recruit.id, {
        week_start_date: weekStart,
        week_end_date: weekEnd,
        ...draft,
      })
      setStatus('Saved')
      setTimeout(() => setStatus(''), 2000)
    } catch (err) {
      console.error('Save error:', err)
      setStatus(err?.message || 'Save failed')
      setTimeout(() => setStatus(''), 3000)
    }
  }

  const handleAddNote = async (recruitId, noteForm, reset) => {
    setStatus('Saving note...')
    try {
      const created = await recruitNotesApi.create({
        recruit_id: recruitId,
        week_start_date: weekStart,
        note_date: noteForm.note_date,
        source: noteForm.source,
        link: noteForm.link,
        summary: noteForm.summary,
        quote: noteForm.quote,
      })
      setNotes((prev) => [created, ...prev])
      reset()
      setStatus('Note added')
      setTimeout(() => setStatus(''), 2000)
    } catch (err) {
      console.error('Note error:', err)
      setStatus(err?.message || 'Note failed')
      setTimeout(() => setStatus(''), 3000)
    }
  }

  const handleExportPDF = async () => {
    setStatus('Generating PDF...')
    try {
      await exportRecruitsReportPDF(filteredRecruits, notes, weekStart, weekEnd)
      setStatus('PDF downloaded!')
      setTimeout(() => setStatus(''), 2000)
    } catch (err) {
      console.error('Export error:', err)
      setStatus(err?.message || 'Export failed')
      setTimeout(() => setStatus(''), 3000)
    }
  }

  const handleEmailReport = async () => {
    setStatus('Sending report email...')
    try {
      const blob = await exportRecruitsReportPDFBlob(filteredRecruits, notes, weekStart, weekEnd)
      const buffer = await blob.arrayBuffer()
      await emailApi.sendRecruitsReport({
        weekStart,
        attachment: {
          filename: `recruits_report_${weekStart}.pdf`,
          data: btoa(String.fromCharCode(...new Uint8Array(buffer))),
        },
      })
      setStatus('Email sent!')
      setTimeout(() => setStatus(''), 2000)
    } catch (err) {
      console.error('Email error:', err)
      setStatus(err?.message || 'Email failed')
      setTimeout(() => setStatus(''), 3000)
    }
  }

  const handleEmailCoaches = async () => {
    if (selectedCoaches.length === 0) {
      setStatus('Select at least one coach')
      setTimeout(() => setStatus(''), 2000)
      return
    }
    setStatus('Generating per-coach PDFs...')
    try {
      const allOutputs = await exportRecruitsReportPDFByCoach(filteredRecruits, notes, weekStart, weekEnd)
      const selected = allOutputs.filter((o) => selectedCoaches.includes(o.positionGroup))
      if (selected.length === 0) {
        setStatus('No recruits found for selected coaches')
        setTimeout(() => setStatus(''), 3000)
        return
      }
      setStatus(`Sending ${selected.length} email(s)...`)
      const attachments = await Promise.all(
        selected.map(async (o) => {
          const buffer = await o.blob.arrayBuffer()
          return {
            positionGroup: o.positionGroup,
            filename: o.filename,
            data: btoa(String.fromCharCode(...new Uint8Array(buffer))),
          }
        })
      )
      await emailApi.sendRecruitsReportByCoach({ weekStart, attachments })
      setStatus(`Sent ${selected.length} coach email(s)!`)
      setTimeout(() => setStatus(''), 3000)
    } catch (err) {
      console.error('Coach email error:', err)
      setStatus(err?.message || 'Coach email failed')
      setTimeout(() => setStatus(''), 3000)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p>Loading recruits report...</p>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h2>Recruits Report</h2>
          <p>Weekly report window: {weekStart} to {weekEnd} (Stats on Saturday).</p>
        </div>
        <div className="action-row">
          <button className="btn-secondary" onClick={handleExportPDF}>
            <FileText size={16} /> Export PDF
          </button>
          <button className="btn-secondary" onClick={handleEmailReport}>
            <Mail size={16} /> Email
          </button>
          <button
            className={`btn-secondary${coachEmailOpen ? ' active' : ''}`}
            onClick={() => setCoachEmailOpen((prev) => !prev)}
          >
            <Mail size={16} /> Email Coaches
          </button>
        </div>
        {status ? <span className="helper-text">{status}</span> : null}
      </header>

      {coachEmailOpen && (
        <section className="panel coach-email-panel">
          <h4>Send to Position Coaches</h4>
          <div className="coach-select-actions">
            <button
              className="btn-ghost"
              onClick={() => setSelectedCoaches(Object.keys(COACH_GROUPS))}
            >
              Select All
            </button>
            <button
              className="btn-ghost"
              onClick={() => setSelectedCoaches([])}
            >
              Deselect All
            </button>
          </div>
          <div className="coach-checkboxes">
            {Object.entries(COACH_GROUPS).map(([key, { label }]) => (
              <label key={key} className="coach-checkbox">
                <input
                  type="checkbox"
                  checked={selectedCoaches.includes(key)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedCoaches((prev) => [...prev, key])
                    } else {
                      setSelectedCoaches((prev) => prev.filter((k) => k !== key))
                    }
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <button className="btn-primary" onClick={handleEmailCoaches}>
            <Mail size={16} /> Send to {selectedCoaches.length} Coach{selectedCoaches.length !== 1 ? 'es' : ''}
          </button>
        </section>
      )}

      <section className="panel">
        <div className="report-controls">
          <label className="field">
            Week (Tuesday–Monday)
            <input type="week" value={weekKey} onChange={(e) => setWeekKey(e.target.value)} />
          </label>
          <div className="filter-row">
            <Search size={16} />
            <input className="filter-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search player or school..." />
            <Filter size={16} />
            <select value={filters.side} onChange={(e) => setFilters((prev) => ({ ...prev, side: e.target.value }))}>
              <option value="All">All Sides</option>
              <option value="OFFENSE">Offense</option>
              <option value="DEFENSE">Defense</option>
              <option value="SPECIAL">Special Teams</option>
            </select>
            <select value={filters.position} onChange={(e) => setFilters((prev) => ({ ...prev, position: e.target.value }))}>
              {positionsAvailable.map((pos) => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
            <div className="status-filter">
              <button
                type="button"
                className={`btn-ghost status-filter-trigger${statusDropdownOpen ? ' active' : ''}`}
                onClick={() => setStatusDropdownOpen((prev) => !prev)}
              >
                Statuses
                {selectedStatuses.length > 0 ? ` (${selectedStatuses.length})` : ''}
              </button>
              {statusDropdownOpen ? (
                <div className="status-filter-menu">
                  <label className="status-filter-option">
                    <input
                      type="checkbox"
                      checked={selectedStatuses.length === 0}
                      onChange={() => setSelectedStatuses([])}
                    />
                    <span>All</span>
                  </label>
                  {statusesAvailable.filter((s) => s !== 'All').map((statusOpt) => (
                    <label key={statusOpt} className="status-filter-option">
                      <input
                        type="checkbox"
                        checked={selectedStatuses.includes(statusOpt)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStatuses((prev) => [...prev, statusOpt])
                          } else {
                            setSelectedStatuses((prev) => prev.filter((item) => item !== statusOpt))
                          }
                        }}
                      />
                      <span>{statusOpt}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
            <select value={filters.coach} onChange={(e) => setFilters((prev) => ({ ...prev, coach: e.target.value }))}>
              {coachesAvailable.map((coach) => (
                <option key={coach} value={coach}>{coach}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {['OFFENSE', 'DEFENSE', 'SPECIAL'].map((side) => (
        <section key={side} className="panel">
          <h3>{side}</h3>
          {POSITION_ORDER.filter((pos) => (side === 'OFFENSE' ? SIDE_OF_BALL.OFFENSE : side === 'DEFENSE' ? SIDE_OF_BALL.DEFENSE : SIDE_OF_BALL.SPECIAL).includes(pos))
            .map((pos) => {
              const list = groupedRecruits[side][pos] || []
              if (list.length === 0) return null
              return (
                <div key={pos} className="position-group">
                  <h4>{pos}</h4>
                  <div className="recruit-grid">
                    {list.map((rec) => (
                      <RecruitCard
                        key={rec.id}
                        recruit={rec}
                        draft={drafts[rec.id] || {}}
                        statsSchema={STAT_FIELDS[rec.position] || []}
                        notes={notesByRecruit[rec.id] || []}
                        onDraftChange={handleDraftChange}
                        onStatChange={handleStatChange}
                        onAddOtherStat={addOtherStat}
                        onUpdateOtherStat={updateOtherStat}
                        onSave={handleSaveReport}
                        onAddNote={handleAddNote}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
        </section>
      ))}
    </div>
  )
}

function RecruitCard({
  recruit,
  draft,
  statsSchema,
  notes,
  onDraftChange,
  onStatChange,
  onAddOtherStat,
  onUpdateOtherStat,
  onSave,
  onAddNote,
}) {
  const [editingGameInfo, setEditingGameInfo] = useState(false)
  const [editingStats, setEditingStats] = useState(false)
  const [addingNote, setAddingNote] = useState(false)
  const [noteForm, setNoteForm] = useState({
    note_date: '',
    source: NOTE_SOURCES[0],
    link: '',
    summary: '',
    quote: '',
  })

  const statusList = (() => {
    const list = recruit.status_list || recruit.recruiting_statuses || []
    const normalized = (Array.isArray(list) ? list : [list])
      .map((s) => (s || '').trim())
      .filter(Boolean)
    if (normalized.length > 0) return normalized
    return recruit.status ? [recruit.status] : []
  })()

  const hasCommittedElsewhere =
    statusList.includes('COMMITTED ELSEWHERE') || statusList.includes('Committed Elsewhere')

  const resetNote = () =>
    setNoteForm({ note_date: '', source: NOTE_SOURCES[0], link: '', summary: '', quote: '' })

  return (
    <div className="recruit-card">
      <div className="recruit-header">
        <div>
          <strong>{recruit.name}</strong>
          <span>{recruit.school} ({recruit.state || '-'}) · {recruit.class_year || '-'}</span>
          <div className="status-row">
            {statusList.length > 0 ? (
              <div className="status-list">
                {statusList.map((status) => (
                  <span
                    key={status}
                    className={`status-badge status-${String(status).toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {toTitleCase(status)}
                  </span>
                ))}
              </div>
            ) : null}
            {hasCommittedElsewhere && recruit.committed_school ? (
              <span className="status-detail">
                Committed to {recruit.committed_school}
                {recruit.committed_date ? ` on ${String(recruit.committed_date).split('T')[0]}` : ''}
              </span>
            ) : null}
            <span>Coach: {recruit.assigned_coach || COACH_MAP[recruit.position]}</span>
          </div>
        </div>
        <button className="btn-secondary" onClick={() => onSave(recruit)}>
          <Save size={14} /> Save
        </button>
      </div>

      {editingGameInfo ? (
        <div className="form-grid">
          <label className="field">Last Game Date<input value={draft.last_game_date || ''} onChange={(e) => onDraftChange(recruit.id, 'last_game_date', e.target.value)} type="date" /></label>
          <label className="field">Last Game Opponent<input value={draft.last_game_opponent || ''} onChange={(e) => onDraftChange(recruit.id, 'last_game_opponent', e.target.value)} /></label>
          <label className="field">Score<input value={draft.last_game_score || ''} onChange={(e) => onDraftChange(recruit.id, 'last_game_score', e.target.value)} /></label>
          <label className="field">Result<input value={draft.last_game_result || ''} onChange={(e) => onDraftChange(recruit.id, 'last_game_result', e.target.value)} placeholder="Win/Loss" /></label>
          <label className="field">Next Game Date<input value={draft.next_game_date || ''} onChange={(e) => onDraftChange(recruit.id, 'next_game_date', e.target.value)} type="date" /></label>
          <label className="field">Next Game Time<input value={draft.next_game_time || ''} onChange={(e) => onDraftChange(recruit.id, 'next_game_time', e.target.value)} /></label>
          <label className="field">Next Opponent<input value={draft.next_game_opponent || ''} onChange={(e) => onDraftChange(recruit.id, 'next_game_opponent', e.target.value)} /></label>
          <label className="field">Next Game Location<input value={draft.next_game_location || ''} onChange={(e) => onDraftChange(recruit.id, 'next_game_location', e.target.value)} placeholder="vs/@"/></label>
        </div>
      ) : (
        <div className="game-info-display">
          <div className="game-info-row">
            <span className="game-info-label">Last Game</span>
            <span className="game-info-value">
              {draft.last_game_date || draft.last_game_opponent
                ? `${draft.last_game_date || ''} ${draft.last_game_opponent ? 'vs ' + draft.last_game_opponent : ''} ${draft.last_game_score || ''} ${draft.last_game_result || ''}`.trim()
                : '-'}
            </span>
          </div>
          <div className="game-info-row">
            <span className="game-info-label">Next Game</span>
            <span className="game-info-value">
              {draft.next_game_date || draft.next_game_opponent
                ? `${draft.next_game_date || ''} ${draft.next_game_location ? draft.next_game_location + ' ' : ''}${draft.next_game_time ? draft.next_game_time + ' ' : ''}${draft.next_game_opponent ? 'vs ' + draft.next_game_opponent : ''}`.trim()
                : '-'}
            </span>
          </div>
        </div>
      )}
      <button className={`btn-outline${editingGameInfo ? ' active' : ''}`} onClick={() => setEditingGameInfo((prev) => !prev)}>
        {editingGameInfo ? 'Done Editing Game Info' : 'Edit Game Info'}
      </button>

      <div className="stats-grid">
        {statsSchema.length === 0 ? (
          <p className="helper-text">No structured stats for this position.</p>
        ) : editingStats ? (
          statsSchema.map(([key, label]) => (
            <label key={key} className="field">
              {label}
              <input
                value={draft.stats?.[key] ?? ''}
                onChange={(e) => onStatChange(recruit.id, key, e.target.value)}
              />
            </label>
          ))
        ) : (
          statsSchema.map(([key, label]) => {
            let value = draft.stats?.[key]
            if (key === 'completionPct' && (value === undefined || value === '' || value === null)) {
              const comp = Number(draft.stats?.passComp || 0)
              const att = Number(draft.stats?.passAtt || 0)
              value = att > 0 ? Math.round((comp / att) * 100) : 0
            }
            return (
              <div key={key} className="stat-pill">
                <span>{label}</span>
                <strong>{value ?? '-'}</strong>
              </div>
            )
          })
        )}
      </div>

      {statsSchema.length > 0 ? (
        <button className={`btn-outline${editingStats ? ' active' : ''}`} onClick={() => setEditingStats((prev) => !prev)}>
          {editingStats ? 'Done Editing Stats' : 'Edit Stats'}
        </button>
      ) : null}

      <div className="other-stats">
        <div className="other-stats-header">
          <strong>Additional Stats</strong>
          {editingStats ? (
            <button className="btn-ghost" onClick={() => onAddOtherStat(recruit.id)}>
              <Plus size={14} /> Add
            </button>
          ) : null}
        </div>
        {!editingStats && (draft.other_stats || []).length === 0 ? (
          <p className="helper-text">No extra stats yet.</p>
        ) : null}
        {editingStats
          ? (draft.other_stats || []).map((stat, idx) => (
              <div key={`${recruit.id}-other-${idx}`} className="other-stat-row">
                <input
                  placeholder="Label"
                  value={stat.label || ''}
                  onChange={(e) => onUpdateOtherStat(recruit.id, idx, 'label', e.target.value)}
                />
                <input
                  placeholder="Value"
                  value={stat.value || ''}
                  onChange={(e) => onUpdateOtherStat(recruit.id, idx, 'value', e.target.value)}
                />
              </div>
            ))
          : (draft.other_stats || []).map((stat, idx) => (
              <div key={`${recruit.id}-other-${idx}`} className="stat-pill">
                <span>{stat.label || 'Stat'}</span>
                <strong>{stat.value || '-'}</strong>
              </div>
            ))}
      </div>

      <label className="field">
        Report Notes
        <textarea
          value={draft.report_notes || ''}
          onChange={(e) => onDraftChange(recruit.id, 'report_notes', e.target.value)}
        />
      </label>

      <div className="notes-section">
        <div className="notes-header">
          <strong>Notes / Articles</strong>
          <button className={`btn-outline${addingNote ? ' active' : ''}`} onClick={() => setAddingNote((prev) => !prev)}>
            <Plus size={14} /> {addingNote ? 'Cancel' : 'Add Note / Article'}
          </button>
        </div>
        {addingNote ? (
          <>
            <div className="form-grid">
              <label className="field">Date<input type="date" value={noteForm.note_date} onChange={(e) => setNoteForm((prev) => ({ ...prev, note_date: e.target.value }))} /></label>
              <label className="field">Source
                <select value={NOTE_SOURCES.includes(noteForm.source) ? noteForm.source : 'Other'} onChange={(e) => setNoteForm((prev) => ({ ...prev, source: e.target.value === 'Other' ? '' : e.target.value }))}>
                  {NOTE_SOURCES.map((src) => <option key={src} value={src}>{src}</option>)}
                  <option value="Other">Other</option>
                </select>
              </label>
              {!NOTE_SOURCES.includes(noteForm.source) ? (
                <label className="field">Custom Source<input value={noteForm.source} onChange={(e) => setNoteForm((prev) => ({ ...prev, source: e.target.value }))} placeholder="Enter source name" /></label>
              ) : null}
              <label className="field field-wide">Link<input value={noteForm.link} onChange={(e) => setNoteForm((prev) => ({ ...prev, link: e.target.value }))} /></label>
              <label className="field field-wide">Summary<input value={noteForm.summary} onChange={(e) => setNoteForm((prev) => ({ ...prev, summary: e.target.value }))} /></label>
              <label className="field field-wide">Quote<input value={noteForm.quote} onChange={(e) => setNoteForm((prev) => ({ ...prev, quote: e.target.value }))} /></label>
            </div>
            <button className="btn-primary" onClick={() => { onAddNote(recruit.id, noteForm, resetNote); setAddingNote(false) }}>
              <Plus size={14} /> Save Note
            </button>
          </>
        ) : null}
        {notes.length > 0 ? (
          <ul className="list">
            {notes.map((note) => (
              <li key={note.id} className="list-item">
                <div>
                  <strong>{(note.note_date || '').split('T')[0]} · {note.source}</strong>
                  <span>{note.summary}</span>
                  {note.link ? <a className="link" href={note.link} target="_blank" rel="noreferrer">{note.link}</a> : null}
                  {note.quote ? <span>"{note.quote}"</span> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}

export default RecruitsReport
