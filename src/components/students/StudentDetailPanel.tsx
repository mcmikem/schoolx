"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/index";
import MaterialIcon from "@/components/MaterialIcon";
import StudentPhotoField from "@/components/students/StudentPhotoField";
import { uploadStudentPhoto } from "@/lib/student-photos";
import { UGANDA_DISTRICT_DIRECTORY } from "@/lib/uganda-admin";

function FieldHint({ tip }: { tip: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block ml-1.5 align-middle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-4 h-4 rounded-full bg-[var(--navy-soft)] text-[var(--navy)] flex items-center justify-center text-[9px] font-black leading-none border border-[var(--border)] hover:bg-[var(--navy)] hover:text-white transition-colors"
        aria-label="Help"
        title={tip}
      >
        ?
      </button>
      {open && (
        <div className="absolute left-6 top-0 z-50 w-56 rounded-xl border border-[var(--border)] bg-white p-3 text-[12px] text-[var(--t2)] leading-5 shadow-lg">
          {tip}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 block text-[11px] font-semibold text-[var(--primary)] hover:underline"
          >
            Got it
          </button>
        </div>
      )}
    </span>
  );
}

interface StudentDetailData {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  parent_phone2?: string | null;
  class_id?: string | null;
  student_number?: string | null;
  ple_index_number?: string | null;
  opening_balance?: string | number | null;
  photo_url?: string | null;
}

interface ClassOption {
  id: string;
  name: string;
  level?: string;
}

interface StudentDetailPanelProps {
  mode: "add" | "edit";
  isOpen: boolean;
  onClose: () => void;
  schoolId?: string;
  classes: ClassOption[];
  isDemo: boolean;
  toast: { error: (msg: string) => void; success: (msg: string) => void };
  createStudent?: (data: any) => Promise<any>;
  updateStudent?: (id: string, data: any) => Promise<any>;
  student?: StudentDetailData | null;
}

type EditForm = {
  first_name: string;
  last_name: string;
  gender: "M" | "F";
  date_of_birth: string;
  parent_name: string;
  parent_phone: string;
  parent_phone2: string;
  class_id: string;
  student_number: string;
  ple_index_number: string;
  opening_balance: string;
  photo_url: string;
};

type NewStudent = {
  first_name: string;
  last_name: string;
  gender: "M" | "F";
  date_of_birth: string;
  parent_name: string;
  parent_phone: string;
  parent_phone2: string;
  class_id: string;
  student_number: string;
  ple_index_number: string;
  opening_balance: string;
  boarding_status: "day" | "boarding" | "weekly";
  house_id: string;
  previous_school: string;
  district_origin: string;
  sub_county: string;
  parish: string;
  village: string;
  is_class_monitor: boolean;
  prefect_role: string;
  student_council_role: string;
  games_house: string;
  photo_url: string;
};

export default function StudentDetailPanel({
  mode,
  isOpen,
  onClose,
  schoolId,
  classes,
  isDemo,
  toast,
  createStudent,
  updateStudent,
  student,
}: StudentDetailPanelProps) {
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [houses, setHouses] = useState<{ id: string; name: string }[]>([]);
  const addStudentFirstInputRef = useRef<HTMLInputElement>(null);
  const addStudentModalRef = useRef<HTMLDivElement>(null);

  const initialNewStudent: NewStudent = {
    first_name: "",
    last_name: "",
    gender: "M",
    date_of_birth: "",
    parent_name: "",
    parent_phone: "",
    parent_phone2: "",
    class_id: "",
    student_number: "",
    ple_index_number: "",
    opening_balance: "0",
    boarding_status: "day",
    house_id: "",
    previous_school: "",
    district_origin: "",
    sub_county: "",
    parish: "",
    village: "",
    is_class_monitor: false,
    prefect_role: "",
    student_council_role: "",
    games_house: "",
    photo_url: "",
  };

  const [newStudent, setNewStudent] = useState<NewStudent>(initialNewStudent);
  const initialEditForm: EditForm = {
    first_name: "",
    last_name: "",
    gender: "M",
    date_of_birth: "",
    parent_name: "",
    parent_phone: "",
    parent_phone2: "",
    class_id: "",
    student_number: "",
    ple_index_number: "",
    opening_balance: "0",
    photo_url: "",
  };
  const [editForm, setEditForm] = useState<EditForm>(initialEditForm);
  const [internalEditingStudent, setInternalEditingStudent] =
    useState<StudentDetailData | null>(null);

  const resetNewStudentForm = useCallback(() => {
    setNewStudent(initialNewStudent);
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    supabase
      .from("houses")
      .select("*")
      .eq("school_id", schoolId)
      .order("name")
      .then(({ data }) => {
        setHouses(data || []);
      });
  }, [schoolId]);

  useEffect(() => {
    if (!isOpen) return;
    if (mode === "add") {
      resetNewStudentForm();
    } else if (mode === "edit" && student) {
      setEditForm({
        first_name: student.first_name || "",
        last_name: student.last_name || "",
        gender: student.gender === "F" ? "F" : "M",
        date_of_birth: student.date_of_birth || "",
        parent_name: student.parent_name || "",
        parent_phone: student.parent_phone || "",
        parent_phone2: student.parent_phone2 || "",
        class_id: student.class_id || "",
        student_number: student.student_number || "",
        ple_index_number: student.ple_index_number || "",
        opening_balance: student.opening_balance?.toString() || "0",
        photo_url: student.photo_url || "",
      });
      setInternalEditingStudent(student as StudentDetailData);
    }
  }, [isOpen, mode, student, resetNewStudentForm]);

  useEffect(() => {
    if (!isOpen || mode !== "add") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      if (addStudentModalRef.current) {
        addStudentModalRef.current.scrollTop = 0;
      }
      addStudentFirstInputRef.current?.focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, mode]);

  const handleNewStudentChange = (updates: Partial<NewStudent>) => {
    setNewStudent((prev) => ({ ...prev, ...updates }));
  };

  const handleStudentPhotoUpload = useCallback(
    async (file: File, uploadMode: "new" | "edit") => {
      if (isDemo) {
        await new Promise<void>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = String(reader.result || "");
            if (uploadMode === "new") {
              setNewStudent((prev) => ({ ...prev, photo_url: result }));
            } else {
              setEditForm((prev) => ({ ...prev, photo_url: result }));
              setInternalEditingStudent((prev) =>
                prev ? { ...prev, photo_url: result } : prev,
              );
            }
            resolve();
          };
          reader.onerror = () => reject(new Error("Failed to read image"));
          reader.readAsDataURL(file);
        });
        return;
      }

      if (!schoolId) {
        throw new Error("School context missing. Reload and try again.");
      }

      const { publicUrl } = await uploadStudentPhoto({
        file,
        schoolId,
        studentId:
          uploadMode === "edit" ? internalEditingStudent?.id : undefined,
      });

      if (uploadMode === "new") {
        setNewStudent((prev) => ({ ...prev, photo_url: publicUrl }));
      } else {
        setEditForm((prev) => ({ ...prev, photo_url: publicUrl }));
        setInternalEditingStudent((prev) =>
          prev ? { ...prev, photo_url: publicUrl } : prev,
        );
      }
    },
    [internalEditingStudent?.id, isDemo, schoolId],
  );

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) return;
    if (!newStudent.first_name?.trim()) {
      toast.error("First name is required");
      return;
    }
    if (!newStudent.last_name?.trim()) {
      toast.error("Last name is required");
      return;
    }
    if (!newStudent.class_id) {
      toast.error("Please select a class");
      return;
    }
    if (!newStudent.parent_name?.trim()) {
      toast.error("Parent/Guardian name is required");
      return;
    }
    if (!newStudent.parent_phone?.trim()) {
      toast.error("Parent phone is required");
      return;
    }
    try {
      setSaving(true);
      await createStudent?.({
        first_name: newStudent.first_name.trim(),
        last_name: newStudent.last_name.trim(),
        gender: newStudent.gender,
        date_of_birth: newStudent.date_of_birth || undefined,
        parent_name: newStudent.parent_name.trim(),
        parent_phone: newStudent.parent_phone.trim(),
        parent_phone2: newStudent.parent_phone2?.trim() || undefined,
        class_id: newStudent.class_id,
        student_number: newStudent.student_number?.trim() || undefined,
        ple_index_number: newStudent.ple_index_number?.trim() || undefined,
        opening_balance: parseFloat(newStudent.opening_balance || "0"),
        boarding_status: newStudent.boarding_status,
        house_id: newStudent.house_id || undefined,
        previous_school: newStudent.previous_school?.trim() || undefined,
        district_origin: newStudent.district_origin?.trim() || undefined,
        sub_county: newStudent.sub_county?.trim() || undefined,
        parish: newStudent.parish?.trim() || undefined,
        village: newStudent.village?.trim() || undefined,
        prefect_role: newStudent.prefect_role || undefined,
        student_council_role: newStudent.student_council_role || undefined,
        games_house: newStudent.games_house || undefined,
        is_class_monitor: newStudent.is_class_monitor,
        photo_url: newStudent.photo_url || undefined,
        status: "active",
      });
      toast.success("Student added successfully");
      onClose();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to add student";
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!internalEditingStudent) return;
    try {
      setSaving(true);
      const updateData = {
        ...editForm,
        opening_balance: parseFloat(editForm.opening_balance || "0"),
      };
      await updateStudent?.(internalEditingStudent.id, updateData);
      toast.success("Student updated successfully");
      onClose();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update student";
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const districtOptions = useMemo(
    () => UGANDA_DISTRICT_DIRECTORY.map((entry) => entry.district),
    [],
  );
  const selectedDistrictEntry = useMemo(
    () =>
      UGANDA_DISTRICT_DIRECTORY.find(
        (entry) =>
          entry.district.toLowerCase() ===
          newStudent.district_origin.trim().toLowerCase(),
      ),
    [newStudent.district_origin],
  );
  const subcountyOptions = selectedDistrictEntry?.subcounties || [];
  const parishOptions = useMemo(() => {
    if (!selectedDistrictEntry) return [];
    const subcounty = newStudent.sub_county.trim();
    if (!subcounty) return [];
    return selectedDistrictEntry.parishes[subcounty] || [];
  }, [selectedDistrictEntry, newStudent.sub_county]);

  if (!isOpen) return null;

  const isEdit = mode === "edit";
  const fName = isEdit ? editForm.first_name : newStudent.first_name;
  const lName = isEdit ? editForm.last_name : newStudent.last_name;
  const gen = isEdit ? editForm.gender : newStudent.gender;
  const dob = isEdit ? editForm.date_of_birth : newStudent.date_of_birth;
  const pName = isEdit ? editForm.parent_name : newStudent.parent_name;
  const pPhone = isEdit ? editForm.parent_phone : newStudent.parent_phone;
  const pPhone2 = isEdit ? editForm.parent_phone2 : newStudent.parent_phone2;
  const cId = isEdit ? editForm.class_id : newStudent.class_id;
  const photoUrl = isEdit ? editForm.photo_url : newStudent.photo_url;
  const ob = isEdit ? editForm.opening_balance : newStudent.opening_balance;

  const setFName = (v: string) =>
    isEdit
      ? setEditForm((p) => ({ ...p, first_name: v }))
      : handleNewStudentChange({ first_name: v });
  const setLName = (v: string) =>
    isEdit
      ? setEditForm((p) => ({ ...p, last_name: v }))
      : handleNewStudentChange({ last_name: v });
  const setGender = (v: "M" | "F") =>
    isEdit
      ? setEditForm((p) => ({ ...p, gender: v }))
      : handleNewStudentChange({ gender: v });
  const setDob = (v: string) =>
    isEdit
      ? setEditForm((p) => ({ ...p, date_of_birth: v }))
      : handleNewStudentChange({ date_of_birth: v });
  const setPName = (v: string) =>
    isEdit
      ? setEditForm((p) => ({ ...p, parent_name: v }))
      : handleNewStudentChange({ parent_name: v });
  const setPPhone = (v: string) =>
    isEdit
      ? setEditForm((p) => ({ ...p, parent_phone: v }))
      : handleNewStudentChange({ parent_phone: v });
  const setPPhone2 = (v: string) =>
    isEdit
      ? setEditForm((p) => ({ ...p, parent_phone2: v }))
      : handleNewStudentChange({ parent_phone2: v });
  const setClassId = (v: string) =>
    isEdit
      ? setEditForm((p) => ({ ...p, class_id: v }))
      : handleNewStudentChange({ class_id: v });
  const setOb = (v: string) =>
    isEdit
      ? setEditForm((p) => ({ ...p, opening_balance: v }))
      : handleNewStudentChange({ opening_balance: v });

  return createPortal(
    <div
      className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div className="min-h-full flex items-start sm:items-center justify-center p-4">
        <div
          ref={addStudentModalRef}
          className="bg-[var(--surface)] rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto my-2 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-[var(--surface)] border-b border-[var(--border)] p-4 flex items-center justify-between">
            <div
              style={{
                fontFamily: "Sora",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              {isEdit ? "Edit Student" : "Add New Student"}
            </div>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
              }}
            >
              <MaterialIcon style={{ fontSize: 18, color: "var(--t3)" }}>
                close
              </MaterialIcon>
            </button>
          </div>
          <form
            onSubmit={isEdit ? handleUpdateStudent : handleCreateStudent}
            style={{ padding: 20 }}
          >
            <StudentPhotoField
              photoUrl={photoUrl}
              firstName={fName}
              lastName={lName}
              gender={gen}
              uploading={uploadingPhoto}
              title={isEdit ? "Student Photo" : undefined}
              size={isEdit ? 80 : undefined}
              onUpload={async (file) => {
                try {
                  setUploadingPhoto(true);
                  await handleStudentPhotoUpload(
                    file,
                    isEdit ? "edit" : "new",
                  );
                  toast.success(
                    isEdit
                      ? "Student photo updated"
                      : "Passport photo added",
                  );
                } catch (error: unknown) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Failed to upload photo",
                  );
                } finally {
                  setUploadingPhoto(false);
                }
              }}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: ".5px",
                    textTransform: "uppercase",
                    color: "var(--t3)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  First Name
                </label>
                <input
                  ref={isEdit ? undefined : addStudentFirstInputRef}
                  type="text"
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  className="input"
                  required
                  maxLength={100}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: ".5px",
                    textTransform: "uppercase",
                    color: "var(--t3)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  Last Name
                </label>
                <input
                  type="text"
                  value={lName}
                  onChange={(e) => setLName(e.target.value)}
                  className="input"
                  required
                  maxLength={100}
                />
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: ".5px",
                    textTransform: "uppercase",
                    color: "var(--t3)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  Gender
                </label>
                <select
                  value={gen}
                  onChange={(e) =>
                    setGender(e.target.value as "M" | "F")
                  }
                  className="input"
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: ".5px",
                    textTransform: "uppercase",
                    color: "var(--t3)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="input"
                />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: ".5px",
                  textTransform: "uppercase",
                  color: "var(--t3)",
                  marginBottom: 6,
                  display: "block",
                }}
              >
                Class
              </label>
              {classes.length === 0 ? (
                <div
                  style={{
                    background: "var(--amber-soft)",
                    border: "1px solid var(--amber)",
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <p
                    style={{
                      color: "var(--t1)",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    No classes found
                  </p>
                  <p
                    style={{
                      color: "var(--amber)",
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    Contact support if this persists.
                  </p>
                </div>
              ) : (
                <select
                  value={cId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {!isEdit && (
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: ".5px",
                    textTransform: "uppercase",
                    color: "var(--t3)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  Admission / Student Number{" "}
                  <span
                    style={{
                      fontWeight: 400,
                      fontSize: 10,
                      color: "var(--t4)",
                    }}
                  >
                    (optional — auto-generated if blank)
                  </span>
                </label>
                <input
                  type="text"
                  value={newStudent.student_number}
                  onChange={(e) =>
                    handleNewStudentChange({
                      student_number: e.target.value,
                    })
                  }
                  className="input"
                  placeholder="e.g., 2026-001 or leave blank for auto"
                  maxLength={20}
                />
              </div>
            )}
            {!isEdit &&
              newStudent.class_id &&
              classes
                .find((c) => c.id === newStudent.class_id)
                ?.name?.startsWith("P.7") && (
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: ".5px",
                      textTransform: "uppercase",
                      color: "var(--t3)",
                      marginBottom: 6,
                      display: "block",
                    }}
                  >
                    PLE Index Number
                    <span
                      style={{
                        fontWeight: 400,
                        fontSize: 10,
                        color: "var(--t4)",
                        marginLeft: 4,
                      }}
                    >
                      (Uganda UNEB format e.g. U0001/2026)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={newStudent.ple_index_number}
                    onChange={(e) =>
                      handleNewStudentChange({
                        ple_index_number: e.target.value,
                      })
                    }
                    className="input"
                    placeholder="U0001/2026"
                    maxLength={20}
                  />
                </div>
              )}
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: ".5px",
                  textTransform: "uppercase",
                  color: "var(--t3)",
                  marginBottom: 6,
                  display: "block",
                }}
              >
                Parent Name
              </label>
              <input
                type="text"
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                className="input"
                required
                maxLength={200}
              />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: ".5px",
                    textTransform: "uppercase",
                    color: "var(--t3)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  Parent Phone
                </label>
                <input
                  type="tel"
                  placeholder="0700000000"
                  value={pPhone}
                  onChange={(e) => setPPhone(e.target.value)}
                  className="input"
                  required
                  maxLength={15}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: ".5px",
                    textTransform: "uppercase",
                    color: "var(--t3)",
                    marginBottom: 6,
                    display: "block",
                  }}
                >
                  Alt. Phone
                </label>
                <input
                  type="tel"
                  placeholder="0700000000"
                  value={pPhone2}
                  onChange={(e) => setPPhone2(e.target.value)}
                  className="input"
                  maxLength={15}
                />
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: ".5px",
                  textTransform: "uppercase",
                  color: "var(--t3)",
                  marginBottom: 6,
                  display: "block",
                }}
              >
                Opening Balance (Previous Debt/Credit)
                {!isEdit && (
                  <FieldHint tip="Enter fees owed from a previous term. Use 0 if this is a new student with no debt. Positive = owes money, negative = paid in advance." />
                )}
              </label>
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 14,
                    color: "var(--t3)",
                  }}
                >
                  UGX
                </span>
                <input
                  type="number"
                  value={ob}
                  onChange={(e) => setOb(e.target.value)}
                  className="input"
                  style={{ paddingLeft: 45 }}
                />
              </div>
              {!isEdit && (
                <p
                  style={{
                    fontSize: 10,
                    color: "var(--t3)",
                    marginTop: 4,
                  }}
                >
                  Positive for debt (arrears), negative for credit/advance.
                </p>
              )}
            </div>
            {!isEdit && (
              <>
                <div
                  style={{
                    borderTop: "1px solid var(--border)",
                    paddingTop: 16,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--t1)",
                      marginBottom: 12,
                    }}
                  >
                    Additional Details
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: ".5px",
                          textTransform: "uppercase",
                          color: "var(--t3)",
                          marginBottom: 6,
                          display: "block",
                        }}
                      >
                        Boarding Status
                        <FieldHint tip="Day Scholar = student goes home daily after school. Boarding = student sleeps in the school dormitory every night. Weekly = boarder who goes home on weekends." />
                      </label>
                      <select
                        value={newStudent.boarding_status}
                        onChange={(e) =>
                          handleNewStudentChange({
                            boarding_status: e.target.value as
                              | "day"
                              | "boarding"
                              | "weekly",
                          })
                        }
                        className="input"
                      >
                        <option value="day">Day Scholar</option>
                        <option value="boarding">Boarding</option>
                        <option value="weekly">Weekly Boarder</option>
                      </select>
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: ".5px",
                          textTransform: "uppercase",
                          color: "var(--t3)",
                          marginBottom: 6,
                          display: "block",
                        }}
                      >
                        Previous School
                      </label>
                      <input
                        type="text"
                        value={newStudent.previous_school}
                        onChange={(e) =>
                          handleNewStudentChange({
                            previous_school: e.target.value,
                          })
                        }
                        className="input"
                        placeholder="e.g., St. Peter's PS"
                      />
                    </div>
                  </div>
                  {houses.length > 0 && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 12,
                        marginBottom: 12,
                      }}
                    >
                      <div>
                        <label
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: ".5px",
                            textTransform: "uppercase",
                            color: "var(--t3)",
                            marginBottom: 6,
                            display: "block",
                          }}
                        >
                          House
                        </label>
                        <select
                          value={newStudent.house_id}
                          onChange={(e) =>
                            handleNewStudentChange({
                              house_id: e.target.value,
                            })
                          }
                          className="input"
                        >
                          <option value="">No house</option>
                          {houses.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: ".5px",
                            textTransform: "uppercase",
                            color: "var(--t3)",
                            marginBottom: 6,
                            display: "block",
                          }}
                        >
                          Games House
                        </label>
                        <select
                          value={newStudent.games_house}
                          onChange={(e) =>
                            handleNewStudentChange({
                              games_house: e.target.value,
                            })
                          }
                          className="input"
                        >
                          <option value="">Same as house</option>
                          {houses.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: ".5px",
                          textTransform: "uppercase",
                          color: "var(--t3)",
                          marginBottom: 6,
                          display: "block",
                        }}
                      >
                        District of Origin
                        <FieldHint tip="The student's home district. Used for UNEB registration and government reports. Example: Kampala, Wakiso, Gulu, Mbale." />
                      </label>
                      <input
                        type="text"
                        value={newStudent.district_origin}
                        list="district-origin-options"
                        onChange={(e) =>
                          handleNewStudentChange({
                            district_origin: e.target.value,
                            sub_county: "",
                            parish: "",
                          })
                        }
                        className="input"
                        placeholder="e.g., Kampala"
                        maxLength={100}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: ".5px",
                          textTransform: "uppercase",
                          color: "var(--t3)",
                          marginBottom: 6,
                          display: "block",
                        }}
                      >
                        Sub-County
                      </label>
                      <input
                        type="text"
                        value={newStudent.sub_county}
                        list="sub-county-options"
                        onChange={(e) =>
                          handleNewStudentChange({
                            sub_county: e.target.value,
                            parish: "",
                          })
                        }
                        className="input"
                        placeholder={
                          subcountyOptions.length > 0
                            ? "Pick or type your sub-county"
                            : "Type sub-county"
                        }
                        maxLength={100}
                      />
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: ".5px",
                          textTransform: "uppercase",
                          color: "var(--t3)",
                          marginBottom: 6,
                          display: "block",
                        }}
                      >
                        Parish
                      </label>
                      <input
                        type="text"
                        value={newStudent.parish}
                        list="parish-options"
                        onChange={(e) =>
                          handleNewStudentChange({
                            parish: e.target.value,
                          })
                        }
                        className="input"
                        placeholder={
                          parishOptions.length > 0
                            ? "Pick or type your parish"
                            : "Type parish"
                        }
                        maxLength={100}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: ".5px",
                          textTransform: "uppercase",
                          color: "var(--t3)",
                          marginBottom: 6,
                          display: "block",
                        }}
                      >
                        Village
                      </label>
                      <input
                        type="text"
                        value={newStudent.village}
                        onChange={(e) =>
                          handleNewStudentChange({
                            village: e.target.value,
                          })
                        }
                        className="input"
                        maxLength={100}
                      />
                    </div>
                  </div>
                  <datalist id="district-origin-options">
                    {districtOptions.map((district) => (
                      <option key={district} value={district} />
                    ))}
                  </datalist>
                  <datalist id="sub-county-options">
                    {subcountyOptions.map((subcounty) => (
                      <option key={subcounty} value={subcounty} />
                    ))}
                  </datalist>
                  <datalist id="parish-options">
                    {parishOptions.map((parish) => (
                      <option key={parish} value={parish} />
                    ))}
                  </datalist>
                  <p className="text-[11px] text-[var(--t3)] mb-3">
                    Suggestions come from Uganda district data. You can still
                    type any value manually.
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: ".5px",
                          textTransform: "uppercase",
                          color: "var(--t3)",
                          marginBottom: 6,
                          display: "block",
                        }}
                      >
                        Leadership Position
                      </label>
                      <select
                        value={
                          newStudent.prefect_role ||
                          newStudent.student_council_role ||
                          ""
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (
                            [
                              "head_boy",
                              "head_girl",
                              "sports_prefect",
                              "dining_prefect",
                              "library_prefect",
                              "health_prefect",
                            ].includes(val)
                          ) {
                            handleNewStudentChange({
                              prefect_role: val,
                              student_council_role: "",
                            });
                          } else if (
                            [
                              "president",
                              "vice_president",
                              "secretary",
                              "treasurer",
                            ].includes(val)
                          ) {
                            handleNewStudentChange({
                              student_council_role: val,
                              prefect_role: "",
                            });
                          } else {
                            handleNewStudentChange({
                              prefect_role: "",
                              student_council_role: "",
                            });
                          }
                        }}
                        className="input"
                      >
                        <option value="">None</option>
                        <optgroup label="Prefects">
                          <option value="head_boy">Head Boy</option>
                          <option value="head_girl">Head Girl</option>
                          <option value="sports_prefect">
                            Sports Prefect
                          </option>
                          <option value="dining_prefect">
                            Dining Prefect
                          </option>
                          <option value="library_prefect">
                            Library Prefect
                          </option>
                          <option value="health_prefect">
                            Health Prefect
                          </option>
                        </optgroup>
                        <optgroup label="Student Council">
                          <option value="president">President</option>
                          <option value="vice_president">
                            Vice President
                          </option>
                          <option value="secretary">Secretary</option>
                          <option value="treasurer">Treasurer</option>
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: ".5px",
                          textTransform: "uppercase",
                          color: "var(--t3)",
                          marginBottom: 6,
                          display: "block",
                        }}
                      >
                        Class Monitor
                      </label>
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="checkbox"
                          checked={newStudent.is_class_monitor}
                          onChange={(e) =>
                            handleNewStudentChange({
                              is_class_monitor: e.target.checked,
                            })
                          }
                          className="w-5 h-5 rounded"
                        />
                        <span className="text-sm">
                          Yes, this student is a class monitor
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                style={{ flex: 1 }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={saving}
                loading={saving}
                style={{ flex: 1 }}
              >
                {saving
                  ? isEdit
                    ? "Updating..."
                    : "Adding..."
                  : isEdit
                    ? "Update Student"
                    : "Add Student"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
