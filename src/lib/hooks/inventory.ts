'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { InventoryTransaction } from '@/types'
import { getQuerySchoolId, withTimeout } from './utils'
import { isDemoSchool } from '@/lib/demo-utils'

export function useAssets(schoolId?: string) {
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const fetchAssets = useCallback(async () => {
    if (!schoolId) { setLoading(false); return }
    if (isDemo || isDemoSchool(schoolId)) {
      setAssets([
        { id: 'demo-asset-1', name: 'School Bus', type: 'vehicle', current_stock: 1, condition: 'good', purchase_date: '2020-01-01', school_id: schoolId },
        { id: 'demo-asset-2', name: ' Computers', type: 'equipment', current_stock: 20, condition: 'good', purchase_date: '2021-06-15', school_id: schoolId },
        { id: 'demo-asset-3', name: 'Desks', type: 'furniture', current_stock: 150, condition: 'good', purchase_date: '2019-03-10', school_id: schoolId },
      ])
      setLoading(false)
      return
    }
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
    if (isDemo || isDemoSchool(schoolId)) {
      const newAsset = { ...asset, id: `demo-asset-${Date.now()}`, school_id: schoolId || '00000000-0000-0000-0000-000000000001', created_at: new Date().toISOString() }
      setAssets(prev => [newAsset, ...prev])
      return newAsset
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    try {
      const { data, error } = await supabase.from('assets').insert({ ...asset, school_id: querySchoolId }).select().single()
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
      const { data, error } = await supabase.from('assets').update(updates).eq('id', id).select().single()
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
    if (isDemo || isDemoSchool(schoolId)) {
      const newTrans = { ...transaction, id: `demo-inv-${Date.now()}`, school_id: schoolId || '00000000-0000-0000-0000-000000000001', created_at: new Date().toISOString() }
      return { success: true, data: newTrans }
    }
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
