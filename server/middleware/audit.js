import pool from '../db.js'

/**
 * Log an audit entry to the audit_log table.
 * Non-blocking - errors are logged but don't break operations.
 *
 * @param {Object} params
 * @param {number} params.userId - ID of the user performing the action
 * @param {string} params.userEmail - Email of the user performing the action
 * @param {string} params.action - Action type (CREATE, UPDATE, DELETE)
 * @param {string} params.tableName - Name of the affected table
 * @param {number} params.recordId - ID of the affected record
 * @param {Object} params.oldValues - Previous values (for updates/deletes)
 * @param {Object} params.newValues - New values (for creates/updates)
 * @param {string} params.ipAddress - IP address of the request
 */
export async function logAudit({
  userId,
  userEmail,
  action,
  tableName,
  recordId,
  oldValues = null,
  newValues = null,
  ipAddress = null,
}) {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, old_values, new_values, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        userEmail,
        action,
        tableName,
        recordId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
      ]
    )
  } catch (err) {
    // Non-blocking - log error but don't throw
    console.error('Audit log error:', err.message)
  }
}

/**
 * Get client IP address from request
 * @param {Object} req - Express request object
 * @returns {string} IP address
 */
export function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    null
  )
}

export default { logAudit, getClientIp }
