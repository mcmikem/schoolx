'use client'
import { useState, useEffect, useCallback } from 'react'

interface UseAutoSaveOptions {
  key: string
  debounceMs?: number
  onRestore?: (data: any) => void
}

export function useAutoSave<T extends Record<string, any>>(
  initialData: T,
  options: UseAutoSaveOptions
) {
  const { key, debounceMs = 2000, onRestore } = options
  const [data, setData] = useState<T>(initialData)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  const storageKey = `autosave_${key}`

  // Load saved data on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        setData(parsed)
        setLastSaved(new Date(parsed.savedAt))
        if (onRestore) {
          onRestore(parsed.data)
        }
      }
    } catch (e) {
      console.error('Failed to load auto-save:', e)
    }
  }, [storageKey, onRestore])

  // Update data and mark as dirty
  const updateData = useCallback((updates: Partial<T> | ((prev: T) => Partial<T>)) => {
    setIsDirty(true)
    setData(prev => {
      const newUpdates = typeof updates === 'function' ? updates(prev) : updates
      return { ...prev, ...newUpdates }
    })
  }, [])

  // Save to localStorage (debounced)
  useEffect(() => {
    if (!isDirty) return

    const timer = setTimeout(() => {
      try {
        const toSave = {
          data,
          savedAt: new Date().toISOString(),
        }
        localStorage.setItem(storageKey, JSON.stringify(toSave))
        setLastSaved(new Date())
        setIsDirty(false)
      } catch (e) {
        console.error('Failed to auto-save:', e)
      }
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [data, isDirty, debounceMs, storageKey])

  // Clear saved data
  const clearSaved = useCallback(() => {
    try {
      localStorage.removeItem(storageKey)
      setLastSaved(null)
    } catch (e) {
      console.error('Failed to clear auto-save:', e)
    }
  }, [storageKey])

  // Reset to initial
  const reset = useCallback((newInitial?: T) => {
    setData(newInitial || initialData)
    clearSaved()
  }, [initialData, clearSaved])

  return {
    data,
    updateData,
    setData,
    lastSaved,
    isDirty,
    clearSaved,
    reset,
  }
}

// Hook for forms that need draft management
export function useFormDraft(formKey: string) {
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)
  const [savedDraft, setSavedDraft] = useState<any>(null)

  const { data, updateData, setData, lastSaved, isDirty, clearSaved, reset } = useAutoSave(
    {},
    {
      key: formKey,
      debounceMs: 3000,
      onRestore: (restoredData) => {
        setSavedDraft(restoredData)
        setShowRestoreDialog(true)
      },
    }
  )

  const restoreDraft = useCallback(() => {
    if (savedDraft) {
      setData(savedDraft)
      setShowRestoreDialog(false)
    }
  }, [savedDraft, setData])

  const discardDraft = useCallback(() => {
    clearSaved()
    setSavedDraft(null)
    setShowRestoreDialog(false)
  }, [clearSaved])

  return {
    data,
    updateData,
    setData,
    lastSaved,
    isDirty,
    clearSaved,
    reset,
    showRestoreDialog,
    savedDraft,
    restoreDraft,
    discardDraft,
  }
}

export function AutoSaveIndicator({ lastSaved, isDirty }: { lastSaved: Date | null; isDirty: boolean }) {
  if (isDirty) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        Unsaved changes
      </span>
    )
  }
  if (lastSaved) {
    const time = lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-700">
        <span className="material-symbols-outlined text-[12px]">check_circle</span>
        Draft saved at {time}
      </span>
    )
  }
  return null
}