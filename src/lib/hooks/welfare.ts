'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { getQuerySchoolId } from './utils'
import { isDemoSchool } from '@/lib/demo-utils'
import { DEMO_DORMS, DEMO_TRANSPORT_ROUTES, DEMO_TRANSPORT_LOGS } from '@/lib/demo-data'

export function useDormManager(schoolId?: string, dormId?: string) {
  const [dorms, setDorms] = useState<any[]>([])
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

      if (isDemo || isDemoSchool(schoolId)) {
        setDorms(DEMO_DORMS as any)
        setRooms([
          { id: 'demo-room-1', dorm_id: '1', room_number: 'A1', capacity: 8, current_occupancy: 6 },
          { id: 'demo-room-2', dorm_id: '1', room_number: 'A2', capacity: 8, current_occupancy: 7 },
          { id: 'demo-room-3', dorm_id: '2', room_number: 'B1', capacity: 8, current_occupancy: 5 },
          { id: 'demo-room-4', dorm_id: '2', room_number: 'B2', capacity: 8, current_occupancy: 6 },
          { id: 'demo-room-5', dorm_id: '3', room_number: 'C1', capacity: 6, current_occupancy: 4 },
        ])
        setIncidents([
          { id: 'demo-inc-1', dorm_id: '1', student_id: '24', description: 'Late return after prep', incident_date: '2025-03-20', status: 'resolved', students: { id: '24', first_name: 'Xavier', last_name: 'Kibuuka' } },
          { id: 'demo-inc-2', dorm_id: '2', student_id: '25', description: 'Noise after lights out', incident_date: '2025-03-22', status: 'open', students: { id: '25', first_name: 'Yvonne', last_name: 'Namuggwa' } },
        ])
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

  return { dorms, rooms, incidents, loading }
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

      if (isDemo || isDemoSchool(schoolId)) {
        setRoutes(DEMO_TRANSPORT_ROUTES as any)
        setLogs(DEMO_TRANSPORT_LOGS as any)
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
