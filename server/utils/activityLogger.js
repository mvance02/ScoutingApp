import pool from '../db.js'

/**
 * Log an activity to the activity feed
 * @param {Object} params
 * @param {number} params.userId - User ID
 * @param {string} params.userName - User name
 * @param {string} params.actionType - Action type (e.g., 'stat_created', 'player_updated')
 * @param {string} params.entityType - Entity type (e.g., 'stat', 'player', 'game')
 * @param {number} params.entityId - Entity ID
 * @param {string} params.entityName - Entity name for display
 * @param {Object} params.details - Additional details (JSON)
 * @param {Object} params.io - Socket.io instance for broadcasting
 */
export async function logActivity({
  userId,
  userName,
  actionType,
  entityType,
  entityId,
  entityName,
  details = {},
  io = null,
}) {
  try {
    const result = await pool.query(
      `INSERT INTO activity_feed (user_id, user_name, action_type, entity_type, entity_id, entity_name, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, userName, actionType, entityType, entityId, entityName, JSON.stringify(details)]
    )

    const activity = result.rows[0]

    // Broadcast via WebSocket if available
    if (io) {
      // Broadcast to relevant rooms
      if (entityType === 'stat' && details.game_id) {
        io.to(`game:${details.game_id}`).emit('activity:new', activity)
      } else if (entityType === 'player' && entityId) {
        io.to(`player:${entityId}`).emit('activity:new', activity)
      }
      // Also broadcast to global activity feed listeners
      io.emit('activity:new', activity)
    }

    return activity
  } catch (err) {
    console.error('Error logging activity:', err)
    // Don't throw - activity logging shouldn't break the main operation
    return null
  }
}
