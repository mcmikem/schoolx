'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { getQuerySchoolId } from './utils'
import { DEMO_MESSAGES, DEMO_EVENTS, DEMO_NOTICES } from '@/lib/demo-data'
import { isDemoSchool } from '@/lib/demo-utils'

export function useMessages(schoolId?: string) {
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  useEffect(() => {
    async function fetchMessages() {
      if (isDemo || isDemoSchool(schoolId)) {
        setMessages(DEMO_MESSAGES as any)
        setLoading(false)
        return
      }
      if (!schoolId) { setLoading(false); return }
      const querySchoolId = getQuerySchoolId(schoolId, isDemo)
      try {
        setLoading(true)
        const { data, error } = await supabase.from('messages')
          .select('id, school_id, recipient_type, recipient_id, phone, message, status, sent_by, sent_at, created_at')
          .eq('school_id', querySchoolId)
          .order('created_at', { ascending: false })
          .limit(50)
        if (error) throw error
        setMessages(data || [])
      } catch (err) { console.error('Error fetching messages:', err) }
      finally { setLoading(false) }
    }
    fetchMessages()
  }, [schoolId, isDemo])

  return { messages, loading }
}

export function useEvents(schoolId?: string) {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  useEffect(() => {
    async function fetchEvents() {
      if (isDemo || isDemoSchool(schoolId)) {
        setEvents(DEMO_EVENTS as any)
        setLoading(false)
        return
      }
      if (!schoolId) { setLoading(false); return }
      const querySchoolId = getQuerySchoolId(schoolId, isDemo)
      try {
        setLoading(true)
        const { data, error } = await supabase.from('events')
          .select('id, school_id, title, description, event_type, start_date, end_date, created_by, created_at')
          .eq('school_id', querySchoolId)
          .order('start_date', { ascending: true })
        if (error) throw error
        setEvents(data || [])
      } catch (err) { console.error('Error fetching events:', err) }
      finally { setLoading(false) }
    }
    fetchEvents()
  }, [schoolId, isDemo])

  return { events, loading }
}

// Announcements hook — reads from the 'messages' table (confirmed table name)
export function useAnnouncements(schoolId?: string, limit = 5) {
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  useEffect(() => {
    async function fetch() {
      if (isDemo || isDemoSchool(schoolId)) {
        setAnnouncements(DEMO_NOTICES.slice(0, limit) as any)
        setLoading(false)
        return
      }
      if (!schoolId) return
      try {
        setLoading(true)
        const { data, error } = await supabase.from('messages')
          .select('id, school_id, message, created_at')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(limit)
        if (!error) setAnnouncements(data || [])
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    fetch()
  }, [schoolId, limit, isDemo])

  return { announcements, loading }
}

export function useAcademicEvents(schoolId?: string, limit = 5) {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  useEffect(() => {
    async function fetch() {
      if (isDemo || isDemoSchool(schoolId)) {
        setEvents(DEMO_EVENTS.slice(0, limit) as any)
        setLoading(false)
        return
      }
      if (!schoolId) return
      try {
        setLoading(true)
        const { data, error } = await supabase.from('events')
          .select('id, school_id, title, event_type, start_date, end_date')
          .eq('school_id', schoolId)
          .order('start_date', { ascending: true })
          .limit(limit)
        if (!error) setEvents(data || [])
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    fetch()
  }, [schoolId, limit, isDemo])

  return { events, loading }
}

export function useSMSTriggers(schoolId?: string) {
  const [triggers, setTriggers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  const toggleTrigger = async (id: string, isActive: boolean) => {
    if (isDemo) { setTriggers(prev => prev.map(t => t.id === id ? { ...t, is_active: isActive } : t)); return { success: true } }
    try {
      const { error } = await supabase.from('sms_triggers').update({ is_active: isActive }).eq('id', id)
      if (error) throw error
      return { success: true }
    } catch (err: any) { return { success: false, error: err.message } }
  }

  const runTrigger = async (id: string) => {
    if (!schoolId) return { success: false, error: 'School ID required' }
    if (isDemo) {
      return {
        success: true,
        data: {
          triggerId: id,
          alertsMatched: 2,
          messagesCreated: 2,
          runAt: new Date().toISOString(),
        }
      }
    }

    try {
      const response = await fetch('/api/automation/sms/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ schoolId, triggerId: id }),
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to run trigger')
      }

      setTriggers(prev =>
        prev.map(trigger =>
          trigger.id === id
            ? { ...trigger, last_run_at: result.data?.runAt || new Date().toISOString() }
            : trigger
        )
      )

      return { success: true, data: result.data }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  useEffect(() => {
    async function fetchTriggers() {
      if (!schoolId) { setLoading(false); return }
      if (isDemo) {
        setTriggers([
          { id: '1', school_id: schoolId, name: 'Fee Reminder (15d)', event_type: 'fee_overdue', threshold_days: 15, is_active: true, created_at: new Date().toISOString() },
          { id: '2', school_id: schoolId, name: 'Absentee Alert', event_type: 'student_absent', threshold_days: 1, is_active: false, created_at: new Date().toISOString() },
        ])
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        const { data, error } = await supabase.from('sms_triggers')
          .select('id, school_id, name, event_type, threshold_days, template_id, is_active, last_run_at, created_at')
          .eq('school_id', schoolId)
        if (error) throw error
        setTriggers(data || [])
      } catch (err) { console.error('Error fetching SMS triggers:', err) }
      finally { setLoading(false) }
    }
    fetchTriggers()
  }, [schoolId, isDemo])

  return { triggers, loading, toggleTrigger, runTrigger }
}
