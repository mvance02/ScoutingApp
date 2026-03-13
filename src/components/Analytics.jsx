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
    <div className="page analytics-page">
      {/* Dashboard Header */}
      <div className="analytics-dashboard-header">
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
        <button
          className="btn-primary"
          onClick={handleExportPDF}
          disabled={isExporting}
          style={{ whiteSpace: 'nowrap' }}
        >
          {isExporting ? 'Exporting...' : 'Export PDF'}
        </button>
      </div>

      {/* Class Year Filter */}
      {availableClassYears.length > 0 && (
        <div className="analytics-filter-bar">
          <span className="filter-label">Class Year:</span>
          <button
            className={`analytics-filter-pill${classYearFilter === 'all' ? ' active' : ''}`}
            onClick={() => setClassYearFilter('all')}
          >
            All
          </button>
          {availableClassYears.map(year => (
            <button
              key={year}
              className={`analytics-filter-pill${classYearFilter === year ? ' active' : ''}`}
              onClick={() => setClassYearFilter(year)}
            >
              {year}
            </button>
          ))}
        </div>
      )}

      {/* Big 12 Benchmarking */}
      <section className="panel" style={{
        padding: '24px',
        marginBottom: '24px',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}>
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 600, color: BYU_BLUE }}>
            Big 12 Benchmarking
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
            BYU recruiting profile trend + Big 12/NFL prototypes by position
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '24px' }}>
          {/* Trend line */}
          <div>
            <div style={{ marginBottom: '8px', fontSize: '13px', color: '#6b7280' }}>
              BYU Team Avg Composite Rating (2016–2025)
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={BYU_TEAM_COMPOSITE_BY_YEAR} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#6b7280' }} />
                <YAxis
                  domain={[80, 90]}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  label={{ value: 'Composite', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#6b7280', fontSize: 12 } }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                {/* Shade Big 12 era */}
                <ReferenceArea x1={2023} x2={2025} fill={BYU_BLUE_TINT} fillOpacity={0.7} />
                <Line type="monotone" dataKey="avgComposite" name="BYU Avg Composite" stroke="#4169E1" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
              Shaded region shows Big 12 era (2023+).
            </div>
          </div>

          {/* Archetype cards */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>Position prototypes</div>
              <select
                value={benchmarkPosition}
                onChange={(e) => setBenchmarkPosition(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-card)' }}
              >
                {[
                  'QB',
                  'RB',
                  'WR (slot)',
                  'WR (wideout)',
                  'TE',
                  'OT',
                  'OG',
                  'DE',
                  'DT',
                  'LB',
                  'CB',
                  'S',
                ].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {(() => {
              const normPos = normalizeBenchmarkPosition(benchmarkPosition) || benchmarkPosition
              const big12 = BIG12_STARTER_AVG_BY_POSITION[normPos]
              const nfl = BYU_NFL_AVG_BY_POSITION[normPos] || null
              return (
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <strong style={{ color: BYU_BLUE }}>Big 12 {normPos} Prototype</strong>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>Avg starter (2025)</span>
                    </div>
                    <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                      <div><span style={{ color: '#6b7280' }}>Height</span><div style={{ fontWeight: 700 }}>{big12?.height_in ?? '—'} in</div></div>
                      <div><span style={{ color: '#6b7280' }}>Weight</span><div style={{ fontWeight: 700 }}>{big12?.weight_lb ?? '—'} lb</div></div>
                      <div style={{ gridColumn: '1 / -1', color: '#6b7280', fontSize: '12px' }}>
                        Composite rating not available for Big 12 starters in this dataset.
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <strong style={{ color: BYU_BLUE }}>NFL {normPos} Prototype</strong>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>BYU NFL averages</span>
                    </div>
                    <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                      <div><span style={{ color: '#6b7280' }}>Composite</span><div style={{ fontWeight: 700 }}>{nfl?.composite != null ? (nfl.composite * 100).toFixed(2) : '—'}</div></div>
                      <div><span style={{ color: '#6b7280' }}>40</span><div style={{ fontWeight: 700 }}>{typeof nfl?.forty === 'number' ? nfl.forty.toFixed(2) : '—'}</div></div>
                      <div><span style={{ color: '#6b7280' }}>Height</span><div style={{ fontWeight: 700 }}>{typeof nfl?.height_in === 'number' ? nfl.height_in.toFixed(1) : '—'} in</div></div>
                      <div><span style={{ color: '#6b7280' }}>Weight</span><div style={{ fontWeight: 700 }}>{typeof nfl?.weight_lb === 'number' ? nfl.weight_lb.toFixed(0) : '—'} lb</div></div>
                      <div><span style={{ color: '#6b7280' }}>Arm</span><div style={{ fontWeight: 700 }}>{typeof nfl?.arm === 'number' ? nfl.arm.toFixed(2) : '—'} in</div></div>
                      <div><span style={{ color: '#6b7280' }}>Hand</span><div style={{ fontWeight: 700 }}>{typeof nfl?.hand === 'number' ? nfl.hand.toFixed(2) : '—'} in</div></div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </section>

      {/* KPI Summary Row */}
      <div className="analytics-kpi-grid">
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

      {/* Breakout Players */}
      {filteredBreakoutPlayers.length > 0 && (
        <section className="panel" style={{
          padding: '24px',
          marginBottom: '24px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 600, color: BYU_BLUE }}>
              Breakout Players
            </h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
              Players whose latest game significantly exceeded their season average
              {isBreakoutDemo && <span style={{ marginLeft: '8px', fontStyle: 'italic', color: '#f59e0b' }}>(Sample Data)</span>}
            </p>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '16px',
          }}>
            {filteredBreakoutPlayers.map((bp) => (
              <div key={bp.player.id} style={{
                padding: '16px',
                background: 'var(--color-bg-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--color-border)',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Breakout score badge */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: bp.breakoutScore >= 2.5 ? '#16a34a' : '#f59e0b',
                  color: 'white',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  fontSize: '14px',
                  fontWeight: 700,
                }}>
                  {bp.breakoutScore.toFixed(1)}x
                </div>

                {/* Player info */}
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <Link to={`/player/${bp.player.id}/stats`} className="analytics-player-link" style={{ fontSize: '15px', fontWeight: 600 }}>{bp.player.name}</Link>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'white',
                      background: BYU_BLUE,
                      padding: '1px 8px',
                      borderRadius: '4px',
                    }}>
                      {bp.player.position}
                    </span>
                    {bp.grade && (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: BYU_BLUE,
                        background: BYU_BLUE_TINT,
                        padding: '1px 8px',
                        borderRadius: '4px',
                        border: `1px solid ${BYU_BLUE}`,
                      }}>
                        {bp.grade}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {bp.player.school} &middot; vs. {bp.game.opponent} &middot; {new Date(bp.game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>

                {/* Key stat comparisons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {bp.keyStats.map((stat) => (
                    <div key={stat.statType} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '13px',
                      padding: '4px 8px',
                      background: 'var(--color-bg-primary, #f9fafb)',
                      borderRadius: '6px',
                    }}>
                      <span style={{ color: '#6b7280', fontWeight: 500 }}>{stat.statType}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, color: '#16a34a' }}>
                          {stat.gameValue}{stat.unit ? ` ${stat.unit}` : ''}
                        </span>
                        <span style={{ color: '#16a34a', fontSize: '11px' }}>&#9650;</span>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>
                          (avg {stat.seasonAvg}{stat.unit ? ` ${stat.unit}` : ''})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
              Recruit count by status &middot; {filteredRecruits.length} total
            </p>
          </div>
          {boardSummary.length === 0 ? (
            <p className="empty-state" style={{ padding: '40px', textAlign: 'center' }}>
              No recruits on the board yet
            </p>
          ) : (
            <>
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
                  <Bar dataKey="count" name="Recruits" radius={[0, 6, 6, 0]} maxBarSize={28}>
                    {boardSummary.map((entry) => (
                      <Cell
                        key={entry.status}
                        cursor="pointer"
                        fill={selectedBoardStatus === entry.status ? BYU_BLUE_LIGHT : '#4169E1'}
                        onClick={() =>
                          setSelectedBoardStatus(
                            selectedBoardStatus === entry.status ? null : entry.status
                          )
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {selectedBoardStatus && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
                  Focus: {selectedBoardStatus} &middot;{' '}
                  {boardSummary.find((b) => b.status === selectedBoardStatus)?.count ?? 0} recruits
                </div>
              )}
            </>
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
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600, color: BYU_BLUE }}>
                Composite Rating by Position
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Goal:</span>
                {editingCompositeGoal ? (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    autoFocus
                    value={editingCompositeValue}
                    onChange={(e) => setEditingCompositeValue(e.target.value)}
                    onBlur={() => {
                      const num = parseFloat(editingCompositeValue)
                      const newGoals = { ...positionGoals, compositeRatingGoal: isNaN(num) ? COMPOSITE_GOAL_DEFAULT : num }
                      setPositionGoals(newGoals)
                      setEditingCompositeGoal(false)
                      recruitingGoalsApi.save(newGoals).catch(console.error)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.target.blur()
                      if (e.key === 'Escape') setEditingCompositeGoal(false)
                    }}
                    style={{ width: '64px', fontSize: '13px', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  />
                ) : (
                  <span
                    onClick={() => {
                      setEditingCompositeGoal(true)
                      setEditingCompositeValue(String(positionGoals.compositeRatingGoal ?? COMPOSITE_GOAL_DEFAULT))
                    }}
                    title="Click to edit composite rating goal"
                    style={{ fontWeight: 600, fontSize: '13px', color: '#dc2626', cursor: 'pointer', borderBottom: '1px dashed #dc2626' }}
                  >
                    {positionGoals.compositeRatingGoal ?? COMPOSITE_GOAL_DEFAULT}+
                  </span>
                )}
              </div>
            </div>
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
                y={positionGoals.compositeRatingGoal ?? COMPOSITE_GOAL_DEFAULT}
                stroke="#dc2626"
                strokeDasharray="6 4"
              />
              <Bar dataKey="avgRating" name="Avg Rating" radius={[6, 6, 0, 0]}>
                {committedRatingByPosition.map((row) => (
                  <Cell
                    key={row.position}
                    cursor="pointer"
                    fill={selectedCompositePosition === row.position ? BYU_BLUE_LIGHT : '#4169E1'}
                    onClick={() =>
                      setSelectedCompositePosition(
                        selectedCompositePosition === row.position ? null : row.position
                      )
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280', textAlign: 'center' }}>
            {committedRatingByPosition.reduce((sum, p) => sum + p.count, 0)} committed players
            {isRatingDemo && ' (sample)'}
          </div>
          {selectedCompositePosition && (
            <div style={{ marginTop: '4px', fontSize: '12px', color: '#6b7280', textAlign: 'center' }}>
              Focus: {selectedCompositePosition} &middot;{' '}
              {
                committedRatingByPosition.find((p) => p.position === selectedCompositePosition)
                  ?.avgRating
              }{' '}
              avg rating
            </div>
          )}
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

      {/* Offer-to-Commit Rate by Rating Tier + Schools Taking Our Offers (side by side) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
        marginBottom: '24px',
      }}>
      <section className="panel" style={{
        padding: '24px',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}>
        <div style={{ marginBottom: '12px' }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600, color: BYU_BLUE }}>
            Offer-to-Commit Rate by Rating Tier
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
            % of offered players who committed, by composite rating bucket
            {isTierDemo && <span style={{ marginLeft: '8px', fontStyle: 'italic', color: '#f59e0b' }}>(Sample Data)</span>}
          </p>
        </div>
        {offerToCommitByTier.length === 0 ? (
          <p className="empty-state" style={{ padding: '40px', textAlign: 'center' }}>
            No offered players with composite ratings yet
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={offerToCommitByTier}
                margin={{ top: 10, right: 20, left: 10, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                <XAxis
                  dataKey="tier"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  label={{ value: 'Composite Rating', position: 'insideBottom', offset: -8, style: { fill: '#6b7280', fontSize: 12 } }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickFormatter={(v) => `${v}%`}
                  label={{
                    value: 'Offer-to-Commit Rate',
                    angle: -90,
                    position: 'insideLeft',
                    style: { textAnchor: 'middle', fill: '#6b7280', fontSize: 12 },
                  }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const row = payload[0]?.payload
                    if (!row) return null
                    return (
                      <div style={{
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        minWidth: '140px',
                      }}>
                        <p style={{ margin: '0 0 6px 0', fontWeight: 700, fontSize: '14px', color: 'var(--color-text)' }}>{row.tier}</p>
                        <p style={{ margin: '2px 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>Offered: <strong>{row.offered}</strong></p>
                        <p style={{ margin: '2px 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>Committed: <strong>{row.committed}</strong></p>
                        <p style={{ margin: '2px 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>Rate: <strong>{row.rate}%</strong></p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="rate" name="Rate (%)" radius={[6, 6, 0, 0]}>
                  {offerToCommitByTier.map((row) => (
                    <Cell
                      key={row.tier}
                      cursor="pointer"
                      fill={selectedRatingTier === row.tier ? BYU_BLUE_LIGHT : '#4169E1'}
                      onClick={() =>
                        setSelectedRatingTier(
                          selectedRatingTier === row.tier ? null : row.tier
                        )
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280', textAlign: 'center' }}>
              {offerToCommitByTier.reduce((sum, d) => sum + d.offered, 0)} total offered across tiers
            </div>
            {selectedRatingTier && (
              <div style={{ marginTop: '4px', fontSize: '12px', color: '#6b7280', textAlign: 'center' }}>
                {(() => {
                  const row = offerToCommitByTier.find((t) => t.tier === selectedRatingTier)
                  if (!row) return null
                  return (
                    <>
                      Focus: {row.tier} &middot; {row.committed}/{row.offered} committed ({row.rate}%)
                    </>
                  )
                })()}
              </div>
            )}
          </>
        )}
      </section>

      {/* Schools Taking Our Offers */}
      <section className="panel" style={{
        padding: '24px',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}>
        <div style={{ marginBottom: '12px' }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600, color: BYU_BLUE }}>
            Schools Taking Our Offers
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
            HS players who committed elsewhere after being offered
          </p>
        </div>
        {competitorSchools.length === 0 ? (
          <p className="empty-state" style={{ padding: '40px', textAlign: 'center' }}>
            No players committed elsewhere yet
          </p>
        ) : (
          <div style={{ width: '100%', height: '280px', minHeight: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={competitorSchools} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 5 }} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.4} horizontal={false} />
                <YAxis
                  dataKey="school"
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
                  <Bar dataKey="count" name="Players" radius={[0, 6, 6, 0]} maxBarSize={28}>
                    {competitorSchools.map((row) => (
                      <Cell
                        key={row.school}
                        cursor="pointer"
                        fill={selectedCompetitorSchool === row.school ? '#fbbf24' : '#f97316'}
                        onClick={() =>
                          setSelectedCompetitorSchool(
                            selectedCompetitorSchool === row.school ? null : row.school
                          )
                        }
                      />
                    ))}
                  </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {selectedCompetitorSchool && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
            Focus: {selectedCompetitorSchool}
          </div>
        )}
      </section>
      </div>

      {/* Position Needs */}
      {positionNeeds.length > 0 && (
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
              Recruiting status by position &middot; Click goal to edit
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
            {positionNeeds.map((pos) => {
              const committedCount = (pos.statuses['COMMITTED'] || 0) + (pos.statuses['SIGNED'] || 0)
              const offeredCount = pos.statuses['OFFERED'] || 0
              const goalValue = positionGoals[pos.position] || 0
              const isEditing = editingGoalPos === pos.position

              return (
                <div
                  key={pos.position}
                  onClick={() =>
                    setSelectedCompositePosition(
                      selectedCompositePosition === pos.position ? null : pos.position
                    )
                  }
                  style={{
                    padding: '12px',
                    background: 'var(--color-bg-secondary)',
                    borderRadius: '10px',
                    border:
                      selectedCompositePosition === pos.position
                        ? `2px solid ${BYU_BLUE_LIGHT}`
                        : '1px solid var(--color-border)',
                    cursor: 'pointer',
                  }}
                >
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                      <span style={{ color: '#16a34a', fontWeight: 500 }}>Committed</span>
                      <span style={{ fontWeight: 600 }}>{committedCount}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                      <span style={{ color: '#2563eb', fontWeight: 500 }}>Offered</span>
                      <span style={{ fontWeight: 600 }}>{offeredCount}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', alignItems: 'center' }}>
                      <span style={{ color: BYU_BLUE, fontWeight: 500 }}>Goal</span>
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          autoFocus
                          value={editingGoalValue}
                          onChange={(e) => setEditingGoalValue(e.target.value)}
                          onBlur={() => {
                            const num = parseInt(editingGoalValue, 10)
                            const newGoals = { ...positionGoals, [pos.position]: isNaN(num) ? 0 : num }
                            setPositionGoals(newGoals)
                            setEditingGoalPos(null)
                            recruitingGoalsApi.save(newGoals).catch(console.error)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.target.blur()
                            if (e.key === 'Escape') setEditingGoalPos(null)
                          }}
                          style={{
                            width: '40px',
                            fontSize: '11px',
                            fontWeight: 600,
                            textAlign: 'right',
                            padding: '1px 4px',
                            border: `1px solid ${BYU_BLUE}`,
                            borderRadius: '4px',
                            outline: 'none',
                            background: 'var(--color-bg-card, white)',
                            color: 'var(--color-text)',
                          }}
                        />
                      ) : (
                        <span
                          onClick={() => {
                            setEditingGoalPos(pos.position)
                            setEditingGoalValue(String(goalValue))
                          }}
                          style={{
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: '1px 4px',
                            borderRadius: '4px',
                            borderBottom: '1px dashed #9ca3af',
                          }}
                          title="Click to edit goal"
                        >
                          {goalValue || '\u2014'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

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
                        <Link to={`/player/${player.id}/stats`} className="analytics-player-link">
                          {player.name}
                        </Link>
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
