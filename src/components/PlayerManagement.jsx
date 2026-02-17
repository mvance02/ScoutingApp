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

const POSITIONS = ['All', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P', 'ATH']

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

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
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
    if (!form.name.trim()) return

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
      gradYear: '',
      notes: '',
      flagged: true,
      recruitingStatuses: ['Watching'],
      committedSchool: '',
      committedDate: '',
      compositeRating: '',
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
    })
  }

  const cancelEditing = () => {
    setEditingPlayerId(null)
    setEditForm(null)
    setEditStatusMenuOpenId(null)
  }

  const saveEditing = async () => {
    if (!editingPlayerId || !editForm) return

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

  if (loading) {
    return (
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div className="skeleton-block skeleton-title" />
            <div className="skeleton-block skeleton-subtitle" />
          </div>
          <div className="skeleton-block skeleton-btn" />
        </div>
        <div className="skeleton-block skeleton-panel-sm" />
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="skeleton-block skeleton-row" />
        ))}
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h2>Player Management</h2>
          <p>Keep your Saturday watchlist organized and ready for review.</p>
        </div>
        <button className="btn-secondary" onClick={exportPlayers}>
          <Download size={16} />
          Export Players
        </button>
      </header>

      <section className="panel">
        <h3>Add Flagged Player</h3>
        <form className="form-grid" onSubmit={handleAddPlayer}>
          <label className="field">
            Name
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Player name"
            />
          </label>
          <label className="field">
            Position
            <input
              name="position"
              value={form.position}
              onChange={handleChange}
              placeholder="Primary position"
            />
          </label>
          <label className="field">
            Offense Position
            <input
              name="offensePosition"
              value={form.offensePosition}
              onChange={handleChange}
              placeholder="QB/RB/WR/TE/OL"
            />
          </label>
          <label className="field">
            Defense Position
            <input
              name="defensePosition"
              value={form.defensePosition}
              onChange={handleChange}
              placeholder="DL/LB/DB"
            />
          </label>
          <label className="field">
            School
            <input
              name="school"
              value={form.school}
              onChange={handleChange}
              placeholder="School name"
            />
          </label>
          <label className="field">
            State
            <input
              name="state"
              value={form.state}
              onChange={handleChange}
              placeholder="UT, AZ, HI..."
            />
          </label>
          <label className="field">
            Grad Year
            <input
              name="gradYear"
              value={form.gradYear}
              onChange={handleChange}
              placeholder="2026"
            />
          </label>
          <div className="field">
            Pipeline Statuses
            <div className="status-filter">
              <button
                type="button"
                className={`btn-ghost status-filter-trigger${statusMenuOpen ? ' active' : ''}`}
                onClick={() => setStatusMenuOpen((prev) => !prev)}
              >
                Select statuses
                {form.recruitingStatuses.length > 0 ? ` (${form.recruitingStatuses.length})` : ''}
              </button>
              {statusMenuOpen ? (
                <div className="status-filter-menu">
                  {RECRUITING_STATUSES.map((status) => (
                    <label key={status.value} className="status-filter-option">
                      <input
                        type="checkbox"
                        checked={form.recruitingStatuses.includes(status.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            updateFormStatuses([...form.recruitingStatuses, status.value])
                          } else {
                            updateFormStatuses(form.recruitingStatuses.filter((item) => item !== status.value))
                          }
                        }}
                      />
                      <span>{status.label}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          {form.recruitingStatuses.includes('Committed Elsewhere') ? (
            <>
              <label className="field">
                Committed School
                <input
                  name="committedSchool"
                  value={form.committedSchool}
                  onChange={handleChange}
                  placeholder="School name"
                />
              </label>
              <label className="field">
                Committed Date
                <input
                  type="date"
                  name="committedDate"
                  value={form.committedDate}
                  onChange={handleChange}
                />
              </label>
            </>
          ) : null}
          <label className="field">
            Composite Rating
            <input
              type="number"
              name="compositeRating"
              value={form.compositeRating}
              onChange={handleChange}
              placeholder="0.00"
              min="0"
              max="100"
              step="0.01"
            />
          </label>
          <label className="field field-wide">
            Notes
            <input
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="Scouting notes"
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              name="flagged"
              checked={form.flagged}
              onChange={handleChange}
            />
            Add to Saturday queue
          </label>
          <button className="btn-primary" type="submit">
            <Plus size={16} />
            Add Player
          </button>
        </form>
      </section>

      <section className="panel">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          Players ({filteredPlayers.length})
          {(() => {
            const rated = filteredPlayers.filter((p) => p.compositeRating != null && !isNaN(parseFloat(p.compositeRating)))
            if (rated.length === 0) return null
            const avg = rated.reduce((sum, p) => sum + parseFloat(p.compositeRating), 0) / rated.length
            return (
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                Avg Composite: {avg.toFixed(2)} ({rated.length} rated)
              </span>
            )
          })()}
        </h3>

        <div className="search-filters">
          <div className="field-inline">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by name or school..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}>
            {POSITIONS.map((pos) => (
              <option key={pos} value={pos}>
                {pos === 'All' ? 'All Positions' : pos}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="State"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            style={{ width: '80px' }}
          />
          <input
            type="text"
            placeholder="Grad Year"
            value={gradYearFilter}
            onChange={(e) => setGradYearFilter(e.target.value)}
            style={{ width: '100px' }}
          />
          <select value={sideFilter} onChange={(e) => setSideFilter(e.target.value)}>
            <option value="All">All Sides</option>
            <option value="Offense">Offense</option>
            <option value="Defense">Defense</option>
          </select>
          <select
            value={recruitingStatusFilter}
            onChange={(e) => setRecruitingStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            {RECRUITING_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="number"
              placeholder="Min Rating"
              value={compositeRatingMin}
              onChange={(e) => setCompositeRatingMin(e.target.value)}
              style={{ width: '90px', padding: 'var(--spacing-sm) var(--spacing-md)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
              min="0"
              max="100"
              step="0.01"
            />
            <span style={{ color: 'var(--color-text-muted)' }}>-</span>
            <input
              type="number"
              placeholder="Max Rating"
              value={compositeRatingMax}
              onChange={(e) => setCompositeRatingMax(e.target.value)}
              style={{ width: '90px', padding: 'var(--spacing-sm) var(--spacing-md)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
              min="0"
              max="100"
              step="0.01"
            />
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={flaggedOnly}
              onChange={(e) => setFlaggedOnly(e.target.checked)}
            />
            Flagged only
          </label>
        </div>

        {duplicateWarning && (
          <div className="error-message" style={{ marginBottom: '16px' }}>
            {duplicateWarning}
          </div>
        )}
        {filteredPlayers.length === 0 ? (
          players.length === 0
            ? <EmptyState icon={UserPlus} title="No players yet" subtitle="Add one to start your watchlist." />
            : <EmptyState icon={SearchX} title="No players match your filters" subtitle="Try adjusting your search or filters." />
        ) : (
          <>
            <ul className="list">
              {paginatedPlayers.map((player) => {
              const playerAssignments = getPlayerAssignments(player.id)
              return (
                <li key={player.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}>
                  {editingPlayerId === player.id ? (
                    // Edit Mode
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <PlayerAvatar name={player.name} url={player.profilePictureUrl} size={56} />
                        <input
                          ref={photoInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          style={{ display: 'none' }}
                          onChange={(e) => handlePhotoUpload(player.id, e.target.files[0])}
                        />
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => photoInputRef.current?.click()}
                          disabled={photoUploading}
                        >
                          <Camera size={16} />
                          {photoUploading ? 'Uploading...' : player.profilePictureUrl ? 'Change Photo' : 'Add Photo'}
                        </button>
                        {player.profilePictureUrl && (
                          <button
                            type="button"
                            className="btn-ghost danger"
                            onClick={() => handleDeletePhoto(player.id)}
                          >
                            <Trash2 size={14} />
                            Remove Photo
                          </button>
                        )}
                      </div>
                      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                        <label className="field">
                          Name
                          <input name="name" value={editForm.name} onChange={handleEditChange} />
                        </label>
                        <label className="field">
                          Position
                          <input name="position" value={editForm.position} onChange={handleEditChange} />
                        </label>
                        <label className="field">
                          Offense Pos
                          <input name="offensePosition" value={editForm.offensePosition} onChange={handleEditChange} />
                        </label>
                        <label className="field">
                          Defense Pos
                          <input name="defensePosition" value={editForm.defensePosition} onChange={handleEditChange} />
                        </label>
                        <label className="field">
                          School
                          <input name="school" value={editForm.school} onChange={handleEditChange} />
                        </label>
                        <label className="field">
                          State
                          <input name="state" value={editForm.state} onChange={handleEditChange} />
                        </label>
                        <label className="field">
                          Grad Year
                          <input name="gradYear" value={editForm.gradYear} onChange={handleEditChange} />
                        </label>
                        <div className="field">
                          Pipeline Statuses
                          <div className="status-filter">
                            <button
                              type="button"
                              className={`btn-ghost status-filter-trigger${editStatusMenuOpenId === player.id ? ' active' : ''}`}
                              onClick={() =>
                                setEditStatusMenuOpenId((prev) => (prev === player.id ? null : player.id))
                              }
                            >
                              Select statuses
                              {editForm.recruitingStatuses?.length ? ` (${editForm.recruitingStatuses.length})` : ''}
                            </button>
                            {editStatusMenuOpenId === player.id ? (
                              <div className="status-filter-menu">
                                {RECRUITING_STATUSES.map((status) => (
                                  <label key={status.value} className="status-filter-option">
                                    <input
                                      type="checkbox"
                                      checked={(editForm.recruitingStatuses || []).includes(status.value)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          updateEditStatuses([...(editForm.recruitingStatuses || []), status.value])
                                        } else {
                                          updateEditStatuses(
                                            (editForm.recruitingStatuses || []).filter((item) => item !== status.value)
                                          )
                                        }
                                      }}
                                    />
                                    <span>{status.label}</span>
                                  </label>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        {(editForm.recruitingStatuses || []).includes('Committed Elsewhere') ? (
                          <>
                            <label className="field">
                              Committed School
                              <input name="committedSchool" value={editForm.committedSchool || ''} onChange={handleEditChange} placeholder="School name" />
                            </label>
                            <label className="field">
                              Committed Date
                              <input type="date" name="committedDate" value={editForm.committedDate || ''} onChange={handleEditChange} />
                            </label>
                          </>
                        ) : null}
                        <label className="field">
                          Composite Rating
                          <input
                            type="number"
                            name="compositeRating"
                            value={editForm.compositeRating || ''}
                            onChange={handleEditChange}
                            placeholder="0.00"
                            min="0"
                            max="100"
                            step="0.01"
                          />
                        </label>
                        <label className="field" style={{ gridColumn: '1 / -1' }}>
                          Notes
                          <input name="notes" value={editForm.notes} onChange={handleEditChange} />
                        </label>
                      </div>
                      <div className="row-actions">
                        <button className="btn-primary" onClick={saveEditing}>
                          <Check size={16} />
                          Save
                        </button>
                        <button className="btn-secondary" onClick={cancelEditing}>
                          <X size={16} />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <PlayerAvatar name={player.name} url={player.profilePictureUrl} size={40} />
                        <div>
                        <strong style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <Link to={`/player/${player.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{player.name}</Link>
                          {player.compositeRating != null && !isNaN(parseFloat(player.compositeRating)) && (
                            <span
                              style={{
                                fontSize: '12px',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                background: 'var(--color-primary)',
                                color: 'white',
                                fontWeight: '700',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                              }}
                            >
                              {parseFloat(player.compositeRating).toFixed(2)}
                            </span>
                          )}
                          {(player.recruitingStatuses || ['Watching']).map((status) => (
                            <span key={status} className={`status-badge ${getStatusColor(status)}`}>
                              {status}
                            </span>
                          ))}
                          {player.cutUpCompleted && (
                            <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'var(--color-success)', color: 'white' }}>
                              Cut Up Done
                            </span>
                          )}
                          {playerAssignments.length > 0 && (
                            <span className="assigned-scouts" title={`Assigned to: ${playerAssignments.map((a) => a.scout_name || a.scout_email).join(', ')}`}>
                              <Users size={14} />
                              {playerAssignments.length}
                            </span>
                          )}
                        </strong>
                        {(player.recruitingStatuses || []).includes('Committed Elsewhere') && player.committedSchool ? (
                          <span className="status-detail">
                            Committed to {player.committedSchool}
                            {player.committedDate ? ` on ${String(player.committedDate).split('T')[0]}` : ''}
                          </span>
                        ) : null}
                        <span>
                          {player.position || 'Position TBD'}
                          {player.offensePosition ? ` · O: ${player.offensePosition}` : ''}
                          {player.defensePosition ? ` · D: ${player.defensePosition}` : ''} ·{' '}
                          {player.school || 'School TBD'}{player.state ? ` (${player.state})` : ''} · {player.gradYear || 'Grad year TBD'}
                        </span>
                        </div>
                      </div>
                      <div className="row-actions">
                        <label
                          className="btn-ghost"
                          title="Cut Up Completed"
                          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)' }}
                        >
                          <input
                            type="checkbox"
                            checked={player.cutUpCompleted || false}
                            onChange={() => toggleCutUpCompleted(player.id)}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--color-text-secondary)' }}
                          />
                          <span>Cut Up</span>
                        </label>
                        <button className="btn-ghost" onClick={() => startEditing(player)}>
                          <Pencil size={16} />
                          Edit
                        </button>
                        <Link className="btn-ghost" to={`/player/${player.id}/stats`}>
                          <BarChart3 size={16} />
                          Stats
                        </Link>
                        <button className="btn-ghost" onClick={() => toggleFlagged(player.id)}>
                          <Flag size={16} />
                          {player.flagged ? 'Flagged' : 'Unflagged'}
                        </button>
                        <button className="btn-ghost danger" onClick={() => removePlayer(player.id)}>
                          <Trash2 size={16} />
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn-ghost"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              <span className="pagination-info">
                Page {currentPage} of {totalPages} ({filteredPlayers.length} total)
              </span>
              <button
                className="btn-ghost"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          )}
          </>
        )}
      </section>
    </div>
  )
}

export default PlayerManagement
