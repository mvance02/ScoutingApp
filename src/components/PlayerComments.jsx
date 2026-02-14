import { useState, useEffect, useMemo, useRef } from 'react'
import { MessageSquare, Plus, X, Pencil, Trash2, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { playerCommentsApi, authApi } from '../utils/api'
import { useWebSocket } from '../hooks/useWebSocket'

function PlayerComments({ playerId }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [addingComment, setAddingComment] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [users, setUsers] = useState([]) // For mention autocomplete
  const [mentionSuggestions, setMentionSuggestions] = useState([])
  const [mentionIndex, setMentionIndex] = useState(-1)
  const [currentPage, setCurrentPage] = useState(1)
  const [commentsPerPage] = useState(10)
  const textareaRef = useRef(null)

  // Real-time comment updates via WebSocket
  useWebSocket({
    playerId,
    onCommentUpdate: (data) => {
      if (data.type === 'created') {
        // Only add if comment doesn't already exist (avoid duplicates)
        setComments((prev) => {
          const exists = prev.some(c => c.id === data.comment.id)
          if (exists) return prev
          return [data.comment, ...prev]
        })
      }
    },
  })

  useEffect(() => {
    loadComments()
    loadCurrentUser()
    loadUsers()
  }, [playerId])

  const loadCurrentUser = async () => {
    try {
      const user = await authApi.me()
      setCurrentUser(user)
    } catch (err) {
      console.error('Error loading current user:', err)
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

  const handleCommentChange = (e) => {
    const text = e.target.value
    setCommentText(text)
    
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
    const before = commentText.substring(0, mentionIndex)
    const after = commentText.substring(mentionIndex + (commentText.substring(mentionIndex).match(/@\w*/)?.[0]?.length || 0))
    const mentionText = `@${user.name || user.email} `
    setCommentText(`${before}${mentionText}${after}`)
    setMentionSuggestions([])
    setMentionIndex(-1)
    
    // Refocus textarea
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = mentionIndex + mentionText.length
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newPos, newPos)
      }
    }, 0)
  }

  const renderCommentWithMentions = (comment) => {
    const parts = comment.split(/(@[\w.@-]+)/g)
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

  const loadComments = async () => {
    try {
      const loaded = await playerCommentsApi.getForPlayer(playerId)
      setComments(loaded)
    } catch (err) {
      console.error('Error loading comments:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddComment = async () => {
    if (!commentText.trim()) return
    try {
      const created = await playerCommentsApi.create({
        player_id: playerId,
        comment: commentText.trim(),
      })
      // Don't add to state here - WebSocket will handle it to avoid duplicates
      // But add it optimistically if WebSocket is slow
      setComments((prev) => {
        const exists = prev.some(c => c.id === created.id)
        if (exists) return prev
        return [created, ...prev]
      })
      setCommentText('')
      setAddingComment(false)
    } catch (err) {
      console.error('Error adding comment:', err)
      alert('Failed to add comment')
    }
  }

  const handleUpdateComment = async (id) => {
    if (!commentText.trim()) return
    try {
      const updated = await playerCommentsApi.update(id, { comment: commentText.trim() })
      setComments((prev) => prev.map((c) => (c.id === id ? updated : c)))
      setEditingId(null)
      setCommentText('')
    } catch (err) {
      console.error('Error updating comment:', err)
      alert('Failed to update comment')
    }
  }

  const handleDeleteComment = async (id) => {
    if (!window.confirm('Delete this comment?')) return
    try {
      await playerCommentsApi.delete(id)
      setComments((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      console.error('Error deleting comment:', err)
      alert('Failed to delete comment')
    }
  }

  const startEditing = (comment) => {
    setEditingId(comment.id)
    setCommentText(comment.comment)
    setAddingComment(false)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setCommentText('')
    setAddingComment(false)
  }

  // Pagination
  const totalPages = Math.ceil(comments.length / commentsPerPage)
  const paginatedComments = useMemo(() => {
    const start = (currentPage - 1) * commentsPerPage
    return comments.slice(start, start + commentsPerPage)
  }, [comments, currentPage, commentsPerPage])

  if (loading) return <p>Loading comments...</p>

  return (
    <div className="player-comments">
      <div className="comments-header">
        <h4>
          <MessageSquare size={16} />
          Comments ({comments.length})
        </h4>
        {!addingComment && !editingId && (
          <button className="btn-ghost" onClick={() => setAddingComment(true)}>
            <Plus size={14} />
            Add Comment
          </button>
        )}
      </div>

      {(addingComment || editingId) && (
        <div className="comment-form" style={{ position: 'relative' }}>
          <textarea
            ref={textareaRef}
            value={commentText}
            onChange={handleCommentChange}
            placeholder="Add a comment... (use @ to mention someone)"
            rows={3}
          />
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
          <div className="comment-form-actions">
            <button
              className="btn-primary"
              onClick={() => (editingId ? handleUpdateComment(editingId) : handleAddComment())}
            >
              {editingId ? 'Update' : 'Post'}
            </button>
            <button className="btn-secondary" onClick={cancelEditing}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="comments-list">
        {comments.length === 0 ? (
          <p className="empty-state">No comments yet. Be the first to comment!</p>
        ) : (
          <>
            {paginatedComments.map((comment) => (
            <div key={comment.id} className="comment-item">
              <div className="comment-content">
                <div className="comment-header">
                  <strong>{comment.author_name || 'Unknown'}</strong>
                  <span className="comment-time">
                    {new Date(comment.created_at).toLocaleString()}
                  </span>
                </div>
                {editingId === comment.id ? (
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    rows={3}
                  />
                ) : (
                  <p>{renderCommentWithMentions(comment.comment)}</p>
                )}
              </div>
              {currentUser && (currentUser.id === comment.user_id || currentUser.role === 'admin') && (
                <div className="comment-actions">
                  {editingId === comment.id ? (
                    <>
                      <button className="btn-ghost" onClick={() => handleUpdateComment(comment.id)}>
                        <Check size={14} />
                      </button>
                      <button className="btn-ghost" onClick={cancelEditing}>
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn-ghost" onClick={() => startEditing(comment)}>
                        <Pencil size={14} />
                      </button>
                      <button
                        className="btn-ghost danger"
                        onClick={() => handleDeleteComment(comment.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            ))}
            {totalPages > 1 && (
              <div className="pagination" style={{ marginTop: '16px' }}>
                <button
                  className="btn-ghost"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>
                <span className="pagination-info">
                  Page {currentPage} of {totalPages} ({comments.length} total)
                </span>
                <button
                  className="btn-ghost"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default PlayerComments
