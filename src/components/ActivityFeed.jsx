import { useState, useEffect } from 'react'
import { Activity, User, MessageSquare, BarChart3, Gamepad2, FileText, Clock } from 'lucide-react'
import { activityApi } from '../utils/api'
import { useWebSocket } from '../hooks/useWebSocket'

const ACTION_ICONS = {
  stat_created: BarChart3,
  stat_updated: BarChart3,
  stat_deleted: BarChart3,
  player_updated: User,
  comment_added: MessageSquare,
  game_created: Gamepad2,
  chat_message: MessageSquare,
}

const ACTION_LABELS = {
  stat_created: 'added stat',
  stat_updated: 'updated stat',
  stat_deleted: 'deleted stat',
  player_updated: 'updated player',
  comment_added: 'added comment',
  game_created: 'created game',
  chat_message: 'sent message',
}

function ActivityFeed({ limit = 20, compact = false }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  // Real-time updates via WebSocket
  useWebSocket({
    onActivity: (activity) => {
      setActivities((prev) => [activity, ...prev].slice(0, limit))
    },
  })

  useEffect(() => {
    loadActivities()
    // Poll every 30 seconds as backup
    const interval = setInterval(loadActivities, 30000)
    return () => clearInterval(interval)
  }, [limit])

  const loadActivities = async () => {
    try {
      const data = await activityApi.getRecent({ limit })
      setActivities(data)
    } catch (err) {
      console.error('Error loading activities:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  if (loading && activities.length === 0) {
    return (
      <div className="activity-feed">
        <p>Loading activity...</p>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="activity-feed">
        <p className="text-muted">No recent activity</p>
      </div>
    )
  }

  return (
    <div className={`activity-feed ${compact ? 'activity-feed-compact' : ''}`}>
      {!compact && <h3 className="activity-feed-title">Recent Activity</h3>}
      <div className="activity-list">
        {activities.map((activity) => {
          const Icon = ACTION_ICONS[activity.action_type] || Activity
          const label = ACTION_LABELS[activity.action_type] || activity.action_type.replace('_', ' ')
          
          return (
            <div key={activity.id} className="activity-item">
              <div className="activity-icon">
                <Icon size={16} />
              </div>
              <div className="activity-content">
                <div className="activity-text">
                  <strong>{activity.user_name || activity.user_email}</strong> {label}
                  {activity.entity_name && (
                    <span className="activity-entity"> {activity.entity_name}</span>
                  )}
                </div>
                <div className="activity-time">
                  <Clock size={12} />
                  {formatTime(activity.created_at)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ActivityFeed
