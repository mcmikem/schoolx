"use client";
import { useCallback, useEffect, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { Button } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth-context";

type Provider = "mtn" | "airtel";
type Environment = "sandbox" | "production";
type ProviderStatus = { configured: boolean; enabled: boolean; environment: Environment; verifiedAt: string | null };
type ProviderStatuses = Record<Provider, ProviderStatus>;

const EMPTY_STATUS: ProviderStatus = { configured: false, enabled: false, environment: "sandbox", verifiedAt: null };
const FIELD =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-container-lowest)] px-4 py-3 text-base text-[var(--on-surface)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]";
const PAYMENT_CALLBACK_URL = `${(process.env.NEXT_PUBLIC_APP_URL || "https://skoolmate.omuto.org").replace(/\/+$/, "")}/api/payment/webhook/parent-mobile-money/`;

const PROVIDERS: Array<{ id: Provider; title: string; description: string }> = [
  { id: "mtn", title: "MTN MoMo", description: "Collect from parent MTN MoMo wallets." },
  { id: "airtel", title: "Airtel Money", description: "Collect from parent Airtel Money wallets." },
];

export default function SchoolMobileMoneySettings() {
  const { school } = useAuth();
  const toast = useToast();
  const [statuses, setStatuses] = useState<ProviderStatuses>({ mtn: EMPTY_STATUS, airtel: EMPTY_STATUS });
  const [encryptionReady, setEncryptionReady] = useState(false);
  const [environment, setEnvironment] = useState<Record<Provider, Environment>>({ mtn: "sandbox", airtel: "sandbox" });
  const [callbackConfirmed, setCallbackConfirmed] = useState<Record<Provider, boolean>>({ mtn: false, airtel: false });
  const [credentials, setCredentials] = useState<Record<Provider, Record<string, string>>>({
    mtn: { subscriptionKey: "", userId: "", credentialToken: "" },
    airtel: { clientId: "", clientSecret: "" },
  });
  const [busy, setBusy] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!school?.id) return;
    setLoading(true);
    try {
      const response = await fetch("/api/settings/mobile-money/", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result?.success) throw new Error(result?.error || "Could not load payment setup.");
      const data = result.data as { providers?: Partial<ProviderStatuses>; encryptionReady?: boolean };
      setStatuses({
        mtn: { ...EMPTY_STATUS, ...data.providers?.mtn },
        airtel: { ...EMPTY_STATUS, ...data.providers?.airtel },
      });
      setEncryptionReady(Boolean(data.encryptionReady));
      setEnvironment({
        mtn: data.providers?.mtn?.environment ?? "sandbox",
        airtel: data.providers?.airtel?.environment ?? "sandbox",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load payment setup.");
    } finally {
      setLoading(false);
    }
  }, [school?.id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (provider: Provider, action: "test" | "save" | "disable") => {
    setBusy(provider);
    try {
      const response = await fetch("/api/settings/mobile-money/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          action,
          environment: environment[provider],
          enableLive: action === "save" && environment[provider] === "production",
          callbackConfigurationConfirmed: callbackConfirmed[provider],
          credentials: credentials[provider],
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.success) throw new Error(result?.error || "Payment setup failed.");
      if (action === "test") {
        toast.success("Connection verified. No money was requested.");
      } else if (action === "disable") {
        toast.success("In-app collections turned off.");
      } else {
        toast.success(result.message || "Payment provider saved.");
        setCredentials((current) => ({
          ...current,
          [provider]: Object.fromEntries(Object.keys(current[provider]).map((key) => [key, ""])),
        }));
      }
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment setup failed.");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="h-52 animate-pulse rounded-2xl bg-[var(--surface-container-low)]" />;

  return (
    <section className="card" aria-labelledby="school-mobile-money-title">
      <div className="card-header">
        <div>
          <h2 id="school-mobile-money-title" className="card-title flex items-center gap-2">
            <MaterialIcon icon="payments" className="text-[var(--primary)]" /> In-app mobile money
          </h2>
          <p className="card-sub">
            Connect this school&apos;s merchant account. Parents can request a phone payment for fees or a
            learner&apos;s canteen wallet. SkoolMate credits balances only after the provider confirms the exact
            payment.
          </p>
        </div>
      </div>

      <div className="card-body space-y-5">
        {!encryptionReady && (
          <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            Secure storage is not ready on this server. An administrator must configure the payment credential
            encryption key before merchant details can be saved.
          </div>
        )}

        {PROVIDERS.map(({ id, title, description }) => {
          const providerStatus = statuses[id];
          const fields =
            id === "mtn"
              ? [
                  { name: "subscriptionKey", label: "Collection subscription key", type: "password" },
                  { name: "userId", label: "MTN User ID", type: "text" },
                  { name: "credentialToken", label: "MTN credential token", type: "password" },
                ]
              : [
                  { name: "clientId", label: "Airtel client ID", type: "text" },
                  { name: "clientSecret", label: "Airtel client secret", type: "password" },
                ];

          return (
            <div
              key={id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-container-lowest)] p-4 sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-bold text-[var(--on-surface)]">{title}</h3>
                  <p className="mt-1 text-sm text-[var(--on-surface-variant)]">{description}</p>
                </div>
                <span
                  className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                    providerStatus.enabled
                      ? "bg-emerald-100 text-emerald-800"
                      : providerStatus.configured
                        ? "bg-amber-100 text-amber-900"
                        : "bg-[var(--surface-container)] text-[var(--on-surface-variant)]"
                  }`}
                >
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-current" />
                  {providerStatus.enabled
                    ? "Live for parents"
                    : providerStatus.configured
                      ? "Saved, not live"
                      : "Not connected"}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {fields.map((field) => (
                  <label key={field.name} className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
                      {field.label}
                    </span>
                    <input
                      className={FIELD}
                      type={field.type}
                      autoComplete="new-password"
                      value={credentials[id][field.name] || ""}
                      onChange={(event) =>
                        setCredentials((current) => ({
                          ...current,
                          [id]: { ...current[id], [field.name]: event.target.value },
                        }))
                      }
                      placeholder={
                        providerStatus.configured ? "Leave blank to keep saved value" : "Enter provider credential"
                      }
                      disabled={!encryptionReady || busy === id}
                    />
                  </label>
                ))}
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
                    Provider environment
                  </span>
                  <select
                    className={FIELD}
                    value={environment[id]}
                    onChange={(event) =>
                      setEnvironment((current) => ({ ...current, [id]: event.target.value as Environment }))
                    }
                    disabled={busy === id}
                  >
                    <option value="sandbox">Sandbox (test only)</option>
                    <option value="production">Production (real payments)</option>
                  </select>
                </label>
              </div>

              <p className="mt-3 text-xs leading-5 text-[var(--on-surface-variant)]">
                Credentials are encrypted before they are stored and never sent back to the browser. The connection test
                only requests an access token; it does not debit a parent.
              </p>

              {environment[id] === "production" && (
                <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-container-low)] p-3">
                  <p className="text-xs font-bold text-[var(--on-surface)]">Required payment callback</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <code className="min-w-0 flex-1 break-all text-xs text-[var(--on-surface-variant)]">
                      {PAYMENT_CALLBACK_URL}
                    </code>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        void navigator.clipboard?.writeText(PAYMENT_CALLBACK_URL);
                        toast.success("Callback URL copied");
                      }}
                    >
                      Copy URL
                    </Button>
                  </div>
                  <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-[var(--on-surface-variant)]">
                    <input
                      type="checkbox"
                      checked={callbackConfirmed[id]}
                      onChange={(event) =>
                        setCallbackConfirmed((current) => ({ ...current, [id]: event.target.checked }))
                      }
                      className="mt-1"
                    />
                    <span>I registered this callback with the provider&apos;s merchant account for this school.</span>
                  </label>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!encryptionReady || busy !== null}
                  loading={busy === id}
                  onClick={() => void submit(id, "test")}
                >
                  Test connection
                </Button>
                <Button
                  type="button"
                  disabled={!encryptionReady || busy !== null}
                  loading={busy === id}
                  onClick={() => void submit(id, "save")}
                >
                  <MaterialIcon icon={environment[id] === "production" ? "verified_user" : "save"} />
                  {environment[id] === "production" ? "Save and enable live payments" : "Save sandbox setup"}
                </Button>
                {providerStatus.enabled && (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy !== null}
                    loading={busy === id}
                    onClick={() => void submit(id, "disable")}
                  >
                    Turn off
                  </Button>
                )}
              </div>

              {providerStatus.verifiedAt && (
                <p className="mt-3 text-xs text-[var(--on-surface-variant)]">
                  Last connection check: {new Date(providerStatus.verifiedAt).toLocaleString()}
                </p>
              )}
            </div>
          );
        })}

        <p className="text-xs leading-5 text-[var(--on-surface-variant)]">
          Each network must be approved for collections by its provider and connected to this school&apos;s merchant
          account. Sandbox credentials never appear as a payment option to parents.
        </p>
      </div>
    </section>
  );
}
