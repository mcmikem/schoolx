'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { offlineDB, useOnlineStatus } from './offline'
import type { Student, Attendance, Grade, FeePayment, FeeStructure } from '@/types'

interface OfflineHookOptions {
  skipCache?: boolean
}

// Generic offline-aware hook builder
function useOfflineData<T>(
  table: string,
  fetcher: () => Promise<T[]>,
  cacheKey: string,
  filters?: Record<string, unknown>,
  options?: OfflineHookOptions
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFromCache, setIsFromCache] = useState(false)
  const isOnline = useOnlineStatus()

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    if (isOnline && !options?.skipCache) {
      try {
        const result = await fetcher()
        setData(result)
        setIsFromCache(false)
        await offlineDB.cacheFromServer(cacheKey, result as Record<string, unknown>[])
        setLoading(false)
        return
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        console.error(`Error fetching ${table} from server:`, msg)
        // Fall through to cache
      }
    }

    // Offline or server fetch failed: try cache
    try {
      const cached = await offlineDB.getAllFromCache(cacheKey, filters)
      setData(cached as T[])
      setIsFromCache(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to read cache'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [isOnline, table, cacheKey, JSON.stringify(filters), options?.skipCache])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, isFromCache, refetch: fetchData }
}

// Students hook - offline aware
export function useOfflineStudents(schoolId?: string, options?: OfflineHookOptions) {
  return useOfflineData<Student>(
    'students',
    async () => {
      if (!schoolId) return []
      const { data, error } = await supabase
        .from('students')
        .select('*, classes (id, name, level)')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data as Student[]) || []
    },
    'students',
    schoolId ? { school_id: schoolId } : undefined,
    options
  )
}

// Attendance hook - offline aware
export function useOfflineAttendance(schoolId?: string, date?: string, options?: OfflineHookOptions) {
  return useOfflineData<Attendance>(
    'attendance',
    async () => {
      if (!schoolId || !date) return []
      const { data, error } = await supabase
        .from('attendance')
        .select('*, students!inner (school_id)')
        .eq('students.school_id', schoolId)
        .eq('date', date)

      if (error) throw error
      return (data as Attendance[]) || []
    },
    'attendance',
    date ? { date } : undefined,
    options
  )
}

// Grades hook - offline aware
export function useOfflineGrades(schoolId?: string, options?: OfflineHookOptions) {
  return useOfflineData<Grade>(
    'grades',
    async () => {
      if (!schoolId) return []
      const { data, error } = await supabase
        .from('grades')
        .select('*, students!inner (id, first_name, last_name, school_id), subjects (id, name, code)')
        .eq('students.school_id', schoolId)

      if (error) throw error
      return (data as Grade[]) || []
    },
    'grades',
    undefined,
    options
  )
}

// Fees hook - offline aware
export function useOfflineFees(schoolId?: string, options?: OfflineHookOptions) {
  const [data, setData] = useState<(FeePayment & { fee_structure?: FeeStructure })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFromCache, setIsFromCache] = useState(false)
  const isOnline = useOnlineStatus()

  const fetchData = useCallback(async () => {
    if (!schoolId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    if (isOnline && !options?.skipCache) {
      try {
        const { data: payments, error: payErr } = await supabase
          .from('fee_payments')
          .select('*, students!inner (id, first_name, last_name, school_id, classes (name))')
          .eq('students.school_id', schoolId)
          .order('payment_date', { ascending: false })

        if (payErr) throw payErr
        const result = (payments as (FeePayment & { fee_structure?: FeeStructure })[]) || []
        setData(result)
        setIsFromCache(false)
        await offlineDB.cacheFromServer('fee_payments', result as unknown as Record<string, unknown>[])
        setLoading(false)
        return
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        console.error('Error fetching fee_payments from server:', msg)
      }
    }

    try {
      const cached = await offlineDB.getAllFromCache('fee_payments', { school_id: schoolId })
      setData(cached as unknown as (FeePayment & { fee_structure?: FeeStructure })[])
      setIsFromCache(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to read cache'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [isOnline, schoolId, options?.skipCache])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, isFromCache, refetch: fetchData }
}
