import pool from '../db.js'

/**
 * Parse @mentions from text
 * @param {string} text - Text to parse
 * @returns {string[]} Array of mentioned usernames/emails
 */
export function parseMentions(text) {
  if (!text) return []
  
  // Match @username or @email patterns
  const mentionRegex = /@([\w.@-]+)/g
  const mentions = []
  let match
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1].trim())
  }
  
  return [...new Set(mentions)] // Remove duplicates
}

/**
 * Get user IDs from usernames/emails
 * @param {string[]} mentions - Array of usernames/emails
 * @returns {Promise<Array>} Array of user objects with id, name, email
 */
export async function getMentionedUsers(mentions) {
  if (mentions.length === 0) return []
  
  try {
    const result = await pool.query(
      `SELECT id, name, email FROM users 
       WHERE email = ANY($1) OR name = ANY($1) OR LOWER(email) = ANY($2) OR LOWER(name) = ANY($2)`,
      [mentions, mentions.map(m => m.toLowerCase())]
    )
    return result.rows
  } catch (err) {
    console.error('Error getting mentioned users:', err)
    return []
  }
}

/**
 * Create mention notifications and track mentions
 * @param {number} commentId - Comment ID
 * @param {string[]} mentionedUsernames - Array of mentioned usernames
 * @param {number} commenterId - ID of user who created the comment
 * @param {number} playerId - Player ID (for link)
 */
export async function createMentionNotifications(commentId, mentionedUsernames, commenterId, playerId = null) {
  if (mentionedUsernames.length === 0) return
  
  try {
    const users = await getMentionedUsers(mentionedUsernames)
    
    // Create notifications for mentioned users
    for (const user of users) {
      // Don't notify the commenter if they mentioned themselves
      if (user.id === commenterId) continue
      
      // Create notification
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, related_player_id, read)
         VALUES ($1, $2, $3, $4, $5, false)`,
        [
          user.id,
          'You were mentioned',
          `You were mentioned in a comment`,
          'mention',
          playerId || null,
        ]
      )
      
      // Track mention
      await pool.query(
        'INSERT INTO comment_mentions (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [commentId, user.id]
      )
    }
  } catch (err) {
    console.error('Error creating mention notifications:', err)
  }
}
