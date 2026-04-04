'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { FeePayment, FeeStructure, CreatePaymentInput } from '@/types'
import { getQuerySchoolId, withTimeout } from './utils'
import { DEMO_FEE_PAYMENTS, DEMO_FEE_STRUCTURE, DEMO_EXPENSES } from '@/lib/demo-data'

export function useFeePayments(schoolId?: string) {
  const [payments, setPayments] = useState<FeePayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isDemo } = useAuth()

  const fetchPayments = useCallback(async () => {
    // Demo mode - check for demo school UUID
    if (isDemo || schoolId === '00000000-0000-0000-0000-000000000001') {
      setPayments(DEMO_FEE_PAYMENTS as any)
      setLoading(false)
      return
    }
    
    if (!schoolId) { setLoading(false); return }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    try {
      setLoading(true)
      const data = await withTimeout(
        supabase.from('fee_payments')
          .select(`
            id, student_id, fee_id, amount_paid, payment_method, payment_reference, 
            paid_by, notes, payment_date, created_at,
            students!inner (id, first_name, last_name, school_id, classes (name))
          `)
          .eq('students.school_id', querySchoolId)
          .order('payment_date', { ascending: false })
          .then(r => { if (r.error) throw r.error; return r.data }),
        8000, [] as any[]
      )
      setPayments((data as any[]) || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally { setLoading(false) }
  }, [schoolId, isDemo])

  const createPayment = async (payment: CreatePaymentInput) => {
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    try {
      const { data, error: insertError } = await supabase.from('fee_payments')
        .insert({ ...payment, school_id: querySchoolId })
        .select(`
          id, student_id, fee_id, amount_paid, payment_method, payment_reference, 
          paid_by, notes, payment_date, created_at,
          students (id, first_name, last_name, classes (name))
        `)
        .single()
      if (insertError) throw insertError
      setPayments(prev => [data as any, ...prev])
      return data as any
    } catch (err: unknown) { throw new Error(err instanceof Error ? err.message : 'Unknown error') }
  }

  const deletePayment = async (id: string) => {
    try {
      const { error: deleteError } = await supabase.from('fee_payments').delete().eq('id', id)
      if (deleteError) throw deleteError
      setPayments(prev => prev.filter(p => p.id !== id))
    } catch (err: unknown) { throw new Error(err instanceof Error ? err.message : 'Unknown error') }
  }

  useEffect(() => { fetchPayments() }, [fetchPayments])
  return { payments, loading, error, createPayment, deletePayment, refetch: fetchPayments }
}

export function useFeeStructure(schoolId?: string) {
  const [feeStructure, setFeeStructure] = useState<FeeStructure[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const fetchFeeStructure = useCallback(async () => {
    // Demo mode - check for demo school UUID
    if (isDemo || schoolId === '00000000-0000-0000-0000-000000000001') {
      setFeeStructure(DEMO_FEE_STRUCTURE as any)
      setLoading(false)
      return
    }
    
    if (!schoolId) { setLoading(false); return }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    try {
      setLoading(true)
      const data = await withTimeout(
        supabase.from('fee_structure')
          .select(`id, school_id, class_id, name, amount, term, academic_year, due_date, created_at, classes (name)`)
          .eq('school_id', querySchoolId)
          .order('name')
          .then(r => { if (r.error) throw r.error; return r.data }),
        5000, [] as any[]
      )
      setFeeStructure((data as any[]) || [])
    } catch (err) { console.error('Error fetching fee structure:', err) }
    finally { setLoading(false) }
  }, [schoolId, isDemo])

  const createFeeStructure = async (fee: { name: string; class_id?: string; amount: number; term: number; academic_year: string; due_date?: string }) => {
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    try {
      const { data, error } = await supabase.from('fee_structure').insert({ school_id: querySchoolId, ...fee, class_id: fee.class_id || null, due_date: fee.due_date || null }).select().single()
      if (error) throw error
      setFeeStructure(prev => [...prev, data])
      return data
    } catch (err: any) { throw new Error(err.message) }
  }

  const deleteFeeStructure = async (id: string) => {
    try {
      const { error: deleteError } = await supabase.from('fee_structure').delete().eq('id', id)
      if (deleteError) throw deleteError
      setFeeStructure(prev => prev.filter(f => f.id !== id))
    } catch (err: any) { throw new Error(err.message) }
  }

  useEffect(() => { fetchFeeStructure() }, [fetchFeeStructure])
  return { feeStructure, loading, createFeeStructure, deleteFeeStructure, refetch: fetchFeeStructure }
}

export function useFeeAdjustments(schoolId?: string) {
  const [adjustments, setAdjustments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo, user } = useAuth()

  const fetchAdjustments = useCallback(async () => {
    if (!schoolId) { setLoading(false); return }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    try {
      setLoading(true)
      const data = await withTimeout(
        supabase.from('fee_adjustments')
          .select('*')
          .eq('school_id', querySchoolId)
          .order('created_at', { ascending: false })
          .then(r => { if (r.error) throw r.error; return r.data }),
        5000, [] as any[]
      )
      setAdjustments(data || [])
    } catch (err) { console.error('Error fetching adjustments:', err) }
    finally { setLoading(false) }
  }, [schoolId, isDemo])

  const createAdjustment = async (adj: { student_id: string; adjustment_type: 'scholarship' | 'discount' | 'penalty'; amount: number; description?: string }) => {
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    try {
      const { data, error } = await supabase.from('fee_adjustments')
        .insert({ ...adj, school_id: querySchoolId, created_by: user?.id })
        .select()
        .single()
      if (error) throw error
      setAdjustments(prev => [data, ...prev])
      return data
    } catch (err: any) { throw new Error(err.message) }
  }

  const deleteAdjustment = async (id: string) => {
    try {
      const { error: deleteError } = await supabase.from('fee_adjustments').delete().eq('id', id)
      if (deleteError) throw deleteError
      setAdjustments(prev => prev.filter(a => a.id !== id))
    } catch (err: any) { throw new Error(err.message) }
  }

  useEffect(() => { fetchAdjustments() }, [fetchAdjustments])
  return { adjustments, loading, createAdjustment, deleteAdjustment, refetch: fetchAdjustments }
}

export function useBudget(schoolId?: string) {
  const [budgets, setBudgets] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const createBudget = async (budget: any) => {
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    try {
      const { data, error } = await supabase.from('budgets').insert({ ...budget, school_id: querySchoolId }).select().single()
      if (error) throw error
      setBudgets(prev => [data, ...prev])
      return data
    } catch (err: any) { throw new Error(err.message) }
  }

  const createExpense = async (expense: any) => {
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    try {
      const { data, error } = await supabase.from('expenses').insert({ ...expense, school_id: querySchoolId }).select().single()
      if (error) throw error
      setExpenses(prev => [data, ...prev])
      return data
    } catch (err: any) { throw new Error(err.message) }
  }

  const updateExpenseStatus = async (id: string, status: string) => {
    try {
      const { data, error } = await supabase.from('expenses').update({ status }).eq('id', id).select().single()
      if (error) throw error
      setExpenses(prev => prev.map(e => e.id === id ? data : e))
      return data
    } catch (err: any) { throw new Error(err.message) }
  }

  useEffect(() => {
    async function fetchData() {
      if (!schoolId) { setLoading(false); return }
      const querySchoolId = getQuerySchoolId(schoolId, isDemo)
      try {
        setLoading(true)
        const [budgetsRes, expensesRes] = await Promise.all([
          supabase.from('budgets')
            .select('id, school_id, name, amount, term, academic_year, created_at')
            .eq('school_id', querySchoolId)
            .order('created_at', { ascending: false }),
          supabase.from('expenses')
            .select('id, school_id, budget_id, amount, description, expense_date, status, created_at')
            .eq('school_id', querySchoolId)
            .order('expense_date', { ascending: false })
        ])
        setBudgets(budgetsRes.data || [])
        setExpenses(expensesRes.data || [])
      } catch (err) { console.error('Error fetching budget:', err) }
      finally { setLoading(false) }
    }
    fetchData()
  }, [schoolId, isDemo])

  return { budgets, expenses, loading, createBudget, createExpense, updateExpenseStatus }
}
