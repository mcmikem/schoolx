"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/index";
import { DEMO_STUDENTS } from "@/lib/demo-data";

export default function StudentLookupPage() {
  const { isDemo } = useAuth();
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (isDemo) setStudents(DEMO_STUDENTS);
  }, [isDemo]);

  const filtered = students.filter(
    (s) =>
      search &&
      `${s.first_name} ${s.last_name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );

  const handleSMSParent = (student: any) => {
    setSelectedStudent(student);
    setShowModal(true);
    setMessage("");
  };

  const handleFeeReminder = () => {
    setMessage(
      `Dear parent, this is a reminder that school fees for ${selectedStudent.first_name} ${selectedStudent.last_name} are now due. Pleasekindly clear the outstanding balance. Thank you.`,
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Student Lookup"
        subtitle="Search and find student information"
      />
      <div className="mt-6">
        <label
          htmlFor="student-search"
          className="text-sm font-medium mb-1 block"
        >
          Student Search
        </label>
        <input
          id="student-search"
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input w-full max-w-md"
        />
      </div>
      {search && filtered.length > 0 && (
        <div className="mt-4 space-y-2">
          {filtered.map((student) => (
            <div
              key={student.id}
              className="card p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium">
                  {student.first_name} {student.last_name}
                </p>
                <p className="text-sm text-gray-500">{student.classes?.name}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSMSParent(student)}
                >
                  <MaterialIcon icon="sms" />
                  SMS Parent
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SMS Parent Modal */}
      {showModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold mb-4">
              SMS Parent of {selectedStudent.first_name}{" "}
              {selectedStudent.last_name}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Parent Phone
                </label>
                <input
                  type="text"
                  className="input w-full"
                  defaultValue="0700000000"
                  readOnly
                />
              </div>
              <div>
                <label
                  htmlFor="message"
                  className="block text-sm font-medium mb-1"
                >
                  Message
                </label>
                <textarea
                  id="message"
                  className="input w-full"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter message..."
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="secondary" onClick={handleFeeReminder}>
                <MaterialIcon icon="receipt" /> Fee Reminder
              </Button>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </Button>
              <Button className="flex-1" onClick={() => setShowModal(false)}>
                Send SMS
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
