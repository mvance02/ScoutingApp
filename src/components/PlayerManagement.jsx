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
import { BIG12_STARTER_AVG_BY_POSITION, normalizeBenchmarkPosition } from '../utils/benchmarks'

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

const UNDERSIZED_TRAITS_BY_POSITION = {
  DE: [
    'Elite get-off / first step',
    'Verified 4.45–4.55 speed',
    'Exceptional bend / pass-rush toolkit',
    'Special teams core value',
  ],
  DEFAULT: [
    'Elite speed / burst',
    'Exceptional football IQ / instincts',
    'High motor / competitiveness',
    'Position versatility',
    'Special teams core value',
  ],
}

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

function PlayerManagement() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [positionFilter, setPositionFilter] = useState('All')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [stateFilter, setStateFilter] = useState('')
  const [gradYearFilter, setGradYearFilter] = useState('')
  const [sideFilter, setSideFilter] = useState('All')
  const [recruitingStatusFilter, setRecruitingStatusFilter] = useState('')
  const [compositeRatingMin, setCompositeRatingMin] = useState('')
  const [compositeRatingMax, setCompositeRatingMax] = useState('')
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
  const [undersizedModal, setUndersizedModal] = useState({
    open: false,
    position: null,
    heightDiff: null,
    weightDiff: null,
    pendingAction: null, // 'add' | 'edit'
    pendingPlayer: null,
    selectedTraits: [],
  })
  const [showAddForm, setShowAddForm] = useState(false)
  const photoInputRef = useRef(null)
  const [form, setForm] = useState({
    name: '',
    position: '',
    offensePosition: '',
    defensePosition: '',
    school: '',
    state: '',
    gradYear: '',
    notes: '',
    flagged: true,
    recruitingStatuses: ['Watching'],
    committedSchool: '',
    committedDate: '',
    compositeRating: '',
    heightIn: '',
    weightLb: '',
    fortyTime: '',
    armLengthIn: '',
    handSizeIn: '',
    undersizedTraits: [],
    isLds: false,
    offeredDate: '',
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
      // HS Players only: filter out JUCO and Transfer players
      if (player.isJuco === true) return false
      if (player.isTransferWishlist === true) return false

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

      return true
    })
  }, [players, searchQuery, positionFilter, flaggedOnly, stateFilter, gradYearFilter, sideFilter, recruitingStatusFilter, compositeRatingMin, compositeRatingMax])

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

  function getPrimaryPositionForBenchmark(p) {
    const raw = p?.position || p?.defensePosition || p?.offensePosition || ''
    const normalized = normalizeBenchmarkPosition(raw)
    if (normalized && BIG12_STARTER_AVG_BY_POSITION[normalized]) return normalized
    const d = normalizeBenchmarkPosition(p?.defensePosition)
    if (d && BIG12_STARTER_AVG_BY_POSITION[d]) return d
    const o = normalizeBenchmarkPosition(p?.offensePosition)
    if (o && BIG12_STARTER_AVG_BY_POSITION[o]) return o
    return normalized
  }

  function getUndersizedDiff(playerLike) {
    const pos = getPrimaryPositionForBenchmark(playerLike)
    if (!pos) return null
    const avg = BIG12_STARTER_AVG_BY_POSITION[pos]
    if (!avg) return null

    const h = playerLike.heightIn != null && playerLike.heightIn !== '' ? Number(playerLike.heightIn) : null
    const w = playerLike.weightLb != null && playerLike.weightLb !== '' ? Number(playerLike.weightLb) : null
    if (h == null && w == null) return null

    const heightDiff = h != null ? Number((avg.height_in - h).toFixed(1)) : null
    const weightDiff = w != null ? Number((avg.weight_lb - w).toFixed(1)) : null

    const undersizedByHeight = heightDiff != null && heightDiff >= 2
    const undersizedByWeight = weightDiff != null && weightDiff >= 10
    if (!undersizedByHeight && !undersizedByWeight) return null

    return { position: pos, heightDiff, weightDiff }
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
      gradYear: form.gradYear.trim(),
      notes: form.notes.trim(),
      flagged: form.flagged,
      recruitingStatuses: form.recruitingStatuses,
      committedSchool: form.committedSchool.trim(),
      committedDate: form.committedDate,
      compositeRating: form.compositeRating ? parseFloat(form.compositeRating) : null,
      heightIn: form.heightIn !== '' ? parseFloat(form.heightIn) : null,
      weightLb: form.weightLb !== '' ? parseFloat(form.weightLb) : null,
      fortyTime: form.fortyTime !== '' ? parseFloat(form.fortyTime) : null,
      armLengthIn: form.armLengthIn !== '' ? parseFloat(form.armLengthIn) : null,
      handSizeIn: form.handSizeIn !== '' ? parseFloat(form.handSizeIn) : null,
      undersizedTraits: Array.isArray(form.undersizedTraits) ? form.undersizedTraits : [],
      isJuco: false,
      isTransferWishlist: false,
      isLds: form.isLds || false,
      offeredDate: form.offeredDate || null,
    }

    try {
      const undersized = getUndersizedDiff(newPlayerData)
      if (undersized) {
        setUndersizedModal({
          open: true,
          position: undersized.position,
          heightDiff: undersized.heightDiff,
          weightDiff: undersized.weightDiff,
          pendingAction: 'add',
          pendingPlayer: newPlayerData,
          selectedTraits: [],
        })
        return
      }
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
      gradYear: '',
      notes: '',
      flagged: true,
      recruitingStatuses: ['Watching'],
      committedSchool: '',
      committedDate: '',
      compositeRating: '',
      heightIn: '',
      weightLb: '',
      fortyTime: '',
      armLengthIn: '',
      handSizeIn: '',
      undersizedTraits: [],
      isLds: false,
      offeredDate: '',
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
      gradYear: player.gradYear || '',
      notes: player.notes || '',
      flagged: player.flagged ?? true,
      cutUpCompleted: player.cutUpCompleted ?? false,
      recruitingStatuses: player.recruitingStatuses || ['Watching'],
      committedSchool: player.committedSchool || '',
      committedDate: player.committedDate || '',
      compositeRating: player.compositeRating || '',
      heightIn: player.heightIn ?? '',
      weightLb: player.weightLb ?? '',
      fortyTime: player.fortyTime ?? '',
      armLengthIn: player.armLengthIn ?? '',
      handSizeIn: player.handSizeIn ?? '',
      undersizedTraits: Array.isArray(player.undersizedTraits) ? player.undersizedTraits : [],
      isLds: player.isLds || false,
      offeredDate: player.offeredDate || '',
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
      const undersized = getUndersizedDiff(updatedPlayer)
      if (undersized) {
        setUndersizedModal({
          open: true,
          position: undersized.position,
          heightDiff: undersized.heightDiff,
          weightDiff: undersized.weightDiff,
          pendingAction: 'edit',
          pendingPlayer: updatedPlayer,
          selectedTraits: Array.isArray(updatedPlayer.undersizedTraits) ? updatedPlayer.undersizedTraits : [],
        })
        return
      }
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
    if (players.length === 0) return
    const rows = players.map((player) => ({
      name: player.name,
      position: player.position,
      school: player.school,
      gradYear: player.gradYear,
      flagged: player.flagged ? 'yes' : 'no',
      recruitingStatuses: (player.recruitingStatuses || ['Watching']).join(', '),
      notes: player.notes,
    }))
    exportToCSV(rows, 'players.csv')
  }

  const getStatusColor = (status) => {
    const statusObj = RECRUITING_STATUSES.find((s) => s.value === status)
    return statusObj?.color || 'status-watching'
  }

  const getAccentClass = (status) => {
    const map = {
      'Watching': 'pb-accent-watching',
      'Evaluating': 'pb-accent-evaluating',
      'Interested': 'pb-accent-interested',
      'Offered': 'pb-accent-offered',
      'Committed': 'pb-accent-committed',
      'Committed Elsewhere': 'pb-accent-elsewhere',
      'Signed': 'pb-accent-signed',
      'Passed': 'pb-accent-passed',
    }
    return map[status] || 'pb-accent-default'
  }

  const getRatingClass = (rating) => {
    const r = parseFloat(rating)
    if (r >= 88) return 'high'
    if (r >= 84) return 'mid'
    return 'low'
  }

  const renderUndersizedAlert = () => {
    if (!undersizedModal.open) return null
    return (
      <div
        style={{
          marginTop: '12px',
          marginBottom: '8px',
          borderRadius: '12px',
          border: '1px solid rgba(248, 113, 113, 0.6)',
          background: 'rgba(254, 242, 242, 0.95)',
          padding: '14px 16px',
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.08)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: '4px', color: '#b91c1c' }}>
              Undersized vs Big 12 prototype for {undersizedModal.position}
            </div>
            <div style={{ marginBottom: '10px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              {undersizedModal.heightDiff != null && (
                <div>Height: {undersizedModal.heightDiff}" shorter than Big 12 avg</div>
              )}
              {undersizedModal.weightDiff != null && (
                <div>Weight: {undersizedModal.weightDiff} lb lighter than Big 12 avg</div>
              )}
            </div>

            <div
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(248, 113, 113, 0.6)',
                background: 'white',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>
                Does he have at least one of these to overcome being undersized?
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {(UNDERSIZED_TRAITS_BY_POSITION[undersizedModal.position] ||
                  UNDERSIZED_TRAITS_BY_POSITION.DEFAULT
                ).map((trait) => (
                  <label
                    key={trait}
                    style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }}
                  >
                    <input
                      type="checkbox"
                      checked={undersizedModal.selectedTraits.includes(trait)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setUndersizedModal((prev) => ({
                            ...prev,
                            selectedTraits: [...prev.selectedTraits, trait],
                          }))
                        } else {
                          setUndersizedModal((prev) => ({
                            ...prev,
                            selectedTraits: prev.selectedTraits.filter((t) => t !== trait),
                          }))
                        }
                      }}
                    />
                    <span>{trait}</span>
                  </label>
                ))}
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                This will be saved on the player as “Undersized traits”.
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn-ghost"
            onClick={() =>
              setUndersizedModal((prev) => ({ ...prev, open: false, pendingPlayer: null }))
            }
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div
          style={{
            marginTop: '10px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
          }}
        >
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              setUndersizedModal((prev) => ({ ...prev, open: false, pendingPlayer: null }))
            }
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={async () => {
              const pending = undersizedModal.pendingPlayer
              if (!pending) return
              const payload = { ...pending, undersizedTraits: undersizedModal.selectedTraits }
              const action = undersizedModal.pendingAction
              setUndersizedModal((prev) => ({ ...prev, open: false, pendingPlayer: null }))
              try {
                if (action === 'add') {
                  const newPlayer = await createPlayer(payload)
                  setPlayers((prev) => [newPlayer, ...prev])
                } else if (action === 'edit' && editingPlayerId) {
                  await updatePlayer(editingPlayerId, payload)
                  setPlayers((prev) =>
                    prev.map((p) => (p.id === editingPlayerId ? { ...p, ...payload } : p))
                  )
                  setEditingPlayerId(null)
                  setEditForm(null)
                  setEditStatusMenuOpenId(null)
                }
              } catch (err) {
                console.error('Undersized modal save error:', err)
                alert('Failed to save player')
              }
            }}
            disabled={undersizedModal.selectedTraits.length === 0}
            title={
              undersizedModal.selectedTraits.length === 0
                ? 'Select at least one trait to proceed'
                : 'Save'
            }
          >
            Save Anyway
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="page pb-page">
        <div className="pb-header">
          <div>
            <span className="pb-eyebrow">BYU Football · Recruiting</span>
            <h1 className="pb-title">HS Players</h1>
          </div>
        </div>
        <div style={{ padding: '24px' }}>
          <div className="skeleton-block skeleton-panel-sm" style={{ marginBottom: 16 }} />
          {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton-block skeleton-row" style={{ marginBottom: 8 }} />)}
        </div>
      </div>
    )
  }

  const ratedPlayers = filteredPlayers.filter(p => p.compositeRating != null && !isNaN(parseFloat(p.compositeRating)))
  const avgComposite = ratedPlayers.length > 0
    ? (ratedPlayers.reduce((s, p) => s + parseFloat(p.compositeRating), 0) / ratedPlayers.length).toFixed(2)
    : null
  const flaggedCount = filteredPlayers.filter(p => p.flagged).length

  return (
    <div className="page pb-page">

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div className="pb-header">
        <div>
          <span className="pb-eyebrow">BYU Football · Recruiting</span>
          <h1 className="pb-title">HS Players</h1>
        </div>
        <div className="pb-header-actions">
          <button className="pb-export-btn" onClick={exportPlayers}>
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* ── FILTER STRIP ───────────────────────────────────────── */}
      <div className="pb-filter-strip">
        <div className="pb-search-wrap">
          <Search size={13} className="pb-search-icon" />
          <input
            className="pb-search-input"
            type="text"
            placeholder="Search name or school…"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1) }}
          />
        </div>
        <select className="pb-filter-select" value={positionFilter} onChange={e => { setPositionFilter(e.target.value); setCurrentPage(1) }}>
          {POSITIONS.map(pos => <option key={pos} value={pos}>{pos === 'All' ? 'All Positions' : pos}</option>)}
        </select>
        <select className="pb-filter-select" value={recruitingStatusFilter} onChange={e => { setRecruitingStatusFilter(e.target.value); setCurrentPage(1) }}>
          <option value="">All Statuses</option>
          {RECRUITING_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="pb-filter-select" value={sideFilter} onChange={e => { setSideFilter(e.target.value); setCurrentPage(1) }}>
          <option value="All">All Sides</option>
          <option value="Offense">Offense</option>
          <option value="Defense">Defense</option>
        </select>
        <input
          className="pb-filter-select"
          type="text"
          placeholder="State"
          value={stateFilter}
          onChange={e => { setStateFilter(e.target.value); setCurrentPage(1) }}
          style={{ width: 72 }}
        />
        <input
          className="pb-filter-select"
          type="text"
          placeholder="Year"
          value={gradYearFilter}
          onChange={e => { setGradYearFilter(e.target.value); setCurrentPage(1) }}
          style={{ width: 64 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            className="pb-filter-select"
            type="number"
            placeholder="Min ★"
            value={compositeRatingMin}
            onChange={e => { setCompositeRatingMin(e.target.value); setCurrentPage(1) }}
            style={{ width: 72 }}
            min="0" max="100" step="0.01"
          />
          <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>–</span>
          <input
            className="pb-filter-select"
            type="number"
            placeholder="Max ★"
            value={compositeRatingMax}
            onChange={e => { setCompositeRatingMax(e.target.value); setCurrentPage(1) }}
            style={{ width: 72 }}
            min="0" max="100" step="0.01"
          />
        </div>
        <label className="pb-flag-check">
          <input type="checkbox" checked={flaggedOnly} onChange={e => { setFlaggedOnly(e.target.checked); setCurrentPage(1) }} />
          <span>Flagged</span>
        </label>
      </div>

      {/* ── STATS BAR ──────────────────────────────────────────── */}
      <div className="pb-stats-bar">
        <span className="pb-stat"><strong>{filteredPlayers.length}</strong> players</span>
        {avgComposite && <span className="pb-stat"><strong>{avgComposite}</strong> avg composite</span>}
        {flaggedCount > 0 && <span className="pb-stat"><strong>{flaggedCount}</strong> flagged</span>}
      </div>

      {/* ── ADD PLAYER ACCORDION ────────────────────────────────── */}
      <div className="pb-add-toggle" onClick={() => setShowAddForm(prev => !prev)}>
        <div className="pb-add-toggle-left">
          <div className="pb-add-toggle-icon">{showAddForm ? '−' : '+'}</div>
          <span className="pb-add-toggle-label">{showAddForm ? 'Close Form' : 'Add HS Player'}</span>
        </div>
        <span className={`pb-add-toggle-chevron${showAddForm ? ' open' : ''}`}>▼</span>
      </div>
      {showAddForm && (
          <div className="pb-add-form-panel">
          <form className="form-grid" onSubmit={handleAddPlayer}>
            <label className="field">
              Name *
              <input name="name" value={form.name} onChange={handleChange} placeholder="Player name" />
              {formErrors.name && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 2 }}>{formErrors.name}</span>}
            </label>
            <label className="field">
              Position
              <input name="position" value={form.position} onChange={handleChange} placeholder="Primary position" />
            </label>
            <label className="field">
              Offense Pos
              <input name="offensePosition" value={form.offensePosition} onChange={handleChange} placeholder="QB/RB/WR (slot)/OT…" />
            </label>
            <label className="field">
              Defense Pos
              <input name="defensePosition" value={form.defensePosition} onChange={handleChange} placeholder="DL/LB/CB/S" />
            </label>
            <label className="field">
              School
              <input name="school" value={form.school} onChange={handleChange} placeholder="School name" />
            </label>
            <label className="field">
              State
              <input name="state" value={form.state} onChange={handleChange} placeholder="UT, AZ, HI…" />
            </label>
            <label className="field">
              Grad Year
              <input name="gradYear" value={form.gradYear} onChange={handleChange} placeholder="2026" />
            </label>
            <div className="field">
              Pipeline Statuses
              <div className="status-filter">
                <button
                  type="button"
                  className={`btn-ghost status-filter-trigger${statusMenuOpen ? ' active' : ''}`}
                  onClick={() => setStatusMenuOpen(prev => !prev)}
                >
                  Select statuses{form.recruitingStatuses.length > 0 ? ` (${form.recruitingStatuses.length})` : ''}
                </button>
                {statusMenuOpen && (
                  <div className="status-filter-menu">
                    {RECRUITING_STATUSES.map(status => (
                      <label key={status.value} className="status-filter-option">
                        <input
                          type="checkbox"
                          checked={form.recruitingStatuses.includes(status.value)}
                          onChange={e => {
                            if (e.target.checked) updateFormStatuses([...form.recruitingStatuses, status.value])
                            else updateFormStatuses(form.recruitingStatuses.filter(item => item !== status.value))
                          }}
                        />
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
                {formErrors.offeredDate && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 2 }}>{formErrors.offeredDate}</span>}
              </label>
            )}
            {(form.recruitingStatuses.includes('Committed') || form.recruitingStatuses.includes('Signed')) && (
              <label className="field">
                Committed Date *
                <input type="date" name="committedDate" value={form.committedDate} onChange={handleChange} required />
                {formErrors.committedDate && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 2 }}>{formErrors.committedDate}</span>}
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
            <div style={{ gridColumn: '1 / -1', marginTop: 4, fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Measurables
            </div>
            <label className="field">
              Height (in)
              <input type="number" name="heightIn" value={form.heightIn} onChange={handleChange} placeholder="e.g. 74" step="0.1" />
            </label>
            <label className="field">
              Weight (lb)
              <input type="number" name="weightLb" value={form.weightLb} onChange={handleChange} placeholder="e.g. 210" step="0.1" />
            </label>
            <label className="field">
              40 Time
              <input type="number" name="fortyTime" value={form.fortyTime} onChange={handleChange} placeholder="e.g. 4.55" step="0.01" />
            </label>
            <label className="field">
              Arm Length (in)
              <input type="number" name="armLengthIn" value={form.armLengthIn} onChange={handleChange} placeholder="e.g. 33.5" step="0.01" />
            </label>
            <label className="field">
              Hand Size (in)
              <input type="number" name="handSizeIn" value={form.handSizeIn} onChange={handleChange} placeholder="e.g. 9.5" step="0.01" />
            </label>
            <label className="checkbox" style={{ gridColumn: '1 / -1' }}>
              <input type="checkbox" name="isLds" checked={form.isLds || false} onChange={e => setForm(prev => ({ ...prev, isLds: e.target.checked }))} />
              <span>LDS</span>
            </label>
            <label className="field field-wide">
              Notes
              <input name="notes" value={form.notes} onChange={handleChange} placeholder="Scouting notes" />
            </label>
            <label className="checkbox">
              <input type="checkbox" name="flagged" checked={form.flagged} onChange={handleChange} />
              Add to Saturday queue
            </label>
            <button className="btn-primary" type="submit">
              <Plus size={16} /> Add Player
            </button>
            {undersizedModal.open && undersizedModal.pendingAction === 'add' && renderUndersizedAlert()}
          </form>
          </div>
        )}

      {duplicateWarning && (
        <div className="error-message" style={{ margin: '0 0 14px' }}>{duplicateWarning}</div>
      )}

      {/* ── PLAYER LIST ─────────────────────────────────────────── */}
      {filteredPlayers.length === 0 ? (
        players.length === 0
          ? <EmptyState icon={UserPlus} title="No players yet" subtitle="Add one to start your watchlist." />
          : <EmptyState icon={SearchX} title="No players match your filters" subtitle="Try adjusting your search or filters." />
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
                          <Camera size={16} /> {photoUploading ? 'Uploading…' : player.profilePictureUrl ? 'Change Photo' : 'Add Photo'}
                        </button>
                        {player.profilePictureUrl && (
                          <button type="button" className="btn-ghost danger" onClick={() => handleDeletePhoto(player.id)}>
                            <Trash2 size={14} /> Remove Photo
                          </button>
                        )}
                      </div>
                      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                        <label className="field">Name
                          <input name="name" value={editForm.name} onChange={handleEditChange} />
                          {editErrors.name && <span style={{ color: '#ef4444', fontSize: 12 }}>{editErrors.name}</span>}
                        </label>
                        <label className="field">Position<input name="position" value={editForm.position} onChange={handleEditChange} /></label>
                        <label className="field">Offense Pos<input name="offensePosition" value={editForm.offensePosition} onChange={handleEditChange} /></label>
                        <label className="field">Defense Pos<input name="defensePosition" value={editForm.defensePosition} onChange={handleEditChange} /></label>
                        <label className="field">School<input name="school" value={editForm.school} onChange={handleEditChange} /></label>
                        <label className="field">State<input name="state" value={editForm.state} onChange={handleEditChange} /></label>
                        <label className="field">Grad Year<input name="gradYear" value={editForm.gradYear} onChange={handleEditChange} /></label>
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
                            {editErrors.offeredDate && <span style={{ color: '#ef4444', fontSize: 12 }}>{editErrors.offeredDate}</span>}
                          </label>
                        )}
                        {((editForm.recruitingStatuses || []).includes('Committed') || (editForm.recruitingStatuses || []).includes('Signed')) && (
                          <label className="field">Committed Date *
                            <input type="date" name="committedDate" value={editForm.committedDate || ''} onChange={handleEditChange} required />
                            {editErrors.committedDate && <span style={{ color: '#ef4444', fontSize: 12 }}>{editErrors.committedDate}</span>}
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
                        <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Measurables</div>
                        <label className="field">Height (in)<input type="number" name="heightIn" value={editForm.heightIn ?? ''} onChange={handleEditChange} placeholder="e.g. 74" step="0.1" /></label>
                        <label className="field">Weight (lb)<input type="number" name="weightLb" value={editForm.weightLb ?? ''} onChange={handleEditChange} placeholder="e.g. 210" step="0.1" /></label>
                        <label className="field">40 Time<input type="number" name="fortyTime" value={editForm.fortyTime ?? ''} onChange={handleEditChange} placeholder="e.g. 4.55" step="0.01" /></label>
                        <label className="field">Arm Length (in)<input type="number" name="armLengthIn" value={editForm.armLengthIn ?? ''} onChange={handleEditChange} placeholder="e.g. 33.5" step="0.01" /></label>
                        <label className="field">Hand Size (in)<input type="number" name="handSizeIn" value={editForm.handSizeIn ?? ''} onChange={handleEditChange} placeholder="e.g. 9.5" step="0.01" /></label>
                        <label className="checkbox" style={{ gridColumn: '1 / -1' }}>
                          <input type="checkbox" name="isLds" checked={editForm.isLds || false} onChange={e => setEditForm(prev => ({ ...prev, isLds: e.target.checked }))} />
                          <span>LDS</span>
                        </label>
                        <label className="field" style={{ gridColumn: '1 / -1' }}>Notes<input name="notes" value={editForm.notes} onChange={handleEditChange} /></label>
                      </div>
                      <div className="row-actions" style={{ marginTop: 12 }}>
                        <button className="btn-primary" onClick={saveEditing}><Check size={16} /> Save</button>
                        <button className="btn-secondary" onClick={cancelEditing}><X size={16} /> Cancel</button>
                      </div>
                      {undersizedModal.open &&
                        undersizedModal.pendingAction === 'edit' &&
                        undersizedModal.pendingPlayer &&
                        String(undersizedModal.pendingPlayer.id || editingPlayerId) === String(player.id) &&
                        renderUndersizedAlert()}
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
                          {player.isLds && <span className="pb-badge-lds">LDS</span>}
                          {player.cutUpCompleted && <span className="pb-badge-cutup">Cut Up ✓</span>}
                          {player.flagged && <span className="pb-badge-flag" title="Flagged">🚩</span>}
                          {(player.recruitingStatuses || ['Watching']).map(status => (
                            <span key={status} className={`status-badge ${getStatusColor(status)}`}>{status}</span>
                          ))}
                          {playerAssignments.length > 0 && (
                            <span className="assigned-scouts" title={`Assigned: ${playerAssignments.map(a => a.scout_name || a.scout_email).join(', ')}`}>
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
                          {' · '}{player.gradYear || 'Grad TBD'}
                          {player.heightIn && ` · ${Math.floor(player.heightIn / 12)}'${Math.round(player.heightIn % 12)}"`}
                          {player.weightLb && ` · ${Math.round(player.weightLb)} lb`}
                          {player.fortyTime && ` · ${player.fortyTime}s`}
                        </div>
                        {(player.recruitingStatuses || []).includes('Committed Elsewhere') && player.committedSchool && (
                          <div className="pb-card-meta" style={{ color: '#F97316' }}>
                            Committed to {player.committedSchool}{player.committedDate ? ` · ${String(player.committedDate).split('T')[0]}` : ''}
                          </div>
                        )}
                        {player.notes && (
                          <div className="pb-card-intel">
                            {player.notes}
                            {Array.isArray(player.undersizedTraits) && player.undersizedTraits.length > 0 && (
                              <> · <span className="pb-intel-tag pb-intel-risk">Undersized</span>{player.undersizedTraits.join(', ')}</>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="pb-card-actions">
                        <label className="pb-cutup-label">
                          <input type="checkbox" checked={player.cutUpCompleted || false} onChange={() => toggleCutUpCompleted(player.id)} />
                          <span>Cut Up</span>
                        </label>
                        <button className="pb-action-btn" onClick={() => toggleFlagged(player.id)}>
                          <Flag size={12} /> {player.flagged ? 'Unflag' : 'Flag'}
                        </button>
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

export default PlayerManagement
