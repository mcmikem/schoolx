"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { DEMO_STUDENTS } from "@/lib/demo-data";

interface TransferStudent {
  id: string;
  name: string;
  class: string;
  previousSchool?: string;
  nextSchool?: string;
  transferDate: string;
  reason: string;
  status: "pending" | "completed";
}

export default function StudentTransfersPage() {
  const { isDemo } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"in" | "out">("in");
  const [transfersIn, setTransfersIn] = useState<TransferStudent[]>([]);
  const [transfersOut, setTransfersOut] = useState<TransferStudent[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showTransferOutModal, setShowTransferOutModal] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    previousSchool: "",
    reason: "Family relocation",
    class: "S.1",
    parentName: "",
    parentPhone: "",
  });
  const [transferOutForm, setTransferOutForm] = useState({
    studentId: "",
    nextSchool: "",
    reason: "Better opportunity",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isDemo) {
      setTransfersIn([
        {
          id: "1",
          name: "John Doe",
          class: "S.2",
          previousSchool: "ABC Primary",
          transferDate: "2026-04-01",
          reason: "Family relocation",
          status: "pending",
        },
        {
          id: "2",
          name: "Jane Smith",
          class: "S.1",
          previousSchool: "XYZ Primary",
          transferDate: "2026-04-05",
          reason: "Transfer",
          status: "completed",
        },
      ]);
      setTransfersOut([
        {
          id: "3",
          name: "Mike Brown",
          class: "S.3",
          nextSchool: "Next School",
          transferDate: "2026-03-15",
          reason: "Better opportunity",
          status: "completed",
        },
      ]);
    }
  }, [isDemo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const newTransfer: TransferStudent = {
      id: `transfer-${Date.now()}`,
      name: `${form.firstName} ${form.lastName}`,
      class: form.class,
      previousSchool: form.previousSchool,
      transferDate: new Date().toISOString().split("T")[0],
      reason: form.reason,
      status: "pending",
    };
    setTransfersIn([newTransfer, ...transfersIn]);
    setShowModal(false);
    setForm({
      firstName: "",
      lastName: "",
      previousSchool: "",
      reason: "Family relocation",
      class: "S.1",
      parentName: "",
      parentPhone: "",
    });
    toast.success("Transfer in recorded");
    setSubmitting(false);
  };

  const handleTransferOut = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedStudent = DEMO_STUDENTS.find(
      (s) => s.id === transferOutForm.studentId,
    );
    if (selectedStudent) {
      const newTransfer: TransferStudent = {
        id: `transfer-out-${Date.now()}`,
        name: `${selectedStudent.first_name} ${selectedStudent.last_name}`,
        class: selectedStudent.classes?.name || "S.1",
        nextSchool: transferOutForm.nextSchool,
        transferDate: new Date().toISOString().split("T")[0],
        reason: transferOutForm.reason,
        status: "completed",
      };
      setTransfersOut([newTransfer, ...transfersOut]);
      toast.success("Student transferred out");
      setShowTransferOutModal(false);
      setTransferOutForm({
        studentId: "",
        nextSchool: "",
        reason: "Better opportunity",
      });
    }
  };

  const handleOpenTransferOut = () => {
    setTransferOutForm({
      studentId: "",
      nextSchool: "",
      reason: "Better opportunity",
    });
    setShowTransferOutModal(true);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Student Transfers"
        subtitle="Manage student transfers in and out"
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setShowModal(true)}>
              <MaterialIcon icon="add" />
              New Transfer
            </Button>
          </div>
        }
      />

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab("in")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "in" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          Transfer In
        </button>
        <button
          onClick={() => setActiveTab("out")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "out" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          Transfer Out
        </button>
      </div>

      {activeTab === "in" ? (
        <div className="space-y-4">
          {transfersIn.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <MaterialIcon
                icon="swap_horiz"
                className="text-4xl mx-auto mb-2"
              />
              <p>No transfers in</p>
            </div>
          ) : (
            transfersIn.map((t) => (
              <Card key={t.id}>
                <CardBody>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{t.name}</h3>
                      <p className="text-sm text-gray-500">
                        {t.class} • From: {t.previousSchool}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {t.reason} • {t.transferDate}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}
                    >
                      {t.status}
                    </span>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleOpenTransferOut}>
              <MaterialIcon icon="add" />
              Transfer Out
            </Button>
          </div>
          {transfersOut.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <MaterialIcon
                icon="swap_horiz"
                className="text-4xl mx-auto mb-2"
              />
              <p>No transfers out</p>
            </div>
          ) : (
            transfersOut.map((t) => (
              <Card key={t.id}>
                <CardBody>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{t.name}</h3>
                      <p className="text-sm text-gray-500">{t.class}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        To: {t.nextSchool} • {t.reason} • {t.transferDate}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      {t.status}
                    </span>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-semibold mb-4">New Transfer In</h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className="text-sm font-medium mb-1 block"
                      htmlFor="first-name"
                    >
                      First Name
                    </label>
                    <input
                      id="first-name"
                      type="text"
                      value={form.firstName}
                      onChange={(e) =>
                        setForm({ ...form, firstName: e.target.value })
                      }
                      className="input w-full"
                      required
                    />
                  </div>
                  <div>
                    <label
                      className="text-sm font-medium mb-1 block"
                      htmlFor="last-name"
                    >
                      Last Name
                    </label>
                    <input
                      id="last-name"
                      type="text"
                      value={form.lastName}
                      onChange={(e) =>
                        setForm({ ...form, lastName: e.target.value })
                      }
                      className="input w-full"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label
                    className="text-sm font-medium mb-1 block"
                    htmlFor="previous-school"
                  >
                    Previous School
                  </label>
                  <input
                    id="previous-school"
                    type="text"
                    value={form.previousSchool}
                    onChange={(e) =>
                      setForm({ ...form, previousSchool: e.target.value })
                    }
                    className="input w-full"
                    required
                  />
                </div>
                <div>
                  <label
                    className="text-sm font-medium mb-1 block"
                    htmlFor="transfer-reason"
                  >
                    Transfer Reason
                  </label>
                  <select
                    id="transfer-reason"
                    value={form.reason}
                    onChange={(e) =>
                      setForm({ ...form, reason: e.target.value })
                    }
                    className="input w-full"
                  >
                    <option>Family relocation</option>
                    <option>Better opportunity</option>
                    <option>Academic reasons</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label
                    className="text-sm font-medium mb-1 block"
                    htmlFor="assign-class"
                  >
                    Assign to Class
                  </label>
                  <select
                    id="assign-class"
                    value={form.class}
                    onChange={(e) =>
                      setForm({ ...form, class: e.target.value })
                    }
                    className="input w-full"
                  >
                    <option>S.1</option>
                    <option>S.2</option>
                    <option>S.3</option>
                    <option>S.4</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Parent/Guardian Name
                    </label>
                    <input
                      type="text"
                      value={form.parentName}
                      onChange={(e) =>
                        setForm({ ...form, parentName: e.target.value })
                      }
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Parent Phone
                    </label>
                    <input
                      type="text"
                      value={form.parentPhone}
                      onChange={(e) =>
                        setForm({ ...form, parentPhone: e.target.value })
                      }
                      className="input w-full"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1"
                  >
                    {submitting ? "Adding..." : "Add Transfer Student"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTransferOutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-semibold mb-4">Transfer Out</h2>
            <form onSubmit={handleTransferOut}>
              <div className="space-y-4">
                <div>
                  <label
                    className="text-sm font-medium mb-1 block"
                    htmlFor="select-student"
                  >
                    Select Student
                  </label>
                  <select
                    id="select-student"
                    value={transferOutForm.studentId}
                    onChange={(e) =>
                      setTransferOutForm({
                        ...transferOutForm,
                        studentId: e.target.value,
                      })
                    }
                    className="input w-full"
                    required
                  >
                    <option value="">Select a student</option>
                    {DEMO_STUDENTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.first_name} {s.last_name} - {s.classes?.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    className="text-sm font-medium mb-1 block"
                    htmlFor="next-school"
                  >
                    Transferring To
                  </label>
                  <input
                    id="next-school"
                    type="text"
                    value={transferOutForm.nextSchool}
                    onChange={(e) =>
                      setTransferOutForm({
                        ...transferOutForm,
                        nextSchool: e.target.value,
                      })
                    }
                    className="input w-full"
                    required
                  />
                </div>
                <div>
                  <label
                    className="text-sm font-medium mb-1 block"
                    htmlFor="out-reason"
                  >
                    Reason
                  </label>
                  <select
                    id="out-reason"
                    value={transferOutForm.reason}
                    onChange={(e) =>
                      setTransferOutForm({
                        ...transferOutForm,
                        reason: e.target.value,
                      })
                    }
                    className="input w-full"
                  >
                    <option>Better opportunity</option>
                    <option>Family relocation</option>
                    <option>Academic reasons</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowTransferOutModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1">
                    Transfer Out
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
