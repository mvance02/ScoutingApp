import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Filter, ChevronLeft, ChevronRight } from 'lucide-react'
import { auditApi, authApi } from '../utils/api'

const ACTION_COLORS = {
  CREATE: 'badge-green',
  UPDATE: 'badge-blue',
  DELETE: 'badge-red',
}

function AuditLog() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState([])
  const [users, setUsers] = useState([])
  const [actions, setActions] = useState([])
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })

  // Filters
  const [filters, setFilters] = useState({
    user_id: '',
    action: '',
    table_name: '',
    start_date: '',
    end_date: '',
  })

  const [showFilters, setShowFilters] = useState(false)

  const fetchAuditLog = useCallback(async (page = 1) => {
    setLoading(true)
    setError(null)
    try {
      const response = await auditApi.getAll({
        ...filters,
        page,
        limit: pagination.limit,
      })
      setEntries(response.entries)
      setPagination(response.pagination)
    } catch (err) {
      setError(err.message || 'Failed to load audit log')
    } finally {
      setLoading(false)
    }
  }, [filters, pagination.limit])

  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const [usersData, actionsData, tablesData] = await Promise.all([
          authApi.users(),
          auditApi.getActions(),
          auditApi.getTables(),
        ])
        setUsers(usersData)
        setActions(actionsData)
        setTables(tablesData)
      } catch (err) {
        console.error('Error loading filter options:', err)
      }
    }
    loadFilterOptions()
  }, [])

  useEffect(() => {
    fetchAuditLog(1)
  }, [filters])

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const clearFilters = () => {
    setFilters({
      user_id: '',
      action: '',
      table_name: '',
      start_date: '',
      end_date: '',
    })
  }

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchAuditLog(newPage)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  const formatChanges = (oldValues, newValues, action) => {
    if (action === 'CREATE') {
      return <span className="text-muted">New record created</span>
    }
    if (action === 'DELETE') {
      return <span className="text-muted">Record deleted</span>
    }

    // For updates, show changed fields
    if (!oldValues || !newValues) {
      return <span className="text-muted">Values changed</span>
    }

    const changes = []
    const old = typeof oldValues === 'string' ? JSON.parse(oldValues) : oldValues
    const updated = typeof newValues === 'string' ? JSON.parse(newValues) : newValues

    for (const key of Object.keys(updated)) {
      if (JSON.stringify(old[key]) !== JSON.stringify(updated[key])) {
        changes.push(key)
      }
    }

    if (changes.length === 0) {
      return <span className="text-muted">No visible changes</span>
    }

    return (
      <span className="changes-list">
        Changed: {changes.slice(0, 3).join(', ')}
        {changes.length > 3 && ` +${changes.length - 3} more`}
      </span>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          Back
        </button>
        <h1>Audit Log</h1>
        <button
          className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={16} />
          Filters
        </button>
      </div>

      {showFilters && (
        <div className="filters-panel">
          <div className="filters-grid">
            <div className="filter-group">
              <label htmlFor="user_id">User</label>
              <select
                id="user_id"
                name="user_id"
                value={filters.user_id}
                onChange={handleFilterChange}
              >
                <option value="">All Users</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="action">Action</label>
              <select
                id="action"
                name="action"
                value={filters.action}
                onChange={handleFilterChange}
              >
                <option value="">All Actions</option>
                {actions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="table_name">Table</label>
              <select
                id="table_name"
                name="table_name"
                value={filters.table_name}
                onChange={handleFilterChange}
              >
                <option value="">All Tables</option>
                {tables.map((table) => (
                  <option key={table} value={table}>
                    {table}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="start_date">From Date</label>
              <input
                type="datetime-local"
                id="start_date"
                name="start_date"
                value={filters.start_date}
                onChange={handleFilterChange}
              />
            </div>

            <div className="filter-group">
              <label htmlFor="end_date">To Date</label>
              <input
                type="datetime-local"
                id="end_date"
                name="end_date"
                value={filters.end_date}
                onChange={handleFilterChange}
              />
            </div>

            <div className="filter-group filter-actions">
              <button className="btn btn-secondary" onClick={clearFilters}>
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading-spinner">Loading audit log...</div>
      ) : (
        <>
          <div className="table-container">
            <table className="data-table audit-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Table</th>
                  <th>Record ID</th>
                  <th>Changes</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="empty-state">
                      No audit entries found
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="timestamp-cell">{formatDate(entry.created_at)}</td>
                      <td>{entry.user_name || entry.user_email || 'Unknown'}</td>
                      <td>
                        <span className={`badge ${ACTION_COLORS[entry.action] || ''}`}>
                          {entry.action}
                        </span>
                      </td>
                      <td className="table-name-cell">{entry.table_name}</td>
                      <td>{entry.record_id}</td>
                      <td className="changes-cell">
                        {formatChanges(entry.old_values, entry.new_values, entry.action)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              <span className="pagination-info">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default AuditLog
