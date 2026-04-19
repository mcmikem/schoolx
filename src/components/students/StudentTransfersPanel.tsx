"use client";

import type { MutableRefObject } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import PersonInitials from "@/components/ui/PersonInitials";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui";
import { Tabs } from "@/components/ui/Tabs";

interface TransferOutRecord {
  id: string;
  student_id: string;
  transfer_to: string;
  reason: string;
  transfer_date: string;
  student_name: string;
  class_name: string;
  student_number: string;
  gender: string;
  admission_date: string;
}

interface TransferStudent {
  id: string;
  first_name: string;
  last_name: string;
  gender: string;
  student_number?: string;
  transfer_from?: string;
  transfer_reason?: string;
  parent_phone?: string;
  classes?: { name?: string | null } | null;
}

interface ClassOption {
  id: string;
  name: string;
}

interface SchoolIdentity {
  name?: string | null;
  district?: string | null;
  phone?: string | null;
  email?: string | null;
}

interface TransferInForm {
  first_name: string;
  last_name: string;
  gender: "M" | "F";
  date_of_birth: string;
  previous_school: string;
  reason: string;
  class_id: string;
  parent_name: string;
  parent_phone: string;
  parent_phone2: string;
}

interface TransferOutForm {
  student_id: string;
  transfer_to: string;
  reason: string;
  transfer_date: string;
}

interface StudentTransfersPanelProps {
  activeStudents: TransferStudent[];
  transferredIn: TransferStudent[];
  transferredInCount: number;
  transferredOutCount: number;
  transferHistory: TransferOutRecord[];
  transferActiveTab: "in" | "out";
  onTransferTabChange: (tab: "in" | "out") => void;
  showTransferInModal: boolean;
  onShowTransferInModal: (open: boolean) => void;
  showTransferOutModal: boolean;
  onShowTransferOutModal: (open: boolean) => void;
  transferSaving: boolean;
  transferInForm: TransferInForm;
  setTransferInForm: (form: TransferInForm) => void;
  transferOutForm: TransferOutForm;
  setTransferOutForm: (form: TransferOutForm) => void;
  classes: ClassOption[];
  transferReasons: string[];
  onTransferIn: (event: React.FormEvent) => void;
  onTransferOut: (event: React.FormEvent) => void;
  printData: TransferOutRecord | null;
  onPreparePrint: (record: TransferOutRecord) => void;
  onPrint: () => void;
  transferPrintRef: MutableRefObject<HTMLDivElement | null>;
  school?: SchoolIdentity | null;
}

export default function StudentTransfersPanel({
  activeStudents,
  transferredIn,
  transferredInCount,
  transferredOutCount,
  transferHistory,
  transferActiveTab,
  onTransferTabChange,
  showTransferInModal,
  onShowTransferInModal,
  showTransferOutModal,
  onShowTransferOutModal,
  transferSaving,
  transferInForm,
  setTransferInForm,
  transferOutForm,
  setTransferOutForm,
  classes,
  transferReasons,
  onTransferIn,
  onTransferOut,
  printData,
  onPreparePrint,
  onPrint,
  transferPrintRef,
  school,
}: StudentTransfersPanelProps) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <MaterialIcon className="text-blue-600">group</MaterialIcon>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">
              Active
            </span>
          </div>
          <div className="text-3xl font-bold text-blue-600">
            {activeStudents.length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
              <MaterialIcon className="text-green-600">login</MaterialIcon>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">
              Transferred In
            </span>
          </div>
          <div className="text-3xl font-bold text-green-600">
            {transferredInCount}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
              <MaterialIcon className="text-red-600">logout</MaterialIcon>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">
              Transferred Out
            </span>
          </div>
          <div className="text-3xl font-bold text-red-600">
            {transferredOutCount}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
              <MaterialIcon className="text-gray-500">swap_horiz</MaterialIcon>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">
              Total Moves
            </span>
          </div>
          <div className="text-3xl font-bold text-[var(--on-surface)]">
            {transferredInCount + transferredOutCount}
          </div>
        </Card>
      </div>

      <Tabs
        tabs={[
          { id: "in", label: "Transfer In" },
          { id: "out", label: "Transfer Out" },
        ]}
        activeTab={transferActiveTab}
        onChange={(value) => onTransferTabChange(value as "in" | "out")}
        className="mb-6"
      />

      {transferActiveTab === "in" && (
        <Card>
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--on-surface)]">
              Students Transferred In
            </h3>
            <Button onClick={() => onShowTransferInModal(true)}>
              <MaterialIcon icon="person_add" className="text-base" />
              New Transfer
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--surface-container)]">
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Student</th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Student No.</th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Class</th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Previous School</th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Reason</th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Parent Phone</th>
                </tr>
              </thead>
              <tbody>
                {transferredIn.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-[var(--t3)]">
                      No transfer-in students recorded yet
                    </td>
                  </tr>
                ) : (
                  transferredIn.map((student) => (
                    <tr key={student.id} className="border-b border-[var(--border)]">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <PersonInitials name={`${student.first_name} ${student.last_name}`} size={32} />
                          <div>
                            <div className="font-semibold text-sm">
                              {student.first_name} {student.last_name}
                            </div>
                            <div className="text-xs text-[var(--t3)]">
                              {student.gender === "M" ? "Male" : "Female"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm font-mono">{student.student_number || "-"}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-gray-100 rounded-full text-xs font-semibold">
                          {student.classes?.name || "-"}
                        </span>
                      </td>
                      <td className="p-4 text-sm">{student.transfer_from || "-"}</td>
                      <td className="p-4 text-sm">{student.transfer_reason || "-"}</td>
                      <td className="p-4 text-sm font-mono">{student.parent_phone || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {transferActiveTab === "out" && (
        <Card>
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--on-surface)]">
              Students Transferred Out
            </h3>
            <Button onClick={() => onShowTransferOutModal(true)}>
              <MaterialIcon icon="swap_horiz" className="text-base" />
              Transfer Out
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--surface-container)]">
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Student</th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Student No.</th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Former Class</th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Transferred To</th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Reason</th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Date</th>
                  <th className="p-4 text-left text-sm font-semibold text-[var(--on-surface)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transferHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[var(--t3)]">
                      No transfer-out records yet
                    </td>
                  </tr>
                ) : (
                  transferHistory.map((record) => (
                    <tr key={record.id} className="border-b border-[var(--border)]">
                      <td className="p-4 font-semibold text-sm">{record.student_name}</td>
                      <td className="p-4 text-sm font-mono">{record.student_number || "-"}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-gray-100 rounded-full text-xs font-semibold">
                          {record.class_name}
                        </span>
                      </td>
                      <td className="p-4 text-sm">{record.transfer_to}</td>
                      <td className="p-4 text-sm">{record.reason || "-"}</td>
                      <td className="p-4 text-sm">
                        {record.transfer_date
                          ? new Date(record.transfer_date).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => onPreparePrint(record)}
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <MaterialIcon icon="print" className="text-sm" />
                          Letter
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showTransferInModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => onShowTransferInModal(false)}>
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--on-surface)]">New Transfer In</h2>
              <button onClick={() => onShowTransferInModal(false)} className="p-1 hover:bg-[var(--surface-container)] rounded-lg">
                <MaterialIcon className="text-xl text-[var(--t3)]">close</MaterialIcon>
              </button>
            </div>
            <form onSubmit={onTransferIn} className="p-5">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">First Name</label>
                  <input type="text" value={transferInForm.first_name} onChange={(e) => setTransferInForm({ ...transferInForm, first_name: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Last Name</label>
                  <input type="text" value={transferInForm.last_name} onChange={(e) => setTransferInForm({ ...transferInForm, last_name: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Gender</label>
                  <select value={transferInForm.gender} onChange={(e) => setTransferInForm({ ...transferInForm, gender: e.target.value as "M" | "F" })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]">
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Date of Birth</label>
                  <input type="date" value={transferInForm.date_of_birth} onChange={(e) => setTransferInForm({ ...transferInForm, date_of_birth: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]" />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Previous School</label>
                <input type="text" value={transferInForm.previous_school} onChange={(e) => setTransferInForm({ ...transferInForm, previous_school: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]" required placeholder="Name of previous school" />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Transfer Reason</label>
                <select value={transferInForm.reason} onChange={(e) => setTransferInForm({ ...transferInForm, reason: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]" required>
                  <option value="">Select reason</option>
                  {transferReasons.map((reason) => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Assign to Class</label>
                <select value={transferInForm.class_id} onChange={(e) => setTransferInForm({ ...transferInForm, class_id: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]" required>
                  <option value="">Select class</option>
                  {classes.map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>{classItem.name}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Parent/Guardian Name</label>
                <input type="text" value={transferInForm.parent_name} onChange={(e) => setTransferInForm({ ...transferInForm, parent_name: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]" required />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Parent Phone</label>
                  <input type="tel" placeholder="0700000000" value={transferInForm.parent_phone} onChange={(e) => setTransferInForm({ ...transferInForm, parent_phone: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Alt. Phone</label>
                  <input type="tel" placeholder="0700000000" value={transferInForm.parent_phone2} onChange={(e) => setTransferInForm({ ...transferInForm, parent_phone2: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]" />
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={() => onShowTransferInModal(false)}>Cancel</Button>
                <Button className="flex-1" disabled={transferSaving}>{transferSaving ? "Adding..." : "Add Transfer Student"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTransferOutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => onShowTransferOutModal(false)}>
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--on-surface)]">Transfer Student Out</h2>
              <button onClick={() => onShowTransferOutModal(false)} className="p-1 hover:bg-[var(--surface-container)] rounded-lg">
                <MaterialIcon className="text-xl text-[var(--t3)]">close</MaterialIcon>
              </button>
            </div>
            <form onSubmit={onTransferOut} className="p-5">
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Select Student</label>
                {activeStudents.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">No active students</div>
                ) : (
                  <select value={transferOutForm.student_id} onChange={(e) => setTransferOutForm({ ...transferOutForm, student_id: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]" required>
                    <option value="">Select student...</option>
                    {activeStudents.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.first_name} {student.last_name} - {student.classes?.name || "No class"}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Transferring To (School Name)</label>
                <input type="text" value={transferOutForm.transfer_to} onChange={(e) => setTransferOutForm({ ...transferOutForm, transfer_to: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]" required placeholder="Name of new school" />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Reason</label>
                <select value={transferOutForm.reason} onChange={(e) => setTransferOutForm({ ...transferOutForm, reason: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]" required>
                  <option value="">Select reason</option>
                  {transferReasons.map((reason) => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
              </div>
              <div className="mb-5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--t3)] mb-2">Transfer Date</label>
                <input type="date" value={transferOutForm.transfer_date} onChange={(e) => setTransferOutForm({ ...transferOutForm, transfer_date: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]" required />
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={() => onShowTransferOutModal(false)}>Cancel</Button>
                <Button className="flex-1" disabled={transferSaving}>{transferSaving ? "Processing..." : "Transfer Out"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {printData && (
        <div className="hidden">
          <div ref={transferPrintRef}>
            <div className="letterhead">
              <h1>{school?.name || "School Name"}</h1>
              <p>
                {school?.district ? `${school.district} District` : ""} {school?.phone ? `| Tel: ${school.phone}` : ""}
              </p>
              <p>{school?.email || ""}</p>
            </div>
            <div className="title">TRANSFER LETTER</div>
            <div className="content">
              <p>
                Date:{" "}
                <span className="field">
                  {new Date().toLocaleDateString("en-UG", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </p>
              <p>&nbsp;</p>
              <p>To Whom It May Concern,</p>
              <p>&nbsp;</p>
              <p>
                This is to certify that <span className="field">{printData.student_name}</span> ({printData.gender === "M" ? "Male" : "Female"}) was a student at <span className="field">{school?.name || "our school"}</span>.
              </p>
              <p>&nbsp;</p>
              <p><strong>Student Details:</strong></p>
              <p>Student Number: <span className="field">{printData.student_number || "N/A"}</span></p>
              <p>Class: <span className="field">{printData.class_name}</span></p>
              <p>
                Period of Study:{" "}
                <span className="field">
                  {printData.admission_date
                    ? new Date(printData.admission_date).toLocaleDateString("en-UG", { year: "numeric", month: "long" })
                    : "N/A"}{" "}
                  -{" "}
                  {new Date(printData.transfer_date).toLocaleDateString("en-UG", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </p>
              <p>Reason for Transfer: <span className="field">{printData.reason || "Not specified"}</span></p>
              <p>Transferring To: <span className="field">{printData.transfer_to}</span></p>
              <p>&nbsp;</p>
              <p>We wish the student all the best in their future academic endeavors.</p>
              <p>&nbsp;</p>
              <p>Yours faithfully,</p>
            </div>
            <div className="signatures">
              <div className="sig-block">
                <div className="stamp-area">School Stamp</div>
              </div>
              <div className="sig-block">
                <div className="sig-line">Head Teacher&apos;s Signature</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}