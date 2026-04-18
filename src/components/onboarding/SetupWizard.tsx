"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { Card, CardBody } from "@/components/ui/Card";
import { Button, Input, Select } from "@/components/ui";
import { buildUgandaAcademicTerms } from "@/lib/uganda-school-calendar";
import {
  getDefaultClassTemplates,
  inferClassLevel,
  type SchoolSetupType,
} from "@/lib/school-setup";
import { saveSchoolSetting } from "@/lib/school-settings";
import { getErrorMessage } from "@/lib/validation";

interface SetupWizardProps {
  onComplete?: () => void;
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const { school, refreshSchool } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const schoolType = ((school as any)?.school_type || "primary") as SchoolSetupType;
  const currentYear = new Date().getFullYear().toString();

  // Academic Year State
  const [academicYear, setAcademicYear] = useState(() => ({
    year: currentYear,
    terms: buildUgandaAcademicTerms("preview", currentYear).map((term) => ({
      name: term.name,
      start: term.start_date,
      end: term.end_date,
    })),
  }));

  // Class Setup State
  const [classes, setClasses] = useState(() =>
    getDefaultClassTemplates(schoolType),
  );

  useEffect(() => {
    const year = academicYear.year || currentYear;
    setClasses(getDefaultClassTemplates(schoolType));
    setAcademicYear((prev) => ({
      ...prev,
      year,
      terms: buildUgandaAcademicTerms(school?.id || "preview", year).map(
        (term) => ({
          name: term.name,
          start: term.start_date,
          end: term.end_date,
        }),
      ),
    }));
  }, [academicYear.year, currentYear, school?.id, schoolType]);

  // Fee Setup State
  const [fees, setFees] = useState([
    { name: "Tuition", amount: 150000, term: 1 },
  ]);

  // Staff Setup State
  const [staff, setStaff] = useState([
    { name: "", phone: "", role: "teacher" },
  ]);

  // SMS Templates State
  const [smsTemplates, setSmsTemplates] = useState([
    {
      id: "absentee",
      name: "Absent Alert",
      body: "Dear Parent, {student_name} was absent today. Please contact the school.",
    },
    {
      id: "fee_reminder",
      name: "Fee Reminder",
      body: "Dear Parent, {student_name} has a fee balance of {balance}. Please pay to avoid penalties.",
    },
  ]);

  const saveAcademicYear = async () => {
    if (!school?.id) return;
    setLoading(true);
    try {
      const termRows = buildUgandaAcademicTerms(
        school.id,
        academicYear.year,
      ).map((term, index) => ({
        ...term,
        start_date: academicYear.terms[index]?.start || term.start_date,
        end_date: academicYear.terms[index]?.end || term.end_date,
      }));

          await Promise.all([
            saveSchoolSetting(school.id, "academic_year", academicYear.year),
            saveSchoolSetting(school.id, "current_term", "1"),
          ]);

      const { error: termError } = await supabase.from("academic_terms").upsert(termRows, {
        onConflict: "school_id,academic_year,term_number",
      });
      if (termError) throw termError;

      // Update checklist
      const { error: checklistError } = await supabase.from("setup_checklist").upsert(
        {
          school_id: school.id,
          item_key: "academic_calendar",
          item_label: "Academic Calendar",
          is_completed: true,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "school_id,item_key" },
      );
      if (checklistError) throw checklistError;

      toast.success("Academic year saved!");
      setStep(2);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save academic year"));
    } finally {
      setLoading(false);
    }
  };

  const saveClasses = async () => {
    if (!school?.id) return;
    setLoading(true);
    try {
      const classData = classes.map((c) => ({
        school_id: school.id,
        name: c.name,
        level: c.level,
        stream: c.stream || null,
        academic_year: academicYear.year,
      }));

      const { error: classError } = await supabase
        .from("classes")
        .upsert(classData, { onConflict: "school_id,name,academic_year" });

      if (classError) {
        console.error("Class insert error:", classError);
        toast.error(`Failed to save classes: ${classError.message}`);
        setLoading(false);
        return;
      }

      const { error: checklistError } = await supabase
        .from("setup_checklist")
        .upsert(
          {
            school_id: school.id,
            item_key: "class_structure",
            item_label: "Class & Stream Setup",
            is_completed: true,
            completed_at: new Date().toISOString(),
          },
          { onConflict: "school_id,item_key" },
        );

      if (checklistError) {
        console.error("Checklist update error:", checklistError);
      }

      toast.success("Classes created!");
      setStep(3);
    } catch (err: unknown) {
      console.error("Save classes exception:", err);
      toast.error(getErrorMessage(err, "Failed to save classes"));
    } finally {
      setLoading(false);
    }
  };

  const saveFees = async () => {
    if (!school?.id) return;
    setLoading(true);
    try {
      const feeData = fees.map((f) => ({
        school_id: school.id,
        name: f.name,
        amount: f.amount,
        term: f.term,
        academic_year: academicYear.year,
      }));

      const { error: feeError } = await supabase
        .from("fee_structure")
        .insert(feeData);

      if (feeError) {
        console.error("Fee insert error:", feeError);
        toast.error(`Failed to save fees: ${feeError.message}`);
        setLoading(false);
        return;
      }

      const { error: checklistError } = await supabase
        .from("setup_checklist")
        .upsert(
          {
            school_id: school.id,
            item_key: "fee_structure",
            item_label: "Fee Structure",
            is_completed: true,
            completed_at: new Date().toISOString(),
          },
          { onConflict: "school_id,item_key" },
        );

      if (checklistError) {
        console.error("Checklist update error:", checklistError);
      }

      toast.success("Fee structure saved!");
      await refreshSchool();
      setStep(4);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save fee structure"));
    } finally {
      setLoading(false);
    }
  };

  const saveStaff = async () => {
    if (!school?.id) return;
    setLoading(true);
    try {
      let createdCount = 0;
      const failures: string[] = [];

      for (const s of staff) {
        if (!s.name || !s.phone) continue;

        const digitsOnly = s.phone.replace(/\D/g, "");
        const defaultPassword = `Welcome${digitsOnly.slice(-4) || "1234"}`;

        const response = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolId: school.id,
            fullName: s.name,
            phone: s.phone,
            password: defaultPassword,
            role: s.role,
          }),
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
          failures.push(`${s.name}: ${result.error || "Failed to create staff account"}`);
          continue;
        }

        createdCount += 1;
      }

      if (createdCount === 0 && failures.length > 0) {
        throw new Error(failures[0]);
      }

      const { error: checklistError } = await supabase
        .from("setup_checklist")
        .upsert(
          {
            school_id: school.id,
            item_key: "staff_accounts",
            item_label: "Staff Accounts",
            is_completed: true,
            completed_at: new Date().toISOString(),
          },
          { onConflict: "school_id,item_key" },
        );

      if (checklistError) {
        console.error("Checklist update error:", checklistError);
      }

      if (failures.length > 0) {
        toast.error(`Created ${createdCount} staff account(s), ${failures.length} failed`);
      } else {
        toast.success("Staff accounts created!");
      }
      setStep(5);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save staff accounts"));
    } finally {
      setLoading(false);
    }
  };

  const saveSmsTemplates = async () => {
    if (!school?.id) return;
    setLoading(true);
    try {
      const { error: templateError } = await supabase.from("sms_templates").upsert(
        smsTemplates.map((t) => ({
          school_id: school.id,
          id: t.id,
          name: t.name,
          body: t.body,
          category: t.id === "absentee" ? "Attendance" : "Finance",
        })),
        { onConflict: "school_id,id" },
      );

      if (templateError) throw templateError;

      const { error: checklistError } = await supabase.from("setup_checklist").upsert(
        {
          school_id: school.id,
          item_key: "sms_templates",
          item_label: "SMS Templates",
          is_completed: true,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "school_id,item_key" },
      );
      if (checklistError) throw checklistError;

      toast.success("SMS templates saved!");
      await refreshSchool();
      onComplete?.();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save SMS templates"));
    } finally {
      setLoading(false);
    }
  };

  const addStaff = () =>
    setStaff([...staff, { name: "", phone: "", role: "teacher" }]);
  const removeStaff = (i: number) =>
    setStaff(staff.filter((_, idx) => idx !== i));
  const updateStaff = (i: number, field: string, value: string) => {
    const newStaff = [...staff];
    newStaff[i] = { ...newStaff[i], [field]: value };
    setStaff(newStaff);
  };

  const addClass = () =>
    setClasses([
      ...classes,
      {
        name: "",
        level: schoolType === "secondary" ? "S.1" : "P.1",
        stream: "",
      },
    ]);
  const removeClass = (i: number) =>
    setClasses(classes.filter((_, idx) => idx !== i));
  const updateClass = (i: number, field: string, value: string) => {
    const newClasses = [...classes];
    newClasses[i] = { ...newClasses[i], [field]: value };
    setClasses(newClasses);
  };

  const addFee = () => setFees([...fees, { name: "", amount: 0, term: 1 }]);
  const removeFee = (i: number) => setFees(fees.filter((_, idx) => idx !== i));
  const updateFee = (i: number, field: string, value: any) => {
    const newFees = [...fees];
    newFees[i] = { ...newFees[i], [field]: value };
    setFees(newFees);
  };

  if (!school) return null;

  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-[var(--on-surface)]">
            Quick School Setup
          </h3>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`flex-1 h-2 rounded-full ${step >= s ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}
              />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h4 className="font-medium text-[var(--on-surface)]">
              Academic Year
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[var(--t3)] mb-1 block">
                  Year
                </label>
                <Input
                  value={academicYear.year}
                  onChange={(e) =>
                    setAcademicYear({ ...academicYear, year: e.target.value })
                  }
                  placeholder="2025"
                />
              </div>
            </div>
            {academicYear.terms.map((term, i) => (
              <div key={i} className="grid grid-cols-3 gap-2">
                <Input value={term.name} disabled className="bg-slate-100" />
                <Input
                  type="date"
                  value={term.start}
                  onChange={(e) => {
                    const newTerms = [...academicYear.terms];
                    newTerms[i].start = e.target.value;
                    setAcademicYear({ ...academicYear, terms: newTerms });
                  }}
                />
                <Input
                  type="date"
                  value={term.end}
                  onChange={(e) => {
                    const newTerms = [...academicYear.terms];
                    newTerms[i].end = e.target.value;
                    setAcademicYear({ ...academicYear, terms: newTerms });
                  }}
                />
              </div>
            ))}
            <Button
              onClick={saveAcademicYear}
              loading={loading}
              className="w-full"
            >
              Save & Continue
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-medium text-[var(--on-surface)]">Classes</h4>
              <Button size="sm" variant="ghost" onClick={addClass}>
                <MaterialIcon icon="add" /> Add
              </Button>
            </div>
            {classes.map((cls, i) => (
              <div key={i} className="flex gap-2">
                <select
                  value={cls.name}
                  onChange={(e) => {
                    updateClass(i, "name", e.target.value);
                    updateClass(
                      i,
                      "level",
                      inferClassLevel(e.target.value, schoolType),
                    );
                  }}
                  className="flex-1 input"
                >
                  <option value="">Select Class</option>
                  {[
                    "P.1",
                    "P.2",
                    "P.3",
                    "P.4",
                    "P.5",
                    "P.6",
                    "P.7",
                    "S.1",
                    "S.2",
                    "S.3",
                    "S.4",
                    "S.5",
                    "S.6",
                  ].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  value={cls.level}
                  onChange={(e) => updateClass(i, "level", e.target.value)}
                  className="w-32 input"
                >
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                </select>
                <Input
                  placeholder="Stream (A/B)"
                  value={cls.stream}
                  onChange={(e) => updateClass(i, "stream", e.target.value)}
                  className="w-24"
                />
                {classes.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeClass(i)}
                  >
                    <MaterialIcon icon="close" />
                  </Button>
                )}
              </div>
            ))}
            <Button onClick={saveClasses} loading={loading} className="w-full">
              Save & Continue
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-medium text-[var(--on-surface)]">
                Fee Structure (UGX)
              </h4>
              <Button size="sm" variant="ghost" onClick={addFee}>
                <MaterialIcon icon="add" /> Add
              </Button>
            </div>
            {fees.map((fee, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="Fee Name"
                  value={fee.name}
                  onChange={(e) => updateFee(i, "name", e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  placeholder="Amount"
                  value={fee.amount}
                  onChange={(e) =>
                    updateFee(i, "amount", parseInt(e.target.value))
                  }
                  className="w-32"
                />
                <select
                  value={fee.term}
                  onChange={(e) =>
                    updateFee(i, "term", parseInt(e.target.value))
                  }
                  className="w-24 input"
                >
                  <option value={1}>Term 1</option>
                  <option value={2}>Term 2</option>
                  <option value={3}>Term 3</option>
                </select>
                {fees.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeFee(i)}
                  >
                    <MaterialIcon icon="close" />
                  </Button>
                )}
              </div>
            ))}
            <Button onClick={saveFees} loading={loading} className="w-full">
              Save & Continue
            </Button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-medium text-[var(--on-surface)]">
                Staff Accounts
              </h4>
              <Button size="sm" variant="ghost" onClick={addStaff}>
                <MaterialIcon icon="add" /> Add
              </Button>
            </div>
            <p className="text-sm text-[var(--t3)]">
              Add teachers and staff. They'll receive login details via SMS.
            </p>
            {staff.map((s, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="Full Name"
                  value={s.name}
                  onChange={(e) => updateStaff(i, "name", e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Phone"
                  value={s.phone}
                  onChange={(e) => updateStaff(i, "phone", e.target.value)}
                  className="w-32"
                />
                <select
                  value={s.role}
                  onChange={(e) => updateStaff(i, "role", e.target.value)}
                  className="input w-32"
                >
                  <option value="teacher">Teacher</option>
                  <option value="school_admin">Admin</option>
                  <option value="bursar">Bursar</option>
                </select>
                {staff.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeStaff(i)}
                  >
                    <MaterialIcon icon="close" />
                  </Button>
                )}
              </div>
            ))}
            <Button onClick={saveStaff} loading={loading} className="w-full">
              Save & Continue
            </Button>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h4 className="font-medium text-[var(--on-surface)]">
              SMS Templates
            </h4>
            <p className="text-sm text-[var(--t3)]">
              Pre-configured messages for parents.
            </p>
            {smsTemplates.map((t, i) => (
              <div
                key={i}
                className="p-4 bg-[var(--surface-container)] rounded-xl"
              >
                <Input
                  value={t.name}
                  onChange={(e) => {
                    const newTemplates = [...smsTemplates];
                    newTemplates[i].name = e.target.value;
                    setSmsTemplates(newTemplates);
                  }}
                  className="mb-2 font-medium"
                />
                <textarea
                  value={t.body}
                  onChange={(e) => {
                    const newTemplates = [...smsTemplates];
                    newTemplates[i].body = e.target.value;
                    setSmsTemplates(newTemplates);
                  }}
                  className="w-full input h-20 text-sm"
                  placeholder="Message template..."
                />
              </div>
            ))}
            <Button
              onClick={saveSmsTemplates}
              loading={loading}
              className="w-full"
            >
              Complete Setup
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
