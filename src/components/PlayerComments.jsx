import { useState, useEffect } from 'react'
import { MessageSquare, Plus, X, Pencil, Trash2, Check } from 'lucide-react'
import { playerCommentsApi } from '../utils/api'
import { authApi } from '../utils/api'

function PlayerComments({ playerId }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [addingComment, setAddingComment] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    loadComments()
    loadCurrentUser()
  }, [playerId])

  const loadCurrentUser = async () => {
    try {
      const user = await authApi.me()
      setCurrentUser(user)
    } catch (err) {
      console.error('Error loading current user:', err)
    }
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
      setComments((prev) => [created, ...prev])
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
        <div className="comment-form">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
            rows={3}
          />
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
          comments.map((comment) => (
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
                  <p>{comment.comment}</p>
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
          ))
        )}
      </div>
    </div>
  )
}

export default PlayerComments
