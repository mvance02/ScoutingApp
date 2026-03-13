import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, ReferenceLine, LineChart, Line, Legend, ReferenceArea,
} from 'recharts'
import { loadPlayers } from '../utils/storage'
import { playersApi, recruitsApi, performancesApi, recruitingGoalsApi } from '../utils/api'
import { exportAnalyticsDashboardPDF } from '../utils/exportUtils'
import {
  BYU_TEAM_COMPOSITE_BY_YEAR,
  BIG12_STARTER_AVG_BY_POSITION,
  BYU_NFL_AVG_BY_POSITION,
  normalizeBenchmarkPosition,
} from '../utils/benchmarks'

const POSITION_ORDER = [
  'QB',
  'RB',
  'WR (slot)',
  'WR (wideout)',
  'TE',
  'OT',
  'OG',
  'DL',
  'DE',
  'LB',
  'C',
  'CB',
  'S',
  'K',
  'P',
]

const BYU_BLUE = '#002E5D'
const BYU_BLUE_LIGHT = '#0062B8'
const BYU_BLUE_TINT = '#E8EEF7'
const COMPOSITE_GOAL_DEFAULT = 86.12

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

const STATUS_PRIORITY = [
  'SIGNED',
  'COMMITTED ELSEWHERE',
  'COMMITTED',
  'OFFERED',
  'EVALUATED',
  'RECRUIT',
  'PASSED',
  'WATCHING',
]

function getRecruitStatusList(recruit) {
  const raw =
    recruit.status_list ||
    recruit.statuses ||
    recruit.recruiting_statuses ||
    (recruit.status ? [recruit.status] : [])

  const list = Array.isArray(raw) ? raw : [raw]

  return list
    .map((s) => String(s || '').trim())
    .filter(Boolean)
}

function getPrimaryRecruitStatus(recruit) {
  const list = getRecruitStatusList(recruit)
  if (list.length === 0) return 'UNKNOWN'

  const upper = list.map((s) => s.toUpperCase())
  for (const status of STATUS_PRIORITY) {
    if (upper.includes(status)) return status
  }

  return upper[0]
}

// Demo data for when real player data is empty
const DEMO_COMMITTED_RATINGS = [
  { position: 'QB', avgRating: 91.5, count: 2, maxRating: 93.0, minRating: 90.0 },
  { position: 'RB', avgRating: 87.33, count: 3, maxRating: 89.5, minRating: 85.0 },
  { position: 'WR (slot)', avgRating: 88.5, count: 2, maxRating: 90.0, minRating: 87.0 },
  { position: 'WR (wideout)', avgRating: 89.5, count: 2, maxRating: 92.0, minRating: 87.0 },
  { position: 'TE', avgRating: 84.5, count: 2, maxRating: 86.0, minRating: 83.0 },
  { position: 'OT', avgRating: 87.5, count: 2, maxRating: 89.0, minRating: 86.0 },
  { position: 'OG', avgRating: 86.0, count: 1, maxRating: 86.0, minRating: 86.0 },
  { position: 'DL', avgRating: 88.0, count: 2, maxRating: 90.0, minRating: 86.0 },
  { position: 'DE', avgRating: 90.5, count: 2, maxRating: 93.0, minRating: 88.0 },
  { position: 'LB', avgRating: 87.0, count: 3, maxRating: 89.0, minRating: 85.0 },
  { position: 'CB', avgRating: 85.5, count: 2, maxRating: 87.0, minRating: 84.0 },
  { position: 'S', avgRating: 86.0, count: 2, maxRating: 88.0, minRating: 84.0 },
]

const DEMO_TIME_TO_COMMIT = { avg: 47, min: 12, max: 98, median: 42, count: 8 }

const DEMO_COMMIT_TO_OFFER = { offered: 24, committed: 14, rate: 58.3, pending: 10 }

// Demo: Offer-to-commit rate by composite rating tier (81-84, 84-87, etc.)
const DEMO_OFFER_TO_COMMIT_BY_TIER = [
  { tier: '81-84', offered: 8, committed: 5, rate: 62.5 },
  { tier: '84-87', offered: 12, committed: 7, rate: 58.3 },
  { tier: '87-90', offered: 10, committed: 6, rate: 60 },
  { tier: '90-93', offered: 6, committed: 4, rate: 66.7 },
  { tier: '93-96', offered: 4, committed: 3, rate: 75 },
  { tier: '96-100', offered: 2, committed: 2, rate: 100 },
]

const DEMO_TOP_PLAYERS = {
  QB: [
    { id: 'd1', name: 'Marcus Johnson', school: 'Lincoln HS', rating: 93.00, statuses: ['Committed'] },
    { id: 'd2', name: 'Tyler Brooks', school: 'Central HS', rating: 90.00, statuses: ['Committed'] },
  ],
  'WR (slot)': [
    { id: 'd3', name: 'DeAndre Williams', school: 'Westside Prep', rating: 92.00, statuses: ['Committed'] },
    { id: 'd4', name: 'Jamal Carter', school: 'East Academy', rating: 89.50, statuses: ['Offered'] },
    { id: 'd5', name: 'Chris Martinez', school: 'South HS', rating: 86.00, statuses: ['Committed'] },
  ],
  'WR (wideout)': [
    { id: 'd6', name: 'Jamal Carter', school: 'East Academy', rating: 92.0, statuses: ['Committed'] },
    { id: 'd7', name: 'Chris Martinez', school: 'South HS', rating: 89.5, statuses: ['Offered'] },
  ],
  DE: [
    { id: 'd6', name: 'Aidan Thompson', school: 'North Prep', rating: 93.00, statuses: ['Signed'] },
    { id: 'd7', name: 'Jordan Davis', school: 'Valley HS', rating: 88.00, statuses: ['Offered'] },
  ],
  RB: [
    { id: 'd8', name: 'Kamari Lewis', school: 'Heritage HS', rating: 89.5, statuses: ['Committed'] },
    { id: 'd9', name: 'Devon Jackson', school: 'Park Academy', rating: 87.0, statuses: ['Committed'] },
    { id: 'd10', name: 'Isaiah Moore', school: 'Ridge HS', rating: 85.0, statuses: ['Offered'] },
  ],
  OT: [
    { id: 'd11', name: 'Ethan Walker', school: 'Summit HS', rating: 88.5, statuses: ['Committed'] },
    { id: 'd12', name: 'Logan Harris', school: 'Crest Prep', rating: 86.0, statuses: ['Signed'] },
  ],
  OG: [
    { id: 'd13', name: 'Noah Clark', school: 'Bay HS', rating: 84.0, statuses: ['Offered'] },
  ],
  LB: [
    { id: 'd14', name: 'Malik Robinson', school: 'Eagle HS', rating: 89.00, statuses: ['Committed'] },
    { id: 'd15', name: 'Xavier Brown', school: 'Lake Academy', rating: 87.50, statuses: ['Offered'] },
    { id: 'd16', name: 'Caleb White', school: 'River HS', rating: 85.00, statuses: ['Committed'] },
  ],
}

// Helper to get recruiting statuses (handles both array and single value)
function getStatuses(player) {
  // Check all possible field names and formats
  if (Array.isArray(player.recruitingStatuses)) {
    return player.recruitingStatuses
  }
  if (Array.isArray(player.recruiting_statuses)) {
    return player.recruiting_statuses
  }
  if (player.recruitingStatuses && !Array.isArray(player.recruitingStatuses)) {
    return [player.recruitingStatuses]
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
  // Check for committed/signed, but exclude "committed elsewhere"
  const hasCommitted = statuses.some(s => s === 'committed' || s === 'signed')
  const hasCommittedElsewhere = statuses.some(s => s.includes('committed elsewhere') || s.includes('elsewhere'))
  return hasCommitted && !hasCommittedElsewhere
}

// Helper to check if player has committed elsewhere (case-insensitive)
function hasCommittedElsewhere(player) {
  const statuses = getStatuses(player).map((s) => s.toLowerCase())
  return statuses.some(
    (s) =>
      s === 'committed elsewhere' ||
      (s.includes('committed') && s.includes('elsewhere'))
  )
}

// Helper to check if player is offered (case-insensitive)
// Check current status, offered_date, and recruitingStatuses array
function isOffered(player) {
  const statuses = getStatuses(player).map(s => s.toLowerCase())
  const hasOfferedStatus = statuses.some(s => s === 'offered' || s === 'offer')
  const hasOfferedDate = !!(player.offeredDate)
  const hasOfferedInArray = Array.isArray(player.recruitingStatuses) && 
                           player.recruitingStatuses.some(s => {
                             const str = String(s).toLowerCase().trim()
                             return str === 'offered' || str === 'offer'
                           })
  return hasOfferedStatus || hasOfferedDate || hasOfferedInArray
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
      background: 'var(--color-bg-card)',
      border: '1px solid var(--color-border)',
      borderRadius: '8px',
      padding: '12px 16px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      minWidth: '140px',
    }}>
      <p style={{ margin: '0 0 6px 0', fontWeight: 700, fontSize: '14px', color: 'var(--color-text)' }}>{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ margin: '2px 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          {entry.name || 'Value'}: <strong style={{ color: 'var(--color-text)' }}>{entry.value}</strong>
        </p>
      ))}
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="page analytics-page">
      <div className="skeleton-block analytics-skeleton-header" />
      <div className="analytics-kpi-grid">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-block analytics-skeleton-kpi" />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div className="skeleton-block analytics-skeleton-panel" />
        <div className="skeleton-block analytics-skeleton-panel" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div className="skeleton-block analytics-skeleton-panel" />
        <div className="skeleton-block analytics-skeleton-panel" />
      </div>
      <div className="skeleton-block analytics-skeleton-panel-full" />
    </div>
  )
}

function Analytics() {
  const [players, setPlayers] = useState([])
  const [recruits, setRecruits] = useState([])
  const [statusHistories, setStatusHistories] = useState({})
  const [breakoutPlayers, setBreakoutPlayers] = useState([])
  const [isBreakoutDemo, setIsBreakoutDemo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [classYearFilter, setClassYearFilter] = useState('all')
  const [isExporting, setIsExporting] = useState(false)
  const [positionGoals, setPositionGoals] = useState({})
  const [editingGoalPos, setEditingGoalPos] = useState(null)
  const [editingGoalValue, setEditingGoalValue] = useState('')
  const [editingCompositeGoal, setEditingCompositeGoal] = useState(false)
  const [editingCompositeValue, setEditingCompositeValue] = useState('')
  const [selectedBoardStatus, setSelectedBoardStatus] = useState(null)
  const [selectedCompositePosition, setSelectedCompositePosition] = useState(null)
  const [selectedRatingTier, setSelectedRatingTier] = useState(null)
  const [selectedCompetitorSchool, setSelectedCompetitorSchool] = useState(null)
  const [benchmarkPosition, setBenchmarkPosition] = useState('QB')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [playersData, recruitsData, breakoutData, goalsData] = await Promise.all([
          loadPlayers(),
          recruitsApi.getAll().catch(() => []),
          performancesApi.getBreakoutPlayers().catch(() => ({ breakoutPlayers: [], isDemo: true })),
          recruitingGoalsApi.get().catch(() => ({})),
        ])
        setPlayers(playersData)
        setRecruits(Array.isArray(recruitsData) ? recruitsData : [])
        setBreakoutPlayers(breakoutData.breakoutPlayers || [])
        setIsBreakoutDemo(breakoutData.isDemo || false)
        setPositionGoals(goalsData && typeof goalsData === 'object' ? goalsData : {})

        // Fetch status history only for players who need it:
        // 1. Committed players (for time-to-commit calculation)
        // 2. Players with "Committed Elsewhere" (for competitor schools analysis)
        const hsPlayers = playersData.filter((p) => {
          if (p.isJuco === true) return false
          if (p.isTransferWishlist === true) return false
          return true
        })
        
        // Identify players who need status history
        const playersNeedingHistory = hsPlayers.filter((p) => {
          const statuses = getStatuses(p).map(s => s.toLowerCase())
          const isCommittedPlayer = statuses.some(s => s === 'committed' || s === 'signed')
          const isCommittedElsewhere = statuses.some(s => s.includes('committed elsewhere') || s.includes('elsewhere'))
          return isCommittedPlayer || isCommittedElsewhere
        })
        
        const histories = {}
        // Fetch status history with batching to avoid rate limits
        const batchSize = 5
        for (let i = 0; i < playersNeedingHistory.length; i += batchSize) {
          const batch = playersNeedingHistory.slice(i, i + batchSize)
          await Promise.all(
            batch.map(async (p) => {
              try {
                const history = await playersApi.getStatusHistory(p.id)
                histories[p.id] = history
              } catch {
                histories[p.id] = []
              }
            })
          )
          // Small delay between batches to avoid rate limiting
          if (i + batchSize < playersNeedingHistory.length) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }
        setStatusHistories(histories)
      } catch (err) {
        console.error('Error loading analytics data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // --- Class Year Filtering ---
  const availableClassYears = useMemo(() => {
    const years = new Set()
    recruits.forEach(r => { if (r.class_year) years.add(String(r.class_year)) })
    players.forEach(p => { if (p.gradYear) years.add(String(p.gradYear)) })
    return [...years].sort()
  }, [recruits, players])

  const filteredRecruits = useMemo(() => {
    if (classYearFilter === 'all') return recruits
    return recruits.filter(r => String(r.class_year) === classYearFilter)
  }, [recruits, classYearFilter])

  const filteredPlayers = useMemo(() => {
    // Filter out JUCO and Transfer players
    const hsPlayers = players.filter((p) => {
      if (p.isJuco === true) return false
      if (p.isTransferWishlist === true) return false
      return true
    })
    if (classYearFilter === 'all') return hsPlayers
    return hsPlayers.filter(p => String(p.gradYear) === classYearFilter)
  }, [players, classYearFilter])

  const filteredBreakoutPlayers = useMemo(() => {
    if (classYearFilter === 'all') return breakoutPlayers
    return breakoutPlayers.filter(bp => {
      const gradYear = bp.player?.gradYear || bp.player?.grad_year || bp.player?.class_year
      return gradYear && String(gradYear) === classYearFilter
    })
  }, [breakoutPlayers, classYearFilter])

  // --- Recruit-based analytics ---

  // Board Summary: count of recruits per status
  const boardSummary = useMemo(() => {
    const statusMap = {}
    filteredRecruits.forEach((r) => {
      const status = getPrimaryRecruitStatus(r)
      statusMap[status] = (statusMap[status] || 0) + 1
    })
    const priority = {
      SIGNED: 1,
      COMMITTED: 2,
      'COMMITTED ELSEWHERE': 3,
      OFFERED: 4,
      RECRUIT: 5,
      EVALUATED: 6,
      PASSED: 7,
      WATCHING: 8,
      UNKNOWN: 99,
    }
    return Object.entries(statusMap)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => (priority[a.status] || 99) - (priority[b.status] || 99))
  }, [filteredRecruits])

  // Position Needs: recruit count per position, color-coded by most common status
  // Also include positions that have a goal > 0 even if no recruits
  const positionNeeds = useMemo(() => {
    const posMap = {}
    filteredRecruits.forEach((r) => {
      const pos = (r.position || '').toUpperCase()
      if (!pos) return
      if (!posMap[pos]) posMap[pos] = { total: 0, statuses: {} }
      posMap[pos].total += 1
      const status = getPrimaryRecruitStatus(r)
      posMap[pos].statuses[status] = (posMap[pos].statuses[status] || 0) + 1
    })

    return POSITION_ORDER
      .filter((pos) => (posMap[pos]?.total > 0) || (positionGoals[pos] > 0))
      .map((pos) => {
        const data = posMap[pos] || { total: 0, statuses: {} }
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
  }, [filteredRecruits, positionGoals])

  // --- Player-based analytics (with demo fallbacks) ---

  // 1. Composite Rating by Position for Committed Players (Bar Graph)
  const committedRatingByPositionReal = useMemo(() => {
    const committedPlayers = filteredPlayers.filter((p) => isCommitted(p) && p.compositeRating != null)
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
  }, [filteredPlayers])

  const isRatingDemo = committedRatingByPositionReal.length === 0
  const committedRatingByPosition = isRatingDemo ? DEMO_COMMITTED_RATINGS : committedRatingByPositionReal

  // 2. Time-to-Commit (Days from offer to commit)
  const timeToCommitReal = useMemo(() => {
    const filteredPlayerIds = new Set(filteredPlayers.map(p => String(p.id)))
    const days = []
    Object.entries(statusHistories).forEach(([playerId, history]) => {
      if (!filteredPlayerIds.has(String(playerId))) return
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
  }, [statusHistories, filteredPlayers])

  const isTimeDemo = timeToCommitReal.count === 0
  const timeToCommit = isTimeDemo ? DEMO_TIME_TO_COMMIT : timeToCommitReal

  // 3. Commit-to-Offer Rate
  // "Offered" includes currently offered + committed/signed (since they were offered first)
  const commitToOfferReal = useMemo(() => {
    const committedCount = filteredPlayers.filter(isCommitted).length
    const currentlyOffered = filteredPlayers.filter(p => isOffered(p) && !isCommitted(p)).length
    const totalOffered = committedCount + currentlyOffered
    const rate = totalOffered > 0 ? parseFloat(((committedCount / totalOffered) * 100).toFixed(1)) : 0
    return { offered: totalOffered, committed: committedCount, rate, pending: currentlyOffered }
  }, [filteredPlayers])

  const isOfferDemo = commitToOfferReal.offered === 0
  const commitToOffer = isOfferDemo ? DEMO_COMMIT_TO_OFFER : commitToOfferReal

  // Donut chart data for Commit-to-Offer
  const commitPieData = [
    { name: 'Committed', value: commitToOffer.committed },
    { name: 'Pending', value: commitToOffer.pending },
  ]

  // 5. Offer-to-commit rate by composite rating tier (81-84, 84-87, etc.)
  const RATING_TIERS = [
    { min: 81, max: 84, label: '81-84' },
    { min: 84, max: 87, label: '84-87' },
    { min: 87, max: 90, label: '87-90' },
    { min: 90, max: 93, label: '90-93' },
    { min: 93, max: 96, label: '93-96' },
    { min: 96, max: 100.01, label: '96-100' },
  ]

  const offerToCommitByTierReal = useMemo(() => {
    return RATING_TIERS.map(({ min, max, label }) => {
      const inTier = filteredPlayers.filter((p) => {
        const rating = p.compositeRating ?? p.composite_rating
        if (rating == null) return false
        const r = Number(rating)
        return r >= min && r < max
      })

      // Treat anyone we've offered, committed to BYU, or who committed elsewhere
      // as part of the \"offered pool\" for this tier.
      const offeredPool = inTier.filter(
        (p) => isOffered(p) || isCommitted(p) || hasCommittedElsewhere(p)
      )
      const committed = offeredPool.filter(isCommitted)

      if (offeredPool.length === 0) {
        return { tier: label, offered: 0, committed: 0, rate: 0 }
      }

      const rawRate = (committed.length / offeredPool.length) * 100
      const rate = parseFloat(Math.min(100, rawRate).toFixed(1))

      return {
        tier: label,
        offered: offeredPool.length,
        committed: committed.length,
        rate,
      }
    }).filter((row) => row.offered > 0)
  }, [filteredPlayers])

  const isTierDemo = offerToCommitByTierReal.length === 0
  const offerToCommitByTier = isTierDemo ? DEMO_OFFER_TO_COMMIT_BY_TIER : offerToCommitByTierReal

  // 4. Top Player Composite Rating by Position
  const topPlayersByPositionReal = useMemo(() => {
    const posMap = {}

    filteredPlayers.forEach((p) => {
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
  }, [filteredPlayers])

  const isTopPlayersDemo = Object.keys(topPlayersByPositionReal).length === 0
  const topPlayersByPosition = isTopPlayersDemo ? DEMO_TOP_PLAYERS : topPlayersByPositionReal

  // Competitor Schools Analysis: Schools Taking Our Offers (HS Players Only)
  const competitorSchools = useMemo(() => {
    const schoolMap = {}
    filteredPlayers.forEach((p) => {
      // Get all statuses
      const rawStatuses = getStatuses(p)
      
      // Check if they committed elsewhere - check exact match first
      const hasCommittedElsewhere = rawStatuses.some(s => {
        const str = String(s).trim()
        // Exact match
        if (str === 'Committed Elsewhere') return true
        // Case-insensitive match
        const strLower = str.toLowerCase()
        return strLower === 'committed elsewhere' ||
               (strLower.includes('committed') && strLower.includes('elsewhere'))
      })
      
      if (!hasCommittedElsewhere) return
      
      // Only include players who were offered by BYU
      // If they have "Committed Elsewhere" status, we assume they were offered (can't commit elsewhere without an offer)
      // But also check explicitly for "Offered" status, offered_date, or status history
      const currentHasOffered = rawStatuses.some(s => {
        const str = String(s).trim()
        return str === 'Offered' || str.toLowerCase() === 'offered'
      })
      
      const hasOfferedDate = !!(p.offeredDate || p.offered_date)
      
      // Check status history - look for "Offered" in any status change
      // Status history stores new_status as an array or string
      const hasOfferedInHistory = statusHistories[p.id] && statusHistories[p.id].some(h => {
        // Check if new_status is an array
        if (Array.isArray(h.new_status)) {
          return h.new_status.some(s => {
            const str = String(s).toLowerCase().trim()
            return str === 'offered' || str.includes('offered')
          })
        }
        // Check if new_status is a string
        const histStatus = String(h.new_status || h.old_status || '').toLowerCase()
        return histStatus.includes('offered') || histStatus === 'offer'
      })
      
      // Check if player has "Offered" in their recruitingStatuses array (even if not current)
      const hasOfferedInStatuses = Array.isArray(p.recruitingStatuses) && 
                                   p.recruitingStatuses.some(s => {
                                     const str = String(s).trim()
                                     return str === 'Offered' || str.toLowerCase() === 'offered'
                                   })
      
      // If they committed elsewhere, assume they were offered (logically required)
      // Otherwise check explicit offered indicators
      const hasBeenOffered = hasCommittedElsewhere || currentHasOffered || hasOfferedDate || hasOfferedInHistory || hasOfferedInStatuses
      
      if (!hasBeenOffered) return
      
      // Get committed school from multiple possible fields (both camelCase and snake_case)
      let committedSchool = (p.committedSchool || p.committed_school || '').trim()
      
      // If empty, try to extract from status notes or other fields
      if (!committedSchool || committedSchool === '') {
        // Sometimes the school might be in the status text like "Committed to clemson"
        const statusText = rawStatuses.join(' ') + ' ' + (p.statusNotes || '')
        const match = statusText.match(/committed\s+to\s+([a-z\s]+)/i)
        if (match) {
          committedSchool = match[1].trim()
        }
      }
      
      // Skip if no school name or if it's empty/unknown
      if (!committedSchool || committedSchool === '' || committedSchool.toLowerCase() === 'unknown') return
      
      // Normalize school name (title case, but preserve common abbreviations)
      const normalizedSchool = committedSchool
        .split(' ')
        .map(word => {
          // Preserve common abbreviations
          if (word.length <= 3 && word === word.toUpperCase()) return word
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        })
        .join(' ')
      
      if (!schoolMap[normalizedSchool]) {
        schoolMap[normalizedSchool] = 0
      }
      schoolMap[normalizedSchool] += 1
    })
    
    const result = Object.entries(schoolMap)
      .filter(([school]) => school && school !== 'Unknown' && school !== '')
      .map(([school, count]) => ({ school, count }))
      .sort((a, b) => b.count - a.count)
    
    // Debug log - always log to help diagnose
    // Check all players for "Committed Elsewhere" status
    const allPlayerStatuses = filteredPlayers.map(p => {
      const rawStatuses = getStatuses(p)
      return {
        name: p.name,
        rawStatuses: rawStatuses,
        recruitingStatuses: p.recruitingStatuses,
        hasCommittedElsewhere: rawStatuses.some(s => {
          const str = String(s).trim()
          return str === 'Committed Elsewhere' ||
                 str.toLowerCase() === 'committed elsewhere' ||
                 (str.toLowerCase().includes('committed') && str.toLowerCase().includes('elsewhere'))
        }),
        committedSchool: p.committedSchool || p.committed_school,
      }
    })
    
    const committedElsewherePlayers = filteredPlayers.filter(p => {
      const rawStatuses = getStatuses(p)
      return rawStatuses.some(s => {
        const str = String(s).trim()
        return str === 'Committed Elsewhere' ||
               str.toLowerCase() === 'committed elsewhere' ||
               (str.toLowerCase().includes('committed') && str.toLowerCase().includes('elsewhere'))
      })
    })
    
    console.log('Competitor Schools Debug:', {
      totalPlayers: filteredPlayers.length,
      committedElsewhereCount: committedElsewherePlayers.length,
      allPlayerStatuses: allPlayerStatuses.filter(p => p.hasCommittedElsewhere || p.committedSchool),
      sampleCommittedPlayer: committedElsewherePlayers[0] ? {
        name: committedElsewherePlayers[0].name,
        rawStatuses: getStatuses(committedElsewherePlayers[0]),
        recruitingStatuses: committedElsewherePlayers[0].recruitingStatuses,
        committedSchool: committedElsewherePlayers[0].committedSchool,
        committed_school: committedElsewherePlayers[0].committed_school,
        isOffered: isOffered(committedElsewherePlayers[0]),
        offeredDate: committedElsewherePlayers[0].offeredDate,
      } : null,
      schoolsFound: Object.keys(schoolMap),
      schoolMapData: schoolMap,
      resultLength: result.length,
      sampleResult: result.slice(0, 3),
    })
    
    return result
  }, [filteredPlayers, statusHistories])

  // KPI summary stats
  const kpiStats = useMemo(() => {
    const totalRecruits = filteredRecruits.length
    const committed = filteredRecruits.filter(r => {
      const s = getPrimaryRecruitStatus(r)
      return s === 'COMMITTED' || s === 'SIGNED'
    }).length
    const offered = filteredRecruits.filter(r => getPrimaryRecruitStatus(r) === 'OFFERED').length
    const commitRate = totalRecruits > 0 ? parseFloat(((committed / totalRecruits) * 100).toFixed(1)) : 0
    return { totalRecruits, committed, offered, commitRate }
  }, [filteredRecruits])

  if (loading) {
    return <AnalyticsSkeleton />
  }

  const handleExportPDF = async () => {
    setIsExporting(true)
    try {
      await exportAnalyticsDashboardPDF({
        kpiStats,
        boardSummary,
        committedRatingByPosition,
        topPlayersByPosition,
        classYearFilter,
      })
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      setIsExporting(false)
    }
  }

  // Progress bar position for time-to-commit
  const timeRange = timeToCommit.max - timeToCommit.min
  const timeProgress = timeRange > 0 ? ((timeToCommit.avg - timeToCommit.min) / timeRange) * 100 : 50

  return (
    <div className="page analytics-page analytics-v2">
      {/* ── HEADER ──────────────────────────────────────────── */}
      <div className="av2-header">
        <div>
          <span className="av2-eyebrow">BYU Football · Recruiting Intelligence</span>
          <h1 className="av2-title">Analytics Command</h1>
        </div>
        <div className="av2-header-right">
          {availableClassYears.length > 0 && (
            <div className="av2-filter-row">
              <span className="av2-filter-label">Class Year</span>
              <div className="av2-filter-pills">
                <button className={`av2-pill${classYearFilter === 'all' ? ' active' : ''}`} onClick={() => setClassYearFilter('all')}>All</button>
                {availableClassYears.map(year => (
                  <button key={year} className={`av2-pill${classYearFilter === year ? ' active' : ''}`} onClick={() => setClassYearFilter(year)}>{year}</button>
                ))}
              </div>
            </div>
          )}
          <button className="av2-export" onClick={handleExportPDF} disabled={isExporting}>
            {isExporting ? 'Generating…' : '⬇ Export PDF'}
          </button>
        </div>
      </div>

      {/* ── 01 / BIG 12 BENCHMARKING ────────────────────────── */}
      <div className="av2-sh">
        <span className="av2-sh-num">01</span>
        <span className="av2-sh-t">Big 12 Benchmarking</span>
        <span className="av2-sh-s">Composite trend · position prototypes</span>
      </div>
      <div className="av2-panel av2-bench-layout">
        <div className="av2-bench-chart">
          <p className="av2-chart-label">BYU Team Avg Composite · 2016–2025</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={BYU_TEAM_COMPOSITE_BY_YEAR} margin={{ top: 8, right: 16, left: 0, bottom: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--av2-grid)" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'var(--av2-muted)', fontFamily: "'DM Mono', monospace" }} tickLine={false} axisLine={false} />
              <YAxis domain={[80, 90]} tick={{ fontSize: 11, fill: 'var(--av2-muted)', fontFamily: "'DM Mono', monospace" }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceArea x1={2023} x2={2025} fill={BYU_BLUE} fillOpacity={0.07} />
              <Line type="monotone" dataKey="avgComposite" name="BYU Avg" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 3, fill: '#3B82F6' }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="av2-chart-note">Shaded region = Big 12 era (2023+)</p>
        </div>
        <div className="av2-bench-proto">
          <div className="av2-bench-proto-head">
            <p className="av2-chart-label" style={{ margin: 0 }}>Position Prototype</p>
            <select
              value={benchmarkPosition}
              onChange={(e) => setBenchmarkPosition(e.target.value)}
              className="av2-select"
            >
              {['QB','RB','WR (slot)','WR (wideout)','TE','OT','OG','DE','DT','LB','CB','S'].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          {(() => {
            const normPos = normalizeBenchmarkPosition(benchmarkPosition) || benchmarkPosition
            const big12 = BIG12_STARTER_AVG_BY_POSITION[normPos]
            const nfl = BYU_NFL_AVG_BY_POSITION[normPos]
            const fmtIn = (v) => typeof v === 'number' ? `${Math.floor(v / 12)}'${(v % 12).toFixed(1)}"` : '—'
            return (
              <div className="av2-proto-cards">
                <div className="av2-proto-card av2-proto-big12">
                  <div className="av2-proto-badge">Big 12 Starter · 2025</div>
                  <div className="av2-proto-pos">{normPos}</div>
                  <div className="av2-proto-stats">
                    <div className="av2-proto-stat">
                      <span className="av2-proto-stat-v">{fmtIn(big12?.height_in)}</span>
                      <span className="av2-proto-stat-l">Height</span>
                    </div>
                    <div className="av2-proto-stat">
                      <span className="av2-proto-stat-v">{big12?.weight_lb ?? '—'} lb</span>
                      <span className="av2-proto-stat-l">Weight</span>
                    </div>
                  </div>
                </div>
                <div className="av2-proto-card av2-proto-nfl">
                  <div className="av2-proto-badge">BYU NFL Avg</div>
                  <div className="av2-proto-pos">{normPos}</div>
                  <div className="av2-proto-stats av2-proto-stats-grid">
                    <div className="av2-proto-stat">
                      <span className="av2-proto-stat-v">{nfl?.composite != null ? (nfl.composite * 100).toFixed(1) : '—'}</span>
                      <span className="av2-proto-stat-l">Composite</span>
                    </div>
                    <div className="av2-proto-stat">
                      <span className="av2-proto-stat-v">{typeof nfl?.forty === 'number' ? nfl.forty.toFixed(2) : '—'}s</span>
                      <span className="av2-proto-stat-l">40-yard</span>
                    </div>
                    <div className="av2-proto-stat">
                      <span className="av2-proto-stat-v">{fmtIn(nfl?.height_in)}</span>
                      <span className="av2-proto-stat-l">Height</span>
                    </div>
                    <div className="av2-proto-stat">
                      <span className="av2-proto-stat-v">{typeof nfl?.weight_lb === 'number' ? nfl.weight_lb.toFixed(0) : '—'} lb</span>
                      <span className="av2-proto-stat-l">Weight</span>
                    </div>
                    <div className="av2-proto-stat">
                      <span className="av2-proto-stat-v">{typeof nfl?.arm === 'number' ? nfl.arm.toFixed(1) : '—'}"</span>
                      <span className="av2-proto-stat-l">Arm</span>
                    </div>
                    <div className="av2-proto-stat">
                      <span className="av2-proto-stat-v">{typeof nfl?.hand === 'number' ? nfl.hand.toFixed(1) : '—'}"</span>
                      <span className="av2-proto-stat-l">Hand</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* ── KPI ROW ─────────────────────────────────────────── */}
      <div className="av2-kpi-row">
        {[
          { label: 'Total Recruits', value: kpiStats.totalRecruits, color: '#3B82F6' },
          { label: 'Committed', value: kpiStats.committed, color: '#16a34a' },
          { label: 'Offered', value: kpiStats.offered, color: '#6366F1' },
          { label: 'Commit Rate', value: `${kpiStats.commitRate}%`, color: kpiStats.commitRate >= 50 ? '#16a34a' : '#F59E0B' },
        ].map((k, i) => (
          <div key={k.label} className="av2-kpi" style={{ '--kc': k.color, animationDelay: `${i * 60}ms` }}>
            <span className="av2-kpi-n">{k.value}</span>
            <span className="av2-kpi-l">{k.label}</span>
            <div className="av2-kpi-line" />
          </div>
        ))}
      </div>

      {/* ── 02 / RECRUITING BOARD ───────────────────────────── */}
      <div className="av2-sh">
        <span className="av2-sh-num">02</span>
        <span className="av2-sh-t">Recruiting Board</span>
        <span className="av2-sh-s">Status breakdown · {filteredRecruits.length} total recruits</span>
      </div>
      <div className="av2-two-col">
        <div className="av2-panel">
          <p className="av2-chart-label">Status Breakdown</p>
          {boardSummary.length === 0 ? (
            <p className="av2-empty">No recruits on the board yet</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={boardSummary.length * 42 + 16}>
                <BarChart data={boardSummary} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--av2-grid)" horizontal={false} />
                  <YAxis dataKey="status" type="category" tick={{ fontSize: 11, fill: 'var(--av2-muted)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, letterSpacing: '0.03em' }} tickLine={false} axisLine={false} width={128} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--av2-muted)' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Recruits" radius={[0, 4, 4, 0]} maxBarSize={24}>
                    {boardSummary.map((e) => (
                      <Cell key={e.status} cursor="pointer"
                        fill={selectedBoardStatus === e.status ? BYU_BLUE_LIGHT : getStatusColor(e.status)}
                        onClick={() => setSelectedBoardStatus(selectedBoardStatus === e.status ? null : e.status)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {selectedBoardStatus && (
                <p style={{ marginTop: 8, fontSize: 11, color: 'var(--av2-muted)' }}>
                  Focus: {selectedBoardStatus} · {boardSummary.find(b => b.status === selectedBoardStatus)?.count ?? 0} recruits
                </p>
              )}
            </>
          )}
        </div>

        <div className="av2-panel av2-ttc-panel">
          <p className="av2-chart-label">Time to Commit{isTimeDemo && <span className="av2-demo-badge">DEMO</span>}</p>
          <p style={{ fontSize: 11, color: 'var(--av2-muted)', margin: '0 0 4px' }}>Avg days from offer to commitment</p>
          <div className="av2-ttc-hero">
            <span className="av2-ttc-num">{timeToCommit.avg}</span>
            <span className="av2-ttc-unit">days</span>
          </div>
          <div className="av2-ttc-bar-wrap">
            <div className="av2-ttc-bar-labels">
              <span>{timeToCommit.min}d fastest</span>
              <span>{timeToCommit.max}d slowest</span>
            </div>
            <div className="av2-ttc-track">
              <div className="av2-ttc-fill" style={{ width: `${timeProgress}%` }} />
              <div className="av2-ttc-dot" style={{ left: `${timeProgress}%` }} />
            </div>
          </div>
          <div className="av2-ttc-stats">
            <div className="av2-ttc-stat">
              <span className="av2-ttc-stat-v" style={{ color: '#22C55E' }}>{timeToCommit.min}</span>
              <span className="av2-ttc-stat-l">Fastest</span>
            </div>
            <div className="av2-ttc-stat av2-ttc-stat-mid">
              <span className="av2-ttc-stat-v" style={{ color: '#002E5D' }}>{timeToCommit.median}</span>
              <span className="av2-ttc-stat-l">Median</span>
            </div>
            <div className="av2-ttc-stat">
              <span className="av2-ttc-stat-v" style={{ color: '#EF4444' }}>{timeToCommit.max}</span>
              <span className="av2-ttc-stat-l">Slowest</span>
            </div>
          </div>
          <p style={{ fontSize: 11, color: 'var(--av2-muted)', marginTop: 6 }}>
            Based on {timeToCommit.count} player{timeToCommit.count !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* ── 03 / COMPOSITE RATINGS ──────────────────────────── */}
      <div className="av2-sh" style={{ marginTop: 28 }}>
        <span className="av2-sh-num">03</span>
        <span className="av2-sh-t">Composite Rating by Position</span>
        <div className="av2-sh-right">
          {isRatingDemo && <span className="av2-demo-badge">DEMO</span>}
          <div className="av2-goal-edit">
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--av2-muted)' }}>Goal Line</span>
            {editingCompositeGoal ? (
              <input type="number" step="0.01" min="0" max="100" autoFocus className="av2-goal-input"
                value={editingCompositeValue}
                onChange={e => setEditingCompositeValue(e.target.value)}
                onBlur={() => {
                  const num = parseFloat(editingCompositeValue)
                  const ng = { ...positionGoals, compositeRatingGoal: isNaN(num) ? COMPOSITE_GOAL_DEFAULT : num }
                  setPositionGoals(ng); setEditingCompositeGoal(false)
                  recruitingGoalsApi.save(ng).catch(console.error)
                }}
                onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingCompositeGoal(false) }}
              />
            ) : (
              <span className="av2-goal-val"
                onClick={() => { setEditingCompositeGoal(true); setEditingCompositeValue(String(positionGoals.compositeRatingGoal ?? COMPOSITE_GOAL_DEFAULT)) }}
                title="Click to edit goal">
                {positionGoals.compositeRatingGoal ?? COMPOSITE_GOAL_DEFAULT}+
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="av2-two-col">
        <div className="av2-panel" style={{ gridColumn: '1 / -1' }}>
          <ResponsiveContainer width="100%" height={290}>
            <BarChart data={committedRatingByPosition} margin={{ top: 10, right: 16, left: 8, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--av2-grid)" vertical={false} />
              <XAxis dataKey="position" tick={{ fontSize: 11, fill: 'var(--av2-muted)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600 }} angle={-40} textAnchor="end" height={56} tickLine={false} axisLine={false} />
              <YAxis domain={[75, 100]} tick={{ fontSize: 11, fill: 'var(--av2-muted)', fontFamily: "'DM Mono',monospace" }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={positionGoals.compositeRatingGoal ?? COMPOSITE_GOAL_DEFAULT} stroke="#EF4444" strokeDasharray="6 3" strokeWidth={1.5} />
              <Bar dataKey="avgRating" name="Avg Rating" radius={[4, 4, 0, 0]}>
                {committedRatingByPosition.map(row => (
                  <Cell key={row.position} cursor="pointer"
                    fill={selectedCompositePosition === row.position ? BYU_BLUE : '#3B82F6'}
                    onClick={() => setSelectedCompositePosition(selectedCompositePosition === row.position ? null : row.position)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--av2-muted)', marginTop: 4 }}>
            {committedRatingByPosition.reduce((s, p) => s + p.count, 0)} committed players
            {selectedCompositePosition && ` · Focus: ${selectedCompositePosition} — ${committedRatingByPosition.find(p => p.position === selectedCompositePosition)?.avgRating} avg`}
          </p>
        </div>
      </div>

      {/* ── 04 / COMMIT ANALYTICS ───────────────────────────── */}
      <div className="av2-sh" style={{ marginTop: 28 }}>
        <span className="av2-sh-num">04</span>
        <span className="av2-sh-t">Commitment Analytics</span>
        <span className="av2-sh-s">Commit rate · offer-to-commit by rating tier</span>
      </div>
      <div className="av2-two-col">
        <div className="av2-panel av2-donut-panel">
          <p className="av2-chart-label" style={{ alignSelf: 'stretch' }}>Commit-to-Offer Rate{isOfferDemo && <span className="av2-demo-badge">DEMO</span>}</p>
          <p style={{ fontSize: 11, color: 'var(--av2-muted)', margin: '0 0 4px', alignSelf: 'stretch' }}>% of offered players who committed</p>
          <div className="av2-donut-wrap">
            <div style={{ position: 'relative', width: 200, height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={commitPieData} innerRadius={62} outerRadius={88} dataKey="value" startAngle={90} endAngle={-270} stroke="none">
                    <Cell fill="#3B82F6" />
                    <Cell fill="var(--av2-grid)" />
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 28, fontWeight: 500, color: '#3B82F6', lineHeight: 1 }}>{commitToOffer.rate}%</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--av2-muted)', marginTop: 4 }}>Commit Rate</div>
              </div>
            </div>
          </div>
          <div className="av2-donut-legend">
            <div className="av2-legend-item"><div className="av2-legend-dot" style={{ background: '#3B82F6' }} /><span>Committed</span><strong style={{ marginLeft: 4 }}>{commitToOffer.committed}</strong></div>
            <div className="av2-legend-item"><div className="av2-legend-dot" style={{ background: 'var(--av2-grid)', border: '1px solid var(--color-border)' }} /><span>Pending</span><strong style={{ marginLeft: 4 }}>{commitToOffer.pending}</strong></div>
          </div>
          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--av2-muted)', marginTop: 8 }}>{commitToOffer.offered} total offered</p>
        </div>

        <div className="av2-panel">
          <p className="av2-chart-label">Offer → Commit Rate by Rating Tier{isTierDemo && <span className="av2-demo-badge">DEMO</span>}</p>
          {offerToCommitByTier.length === 0 ? (
            <p className="av2-empty">No offered players with composite ratings yet</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={offerToCommitByTier} margin={{ top: 8, right: 16, left: 8, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--av2-grid)" vertical={false} />
                  <XAxis dataKey="tier" tick={{ fontSize: 11, fill: 'var(--av2-muted)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600 }}
                    label={{ value: 'Composite Rating', position: 'insideBottom', offset: -8, style: { fill: 'var(--av2-muted)', fontSize: 11 } }}
                    tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--av2-muted)', fontFamily: "'DM Mono',monospace" }} tickFormatter={v => `${v}%`} tickLine={false} axisLine={false} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const row = payload[0]?.payload
                    if (!row) return null
                    return (
                      <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 13 }}>{row.tier}</p>
                        <p style={{ margin: '2px 0', fontSize: 12 }}>Offered: <strong>{row.offered}</strong></p>
                        <p style={{ margin: '2px 0', fontSize: 12 }}>Committed: <strong>{row.committed}</strong></p>
                        <p style={{ margin: '2px 0', fontSize: 12 }}>Rate: <strong>{row.rate}%</strong></p>
                      </div>
                    )
                  }} />
                  <Bar dataKey="rate" name="Rate (%)" radius={[4, 4, 0, 0]}>
                    {offerToCommitByTier.map(row => (
                      <Cell key={row.tier} cursor="pointer"
                        fill={selectedRatingTier === row.tier ? BYU_BLUE : '#6366F1'}
                        onClick={() => setSelectedRatingTier(selectedRatingTier === row.tier ? null : row.tier)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--av2-muted)', marginTop: 4 }}>
                {offerToCommitByTier.reduce((s, d) => s + d.offered, 0)} total offered
                {selectedRatingTier && (() => { const r = offerToCommitByTier.find(t => t.tier === selectedRatingTier); return r ? ` · ${r.tier}: ${r.committed}/${r.offered} (${r.rate}%)` : '' })()}
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── 05 / COMPETITOR INTELLIGENCE ────────────────────── */}
      {competitorSchools.length > 0 && (
        <>
          <div className="av2-sh" style={{ marginTop: 28 }}>
            <span className="av2-sh-num">05</span>
            <span className="av2-sh-t">Competitor Intelligence</span>
            <span className="av2-sh-s">HS players who chose another school after our offer</span>
          </div>
          <div className="av2-panel">
            <p className="av2-chart-label">Schools Taking Our Offers</p>
            <div className="av2-school-list">
              {competitorSchools.slice(0, 12).map((s, i) => (
                <div key={s.school} className={`av2-school-row${selectedCompetitorSchool === s.school ? ' active' : ''}`}
                  onClick={() => setSelectedCompetitorSchool(selectedCompetitorSchool === s.school ? null : s.school)}>
                  <span className="av2-school-rank-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="av2-school-name">{s.school}</span>
                  <div className="av2-school-bar-wrap">
                    <div className="av2-school-bar" style={{ width: `${(s.count / competitorSchools[0].count) * 100}%` }} />
                  </div>
                  <span className="av2-school-count">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── 06 / POSITION NEEDS ─────────────────────────────── */}
      {positionNeeds.length > 0 && (
        <>
          <div className="av2-sh" style={{ marginTop: 28 }}>
            <span className="av2-sh-num">06</span>
            <span className="av2-sh-t">Position Needs</span>
            <span className="av2-sh-s">Recruiting status by position · click goal to edit</span>
          </div>
          <div className="av2-panel">
            <div className="av2-pos-grid">
              {positionNeeds.map(pos => {
                const committedCount = (pos.statuses['COMMITTED'] || 0) + (pos.statuses['SIGNED'] || 0)
                const offeredCount = pos.statuses['OFFERED'] || 0
                const goalValue = positionGoals[pos.position] || 0
                const isEditing = editingGoalPos === pos.position
                const fillPct = goalValue > 0 ? Math.min(100, (committedCount / goalValue) * 100) : 0
                return (
                  <div key={pos.position}
                    className={`av2-pos-card${selectedCompositePosition === pos.position ? ' active' : ''}`}
                    onClick={() => setSelectedCompositePosition(selectedCompositePosition === pos.position ? null : pos.position)}>
                    <div className="av2-pos-header">
                      <span className="av2-pos-name">{pos.position}</span>
                      <span className="av2-pos-total">{pos.count}</span>
                    </div>
                    <div className="av2-pos-stats">
                      <div className="av2-pos-stat">
                        <span style={{ color: '#22C55E' }}>{committedCount}</span>
                        <span className="av2-pos-stat-l">Committed</span>
                      </div>
                      <div className="av2-pos-stat">
                        <span style={{ color: '#3B82F6' }}>{offeredCount}</span>
                        <span className="av2-pos-stat-l">Offered</span>
                      </div>
                    </div>
                    {goalValue > 0 && (
                      <div className="av2-pos-progress">
                        <div className="av2-pos-progress-fill" style={{ width: `${fillPct}%` }} />
                      </div>
                    )}
                    <div className="av2-pos-goal-row">
                      <span className="av2-pos-stat-l">Goal</span>
                      {isEditing ? (
                        <input type="number" min="0" autoFocus className="av2-goal-input"
                          value={editingGoalValue}
                          onChange={e => setEditingGoalValue(e.target.value)}
                          onBlur={() => {
                            const num = parseInt(editingGoalValue, 10)
                            const ng = { ...positionGoals, [pos.position]: isNaN(num) ? 0 : num }
                            setPositionGoals(ng); setEditingGoalPos(null)
                            recruitingGoalsApi.save(ng).catch(console.error)
                          }}
                          onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingGoalPos(null) }}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <span className="av2-goal-val"
                          onClick={e => { e.stopPropagation(); setEditingGoalPos(pos.position); setEditingGoalValue(String(goalValue)) }}
                          title="Click to edit goal">
                          {goalValue || '—'}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* ── 07 / BREAKOUT PLAYERS ───────────────────────────── */}
      {filteredBreakoutPlayers.length > 0 && (
        <>
          <div className="av2-sh" style={{ marginTop: 28 }}>
            <span className="av2-sh-num">07</span>
            <span className="av2-sh-t">Breakout Players</span>
            <span className="av2-sh-s">Latest game significantly exceeded season average{isBreakoutDemo && ' · sample data'}</span>
          </div>
          <div className="av2-panel">
            <div className="av2-breakout-grid">
              {filteredBreakoutPlayers.map(bp => (
                <div key={bp.player.id} className="av2-breakout-card">
                  <div className="av2-breakout-score" style={{ background: bp.breakoutScore >= 2.5 ? '#22C55E' : '#F59E0B' }}>
                    {bp.breakoutScore.toFixed(1)}×
                  </div>
                  <div>
                    <div className="av2-breakout-name-row">
                      <Link to={`/player/${bp.player.id}/stats`} className="av2-breakout-name">{bp.player.name}</Link>
                      <span className="av2-pos-badge">{bp.player.position}</span>
                      {bp.grade && <span className="av2-grade-badge">{bp.grade}</span>}
                    </div>
                    <div className="av2-breakout-meta">
                      {bp.player.school} · vs. {bp.game.opponent} · {new Date(bp.game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <div className="av2-breakout-stats">
                    {bp.keyStats.map(stat => (
                      <div key={stat.statType} className="av2-breakout-stat">
                        <span className="av2-breakout-stat-label">{stat.statType}</span>
                        <span className="av2-breakout-stat-game">{stat.gameValue}{stat.unit ? ` ${stat.unit}` : ''}</span>
                        <span className="av2-breakout-stat-avg">avg {stat.seasonAvg}{stat.unit ? ` ${stat.unit}` : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── 08 / TOP PROSPECTS ──────────────────────────────── */}
      <div className="av2-sh" style={{ marginTop: 28 }}>
        <span className="av2-sh-num">08</span>
        <span className="av2-sh-t">Top Prospects by Position</span>
        <span className="av2-sh-s">Top 3 by composite rating{isTopPlayersDemo && ' · sample data'}</span>
      </div>
      <div className="av2-panel">
        <div className="av2-top-grid">
          {POSITION_ORDER.filter(pos => topPlayersByPosition[pos]?.length > 0).map(pos => (
            <div key={pos} className="av2-top-pos-group">
              <div className="av2-top-pos-header">
                <span className="av2-pos-badge av2-pos-badge-lg">{pos}</span>
              </div>
              {topPlayersByPosition[pos].map((player, idx) => (
                <div key={player.id} className={`av2-top-player${idx === 0 ? ' av2-top-player-1' : ''}`}>
                  <span className="av2-top-rank">#{idx + 1}</span>
                  <div className="av2-top-player-info">
                    <Link to={`/player/${player.id}/stats`} className="av2-top-player-name">{player.name}</Link>
                    <span className="av2-top-player-school">{player.school || '—'}</span>
                  </div>
                  <span className="av2-top-rating" style={{ color: player.rating >= 88 ? '#22C55E' : player.rating >= 85 ? '#002E5D' : '#F59E0B' }}>
                    {player.rating.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Analytics
