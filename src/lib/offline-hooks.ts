'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './supabase'
import { offlineDB, useOnlineStatus } from './offline'
import { withTimeout, timeoutFallback } from '@/lib/hooks/utils'
import type { Student, Attendance, Grade, FeePayment, FeeStructure } from '@/types'
import { logger } from './logger'

interface OfflineHookOptions {
  skipCache?: boolean
}

export function useOfflineData<T>(
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
  const skipCache = options?.skipCache ?? false
  const serializedFilters = JSON.stringify(filters ?? {})
  const stableFilters = useMemo(
    () => (serializedFilters ? JSON.parse(serializedFilters) as Record<string, unknown> : {}),
    [serializedFilters]
  )
  const fetcherRef = useRef(fetcher)

  useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const cached = await offlineDB.getAllFromCache(cacheKey, stableFilters)
      if (cached.length > 0) {
        setData(cached as T[])
        setIsFromCache(true)
        setLoading(false)

        if (isOnline && !skipCache) {
          void (async () => {
            try {
              const result = await withTimeout(fetcherRef.current(), 30000, [] as T[])
              setData(result)
              setIsFromCache(false)
              await offlineDB.cacheFromServer(cacheKey, result as Record<string, unknown>[]) 
            } catch (e: unknown) {
              const msg = e instanceof Error
                ? e.message
                : typeof e === 'object' && e !== null
                  ? JSON.stringify(e)
                  : 'Unknown error'
              logger.error(`Error refreshing ${table} from server:`, msg)
            }
          })()
        }

        return
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to read cache'
      logger.error(`Error reading ${table} cache:`, msg)
    }

    if (isOnline && !skipCache) {
      try {
        const result = await withTimeout(fetcherRef.current(), 30000, [] as T[])
        setData(result)
        setIsFromCache(false)
        await offlineDB.cacheFromServer(cacheKey, result as Record<string, unknown>[])
        setLoading(false)
        return
      } catch (e: unknown) {
        const msg = e instanceof Error
          ? e.message
          : typeof e === 'object' && e !== null
            ? JSON.stringify(e)
            : 'Unknown error'
        logger.error(`Error fetching ${table} from server:`, msg)
      }
    }

    try {
      const cached = await offlineDB.getAllFromCache(cacheKey, stableFilters)
      setData(cached as T[])
      setIsFromCache(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to read cache'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [isOnline, table, cacheKey, skipCache, stableFilters])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, isFromCache, refetch: fetchData }
}

export function useOfflineAcademicTerms(schoolId?: string, options?: OfflineHookOptions) {
  return useOfflineData<any>(
    'academic_terms',
    async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('academic_terms')
        .select('*')
        .eq('school_id', schoolId)
        .order('academic_year', { ascending: false })
        .order('term_number');
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    'academic_terms',
    schoolId ? { school_id: schoolId } : undefined,
    options
  );
}

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

export function useOfflineFees(schoolId?: string, options?: OfflineHookOptions & { limit?: number; offset?: number }) {
  const [data, setData] = useState<(FeePayment & { fee_structure?: FeeStructure })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFromCache, setIsFromCache] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const isOnline = useOnlineStatus()

  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  const fetchData = useCallback(async () => {
    if (!schoolId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    try {
      const cached = await offlineDB.getAllFromCache('fee_payments', { school_id: schoolId })
      if (cached.length > 0) {
        setData(cached as unknown as (FeePayment & { fee_structure?: FeeStructure })[])
        setTotalCount(cached.length)
        setIsFromCache(true)
        setLoading(false)

        if (isOnline && !options?.skipCache) {
          void (async () => {
            try {
              const payResult = await withTimeout(supabase
                .from('fee_payments')
                .select('*, students!inner (id, first_name, last_name, school_id, classes (name))', { count: 'exact' })
                .eq('students.school_id', schoolId)
                .order('payment_date', { ascending: false })
                .range(offset, offset + limit - 1), 30000, timeoutFallback())
              if (payResult.error) throw payResult.error
              const result = (payResult.data as (FeePayment & { fee_structure?: FeeStructure })[]) || []
              setData(result)
              if (payResult.count !== null) setTotalCount(payResult.count)
              setIsFromCache(false)
              await offlineDB.cacheFromServer('fee_payments', result as unknown as Record<string, unknown>[])
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : 'Unknown error'
              logger.error('Error refreshing fee_payments from server:', msg)
            }
          })()
        }

        return
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to read cache'
      logger.error('Error reading fee_payments cache:', msg)
    }

    if (isOnline && !options?.skipCache) {
      try {
        const payResult = await withTimeout(supabase
          .from('fee_payments')
          .select('*, students!inner (id, first_name, last_name, school_id, classes (name))', { count: 'exact' })
          .eq('students.school_id', schoolId)
          .order('payment_date', { ascending: false })
          .range(offset, offset + limit - 1), 30000, timeoutFallback())
        if (payResult.error) throw payResult.error
        const result = (payResult.data as (FeePayment & { fee_structure?: FeeStructure })[]) || []
        setData(result)
        if (payResult.count !== null) setTotalCount(payResult.count)
        setIsFromCache(false)
        await offlineDB.cacheFromServer('fee_payments', result as unknown as Record<string, unknown>[])
        setLoading(false)
        return
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        logger.error('Error fetching fee_payments from server:', msg)
      }
    }

    try {
      const cached = await offlineDB.getAllFromCache('fee_payments', { school_id: schoolId })
      setData(cached as unknown as (FeePayment & { fee_structure?: FeeStructure })[])
      setTotalCount(cached.length)
      setIsFromCache(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to read cache'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [isOnline, schoolId, options?.skipCache, limit, offset])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, isFromCache, totalCount, refetch: fetchData }
}

export function useOfflineHealthRecords(schoolId?: string, options?: OfflineHookOptions) {
  return useOfflineData<any>(
    'health_records',
    async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('health_records')
        .select('*')
        .eq('school_id', schoolId)
        .order('admitted_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    'health_records',
    schoolId ? { school_id: schoolId } : undefined,
    options
  );
}

export function useOfflineCanteenItems(schoolId?: string, options?: OfflineHookOptions) {
  return useOfflineData<any>(
    'canteen_items',
    async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('canteen_items')
        .select('*')
        .eq('school_id', schoolId)
        .order('category', { ascending: true });
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    'canteen_items',
    schoolId ? { school_id: schoolId } : undefined,
    options
  );
}

export function useOfflineCanteenOrders(schoolId?: string, options?: OfflineHookOptions) {
  return useOfflineData<any>(
    'canteen_orders',
    async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('canteen_orders')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    'canteen_orders',
    schoolId ? { school_id: schoolId } : undefined,
    options
  );
}

export function useOfflineHomework(schoolId?: string, academicYear?: string, term?: string, classId?: string, options?: OfflineHookOptions) {
  return useOfflineData<any>(
    'homework',
    async () => {
      if (!schoolId || !academicYear || !term) return [];
      let query = supabase
        .from('homework')
        .select('*, subjects(name), classes(name), users(full_name)')
        .eq('school_id', schoolId)
        .eq('academic_year', academicYear)
        .eq('term', term)
        .order('due_date', { ascending: false });
      if (classId) query = query.eq('class_id', classId);
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    'homework',
    schoolId && academicYear && term ? (classId ? { school_id: schoolId, academic_year: academicYear, term, class_id: classId } : { school_id: schoolId, academic_year: academicYear, term }) : undefined,
    options
  );
}

export function useOfflineHomeworkSubmissions(homeworkId?: string, schoolId?: string, classId?: string, options?: OfflineHookOptions) {
  return useOfflineData<any>(
    'homework_submissions',
    async () => {
      if (!homeworkId) return [];
      const { data, error } = await supabase
        .from('homework_submissions')
        .select('*, students(first_name, last_name, classes(name))')
        .eq('homework_id', homeworkId);
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    'homework_submissions',
    homeworkId ? { homework_id: homeworkId } : undefined,
    options
  );
}

export function useOfflineClasses(schoolId?: string, options?: OfflineHookOptions) {
  return useOfflineData<any>(
    'classes',
    async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', schoolId)
        .order('name');
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    'classes',
    schoolId ? { school_id: schoolId } : undefined,
    options
  );
}

export function useOfflineClassStudentsFull(schoolId?: string, classId?: string, options?: OfflineHookOptions) {
  return useOfflineData<any>(
    'students',
    async () => {
      if (!schoolId || !classId) return [];
      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, classes(name)')
        .eq('school_id', schoolId)
        .eq('class_id', classId);
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    'students',
    schoolId && classId ? { school_id: schoolId, class_id: classId } : undefined,
    options
  );
}

export function useOfflineStudentsBasic(schoolId?: string, status?: string, options?: OfflineHookOptions) {
  return useOfflineData<any>(
    'students',
    async () => {
      if (!schoolId) return [];
      let query = supabase
        .from('students')
        .select('id, class_id, first_name, last_name, admission_number, status')
        .eq('school_id', schoolId);
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    'students',
    schoolId ? (status ? { school_id: schoolId, status } : { school_id: schoolId }) : undefined,
    options
  );
}

export function useOfflineFeeStructure(schoolId?: string, term?: number, options?: OfflineHookOptions) {
  return useOfflineData<any>(
    'fee_structure',
    async () => {
      if (!schoolId || !term) return [];
      const { data, error } = await supabase
        .from('fee_structure')
        .select('*')
        .eq('school_id', schoolId)
        .eq('term', term);
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    'fee_structure',
    schoolId && term ? { school_id: schoolId, term } : undefined,
    options
  );
}

export function useOfflineLeaveRequests(schoolId?: string, staffId?: string, isManager?: boolean, options?: OfflineHookOptions) {
  return useOfflineData<any>(
    'leave_requests',
    async () => {
      if (!schoolId) return [];
      let query = supabase
        .from('leave_requests')
        .select('*, users:staff_id(full_name)')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });
      if (!isManager && staffId) {
        query = query.eq('staff_id', staffId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    'leave_requests',
    schoolId ? (isManager ? { school_id: schoolId } : { school_id: schoolId, staff_id: staffId }) : undefined,
    options
  );
}

export function useOfflinePromotionHistory(schoolId?: string, options?: OfflineHookOptions) {
  return useOfflineData<any>(
    'promotion_history',
    async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('promotion_history')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    'promotion_history',
    schoolId ? { school_id: schoolId } : undefined,
    options
  );
}

export function useOfflineClassStudents(schoolId?: string, classId?: string, options?: OfflineHookOptions) {
  return useOfflineData<any>(
    'students',
    async () => {
      if (!schoolId || !classId) return [];
      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, admission_number')
        .eq('school_id', schoolId)
        .eq('class_id', classId)
        .order('first_name');
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    'students',
    schoolId && classId ? { school_id: schoolId, class_id: classId } : undefined,
    options
  );
}

export function useOfflineEvents(schoolId?: string, options?: OfflineHookOptions) {
  return useOfflineData<any>(
    'events',
    async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('events')
        .select('id, title, description, event_type, start_date, end_date')
        .eq('school_id', schoolId)
        .order('start_date');
      if (error) throw error;
      return (data as unknown[]) || [];
    },
    'events',
    schoolId ? { school_id: schoolId } : undefined,
    options
  );
}
