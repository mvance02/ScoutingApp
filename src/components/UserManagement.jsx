import React, { useEffect, useState } from 'react'
import { authApi } from '../utils/api'

function UserManagement() {
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'scout' })
  const [status, setStatus] = useState({ loading: true, error: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    authApi.users()
      .then(setUsers)
      .catch((err) => setStatus({ loading: false, error: err.message || 'Failed to load users' }))
      .finally(() => setStatus((prev) => ({ ...prev, loading: false })))
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    setSaving(true)
    setStatus((prev) => ({ ...prev, error: '' }))
    try {
      const response = await authApi.register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      })
      setUsers((prev) => [response.user, ...prev])
      setForm({ name: '', email: '', password: '', role: 'scout' })
    } catch (err) {
      setStatus((prev) => ({ ...prev, error: err.message || 'Unable to create user' }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h2>User Management</h2>
          <p>Create accounts for scouts and admins who will use the shared database.</p>
        </div>
      </header>

      <section className="panel">
        <h3>Create User</h3>
        <form className="form-grid" onSubmit={handleCreate}>
          <label className="field">
            Name
            <input name="name" value={form.name} onChange={handleChange} required />
          </label>
          <label className="field">
            Email
            <input name="email" type="email" value={form.email} onChange={handleChange} required />
          </label>
          <label className="field">
            Password
            <input name="password" type="password" value={form.password} onChange={handleChange} required />
          </label>
          <label className="field">
            Role
            <select name="role" value={form.role} onChange={handleChange}>
              <option value="scout">Scout</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button className="btn-primary" type="submit" disabled={saving}>
            {saving ? 'Creating...' : 'Create User'}
          </button>
        </form>
        {status.error ? <p className="auth-error">{status.error}</p> : null}
      </section>

      <section className="panel">
        <h3>Current Users</h3>
        {status.loading ? (
          <p className="empty-state">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="empty-state">No users found.</p>
        ) : (
          <ul className="list">
            {users.map((user) => (
              <li key={user.id} className="list-item">
                <div>
                  <strong>{user.name || user.email}</strong>
                  <span>{user.email} · {user.role}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default UserManagement
