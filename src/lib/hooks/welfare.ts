"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { getQuerySchoolId } from "./utils";
import { isDemoSchool } from "@/lib/demo-utils";
import { DEMO_DORMS, DEMO_TRANSPORT_ROUTES } from "@/lib/demo-data";
import { logger } from "@/lib/logger";

export function useDormManager(schoolId?: string, dormId?: string) {
  const [dorms, setDorms] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [residents, setResidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { isDemo } = useAuth();

  useEffect(() => {
    async function fetchData() {
      if (!schoolId) {
        setLoading(false);
        return;
      }

      if (isDemo || isDemoSchool(schoolId)) {
        setDorms(DEMO_DORMS as unknown as any[]);
        setRooms([
          { id: "demo-room-1", dorm_id: "1", room_number: "A1", capacity: 8, current_occupancy: 6 },
          { id: "demo-room-2", dorm_id: "1", room_number: "A2", capacity: 8, current_occupancy: 7 },
          { id: "demo-room-3", dorm_id: "2", room_number: "B1", capacity: 8, current_occupancy: 5 },
          { id: "demo-room-4", dorm_id: "2", room_number: "B2", capacity: 8, current_occupancy: 6 },
          { id: "demo-room-5", dorm_id: "3", room_number: "C1", capacity: 6, current_occupancy: 4 },
        ]);
        setIncidents([
          {
            id: "demo-inc-1",
            dorm_id: "1",
            student_id: "24",
            incident_type: "misbehavior",
            description: "Late return after prep",
            incident_date: "2025-03-20",
            status: "resolved",
            students: { id: "24", first_name: "Xavier", last_name: "Kibuuka" },
          },
          {
            id: "demo-inc-2",
            dorm_id: "2",
            student_id: "25",
            incident_type: "misbehavior",
            description: "Noise after lights out",
            incident_date: "2025-03-22",
            status: "open",
            students: { id: "25", first_name: "Yvonne", last_name: "Namuggwa" },
          },
        ]);
        setLoading(false);
        return;
      }

      const querySchoolId = getQuerySchoolId(schoolId, isDemo);

      try {
        setLoading(true);
        if (!dormId) {
          setRooms([]);
          setIncidents([]);
          setResidents([]);
          setLoading(false);
          return;
        }
        const [roomsRes, incidentsRes, residentsRes] = await Promise.all([
          supabase
            .from("dorm_rooms")
            .select("id, dorm_id, room_number, capacity, current_occupancy")
            .eq("dorm_id", dormId),
          supabase
            .from("dorm_incidents")
            .select(
              "id, dorm_id, student_id, incident_type, description, incident_date, status, students(id, first_name, last_name)",
            )
            .eq("dorm_id", dormId)
            .eq("school_id", querySchoolId)
            .order("incident_date", { ascending: false }),
          supabase
            .from("dorm_students")
            .select("id, student_id, bed_number, students(id, first_name, last_name)")
            .eq("dorm_id", dormId),
        ]);
        setRooms(roomsRes.data || []);
        setIncidents(incidentsRes.data || []);
        setResidents(residentsRes.data || []);
      } catch (err) {
        logger.error("Error fetching dorm welfare data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [schoolId, dormId, isDemo, refreshKey]);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  return { dorms, rooms, incidents, residents, loading, refetch };
}

export function useTransportManager(schoolId?: string) {
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDemo } = useAuth();

  useEffect(() => {
    async function fetchData() {
      if (!schoolId) {
        setLoading(false);
        return;
      }

      if (isDemo || isDemoSchool(schoolId)) {
        setRoutes(DEMO_TRANSPORT_ROUTES as unknown as any[]);
        setLoading(false);
        return;
      }

      const querySchoolId = getQuerySchoolId(schoolId, isDemo);

      try {
        setLoading(true);
        const { data: routesRes } = await supabase
          .from("transport_routes")
          // Stops live in the pickup_points text column; there is no
          // transport_stops table. Embedding it made PostgREST answer PGRST200,
          // the catch swallowed it, and the whole route list came back empty.
          .select("id, route_name, vehicle_number, driver_name, driver_phone, pickup_points, monthly_fee")
          .eq("school_id", querySchoolId);
        setRoutes(routesRes || []);
      } catch (err) {
        logger.error("Error fetching transport welfare data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [schoolId, isDemo]);

  return { routes, loading };
}
