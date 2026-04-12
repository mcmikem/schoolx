"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { Card, CardBody } from "@/components/ui/Card";
import { Button, Input, Select } from "@/components/ui";

interface Props {
  onComplete?: () => void;
}

const SETUP_STEPS = [
  {
    key: "academic_calendar",
    title: "Academic Calendar",
    icon: "calendar_month",
    route: "/dashboard/settings?tab=config",
  },
  {
    key: "class_structure",
    title: "Classes & Streams",
    icon: "school",
    route: "/dashboard/settings?tab=config",
  },
  {
    key: "fee_structure",
    title: "Fee Structure",
    icon: "payments",
    route: "/dashboard/fees",
  },
  {
    key: "staff_accounts",
    title: "Staff Accounts",
    icon: "people",
    route: "/dashboard/settings?tab=users",
  },
  {
    key: "sms_templates",
    title: "SMS Templates",
    icon: "sms",
    route: "/dashboard/sms-templates",
  },
];

export default function PostOnboardingSetup({ onComplete }: Props) {
  const router = useRouter();
  const { school, refreshSchool } = useAuth();
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(true);
  const [completed, setCompleted] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Inline form states
  const [terms, setTerms] = useState([
    { name: "Term 1", start: "", end: "" },
    { name: "Term 2", start: "", end: "" },
    { name: "Term 3", start: "", end: "" },
  ]);
  const [classes, setClasses] = useState<{ name: string; stream: string }[]>([
    { name: "P.1", stream: "" },
    { name: "P.2", stream: "" },
    { name: "P.3", stream: "" },
  ]);
  const [fees, setFees] = useState<{ name: string; amount: string }[]>([
    { name: "Tuition", amount: "150000" },
    { name: "Development", amount: "50000" },
  ]);

  useEffect(() => {
    checkCompletedItems();
  }, [school?.id]);

  const checkCompletedItems = async () => {
    if (!school?.id) return;
    const { data } = await supabase
      .from("setup_checklist")
      .select("item_key, is_completed")
      .eq("school_id", school.id);

    if (data) {
      setCompleted(data.filter((i) => i.is_completed).map((i) => i.item_key));
    }
  };

  const markComplete = async (key: string) => {
    if (!school?.id) return;

    await supabase
      .from("setup_checklist")
      .upsert(
        {
          school_id: school.id,
          item_key: key,
          is_completed: true,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "school_id,item_key" },
      );

    setCompleted([...completed, key]);
    toast.success(`${SETUP_STEPS.find((s) => s.key === key)?.title} complete!`);
  };

  const saveTerms = async () => {
    if (!school?.id) return;
    setLoading(true);
    try {
      for (const term of terms) {
        if (term.start && term.end) {
          await supabase.from("academic_terms").upsert(
            {
              school_id: school.id,
              name: term.name,
              start_date: term.start,
              end_date: term.end,
              academic_year: new Date().getFullYear().toString(),
            },
            { onConflict: "school_id,name,academic_year" },
          );
        }
      }
      await markComplete("academic_calendar");
    } catch (err) {
      toast.error("Failed to save terms");
    } finally {
      setLoading(false);
    }
  };

  const saveClasses = async () => {
    if (!school?.id) return;
    setLoading(true);
    try {
      for (const cls of classes) {
        if (cls.name) {
          await supabase.from("classes").upsert(
            {
              school_id: school.id,
              name: cls.name,
              stream: cls.stream || null,
              level: cls.name.startsWith("P") ? "primary" : "secondary",
              academic_year: new Date().getFullYear().toString(),
            },
            { onConflict: "school_id,name,academic_year" },
          );
        }
      }
      await markComplete("class_structure");
    } catch (err) {
      toast.error("Failed to save classes");
    } finally {
      setLoading(false);
    }
  };

  const saveFees = async () => {
    if (!school?.id) return;
    setLoading(true);
    try {
      for (const fee of fees) {
        if (fee.name && parseFloat(fee.amount) > 0) {
          await supabase.from("fee_structure").upsert(
            {
              school_id: school.id,
              name: fee.name,
              amount: parseFloat(fee.amount),
              term: 1,
              academic_year: new Date().getFullYear().toString(),
            },
            { onConflict: "school_id,name,term,academic_year" },
          );
        }
      }
      await markComplete("fee_structure");
    } catch (err) {
      toast.error("Failed to save fees");
    } finally {
      setLoading(false);
    }
  };

  if (!school) return null;

  const incompleteSteps = SETUP_STEPS.filter((s) => !completed.includes(s.key));
  const progress = Math.round(
    ((SETUP_STEPS.length - incompleteSteps.length) / SETUP_STEPS.length) * 100,
  );

  return (
    <>
      {/* Collapsed State - Floating Button */}
      {!isOpen && completed.length < SETUP_STEPS.length && (
        <div className="fixed bottom-6 right-6 z-[85]">
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 px-4 py-3 bg-[var(--primary)] text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            <MaterialIcon icon="settings_suggest" />
            <span className="font-medium">Setup ({progress}%)</span>
          </button>
        </div>
      )}

      {/* Slide-over Panel */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-[85] w-full max-w-md bg-white shadow-2xl transform transition-transform duration-300">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-[var(--surface-container)]">
            <div>
              <h2 className="font-bold text-[var(--on-surface)]">
                School Setup
              </h2>
              <p className="text-sm text-[var(--t3)]">{progress}% complete</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-full hover:bg-[var(--surface-container-high)]"
            >
              <MaterialIcon icon="close" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="h-1 bg-[var(--border)]">
            <div
              className="h-full bg-[var(--primary)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto h-[calc(100vh-120px)] space-y-4">
            {incompleteSteps.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <MaterialIcon
                    icon="check_circle"
                    className="text-3xl text-green-600"
                  />
                </div>
                <h3 className="font-bold text-lg mb-2">All Done! 🎉</h3>
                <p className="text-[var(--t3)] mb-6">
                  Your school is ready to use.
                </p>
                <Button onClick={onComplete} className="w-full">
                  Go to Dashboard
                </Button>
                <Button
                  variant="ghost"
                  className="w-full mt-2"
                  onClick={() => setIsOpen(false)}
                >
                  Keep exploring
                </Button>
              </div>
            ) : (
              incompleteSteps.map((step, idx) => (
                <Card
                  key={step.key}
                  className={idx === 0 ? "ring-2 ring-[var(--primary)]" : ""}
                >
                  <CardBody className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-[var(--primary-soft)] flex items-center justify-center">
                        <MaterialIcon
                          icon={step.icon}
                          className="text-[var(--primary)]"
                        />
                      </div>
                      <div>
                        <h3 className="font-semibold">{step.title}</h3>
                        <p className="text-xs text-[var(--t3)]">
                          {idx === 0 ? "Required" : "Optional"}
                        </p>
                      </div>
                    </div>

                    {/* Inline Forms */}
                    {idx === 0 && step.key === "academic_calendar" && (
                      <div className="space-y-3 mb-4">
                        {terms.map((term, i) => (
                          <div key={i} className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={term.name}
                              readOnly
                              className="input text-sm bg-gray-50"
                            />
                            <input
                              type="date"
                              value={term.start}
                              onChange={(e) => {
                                const newTerms = [...terms];
                                newTerms[i].start = e.target.value;
                                setTerms(newTerms);
                              }}
                              className="input text-sm"
                              placeholder="Start"
                            />
                          </div>
                        ))}
                        <Button
                          size="sm"
                          onClick={saveTerms}
                          loading={loading}
                          className="w-full"
                        >
                          Save Terms
                        </Button>
                      </div>
                    )}

                    {idx === 0 && step.key === "class_structure" && (
                      <div className="space-y-3 mb-4">
                        {classes.map((cls, i) => (
                          <div key={i} className="flex gap-2">
                            <input
                              type="text"
                              value={cls.name}
                              onChange={(e) => {
                                const newClasses = [...classes];
                                newClasses[i].name = e.target.value;
                                setClasses(newClasses);
                              }}
                              className="input text-sm flex-1"
                              placeholder="Class (e.g., P.1)"
                            />
                            <input
                              type="text"
                              value={cls.stream}
                              onChange={(e) => {
                                const newClasses = [...classes];
                                newClasses[i].stream = e.target.value;
                                setClasses(newClasses);
                              }}
                              className="input text-sm flex-1"
                              placeholder="Stream (optional)"
                            />
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setClasses([...classes, { name: "", stream: "" }])
                          }
                          className="w-full"
                        >
                          <MaterialIcon icon="add" className="text-sm" /> Add
                          Class
                        </Button>
                        <Button
                          size="sm"
                          onClick={saveClasses}
                          loading={loading}
                          className="w-full"
                        >
                          Save Classes
                        </Button>
                      </div>
                    )}

                    {idx === 0 && step.key === "fee_structure" && (
                      <div className="space-y-3 mb-4">
                        {fees.map((fee, i) => (
                          <div key={i} className="flex gap-2">
                            <input
                              type="text"
                              value={fee.name}
                              onChange={(e) => {
                                const newFees = [...fees];
                                newFees[i].name = e.target.value;
                                setFees(newFees);
                              }}
                              className="input text-sm flex-1"
                              placeholder="Fee name"
                            />
                            <input
                              type="number"
                              value={fee.amount}
                              onChange={(e) => {
                                const newFees = [...fees];
                                newFees[i].amount = e.target.value;
                                setFees(newFees);
                              }}
                              className="input text-sm w-28"
                              placeholder="UGX"
                            />
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setFees([...fees, { name: "", amount: "" }])
                          }
                          className="w-full"
                        >
                          <MaterialIcon icon="add" className="text-sm" /> Add
                          Fee
                        </Button>
                        <Button
                          size="sm"
                          onClick={saveFees}
                          loading={loading}
                          className="w-full"
                        >
                          Save Fees
                        </Button>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {idx > 0 && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => router.push(step.route)}
                        >
                          Configure
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => markComplete(step.key)}
                        >
                          Skip
                        </Button>
                      </div>
                    )}
                  </CardBody>
                </Card>
              ))
            )}

            {/* Skip All */}
            {incompleteSteps.length > 0 && (
              <div className="pt-4 border-t">
                <Button
                  variant="ghost"
                  className="w-full text-[var(--t3)]"
                  onClick={() => {
                    setIsOpen(false);
                    onComplete?.();
                  }}
                >
                  Skip all for now
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backdrop when open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[84] bg-black/20"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
