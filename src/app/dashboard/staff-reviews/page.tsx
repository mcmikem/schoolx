'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { useStaffReviews } from '@/lib/hooks'
import GlassCard from '@/components/GlassCard'
import { StaffReview } from '@/types'

function MaterialIcon({ icon, className }: { icon: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className || ''}`}>{icon}</span>
}

export default function StaffReviewsPage() {
  const { school, user } = useAuth()
  const toast = useToast()
  const { reviews, loading, submitReview } = useStaffReviews(school?.id)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [selectedStaffId, setSelectedStaffId] = useState('')

  const handleReviewSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    const reviewData = {
      school_id: school!.id,
      staff_id: selectedStaffId,
      reviewer_id: user!.id,
      rating: Number(formData.get('rating')),
      strengths: formData.get('strengths') as string,
      areas_for_improvement: formData.get('areas_for_improvement') as string,
      goals: formData.get('goals') as string,
      comments: formData.get('comments') as string,
      status: 'shared' as const,
      review_date: new Date().toISOString().split('T')[0]
    }

    const result = await submitReview(reviewData)
    if (result.success) {
      toast.success('Performance review submitted and shared with staff')
      setShowReviewModal(false)
    } else {
      toast.error('Failed to submit review')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            Staff Performance
          </h1>
          <p className="text-white/60">Conduct and manage staff performance reviews</p>
        </div>
        
        <button 
          onClick={() => setShowReviewModal(true)}
          className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-purple-500/20 flex items-center gap-2"
        >
          <MaterialIcon icon="add_notes" />
          New Review
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reviews.map((review) => (
          <GlassCard key={review.id} className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
                  {review.staff?.full_name?.[0] || 'S'}
                </div>
                <div>
                  <p className="font-bold text-white">{review.staff?.full_name || 'Demo Staff'}</p>
                  <p className="text-xs text-white/40">{review.review_date}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-yellow-500">
                {[...Array(5)].map((_, i) => (
                  <MaterialIcon 
                    key={i} 
                    icon="star" 
                    className={`text-lg ${i < review.rating ? 'fill-current' : 'opacity-20'}`} 
                  />
                ))}
              </div>
            </div>

            <div className="space-y-4 flex-grow">
              <div>
                <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-1">Strengths</p>
                <p className="text-sm text-white/80 line-clamp-2">{review.strengths}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Upcoming Goals</p>
                <p className="text-sm text-white/80 line-clamp-2">{review.goals}</p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400 font-medium capitalize">
                {review.status}
              </span>
              <button className="text-sm text-white/40 hover:text-white flex items-center gap-1 transition-colors">
                View Full Details
                <MaterialIcon icon="chevron_right" className="text-sm" />
              </button>
            </div>
          </GlassCard>
        ))}
      </div>

      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <GlassCard className="w-full max-w-2xl animate-in fade-in zoom-in duration-200 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">New Performance Review</h2>
              <button onClick={() => setShowReviewModal(false)} className="text-white/40 hover:text-white">
                <MaterialIcon icon="close" />
              </button>
            </div>
            
            <form onSubmit={handleReviewSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">Select Staff Member</label>
                  <select 
                    required
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  >
                    <option value="" className="bg-slate-900">Choose staff...</option>
                    <option value="1" className="bg-slate-900">John Doe (Teacher)</option>
                    <option value="2" className="bg-slate-900">Jane Smith (Head of Dept)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">Overall Rating (1-5)</label>
                  <div className="flex items-center gap-2 h-[48px]">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          const input = document.getElementById('rating-input') as HTMLInputElement;
                          if (input) input.value = num.toString();
                          // Force re-render of stars (hacky for demo)
                        }}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <MaterialIcon icon="star" className="text-2xl text-yellow-500" />
                      </button>
                    ))}
                    <input type="hidden" name="rating" id="rating-input" defaultValue="5" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">Key Strengths</label>
                  <textarea 
                    name="strengths"
                    required
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    placeholder="What is this staff member doing exceptionally well?"
                  ></textarea>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">Areas for Improvement</label>
                  <textarea 
                    name="areas_for_improvement"
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    placeholder="Where can they grow?"
                  ></textarea>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">Development Goals</label>
                  <textarea 
                    name="goals"
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    placeholder="Objectives for the next period..."
                  ></textarea>
                </div>
              </div>
              
              <button 
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-purple-500/20 mt-4"
              >
                Submit & Share Review
              </button>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  )
}
