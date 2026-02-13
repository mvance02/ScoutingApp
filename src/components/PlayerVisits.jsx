import { useState, useEffect } from 'react'
import { Calendar, Plus, X, Pencil, Trash2, MapPin } from 'lucide-react'
import { visitsApi } from '../utils/api'
import { authApi } from '../utils/api'

const VISIT_TYPES = ['Official', 'Unofficial', 'Gameday', 'Junior Day', 'Camp', 'Other']

function PlayerVisits({ playerId }) {
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [addingVisit, setAddingVisit] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    visit_date: '',
    visit_type: VISIT_TYPES[0],
    location: '',
    notes: '',
  })
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    loadVisits()
    loadCurrentUser()
  }, [playerId])

  const loadCurrentUser = async () => {
    try {
      const user = await authApi.me()
      setCurrentUser(user)
    } catch (err) {
      console.error('Error loading current user:', err)
    }
  }

  const loadVisits = async () => {
    try {
      const loaded = await visitsApi.getForPlayer(playerId)
      setVisits(loaded.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date)))
    } catch (err) {
      console.error('Error loading visits:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddVisit = async () => {
    if (!form.visit_date) return
    try {
      const created = await visitsApi.create({
        player_id: playerId,
        ...form,
      })
      setVisits((prev) => [created, ...prev].sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date)))
      resetForm()
      setAddingVisit(false)
    } catch (err) {
      console.error('Error adding visit:', err)
      alert('Failed to add visit')
    }
  }

  const handleUpdateVisit = async (id) => {
    if (!form.visit_date) return
    try {
      const updated = await visitsApi.update(id, form)
      setVisits((prev) =>
        prev.map((v) => (v.id === id ? updated : v)).sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date))
      )
      setEditingId(null)
      resetForm()
    } catch (err) {
      console.error('Error updating visit:', err)
      alert('Failed to update visit')
    }
  }

  const handleDeleteVisit = async (id) => {
    if (!window.confirm('Delete this visit?')) return
    try {
      await visitsApi.delete(id)
      setVisits((prev) => prev.filter((v) => v.id !== id))
    } catch (err) {
      console.error('Error deleting visit:', err)
      alert('Failed to delete visit')
    }
  }

  const startEditing = (visit) => {
    setEditingId(visit.id)
    setForm({
      visit_date: visit.visit_date,
      visit_type: visit.visit_type || VISIT_TYPES[0],
      location: visit.location || '',
      notes: visit.notes || '',
    })
    setAddingVisit(false)
  }

  const resetForm = () => {
    setForm({
      visit_date: '',
      visit_type: VISIT_TYPES[0],
      location: '',
      notes: '',
    })
  }

  const cancelEditing = () => {
    setEditingId(null)
    resetForm()
    setAddingVisit(false)
  }

  if (loading) return <p>Loading visits...</p>

  const upcomingVisits = visits.filter((v) => new Date(v.visit_date) >= new Date())
  const pastVisits = visits.filter((v) => new Date(v.visit_date) < new Date())

  return (
    <div className="player-visits">
      <div className="visits-header">
        <h4>
          <Calendar size={16} />
          Visits ({visits.length})
        </h4>
        {!addingVisit && !editingId && (
          <button className="btn-ghost" onClick={() => setAddingVisit(true)}>
            <Plus size={14} />
            Schedule Visit
          </button>
        )}
      </div>

      {(addingVisit || editingId) && (
        <div className="visit-form">
          <div className="form-grid">
            <label className="field">
              Visit Date
              <input
                type="date"
                value={form.visit_date}
                onChange={(e) => setForm((prev) => ({ ...prev, visit_date: e.target.value }))}
                required
              />
            </label>
            <label className="field">
              Visit Type
              <select
                value={form.visit_type}
                onChange={(e) => setForm((prev) => ({ ...prev, visit_type: e.target.value }))}
              >
                {VISIT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Location
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="BYU, Other School, etc."
              />
            </label>
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              Notes
              <textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
                placeholder="Additional notes about the visit..."
              />
            </label>
          </div>
          <div className="visit-form-actions">
            <button
              className="btn-primary"
              onClick={() => (editingId ? handleUpdateVisit(editingId) : handleAddVisit())}
            >
              {editingId ? 'Update' : 'Schedule'}
            </button>
            <button className="btn-secondary" onClick={cancelEditing}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="visits-list">
        {visits.length === 0 ? (
          <p className="empty-state">No visits scheduled yet.</p>
        ) : (
          <>
            {upcomingVisits.length > 0 && (
              <div className="visits-section">
                <h5>Upcoming</h5>
                {upcomingVisits.map((visit) => (
                  <div key={visit.id} className="visit-item upcoming">
                    <div className="visit-content">
                      <div className="visit-header">
                        <strong>{new Date(visit.visit_date).toLocaleDateString()}</strong>
                        <span className="visit-type">{visit.visit_type}</span>
                      </div>
                      {visit.location && (
                        <div className="visit-location">
                          <MapPin size={14} />
                          {visit.location}
                        </div>
                      )}
                      {visit.notes && <p className="visit-notes">{visit.notes}</p>}
                      <span className="visit-created">
                        Added by {visit.created_by_name || 'Unknown'} on{' '}
                        {new Date(visit.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {currentUser && (
                      <div className="visit-actions">
                        <button className="btn-ghost" onClick={() => startEditing(visit)}>
                          <Pencil size={14} />
                        </button>
                        <button
                          className="btn-ghost danger"
                          onClick={() => handleDeleteVisit(visit.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {pastVisits.length > 0 && (
              <div className="visits-section">
                <h5>Past Visits</h5>
                {pastVisits.map((visit) => (
                  <div key={visit.id} className="visit-item">
                    <div className="visit-content">
                      <div className="visit-header">
                        <strong>{new Date(visit.visit_date).toLocaleDateString()}</strong>
                        <span className="visit-type">{visit.visit_type}</span>
                      </div>
                      {visit.location && (
                        <div className="visit-location">
                          <MapPin size={14} />
                          {visit.location}
                        </div>
                      )}
                      {visit.notes && <p className="visit-notes">{visit.notes}</p>}
                      <span className="visit-created">
                        Added by {visit.created_by_name || 'Unknown'} on{' '}
                        {new Date(visit.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {currentUser && (
                      <div className="visit-actions">
                        <button className="btn-ghost" onClick={() => startEditing(visit)}>
                          <Pencil size={14} />
                        </button>
                        <button
                          className="btn-ghost danger"
                          onClick={() => handleDeleteVisit(visit.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default PlayerVisits
