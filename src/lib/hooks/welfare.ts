'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { getQuerySchoolId } from './utils'
import { isDemoSchool } from '@/lib/demo-utils'

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

      if (isDemo || isDemoSchool(schoolId)) {
        setRooms([
          { id: 'demo-room-1', dorm_id: dormId, room_number: 'A1', capacity: 8, current_occupancy: 6 },
          { id: 'demo-room-2', dorm_id: dormId, room_number: 'A2', capacity: 8, current_occupancy: 7 },
        ])
        setIncidents([
          { id: 'demo-inc-1', dorm_id: dormId, student_id: 'demo-1', description: 'Late return after prep', incident_date: '2026-04-01', status: 'resolved', students: { id: 'demo-1', first_name: 'John', last_name: 'Okello' } },
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

      if (isDemo || isDemoSchool(schoolId)) {
        setRoutes([
          { id: 'demo-route-1', route_name: 'Kampala North', vehicle_number: 'UGX 001', transport_stops: [{ stop_name: 'Kisasi', arrival_time: '06:30' }, { stop_name: 'Ntinda', arrival_time: '06:45' }] },
          { id: 'demo-route-2', route_name: 'Kampala South', vehicle_number: 'UGX 002', transport_stops: [{ stop_name: 'Kibuye', arrival_time: '06:30' }, { stop_name: 'Nsambya', arrival_time: '06:45' }] },
        ])
        setLogs([
          { id: 'demo-log-1', vehicle_id: 'demo-route-1', log_date: '2026-04-03', description: 'Routine maintenance', status: 'completed' },
        ])
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
