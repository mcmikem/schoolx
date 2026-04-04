'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { FeePayment, FeeStructure, CreatePaymentInput } from '@/types'
import { getQuerySchoolId, withTimeout } from './utils'
import { DEMO_FEE_PAYMENTS, DEMO_FEE_STRUCTURE, DEMO_EXPENSES } from '@/lib/demo-data'
import { isDemoSchool } from '@/lib/demo-utils'
import { offlineDB, useOnlineStatus } from '@/lib/offline'
import { logAuditEventWithOfflineSupport } from '@/lib/audit'

export function useFeePayments(schoolId?: string) {
  const [payments, setPayments] = useState<FeePayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isDemo, user, school } = useAuth()
  const isOnline = useOnlineStatus()

  const fetchPayments = useCallback(async () => {
    // Demo mode - check for demo school UUID
    if (isDemo || isDemoSchool(schoolId)) {
      setPayments(DEMO_FEE_PAYMENTS as any)
      setLoading(false)
      return
    }
    
    if (!schoolId) { setLoading(false); return }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    try {
      setLoading(true)
      if (!isOnline) {
        const cached = await offlineDB.getAllFromCache('fee_payments', { school_id: querySchoolId })
        setPayments(cached as any[])
        setLoading(false)
        return
      }
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
      await offlineDB.cacheFromServer('fee_payments', (data as any[]) || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally { setLoading(false) }
  }, [schoolId, isDemo, isOnline])

  const createPayment = async (payment: CreatePaymentInput) => {
    if (isDemo || isDemoSchool(schoolId)) {
      const newPaymentData = {
        ...payment,
        id: `demo-payment-${Date.now()}`,
        school_id: schoolId || '00000000-0000-0000-0000-000000000001',
        created_at: new Date().toISOString(),
        students: { id: payment.student_id, first_name: 'Demo', last_name: 'Student', classes: { name: 'Primary 1' } }
      }
      setPayments(prev => [newPaymentData as any, ...prev])
      return newPaymentData as any
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    const payload = { ...payment, school_id: querySchoolId, payment_date: new Date().toISOString().split('T')[0] }
    if (!isOnline) {
      const offlineSaved = await offlineDB.save('fee_payments', payload as unknown as Record<string, unknown>)
      const offlinePayment = {
        ...payload,
        id: String(offlineSaved.id || `offline-payment-${Date.now()}`),
        created_at: new Date().toISOString(),
      }
      setPayments(prev => [offlinePayment as any, ...prev])
      if (school?.id && user?.id) {
        await logAuditEventWithOfflineSupport(
          false,
          school.id,
          user.id,
          user.full_name,
          'create',
          'fees',
          'Queued offline fee payment',
          String(offlinePayment.id),
          undefined,
          offlinePayment as unknown as Record<string, unknown>
        )
      }
      return offlinePayment as any
    }
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
      await offlineDB.cacheFromServer('fee_payments', [data as unknown as Record<string, unknown>])
      if (school?.id && user?.id) {
        await logAuditEventWithOfflineSupport(
          true,
          school.id,
          user.id,
          user.full_name,
          'create',
          'fees',
          'Recorded fee payment',
          data.id,
          undefined,
          data as unknown as Record<string, unknown>
        )
      }
      return data as any
    } catch (err: unknown) { throw new Error(err instanceof Error ? err.message : 'Unknown error') }
  }

  const deletePayment = async (id: string) => {
    if (isDemo || isDemoSchool(schoolId)) {
      setPayments(prev => prev.filter(p => p.id !== id))
      return
    }
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
  const isOnline = useOnlineStatus()

  const fetchFeeStructure = useCallback(async () => {
    // Demo mode - check for demo school UUID
    if (isDemo || isDemoSchool(schoolId)) {
      setFeeStructure(DEMO_FEE_STRUCTURE as any)
      setLoading(false)
      return
    }
    
    if (!schoolId) { setLoading(false); return }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    try {
      setLoading(true)
      if (!isOnline) {
        const cached = await offlineDB.getAllFromCache('fee_structure', { school_id: querySchoolId })
        setFeeStructure(cached as any[])
        setLoading(false)
        return
      }
      const data = await withTimeout(
        supabase.from('fee_structure')
          .select(`id, school_id, class_id, name, amount, term, academic_year, due_date, created_at, classes (name)`)
          .eq('school_id', querySchoolId)
          .order('name')
          .then(r => { if (r.error) throw r.error; return r.data }),
        5000, [] as any[]
      )
      setFeeStructure((data as any[]) || [])
      await offlineDB.cacheFromServer('fee_structure', (data as any[]) || [])
    } catch (err) { console.error('Error fetching fee structure:', err) }
    finally { setLoading(false) }
  }, [schoolId, isDemo, isOnline])

  const createFeeStructure = async (fee: { name: string; class_id?: string; amount: number; term: number; academic_year: string; due_date?: string }) => {
    if (isDemo || isDemoSchool(schoolId)) {
      const newFeeData = {
        ...fee,
        id: `demo-fee-${Date.now()}`,
        school_id: schoolId || '00000000-0000-0000-0000-000000000001',
        class_id: fee.class_id || null,
        due_date: fee.due_date || null,
        created_at: new Date().toISOString(),
      }
      setFeeStructure(prev => [...prev, newFeeData as any])
      return newFeeData
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    try {
      const { data, error } = await supabase.from('fee_structure').insert({ school_id: querySchoolId, ...fee, class_id: fee.class_id || null, due_date: fee.due_date || null }).select().single()
      if (error) throw error
      setFeeStructure(prev => [...prev, data])
      return data
    } catch (err: any) { throw new Error(err.message) }
  }

  const deleteFeeStructure = async (id: string) => {
    if (isDemo || isDemoSchool(schoolId)) {
      setFeeStructure(prev => prev.filter(f => f.id !== id))
      return
    }
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
  const { isDemo, user, school } = useAuth()
  const isOnline = useOnlineStatus()

  const fetchAdjustments = useCallback(async () => {
    if (isDemo || isDemoSchool(schoolId)) {
      setAdjustments([])
      setLoading(false)
      return
    }
    if (!schoolId) { setLoading(false); return }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    try {
      setLoading(true)
      if (!isOnline) {
        const cached = await offlineDB.getAllFromCache('fee_adjustments', { school_id: querySchoolId })
        setAdjustments(cached as any[])
        setLoading(false)
        return
      }
      const data = await withTimeout(
        supabase.from('fee_adjustments')
          .select('*')
          .eq('school_id', querySchoolId)
          .order('created_at', { ascending: false })
          .then(r => { if (r.error) throw r.error; return r.data }),
        5000, [] as any[]
      )
      setAdjustments(data || [])
      await offlineDB.cacheFromServer('fee_adjustments', (data || []) as any[])
    } catch (err) { console.error('Error fetching adjustments:', err) }
    finally { setLoading(false) }
  }, [schoolId, isDemo, isOnline])

  const createAdjustment = async (adj: {
    student_id: string
    adjustment_type: 'scholarship' | 'discount' | 'penalty' | 'manual_credit' | 'write_off' | 'bursary'
    amount: number
    description?: string
  }) => {
    if (isDemo || isDemoSchool(schoolId)) {
      const newAdj = { ...adj, notes: adj.description, id: `demo-adj-${Date.now()}`, school_id: schoolId || '00000000-0000-0000-0000-000000000001', created_by: user?.id, created_at: new Date().toISOString() }
      setAdjustments(prev => [newAdj, ...prev])
      return newAdj
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    const payload = {
      student_id: adj.student_id,
      adjustment_type: adj.adjustment_type,
      amount: adj.amount,
      notes: adj.description,
      school_id: querySchoolId,
      recorded_by: user?.id,
    }

    if (!isOnline) {
      const offlineSaved = await offlineDB.save('fee_adjustments', payload as unknown as Record<string, unknown>)
      const offlineAdjustment = {
        ...payload,
        id: String(offlineSaved.id || `offline-adjustment-${Date.now()}`),
        created_at: new Date().toISOString(),
      }
      setAdjustments(prev => [offlineAdjustment, ...prev])
      if (school?.id && user?.id) {
        await logAuditEventWithOfflineSupport(
          false,
          school.id,
          user.id,
          user.full_name,
          'create',
          'fees',
          `Queued offline fee adjustment (${adj.adjustment_type})`,
          String(offlineAdjustment.id),
          undefined,
          offlineAdjustment as unknown as Record<string, unknown>
        )
      }
      return offlineAdjustment
    }
    try {
      const { data, error } = await supabase.from('fee_adjustments')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      setAdjustments(prev => [data, ...prev])
      if (school?.id && user?.id) {
        await logAuditEventWithOfflineSupport(
          true,
          school.id,
          user.id,
          user.full_name,
          'create',
          'fees',
          `Recorded fee adjustment (${adj.adjustment_type})`,
          data.id,
          undefined,
          data as unknown as Record<string, unknown>
        )
      }
      return data
    } catch (err: any) { throw new Error(err.message) }
  }

  const deleteAdjustment = async (id: string) => {
    if (isDemo || isDemoSchool(schoolId)) {
      setAdjustments(prev => prev.filter(a => a.id !== id))
      return
    }
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
    if (isDemo || isDemoSchool(schoolId)) {
      const newBudget = { ...budget, id: `demo-budget-${Date.now()}`, school_id: schoolId || '00000000-0000-0000-0000-000000000001', created_at: new Date().toISOString() }
      setBudgets(prev => [newBudget, ...prev])
      return newBudget
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    try {
      const { data, error } = await supabase.from('budgets').insert({ ...budget, school_id: querySchoolId }).select().single()
      if (error) throw error
      setBudgets(prev => [data, ...prev])
      return data
    } catch (err: any) { throw new Error(err.message) }
  }

  const createExpense = async (expense: any) => {
    if (isDemo || isDemoSchool(schoolId)) {
      const newExpense = { ...expense, id: `demo-exp-${Date.now()}`, school_id: schoolId || '00000000-0000-0000-0000-000000000001', status: 'pending', created_at: new Date().toISOString() }
      setExpenses(prev => [newExpense, ...prev])
      return newExpense
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo)
    try {
      const { data, error } = await supabase.from('expenses').insert({ ...expense, school_id: querySchoolId }).select().single()
      if (error) throw error
      setExpenses(prev => [data, ...prev])
      return data
    } catch (err: any) { throw new Error(err.message) }
  }

  const updateExpenseStatus = async (id: string, status: string) => {
    if (isDemo || isDemoSchool(schoolId)) {
      setExpenses(prev => prev.map(e => e.id === id ? { ...e, status } : e))
      return { id, status }
    }
    try {
      const { data, error } = await supabase.from('expenses').update({ status }).eq('id', id).select().single()
      if (error) throw error
      setExpenses(prev => prev.map(e => e.id === id ? data : e))
      return data
    } catch (err: any) { throw new Error(err.message) }
  }

  useEffect(() => {
    async function fetchData() {
      if (isDemo || isDemoSchool(schoolId)) {
        setExpenses(DEMO_EXPENSES as any)
        setLoading(false)
        return
      }
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
