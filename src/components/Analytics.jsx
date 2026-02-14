import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, ReferenceLine,
} from 'recharts'
import { loadPlayers } from '../utils/storage'
import { playersApi, recruitsApi } from '../utils/api'

const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'DE', 'LB', 'C', 'S', 'K', 'P']

const BYU_BLUE = '#002E5D'
const BYU_BLUE_LIGHT = '#0062B8'
const BYU_BLUE_TINT = '#E8EEF7'
const COMPOSITE_GOAL = 88.04

const STATUS_COLORS = {
  COMMITTED: '#16a34a',
  SIGNED: '#16a34a',
  OFFERED: '#2563eb',
  'COMMITTED ELSEWHERE': '#f97316',
  PASSED: '#dc2626',
  WATCHING: '#6b7280',
}

function getStatusColor(status) {
  return STATUS_COLORS[status?.toUpperCase()] || '#6b7280'
}

// Demo data for when real player data is empty
const DEMO_COMMITTED_RATINGS = [
  { position: 'QB', avgRating: 91.50, count: 2, maxRating: 93.00, minRating: 90.00 },
  { position: 'RB', avgRating: 87.33, count: 3, maxRating: 89.50, minRating: 85.00 },
  { position: 'WR', avgRating: 89.00, count: 3, maxRating: 92.00, minRating: 86.00 },
  { position: 'TE', avgRating: 84.50, count: 2, maxRating: 86.00, minRating: 83.00 },
  { position: 'OL', avgRating: 86.67, count: 3, maxRating: 88.50, minRating: 84.00 },
  { position: 'DL', avgRating: 88.00, count: 2, maxRating: 90.00, minRating: 86.00 },
  { position: 'DE', avgRating: 90.50, count: 2, maxRating: 93.00, minRating: 88.00 },
  { position: 'LB', avgRating: 87.00, count: 3, maxRating: 89.00, minRating: 85.00 },
  { position: 'CB', avgRating: 85.50, count: 2, maxRating: 87.00, minRating: 84.00 },
  { position: 'S', avgRating: 86.00, count: 2, maxRating: 88.00, minRating: 84.00 },
]

const DEMO_TIME_TO_COMMIT = { avg: 47, min: 12, max: 98, median: 42, count: 8 }

const DEMO_COMMIT_TO_OFFER = { offered: 24, committed: 14, rate: 58.3, pending: 10 }

const DEMO_TOP_PLAYERS = {
  QB: [
    { id: 'd1', name: 'Marcus Johnson', school: 'Lincoln HS', rating: 93.00, statuses: ['Committed'] },
    { id: 'd2', name: 'Tyler Brooks', school: 'Central HS', rating: 90.00, statuses: ['Committed'] },
  ],
  WR: [
    { id: 'd3', name: 'DeAndre Williams', school: 'Westside Prep', rating: 92.00, statuses: ['Committed'] },
    { id: 'd4', name: 'Jamal Carter', school: 'East Academy', rating: 89.50, statuses: ['Offered'] },
    { id: 'd5', name: 'Chris Martinez', school: 'South HS', rating: 86.00, statuses: ['Committed'] },
  ],
  DE: [
    { id: 'd6', name: 'Aidan Thompson', school: 'North Prep', rating: 93.00, statuses: ['Signed'] },
    { id: 'd7', name: 'Jordan Davis', school: 'Valley HS', rating: 88.00, statuses: ['Offered'] },
  ],
  RB: [
    { id: 'd8', name: 'Kamari Lewis', school: 'Heritage HS', rating: 89.50, statuses: ['Committed'] },
    { id: 'd9', name: 'Devon Jackson', school: 'Park Academy', rating: 87.00, statuses: ['Committed'] },
    { id: 'd10', name: 'Isaiah Moore', school: 'Ridge HS', rating: 85.00, statuses: ['Offered'] },
  ],
  OL: [
    { id: 'd11', name: 'Ethan Walker', school: 'Summit HS', rating: 88.50, statuses: ['Committed'] },
    { id: 'd12', name: 'Logan Harris', school: 'Crest Prep', rating: 86.00, statuses: ['Signed'] },
    { id: 'd13', name: 'Noah Clark', school: 'Bay HS', rating: 84.00, statuses: ['Offered'] },
  ],
  LB: [
    { id: 'd14', name: 'Malik Robinson', school: 'Eagle HS', rating: 89.00, statuses: ['Committed'] },
    { id: 'd15', name: 'Xavier Brown', school: 'Lake Academy', rating: 87.50, statuses: ['Offered'] },
    { id: 'd16', name: 'Caleb White', school: 'River HS', rating: 85.00, statuses: ['Committed'] },
  ],
}

// Helper to get recruiting statuses (handles both array and single value)
function getStatuses(player) {
  if (Array.isArray(player.recruiting_statuses)) {
    return player.recruiting_statuses
  }
  if (player.recruiting_status) {
    return [player.recruiting_status]
  }
  if (player.recruitingStatus) {
    return Array.isArray(player.recruitingStatus) ? player.recruitingStatus : [player.recruitingStatus]
  }
  return ['Watching']
}

// Helper to check if player is committed (case-insensitive)
function isCommitted(player) {
  const statuses = getStatuses(player).map(s => s.toLowerCase())
  return statuses.includes('committed') || statuses.includes('signed')
}

// Helper to check if player is offered (case-insensitive)
function isOffered(player) {
  const statuses = getStatuses(player).map(s => s.toLowerCase())
  return statuses.includes('offered') || statuses.includes('offer')
}

// Helper to get player position
function getPosition(player) {
  return (player.position || player.offense_position || player.offensePosition ||
          player.defense_position || player.defensePosition || '').toUpperCase()
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--color-bg-secondary)',
      border: '1px solid var(--color-border)',
      borderRadius: '8px',
      padding: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    }}>
      <p style={{ margin: '0 0 8px 0', fontWeight: 600, fontSize: '14px' }}>{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ margin: '4px 0', fontSize: '13px', color: entry.color || BYU_BLUE }}>
          {entry.name || 'Value'}: <strong>{entry.value}</strong>
        </p>
      ))}
    </div>
  )
}

function Analytics() {
  const [players, setPlayers] = useState([])
  const [recruits, setRecruits] = useState([])
  const [statusHistories, setStatusHistories] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [playersData, recruitsData] = await Promise.all([
          loadPlayers(),
          recruitsApi.getAll().catch(() => []),
        ])
        setPlayers(playersData)
        setRecruits(Array.isArray(recruitsData) ? recruitsData : [])

        // Fetch status history for committed players
        const committedPlayers = playersData.filter(isCommitted)
        const histories = {}
        await Promise.all(
          committedPlayers.map(async (p) => {
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

  // --- Recruit-based analytics ---

  // Board Summary: count of recruits per status
  const boardSummary = useMemo(() => {
    const statusMap = {}
    recruits.forEach((r) => {
      const status = (r.status || 'UNKNOWN').toUpperCase()
      statusMap[status] = (statusMap[status] || 0) + 1
    })
    const priority = { COMMITTED: 1, SIGNED: 2, OFFERED: 3, 'COMMITTED ELSEWHERE': 4, PASSED: 5, WATCHING: 6 }
    return Object.entries(statusMap)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => (priority[a.status] || 99) - (priority[b.status] || 99))
  }, [recruits])

  // Position Needs: recruit count per position, color-coded by most common status
  const positionNeeds = useMemo(() => {
    const posMap = {}
    recruits.forEach((r) => {
      const pos = (r.position || '').toUpperCase()
      if (!pos) return
      if (!posMap[pos]) posMap[pos] = { total: 0, statuses: {} }
      posMap[pos].total += 1
      const status = (r.status || 'UNKNOWN').toUpperCase()
      posMap[pos].statuses[status] = (posMap[pos].statuses[status] || 0) + 1
    })

    return POSITION_ORDER
      .filter((pos) => posMap[pos]?.total > 0)
      .map((pos) => {
        const data = posMap[pos]
        const topStatus = Object.entries(data.statuses)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || 'WATCHING'
        return {
          position: pos,
          count: data.total,
          topStatus,
          color: getStatusColor(topStatus),
          statuses: data.statuses,
        }
      })
  }, [recruits])

  // --- Player-based analytics (with demo fallbacks) ---

  // 1. Composite Rating by Position for Committed Players (Bar Graph)
  const committedRatingByPositionReal = useMemo(() => {
    const committedPlayers = players.filter((p) => isCommitted(p) && p.compositeRating != null)
    const posMap = {}

    committedPlayers.forEach((p) => {
      const pos = getPosition(p)
      if (!pos) return
      if (!posMap[pos]) posMap[pos] = []
      posMap[pos].push(parseFloat(p.compositeRating || p.composite_rating))
    })

    return POSITION_ORDER
      .filter((pos) => posMap[pos]?.length > 0)
      .map((pos) => {
        const ratings = posMap[pos]
        const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length
        return {
          position: pos,
          avgRating: parseFloat(avg.toFixed(2)),
          count: ratings.length,
          maxRating: Math.max(...ratings),
          minRating: Math.min(...ratings),
        }
      })
  }, [players])

  const isRatingDemo = committedRatingByPositionReal.length === 0
  const committedRatingByPosition = isRatingDemo ? DEMO_COMMITTED_RATINGS : committedRatingByPositionReal

  // 2. Time-to-Commit (Days from offer to commit)
  const timeToCommitReal = useMemo(() => {
    const days = []
    Object.entries(statusHistories).forEach(([, history]) => {
      if (!history || history.length === 0) return
      const sorted = [...history].sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at))
      let offeredDate = null
      let committedDate = null

      sorted.forEach((entry) => {
        const newStatus = Array.isArray(entry.new_status) ? entry.new_status : [entry.new_status]
        const oldStatus = Array.isArray(entry.old_status) ? entry.old_status : [entry.old_status]

        const newLower = newStatus.map(s => (s || '').toLowerCase())
        const oldLower = oldStatus.map(s => (s || '').toLowerCase())

        if ((newLower.includes('offered') || newLower.includes('offer')) && !offeredDate) {
          offeredDate = new Date(entry.changed_at)
        }
        if ((newLower.includes('committed') || newLower.includes('signed')) &&
            !oldLower.includes('committed') && !oldLower.includes('signed')) {
          committedDate = new Date(entry.changed_at)
        }
      })

      if (offeredDate && committedDate && committedDate > offeredDate) {
        const diff = Math.round((committedDate - offeredDate) / (1000 * 60 * 60 * 24))
        days.push(diff)
      }
    })

    if (days.length === 0) return { avg: null, min: null, max: null, count: 0, median: null }

    const sorted = [...days].sort((a, b) => a - b)
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)]

    return {
      avg: Math.round(days.reduce((s, d) => s + d, 0) / days.length),
      min: Math.min(...days),
      max: Math.max(...days),
      median: Math.round(median),
      count: days.length,
    }
  }, [statusHistories])

  const isTimeDemo = timeToCommitReal.count === 0
  const timeToCommit = isTimeDemo ? DEMO_TIME_TO_COMMIT : timeToCommitReal

  // 3. Commit-to-Offer Rate
  const commitToOfferReal = useMemo(() => {
    const offered = players.filter(isOffered).length
    const committed = players.filter(isCommitted).length
    const rate = offered > 0 ? parseFloat(((committed / offered) * 100).toFixed(1)) : 0
    return { offered, committed, rate, pending: offered - committed }
  }, [players])

  const isOfferDemo = commitToOfferReal.offered === 0
  const commitToOffer = isOfferDemo ? DEMO_COMMIT_TO_OFFER : commitToOfferReal

  // Donut chart data for Commit-to-Offer
  const commitPieData = [
    { name: 'Committed', value: commitToOffer.committed },
    { name: 'Pending', value: commitToOffer.pending },
  ]

  // 4. Top Player Composite Rating by Position
  const topPlayersByPositionReal = useMemo(() => {
    const posMap = {}

    players.forEach((p) => {
      const rating = p.compositeRating || p.composite_rating
      if (rating == null) return
      const pos = getPosition(p)
      if (!pos) return

      if (!posMap[pos]) posMap[pos] = []
      posMap[pos].push({
        id: p.id,
        name: p.name,
        school: p.school || '',
        rating: parseFloat(rating),
        statuses: getStatuses(p),
      })
    })

    Object.keys(posMap).forEach((pos) => {
      posMap[pos].sort((a, b) => b.rating - a.rating)
      posMap[pos] = posMap[pos].slice(0, 3)
    })

    return posMap
  }, [players])

  const isTopPlayersDemo = Object.keys(topPlayersByPositionReal).length === 0
  const topPlayersByPosition = isTopPlayersDemo ? DEMO_TOP_PLAYERS : topPlayersByPositionReal

  // KPI summary stats
  const kpiStats = useMemo(() => {
    const totalRecruits = recruits.length
    const committed = recruits.filter(r => {
      const s = (r.status || '').toUpperCase()
      return s === 'COMMITTED' || s === 'SIGNED'
    }).length
    const offered = recruits.filter(r => (r.status || '').toUpperCase() === 'OFFERED').length
    const commitRate = totalRecruits > 0 ? parseFloat(((committed / totalRecruits) * 100).toFixed(1)) : 0
    return { totalRecruits, committed, offered, commitRate }
  }, [recruits])

  if (loading) {
    return (
      <div className="page">
        <p>Loading analytics...</p>
      </div>
    )
  }

  // Progress bar position for time-to-commit
  const timeRange = timeToCommit.max - timeToCommit.min
  const timeProgress = timeRange > 0 ? ((timeToCommit.avg - timeToCommit.min) / timeRange) * 100 : 50

  return (
    <div className="page analytics-page">
      {/* Dashboard Header */}
      <header style={{
        borderLeft: `4px solid ${BYU_BLUE}`,
        paddingLeft: '16px',
        marginBottom: '24px',
      }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: 700, color: BYU_BLUE }}>
          Analytics Dashboard
        </h2>
        <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
          Recruiting insights and performance metrics
        </p>
      </header>

      {/* KPI Summary Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '24px',
      }}>
        {[
          { label: 'Total Recruits', value: kpiStats.totalRecruits, color: BYU_BLUE },
          { label: 'Committed', value: kpiStats.committed, color: '#16a34a' },
          { label: 'Offered', value: kpiStats.offered, color: BYU_BLUE_LIGHT },
          { label: 'Commit Rate', value: `${kpiStats.commitRate}%`, color: kpiStats.commitRate >= 50 ? '#16a34a' : '#f59e0b' },
        ].map((kpi) => (
          <div key={kpi.label} className="panel" style={{
            padding: '20px',
            borderLeft: `4px solid ${kpi.color}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}>
            <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>{kpi.label}</span>
            <span style={{ fontSize: '28px', fontWeight: 700, color: kpi.color }}>{kpi.value}</span>
          </div>
        ))}
      </div>

      {/* Board Summary + Time-to-Commit side by side */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
        marginBottom: '24px',
      }}>
        {/* Recruiting Board Summary */}
        <section className="panel" style={{
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <div style={{ marginBottom: '12px' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600, color: BYU_BLUE }}>
              Recruiting Board Summary
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
              Recruit count by status &middot; {recruits.length} total
            </p>
          </div>
          {boardSummary.length === 0 ? (
            <p className="empty-state" style={{ padding: '40px', textAlign: 'center' }}>
              No recruits on the board yet
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={boardSummary.length * 40 + 20}>
              <BarChart data={boardSummary} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 5 }} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.4} horizontal={false} />
                <YAxis
                  dataKey="status"
                  type="category"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                  width={120}
                />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Recruits" radius={[0, 6, 6, 0]} maxBarSize={28} fill="#4169E1" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        {/* Time-to-Commit - Professional KPI Card */}
        <section className="panel" style={{
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          background: `linear-gradient(135deg, ${BYU_BLUE_TINT} 0%, white 100%)`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600, color: BYU_BLUE }}>
              Time to Commit
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
              Avg. days from offer to commitment
              {isTimeDemo && <span style={{ marginLeft: '8px', fontStyle: 'italic', color: '#f59e0b' }}>(Sample Data)</span>}
            </p>
          </div>

          {/* Hero number */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <span style={{ fontSize: '48px', fontWeight: 700, color: BYU_BLUE, lineHeight: 1 }}>
              {timeToCommit.avg}
            </span>
            <span style={{ fontSize: '18px', fontWeight: 400, color: '#6b7280', marginLeft: '6px' }}>
              days
            </span>
          </div>

          {/* Progress bar */}
          <div style={{ margin: '0 auto 20px auto', width: '100%', maxWidth: '320px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#6b7280', marginBottom: '5px' }}>
              <span>{timeToCommit.min}d (fastest)</span>
              <span>{timeToCommit.max}d (slowest)</span>
            </div>
            <div style={{
              height: '6px',
              background: '#e5e7eb',
              borderRadius: '3px',
              position: 'relative',
            }}>
              <div style={{
                height: '100%',
                width: `${timeProgress}%`,
                background: `linear-gradient(90deg, #16a34a, ${BYU_BLUE_LIGHT}, #dc2626)`,
                borderRadius: '3px',
              }} />
              <div style={{
                position: 'absolute',
                top: '-4px',
                left: `${timeProgress}%`,
                transform: 'translateX(-50%)',
                width: '14px',
                height: '14px',
                background: BYU_BLUE,
                borderRadius: '50%',
                border: '2px solid white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </div>
          </div>

          {/* Sub-metrics */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            maxWidth: '320px',
            margin: '0 auto',
          }}>
            <div style={{ textAlign: 'center', padding: '10px 8px', borderRight: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 500 }}>Fastest</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#16a34a' }}>{timeToCommit.min}</div>
              <div style={{ fontSize: '10px', color: '#6b7280' }}>days</div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px 8px', borderRight: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 500 }}>Median</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: BYU_BLUE }}>{timeToCommit.median}</div>
              <div style={{ fontSize: '10px', color: '#6b7280' }}>days</div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px 8px' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 500 }}>Slowest</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626' }}>{timeToCommit.max}</div>
              <div style={{ fontSize: '10px', color: '#6b7280' }}>days</div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '11px', color: '#6b7280' }}>
            Based on {timeToCommit.count} player{timeToCommit.count !== 1 ? 's' : ''}
            {isTimeDemo && ' (sample)'}
          </div>
        </section>
      </div>

      {/* Two-Column: Composite Rating + Commit-to-Offer Donut */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
        marginBottom: '24px',
      }}>
        {/* Composite Rating by Position */}
        <section className="panel" style={{
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <div style={{ marginBottom: '12px' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600, color: BYU_BLUE }}>
              Composite Rating by Position
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
              Avg. committed player ratings
              {isRatingDemo && <span style={{ marginLeft: '8px', fontStyle: 'italic', color: '#f59e0b' }}>(Sample Data)</span>}
            </p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={committedRatingByPosition} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
              <XAxis
                dataKey="position"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                angle={-45}
                textAnchor="end"
                height={50}
              />
              <YAxis
                domain={[75, 100]}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                label={{ value: 'Rating', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#6b7280', fontSize: 12 } }}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={COMPOSITE_GOAL}
                stroke="#dc2626"
                strokeDasharray="6 4"
                label={{ value: `Goal: ${COMPOSITE_GOAL}`, position: 'right', fill: '#dc2626', fontSize: 11 }}
              />
              <Bar dataKey="avgRating" name="Avg Rating" radius={[6, 6, 0, 0]} fill="#4169E1" />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280', textAlign: 'center' }}>
            {committedRatingByPosition.reduce((sum, p) => sum + p.count, 0)} committed players
            {isRatingDemo && ' (sample)'}
          </div>
        </section>

        {/* Commit-to-Offer Rate - Donut Chart */}
        <section className="panel" style={{
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <div style={{ alignSelf: 'stretch', marginBottom: '12px' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600, color: BYU_BLUE }}>
              Commit-to-Offer Rate
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
              Percentage of offered players who committed
              {isOfferDemo && <span style={{ marginLeft: '8px', fontStyle: 'italic', color: '#f59e0b' }}>(Sample Data)</span>}
            </p>
          </div>
          <div style={{ position: 'relative', width: '220px', height: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={commitPieData}
                  innerRadius={65}
                  outerRadius={95}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                >
                  <Cell fill="#4169E1" />
                  <Cell fill="#e2e8f0" />
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center percentage overlay */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '32px', fontWeight: 700, color: '#4169E1', lineHeight: 1 }}>
                {commitToOffer.rate}%
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Commit Rate
              </div>
            </div>
          </div>
          {/* Legend */}
          <div style={{
            display: 'flex',
            gap: '24px',
            marginTop: '16px',
            fontSize: '13px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#4169E1' }} />
              <span>Committed ({commitToOffer.committed})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#e2e8f0' }} />
              <span>Pending ({commitToOffer.pending})</span>
            </div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#6b7280' }}>
            {commitToOffer.offered} total offered{isOfferDemo && ' (sample)'}
          </div>
        </section>
      </div>

      {/* Position Needs */}
      <section className="panel" style={{
        padding: '24px',
        marginBottom: '24px',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}>
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 600, color: BYU_BLUE }}>
            Position Needs
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
            Recruit distribution across positions
          </p>
        </div>
        {positionNeeds.length === 0 ? (
          <p className="empty-state" style={{ padding: '40px', textAlign: 'center' }}>
            No recruits with position data yet
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={positionNeeds} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                <XAxis
                  dataKey="position"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  label={{ value: 'Recruits', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#6b7280' } }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Recruits" radius={[8, 8, 0, 0]}>
                  {positionNeeds.map((entry, index) => {
                    const shades = [BYU_BLUE, BYU_BLUE_LIGHT, '#3478c6', '#1a4a8a', '#004a9f']
                    return <Cell key={`pos-${index}`} fill={shades[index % shades.length]} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* Position breakdown grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginTop: '16px' }}>
              {positionNeeds.map((pos) => (
                <div key={pos.position} style={{
                  padding: '12px',
                  background: 'var(--color-bg-secondary)',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border)',
                }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    marginBottom: '8px',
                    color: 'white',
                    background: BYU_BLUE,
                    display: 'inline-block',
                    padding: '2px 10px',
                    borderRadius: '4px',
                  }}>
                    {pos.position}
                    <span style={{ fontSize: '12px', fontWeight: 400, marginLeft: '6px', opacity: 0.8 }}>
                      ({pos.count})
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {Object.entries(pos.statuses).map(([status, count]) => (
                      <div key={status} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                        <span style={{ color: getStatusColor(status) }}>{status}</span>
                        <span style={{ fontWeight: 600 }}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Top Players by Position */}
      <section className="panel" style={{
        padding: '24px',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}>
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 600, color: BYU_BLUE }}>
            Top Players by Position
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
            Top 3 players by composite rating for each position
            {isTopPlayersDemo && <span style={{ marginLeft: '8px', fontStyle: 'italic', color: '#f59e0b' }}>(Sample Data)</span>}
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {POSITION_ORDER.filter(pos => topPlayersByPosition[pos]?.length > 0).map((pos) => (
            <div key={pos} style={{
              padding: '16px',
              background: 'var(--color-bg-secondary)',
              borderRadius: '12px',
              border: '1px solid var(--color-border)',
            }}>
              <h4 style={{
                margin: '0 0 12px 0',
                fontSize: '14px',
                fontWeight: 700,
                color: 'white',
                background: BYU_BLUE,
                display: 'inline-block',
                padding: '4px 14px',
                borderRadius: '6px',
              }}>
                {pos}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {topPlayersByPosition[pos].map((player, idx) => (
                  <div key={player.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 10px',
                    background: idx === 0 ? BYU_BLUE_TINT : 'transparent',
                    borderRadius: '6px',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: idx === 0 ? 600 : 500, marginBottom: '2px' }}>
                        {player.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>
                        {player.school || 'No school'}
                      </div>
                    </div>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: player.rating >= 88 ? '#16a34a' : player.rating >= 85 ? BYU_BLUE : '#dc2626',
                      marginLeft: '12px',
                    }}>
                      {player.rating.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default Analytics
