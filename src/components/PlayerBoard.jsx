import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Flag, Plus, Trash2, Download, Search, BarChart3, Pencil, Check, X, Users, ChevronLeft, ChevronRight, Camera, UserPlus, SearchX } from 'lucide-react'
import {
  loadData,
  saveData,
  exportToCSV,
  loadPlayers,
  createPlayer,
  updatePlayer,
  deletePlayer,
  uploadPlayerPhoto,
  deletePlayerPhoto,
} from '../utils/storage'
import { assignmentsApi } from '../utils/api'
import byuLogo from '../assets/byu-logo.png'
import EmptyState from './EmptyState'

const POSITIONS = [
  'All',
  'QB',
  'RB',
  'WR (slot)',
  'WR (wideout)',
  'TE',
  'OT',
  'OG',
  'DL',
  'LB',
  'CB',
  'S',
  'K',
  'P',
  'ATH',
]

const PORTAL_STATUSES = [
  '',
  'Not in portal',
  'Expected to enter',
  'In portal',
  'Withdrew',
  'Committed elsewhere',
]

const INTEREST_LEVELS = ['High', 'Medium', 'Low']

const RECRUITING_STATUSES = [
  { value: 'Watching', label: 'Watching', color: 'status-watching' },
  { value: 'Evaluating', label: 'Evaluating', color: 'status-evaluating' },
  { value: 'Interested', label: 'Interested', color: 'status-interested' },
  { value: 'Offered', label: 'Offered', color: 'status-offered' },
  { value: 'Committed', label: 'Committed', color: 'status-committed' },
  { value: 'Committed Elsewhere', label: 'Committed Elsewhere', color: 'status-committed-elsewhere' },
  { value: 'Signed', label: 'Signed', color: 'status-signed' },
  { value: 'Passed', label: 'Passed', color: 'status-passed' },
]

function getPrimaryPositionDisplay(player) {
  const raw = (player.position || '').toUpperCase().trim()
  const offense = (player.offensePosition || '').toUpperCase()
  const defense = (player.defensePosition || '').toUpperCase()

  if (!raw) return 'Position TBD'

  if (raw === 'OL') {
    if (offense.includes('OT') || offense.includes('TACKLE')) return 'OT'
    if (offense.includes('OG') || offense.includes('GUARD')) return 'OG'
    if (offense.includes('C') || offense.includes('CENTER')) return 'OG'
    return 'OT'
  }

  if (raw === 'WR') {
    if (offense.includes('SLOT') || offense.includes('SWR')) return 'WR (slot)'
    if (offense.includes('WIDE') || offense.includes('WWR')) return 'WR (wideout)'
    return 'WR (wideout)'
  }

  if (raw === 'DB') {
    if (defense.includes('CB') || defense.includes('CORNER')) return 'CB'
    if (defense.includes('S') || defense.includes('SAFETY')) return 'S'
    return 'S'
  }

  return player.position || 'Position TBD'
}

function PlayerAvatar({ name, url, size = 40 }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
        padding: size * 0.15,
      }}
    >
      <img
        src={byuLogo}
        alt="BYU"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />
    </div>
  )
}

function PlayerBoard() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [positionFilter, setPositionFilter] = useState('All')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [stateFilter, setStateFilter] = useState('')
  const [gradYearFilter, setGradYearFilter] = useState('')
  const [yearsLeftFilter, setYearsLeftFilter] = useState('')
  const [sideFilter, setSideFilter] = useState('All')
  const [recruitingStatusFilter, setRecruitingStatusFilter] = useState('')
  const [compositeRatingMin, setCompositeRatingMin] = useState('')
  const [compositeRatingMax, setCompositeRatingMax] = useState('')
  const [currentSchoolLevelFilter, setCurrentSchoolLevelFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [playersPerPage] = useState(20)
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [editStatusMenuOpenId, setEditStatusMenuOpenId] = useState(null)
  const [editingPlayerId, setEditingPlayerId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [editErrors, setEditErrors] = useState({})
  const [typeFilter, setTypeFilter] = useState('All') // 'All' | 'JUCO' | 'Transfer'
  const [showAddForm, setShowAddForm] = useState(false)
  const photoInputRef = useRef(null)
  const [form, setForm] = useState({
    name: '',
    position: '',
    offensePosition: '',
    defensePosition: '',
    school: '',
    state: '',
    homeState: '',
    gradYear: '',
    notes: '',
    flagged: false,
    recruitingStatuses: ['Watching'],
    committedSchool: '',
    committedDate: '',
    compositeRating: '',
    isLds: false,
    offeredDate: '',
    eligibilityYearsLeft: '',
    recruitingContext: '',
    immediateImpactTag: '',
    riskNotes: '',
    currentSchoolLevel: '',
    portalStatus: '',
    transferReason: '',
    otherOffers: [],
    playerType: 'JUCO',
  })

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [playersData, assignmentsData] = await Promise.all([
          loadPlayers(),
          assignmentsApi.getAll().catch(() => []),
        ])
        setPlayers(playersData)
        setAssignments(assignmentsData)
      } catch (err) {
        console.error('Error loading data:', err)
        setPlayers(loadData('PLAYERS'))
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      // PlayerBoard: show JUCO and/or Transfer players, filtered by typeFilter
      const isJuco = player.isJuco === true
      const isTransfer = player.isTransferWishlist === true
      if (!isJuco && !isTransfer) return false // exclude HS players
      if (typeFilter === 'JUCO' && !isJuco) return false
      if (typeFilter === 'Transfer' && !isTransfer) return false

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesName = player.name?.toLowerCase().includes(query)
        const matchesSchool = player.school?.toLowerCase().includes(query)
        if (!matchesName && !matchesSchool) return false
      }

      // Position filter
      if (positionFilter !== 'All') {
        const positions = [
          player.position,
          player.offensePosition,
          player.defensePosition,
        ].filter(Boolean)
        const matchesPosition = positions.some(
          (p) => p.toUpperCase() === positionFilter || p.toUpperCase().includes(positionFilter)
        )
        if (!matchesPosition) return false
      }

      // State filter
      if (stateFilter) {
        if (!player.state?.toLowerCase().includes(stateFilter.toLowerCase())) return false
      }

      // Grad year filter
      if (gradYearFilter) {
        if (player.gradYear !== gradYearFilter) return false
      }

      // Years of eligibility left filter (JUCO-only field)
      if (yearsLeftFilter) {
        const yearsLeft = player.eligibilityYearsLeft != null ? Number(player.eligibilityYearsLeft) : null
        const target = Number(yearsLeftFilter)
        if (Number.isNaN(target) || yearsLeft === null || yearsLeft !== target) return false
      }

      // Side filter
      if (sideFilter === 'Offense') {
        if (!player.offensePosition) return false
      } else if (sideFilter === 'Defense') {
        if (!player.defensePosition) return false
      }

      // Recruiting status filter
      if (recruitingStatusFilter) {
        const statuses = player.recruitingStatuses || []
        if (!statuses.includes(recruitingStatusFilter)) return false
      }

      // Flagged filter
      if (flaggedOnly && !player.flagged) return false

      // Composite rating range filter
      if (compositeRatingMin || compositeRatingMax) {
        const rating = player.compositeRating != null ? parseFloat(player.compositeRating) : null
        if (rating === null) return false
        const min = compositeRatingMin ? parseFloat(compositeRatingMin) : 0
        const max = compositeRatingMax ? parseFloat(compositeRatingMax) : 100
        if (rating < min || rating > max) return false
      }

      // Current school level filter
      if (currentSchoolLevelFilter) {
        const level = (player.currentSchoolLevel || '').toLowerCase()
        if (!level.includes(currentSchoolLevelFilter.toLowerCase())) return false
      }

      return true
    })
  }, [
    players,
    searchQuery,
    positionFilter,
    flaggedOnly,
    stateFilter,
    gradYearFilter,
    yearsLeftFilter,
    sideFilter,
    recruitingStatusFilter,
    compositeRatingMin,
    compositeRatingMax,
    currentSchoolLevelFilter,
    typeFilter,
  ])

  // Pagination
  const totalPages = Math.ceil(filteredPlayers.length / playersPerPage)
  const paginatedPlayers = useMemo(() => {
    const start = (currentPage - 1) * playersPerPage
    return filteredPlayers.slice(start, start + playersPerPage)
  }, [filteredPlayers, currentPage, playersPerPage])

  // Get assignments for a player
  const getPlayerAssignments = (playerId) => {
    return assignments.filter((a) => a.player_id === playerId)
  }

  function validatePlayerForm(f) {
    const errors = {}
    if (!f.name?.trim()) errors.name = 'Name is required'
    if ((f.recruitingStatuses || []).includes('Offered') && !f.offeredDate)
      errors.offeredDate = 'Offered date is required'
    if (
      ((f.recruitingStatuses || []).includes('Committed') || (f.recruitingStatuses || []).includes('Signed')) &&
      !f.committedDate
    )
      errors.committedDate = 'Committed date is required'
    return errors
  }

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
    if (name in formErrors) setFormErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const normalizeStatuses = (statuses) => {
    const unique = Array.from(new Set((statuses || []).filter(Boolean)))
    return unique.length > 0 ? unique : ['Watching']
  }

  const updateFormStatuses = (nextStatuses) => {
    const normalized = normalizeStatuses(nextStatuses)
    const hasCommittedElsewhere = normalized.includes('Committed Elsewhere')
    setForm((prev) => ({
      ...prev,
      recruitingStatuses: normalized,
      committedSchool: hasCommittedElsewhere ? prev.committedSchool : '',
      committedDate: hasCommittedElsewhere ? prev.committedDate : '',
    }))
  }

  const updateEditStatuses = (nextStatuses) => {
    const normalized = normalizeStatuses(nextStatuses)
    const hasCommittedElsewhere = normalized.includes('Committed Elsewhere')
    setEditForm((prev) => ({
      ...prev,
      recruitingStatuses: normalized,
      committedSchool: hasCommittedElsewhere ? prev.committedSchool : '',
      committedDate: hasCommittedElsewhere ? prev.committedDate : '',
    }))
  }

  const checkForDuplicates = (name, school, excludeId = null) => {
    const normalizedName = name.trim().toLowerCase()
    const normalizedSchool = school.trim().toLowerCase()
    return players.filter((p) => {
      if (excludeId && String(p.id) === String(excludeId)) return false
      return (
        p.name?.toLowerCase() === normalizedName &&
        p.school?.toLowerCase() === normalizedSchool
      )
    })
  }

  const handleAddPlayer = async (event) => {
    event.preventDefault()

    const errors = validatePlayerForm(form)
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    // Check for duplicates
    const duplicates = checkForDuplicates(form.name, form.school || '')
    if (duplicates.length > 0) {
      setDuplicateWarning(
        `Possible duplicate: ${duplicates[0].name} from ${duplicates[0].school} already exists. Continue anyway?`
      )
      if (!window.confirm(`Possible duplicate: ${duplicates[0].name} from ${duplicates[0].school} already exists. Continue anyway?`)) {
        return
      }
    }

    const newPlayerData = {
      name: form.name.trim(),
      position: form.position.trim(),
      offensePosition: form.offensePosition.trim(),
      defensePosition: form.defensePosition.trim(),
      school: form.school.trim(),
      state: form.state.trim(),
      homeState: form.homeState.trim(),
      gradYear: form.gradYear.trim(),
      notes: form.notes.trim(),
      flagged: false,
      recruitingStatuses: form.recruitingStatuses,
      committedSchool: form.committedSchool.trim(),
      committedDate: form.committedDate,
      compositeRating: form.compositeRating ? parseFloat(form.compositeRating) : null,
      isJuco: form.playerType === 'JUCO',
      isTransferWishlist: form.playerType === 'Transfer',
      isLds: form.isLds || false,
      offeredDate: form.offeredDate || null,
      eligibilityYearsLeft: form.eligibilityYearsLeft !== '' ? Number(form.eligibilityYearsLeft) : null,
      recruitingContext: form.recruitingContext.trim(),
      immediateImpactTag: form.immediateImpactTag.trim(),
      riskNotes: form.riskNotes.trim(),
      currentSchoolLevel: form.currentSchoolLevel.trim(),
      portalStatus: form.portalStatus || '',
      transferReason: form.transferReason.trim(),
      otherOffers: Array.isArray(form.otherOffers)
        ? form.otherOffers.filter((o) => o.school && o.interest)
        : [],
    }

    try {
      const newPlayer = await createPlayer(newPlayerData)
      setPlayers([newPlayer, ...players])
    } catch (err) {
      console.error('Error creating player:', err)
      const fallbackPlayer = { ...newPlayerData, id: Date.now().toString() }
      const nextPlayers = [fallbackPlayer, ...players]
      setPlayers(nextPlayers)
      saveData('PLAYERS', nextPlayers)
    }

    setForm({
      name: '',
      position: '',
      offensePosition: '',
      defensePosition: '',
      school: '',
      state: '',
      homeState: '',
      gradYear: '',
      notes: '',
      flagged: false,
      recruitingStatuses: ['Watching'],
      committedSchool: '',
      committedDate: '',
      compositeRating: '',
      isLds: false,
      offeredDate: '',
      eligibilityYearsLeft: '',
      recruitingContext: '',
      immediateImpactTag: '',
      riskNotes: '',
      currentSchoolLevel: '',
      portalStatus: '',
      transferReason: '',
      otherOffers: [],
      playerType: 'JUCO',
    })
    setStatusMenuOpen(false)
    setDuplicateWarning(null)
  }

  const toggleFlagged = async (playerId) => {
    const player = players.find((p) => p.id === playerId)
    if (!player) return

    const nextPlayers = players.map((p) =>
      p.id === playerId ? { ...p, flagged: !p.flagged } : p
    )
    setPlayers(nextPlayers)

    try {
      await updatePlayer(playerId, { ...player, flagged: !player.flagged })
    } catch (err) {
      console.error('Error updating player:', err)
      saveData('PLAYERS', nextPlayers)
    }
  }

  const toggleCutUpCompleted = async (playerId) => {
    const player = players.find((p) => p.id === playerId)
    if (!player) return

    const nextPlayers = players.map((p) =>
      p.id === playerId ? { ...p, cutUpCompleted: !p.cutUpCompleted } : p
    )
    setPlayers(nextPlayers)

    try {
      await updatePlayer(playerId, { ...player, cutUpCompleted: !player.cutUpCompleted })
    } catch (err) {
      console.error('Error updating player:', err)
      saveData('PLAYERS', nextPlayers)
    }
  }

  const startEditing = (player) => {
    setEditingPlayerId(player.id)
    setEditForm({
      name: player.name || '',
      position: player.position || '',
      offensePosition: player.offensePosition || '',
      defensePosition: player.defensePosition || '',
      school: player.school || '',
      state: player.state || '',
      homeState: player.homeState || player.home_state || '',
      gradYear: player.gradYear || '',
      notes: player.notes || '',
      flagged: player.flagged ?? true,
      cutUpCompleted: player.cutUpCompleted ?? false,
      recruitingStatuses: player.recruitingStatuses || ['Watching'],
      committedSchool: player.committedSchool || '',
      committedDate: player.committedDate || '',
      compositeRating: player.compositeRating || '',
      isLds: player.isLds || false,
      offeredDate: player.offeredDate || '',
      eligibilityYearsLeft: player.eligibilityYearsLeft ?? '',
      recruitingContext: player.recruitingContext || '',
      immediateImpactTag: player.immediateImpactTag || '',
      riskNotes: player.riskNotes || '',
      currentSchoolLevel: player.currentSchoolLevel || '',
      portalStatus: player.portalStatus || '',
      transferReason: player.transferReason || '',
      otherOffers: Array.isArray(player.otherOffers) ? player.otherOffers : [],
    })
  }

  const cancelEditing = () => {
    setEditingPlayerId(null)
    setEditForm(null)
    setEditStatusMenuOpenId(null)
  }

  const saveEditing = async () => {
    if (!editingPlayerId || !editForm) return

    const errors = validatePlayerForm(editForm)
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors)
      return
    }

    const updatedPlayer = {
      ...editForm,
      id: editingPlayerId,
    }

    const nextPlayers = players.map((p) =>
      p.id === editingPlayerId ? { ...p, ...updatedPlayer } : p
    )
    setPlayers(nextPlayers)

    try {
      await updatePlayer(editingPlayerId, updatedPlayer)
    } catch (err) {
      console.error('Error updating player:', err)
      saveData('PLAYERS', nextPlayers)
    }

    setEditingPlayerId(null)
    setEditForm(null)
    setEditStatusMenuOpenId(null)
  }

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target
    setEditForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
    if (name in editErrors) setEditErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const handlePhotoUpload = async (playerId, file) => {
    if (!file) return
    setPhotoUploading(true)
    try {
      const updatedPlayer = await uploadPlayerPhoto(playerId, file)
      setPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, profilePictureUrl: updatedPlayer.profilePictureUrl } : p))
      )
    } catch (err) {
      console.error('Error uploading photo:', err)
    } finally {
      setPhotoUploading(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  const handleDeletePhoto = async (playerId) => {
    try {
      await deletePlayerPhoto(playerId)
      setPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, profilePictureUrl: null } : p))
      )
    } catch (err) {
      console.error('Error deleting photo:', err)
    }
  }

  const removePlayer = async (playerId) => {
    const player = players.find((p) => p.id === playerId)
    if (!window.confirm(`Remove ${player?.name || 'this player'}? This cannot be undone.`)) return

    const nextPlayers = players.filter((p) => p.id !== playerId)
    setPlayers(nextPlayers)

    try {
      await deletePlayer(playerId)
    } catch (err) {
      console.error('Error deleting player:', err)
      saveData('PLAYERS', nextPlayers)
    }
  }

  const exportPlayers = () => {
    if (filteredPlayers.length === 0) return
    const rows = filteredPlayers.map((player) => ({
      name: player.name,
      position: player.position,
      school: player.school,
      currentSchoolLevel: player.currentSchoolLevel || '',
      gradYear: player.gradYear,
      eligibilityYearsLeft: player.eligibilityYearsLeft ?? '',
      portalStatus: player.portalStatus || '',
      flagged: player.flagged ? 'yes' : 'no',
      recruitingStatuses: (player.recruitingStatuses || ['Watching']).join(', '),
      immediateImpactTag: player.immediateImpactTag || '',
      recruitingContext: player.recruitingContext || '',
      riskNotes: player.riskNotes || '',
      otherOffers: Array.isArray(player.otherOffers)
        ? player.otherOffers.map((o) => `${o.school} (${o.interest})`).join('; ')
        : '',
      notes: player.notes,
    }))
    exportToCSV(rows, `prospects-${typeFilter.toLowerCase()}.csv`)
  }

  const getStatusColor = (status) => {
    const statusObj = RECRUITING_STATUSES.find((s) => s.value === status)
    return statusObj?.color || 'status-watching'
  }

  const getAccentClass = (status) => {
    const map = {
      'Watching': 'pb-accent-watching', 'Evaluating': 'pb-accent-evaluating',
      'Interested': 'pb-accent-interested', 'Offered': 'pb-accent-offered',
      'Committed': 'pb-accent-committed', 'Committed Elsewhere': 'pb-accent-elsewhere',
      'Signed': 'pb-accent-signed', 'Passed': 'pb-accent-passed',
    }
    return map[status] || 'pb-accent-default'
  }

  const getRatingClass = (rating) => {
    const r = parseFloat(rating)
    if (r >= 88) return 'high'
    if (r >= 84) return 'mid'
    return 'low'
  }

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton-block" style={{ height: 88, borderRadius: 14, marginBottom: 20 }} />
        <div className="skeleton-block" style={{ height: 52, borderRadius: 10, marginBottom: 16 }} />
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="skeleton-block skeleton-row" />
        ))}
      </div>
    )
  }

  // Derived stats for stats bar
  const ratedPlayers = filteredPlayers.filter(p => p.compositeRating != null && !isNaN(parseFloat(p.compositeRating)))
  const avgComposite = ratedPlayers.length > 0
    ? (ratedPlayers.reduce((s, p) => s + parseFloat(p.compositeRating), 0) / ratedPlayers.length).toFixed(2)
    : null

  return (
    <div className="page">
      {/* ── HEADER ─────────────────────────────────────────── */}
      <div className="pb-header">
        <div className="pb-header-left">
          <span className="pb-eyebrow">BYU Football · Recruiting</span>
          <h1 className="pb-title">Prospects Board</h1>
        </div>
        <div className="pb-header-right">
          <div className="pb-type-tabs">
            {['All', 'JUCO', 'Transfer'].map(t => (
              <button key={t} className={`pb-type-tab${typeFilter === t ? ' active' : ''}`}
                onClick={() => { setTypeFilter(t); setCurrentPage(1) }}>
                {t}
              </button>
            ))}
          </div>
          <button className="pb-export-btn" onClick={exportPlayers}>
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* ── FILTER STRIP ────────────────────────────────────── */}
      <div className="pb-filter-strip">
        <div className="pb-search-wrap" style={{ minWidth: 180, flex: '1 1 180px' }}>
          <Search size={14} style={{ color: 'var(--av2-muted)', flexShrink: 0 }} />
          <input type="text" placeholder="Search name or school…" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <select className="pb-filter-select" value={positionFilter} onChange={e => setPositionFilter(e.target.value)}>
          {POSITIONS.map(pos => <option key={pos} value={pos}>{pos === 'All' ? 'All Positions' : pos}</option>)}
        </select>
        <select className="pb-filter-select" value={sideFilter} onChange={e => setSideFilter(e.target.value)}>
          <option value="All">All Sides</option>
          <option value="Offense">Offense</option>
          <option value="Defense">Defense</option>
        </select>
        <select className="pb-filter-select" value={recruitingStatusFilter} onChange={e => setRecruitingStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {RECRUITING_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <input className="pb-filter-input" type="text" placeholder="State" value={stateFilter}
          onChange={e => setStateFilter(e.target.value)} style={{ width: 60 }} />
        <input className="pb-filter-input" type="text" placeholder="Grad Yr" value={gradYearFilter}
          onChange={e => setGradYearFilter(e.target.value)} style={{ width: 72 }} />
        <input className="pb-filter-input" type="number" placeholder="Yrs left" value={yearsLeftFilter}
          onChange={e => setYearsLeftFilter(e.target.value)} style={{ width: 74 }} min="0" max="6" />
        <div className="pb-filter-rating-pair">
          <input className="pb-filter-input" type="number" placeholder="Min ★" value={compositeRatingMin}
            onChange={e => setCompositeRatingMin(e.target.value)} min="0" max="100" step="0.01" />
          <span className="pb-filter-sep">—</span>
          <input className="pb-filter-input" type="number" placeholder="Max ★" value={compositeRatingMax}
            onChange={e => setCompositeRatingMax(e.target.value)} min="0" max="100" step="0.01" />
        </div>
        <input className="pb-filter-input" type="text" placeholder="School level" value={currentSchoolLevelFilter}
          onChange={e => setCurrentSchoolLevelFilter(e.target.value)} style={{ width: 110 }} />
        <label className="pb-flagged-check">
          <input type="checkbox" checked={flaggedOnly} onChange={e => setFlaggedOnly(e.target.checked)} />
          Flagged
        </label>
      </div>

      {/* ── STATS BAR ───────────────────────────────────────── */}
      <div className="pb-stats-bar">
        <div className="pb-stat-item">
          <span className="pb-stat-value">{filteredPlayers.length}</span>
          <span className="pb-stat-label">Prospects</span>
        </div>
        {avgComposite && (
          <>
            <div className="pb-stat-divider" />
            <div className="pb-stat-item">
              <span className="pb-stat-value">{avgComposite}</span>
              <span className="pb-stat-label">Avg Composite</span>
            </div>
            <div className="pb-stat-item" style={{ marginLeft: -8 }}>
              <span className="pb-stat-label" style={{ fontWeight: 400 }}>({ratedPlayers.length} rated)</span>
            </div>
          </>
        )}
        {filteredPlayers.filter(p => p.flagged).length > 0 && (
          <>
            <div className="pb-stat-divider" />
            <div className="pb-stat-item">
              <span className="pb-stat-value" style={{ color: '#F59E0B' }}>
                {filteredPlayers.filter(p => p.flagged).length}
              </span>
              <span className="pb-stat-label">Flagged</span>
            </div>
          </>
        )}
      </div>

      {/* ── ADD FORM (collapsible) ───────────────────────────── */}
      <div className="pb-add-toggle" onClick={() => setShowAddForm(prev => !prev)}>
        <div className="pb-add-toggle-left">
          <div className="pb-add-toggle-icon">{showAddForm ? '−' : '+'}</div>
          <span className="pb-add-toggle-label">{showAddForm ? 'Close Form' : 'Add New Prospect'}</span>
        </div>
        <span className={`pb-add-toggle-chevron${showAddForm ? ' open' : ''}`}>▼</span>
      </div>

      {showAddForm && (
        <div className="pb-add-form-panel">
          <form className="form-grid" onSubmit={handleAddPlayer}>
            <label className="field">
              Name
              <input name="name" value={form.name} onChange={handleChange} placeholder="Player name" />
              {formErrors.name && <span style={{ color: 'var(--color-danger, #ef4444)', fontSize: '12px', marginTop: '2px' }}>{formErrors.name}</span>}
            </label>
            <label className="field">
              Type
              <select name="playerType" value={form.playerType} onChange={handleChange}>
                <option value="JUCO">JUCO</option>
                <option value="Transfer">Transfer (D1)</option>
              </select>
            </label>
            <label className="field">
              Position
              <input name="position" value={form.position} onChange={handleChange} placeholder="Primary position" />
            </label>
            <label className="field">
              Offense Position
              <input name="offensePosition" value={form.offensePosition} onChange={handleChange} placeholder="QB/RB/WR (slot)/WR (wideout)/TE/OT/OG" />
            </label>
            <label className="field">
              Defense Position
              <input name="defensePosition" value={form.defensePosition} onChange={handleChange} placeholder="DL/LB/CB/S" />
            </label>
            <label className="field">
              School
              <input name="school" value={form.school} onChange={handleChange} placeholder="School name" />
            </label>
            <label className="field">
              Current School Level
              <select name="currentSchoolLevel" value={form.currentSchoolLevel} onChange={handleChange}>
                <option value="">— Select —</option>
                <option value="JUCO D1">JUCO D1</option>
                <option value="JUCO D2">JUCO D2</option>
                <option value="P4">P4 (Power 4)</option>
                <option value="G5">G5 (Group of 5)</option>
                <option value="FCS">FCS</option>
                <option value="NAIA">NAIA</option>
              </select>
            </label>
            <label className="field">
              State (Current School)
              <input name="state" value={form.state} onChange={handleChange} placeholder="UT, AZ, HI..." />
            </label>
            <label className="field">
              Home State (Originally From)
              <input name="homeState" value={form.homeState} onChange={handleChange} placeholder="UT, AZ, HI..." />
            </label>
            <label className="field">
              Grad Year
              <input name="gradYear" value={form.gradYear} onChange={handleChange} placeholder="2026" />
            </label>
            <label className="field">
              Eligibility Years Left
              <input type="number" name="eligibilityYearsLeft" value={form.eligibilityYearsLeft} onChange={handleChange} placeholder="2" min="0" max="6" />
            </label>
            <div className="field">
              Pipeline Statuses
              <div className="status-filter">
                <button type="button" className={`btn-ghost status-filter-trigger${statusMenuOpen ? ' active' : ''}`}
                  onClick={() => setStatusMenuOpen(prev => !prev)}>
                  Select statuses{form.recruitingStatuses.length > 0 ? ` (${form.recruitingStatuses.length})` : ''}
                </button>
                {statusMenuOpen && (
                  <div className="status-filter-menu">
                    {RECRUITING_STATUSES.map(status => (
                      <label key={status.value} className="status-filter-option">
                        <input type="checkbox" checked={form.recruitingStatuses.includes(status.value)}
                          onChange={e => {
                            if (e.target.checked) updateFormStatuses([...form.recruitingStatuses, status.value])
                            else updateFormStatuses(form.recruitingStatuses.filter(item => item !== status.value))
                          }} />
                        <span>{status.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {form.recruitingStatuses.includes('Offered') && (
              <label className="field">
                Offered Date *
                <input type="date" name="offeredDate" value={form.offeredDate} onChange={handleChange} required />
                {formErrors.offeredDate && <span style={{ color: 'var(--color-danger, #ef4444)', fontSize: '12px', marginTop: '2px' }}>{formErrors.offeredDate}</span>}
              </label>
            )}
            {(form.recruitingStatuses.includes('Committed') || form.recruitingStatuses.includes('Signed')) && (
              <label className="field">
                Committed Date *
                <input type="date" name="committedDate" value={form.committedDate} onChange={handleChange} required />
                {formErrors.committedDate && <span style={{ color: 'var(--color-danger, #ef4444)', fontSize: '12px', marginTop: '2px' }}>{formErrors.committedDate}</span>}
              </label>
            )}
            {form.recruitingStatuses.includes('Committed Elsewhere') && (
              <>
                <label className="field">
                  Committed School
                  <input name="committedSchool" value={form.committedSchool} onChange={handleChange} placeholder="School name" />
                </label>
                <label className="field">
                  Committed Date *
                  <input type="date" name="committedDate" value={form.committedDate} onChange={handleChange} required />
                </label>
              </>
            )}
            <label className="field">
              Composite Rating
              <input type="number" name="compositeRating" value={form.compositeRating} onChange={handleChange} placeholder="0.00" min="0" max="100" step="0.01" />
            </label>
            <label className="field">
              Portal Status
              <select name="portalStatus" value={form.portalStatus} onChange={handleChange}>
                {PORTAL_STATUSES.map(status => (
                  <option key={status || 'none'} value={status}>{status || 'Not specified'}</option>
                ))}
              </select>
            </label>
            <label className="field field-wide">
              Reason for Transferring
              <input name="transferReason" value={form.transferReason} onChange={handleChange} placeholder="Playing time, scheme fit, location, etc." />
            </label>
            <label className="field field-wide">
              Recruiting Context
              <input name="recruitingContext" value={form.recruitingContext} onChange={handleChange} placeholder="How they came on the radar, eval summary, etc." />
            </label>
            <label className="field field-wide">
              Immediate Impact Tag
              <input name="immediateImpactTag" value={form.immediateImpactTag} onChange={handleChange} placeholder="Can help now / Developmental / Emergency depth" />
            </label>
            <label className="field field-wide">
              Risk Notes
              <input name="riskNotes" value={form.riskNotes} onChange={handleChange} placeholder="Academic, off-field, injury risk, etc." />
            </label>
            <label className="field">
              Type
              <select name="playerType" value={form.playerType || 'JUCO'} onChange={handleChange}>
                <option value="JUCO">JUCO</option>
                <option value="Transfer">Transfer</option>
              </select>
            </label>
            <label className="checkbox" style={{ gridColumn: '1 / -1' }}>
              <input type="checkbox" name="isLds" checked={form.isLds || false}
                onChange={e => setForm(prev => ({ ...prev, isLds: e.target.checked }))} />
              <span>LDS</span>
            </label>
            <label className="field field-wide">
              Notes
              <input name="notes" value={form.notes} onChange={handleChange} placeholder="Scouting notes" />
            </label>
            <div className="field field-wide">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Other Offers / Competitors</span>
                <button type="button" className="btn-ghost"
                  onClick={() => setForm(prev => ({ ...prev, otherOffers: [...(prev.otherOffers || []), { school: '', interest: 'High' }] }))}>
                  <Plus size={14} /> Add Competitor
                </button>
              </div>
              {(form.otherOffers || []).length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Track main competing schools and how serious they are.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  {form.otherOffers.map((offer, index) => (
                    <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input style={{ flex: 1 }} placeholder="School" value={offer.school}
                        onChange={e => { const next = [...form.otherOffers]; next[index] = { ...next[index], school: e.target.value }; setForm(prev => ({ ...prev, otherOffers: next })) }} />
                      <select value={offer.interest}
                        onChange={e => { const next = [...form.otherOffers]; next[index] = { ...next[index], interest: e.target.value }; setForm(prev => ({ ...prev, otherOffers: next })) }}>
                        {INTEREST_LEVELS.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                      </select>
                      <button type="button" className="btn-ghost danger"
                        onClick={() => { const next = [...form.otherOffers]; next.splice(index, 1); setForm(prev => ({ ...prev, otherOffers: next })) }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button className="btn-primary" type="submit">
              <Plus size={16} /> Add Player
            </button>
          </form>
        </div>
      )}

      {/* ── PLAYER LIST ─────────────────────────────────────── */}
      {duplicateWarning && (
        <div className="error-message" style={{ marginBottom: 14 }}>{duplicateWarning}</div>
      )}

      {filteredPlayers.length === 0 ? (
        players.length === 0
          ? <EmptyState icon={UserPlus} title="No prospects yet" subtitle="Add a JUCO or transfer player to get started." />
          : <EmptyState icon={SearchX} title="No prospects match your filters" subtitle="Try adjusting your search or filters." />
      ) : (
        <>
          <ul className="pb-list">
            {paginatedPlayers.map(player => {
              const playerAssignments = getPlayerAssignments(player.id)
              const primaryStatus = (player.recruitingStatuses || ['Watching'])[0]
              const accentClass = getAccentClass(primaryStatus)
              const hasRating = player.compositeRating != null && !isNaN(parseFloat(player.compositeRating))

              return (
                <li key={player.id} className="pb-card">
                  {editingPlayerId === player.id ? (
                    <div className="pb-card-edit">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                        <PlayerAvatar name={player.name} url={player.profilePictureUrl} size={52} />
                        <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                          style={{ display: 'none' }} onChange={e => handlePhotoUpload(player.id, e.target.files[0])} />
                        <button type="button" className="btn-ghost" onClick={() => photoInputRef.current?.click()} disabled={photoUploading}>
                          <Camera size={16} /> {photoUploading ? 'Uploading...' : player.profilePictureUrl ? 'Change Photo' : 'Add Photo'}
                        </button>
                        {player.profilePictureUrl && (
                          <button type="button" className="btn-ghost danger" onClick={() => handleDeletePhoto(player.id)}>
                            <Trash2 size={14} /> Remove Photo
                          </button>
                        )}
                      </div>
                      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                        <label className="field">Name<input name="name" value={editForm.name} onChange={handleEditChange} />
                          {editErrors.name && <span style={{ color: 'var(--color-danger, #ef4444)', fontSize: '12px' }}>{editErrors.name}</span>}
                        </label>
                        <label className="field">Position<input name="position" value={editForm.position} onChange={handleEditChange} /></label>
                        <label className="field">Offense Pos<input name="offensePosition" value={editForm.offensePosition} onChange={handleEditChange} /></label>
                        <label className="field">Defense Pos<input name="defensePosition" value={editForm.defensePosition} onChange={handleEditChange} /></label>
                        <label className="field">School<input name="school" value={editForm.school} onChange={handleEditChange} /></label>
                        <label className="field">Current School Level<input name="currentSchoolLevel" value={editForm.currentSchoolLevel} onChange={handleEditChange} /></label>
                        <label className="field">State<input name="state" value={editForm.state} onChange={handleEditChange} /></label>
                        <label className="field">Home State<input name="homeState" value={editForm.homeState || ''} onChange={handleEditChange} /></label>
                        <label className="field">Grad Year<input name="gradYear" value={editForm.gradYear} onChange={handleEditChange} /></label>
                        <label className="field">Eligibility Years Left
                          <input type="number" name="eligibilityYearsLeft" value={editForm.eligibilityYearsLeft} onChange={handleEditChange} min="0" max="6" />
                        </label>
                        <div className="field">Pipeline Statuses
                          <div className="status-filter">
                            <button type="button" className={`btn-ghost status-filter-trigger${editStatusMenuOpenId === player.id ? ' active' : ''}`}
                              onClick={() => setEditStatusMenuOpenId(prev => prev === player.id ? null : player.id)}>
                              Select statuses{editForm.recruitingStatuses?.length ? ` (${editForm.recruitingStatuses.length})` : ''}
                            </button>
                            {editStatusMenuOpenId === player.id && (
                              <div className="status-filter-menu">
                                {RECRUITING_STATUSES.map(status => (
                                  <label key={status.value} className="status-filter-option">
                                    <input type="checkbox" checked={(editForm.recruitingStatuses || []).includes(status.value)}
                                      onChange={e => {
                                        if (e.target.checked) updateEditStatuses([...(editForm.recruitingStatuses || []), status.value])
                                        else updateEditStatuses((editForm.recruitingStatuses || []).filter(item => item !== status.value))
                                      }} />
                                    <span>{status.label}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {(editForm.recruitingStatuses || []).includes('Offered') && (
                          <label className="field">Offered Date *
                            <input type="date" name="offeredDate" value={editForm.offeredDate || ''} onChange={handleEditChange} required />
                            {editErrors.offeredDate && <span style={{ color: 'var(--color-danger, #ef4444)', fontSize: '12px' }}>{editErrors.offeredDate}</span>}
                          </label>
                        )}
                        {((editForm.recruitingStatuses || []).includes('Committed') || (editForm.recruitingStatuses || []).includes('Signed')) && (
                          <label className="field">Committed Date *
                            <input type="date" name="committedDate" value={editForm.committedDate || ''} onChange={handleEditChange} required />
                            {editErrors.committedDate && <span style={{ color: 'var(--color-danger, #ef4444)', fontSize: '12px' }}>{editErrors.committedDate}</span>}
                          </label>
                        )}
                        {(editForm.recruitingStatuses || []).includes('Committed Elsewhere') && (
                          <>
                            <label className="field">Committed School<input name="committedSchool" value={editForm.committedSchool || ''} onChange={handleEditChange} placeholder="School name" /></label>
                            <label className="field">Committed Date *<input type="date" name="committedDate" value={editForm.committedDate || ''} onChange={handleEditChange} required /></label>
                          </>
                        )}
                        <label className="field">Composite Rating
                          <input type="number" name="compositeRating" value={editForm.compositeRating || ''} onChange={handleEditChange} placeholder="0.00" min="0" max="100" step="0.01" />
                        </label>
                        <label className="field">Portal Status
                          <select name="portalStatus" value={editForm.portalStatus || ''} onChange={handleEditChange}>
                            {PORTAL_STATUSES.map(status => <option key={status || 'none'} value={status}>{status || 'Not specified'}</option>)}
                          </select>
                        </label>
                        <label className="checkbox" style={{ gridColumn: '1 / -1' }}>
                          <input type="checkbox" name="isLds" checked={editForm.isLds || false}
                            onChange={e => setEditForm(prev => ({ ...prev, isLds: e.target.checked }))} />
                          <span>LDS</span>
                        </label>
                        <label className="field" style={{ gridColumn: '1 / -1' }}>Notes<input name="notes" value={editForm.notes} onChange={handleEditChange} /></label>
                        <label className="field" style={{ gridColumn: '1 / -1' }}>Reason for Transferring<input name="transferReason" value={editForm.transferReason || ''} onChange={handleEditChange} /></label>
                        <label className="field" style={{ gridColumn: '1 / -1' }}>Recruiting Context<input name="recruitingContext" value={editForm.recruitingContext || ''} onChange={handleEditChange} /></label>
                        <label className="field" style={{ gridColumn: '1 / -1' }}>Immediate Impact Tag<input name="immediateImpactTag" value={editForm.immediateImpactTag || ''} onChange={handleEditChange} /></label>
                        <label className="field" style={{ gridColumn: '1 / -1' }}>Risk Notes<input name="riskNotes" value={editForm.riskNotes || ''} onChange={handleEditChange} /></label>
                        <div className="field" style={{ gridColumn: '1 / -1' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Other Offers / Competitors</span>
                            <button type="button" className="btn-ghost"
                              onClick={() => setEditForm(prev => ({ ...prev, otherOffers: [...(prev.otherOffers || []), { school: '', interest: 'High' }] }))}>
                              <Plus size={14} /> Add Competitor
                            </button>
                          </div>
                          {(editForm.otherOffers || []).length === 0 ? (
                            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Track main competing schools and how serious they are.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                              {editForm.otherOffers.map((offer, index) => (
                                <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <input style={{ flex: 1 }} placeholder="School" value={offer.school}
                                    onChange={e => { const next = [...(editForm.otherOffers || [])]; next[index] = { ...next[index], school: e.target.value }; setEditForm(prev => ({ ...prev, otherOffers: next })) }} />
                                  <select value={offer.interest}
                                    onChange={e => { const next = [...(editForm.otherOffers || [])]; next[index] = { ...next[index], interest: e.target.value }; setEditForm(prev => ({ ...prev, otherOffers: next })) }}>
                                    {INTEREST_LEVELS.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                                  </select>
                                  <button type="button" className="btn-ghost danger"
                                    onClick={() => { const next = [...(editForm.otherOffers || [])]; next.splice(index, 1); setEditForm(prev => ({ ...prev, otherOffers: next })) }}>
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="row-actions" style={{ marginTop: 12 }}>
                        <button className="btn-primary" onClick={saveEditing}><Check size={16} /> Save</button>
                        <button className="btn-secondary" onClick={cancelEditing}><X size={16} /> Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="pb-card-view">
                      <div className={`pb-card-accent ${accentClass}`} />
                      <div className="pb-card-avatar">
                        <PlayerAvatar name={player.name} url={player.profilePictureUrl} size={42} />
                      </div>
                      <div className="pb-card-body">
                        <div className="pb-card-name-row">
                          <Link to={`/player/${player.id}`} className="pb-card-name">{player.name}</Link>
                          {hasRating && (
                            <span className={`pb-card-rating ${getRatingClass(player.compositeRating)}`}>
                              {parseFloat(player.compositeRating).toFixed(2)}
                            </span>
                          )}
                          {player.isJuco && <span className="pb-badge-juco">JUCO</span>}
                          {player.isTransferWishlist && <span className="pb-badge-transfer">Transfer</span>}
                          {player.isLds && <span className="pb-badge-lds">LDS</span>}
                          {player.cutUpCompleted && <span className="pb-badge-cutup">Cut Up ✓</span>}
                          {player.flagged && <span className="pb-badge-flag" title="Flagged">🚩</span>}
                          {(player.recruitingStatuses || ['Watching']).map(status => (
                            <span key={status} className={`status-badge ${getStatusColor(status)}`}>{status}</span>
                          ))}
                          {playerAssignments.length > 0 && (
                            <span className="assigned-scouts" title={`Assigned to: ${playerAssignments.map(a => a.scout_name || a.scout_email).join(', ')}`}>
                              <Users size={12} /> {playerAssignments.length}
                            </span>
                          )}
                        </div>
                        <div className="pb-card-meta">
                          <strong>{getPrimaryPositionDisplay(player)}</strong>
                          {player.offensePosition && ` · O: ${player.offensePosition}`}
                          {player.defensePosition && ` · D: ${player.defensePosition}`}
                          {' · '}{player.school || 'School TBD'}
                          {player.state && ` (${player.state})`}
                          {(player.homeState || player.home_state) && ` · From: ${player.homeState || player.home_state}`}
                          {' · '}{player.gradYear || 'Grad TBD'}
                          {player.currentSchoolLevel && ` · ${player.currentSchoolLevel}`}
                          {player.eligibilityYearsLeft != null && player.eligibilityYearsLeft !== '' && ` · ${player.eligibilityYearsLeft}yr elig`}
                          {player.portalStatus && ` · ${player.portalStatus}`}
                        </div>
                        {(player.recruitingStatuses || []).includes('Committed Elsewhere') && player.committedSchool && (
                          <div className="pb-card-meta" style={{ color: '#F97316' }}>
                            Committed to {player.committedSchool}{player.committedDate ? ` · ${String(player.committedDate).split('T')[0]}` : ''}
                          </div>
                        )}
                        {(player.immediateImpactTag || player.recruitingContext || player.riskNotes) && (
                          <div className="pb-card-intel">
                            {player.immediateImpactTag && <><span className="pb-intel-tag pb-intel-impact">Impact</span>{player.immediateImpactTag} </>}
                            {player.recruitingContext && <span style={{ marginLeft: player.immediateImpactTag ? 6 : 0 }}>{player.recruitingContext} </span>}
                            {player.riskNotes && <><span className="pb-intel-tag pb-intel-risk">Risk</span>{player.riskNotes}</>}
                          </div>
                        )}
                        {Array.isArray(player.otherOffers) && player.otherOffers.length > 0 && (
                          <div className="pb-card-competitors">
                            Competing: {player.otherOffers.map(o => `${o.school} (${o.interest})`).join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="pb-card-actions">
                        <label className="pb-cutup-label">
                          <input type="checkbox" checked={player.cutUpCompleted || false}
                            onChange={() => toggleCutUpCompleted(player.id)} />
                          <span>Cut Up</span>
                        </label>
                        <button className="pb-action-btn" onClick={() => startEditing(player)}>
                          <Pencil size={12} /> Edit
                        </button>
                        <Link className="pb-action-btn" to={`/player/${player.id}/stats`}>
                          <BarChart3 size={12} /> Stats
                        </Link>
                        <button className="pb-action-btn danger" onClick={() => removePlayer(player.id)}>
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {totalPages > 1 && (
            <div className="pb-pagination">
              <button className="pb-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft size={14} /> Prev
              </button>
              <span className="pb-page-info">{currentPage} / {totalPages} · {filteredPlayers.length} total</span>
              <button className="pb-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default PlayerBoard
