'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import MaterialIcon from '@/components/MaterialIcon'

export default function ExpiredNotice() {
  const { school, signOut } = useAuth()
  const [loading, setLoading] = useState(false)

  const handleContactSupport = () => {
    // Open email client with pre-filled subject
    window.location.href = `mailto:billing@omuto.sms?subject=Subscription Renewal: ${school?.name}`
  }

  return (
    <div className="fixed inset-0 bg-[#f8fbff] flex flex-col items-center justify-center p-6 z-[9999]">
      <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 max-w-md w-full border border-red-100/50 text-center relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-500 to-orange-400"></div>
        
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <MaterialIcon style={{ fontSize: '32px' }}>lock_clock</MaterialIcon>
        </div>
        
        <h1 className="font-sora text-2xl font-bold text-[#10233b] mb-2">
          Trial Expired
        </h1>
        
        <p className="text-[#5c6670] mb-6 leading-relaxed">
          Your 30-day free trial for <strong>{school?.name || 'your school'}</strong> has ended. To continue managing your students, academics, and finances, please upgrade your subscription.
        </p>
        
        <div className="bg-[#fcfdff] border border-[#e5e9f0] rounded-xl p-4 mb-8 text-left">
          <h3 className="text-sm font-semibold text-[#10233b] mb-3 uppercase tracking-wider">What happens next?</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <MaterialIcon className="text-[#2e7d32] mt-0.5" style={{ fontSize: '18px' }}>shield</MaterialIcon>
              <span className="text-sm text-[#5c6670]">Your data is safe and securely backed up.</span>
            </li>
            <li className="flex items-start gap-3">
              <MaterialIcon className="text-[#b45309] mt-0.5" style={{ fontSize: '18px' }}>block</MaterialIcon>
              <span className="text-sm text-[#5c6670]">Dashboard access is temporarily restricted.</span>
            </li>
          </ul>
        </div>
        
        <div className="flex flex-col gap-3">
          <button 
            onClick={handleContactSupport}
            className="w-full bg-[#10233b] hover:bg-[#1a365d] active:scale-[0.98] transition-all text-white font-medium py-3.5 px-4 rounded-xl flex items-center justify-center gap-2"
          >
            <MaterialIcon style={{ fontSize: '20px' }}>credit_card</MaterialIcon>
            Upgrade Subscription
          </button>
          
          <button 
            onClick={signOut}
            className="w-full bg-white hover:bg-gray-50 border border-[#e5e9f0] text-[#5c6670] font-medium py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <MaterialIcon style={{ fontSize: '20px' }}>logout</MaterialIcon>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
