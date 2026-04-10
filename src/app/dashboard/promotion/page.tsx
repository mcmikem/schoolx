"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { DEMO_STUDENTS } from "@/lib/demo-data";

interface PromotionRecord {
  id: string;
  studentName: string;
  fromClass: string;
  toClass: string;
  promotionType: "promoted" | "repeating" | "demoted";
  date: string;
}

export default function PromotionPage() {
  const { isDemo } = useAuth();
  const toast = useToast();
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(
    new Set(),
  );
  const [targetClass, setTargetClass] = useState("");
  const [promotionType, setPromotionType] = useState<
    "promoted" | "repeating" | "demoted"
  >("promoted");
  const [promoting, setPromoting] = useState(false);
  const [history, setHistory] = useState<PromotionRecord[]>([]);

  useEffect(() => {
    if (isDemo) {
      setClasses([
        { id: "1", name: "S.1" },
        { id: "2", name: "S.2" },
        { id: "3", name: "S.3" },
        { id: "4", name: "S.4" },
      ]);
      setStudents(
        DEMO_STUDENTS.slice(0, 10).map((s) => ({
          ...s,
          className: s.classes?.name || "S.1",
        })),
      );
      setHistory([
        {
          id: "1",
          studentName: "John Doe",
          fromClass: "S.1",
          toClass: "S.2",
          promotionType: "promoted",
          date: "2026-03-15",
        },
        {
          id: "2",
          studentName: "Jane Smith",
          fromClass: "S.2",
          toClass: "S.3",
          promotionType: "promoted",
          date: "2026-03-15",
        },
      ]);
    }
  }, [isDemo]);

  const filteredStudents = selectedClass
    ? students.filter((s) => s.className === selectedClass)
    : students;

  const toggleStudent = (id: string) => {
    const newSet = new Set(selectedStudents);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedStudents(newSet);
  };

  const handlePromote = async () => {
    if (!targetClass || selectedStudents.size === 0) {
      toast.error("Please select target class and students");
      return;
    }
    setPromoting(true);
    const newRecords: PromotionRecord[] = Array.from(selectedStudents).map(
      (id) => {
        const student = students.find((s) => s.id === id);
        return {
          id: `promo-${Date.now()}-${id}`,
          studentName: `${student?.first_name} ${student?.last_name}`,
          fromClass: student?.className || "",
          toClass: targetClass,
          promotionType,
          date: new Date().toISOString().split("T")[0],
        };
      },
    );
    setHistory([...newRecords, ...history]);
    setSelectedStudents(new Set());
    setTargetClass("");
    toast.success(`${newRecords.length} student(s) promoted`);
    setPromoting(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Student Promotion"
        subtitle="Promote, repeat, or demote students to next class"
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardBody>
            <h3 className="font-semibold mb-4">Select Students</h3>
            <div className="mb-4">
              <label className="text-sm font-medium mb-1 block">
                From Class
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="input w-full"
              >
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredStudents.map((student) => (
                <label
                  key={student.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedStudents.has(student.id)}
                    onChange={() => toggleStudent(student.id)}
                    className="w-4 h-4"
                  />
                  <span>
                    {student.first_name} {student.last_name}
                  </span>
                  <span className="text-sm text-gray-500">
                    {student.className}
                  </span>
                </label>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="font-semibold mb-4">Promotion Details</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Target Class
                </label>
                <select
                  value={targetClass}
                  onChange={(e) => setTargetClass(e.target.value)}
                  className="input w-full"
                >
                  <option value="">Select target class</option>
                  {classes
                    .filter((c) => c.name !== selectedClass)
                    .map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Promotion Type
                </label>
                <select
                  value={promotionType}
                  onChange={(e) => setPromotionType(e.target.value as any)}
                  className="input w-full"
                >
                  <option value="promoted">Promote</option>
                  <option value="repeating">Repeat</option>
                  <option value="demoted">Demote</option>
                </select>
              </div>
              <Button
                onClick={handlePromote}
                disabled={
                  promoting || selectedStudents.size === 0 || !targetClass
                }
                className="w-full"
              >
                {promoting
                  ? "Processing..."
                  : `Promote ${selectedStudents.size} Student(s)`}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <h3 className="font-semibold mb-4">Promotion History</h3>
        {history.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <MaterialIcon
              icon="trending_up"
              className="text-4xl mx-auto mb-2"
            />
            <p>No promotion history</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((record) => (
              <Card key={record.id}>
                <CardBody>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{record.studentName}</h4>
                      <p className="text-sm text-gray-500">
                        {record.fromClass} → {record.toClass}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${record.promotionType === "promoted" ? "bg-green-100 text-green-700" : record.promotionType === "repeating" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}
                      >
                        {record.promotionType}
                      </span>
                      <span className="text-xs text-gray-400">
                        {record.date}
                      </span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
