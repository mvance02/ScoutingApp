import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail } from 'lucide-react'
import { authApi } from '../utils/api'

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await authApi.forgotPassword({ email: email.trim() })
      setSubmitted(true)
    } catch (err) {
      setError(err?.message || 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <Mail size={48} style={{ color: 'var(--color-primary)' }} />
          </div>
          <h2>Check Your Email</h2>
          <p className="helper-text" style={{ textAlign: 'center', marginBottom: '24px' }}>
            If an account exists for <strong>{email}</strong>, you will receive a password reset link shortly.
          </p>
          <Link to="/login" className="btn-primary" style={{ display: 'block', textAlign: 'center' }}>
            Back to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Reset Password</h2>
        <p className="helper-text" style={{ marginBottom: '24px' }}>
          Enter your email address and we will send you a link to reset your password.
        </p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="field">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
              required
              autoFocus
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
        <Link
          to="/login"
          className="btn-ghost"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '16px' }}
        >
          <ArrowLeft size={16} />
          Back to Login
        </Link>
      </div>
    </div>
  )
}

export default ForgotPassword
