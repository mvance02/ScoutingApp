import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../utils/api'

function Login({ onAuthSuccess }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [allowRegister, setAllowRegister] = useState(false)
  const [statusLoading, setStatusLoading] = useState(true)

  useEffect(() => {
    authApi.status()
      .then(({ hasUsers }) => {
        setAllowRegister(!hasUsers)
      })
      .catch(() => {
        setAllowRegister(false)
      })
      .finally(() => setStatusLoading(false))
  }, [])

  const handleChange = event => {
    const { name, value } = event.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async event => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload = {
        email: form.email.trim(),
        password: form.password
      }
      if (mode === 'register') {
        payload.name = form.name.trim()
      }

      const response = mode === 'login'
        ? await authApi.login(payload)
        : await authApi.register(payload)

      const token = response.token
      if (!token) throw new Error('Missing token')
      localStorage.setItem('auth_token', token)
      onAuthSuccess(response.user)
    } catch (err) {
      setError(err?.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>{mode === 'login' ? 'Scout Login' : 'Create Admin Account'}</h2>
        <p className="helper-text">
          {mode === 'login'
            ? 'Sign in to access the shared scouting database.'
            : 'First-time setup only. If an admin exists, this will be blocked.'}
        </p>
        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' ? (
            <label className="field">
              Name
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Admin name"
              />
            </label>
          ) : null}
          <label className="field">
            Email
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@school.edu"
              required
            />
          </label>
          <label className="field">
            Password
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </label>
          {error ? <p className="auth-error">{error}</p> : null}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Working...' : mode === 'login' ? 'Log In' : 'Create Admin'}
          </button>
          {mode === 'login' && (
            <Link to="/forgot-password" className="btn-ghost" style={{ textAlign: 'center' }}>
              Forgot password?
            </Link>
          )}
        </form>
        {statusLoading ? null : allowRegister ? (
          <button
            className="btn-ghost"
            type="button"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login'
              ? 'First time? Create admin account'
              : 'Back to login'}
          </button>
        ) : (
          <p className="auth-muted">
            Ask an admin to create your account.
          </p>
        )}
      </div>
    </div>
  )
}

export default Login
