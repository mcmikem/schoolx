'use client'
import React from 'react'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  hoverable?: boolean
}

export default function GlassCard({ children, className = '', hoverable = true }: GlassCardProps) {
  return (
    <div 
      className={`
        glass-card rounded-2xl p-6
        ${hoverable ? 'hover:shadow-2xl hover:shadow-purple-500/10 hover:-translate-y-1 transition-smooth cursor-default' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
