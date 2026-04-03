'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { getQuerySchoolId } from './utils'

export function useDormManager(schoolId?: string, dormId?: string) {
  const [rooms, setRooms] = useState<any[]>([])
  const [incidents, setIncidents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  useEffect(() => {
    async function fetchData() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        const [roomsRes, incidentsRes] = await Promise.all([
          supabase.from('dorm_rooms').select('id, dorm_id, room_number, capacity, current_occupancy').eq('dorm_id', dormId),
          supabase.from('dorm_incidents').select('id, dorm_id, student_id, description, incident_date, status, students(id, first_name, last_name)').eq('dorm_id', dormId).eq('school_id', querySchoolId)
        ])
        setRooms(roomsRes.data || [])
        setIncidents(incidentsRes.data || [])
      } catch (err) {
        console.error('Error fetching dorm welfare data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [schoolId, dormId, isDemo])

  return { rooms, incidents, loading }
}

export function useTransportManager(schoolId?: string) {
  const [logs, setLogs] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  useEffect(() => {
    async function fetchData() {
      if (!schoolId) {
        setLoading(false)
        return
      }

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)

      try {
        setLoading(true)
        const [routesRes, logsRes] = await Promise.all([
          supabase.from('transport_routes').select('id, route_name, vehicle_number, driver_name, transport_stops(id, stop_name, arrival_time)').eq('school_id', querySchoolId),
          supabase.from('transport_vehicle_logs').select('id, vehicle_id, log_date, description, status').eq('school_id', querySchoolId).order('log_date', { ascending: false })
        ])
        setRoutes(routesRes.data || [])
        setLogs(logsRes.data || [])
      } catch (err) {
        console.error('Error fetching transport welfare data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [schoolId, isDemo])

  return { routes, logs, loading }
}
