'use client'
import { useState, useEffect } from 'react'
import MaterialIcon from '@/components/MaterialIcon'

const WHATSAPP_NUMBER = '25670028703'

export default function WhatsAppSupport() {
  const [show, setShow] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat window */}
      {show && (
        <div className="absolute bottom-16 right-0 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="bg-[#25D366] px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <MaterialIcon className="text-white text-sm">support_agent</MaterialIcon>
            </div>
            <div>
              <div className="text-white font-semibold text-sm">ASSEMBLE Support</div>
              <div className="text-white/80 text-xs">Powered by Omuto Foundation</div>
            </div>
            <button onClick={() => setShow(false)} className="ml-auto text-white/80 hover:text-white">
              <MaterialIcon className="text-lg">close</MaterialIcon>
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div className="bg-gray-100 rounded-xl rounded-tl-none p-3 text-sm text-gray-800">
              Hi! How can we help you today?
            </div>
            <div className="space-y-2">
              <a 
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=Hi, I need help with Omuto.`}
                className="block w-full py-3 px-4 bg-[#25D366] text-white text-center rounded-xl font-medium text-sm hover:bg-[#20BD5A] transition-colors"
              >
                Chat on WhatsApp
              </a>
              <a 
                href="mailto:support@omuto.com?subject=Omuto Support Request"
                className="block w-full py-3 px-4 bg-gray-100 text-gray-700 text-center rounded-xl font-medium text-sm hover:bg-gray-200 transition-colors"
              >
                Email Support
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setShow(!show)}
        className="w-14 h-14 bg-[#25D366] rounded-full shadow-lg flex items-center justify-center hover:bg-[#20BD5A] transition-all hover:scale-110 active:scale-95"
        aria-label="Get support on WhatsApp"
      >
        {show ? (
          <MaterialIcon className="text-white text-2xl">close</MaterialIcon>
        ) : (
          <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.195.194 1.382.121.273-.109.87-.415 1.04-.82.173-.405.173-.75.124-.85-.049-.148-.297-.348-.446-.521-.149-.174-.298-.298-.446-.298-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.625.712.227 1.195.194 1.382.121.273-.109.87-.415 1.04-.82.173-.405.173-.75.124-.85-.049-.148-.297-.348-.446-.521-.149-.174-.298-.298-.446-.298-.198 0-.52.074-.792.372z"/>
          </svg>
        )}
      </button>
    </div>
  )
}