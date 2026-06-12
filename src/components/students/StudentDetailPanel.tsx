"use client";
import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
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
  parent_email?: string | null;
  address?: string | null;
  class_id?: string | null;
  student_number?: string | null;
  ple_index_number?: string | null;
  opening_balance?: string | number | null;
  photo_url?: string | null;
  blood_type?: string | null;
  boarding_status?: string | null;
  house_id?: string | null;
  previous_school?: string | null;
  district_origin?: string | null;
  sub_county?: string | null;
  parish?: string | null;
  village?: string | null;
  is_class_monitor?: boolean | null;
  prefect_role?: string | null;
  student_council_role?: string | null;
  games_house?: string | null;
  religion?: string | null;
  nationality?: string | null;
  nin?: string | null;
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
  blood_type: string;
  parent_email: string;
  address: string;
  religion: string;
  nationality: string;
  nin: string;
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
  blood_type: string;
  nin: string;
};

const INITIAL_NEW_STUDENT: NewStudent = {
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
  blood_type: "",
  nin: "",
};

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg)]/40 p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[var(--t1)]">{title}</h3>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-[var(--t3)]">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ResponsiveFieldGrid({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${className}`.trim()}>{children}</div>;
}

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
  const modalTitleId = "student-detail-form-title";
  const modalDescriptionId = "student-detail-form-description";

  const [newStudent, setNewStudent] = useState<NewStudent>(INITIAL_NEW_STUDENT);
  const initialEditForm: EditForm = {
    first_name: "",
    last_name: "",
    gender: "M",
    date_of_birth: "",
    parent_name: "",
    parent_phone: "",
    parent_phone2: "",
    parent_email: "",
    address: "",
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
    blood_type: "",
    religion: "",
    nationality: "",
    nin: "",
  };
  const [editForm, setEditForm] = useState<EditForm>(initialEditForm);
  const [internalEditingStudent, setInternalEditingStudent] =
    useState<StudentDetailData | null>(null);

  const resetNewStudentForm = useCallback(() => {
    setNewStudent(INITIAL_NEW_STUDENT);
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
        boarding_status: (student as any).boarding_status || "day",
        house_id: (student as any).house_id || "",
        previous_school: (student as any).previous_school || "",
        district_origin: (student as any).district_origin || "",
        sub_county: (student as any).sub_county || "",
        parish: (student as any).parish || "",
        village: (student as any).village || "",
        is_class_monitor: !!(student as any).is_class_monitor,
        prefect_role: (student as any).prefect_role || "",
        student_council_role: (student as any).student_council_role || "",
        games_house: (student as any).games_house || "",
        photo_url: student.photo_url || "",
        blood_type: student.blood_type || "",
        parent_email: student.parent_email || "",
        address: student.address || "",
        religion: (student as any).religion || "",
        nationality: (student as any).nationality || "",
        nin: (student as any).nin || "",
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

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

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
    if (!classes.some((c) => c.id === newStudent.class_id)) {
      toast.error("Selected class is no longer available. Please choose another class.");
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
      const openingBalance = parseOpeningBalance(newStudent.opening_balance || "0");
      if (openingBalance === null) {
        toast.error("Opening balance must be a valid number");
        return;
      }
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
        opening_balance: openingBalance,
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
        blood_type: newStudent.blood_type || undefined,
        status: "active",
        nin: newStudent.nin?.trim() || undefined,
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
      if (editForm.class_id && !classes.some((c) => c.id === editForm.class_id)) {
        toast.error("Selected class is no longer available. Please choose another class.");
        return;
      }
      const openingBalance = parseOpeningBalance(editForm.opening_balance || "0");
      if (openingBalance === null) {
        toast.error("Opening balance must be a valid number");
        return;
      }
      const updateData = {
        ...editForm,
        opening_balance: openingBalance,
        blood_type: editForm.blood_type || null,
        boarding_status: editForm.boarding_status,
        house_id: editForm.house_id || null,
        previous_school: editForm.previous_school || null,
        district_origin: editForm.district_origin || null,
        sub_county: editForm.sub_county || null,
        parish: editForm.parish || null,
        village: editForm.village || null,
        is_class_monitor: editForm.is_class_monitor,
        prefect_role: editForm.prefect_role || null,
        student_council_role: editForm.student_council_role || null,
        games_house: editForm.games_house || null,
        nin: editForm.nin?.trim() || null,
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

  const isEdit = mode === "edit";
  const formData: Record<string, any> = isEdit ? editForm : newStudent;
  const handleFormChange = (updates: Record<string, any>) =>
    isEdit
      ? setEditForm((p) => ({ ...p, ...updates }))
      : handleNewStudentChange(updates);

  const districtOptions = useMemo(
    () => UGANDA_DISTRICT_DIRECTORY.map((entry) => entry.district),
    [],
  );
  const selectedDistrictEntry = useMemo(
    () =>
      UGANDA_DISTRICT_DIRECTORY.find(
        (entry) =>
          entry.district.toLowerCase() ===
          formData.district_origin.trim().toLowerCase(),
      ),
    [formData.district_origin],
  );
  const subcountyOptions = selectedDistrictEntry?.subcounties || [];
  const parishOptions = useMemo(() => {
    if (!selectedDistrictEntry) return [];
    const subcounty = formData.sub_county.trim();
    if (!subcounty) return [];
    return selectedDistrictEntry.parishes[subcounty] || [];
  }, [selectedDistrictEntry, formData.sub_county]);

  const selectedClassExists =
    !formData.class_id || classes.some((c) => c.id === formData.class_id);

  const parseOpeningBalance = (value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return parsed;
  };

  if (!isOpen) return null;

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
          role="dialog"
          aria-modal="true"
          aria-labelledby={modalTitleId}
          aria-describedby={modalDescriptionId}
          className="bg-[var(--surface)] rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto my-2 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-[var(--surface)] border-b border-[var(--border)] p-4 flex items-center justify-between">
            <div>
              <h2
                id={modalTitleId}
                style={{
                  fontFamily: "Sora",
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                {isEdit ? "Edit Student" : "Add New Student"}
              </h2>
              <p id={modalDescriptionId} className="mt-1 text-xs text-[var(--t3)]">
                Start with the basics. Open extra details only when you need profile, house, or leadership fields.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close student form"
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
            className="space-y-5 p-4 sm:p-5"
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
            <FormSection
              title="Student basics"
              description="These are the minimum details needed to place the learner in the registry."
            >
              <ResponsiveFieldGrid className="mb-4">
                <div>
                  <label
                    htmlFor="student-first-name"
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
                    id="student-first-name"
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
                    htmlFor="student-last-name"
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
                    id="student-last-name"
                    type="text"
                    value={lName}
                    onChange={(e) => setLName(e.target.value)}
                    className="input"
                    required
                    maxLength={100}
                  />
                </div>
              </ResponsiveFieldGrid>
              <ResponsiveFieldGrid className="mb-4">
                <div>
                  <label
                    htmlFor="student-gender"
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
                    id="student-gender"
                    name="gender"
                    value={gen}
                    onChange={(e) => setGender(e.target.value as "M" | "F")}
                    className="input"
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="student-dob"
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
                    id="student-dob"
                    name="date_of_birth"
                    type="date"
                    autoComplete="bday"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="input"
                  />
                </div>
              </ResponsiveFieldGrid>
              <div className="mb-4">
                <label
                  htmlFor="student-class-id"
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
                    id="student-class-id"
                    name="class_id"
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
                <div className="mb-4">
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
                  id="student-number"
                  name="student_number"
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
                  autoComplete="off"
                />
                </div>
              )}
              {!isEdit &&
              newStudent.class_id &&
              classes
                .find((c) => c.id === newStudent.class_id)
                ?.name?.startsWith("P.7") && (
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
                    id="student-ple-index"
                    name="ple_index_number"
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
                    autoComplete="off"
                  />
                </div>
              )}
            </FormSection>

            <FormSection
              title="Parent contact"
              description="Keep this short and accurate so SMS and fee reminders reach the right person."
            >
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
                id="parent-name"
                name="parent_name"
                type="text"
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                className="input"
                required
                maxLength={200}
                autoComplete="name"
              />
            </div>
            <ResponsiveFieldGrid>
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
                  id="parent-phone"
                  name="parent_phone"
                  type="tel"
                  placeholder="0700000000"
                  value={pPhone}
                  onChange={(e) => setPPhone(e.target.value)}
                  className="input"
                  required
                  maxLength={15}
                  autoComplete="tel"
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
                  id="parent-phone2"
                  name="parent_phone2"
                  type="tel"
                  placeholder="0700000000"
                  value={pPhone2}
                  onChange={(e) => setPPhone2(e.target.value)}
                  className="input"
                  maxLength={15}
                  autoComplete="tel"
                />
              </div>
            </ResponsiveFieldGrid>
            </FormSection>

            <FormSection
              title="Health and fees"
              description="Only the fields commonly needed at admission stay here."
            >
              <ResponsiveFieldGrid className="mb-4">
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
                    Blood Type
                  </label>
                  <select
                    id="blood-type"
                    name="blood_type"
                    value={isEdit ? editForm.blood_type : newStudent.blood_type || ""}
                    onChange={(e) =>
                      isEdit
                        ? setEditForm((p) => ({ ...p, blood_type: e.target.value }))
                        : handleNewStudentChange({ blood_type: e.target.value })
                    }
                    className="input"
                  >
                    <option value="">Unknown</option>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bt) => (
                      <option key={bt} value={bt}>
                        {bt}
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
                    NIN (National ID Number)
                  </label>
                  <input
                    type="text"
                    value={formData.nin || ""}
                    onChange={(e) =>
                      handleFormChange({ nin: e.target.value })
                    }
                    className="input"
                    placeholder="e.g., CFN123456789 or leave blank"
                    maxLength={20}
                  />
                </div>
              </ResponsiveFieldGrid>
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
                    inputMode="numeric"
                    step="1"
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
            </FormSection>
            {!selectedClassExists && (
              <div
                style={{
                  marginBottom: 16,
                  borderRadius: 12,
                  padding: 12,
                  background: "var(--amber-soft)",
                  border: "1px solid var(--amber)",
                  color: "var(--t1)",
                  fontSize: 12,
                }}
              >
                The assigned class is no longer available. Please choose a different class before saving.
              </div>
            )}
            <details className="rounded-2xl border border-[var(--border)] bg-[var(--bg)]/40 p-4 sm:p-5" open={isEdit}>
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--t1)]">Additional details</div>
                    <p className="mt-1 text-xs leading-5 text-[var(--t3)]">
                      Optional profile fields for houses, home origin, boarding, and student leadership.
                    </p>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--t3)]">
                    Expand
                  </span>
                </div>
              </summary>
              <div className="mt-4">
              <ResponsiveFieldGrid className="mb-3">
                <div>
                  <label
                    htmlFor="boarding-status"
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
                    id="boarding-status"
                    name="boarding_status"
                    value={formData.boarding_status}
                    onChange={(e) =>
                      handleFormChange({
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
                    htmlFor="previous-school"
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
                    id="previous-school"
                    name="previous_school"
                    type="text"
                    value={formData.previous_school}
                    onChange={(e) =>
                      handleFormChange({
                        previous_school: e.target.value,
                      })
                    }
                    className="input"
                    placeholder="e.g., St. Peter's PS"
                  />
                </div>
              </ResponsiveFieldGrid>
              {houses.length > 0 && (
                <ResponsiveFieldGrid className="mb-3">
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
                      id="house-id"
                      name="house_id"
                      value={formData.house_id}
                      onChange={(e) =>
                        handleFormChange({
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
                      id="games-house"
                      name="games_house"
                      value={formData.games_house}
                      onChange={(e) =>
                        handleFormChange({
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
                </ResponsiveFieldGrid>
              )}
              <ResponsiveFieldGrid className="mb-3">
                <div>
                  <label
                    htmlFor="district-origin"
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
                    id="district-origin"
                    name="district_origin"
                    type="text"
                    value={formData.district_origin}
                    list="district-origin-options"
                    onChange={(e) =>
                      handleFormChange({
                        district_origin: e.target.value,
                        sub_county: "",
                        parish: "",
                      })
                    }
                    className="input"
                    placeholder="e.g., Kampala"
                    maxLength={100}
                    autoComplete="address-level2"
                  />
                </div>
                <div>
                  <label
                    htmlFor="sub-county"
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
                    id="sub-county"
                    name="sub_county"
                    type="text"
                    value={formData.sub_county}
                    list="sub-county-options"
                    onChange={(e) =>
                      handleFormChange({
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
                    autoComplete="address-level3"
                  />
                </div>
              </ResponsiveFieldGrid>
              <ResponsiveFieldGrid className="mb-3">
                <div>
                  <label
                    htmlFor="parish"
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
                    id="parish"
                    name="parish"
                    type="text"
                    value={formData.parish}
                    list="parish-options"
                    onChange={(e) =>
                      handleFormChange({
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
                    autoComplete="address-level4"
                  />
                </div>
                <div>
                  <label
                    htmlFor="village"
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
                    id="village"
                    name="village"
                    type="text"
                    value={formData.village}
                    onChange={(e) =>
                      handleFormChange({
                        village: e.target.value,
                      })
                    }
                    className="input"
                    maxLength={100}
                    autoComplete="address-line2"
                  />
                </div>
              </ResponsiveFieldGrid>
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
              <ResponsiveFieldGrid>
                <div>
                  <label
                    htmlFor="leadership-role"
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
                    id="leadership-role"
                    name="leadership_role"
                    value={
                      formData.prefect_role ||
                      formData.student_council_role ||
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
                        handleFormChange({
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
                        handleFormChange({
                          student_council_role: val,
                          prefect_role: "",
                        });
                      } else {
                        handleFormChange({
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
                    htmlFor="class-monitor"
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
                      id="class-monitor"
                      name="is_class_monitor"
                      type="checkbox"
                      checked={formData.is_class_monitor}
                      onChange={(e) =>
                        handleFormChange({
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
              </ResponsiveFieldGrid>
              </div>
            </details>
            <div className="sticky bottom-0 -mx-4 mt-2 border-t border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5">
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
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
