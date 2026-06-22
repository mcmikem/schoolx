'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { InventoryTransaction } from '@/types'
import { getQuerySchoolId, withTimeout } from './utils'
import type { PostgrestSingleResponse } from '@supabase/supabase-js'
import { isDemoSchool } from '@/lib/demo-utils'
import { DEMO_ASSETS, DEMO_BOOKS, DEMO_BOOK_ISSUES, DEMO_BUDGETS } from '@/lib/demo-data'
import { logger } from "@/lib/logger";

export function useAssets(schoolId?: string) {
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const fetchAssets = useCallback(async () => {
    if (!schoolId) { setLoading(false); return }
    if (isDemo || isDemoSchool(schoolId)) {
      setAssets(DEMO_ASSETS as unknown as any[])
      setLoading(false)
      return
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    try {
      setLoading(true)
      const { data, error } = await supabase.from('assets').select('*').eq('school_id', querySchoolId).order('name')
      if (error) throw error
      setAssets(data || [])
    } catch (err) { logger.warn('Assets fetch error:', err) }
    finally { setLoading(false) }
  }, [schoolId, isDemo])

  useEffect(() => { fetchAssets() }, [fetchAssets])

  const createAsset = async (asset: any) => {
    if (isDemo || isDemoSchool(schoolId)) {
      const newAsset = { ...asset, id: `demo-asset-${Date.now()}`, school_id: schoolId || '00000000-0000-0000-0000-000000000001', created_at: new Date().toISOString() }
      setAssets(prev => [newAsset, ...prev])
      return newAsset
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    try {
      const { data, error } = await withTimeout(supabase.from('assets').insert({ ...asset, school_id: querySchoolId }).select().single(), 15000, { data: null, error: { message: "Asset creation timed out", name: "TimeoutError", details: "", hint: "", code: "" } } as unknown as PostgrestSingleResponse<never>)
      if (error) throw error
      setAssets(prev => [data, ...prev])
      return data
    } catch (err: any) { throw new Error(err.message) }
  }

  const updateAsset = async (id: string, updates: any) => {
    if (isDemo || isDemoSchool(schoolId)) {
      setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a))
      return { id, ...updates }
    }
    try {
      const { data, error } = await withTimeout(supabase.from('assets').update(updates).eq('id', id).select().single(), 15000, { data: null, error: { message: "Asset update timed out", name: "TimeoutError", details: "", hint: "", code: "" } } as unknown as PostgrestSingleResponse<never>)
      if (error) throw error
      setAssets(prev => prev.map(a => a.id === id ? data : a))
      return data
    } catch (err: any) { throw new Error(err.message) }
  }

  const deleteAsset = async (id: string) => {
    if (isDemo || isDemoSchool(schoolId)) {
      setAssets(prev => prev.filter(a => a.id !== id))
      return
    }
    try {
      const { error } = await withTimeout(supabase.from('assets').delete().eq('id', id), 15000, { error: { message: "Asset deletion timed out", name: "TimeoutError", details: "", hint: "", code: "" } } as unknown as PostgrestSingleResponse<never>)
      if (error) throw error
      setAssets(prev => prev.filter(a => a.id !== id))
    } catch (err: any) { throw new Error(err.message) }
  }

  return { assets, loading, createAsset, updateAsset, deleteAsset, refetch: fetchAssets }
}

export function useInventory(schoolId?: string) {
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const fetchTransactions = useCallback(async () => {
    if (!schoolId) {
      setLoading(false)
      return
    }

    const querySchoolId = getQuerySchoolId(schoolId, isDemo)

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('inventory_transactions')
        .select(`
          *,
          asset:assets(id, name, type, current_stock)
        `)
        .eq('school_id', querySchoolId)
        .order('transaction_date', { ascending: false })

      if (error) throw error
      setTransactions(data || [])
    } catch (err) {
      logger.error('Error fetching inventory transactions:', err)
    } finally {
      setLoading(false)
    }
  }, [schoolId, isDemo])

  const recordTransaction = async (transaction: Omit<InventoryTransaction, 'id' | 'created_at'>) => {
    if (isDemo || isDemoSchool(schoolId)) {
      const newTrans = { ...transaction, id: `demo-inv-${Date.now()}`, school_id: schoolId || '00000000-0000-0000-0000-000000000001', created_at: new Date().toISOString() }
      return { success: true, data: newTrans }
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)

    try {
      const { data, error } = await withTimeout(supabase
        .from('inventory_transactions')
        .insert([{ ...transaction, school_id: querySchoolId }])
        .select(`
          id,
          asset_id,
          quantity,
          transaction_type,
          transaction_date,
          recorded_by,
          created_at
        `)
        .single(), 15000, { data: null, error: { message: "Transaction creation timed out", name: "TimeoutError", details: "", hint: "", code: "" } } as unknown as PostgrestSingleResponse<never>)
      if (error) throw error

      const stockChange = transaction.transaction_type === 'in' || transaction.transaction_type === 'return' 
        ? transaction.quantity 
        : -transaction.quantity
      
      const { error: updateError } = await supabase.rpc('update_asset_stock', {
        p_asset_id: transaction.asset_id,
        p_change: stockChange
      })
      if (updateError) throw updateError

      return { success: true, data }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  return { transactions, loading, recordTransaction, refetch: fetchTransactions }
}
