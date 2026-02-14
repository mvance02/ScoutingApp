import { useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const WS_URL = API_URL.replace('/api', '')

/**
 * WebSocket hook for real-time updates
 * @param {string|null} gameId - Game ID to join game room
 * @param {string|null} playerId - Player ID to join player room
 * @param {string|null} chatRoomId - Chat room ID to join
 * @param {Function} onStatUpdate - Callback for stat updates
 * @param {Function} onPlayerUpdate - Callback for player updates
 * @param {Function} onCommentUpdate - Callback for comment updates
 * @param {Function} onChatMessage - Callback for chat messages
 * @param {Function} onActivity - Callback for activity feed updates
 * @returns {Object} Socket instance and helper functions
 */
export function useWebSocket({
  gameId = null,
  playerId = null,
  chatRoomId = null,
  onStatUpdate = null,
  onPlayerUpdate = null,
  onCommentUpdate = null,
  onChatMessage = null,
  onActivity = null,
} = {}) {
  const socketRef = useRef(null)
  const callbacksRef = useRef({ onStatUpdate, onPlayerUpdate, onCommentUpdate, onChatMessage, onActivity })

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = { onStatUpdate, onPlayerUpdate, onCommentUpdate, onChatMessage, onActivity }
  }, [onStatUpdate, onPlayerUpdate, onCommentUpdate, onChatMessage, onActivity])

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      console.warn('No auth token found, WebSocket connection skipped')
      return
    }

    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    socket.on('connect', () => {
      console.log('WebSocket connected')
      
      // Join rooms
      if (gameId) {
        socket.emit('join:game', gameId)
      }
      if (playerId) {
        socket.emit('join:player', playerId)
      }
      if (chatRoomId) {
        socket.emit('join:chat', chatRoomId)
      }
    })

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected')
    })

    socket.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err)
    })

    // Stat events
    socket.on('stat:created', (data) => {
      callbacksRef.current.onStatUpdate?.({ type: 'created', ...data })
    })

    socket.on('stat:updated', (data) => {
      callbacksRef.current.onStatUpdate?.({ type: 'updated', ...data })
    })

    socket.on('stat:deleted', (data) => {
      callbacksRef.current.onStatUpdate?.({ type: 'deleted', ...data })
    })

    // Comment events
    socket.on('comment:created', (data) => {
      callbacksRef.current.onCommentUpdate?.({ type: 'created', ...data })
    })

    // Chat events
    socket.on('message:new', (data) => {
      callbacksRef.current.onChatMessage?.(data)
    })

    socket.on('user:typing', (data) => {
      // Handle typing indicator
    })

    socket.on('user:typing:stop', (data) => {
      // Handle typing stop
    })

    // Activity feed events
    socket.on('activity:new', (data) => {
      callbacksRef.current.onActivity?.(data)
    })

    socketRef.current = socket

    return () => {
      if (gameId) {
        socket.emit('leave:game', gameId)
      }
      if (playerId) {
        socket.emit('leave:player', playerId)
      }
      if (chatRoomId) {
        socket.emit('leave:chat', chatRoomId)
      }
      socket.disconnect()
    }
  }, [gameId, playerId, chatRoomId])

  const emitTyping = useCallback((roomId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing', { room_id: roomId })
    }
  }, [])

  const emitTypingStop = useCallback((roomId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing:stop', { room_id: roomId })
    }
  }, [])

  return {
    socket: socketRef.current,
    emitTyping,
    emitTypingStop,
    isConnected: socketRef.current?.connected || false,
  }
}
