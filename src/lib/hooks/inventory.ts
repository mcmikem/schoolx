'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { InventoryTransaction } from '@/types'
import { getQuerySchoolId, withTimeout } from './utils'

export function useAssets(schoolId?: string) {
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const fetchAssets = useCallback(async () => {
    if (!schoolId) { setLoading(false); return }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    try {
      setLoading(true)
      const { data, error } = await supabase.from('assets').select('*').eq('school_id', querySchoolId).order('name')
      if (error) throw error
      setAssets(data || [])
    } catch (err) { console.warn('Assets fetch error:', err) }
    finally { setLoading(false) }
  }, [schoolId, isDemo])

  useEffect(() => { fetchAssets() }, [fetchAssets])

  const createAsset = async (asset: any) => {
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    try {
      const { data, error } = await supabase.from('assets').insert({ ...asset, school_id: querySchoolId }).select().single()
      if (error) throw error
      setAssets(prev => [data, ...prev])
      return data
    } catch (err: any) { throw new Error(err.message) }
  }

  const updateAsset = async (id: string, updates: any) => {
    try {
      const { data, error } = await supabase.from('assets').update(updates).eq('id', id).select().single()
      if (error) throw error
      setAssets(prev => prev.map(a => a.id === id ? data : a))
      return data
    } catch (err: any) { throw new Error(err.message) }
  }

  const deleteAsset = async (id: string) => {
    try {
      const { error } = await supabase.from('assets').delete().eq('id', id)
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

  const recordTransaction = async (transaction: Omit<InventoryTransaction, 'id' | 'created_at'>) => {
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)

    try {
      const { data, error } = await supabase
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
        .single()
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
    async function fetchTransactions() {
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
        console.error('Error fetching inventory transactions:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()
  }, [schoolId, isDemo])

  return { transactions, loading, recordTransaction }
}
