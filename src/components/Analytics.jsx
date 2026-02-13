import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ReferenceLine, Legend,
} from 'recharts'
import { loadPlayers } from '../utils/storage'
import { playersApi } from '../utils/api'

const FUNNEL_STAGES = [
  { key: 'Watching', label: 'Watching', color: '#0062B8' },
  { key: 'Evaluating', label: 'Evaluating', color: '#0062B8' },
  { key: 'Priority', label: 'Priority', color: '#0062B8' },
  { key: 'Offered', label: 'Offered', color: '#0062B8' },
  { key: 'Committed', label: 'Committed', color: '#0062B8' },
  { key: 'Signed', label: 'Signed', color: '#0062B8' },
]

const POSITION_TARGETS = {
  QB: 2, RB: 2, WR: 4, TE: 1, OL: 4,
  DL: 3, DE: 2, LB: 3, CB: 3, S: 2,
  K: 1, P: 1,
}

const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'DE', 'LB', 'CB', 'S', 'K', 'P']

const OFFENSE = ['QB', 'RB', 'WR', 'TE', 'OL']
const DEFENSE = ['DL', 'DE', 'LB', 'CB', 'S']
const SPECIAL = ['K', 'P']

const COMPOSITE_GOAL = 88.04

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="analytics-tooltip">
      <p className="analytics-tooltip-label">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color || '#2563eb' }}>
          {entry.name || 'Count'}: <strong>{entry.value}</strong>
        </p>
      ))}
    </div>
  )
}

// Helper to get the recruiting status (handles both snake_case and camelCase)
function getStatus(player) {
  return player.recruiting_status || player.recruitingStatus || 'Watching'
}

function Analytics() {
  const [players, setPlayers] = useState([])
  const [statusHistories, setStatusHistories] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const playersData = await loadPlayers()
        setPlayers(playersData)

        // Fetch status history for players with advanced statuses
        const relevantPlayers = playersData.filter((p) => {
          const status = getStatus(p)
          return ['Offered', 'Committed', 'Signed', 'Committed Elsewhere'].includes(status)
        })

        const histories = {}
        await Promise.all(
          relevantPlayers.map(async (p) => {
            try {
              const history = await playersApi.getStatusHistory(p.id)
              histories[p.id] = history
            } catch {
              histories[p.id] = []
            }
          })
        )
        setStatusHistories(histories)
      } catch (err) {
        console.error('Error loading analytics data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // 1. Recruiting Funnel
  const funnelData = useMemo(() => {
    return FUNNEL_STAGES.map((stage) => {
      const count = players.filter((p) => {
        const status = getStatus(p)
        // Treat "Offer" and "Offered" as the same stage
        if (stage.key === 'Offered') return status === 'Offered' || status === 'Offer'
        return status === stage.key
      }).length
      return { ...stage, count }
    })
  }, [players])

  // 2. Position Needs Board
  const positionNeeds = useMemo(() => {
    return POSITION_ORDER.map((pos) => {
      const target = POSITION_TARGETS[pos] || 0
      const committed = players.filter((p) => {
        const status = getStatus(p)
        const playerPos = p.position || p.offense_position || p.offensePosition || p.defense_position || p.defensePosition || ''
        return playerPos.toUpperCase() === pos && status === 'Committed'
      }).length
      const pct = target > 0 ? (committed / target) * 100 : 0
      return { pos, target, committed, pct }
    })
  }, [players])

  // 3. Position Group Leaderboard
  const leaderboardData = useMemo(() => {
    const groups = { Offense: {}, Defense: {}, 'Special Teams': {} }
    players.forEach((p) => {
      if (p.composite_rating == null) return
      const pos = (p.position || p.offense_position || p.offensePosition || p.defense_position || p.defensePosition || '').toUpperCase()
      if (!pos) return
      let side = 'Special Teams'
      if (OFFENSE.includes(pos)) side = 'Offense'
      else if (DEFENSE.includes(pos)) side = 'Defense'
      if (!groups[side][pos]) groups[side][pos] = []
      groups[side][pos].push(p)
    })
    // Sort each group by rating desc, take top 5
    Object.keys(groups).forEach((side) => {
      Object.keys(groups[side]).forEach((pos) => {
        groups[side][pos].sort((a, b) => parseFloat(b.composite_rating) - parseFloat(a.composite_rating))
        groups[side][pos] = groups[side][pos].slice(0, 5)
      })
    })
    return groups
  }, [players])

  // 4. Composite Rating by Position
  const ratingByPosition = useMemo(() => {
    const posMap = {}
    players.forEach((p) => {
      if (p.composite_rating == null) return
      const pos = (p.position || p.offense_position || p.offensePosition || p.defense_position || p.defensePosition || '').toUpperCase()
      if (!pos) return
      if (!posMap[pos]) posMap[pos] = []
      posMap[pos].push(parseFloat(p.composite_rating))
    })
    return POSITION_ORDER
      .filter((pos) => posMap[pos]?.length > 0)
      .map((pos) => {
        const ratings = posMap[pos]
        const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length
        return { position: pos, avgRating: parseFloat(avg.toFixed(2)), count: ratings.length }
      })
  }, [players])

  // 5. Offer-to-Commit Rate
  const offerCommitData = useMemo(() => {
    const offered = players.filter((p) =>
      ['Offered', 'Offer', 'Committed', 'Signed'].includes(getStatus(p))
    ).length
    const committed = players.filter((p) =>
      ['Committed', 'Signed'].includes(getStatus(p))
    ).length
    const rate = offered > 0 ? Math.round((committed / offered) * 100) : 0
    return { offered, committed, remaining: offered - committed, rate }
  }, [players])

  // 6. Committed Class Composite Rating
  const committedComposite = useMemo(() => {
    const committedPlayers = players.filter((p) =>
      ['Committed', 'Signed'].includes(getStatus(p)) && p.composite_rating != null
    )
    if (committedPlayers.length === 0) return { avg: 0, count: 0 }
    const total = committedPlayers.reduce((sum, p) => sum + parseFloat(p.composite_rating), 0)
    const avg = total / committedPlayers.length
    return { avg: parseFloat(avg.toFixed(2)), count: committedPlayers.length }
  }, [players])

  // 7. Time-to-Commit
  const timeToCommit = useMemo(() => {
    const days = []
    Object.entries(statusHistories).forEach(([playerId, history]) => {
      if (!history || history.length === 0) return
      const sorted = [...history].sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at))
      let offeredDate = null
      let committedDate = null
      sorted.forEach((entry) => {
        const newStatus = Array.isArray(entry.new_status) ? entry.new_status : [entry.new_status]
        const oldStatus = Array.isArray(entry.old_status) ? entry.old_status : [entry.old_status]
        if (newStatus.includes('Offered') || newStatus.includes('Offer')) {
          offeredDate = new Date(entry.changed_at)
        }
        if (newStatus.includes('Committed') && !oldStatus?.includes('Committed')) {
          committedDate = new Date(entry.changed_at)
        }
      })
      if (offeredDate && committedDate && committedDate > offeredDate) {
        const diff = Math.round((committedDate - offeredDate) / (1000 * 60 * 60 * 24))
        days.push(diff)
      }
    })
    if (days.length === 0) return { avg: null, min: null, max: null, count: 0 }
    const avg = Math.round(days.reduce((s, d) => s + d, 0) / days.length)
    return { avg, min: Math.min(...days), max: Math.max(...days), count: days.length }
  }, [statusHistories])

  if (loading) {
    return (
      <div className="page">
        <p>Loading analytics...</p>
      </div>
    )
  }

  return (
    <div className="page analytics-page">
      <header className="page-header">
        <div>
          <h2>Analytics</h2>
          <p>Recruiting class insights and pipeline metrics.</p>
        </div>
      </header>

      {/* Class Composite Rating */}
      <div className="analytics-grid analytics-grid-2">
        <div className="panel analytics-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 className="analytics-card-title" style={{ alignSelf: 'flex-start' }}>Class Composite Rating</h3>
          <p className="analytics-card-subtitle" style={{ alignSelf: 'flex-start' }}>
            Average composite of committed players · Goal: {COMPOSITE_GOAL}
          </p>
          <div className="donut-wrapper" style={{ marginTop: '8px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Rating', value: committedComposite.avg },
                    { name: 'Remaining', value: Math.max(0, 100 - committedComposite.avg) },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={95}
                  paddingAngle={1}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  <Cell fill="#0062B8" />
                  <Cell fill="var(--color-border)" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <span className="donut-pct" style={{ color: committedComposite.avg >= COMPOSITE_GOAL ? '#16a34a' : '#0062B8' }}>
                {committedComposite.avg.toFixed(2)}
              </span>
              <span className="donut-label">
                Goal: {COMPOSITE_GOAL}
              </span>
            </div>
          </div>
          <p className="analytics-card-footnote" style={{ marginTop: '8px' }}>
            {committedComposite.count > 0
              ? `Based on ${committedComposite.count} committed player${committedComposite.count !== 1 ? 's' : ''}`
              : 'No committed players with ratings yet'}
          </p>
        </div>

        {/* Offer-to-Commit Rate */}
        <div className="panel analytics-card">
          <h3 className="analytics-card-title">Offer-to-Commit Rate</h3>
          <p className="analytics-card-subtitle">{offerCommitData.committed} of {offerCommitData.offered} offered players committed</p>
          <div className="donut-wrapper">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Committed', value: offerCommitData.committed },
                    { name: 'Pending', value: offerCommitData.remaining },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={95}
                  paddingAngle={2}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  <Cell fill="#0062B8" />
                  <Cell fill="var(--color-border)" />
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <span className="donut-pct">{offerCommitData.rate}%</span>
              <span className="donut-label">Commit Rate</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Funnel + Position Needs */}
      <div className="analytics-grid analytics-grid-2">
        {/* Recruiting Funnel */}
        <div className="panel analytics-card">
          <h3 className="analytics-card-title">Recruiting Funnel</h3>
          <p className="analytics-card-subtitle">Players at each pipeline stage</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={funnelData} layout="vertical" margin={{ top: 8, right: 30, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
              <YAxis
                dataKey="label"
                type="category"
                width={90}
                tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Players" radius={[0, 6, 6, 0]} maxBarSize={32}>
                {funnelData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Position Needs Board */}
        <div className="panel analytics-card">
          <h3 className="analytics-card-title">Position Needs</h3>
          <p className="analytics-card-subtitle">Committed vs. target by position</p>
          <div className="needs-grid">
            {positionNeeds.map((item) => {
              const status = item.pct >= 100 ? 'met' : item.pct >= 50 ? 'close' : 'need'
              return (
                <div key={item.pos} className={`needs-item needs-${status}`}>
                  <div className="needs-item-header">
                    <span className="needs-pos">{item.pos}</span>
                    <span className="needs-count">
                      {item.committed}/{item.target}
                    </span>
                  </div>
                  <div className="needs-bar-track">
                    <div
                      className="needs-bar-fill"
                      style={{ width: `${Math.min(item.pct, 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Row 3: Rating by Position + Time-to-Commit */}
      <div className="analytics-grid analytics-grid-2">
        {/* Composite Rating by Position */}
        <div className="panel analytics-card">
          <h3 className="analytics-card-title">Avg Composite by Position</h3>
          <p className="analytics-card-subtitle">Average rating per position group · <span style={{ color: '#dc2626', fontWeight: 600 }}>Goal: {COMPOSITE_GOAL}</span></p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={ratingByPosition} margin={{ top: 8, right: 16, left: -8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="position" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
              <YAxis domain={[75, 100]} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={COMPOSITE_GOAL}
                stroke="#dc2626"
                strokeDasharray="6 4"
                strokeWidth={2}
                              />
              <Bar dataKey="avgRating" name="Avg Rating" fill="#0062B8" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Time-to-Commit */}
        <div className="panel analytics-card">
          <h3 className="analytics-card-title">Time to Commit</h3>
          <p className="analytics-card-subtitle">Days from offer to commitment</p>
          <div className="metrics-row">
            <div className="metric-card">
              <span className="metric-value">{timeToCommit.avg ?? '—'}</span>
              <span className="metric-label">Avg Days</span>
            </div>
            <div className="metric-card">
              <span className="metric-value metric-success">{timeToCommit.min ?? '—'}</span>
              <span className="metric-label">Fastest</span>
            </div>
            <div className="metric-card">
              <span className="metric-value metric-warning">{timeToCommit.max ?? '—'}</span>
              <span className="metric-label">Slowest</span>
            </div>
          </div>
          <p className="analytics-card-footnote">
            {timeToCommit.count > 0
              ? `Based on ${timeToCommit.count} player${timeToCommit.count !== 1 ? 's' : ''} with tracked history`
              : 'No offer-to-commit history tracked yet'}
          </p>
        </div>
      </div>

      {/* Row 3: Position Group Leaderboard */}
      <div className="panel analytics-card">
        <h3 className="analytics-card-title">Position Group Leaderboard</h3>
        <p className="analytics-card-subtitle">Top 5 players by composite rating per position</p>
        <div className="leaderboard-sections">
          {['Offense', 'Defense', 'Special Teams'].map((side) => {
            const positions = side === 'Offense' ? OFFENSE : side === 'Defense' ? DEFENSE : SPECIAL
            const hasPlayers = positions.some((pos) => leaderboardData[side][pos]?.length > 0)
            if (!hasPlayers) return null
            return (
              <div key={side} className="leaderboard-group">
                <h4 className="leaderboard-side">{side}</h4>
                <div className="leaderboard-positions">
                  {positions.map((pos) => {
                    const list = leaderboardData[side][pos]
                    if (!list || list.length === 0) return null
                    return (
                      <div key={pos} className="leaderboard-pos-group">
                        <h5 className="leaderboard-pos-label">{pos}</h5>
                        {list.map((player, idx) => {
                          const rating = parseFloat(player.composite_rating)
                          const barWidth = Math.max(((rating - 75) / 25) * 100, 5)
                          return (
                            <div key={player.id} className="leaderboard-row">
                              <span className="leaderboard-rank">#{idx + 1}</span>
                              <div className="leaderboard-info">
                                <span className="leaderboard-name">{player.name}</span>
                                <span className="leaderboard-school">{player.school || '—'}</span>
                              </div>
                              <div className="leaderboard-bar-wrapper">
                                <div
                                  className="leaderboard-bar"
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                              <span className="leaderboard-rating">{rating.toFixed(2)}</span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Analytics
