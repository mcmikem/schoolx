'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

interface Comment {
  id: string
  category: string
  text: string
  performance: 'excellent' | 'good' | 'average' | 'weak'
}

const defaultComments: Comment[] = [
  // Excellent
  { id: '1', category: 'Academic', text: 'Excellent performance. Keep up the good work!', performance: 'excellent' },
  { id: '2', category: 'Academic', text: 'Outstanding achievement. A role model to others.', performance: 'excellent' },
  { id: '3', category: 'Academic', text: 'Exceptional understanding of all subjects.', performance: 'excellent' },
  { id: '4', category: 'Behavior', text: 'Excellent conduct and leadership qualities.', performance: 'excellent' },
  
  // Good
  { id: '5', category: 'Academic', text: 'Good progress. Continue working hard.', performance: 'good' },
  { id: '6', category: 'Academic', text: 'Satisfactory performance. Aim higher next term.', performance: 'good' },
  { id: '7', category: 'Behavior', text: 'Good behavior and participation in class.', performance: 'good' },
  { id: '8', category: 'Effort', text: 'Shows consistent effort and improvement.', performance: 'good' },
  
  // Average
  { id: '9', category: 'Academic', text: 'Average performance. More effort needed.', performance: 'average' },
  { id: '10', category: 'Academic', text: 'Can do better with more dedication.', performance: 'average' },
  { id: '11', category: 'Effort', text: 'Needs to improve concentration in class.', performance: 'average' },
  { id: '12', category: 'Behavior', text: 'Should participate more actively.', performance: 'average' },
  
  // Weak
  { id: '13', category: 'Academic', text: 'Needs significant improvement. Extra support recommended.', performance: 'weak' },
  { id: '14', category: 'Academic', text: 'Requires remedial work in most subjects.', performance: 'weak' },
  { id: '15', category: 'Effort', text: 'Must work harder and seek help when needed.', performance: 'weak' },
  { id: '16', category: 'Behavior', text: 'Needs to improve discipline and focus.', performance: 'weak' },
]

export default function CommentsPage() {
  const toast = useToast()
  const [comments, setComments] = useState<Comment[]>(defaultComments)
  const [loaded, setLoaded] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newComment, setNewComment] = useState({
    category: 'Academic',
    text: '',
    performance: 'good' as 'excellent' | 'good' | 'average' | 'weak',
  })
  const [filterPerformance, setFilterPerformance] = useState('all')

  useEffect(() => {
    const saved = localStorage.getItem('comment_bank')
    if (saved) {
      setComments(JSON.parse(saved))
    }
    setLoaded(true)
  }, [])

  const saveComments = (updated: Comment[]) => {
    setComments(updated)
    localStorage.setItem('comment_bank', JSON.stringify(updated))
  }

  const addComment = () => {
    const comment: Comment = {
      id: crypto.randomUUID(),
      ...newComment,
    }
    saveComments([...comments, comment])
    setShowAddModal(false)
    setNewComment({ category: 'Academic', text: '', performance: 'good' })
    toast.success('Comment added')
  }

  const deleteComment = (id: string) => {
    saveComments(comments.filter(c => c.id !== id))
    toast.success('Comment deleted')
  }

  const copyComment = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Comment copied')
  }

  const filteredComments = comments.filter(c => {
    if (filterPerformance === 'all') return true
    return c.performance === filterPerformance
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#002045]">Comment Bank</h1>
          <p className="text-[#5c6670] mt-1">Pre-written comments for report cards</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
          <MaterialIcon icon="add" />
          Add Comment
        </button>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <select value={filterPerformance} onChange={(e) => setFilterPerformance(e.target.value)} className="input sm:w-48">
          <option value="all">All Comments</option>
          <option value="excellent">Excellent</option>
          <option value="good">Good</option>
          <option value="average">Average</option>
          <option value="weak">Needs Improvement</option>
        </select>
      </div>

      {/* Comments List */}
      <div className="space-y-3">
        {filteredComments.map((comment) => (
          <div key={comment.id} className="bg-white rounded-2xl border border-[#e8eaed] p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#e3f2fd] text-[#1565c0]">{comment.category}</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    comment.performance === 'excellent' ? 'bg-[#e8f5e9] text-[#006e1c]' :
                    comment.performance === 'good' ? 'bg-[#e3f2fd] text-[#1565c0]' :
                    comment.performance === 'average' ? 'bg-[#fff3e0] text-[#e65100]' :
                    'bg-[#ffebee] text-[#c62828]'
                  }`}>
                    {comment.performance}
                  </span>
                </div>
                <p className="text-[#002045]">{comment.text}</p>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => copyComment(comment.text)}
                  className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                  title="Copy"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  onClick={() => deleteComment(comment.id)}
                  className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-[#002045]">Add Comment</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Category</label>
                <select 
                  value={newComment.category}
                  onChange={(e) => setNewComment({...newComment, category: e.target.value})}
                  className="input"
                >
                  <option value="Academic">Academic</option>
                  <option value="Behavior">Behavior</option>
                  <option value="Effort">Effort</option>
                </select>
              </div>
              <div>
                <label className="label">Performance Level</label>
                <select 
                  value={newComment.performance}
                  onChange={(e) => setNewComment({...newComment, performance: e.target.value as any})}
                  className="input"
                >
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="average">Average</option>
                  <option value="weak">Needs Improvement</option>
                </select>
              </div>
              <div>
                <label className="label">Comment Text</label>
                <textarea
                  value={newComment.text}
                  onChange={(e) => setNewComment({...newComment, text: e.target.value})}
                  className="input min-h-[80px]"
                  placeholder="Enter comment..."
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowAddModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={addComment} className="btn btn-primary flex-1">Add Comment</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
