const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

function getAuthToken() {
  try {
    return localStorage.getItem('auth_token')
  } catch {
    return null
  }
}

async function request(endpoint, options = {}) {
  if (endpoint == null) {
    throw new ApiError('API endpoint is required', 0)
  }

  const url = `${API_URL}${endpoint}`
  const token = getAuthToken()

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  }

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body)
  }

  try {
    const response = await fetch(url, config)

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('auth_token')
      }
      const error = await response.json().catch(() => ({ error: 'Request failed' }))
      throw new ApiError(error.error || 'Request failed', response.status)
    }

    return await response.json()
  } catch (err) {
    if (err instanceof ApiError) {
      throw err
    }
    // Network error - API might be unavailable
    throw new ApiError('Unable to connect to server', 0)
  }
}

// Players API
export const playersApi = {
  getAll: () => request('/players'),
  get: (id) => request(`/players/${id}`),
  create: (data) => request('/players', { method: 'POST', body: data }),
  update: (id, data) => request(`/players/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/players/${id}`, { method: 'DELETE' }),
  getStatusHistory: (id) => request(`/players/${id}/status-history`),
}

// Auth API
export const authApi = {
  status: () => request('/auth/status'),
  register: (data) => request('/auth/register', { method: 'POST', body: data }),
  login: (data) => request('/auth/login', { method: 'POST', body: data }),
  me: () => request('/auth/me'),
  users: () => request('/auth/users'),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email } }),
  verifyResetToken: (token) => request(`/auth/verify-reset-token/${token}`),
  resetPassword: (token, password) => request('/auth/reset-password', { method: 'POST', body: { token, password } }),
}

// Games API
export const gamesApi = {
  getAll: () => request('/games'),
  get: (id) => request(`/games/${id}`),
  create: (data) => request('/games', { method: 'POST', body: data }),
  update: (id, data) => request(`/games/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/games/${id}`, { method: 'DELETE' }),
  setPlayers: (id, playerIds) =>
    request(`/games/${id}/players`, { method: 'POST', body: { player_ids: playerIds } }),
}

// Stats API
export const statsApi = {
  getForGame: (gameId) => request(`/stats/${gameId}`),
  getAll: (playerId) => request(`/stats${playerId ? `?player_id=${playerId}` : ''}`),
  create: (data) => request('/stats', { method: 'POST', body: data }),
  update: (id, data) => request(`/stats/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/stats/${id}`, { method: 'DELETE' }),
}

// Grades API
export const gradesApi = {
  getForGame: (gameId) => request(`/grades/${gameId}`),
  upsert: (gameId, playerId, data) => request(`/grades/${gameId}/${playerId}`, { method: 'PUT', body: data }),
  delete: (gameId, playerId) => request(`/grades/${gameId}/${playerId}`, { method: 'DELETE' }),
}

// Notes API
export const notesApi = {
  getForGame: (gameId) => request(`/notes/${gameId}`),
  create: (data) => request('/notes', { method: 'POST', body: data }),
  update: (id, data) => request(`/notes/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/notes/${id}`, { method: 'DELETE' }),
}

// Email API
export const emailApi = {
  sendGameDay: (payload) => request('/email/game-day', { method: 'POST', body: payload }),
  sendRecruitsReport: (payload) => request('/email/recruits-report', { method: 'POST', body: payload }),
  sendRecruitsReportByCoach: (payload) => request('/email/recruits-report-by-coach', { method: 'POST', body: payload }),
}

// Assignments API
export const assignmentsApi = {
  getAll: () => request('/assignments'),
  getMine: () => request('/assignments/mine'),
  create: (data) => request('/assignments', { method: 'POST', body: data }),
  update: (id, data) => request(`/assignments/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/assignments/${id}`, { method: 'DELETE' }),
}

// Audit API
export const auditApi = {
  getAll: (params = {}) => {
    const query = new window.URLSearchParams(params).toString()
    return request(`/audit-log${query ? `?${query}` : ''}`)
  },
}

// Backup API
export const backupApi = {
  export: () => request('/backup'),
  restore: (data) => request('/restore', { method: 'POST', body: data }),
}

// Performances API
export const performancesApi = {
  getTopPerformances: (limit = 3) => request(`/performances/top-performances?limit=${limit}`),
  getBreakoutPlayers: (limit = 10) => request(`/performances/breakout-players?limit=${limit}`),
  getLeaderboard: (options = {}) => {
    const params = new window.URLSearchParams()
    if (options.startDate) params.append('start_date', options.startDate)
    if (options.endDate) params.append('end_date', options.endDate)
    if (options.limit) params.append('limit', options.limit)
    return request(`/performances/leaderboard?${params}`)
  },
}

// Recruits API
export const recruitsApi = {
  getAll: () => request('/recruits'),
  create: (data) => request('/recruits', { method: 'POST', body: data }),
  update: (id, data) => request(`/recruits/${id}`, { method: 'PUT', body: data }),
}

export const recruitReportsApi = {
  getForWeek: (weekStart) => request(`/recruit-reports?week_start_date=${weekStart}`),
  upsert: (recruitId, data) => request(`/recruit-reports/${recruitId}`, { method: 'PUT', body: data }),
}

export const recruitNotesApi = {
  create: (data) => request('/recruit-notes', { method: 'POST', body: data }),
  update: (id, data) => request(`/recruit-notes/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/recruit-notes/${id}`, { method: 'DELETE' }),
}

// Notifications API
export const notificationsApi = {
  getAll: () => request('/notifications'),
  getUnreadCount: () => request('/notifications/unread-count'),
  markAsRead: (id) => request(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllAsRead: () => request('/notifications/mark-all-read', { method: 'PUT' }),
  delete: (id) => request(`/notifications/${id}`, { method: 'DELETE' }),
}

// Player Comments API
export const playerCommentsApi = {
  getForPlayer: (playerId) => request(`/player-comments/player/${playerId}`),
  create: (data) => request('/player-comments', { method: 'POST', body: data }),
  update: (id, data) => request(`/player-comments/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/player-comments/${id}`, { method: 'DELETE' }),
}

// Visits API
export const visitsApi = {
  getForPlayer: (playerId) => request(`/visits/player/${playerId}`),
  getUpcoming: () => request('/visits/upcoming'),
  create: (data) => request('/visits', { method: 'POST', body: data }),
  update: (id, data) => request(`/visits/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/visits/${id}`, { method: 'DELETE' }),
}

// Activity Feed API
export const activityApi = {
  getRecent: (params = {}) => {
    const query = new window.URLSearchParams(params).toString()
    return request(`/activity${query ? `?${query}` : ''}`)
  },
  getCount: () => request('/activity/count'),
}

// Chat API
export const chatApi = {
  getRoom: (type, entityId = null) => {
    const path = entityId ? `/chat/room/${type}/${entityId}` : `/chat/room/${type}`
    return request(path)
  },
  getRooms: (type = null) => {
    const query = type ? `?type=${type}` : ''
    return request(`/chat/rooms${query}`)
  },
  getMessages: (roomId, params = {}) => {
    const query = new window.URLSearchParams(params).toString()
    return request(`/chat/messages/${roomId}${query ? `?${query}` : ''}`)
  },
  sendMessage: (roomId, message) => request('/chat/messages', { method: 'POST', body: { room_id: roomId, message } }),
  markAsRead: (roomId) => request(`/chat/messages/${roomId}/read`, { method: 'PUT' }),
}

// Check if API is available
export async function checkApiHealth() {
  try {
    await request('/health')
    return true
  } catch {
    return false
  }
}

export { ApiError }
