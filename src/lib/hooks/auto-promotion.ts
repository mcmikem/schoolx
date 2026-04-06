import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { useToast } from "@/components/Toast";
import { getUNebGrade, getUNebDivision } from "@/lib/grading";

interface PromotionCriteria {
  minAverageScore: number;
  minAttendancePercent: number;
  maxFailedSubjects: number;
}

interface StudentPromotionEligibility {
  studentId: string;
  firstName: string;
  lastName: string;
  currentClass: string;
  averageScore: number;
  attendancePercent: number;
  failedSubjects: number;
  isEligible: boolean;
  reason?: string;
}

export function useAutoPromotionEngine() {
  const { school } = useAuth();
  const { academicYear } = useAcademic();
  const toast = useToast();

  const [criteria, setCriteria] = useState<PromotionCriteria>({
    minAverageScore: 50, // Pass mark
    minAttendancePercent: 75, // Minimum attendance
    maxFailedSubjects: 2, // Maximum allowed failures
  });

  const [eligibleStudents, setEligibleStudents] = useState<
    StudentPromotionEligibility[]
  >([]);
  const [processing, setProcessing] = useState(false);
  const [promotionResults, setPromotionResults] = useState<{
    promoted: number;
    retained: number;
    errors: string[];
  }>({
    promoted: 0,
    retained: 0,
    errors: [],
  });

  // Fetch student performance data
  const fetchStudentPerformance = useCallback(async () => {
    if (!school?.id || !academicYear) return;

    try {
      // Get all active students with their grades and attendance for the year
      const { data: students, error } = await supabase
        .from("students")
        .select(
          `
          id,
          first_name,
          last_name,
          classes (name),
          student_grades!inner (
            subject_id,
            ca1, ca2, ca3, exam_score,
            subjects (name)
          ),
          student_attendance (
            status
          )
        `,
        )
        .eq("school_id", school.id)
        .eq("status", "active");

      if (error) throw error;

      // Process each student
      const eligible = students
        .filter((student) => student.classes) // Must have a class
        .map((student) => {
          // Calculate average score
          const grades = student.student_grades || [];
          const validGrades = grades.filter(
            (g) =>
              g.ca1 !== null &&
              g.ca2 !== null &&
              g.ca3 !== null &&
              g.exam_score !== null,
          );

          if (validGrades.length === 0) {
            return {
              ...student,
              averageScore: 0,
              attendancePercent: 0,
              failedSubjects: grades.length,
              isEligible: false,
              reason: "No complete grades available",
            };
          }

          const totalScore = validGrades.reduce((sum, g) => {
            const caTotal = (g.ca1 || 0) + (g.ca2 || 0) + (g.ca3 || 0);
            const total = caTotal + (g.exam_score || 0);
            return sum + total;
          }, 0);

          const averageScore = totalScore / (validGrades.length * 4); // 4 components per subject

          // Calculate attendance percentage
          const attendanceRecords = student.student_attendance || [];
          const totalDays = attendanceRecords.length;
          const presentDays = attendanceRecords.filter((record) =>
            ["present", "late"].includes(record.status as string),
          ).length;

          const attendancePercent =
            totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

          // Count failed subjects (< 40% average)
          const failedSubjects = validGrades.filter((g) => {
            const caTotal = (g.ca1 || 0) + (g.ca2 || 0) + (g.ca3 || 0);
            const total = caTotal + (g.exam_score || 0);
            const subjectAverage = total / 4;
            return subjectAverage < 40;
          }).length;

          // Determine eligibility
          const isEligible =
            averageScore >= criteria.minAverageScore &&
            attendancePercent >= criteria.minAttendancePercent &&
            failedSubjects <= criteria.maxFailedSubjects;

          let reason = "";
          if (!isEligible) {
            const reasons = [];
            if (averageScore < criteria.minAverageScore)
              reasons.push(
                `Average score ${averageScore.toFixed(1)} < ${criteria.minAverageScore}`,
              );
            if (attendancePercent < criteria.minAttendancePercent)
              reasons.push(
                `Attendance ${attendancePercent.toFixed(1)}% < ${criteria.minAttendancePercent}%`,
              );
            if (failedSubjects > criteria.maxFailedSubjects)
              reasons.push(
                `${failedSubjects} failed subjects > ${criteria.maxFailedSubjects} allowed`,
              );
            reason = reasons.join("; ");
          }

          return {
            studentId: student.id,
            firstName: student.first_name,
            lastName: student.last_name,
            currentClass: student.classes?.name || "Unknown",
            averageScore,
            attendancePercent,
            failedSubjects,
            isEligible,
            reason,
          };
        });

      setEligibleStudents(eligible);
    } catch (err) {
      toast.error("Failed to load student performance data");
      console.error(err);
    }
  }, [school?.id, academicYear, criteria]);

  // Process automatic promotions
  const processAutoPromotions = useCallback(async () => {
    if (!school?.id || !academicYear || eligibleStudents.length === 0) {
      toast.error("No eligible students found");
      return;
    }

    setProcessing(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const promoted = eligibleStudents.filter((s) => s.isEligible).length;

      const retained = eligibleStudents.filter((s) => !s.isEligible).length;

      // Process promotions
      for (const student of eligibleStudents.filter((s) => s.isEligible)) {
        // Get next class level
        const currentClass = student.currentClass;
        let nextClassId: string | null = null;

        // This would normally query for the next class in sequence
        // For now, we'll use a simple mapping - in reality this should be configurable
        const classMap: Record<string, string> = {
          "P.1": "P.2",
          "P.2": "P.3",
          "P.3": "P.4",
          "P.4": "P.5",
          "P.5": "P.6",
          "P.6": "P.7",
          "P.7": "S.1",
          "S.1": "S.2",
          "S.2": "S.3",
          "S.3": "S.4",
          "S.4": "S.5",
          "S.5": "S.6",
          "S.6": "S.7", // Or S.6 depending on system
        };

        nextClassId = classMap[currentClass] || null;

        if (nextClassId) {
          // Update student class
          await supabase
            .from("students")
            .update({
              class_id: nextClassId,
              repeating: false,
            })
            .eq("id", student.studentId);

          // Record promotion
          await supabase.from("student_promotions").insert({
            school_id: school.id,
            student_id: student.studentId,
            from_class_id:
              (await supabase
                .from("classes")
                .select("id")
                .eq("name", student.currentClass)
                .single()
                .then((res) => res.data?.id)) || "",
            to_class_id: nextClassId,
            academic_year: academicYear,
            promotion_type: "promoted",
            promoted_by: user?.id,
            promoted_at: new Date().toISOString(),
            notes: `Auto-promoted: Avg ${student.averageScore.toFixed(1)}, Att ${student.attendancePercent.toFixed(1)}%`,
          });
        }
      }

      setPromotionResults({
        promoted,
        retained,
        errors: [],
      });

      toast.success(
        `Auto-promotion complete: ${promoted} promoted, ${retained} retained`,
      );

      // Refresh data
      await fetchStudentPerformance();
    } catch (err: any) {
      setPromotionResults((prev) => ({
        ...prev,
        errors: [...prev.errors, err.message],
      }));
      toast.error("Auto-promotion failed: " + err.message);
    } finally {
      setProcessing(false);
    }
  }, [
    school?.id,
    academicYear,
    eligibleStudents,
    fetchStudentPerformance,
    toast,
  ]);

  // Update criteria
  const updateCriteria = useCallback(
    (newCriteria: Partial<PromotionCriteria>) => {
      setCriteria((prev) => ({ ...prev, ...newCriteria }));
    },
    [],
  );

  // Initial load
  useEffect(() => {
    if (school?.id && academicYear) {
      fetchStudentPerformance();
    }
  }, [school?.id, academicYear, fetchStudentPerformance]);

  return {
    criteria,
    updateCriteria,
    eligibleStudents,
    processing,
    promotionResults,
    fetchStudentPerformance: () => fetchStudentPerformance(),
    processAutoPromotions,
  };
}
