"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import {
  GRADING_TRACKS,
  SETTING_KEYS,
  resolveTrackForClass,
  resolveLayout,
  SecondaryTrackChoice,
  ReportLayoutId,
} from "@/lib/grading-tracks";
import { logger } from "@/lib/logger";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Select, Input } from "@/components/ui/index";
import { Button } from "@/components/ui/index";

interface GradSettingsState {
  secondaryTrack: SecondaryTrackChoice;
  reportLayout: ReportLayoutId;
  loadingSecondary: boolean;
  loadingReport: boolean;
  saving: boolean;
}

const DEFAULT_STATE: GradSettingsState = {
  secondaryTrack: "new" as SecondaryTrackChoice,
  reportLayout: "uganda_classic" as ReportLayoutId,
  loadingSecondary: false,
  loadingReport: false,
  saving: false,
};

export default function GradSettingsPage() {
  const { school, user, isDemo } = useAuth();
  const toast = useToast();

  const [state, setState] = useState<GradSettingsState>(DEFAULT_STATE);

  useEffect(() => {
    if (!school?.id) return;
    async function load() {
      setState({ ...DEFAULT_STATE, loadingSecondary: true, loadingReport: true });
      try {
        const secondary = await withTimeout(
          supabase
            .from("school_settings")
            .select("value")
            .eq("school_id", school.id)
            .eq("key", SETTING_KEYS.secondaryTrack),
          10000,
          timeoutFallback(),
        );
        const secondaryValue = (secondary as { data?: any[] })?.data?.[0]?.value ?? "";
        const track = (secondaryValue === "old" ? "old" : "new") as SecondaryTrackChoice;

        const report = await withTimeout(
          supabase
            .from("school_settings")
            .select("value")
            .eq("school_id", school.id)
            .eq("key", SETTING_KEYS.reportLayout),
          10000,
          timeoutFallback(),
        );
        const reportValue = (report as { data?: any[] })?.data?.[0]?.value ?? "";
        const layout = (reportValue as ReportLayoutId) || "uganda_classic";

        setState({ secondaryTrack: track, reportLayout: layout, loadingSecondary: false, loadingReport: false });
      } catch (err) {
        logger.warn("Failed to load grading settings:", err);
        setState({ ...DEFAULT_STATE, loadingSecondary: false, loadingReport: false });
        toast.error("Could not load grading settings");
      }
    }
    load();
  }, [school?.id]);

  const handleSave = useCallback(
    async (newSecondary: SecondaryTrackChoice, newLayout: ReportLayoutId) => {
      if (state.saving) return;
      setState((s) => ({ ...s, saving: true }));
      try {
        await withTimeout(
          saveSchoolSetting(school!.id, SETTING_KEYS.secondaryTrack, newSecondary),
          10000,
          timeoutFallback(),
        );
        await withTimeout(
          saveSchoolSetting(school!.id, SETTING_KEYS.reportLayout, newLayout),
          10000,
          timeoutFallback(),
        );
        setState({
          secondaryTrack: newSecondary,
          reportLayout: newLayout,
          loadingSecondary: false,
          loadingReport: false,
          saving: false,
        });
        toast.success("Grading settings saved");
      } catch (err) {
        logger.error("Failed to save grading settings:", err);
        setState((s) => ({ ...s, saving: false, loadingSecondary: false, loadingReport: false }));
        toast.error("Failed to save grading settings");
      }
    },
    [school?.id, state.saving],
  );

  const track = resolveTrackForClass("S.2", {
    [SETTING_KEYS.secondaryTrack]: state.secondaryTrack,
  });
  const layout = resolveLayout({ [SETTING_KEYS.reportLayout]: state.reportLayout }, track);

  const trackInfo = GRADING_TRACKS[track];
  const isNew = track === "secondary_new";

  return (
    <PageHeader
      title="Grading Configuration"
      subtitle="Select the grading scheme for secondary classes and the printed report layout format"
    >
      <div className="space-y-6">
        <Card>
          <CardBody className="p-6">
            <h3 className="font-semibold mb-4">Secondary Curriculum Track</h3>
            <p className="text-sm text-gray-600 mb-4">Choose the grading scheme for secondary classes (S.1-S.4).</p>

            <Select
              value={state.secondaryTrack}
              options={[
                { value: "old", label: "Old curriculum (O-level: D1-F9, best-8 aggregate, Div I-IV)" },
                {
                  value: "new",
                  label: "New curriculum (CBC: identifiers L1-L3, formative 20%, summative 80%, A*-G scale)",
                },
              ]}
              onChange={(val) => setState((s) => ({ ...s, secondaryTrack: val as SecondaryTrackChoice }))}
              placeholder="Select track"
            />

            {trackInfo && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="font-medium text-sm mb-2">What this track assesses</h4>
                <p className="text-gray-600 text-sm line-clamp-4">{trackInfo.explain}</p>
              </div>
            )}

            {isNew && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="font-medium text-sm mb-2">Column headers on the entry screen</h4>
                {trackInfo.columns.map((col, i) => (
                  <div key={i} className="flex gap-2 text-xs text-gray-600 mb-1">
                    <span className="flex-1">{col.label}</span>
                    <span>{col.explain}</span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-6">
            <h3 className="font-semibold mb-4">Report Layout</h3>
            <p className="text-sm text-gray-600 mb-4">Choose the printed subject table format for report cards.</p>

            <Select
              value={state.reportLayout}
              options={[
                { value: "uganda_classic", label: "Uganda Classic" },
                { value: "ncdc_cbc", label: "NCDC CBC" },
              ]}
              onChange={(val) => setState((s) => ({ ...s, reportLayout: val as ReportLayoutId }))}
              placeholder="Select layout"
            />

            {trackInfo && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="font-medium text-sm mb-2">Column headers on the entry screen</h4>
                {trackInfo.columns.map((col, i) => (
                  <div key={i} className="flex gap-2 text-xs text-gray-600 mb-1">
                    <span className="flex-1">{col.label}</span>
                    <span>{col.explain}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">Layout default for this track: </p>
              <p className="font-medium text-sm">{track.defaultLayout}</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-6">
            <h3 className="font-semibold mb-4">Saved Settings</h3>
            <p className="text-sm text-gray-600">
              Secondary Track:{" "}
              <span className={state.secondaryTrack === "old" ? "text-green-600" : "text-blue-600"}>
                {state.secondaryTrack}
              </span>
            </p>
            <p className="text-sm text-gray-600">
              Report Layout:{" "}
              <span className={state.reportLayout === "ncdc_cbc" ? "text-green-600" : "text-blue-600"}>
                {state.reportLayout}
              </span>
            </p>
          </CardBody>
        </Card>

        <Button
          onClick={() => handleSave(state.secondaryTrack, state.reportLayout)}
          disabled={state.saving || !school?.id}
          className="w-full bg-indigo-600 text-white py-3"
        >
          {state.saving ? "Saving..." : "Save Grading Configuration"}
        </Button>
      </div>
    </PageHeader>
  );
}

/** Server helper: save a single school_settings key. */
async function saveSchoolSetting(schoolId: string, key: string, value: unknown): Promise<void> {
  const { error } = await supabase
    .from("school_settings")
    .upsert({ school_id: schoolId, key, value: String(value) }, { onConflict: "school_id,key" });
  if (error) throw error;
}
