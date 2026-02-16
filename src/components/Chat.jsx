import { useState, useEffect, useRef } from 'react'
import { Send, MessageSquare, Users } from 'lucide-react'
import { chatApi, authApi } from '../utils/api'
import { useWebSocket } from '../hooks/useWebSocket'

function Chat({ roomType, entityId = null, title = null }) {
  const [room, setRoom] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageText, setMessageText] = useState('')
  const [typingUsers, setTypingUsers] = useState([])
  const [users, setUsers] = useState([])
  const [mentionSuggestions, setMentionSuggestions] = useState([])
  const [mentionIndex, setMentionIndex] = useState(-1)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    loadRoom()
    loadUsers()
    loadCurrentUser()
  }, [roomType, entityId])

  useEffect(() => {
    if (room) {
      loadMessages()
    }
  }, [room])

  // Real-time message updates via WebSocket
  const { emitTyping, emitTypingStop } = useWebSocket({
    chatRoomId: room?.id,
    onChatMessage: (data) => {
      if (data.message.room_id === room?.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev
          return [...prev, data.message]
        })
        scrollToBottom()
      }
    },
  })

  const loadRoom = async () => {
    try {
      const roomData = await chatApi.getRoom(roomType, entityId)
      setRoom(roomData)
    } catch (err) {
      console.error('Error loading room:', err)
    }
  }

  const loadUsers = async () => {
    try {
      const userList = await authApi.users()
      setUsers(userList)
    } catch (err) {
      console.error('Error loading users:', err)
    }
  }

  const loadCurrentUser = async () => {
    try {
      const user = await authApi.me()
      setCurrentUser(user)
    } catch (err) {
      console.error('Error loading current user:', err)
    }
  }

  const loadMessages = async () => {
    try {
      const data = await chatApi.getMessages(room.id, { limit: 50 })
      setMessages(data)
      scrollToBottom()
    } catch (err) {
      console.error('Error loading messages:', err)
    }
  }

  const handleSend = async () => {
    if (!messageText.trim() || !room) return
    
    try {
      await chatApi.sendMessage(room.id, messageText.trim())
      setMessageText('')
      setMentionSuggestions([])
      emitTypingStop(room.id)
    } catch (err) {
      console.error('Error sending message:', err)
      alert('Failed to send message')
    }
  }

  const handleTyping = () => {
    if (!room) return
    
    // Clear timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    
    // Emit typing
    emitTyping(room.id)
    
    // Stop typing after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      emitTypingStop(room.id)
    }, 3000)
  }

  const handleMessageChange = (e) => {
    const text = e.target.value
    setMessageText(text)
    handleTyping()
    
    // Check for @ mentions
    const cursorPos = e.target.selectionStart
    const textBeforeCursor = text.substring(0, cursorPos)
    const match = textBeforeCursor.match(/@(\w*)$/)
    
    if (match) {
      const query = match[1].toLowerCase()
      const suggestions = users
        .filter(u => 
          (u.name?.toLowerCase().includes(query) || 
           u.email?.toLowerCase().includes(query)) &&
          u.id !== currentUser?.id
        )
        .slice(0, 5)
      setMentionSuggestions(suggestions)
      setMentionIndex(cursorPos - match[0].length)
    } else {
      setMentionSuggestions([])
      setMentionIndex(-1)
    }
  }

  const insertMention = (user) => {
    const before = messageText.substring(0, mentionIndex)
    const after = messageText.substring(mentionIndex + (messageText.substring(mentionIndex).match(/@\w*/)?.[0]?.length || 0))
    const mentionText = `@${user.name || user.email} `
    setMessageText(`${before}${mentionText}${after}`)
    setMentionSuggestions([])
    setMentionIndex(-1)
    
    setTimeout(() => {
      if (inputRef.current) {
        const newPos = mentionIndex + mentionText.length
        inputRef.current.focus()
        inputRef.current.setSelectionRange(newPos, newPos)
      }
    }, 0)
  }

  const renderMessageWithMentions = (message) => {
    const parts = message.split(/(@[\w.@-]+)/g)
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} className="mention" style={{ 
            background: 'var(--color-primary)', 
            color: 'white', 
            padding: '2px 6px', 
            borderRadius: '4px',
            fontWeight: 600,
            margin: '0 2px',
          }}>
            {part}
          </span>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  if (!room) {
    return <div className="chat-container"><p>Loading chat...</p></div>
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <MessageSquare size={20} />
        <h3>{title || room.name || 'Chat'}</h3>
      </div>
      
      <div className="chat-messages">
        {messages.length === 0 ? (
          <p className="empty-state">No messages yet. Start the conversation!</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="chat-message">
              <div className="chat-message-header">
                <strong>{msg.user_name || msg.user_email || 'Unknown'}</strong>
                <span className="message-time">
                  {new Date(msg.created_at).toLocaleTimeString()}
                </span>
              </div>
              <div className="chat-message-content">
                {renderMessageWithMentions(msg.message)}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {typingUsers.length > 0 && (
        <div className="typing-indicator">
          {typingUsers.join(', ')} typing...
        </div>
      )}
      
      <div className="chat-input-container" style={{ position: 'relative' }}>
        {mentionSuggestions.length > 0 && (
          <div className="mention-suggestions" style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '8px',
            marginBottom: '8px',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}>
            {mentionSuggestions.map((user) => (
              <button
                key={user.id}
                onClick={() => insertMention(user)}
                className="mention-suggestion"
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '4px',
                }}
                onMouseEnter={(e) => e.target.style.background = 'var(--color-border)'}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
              >
                {user.name || user.email}
              </button>
            ))}
          </div>
        )}
        <div className="chat-input">
          <input
            ref={inputRef}
            type="text"
            value={messageText}
            onChange={handleMessageChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Type a message... (use @ to mention)"
          />
          <button onClick={handleSend} className="btn-primary">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default Chat
