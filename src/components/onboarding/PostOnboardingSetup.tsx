"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { Card, CardBody } from "@/components/ui/Card";
import { Button, Input } from "@/components/ui";

interface Props {
  onComplete?: () => void;
}

export default function PostOnboardingSetup({ onComplete }: Props) {
  const router = useRouter();
  const { school, refreshSchool } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);

  // Check what's already done
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
    setCompleted([...completed, key]);
    if (step < 5) {
      setStep(step + 1);
    } else {
      toast.success("All setup items completed!");
      onComplete?.();
    }
  };

  const skipStep = () => {
    if (step < 5) {
      setStep(step + 1);
    }
  };

  if (!school) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-[var(--bg)]/95 backdrop-blur-xl p-4 overflow-y-auto">
      <div className="max-w-2xl mx-auto mt-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[var(--primary)] flex items-center justify-center mx-auto mb-4">
            <MaterialIcon
              icon="settings_suggest"
              className="text-3xl text-white"
            />
          </div>
          <h2 className="text-2xl font-bold text-[var(--on-surface)]">
            Finish Your School Setup
          </h2>
          <p className="text-[var(--t3)] mt-2">
            Complete these steps to get the most out of SkoolMate
          </p>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`flex-1 h-2 rounded-full ${step >= s || completed.includes(["academic_calendar", "class_structure", "fee_structure", "staff_accounts", "sms_templates"][s - 1]) ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}
            />
          ))}
        </div>

        {/* Steps */}
        {step === 1 && !completed.includes("academic_calendar") && (
          <Card>
            <CardBody>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <MaterialIcon
                    icon="calendar_month"
                    className="text-blue-600 text-xl"
                  />
                </div>
                <div>
                  <h3 className="font-semibold">Academic Calendar</h3>
                  <p className="text-sm text-[var(--t3)]">
                    Set up your term dates
                  </p>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => router.push("/dashboard/settings?tab=config")}
              >
                Configure Calendar
              </Button>
              <Button
                variant="ghost"
                className="w-full mt-2"
                onClick={() => markComplete("academic_calendar")}
              >
                Skip for now
              </Button>
            </CardBody>
          </Card>
        )}

        {step === 2 && !completed.includes("class_structure") && (
          <Card>
            <CardBody>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <MaterialIcon
                    icon="school"
                    className="text-green-600 text-xl"
                  />
                </div>
                <div>
                  <h3 className="font-semibold">Class Structure</h3>
                  <p className="text-sm text-[var(--t3)]">
                    Add classes and streams
                  </p>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => router.push("/dashboard/settings?tab=config")}
              >
                Add Classes
              </Button>
              <Button
                variant="ghost"
                className="w-full mt-2"
                onClick={() => markComplete("class_structure")}
              >
                Skip for now
              </Button>
            </CardBody>
          </Card>
        )}

        {step === 3 && !completed.includes("fee_structure") && (
          <Card>
            <CardBody>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <MaterialIcon
                    icon="payments"
                    className="text-purple-600 text-xl"
                  />
                </div>
                <div>
                  <h3 className="font-semibold">Fee Structure</h3>
                  <p className="text-sm text-[var(--t3)]">
                    Set up tuition and other fees
                  </p>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => router.push("/dashboard/fees")}
              >
                Configure Fees
              </Button>
              <Button
                variant="ghost"
                className="w-full mt-2"
                onClick={() => markComplete("fee_structure")}
              >
                Skip for now
              </Button>
            </CardBody>
          </Card>
        )}

        {step === 4 && !completed.includes("staff_accounts") && (
          <Card>
            <CardBody>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <MaterialIcon
                    icon="people"
                    className="text-orange-600 text-xl"
                  />
                </div>
                <div>
                  <h3 className="font-semibold">Staff Accounts</h3>
                  <p className="text-sm text-[var(--t3)]">
                    Add teachers and staff
                  </p>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => router.push("/dashboard/settings?tab=users")}
              >
                Add Staff
              </Button>
              <Button
                variant="ghost"
                className="w-full mt-2"
                onClick={() => markComplete("staff_accounts")}
              >
                Skip for now
              </Button>
            </CardBody>
          </Card>
        )}

        {step === 5 && !completed.includes("sms_templates") && (
          <Card>
            <CardBody>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
                  <MaterialIcon icon="sms" className="text-teal-600 text-xl" />
                </div>
                <div>
                  <h3 className="font-semibold">SMS Templates</h3>
                  <p className="text-sm text-[var(--t3)]">
                    Configure parent notifications
                  </p>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => router.push("/dashboard/sms-templates")}
              >
                Set Up SMS
              </Button>
              <Button
                variant="ghost"
                className="w-full mt-2"
                onClick={() => markComplete("sms_templates")}
              >
                Skip for now
              </Button>
            </CardBody>
          </Card>
        )}

        {/* Done state */}
        {(completed.length >= 5 || step > 5) && (
          <Card>
            <CardBody className="text-center py-8">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <MaterialIcon
                  icon="check_circle"
                  className="text-4xl text-green-600"
                />
              </div>
              <h3 className="text-xl font-bold text-[var(--on-surface)]">
                Setup Complete!
              </h3>
              <p className="text-[var(--t3)] mt-2 mb-6">
                Your school is ready to use. You can always adjust settings
                later.
              </p>
              <Button onClick={onComplete}>Go to Dashboard</Button>
            </CardBody>
          </Card>
        )}

        <div className="text-center mt-6">
          <Button variant="ghost" onClick={onComplete}>
            Skip All & Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
