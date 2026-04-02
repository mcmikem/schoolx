'use client'

import { useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import MaterialIcon from '@/components/MaterialIcon'
import { cn } from '@/lib/utils'
import { Button } from './ui/index'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  loading?: boolean
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement
      document.body.style.overflow = 'hidden'
      document.addEventListener('keydown', handleKeyDown)
      
      setTimeout(() => {
        dialogRef.current?.querySelector('button')?.focus()
      }, 50)
    }

    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleKeyDown)
      previousActiveElement.current?.focus()
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  const variantStyles = {
    danger: 'text-[var(--red)] bg-[var(--red-soft)]',
    warning: 'text-[var(--amber)] bg-[var(--amber-soft)]',
    info: 'text-[var(--navy)] bg-[var(--navy-soft)]'
  }

  const iconMap = {
    danger: 'warning',
    warning: 'error',
    info: 'info'
  }

  const dialogContent = (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-description"
    >
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div 
        ref={dialogRef}
        className="relative w-full max-w-sm bg-[var(--surface)] rounded-2xl shadow-2xl border border-[var(--border)] overflow-hidden"
      >
        <div className="p-6">
          <div className={cn('flex items-center gap-4 mb-4 p-3 rounded-xl', variantStyles[variant])}>
            <MaterialIcon icon={iconMap[variant]} className="text-xl" />
            <h2 id="confirm-title" className="text-base font-semibold text-[var(--t1)]">{title}</h2>
          </div>
          <p id="confirm-description" className="text-sm text-[var(--t2)] mb-6">
            {message}
          </p>
          <div className="flex items-center justify-end gap-3">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={onClose}
              disabled={loading}
            >
              {cancelLabel}
            </Button>
            <Button 
              variant={variant === 'danger' ? 'danger' : 'primary'}
              size="sm" 
              onClick={onConfirm}
              loading={loading}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document !== 'undefined') {
    return createPortal(dialogContent, document.body)
  }

  return null
}

interface LoadingOverlayProps {
  open: boolean
  message?: string
}

export function LoadingOverlay({ open, message = 'Loading...' }: LoadingOverlayProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-[var(--surface)] rounded-2xl p-6 shadow-xl border border-[var(--border)] flex flex-col items-center gap-4 min-w-[200px]">
        <div className="w-8 h-8 border-3 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--t2)]">{message}</p>
      </div>
    </div>
  )
}

export function LoadingSkeleton({ height = '20px', width = '100%' }: { height?: string; width?: string }) {
  return <div className="animate-pulse bg-[var(--surface-container)] rounded" style={{ height, width }} />
}