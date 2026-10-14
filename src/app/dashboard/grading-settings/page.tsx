"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { useToast } from "@/components/Toast";
import { Card, CardBody } from "@/components/ui/Card";
import { Button, Select } from "@/components/ui/index";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/auth-context";
import { GRADING_TRACKS, SETTING_KEYS, type SecondaryTrackChoice, type ReportLayoutId } from "@/lib/grading-tracks";
import { withTimeout, timeoutFallback, isTimeoutResult } from "@/lib/hooks/utils";
import { clearSchoolSettingsCache } from "@/lib/school-settings";
import { supabase } from "@/lib/supabase";

export default function GradingSettingsPage() {
  const { school, isDemo } = useAuth();
  const toast = useToast();
  const [secondaryTrack, setSecondaryTrack] = useState<SecondaryTrackChoice>("new");
  const [reportLayout, setReportLayout] = useState<ReportLayoutId>("uganda_classic");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [saved, setSaved] = useState({ secondaryTrack: "new", reportLayout: "uganda_classic" });
  const dirty = saved.secondaryTrack !== secondaryTrack || saved.reportLayout !== reportLayout;
  const trackInfo = GRADING_TRACKS[secondaryTrack === "old" ? "secondary_old" : "secondary_new"];

  useEffect(() => {
    let cancelled = false;
    const schoolId = school?.id;
    if (!schoolId) {
      setLoading(false);
      return;
    }
    async function load() {
      setLoading(true);
      setError("");
      try {
        let settings: Record<string, string> = {};
        if (isDemo) {
          settings = JSON.parse(sessionStorage.getItem("demo-grading-settings") || "{}");
        } else {
          const result = await withTimeout(
            supabase
              .from("school_settings")
              .select("key, value")
              .eq("school_id", schoolId)
              .in("key", [SETTING_KEYS.secondaryTrack, SETTING_KEYS.reportLayout]),
            10000,
            timeoutFallback(),
          );
          if (isTimeoutResult(result)) throw new Error("Loading settings timed out. Please try again.");
          if (result.error) throw result.error;
          settings = Object.fromEntries(
            (result.data || []).map((row: { key: string; value: string }) => [row.key, row.value]),
          );
        }
        if (cancelled) return;
        const secondary = settings[SETTING_KEYS.secondaryTrack] === "old" ? "old" : "new";
        const layout = settings[SETTING_KEYS.reportLayout] === "ncdc_cbc" ? "ncdc_cbc" : "uganda_classic";
        setSecondaryTrack(secondary);
        setReportLayout(layout);
        setSaved({ secondaryTrack: secondary, reportLayout: layout });
      } catch (failure) {
        if (!cancelled) setError(failure instanceof Error ? failure.message : "Could not load grading settings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [school?.id, isDemo, reload]);

  const save = async () => {
    if (!school?.id || saving || loading || error) return;
    setSaving(true);
    try {
      const settings = { [SETTING_KEYS.secondaryTrack]: secondaryTrack, [SETTING_KEYS.reportLayout]: reportLayout };
      if (isDemo) {
        sessionStorage.setItem("demo-grading-settings", JSON.stringify(settings));
      } else {
        const result = await withTimeout(
          supabase.from("school_settings").upsert(
            Object.entries(settings).map(([key, value]) => ({ school_id: school.id, key, value })),
            { onConflict: "school_id,key" },
          ),
          10000,
          timeoutFallback(),
        );
        if (isTimeoutResult(result)) throw new Error("Saving settings timed out. Please try again.");
        if (result.error) throw result.error;
        clearSchoolSettingsCache(school.id);
      }
      setSaved({ secondaryTrack, reportLayout });
      toast.success(isDemo ? "Demo grading settings saved for this session" : "Grading settings saved");
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "Could not save grading settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 min-w-0 p-4 sm:p-6 pb-24 sm:pb-6">
      <PageHeader
        title="Grading Configuration"
        subtitle="Choose the secondary curriculum and printed report format."
        actions={
          <Button onClick={save} disabled={saving || loading || Boolean(error) || !dirty}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        }
      />
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/dashboard/grades/" className="text-primary underline underline-offset-4">
          Enter marks
        </Link>
        <Link href="/dashboard/report-cards/" className="text-primary underline underline-offset-4">
          Report cards
        </Link>
      </div>
      {loading ? (
        <TableSkeleton rows={5} />
      ) : error ? (
        <div role="alert" className="rounded-xl bg-[var(--error-container)] p-4">
          <p>{error}</p>
          <Button variant="ghost" onClick={() => setReload((previous) => previous + 1)}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardBody className="space-y-4 p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <MaterialIcon icon="school" className="text-primary text-2xl" />
                  <h2 className="font-semibold text-lg">Secondary curriculum</h2>
                </div>
                <Select
                  label="Curriculum track"
                  value={secondaryTrack}
                  disabled={saving}
                  onChange={(event) => setSecondaryTrack(event.target.value as SecondaryTrackChoice)}
                  options={[
                    { value: "old", label: "Old curriculum · O/A-level" },
                    { value: "new", label: "New curriculum · CBC" },
                  ]}
                />
                <p className="text-sm leading-relaxed text-[var(--t3)]">{trackInfo.explain}</p>
                <div className="rounded-xl bg-[var(--surface-container-low)] p-4 text-sm text-[var(--t3)]">
                  Nursery and primary retain their own grading schemes. This choice applies to secondary classes.
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="space-y-4 p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <MaterialIcon icon="description" className="text-primary text-2xl" />
                  <h2 className="font-semibold text-lg">Printed reports</h2>
                </div>
                <Select
                  label="Report layout"
                  value={reportLayout}
                  disabled={saving}
                  onChange={(event) => setReportLayout(event.target.value as ReportLayoutId)}
                  options={[
                    { value: "uganda_classic", label: "Uganda Classic" },
                    { value: "ncdc_cbc", label: "NCDC CBC" },
                  ]}
                />
                <p className="text-sm leading-relaxed text-[var(--t3)]">
                  {reportLayout === "ncdc_cbc"
                    ? "Competency-based report with formative and summative results."
                    : "Traditional report with subject marks, grades and teacher comments."}
                </p>
                <p className="text-sm text-[var(--t3)]">
                  Suggested for this track: {trackInfo.defaultLayout === "ncdc_cbc" ? "NCDC CBC" : "Uganda Classic"}
                </p>
              </CardBody>
            </Card>
          </div>
          <Card>
            <CardBody className="space-y-4 p-4 sm:p-6">
              <h2 className="font-semibold text-lg">Assessment guide</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {trackInfo.columns.map((column) => (
                  <div key={column.label} className="rounded-xl border border-[var(--border)] p-4">
                    <h3 className="font-semibold text-primary">{column.label}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--t3)]">{column.explain}</p>
                  </div>
                ))}
              </div>
              <p role="status" className="text-sm text-[var(--t3)]">
                {dirty ? "Unsaved changes — save to apply this configuration." : "Configuration is up to date."}
              </p>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
