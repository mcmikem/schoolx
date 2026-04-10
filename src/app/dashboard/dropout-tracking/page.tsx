"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { DEMO_STUDENTS } from "@/lib/demo-data";

interface AtRiskStudent {
  id: string;
  name: string;
  class: string;
  consecutiveAbsence: number;
  riskLevel: "at_risk" | "likely_dropout";
  lastContact: string | null;
}

export default function DropoutTrackingPage() {
  const { isDemo } = useAuth();
  const toast = useToast();
  const [students, setStudents] = useState<AtRiskStudent[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<AtRiskStudent | null>(
    null,
  );
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (isDemo) {
      const atRisk: AtRiskStudent[] = DEMO_STUDENTS.slice(0, 5).map((s, i) => ({
        id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        class: s.classes?.name || "S.1",
        consecutiveAbsence: 15 + i * 5,
        riskLevel: i < 2 ? "likely_dropout" : "at_risk",
        lastContact: i % 2 === 0 ? "2026-04-01" : null,
      }));
      setStudents(atRisk);
    }
  }, [isDemo]);

  const handleContact = (studentId: string) => {
    toast.success("SMS sent to parent");
  };

  const handleMarkDropout = (student: AtRiskStudent) => {
    setSelectedStudent(student);
    setReason("");
    setShowModal(true);
  };

  const confirmDropout = () => {
    if (selectedStudent) {
      setStudents(students.filter((s) => s.id !== selectedStudent.id));
      toast.success("Student marked as dropout");
      setShowModal(false);
      setSelectedStudent(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Dropout Tracking"
        subtitle="Monitor and intervene with at-risk students"
      />

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-red-600">
              {students.filter((s) => s.riskLevel === "likely_dropout").length}
            </div>
            <div className="text-sm text-gray-500">Likely Dropout</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-yellow-600">
              {students.filter((s) => s.riskLevel === "at_risk").length}
            </div>
            <div className="text-sm text-gray-500">At Risk</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {students.filter((s) => s.lastContact).length}
            </div>
            <div className="text-sm text-gray-500">Contacted This Term</div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 space-y-4">
        {students.map((student) => (
          <Card key={student.id}>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{student.name}</h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        student.riskLevel === "likely_dropout"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {student.riskLevel === "likely_dropout"
                        ? "Likely Dropout"
                        : "At Risk"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {student.class} • {student.consecutiveAbsence} days absent
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleContact(student.id)}
                  >
                    <MaterialIcon icon="sms" />
                    Contact
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleMarkDropout(student)}
                  >
                    <MaterialIcon icon="person_remove" />
                    Dropout
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
        {students.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <MaterialIcon
              icon="check_circle"
              className="text-4xl mx-auto mb-2"
            />
            <p>No at-risk students found</p>
          </div>
        )}
      </div>

      {/* Mark as Dropout Modal */}
      {showModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold mb-4">Mark as Dropout</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-2">
                  You are about to mark <strong>{selectedStudent.name}</strong>{" "}
                  as dropout.
                </p>
              </div>
              <div>
                <label
                  htmlFor="reason"
                  className="block text-sm font-medium mb-1"
                >
                  Reason for Dropout
                </label>
                <select
                  id="reason"
                  className="input w-full"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  <option value="">Select reason</option>
                  <option value="family_relocation">Family Relocation</option>
                  <option value="financial_difficulties">
                    Financial Difficulties
                  </option>
                  <option value="academic_failure">Academic Failure</option>
                  <option value="marriage">Early Marriage</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={confirmDropout}
                disabled={!reason}
              >
                Mark as Dropout
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
