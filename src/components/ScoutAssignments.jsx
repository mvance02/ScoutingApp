import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, UserCheck, Users, Calendar, Layers } from 'lucide-react'
import { assignmentsApi, authApi } from '../utils/api'
import { loadPlayers, loadGames } from '../utils/storage'

function ScoutAssignments() {
  const navigate = useNavigate()
  const POSITION_GROUPS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'DE', 'LB', 'C', 'S', 'K', 'P']
  const [assignments, setAssignments] = useState([])
  const [scouts, setScouts] = useState([])
  const [players, setPlayers] = useState([])
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // New assignment form
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState('player') // 'player' | 'game' | 'position_group'
  const [selectedScout, setSelectedScout] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [selectedGame, setSelectedGame] = useState('')
  const [selectedPositionGroup, setSelectedPositionGroup] = useState('')
  const [assignmentNotes, setAssignmentNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const [assignmentsData, usersData, playersData, gamesData] = await Promise.all([
          assignmentsApi.getAll(),
          authApi.users(),
          loadPlayers(),
          loadGames(),
        ])
        setAssignments(assignmentsData)
        // Filter to only show scouts (not admins, unless they also scout)
        setScouts(usersData)
        setPlayers(playersData)
        setGames(gamesData)
      } catch (err) {
        setError(err.message || 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleCreateAssignment = async (e) => {
    e.preventDefault()
    if (!selectedScout) return
    if (formType === 'player' && !selectedPlayer) return
    if (formType === 'game' && !selectedGame) return
    if (formType === 'position_group' && !selectedPositionGroup) return

    setSubmitting(true)
    setError(null)

    try {
      const newAssignment = await assignmentsApi.create({
        scout_id: parseInt(selectedScout),
        player_id: formType === 'player' ? parseInt(selectedPlayer) : null,
        game_id: formType === 'game' ? parseInt(selectedGame) : null,
        position_group: formType === 'position_group' ? selectedPositionGroup : null,
        notes: assignmentNotes || null,
      })
      setAssignments([newAssignment, ...assignments])
      resetForm()
    } catch (err) {
      setError(err.message || 'Failed to create assignment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteAssignment = async (id) => {
    if (!window.confirm('Remove this assignment?')) return

    try {
      await assignmentsApi.delete(id)
      setAssignments(assignments.filter((a) => a.id !== id))
    } catch (err) {
      setError(err.message || 'Failed to delete assignment')
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setSelectedScout('')
    setSelectedPlayer('')
    setSelectedGame('')
    setSelectedPositionGroup('')
    setAssignmentNotes('')
    setFormType('player')
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString()
  }

  // Group assignments by scout
  const assignmentsByScout = assignments.reduce((acc, assignment) => {
    const scoutId = assignment.scout_id
    if (!acc[scoutId]) {
      acc[scoutId] = {
        scout: {
          id: scoutId,
          name: assignment.scout_name || assignment.scout_email,
          email: assignment.scout_email,
        },
        assignments: [],
      }
    }
    acc[scoutId].assignments.push(assignment)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="page">
        <p>Loading assignments...</p>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn-secondary" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
            Back
          </button>
          <div>
            <h2>Scout Assignments</h2>
            <p>Assign scouts to players, games, or position groups for evaluation</p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={16} />
          New Assignment
        </button>
      </header>

      {error && <div className="error-message">{error}</div>}

      {showForm && (
        <section className="panel">
          <h3>Create Assignment</h3>
          <form onSubmit={handleCreateAssignment}>
            <div className="form-grid" style={{ marginBottom: '16px' }}>
              <label className="field">
                Scout
                <select
                  value={selectedScout}
                  onChange={(e) => setSelectedScout(e.target.value)}
                  required
                >
                  <option value="">Select a scout...</option>
                  {scouts.map((scout) => (
                    <option key={scout.id} value={scout.id}>
                      {scout.name || scout.email} {scout.role === 'admin' ? '(Admin)' : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                Assignment Type
                <select value={formType} onChange={(e) => setFormType(e.target.value)}>
                  <option value="player">Player</option>
                  <option value="game">Game</option>
                  <option value="position_group">Position Group</option>
                </select>
              </label>

              {formType === 'player' ? (
                <label className="field">
                  Player
                  <select
                    value={selectedPlayer}
                    onChange={(e) => setSelectedPlayer(e.target.value)}
                    required
                  >
                    <option value="">Select a player...</option>
                    {players.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name} - {player.school || 'No school'} ({player.position || 'No position'})
                      </option>
                    ))}
                  </select>
                </label>
              ) : formType === 'game' ? (
                <label className="field">
                  Game
                  <select
                    value={selectedGame}
                    onChange={(e) => setSelectedGame(e.target.value)}
                    required
                  >
                    <option value="">Select a game...</option>
                    {games.map((game) => (
                      <option key={game.id} value={game.id}>
                        {game.opponent || 'Untitled'} - {formatDate(game.date)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="field">
                  Position Group
                  <select
                    value={selectedPositionGroup}
                    onChange={(e) => setSelectedPositionGroup(e.target.value)}
                    required
                  >
                    <option value="">Select a position group...</option>
                    {POSITION_GROUPS.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="field">
                Notes (optional)
                <input
                  type="text"
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  placeholder="Assignment notes..."
                />
              </label>
            </div>

            <div className="row-actions">
              <button type="submit" className="btn-primary" disabled={submitting}>
                <UserCheck size={16} />
                {submitting ? 'Creating...' : 'Create Assignment'}
              </button>
              <button type="button" className="btn-secondary" onClick={resetForm}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {Object.keys(assignmentsByScout).length === 0 ? (
        <section className="panel">
          <p className="empty-state">No assignments yet. Create one to get started.</p>
        </section>
      ) : (
        Object.values(assignmentsByScout).map(({ scout, assignments: scoutAssignments }) => (
          <section key={scout.id} className="panel">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} />
              {scout.name || scout.email}
              <span style={{ fontWeight: 'normal', fontSize: '14px', color: 'var(--color-text-muted)' }}>
                ({scoutAssignments.length} assignment{scoutAssignments.length !== 1 ? 's' : ''})
              </span>
            </h3>

            <ul className="list">
              {scoutAssignments.map((assignment) => (
                <li key={assignment.id} className="list-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {assignment.position_group ? (
                      <>
                        <span className="assignment-type-badge player-badge">
                          <Layers size={12} />
                          Position Group
                        </span>
                        <div>
                          <strong>{assignment.position_group}</strong>
                          {assignment.notes && (
                            <span style={{ display: 'block', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                              {assignment.notes}
                            </span>
                          )}
                        </div>
                      </>
                    ) : assignment.player_id ? (
                      <>
                        <span className="assignment-type-badge player-badge">Player</span>
                        <div>
                          <strong>{assignment.player_name || `Player #${assignment.player_id}`}</strong>
                          {assignment.notes && (
                            <span style={{ display: 'block', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                              {assignment.notes}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="assignment-type-badge game-badge">
                          <Calendar size={12} />
                          Game
                        </span>
                        <div>
                          <strong>{assignment.game_opponent || `Game #${assignment.game_id}`}</strong>
                          {assignment.game_date && (
                            <span style={{ marginLeft: '8px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                              {formatDate(assignment.game_date)}
                            </span>
                          )}
                          {assignment.notes && (
                            <span style={{ display: 'block', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                              {assignment.notes}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="row-actions">
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      Assigned {formatDate(assignment.assigned_at)}
                      {assignment.assigned_by_name && ` by ${assignment.assigned_by_name}`}
                    </span>
                    <button
                      className="btn-ghost danger"
                      onClick={() => handleDeleteAssignment(assignment.id)}
                    >
                      <Trash2 size={16} />
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}

export default ScoutAssignments
