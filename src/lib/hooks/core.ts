'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export function useSupabaseQuery<T>(
  table: string,
  options?: {
    select?: string
    filters?: Record<string, string | number | boolean | null>
    orderBy?: { column: string; ascending?: boolean }
    limit?: number
  }
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const select = options?.select || '*'
  const filters = options?.filters
  const orderBy = options?.orderBy
  const limit = options?.limit

  const filtersRef = useRef(filters)
  const prevFiltersRef = useRef<string>('')

  useEffect(() => {
    const currentFiltersStr = JSON.stringify(filters ?? {})
    if (currentFiltersStr !== prevFiltersRef.current) {
      filtersRef.current = filters
      prevFiltersRef.current = currentFiltersStr
    }
  }, [filters])

  const fetchData = useCallback(async () => {
    if (!supabase) return
    
    try {
      setLoading(true)
      setError(null)

      let query = supabase.from(table).select(select)

      if (filtersRef.current) {
        Object.entries(filtersRef.current).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            query = query.eq(key, value)
          }
        })
      }

      if (orderBy) {
        query = query.order(orderBy.column, {
          ascending: orderBy.ascending ?? false,
        })
      }

      if (limit) {
        query = query.limit(limit)
      }

      const { data: result, error: fetchError } = await query

      if (fetchError) throw fetchError
      setData((result as T[]) || [])
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [table, select, orderBy, limit])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

export function useSupabaseMutation<T>(table: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const insert = async (data: Partial<T>) => {
    try {
      setLoading(true)
      setError(null)
      const { data: result, error: insertError } = await supabase!
        .from(table)
        .insert(data)
        .select()
        .single()

      if (insertError) throw insertError
      return result as T
    } catch (err: any) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  const update = async (id: string, data: Partial<T>) => {
    try {
      setLoading(true)
      setError(null)
      const { data: result, error: updateError } = await supabase!
        .from(table)
        .update(data)
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError
      return result as T
    } catch (err: any) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  const remove = async (id: string) => {
    try {
      setLoading(true)
      setError(null)
      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      return true
    } catch (err: any) {
      setError(err.message)
      return false
    } finally {
      setLoading(false)
    }
  }

  return { insert, update, remove, loading, error }
}
