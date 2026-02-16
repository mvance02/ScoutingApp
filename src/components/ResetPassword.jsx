import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { CheckCircle, XCircle } from 'lucide-react'
import { authApi } from '../utils/api'

function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setValidating(false)
      return
    }

    authApi
      .verifyResetToken(token)
      .then(({ valid }) => setTokenValid(valid))
      .catch(() => setTokenValid(false))
      .finally(() => setValidating(false))
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      await authApi.resetPassword(token, password)
      setSuccess(true)
    } catch (err) {
      setError(err?.message || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  if (validating) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p style={{ textAlign: 'center' }}>Verifying reset link...</p>
        </div>
      </div>
    )
  }

  if (!token || !tokenValid) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <XCircle size={48} style={{ color: 'var(--color-danger)' }} />
          </div>
          <h2>Invalid Reset Link</h2>
          <p className="helper-text" style={{ textAlign: 'center', marginBottom: '24px' }}>
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <Link to="/forgot-password" className="btn-primary" style={{ display: 'block', textAlign: 'center' }}>
            Request New Link
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <CheckCircle size={48} style={{ color: 'var(--color-success)' }} />
          </div>
          <h2>Password Reset!</h2>
          <p className="helper-text" style={{ textAlign: 'center', marginBottom: '24px' }}>
            Your password has been successfully reset. You can now log in with your new password.
          </p>
          <Link to="/login" className="btn-primary" style={{ display: 'block', textAlign: 'center' }}>
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Set New Password</h2>
        <p className="helper-text" style={{ marginBottom: '24px' }}>
          Enter your new password below.
        </p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="field">
            New Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
              autoFocus
            />
          </label>
          <label className="field">
            Confirm Password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ResetPassword
