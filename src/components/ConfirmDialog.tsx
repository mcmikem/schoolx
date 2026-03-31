'use client'
import { useState, useEffect, ReactNode } from 'react'
import MaterialIcon from '@/components/MaterialIcon'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

export function ConfirmDialog({ 
  open, 
  title, 
  message, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel',
  onConfirm, 
  onCancel,
  danger = true 
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="confirm-dialog-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
        <div className="confirm-dialog-icon danger">
          <MaterialIcon icon="warning" />
        </div>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirm-dialog-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            {cancelText}
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

interface LoadingOverlayProps {
  open: boolean
  message?: string
}

export function LoadingOverlay({ open, message = 'Loading...' }: LoadingOverlayProps) {
  if (!open) return null

  return (
    <div className="loading-overlay">
      <div className="loading-card">
        <div className="loading-spinner"></div>
        <p>{message}</p>
      </div>
    </div>
  )
}

interface EmptyStateProps {
  icon?: string
  title: string
  message?: string
  action?: ReactNode
}

export function EmptyState({ icon = 'inbox', title, message, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <MaterialIcon icon={icon} />
      </div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  )
}

export function LoadingSkeleton({ height = '20px', width = '100%' }: { height?: string; width?: string }) {
  return <div className="loading-skeleton" style={{ height, width }} />
}