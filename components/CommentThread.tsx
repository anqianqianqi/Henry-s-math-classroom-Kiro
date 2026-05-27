'use client'

import { useState } from 'react'

interface Comment {
  id: string
  submission_id: string
  user_id: string
  content: string
  image_url?: string | null
  created_at: string
  profiles: {
    full_name: string
    nickname: string | null
  }
}

interface CommentThreadProps {
  submissionId: string
  comments: Comment[]
  visibleCount: number
  onShowMore: () => void
  newComment: string
  onCommentChange: (value: string) => void
  onSubmitComment: (imageFile?: File | null) => void
  onEditComment?: (commentId: string, newContent: string) => Promise<void>
  onDeleteComment?: (commentId: string) => Promise<void>
  isSubmitting: boolean
  formatTimeAgo: (date: string) => string
  currentUserId?: string | null
  showTitle?: boolean
  allowImage?: boolean
}

const COMMENTS_INCREMENT = 5

export function CommentThread({
  submissionId,
  comments,
  visibleCount,
  onShowMore,
  newComment,
  onCommentChange,
  onSubmitComment,
  onEditComment,
  onDeleteComment,
  isSubmitting,
  formatTimeAgo,
  currentUserId,
  showTitle = false,
  allowImage = false
}: CommentThreadProps) {
  const [commentImage, setCommentImage] = useState<File | null>(null)
  const [commentImagePreview, setCommentImagePreview] = useState<string | null>(null)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)

  const visibleComments = comments.slice(-visibleCount)
  const showingAll = visibleCount >= comments.length

  async function handleSaveEdit(commentId: string) {
    if (!onEditComment || !editDraft.trim()) return
    setSavingEdit(true)
    await onEditComment(commentId, editDraft.trim())
    setSavingEdit(false)
    setEditingCommentId(null)
  }

  async function handleDelete(commentId: string) {
    if (!onDeleteComment) return
    setDeletingCommentId(commentId)
    await onDeleteComment(commentId)
    setDeletingCommentId(null)
  }

  return (
    <>
      {/* Comments Section */}
      {comments.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
          {showTitle && (
            <p className="text-sm font-medium text-gray-700 mb-2">💬 Feedback</p>
          )}
          
          {/* Show More/Less Button */}
          {comments.length > COMMENTS_INCREMENT && (
            <button
              onClick={onShowMore}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium mb-2"
            >
              {showingAll
                ? '▲ Show less'
                : `▼ Show ${Math.min(COMMENTS_INCREMENT, comments.length - visibleCount)} older comment${
                    Math.min(COMMENTS_INCREMENT, comments.length - visibleCount) !== 1 ? 's' : ''
                  }`
              }
            </button>
          )}
          
          {/* Comment List */}
          {visibleComments.map(comment => (
            <div key={comment.id} className="flex items-start gap-2 text-sm bg-gray-50 p-3 rounded-xl">
              <span className="text-lg">💬</span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900">
                    {comment.profiles.nickname || comment.profiles.full_name}
                    <span className="font-normal text-gray-500 ml-2">
                      {formatTimeAgo(comment.created_at)}
                    </span>
                  </p>
                  {/* Edit/Delete buttons — only for comment author */}
                  {currentUserId && comment.user_id === currentUserId && editingCommentId !== comment.id && (
                    <div className="flex items-center gap-2 ml-2">
                      {onEditComment && (
                        <button
                          onClick={() => { setEditingCommentId(comment.id); setEditDraft(comment.content) }}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Edit
                        </button>
                      )}
                      {onDeleteComment && (
                        <button
                          onClick={() => handleDelete(comment.id)}
                          disabled={deletingCommentId === comment.id}
                          className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                        >
                          {deletingCommentId === comment.id ? '...' : 'Delete'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {editingCommentId === comment.id ? (
                  <div className="mt-1 space-y-1">
                    <textarea
                      value={editDraft}
                      onChange={e => {
                        setEditDraft(e.target.value)
                        e.target.style.height = 'auto'
                        e.target.style.height = e.target.scrollHeight + 'px'
                      }}
                      rows={1}
                      className="w-full px-2 py-1 text-sm border-2 border-primary-300 rounded-lg focus:border-primary-500 resize-none overflow-hidden"
                      style={{ minHeight: '32px' }}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEdit(comment.id)}
                        disabled={savingEdit || !editDraft.trim()}
                        className="text-xs px-2 py-1 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
                      >
                        {savingEdit ? '...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingCommentId(null)}
                        className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-700 break-words whitespace-pre-wrap">{comment.content}</p>
                )}

                {comment.image_url && (
                  <img src={comment.image_url} alt="Comment image" className="mt-2 max-h-40 rounded-lg border" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Comment Input */}
      <div className="mt-3 space-y-2">
        {commentImagePreview && (
          <div className="relative inline-block">
            <img src={commentImagePreview} alt="Preview" className="max-h-24 rounded-lg border" />
            <button
              type="button"
              onClick={() => { setCommentImage(null); setCommentImagePreview(null) }}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
            >✕</button>
          </div>
        )}
        <div className="flex gap-2">
          {allowImage && (
            <label className="px-2 py-2 text-gray-500 hover:text-gray-700 cursor-pointer">
              📷
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null
                  setCommentImage(file)
                  setCommentImagePreview(file ? URL.createObjectURL(file) : null)
                }}
              />
            </label>
          )}
          <textarea
            value={newComment}
            onChange={(e) => {
              onCommentChange(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSubmitComment(commentImage)
                setCommentImage(null)
                setCommentImagePreview(null)
                ;(e.target as HTMLTextAreaElement).style.height = 'auto'
              }
            }}
            placeholder="Add a comment..."
            rows={1}
            className="flex-1 px-3 py-2 text-sm border-2 border-gray-200 rounded-xl 
                     focus:border-primary-500 focus:ring-2 focus:ring-primary-100
                     transition-all resize-none"
            style={{ minHeight: '38px', overflowY: 'hidden' }}
          />
          <button
            onClick={() => {
              onSubmitComment(commentImage)
              setCommentImage(null)
              setCommentImagePreview(null)
            }}
            disabled={(!newComment.trim() && !commentImage) || isSubmitting}
            className="px-4 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {isSubmitting ? '⏳' : '💬'}
          </button>
        </div>
      </div>
    </>
  )
}
