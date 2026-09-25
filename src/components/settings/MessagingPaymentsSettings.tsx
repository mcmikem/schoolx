"use client";
import { useCallback, useEffect, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { Button } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth-context";
import { loadSchoolSetting, saveSchoolSetting } from "@/lib/school-settings";
import { getMessagingCapability, CHANNEL_SETTING_KEY, type MessagingChannel } from "@/lib/messaging";

const TEMPLATE_KEYS = [
  { kind: "fee_reminder", label: "Fee reminder" },
  { kind: "absentee_alert", label: "Absentee alert" },
  { kind: "payment_confirmation", label: "Payment confirmation" },
  { kind: "report_card_ready", label: "Report card ready" },
] as const;

const FIELD =
  "w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-container-lowest)] text-[var(--on-surface)] text-base focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-colors";

export default function MessagingPaymentsSettings() {
  const { school } = useAuth();
  const toast = useToast();
  const schoolId = school?.id;

  const [channel, setChannel] = useState<MessagingChannel | "">("");
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [momo, setMomo] = useState("");
  const [airtel, setAirtel] = useState("");
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const capability = getMessagingCapability();

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const storedChannel = await loadSchoolSetting<string>(schoolId, CHANNEL_SETTING_KEY, "");
      setChannel(storedChannel === "whatsapp" || storedChannel === "sms" ? storedChannel : "");

      const entries = await Promise.all(
        TEMPLATE_KEYS.map(
          async ({ kind }) =>
            [kind, await loadSchoolSetting<string>(schoolId, `whatsapp_template_${kind}`, "")] as const,
        ),
      );
      setTemplates(Object.fromEntries(entries));

      const [m, a, i] = await Promise.all([
        loadSchoolSetting<string>(schoolId, "payment_momo_number", ""),
        loadSchoolSetting<string>(schoolId, "payment_airtel_number", ""),
        loadSchoolSetting<string>(schoolId, "payment_instructions", ""),
      ]);
      setMomo(m);
      setAirtel(a);
      setInstructions(i);
    } catch {
      toast.error("Could not load settings. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [schoolId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!schoolId) return;
    setSaving(true);
    try {
      if (channel) await saveSchoolSetting(schoolId, CHANNEL_SETTING_KEY, channel);
      else await saveSchoolSetting(schoolId, CHANNEL_SETTING_KEY, "");

      for (const { kind } of TEMPLATE_KEYS) {
        await saveSchoolSetting(schoolId, `whatsapp_template_${kind}`, templates[kind] ?? "");
      }

      await saveSchoolSetting(schoolId, "payment_momo_number", momo.trim());
      await saveSchoolSetting(schoolId, "payment_airtel_number", airtel.trim());
      await saveSchoolSetting(schoolId, "payment_instructions", instructions.trim());

      toast.success("Saved");
    } catch {
      toast.error("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-64 rounded-2xl bg-[var(--surface-container-low)] animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title flex items-center gap-2">
              <MaterialIcon icon="forum" className="text-[var(--primary)]" /> How parents are messaged
            </h2>
            <p className="card-sub">
              WhatsApp is far cheaper than SMS. Messages sent outside a parent&apos;s 24-hour reply window need a
              Meta-approved template.
            </p>
          </div>
        </div>
        <div className="card-body space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ChannelOption
              value="whatsapp"
              title="WhatsApp"
              subtitle="Cheapest. Recommended."
              available={capability.whatsapp}
              selected={channel === "whatsapp"}
              onSelect={() => setChannel("whatsapp")}
            />
            <ChannelOption
              value="sms"
              title="SMS"
              subtitle="Use when parents have no WhatsApp."
              available={capability.sms}
              selected={channel === "sms"}
              onSelect={() => setChannel("sms")}
            />
          </div>

          {channel === "" && (
            <p className="text-sm text-[var(--t3)]">
              No choice saved — SkoolMate will use{" "}
              <span className="font-bold text-[var(--t2)]">
                {capability.defaultChannel === "whatsapp" ? "WhatsApp" : "SMS"}
              </span>{" "}
              automatically, based on what is available.
            </p>
          )}

          {!capability.whatsapp && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-bold flex items-center gap-2">
                <MaterialIcon icon="warning" /> WhatsApp not set up yet
              </p>
              <p className="mt-1">
                Add <code className="font-mono text-xs">WHATSAPP_BUSINESS_TOKEN</code> and{" "}
                <code className="font-mono text-xs">WHATSAPP_PHONE_NUMBER_ID</code> to the deployment to enable it.
                Until then reminders fall back to SMS.
              </p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-bold text-[var(--t1)] mb-1">WhatsApp templates</h3>
            <p className="text-xs text-[var(--t3)] mb-3">
              Leave blank and messages only reach parents who messaged you in the last 24 hours. Fill these in with the
              template names you got approved by Meta.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TEMPLATE_KEYS.map(({ kind, label }) => (
                <div key={kind}>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--t3)] block mb-1.5">
                    {label}
                  </label>
                  <input
                    className={FIELD}
                    value={templates[kind] ?? ""}
                    onChange={(e) => setTemplates((prev) => ({ ...prev, [kind]: e.target.value }))}
                    placeholder="e.g. fee_reminder_v1"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title flex items-center gap-2">
              <MaterialIcon icon="account_balance" className="text-[var(--green)]" /> Where parents send money
            </h2>
            <p className="card-sub">
              Parents pay you directly, then tap &ldquo;I&apos;ve paid&rdquo;. You confirm it and their balance updates.
            </p>
          </div>
        </div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--t3)] block mb-1.5">
                MTN MoMo number
              </label>
              <input
                className={FIELD}
                value={momo}
                onChange={(e) => setMomo(e.target.value)}
                placeholder="0772 000 111"
                inputMode="tel"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--t3)] block mb-1.5">
                Airtel Money number
              </label>
              <input
                className={FIELD}
                value={airtel}
                onChange={(e) => setAirtel(e.target.value)}
                placeholder="0700 000 222"
                inputMode="tel"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--t3)] block mb-1.5">
              Instructions for parents
            </label>
            <textarea
              className={`${FIELD} min-h-[90px] resize-none`}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Use your name as the reference. School hours 8am–4pm."
            />
          </div>
          <p className="text-xs text-[var(--t3)]">
            Leave both numbers blank and parents are told to pay at the school office.
          </p>
        </div>
      </div>

      <Button onClick={save} loading={saving} className="btn btn-primary">
        Save changes
      </Button>
    </div>
  );
}

function ChannelOption({
  title,
  subtitle,
  available,
  selected,
  onSelect,
}: {
  value: string;
  title: string;
  subtitle: string;
  available: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!available}
      aria-pressed={selected}
      className={`text-left rounded-2xl border p-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
        selected
          ? "border-[var(--primary)] bg-[var(--primary-50)] ring-2 ring-[var(--primary)]/25"
          : "border-[var(--border)] hover:border-[var(--border2)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-[var(--t1)]">{title}</p>
        <span
          className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
            available ? "bg-[var(--green-soft)] text-[var(--green)]" : "bg-[var(--surface-container)] text-[var(--t4)]"
          }`}
        >
          {available ? "Ready" : "Not set up"}
        </span>
      </div>
      <p className="text-xs text-[var(--t3)] mt-1">{subtitle}</p>
    </button>
  );
}
