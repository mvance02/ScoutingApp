import { useState, useEffect } from 'react'
import { Bell, X, Check, CheckCheck } from 'lucide-react'
import { notificationsApi } from '../utils/api'

function Notifications({ onClose }) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 30000) // Poll every 30s
    return () => clearInterval(interval)
  }, [])

  const loadNotifications = async () => {
    try {
      const [all, count] = await Promise.all([
        notificationsApi.getAll(),
        notificationsApi.getUnreadCount(),
      ])
      setNotifications(all)
      setUnreadCount(count.count)
    } catch (err) {
      console.error('Error loading notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (id) => {
    try {
      await notificationsApi.markAsRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Error marking all as read:', err)
    }
  }

  const handleDelete = async (id) => {
    try {
      await notificationsApi.delete(id)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      const deleted = notifications.find((n) => n.id === id)
      if (deleted && !deleted.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    } catch (err) {
      console.error('Error deleting notification:', err)
    }
  }

  const unreadNotifications = notifications.filter((n) => !n.read)
  const readNotifications = notifications.filter((n) => n.read)

  return (
    <div className="notifications-panel">
      <div className="notifications-header">
        <h3>
          <Bell size={20} />
          Notifications {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
        </h3>
        <div className="notifications-actions">
          {unreadCount > 0 && (
            <button className="btn-ghost" onClick={handleMarkAllAsRead}>
              <CheckCheck size={16} />
              Mark all read
            </button>
          )}
          <button className="btn-ghost" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
      </div>
      {loading ? (
        <p>Loading notifications...</p>
      ) : notifications.length === 0 ? (
        <p className="empty-state">No notifications</p>
      ) : (
        <div className="notifications-list">
          {unreadNotifications.length > 0 && (
            <div className="notifications-section">
              <h4>Unread</h4>
              {unreadNotifications.map((notification) => (
                <div key={notification.id} className="notification-item unread">
                  <div className="notification-content">
                    <strong>{notification.title}</strong>
                    {notification.message && <p>{notification.message}</p>}
                    <span className="notification-time">
                      {new Date(notification.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="notification-actions">
                    <button
                      className="btn-ghost"
                      onClick={() => handleMarkAsRead(notification.id)}
                      title="Mark as read"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={() => handleDelete(notification.id)}
                      title="Delete"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {readNotifications.length > 0 && (
            <div className="notifications-section">
              <h4>Read</h4>
              {readNotifications.map((notification) => (
                <div key={notification.id} className="notification-item">
                  <div className="notification-content">
                    <strong>{notification.title}</strong>
                    {notification.message && <p>{notification.message}</p>}
                    <span className="notification-time">
                      {new Date(notification.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="notification-actions">
                    <button
                      className="btn-ghost"
                      onClick={() => handleDelete(notification.id)}
                      title="Delete"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Notifications
