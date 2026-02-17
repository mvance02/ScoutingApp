import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Pencil, BarChart3, Calendar, MapPin, GraduationCap, Shield, Target, Trophy, Users, TrendingUp, CheckCircle, XCircle } from 'lucide-react'
import { loadPlayers, loadGames, loadAllStats } from '../utils/storage'
import { gradesApi, playersApi } from '../utils/api'
import StatTrendChart from './StatTrendChart'
import PlayerComments from './PlayerComments'
import PlayerVisits from './PlayerVisits'
import CompositeRatingTrend from './CompositeRatingTrend'
import byuLogo from '../assets/byu-logo.png'

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'grades', label: 'Game Grades' },
  { id: 'stats', label: 'Stats' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'comments', label: 'Comments' },
  { id: 'visits', label: 'Visits' },
  { id: 'rating', label: 'Rating' },
]

function getGradeColor(grade) {
  if (!grade) return ''
  const letter = grade.charAt(0).toUpperCase()
  if (letter === 'A') return 'grade-a'
  if (letter === 'B') return 'grade-b'
  if (letter === 'C') return 'grade-c'
  return 'grade-d'
}

function getStatusColor(status) {
  const colors = {
    Watching: '#6b7280',
    Evaluating: '#3b82f6',
    Interested: '#8b5cf6',
    Offered: '#f59e0b',
    Committed: '#16a34a',
    'Committed Elsewhere': '#ef4444',
    Signed: '#059669',
    Passed: '#9ca3af',
  }
  return colors[status] || '#6b7280'
}

function PlayerProfile() {
  const { playerId } = useParams()
  const [player, setPlayer] = useState(null)
  const [games, setGames] = useState([])
  const [stats, setStats] = useState([])
  const [grades, setGrades] = useState([])
  const [statusHistory, setStatusHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('overview')
  const sectionRefs = useRef({})

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const [playersResult, gamesResult, statsResult, gradesResult, historyResult] = await Promise.all([
        loadPlayers().catch(() => []),
        loadGames().catch(() => []),
        loadAllStats(playerId).catch(() => []),
        gradesApi.getForPlayer(playerId).catch(() => []),
        playersApi.getStatusHistory(playerId).catch(() => []),
      ])

      const foundPlayer = playersResult.find((p) => String(p.id) === String(playerId))
      setPlayer(foundPlayer || null)
      setGames(gamesResult)
      setStats(statsResult)
      setGrades(gradesResult)
      setStatusHistory(historyResult)
      setLoading(false)
    }
    fetchData()
  }, [playerId])

  const scrollToSection = (sectionId) => {
    setActiveSection(sectionId)
    const el = sectionRefs.current[sectionId]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Compute career totals & derived stats (same logic as PlayerStats)
  const careerTotals = useMemo(() => {
    const totals = {}
    stats.forEach((stat) => {
      const type = stat.statType
      totals[type] = (totals[type] || 0) + Number(stat.value || 0)
    })
    return totals
  }, [stats])

  const derivedStats = useMemo(() => {
    const rushingYards = (careerTotals['Rush'] || 0) + (careerTotals['Rush TD'] || 0)
    const receivingYards = (careerTotals['Reception'] || 0) + (careerTotals['Rec TD'] || 0)
    const returnYards = careerTotals['Return'] || 0
    const totalYards = rushingYards + receivingYards + returnYards
    const rushingTDs = stats.filter((s) => s.statType === 'Rush TD').length
    const receivingTDs = stats.filter((s) => s.statType === 'Rec TD').length
    const passingTDs = stats.filter((s) => s.statType === 'Pass TD').length
    const tackles = (careerTotals['Tackle Solo'] || 0) + (careerTotals['Tackle Assist'] || 0)
    const sacks = careerTotals['Sack'] || 0
    const ints = careerTotals['INT'] || 0
    return { totalYards, rushingYards, receivingYards, returnYards, rushingTDs, receivingTDs, passingTDs, tackles, sacks, ints }
  }, [stats, careerTotals])

  const gameBreakdown = useMemo(() => {
    const byGame = {}
    stats.forEach((stat) => {
      const gId = stat.gameId || stat.game_id
      if (!byGame[gId]) byGame[gId] = { gameId: gId, stats: {} }
      const type = stat.statType
      byGame[gId].stats[type] = (byGame[gId].stats[type] || 0) + Number(stat.value || 0)
    })
    return Object.values(byGame).map((entry) => {
      const game = games.find((g) => String(g.id) === String(entry.gameId))
      const t = entry.stats
      const rushYards = (t['Rush'] || 0) + (t['Rush TD'] || 0)
      const recYards = (t['Reception'] || 0) + (t['Rec TD'] || 0)
      const totalYards = rushYards + recYards + (t['Return'] || 0)
      return {
        gameId: entry.gameId,
        opponent: game?.opponent || 'Unknown',
        date: game?.date || '',
        totalYards,
        rushYards,
        recYards,
        tackles: (t['Tackle Solo'] || 0) + (t['Tackle Assist'] || 0),
        ints: t['INT'] || 0,
        sacks: t['Sack'] || 0,
        tds: stats.filter(
          (s) =>
            (s.gameId === entry.gameId || s.game_id === entry.gameId) &&
            (s.statType === 'Rush TD' || s.statType === 'Rec TD' || s.statType === 'TD')
        ).length || 0,
      }
    }).sort((a, b) => {
      if (!a.date && !b.date) return 0
      if (!a.date) return 1
      if (!b.date) return -1
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
  }, [stats, games])

  const gamesPlayed = gameBreakdown.length

  // Average grade
  const averageGrade = useMemo(() => {
    const graded = grades.filter((g) => g.grade)
    if (graded.length === 0) return null
    const gradeValues = { A: 4, 'A+': 4.3, 'A-': 3.7, B: 3, 'B+': 3.3, 'B-': 2.7, C: 2, 'C+': 2.3, 'C-': 1.7, D: 1, 'D+': 1.3, 'D-': 0.7, F: 0 }
    const sum = graded.reduce((acc, g) => acc + (gradeValues[g.grade] ?? 2), 0)
    const avg = sum / graded.length
    if (avg >= 3.7) return 'A'
    if (avg >= 2.7) return 'B'
    if (avg >= 1.7) return 'C'
    if (avg >= 0.7) return 'D'
    return 'F'
  }, [grades])

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <p>Loading player profile...</p>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="page" style={{ textAlign: 'center', padding: '80px 0' }}>
        <h2>Player Not Found</h2>
        <p style={{ marginTop: '8px', color: 'var(--color-text-muted)' }}>This player does not exist or has been removed.</p>
        <Link to="/players" className="btn-primary" style={{ display: 'inline-flex', marginTop: '16px' }}>
          <ArrowLeft size={16} /> Back to Players
        </Link>
      </div>
    )
  }

  const positions = [player.position, player.offensePosition, player.defensePosition].filter(Boolean).join(' / ')
  const playerPosition = player.position || player.offensePosition || player.defensePosition

  return (
    <div className="page" style={{ padding: 0, maxWidth: '100%' }}>
      {/* Hero Header */}
      <div className="profile-hero">
        <div className="profile-hero-inner">
          <div className="profile-hero-avatar">
            {player.profilePictureUrl ? (
              <img src={player.profilePictureUrl} alt={player.name} />
            ) : (
              <div className="profile-hero-avatar-placeholder">
                <img src={byuLogo} alt="BYU" />
              </div>
            )}
          </div>
          <div className="profile-hero-info">
            <h1 className="profile-hero-name">{player.name}</h1>
            <div className="profile-hero-meta">
              {positions && <span><Shield size={14} /> {positions}</span>}
              {player.school && <span><GraduationCap size={14} /> {player.school}</span>}
              {player.state && <span><MapPin size={14} /> {player.state}</span>}
              {player.gradYear && <span><Calendar size={14} /> Class of {player.gradYear}</span>}
            </div>
            <div className="profile-hero-badges">
              {player.compositeRating != null && !isNaN(parseFloat(player.compositeRating)) && (
                <span className="profile-rating-badge">
                  {parseFloat(player.compositeRating).toFixed(2)}
                </span>
              )}
              {(player.recruitingStatuses || ['Watching']).map((status) => (
                <span
                  key={status}
                  className="profile-status-badge"
                  style={{ background: getStatusColor(status) }}
                >
                  {status}
                </span>
              ))}
              {player.cutUpCompleted && (
                <span className="profile-status-badge" style={{ background: '#059669' }}>
                  Cut Up Done
                </span>
              )}
            </div>
            {(player.recruitingStatuses || []).includes('Committed Elsewhere') && player.committedSchool && (
              <div className="profile-hero-committed">
                Committed to {player.committedSchool}
                {player.committedDate ? ` on ${String(player.committedDate).split('T')[0]}` : ''}
              </div>
            )}
          </div>
          <div className="profile-hero-actions">
            <Link to="/players" className="profile-hero-btn">
              <ArrowLeft size={16} /> Back to Players
            </Link>
            <Link to="/players" className="profile-hero-btn">
              <Pencil size={16} /> Edit
            </Link>
            <Link to={`/player/${playerId}/stats`} className="profile-hero-btn">
              <BarChart3 size={16} /> Full Stats
            </Link>
          </div>
        </div>
      </div>

      {/* Section Nav */}
      <div className="profile-nav">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            className={`profile-nav-pill${activeSection === section.id ? ' active' : ''}`}
            onClick={() => scrollToSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '0 24px 40px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Overview Section */}
        <div ref={(el) => (sectionRefs.current.overview = el)} className="profile-section">
          <h2 className="profile-section-header">Overview</h2>
          <div className="profile-stats-grid">
            <div className="profile-stat-card">
              <div className="profile-stat-value">{gamesPlayed}</div>
              <div className="profile-stat-label">Games Played</div>
            </div>
            <div className="profile-stat-card">
              <div className="profile-stat-value">{derivedStats.totalYards}</div>
              <div className="profile-stat-label">Total Yards</div>
            </div>
            <div className="profile-stat-card">
              <div className="profile-stat-value">{derivedStats.rushingTDs + derivedStats.receivingTDs + derivedStats.passingTDs}</div>
              <div className="profile-stat-label">Total TDs</div>
            </div>
            <div className="profile-stat-card">
              <div className="profile-stat-value">{derivedStats.tackles}</div>
              <div className="profile-stat-label">Tackles</div>
            </div>
          </div>
          <div className="profile-stats-grid" style={{ marginTop: '12px' }}>
            <div className="profile-stat-card">
              <div className="profile-stat-value">{derivedStats.rushingYards}</div>
              <div className="profile-stat-label">Rush Yards</div>
            </div>
            <div className="profile-stat-card">
              <div className="profile-stat-value">{derivedStats.receivingYards}</div>
              <div className="profile-stat-label">Rec Yards</div>
            </div>
            <div className="profile-stat-card">
              <div className="profile-stat-value">{derivedStats.sacks}</div>
              <div className="profile-stat-label">Sacks</div>
            </div>
            <div className="profile-stat-card">
              <div className="profile-stat-value">{derivedStats.ints}</div>
              <div className="profile-stat-label">INTs</div>
            </div>
          </div>
        </div>

        {/* Game Grades Section */}
        <div ref={(el) => (sectionRefs.current.grades = el)} className="profile-section">
          <h2 className="profile-section-header">
            Game Grades
            {averageGrade && (
              <span className={`grade-badge ${getGradeColor(averageGrade)}`} style={{ marginLeft: '12px' }}>
                Avg: {averageGrade}
              </span>
            )}
          </h2>
          {grades.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)' }}>No grades recorded yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="profile-grades-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Opponent</th>
                    <th>Grade</th>
                    <th>Game Score</th>
                    <th>Verified</th>
                    <th>Graded By</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((g, i) => (
                    <tr key={g.id || i}>
                      <td>{g.game_date ? new Date(g.game_date).toLocaleDateString() : '—'}</td>
                      <td>{g.opponent || '—'}</td>
                      <td>
                        {g.grade ? (
                          <span className={`grade-badge ${getGradeColor(g.grade)}`}>{g.grade}</span>
                        ) : '—'}
                      </td>
                      <td>{g.game_score || '—'}</td>
                      <td>
                        {g.verified ? (
                          <CheckCircle size={16} style={{ color: 'var(--color-success)' }} />
                        ) : (
                          <XCircle size={16} style={{ color: 'var(--color-text-muted)' }} />
                        )}
                      </td>
                      <td>{g.graded_by_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stats History Section */}
        <div ref={(el) => (sectionRefs.current.stats = el)} className="profile-section">
          <h2 className="profile-section-header">Stats History</h2>
          {gameBreakdown.length > 0 ? (
            <StatTrendChart
              gameBreakdown={gameBreakdown}
              playerPosition={playerPosition}
            />
          ) : (
            <p style={{ color: 'var(--color-text-muted)' }}>No game stats available.</p>
          )}
          {Object.keys(careerTotals).length > 0 && (
            <div className="profile-stats-grid" style={{ marginTop: '16px' }}>
              {Object.entries(careerTotals).map(([type, value]) => (
                <div key={type} className="profile-stat-card">
                  <div className="profile-stat-value">{value}</div>
                  <div className="profile-stat-label">{type}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status Timeline Section */}
        <div ref={(el) => (sectionRefs.current.timeline = el)} className="profile-section">
          <h2 className="profile-section-header">Status Timeline</h2>
          {statusHistory.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)' }}>No status changes recorded.</p>
          ) : (
            <div className="status-timeline">
              {statusHistory.map((entry, i) => {
                const oldStatuses = entry.old_statuses || entry.oldStatuses || []
                const newStatuses = entry.new_statuses || entry.newStatuses || []
                const changedBy = entry.changed_by_name || entry.changedByName || 'System'
                const date = entry.changed_at || entry.changedAt || entry.created_at
                const notes = entry.notes || ''
                return (
                  <div key={entry.id || i} className="timeline-item">
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <div className="timeline-date">
                        {date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                        <span className="timeline-author"> by {changedBy}</span>
                      </div>
                      <div className="timeline-change">
                        {oldStatuses.length > 0 && (
                          <>
                            {(Array.isArray(oldStatuses) ? oldStatuses : [oldStatuses]).map((s) => (
                              <span key={s} className="profile-status-badge" style={{ background: getStatusColor(s), fontSize: '11px', padding: '2px 8px' }}>{s}</span>
                            ))}
                            <span style={{ margin: '0 6px', color: 'var(--color-text-muted)' }}>&rarr;</span>
                          </>
                        )}
                        {(Array.isArray(newStatuses) ? newStatuses : [newStatuses]).map((s) => (
                          <span key={s} className="profile-status-badge" style={{ background: getStatusColor(s), fontSize: '11px', padding: '2px 8px' }}>{s}</span>
                        ))}
                      </div>
                      {notes && <div className="timeline-notes">{notes}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Comments Section */}
        <div ref={(el) => (sectionRefs.current.comments = el)} className="profile-section">
          <h2 className="profile-section-header">Comments</h2>
          <PlayerComments playerId={playerId} />
        </div>

        {/* Visits Section */}
        <div ref={(el) => (sectionRefs.current.visits = el)} className="profile-section">
          <h2 className="profile-section-header">Visits</h2>
          <PlayerVisits playerId={playerId} />
        </div>

        {/* Rating Trend Section */}
        <div ref={(el) => (sectionRefs.current.rating = el)} className="profile-section">
          <h2 className="profile-section-header">Rating Trend</h2>
          <CompositeRatingTrend playerId={playerId} />
        </div>
      </div>
    </div>
  )
}

export default PlayerProfile
