"use client";
import { useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import type { AutoPlannerConfig } from "@/lib/syllabus-planner-utils";

interface AutoPlannerPanelProps {
  config: Partial<AutoPlannerConfig>;
  onConfigUpdate: (updates: Partial<AutoPlannerConfig>) => Promise<any>;
  onGeneratePlans: () => Promise<void>;
  isGenerating: boolean;
}

export default function AutoPlannerPanel({
  config,
  onConfigUpdate,
  onGeneratePlans,
  isGenerating,
}: AutoPlannerPanelProps) {
  const [saving, setSaving] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("generation");

  const handleToggle = async (key: keyof AutoPlannerConfig, value: any) => {
    setSaving(true);
    try {
      await onConfigUpdate({ ...config, [key]: value });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateClick = async () => {
    await onGeneratePlans();
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <Card className="bg-blue-50 border border-blue-200 p-4">
        <div className="flex gap-3">
          <MaterialIcon className="text-blue-600 text-2xl flex-shrink-0">auto_awesome</MaterialIcon>
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Auto Lesson Planner</h3>
            <p className="text-sm text-blue-800">
              Configure how lesson plans are automatically generated from your syllabus. Choose between rules-based
              templates or AI-enhanced generation.
            </p>
          </div>
        </div>
      </Card>

      {/* AI Generation Section */}
      <Card>
        <div
          className="p-4 cursor-pointer hover:bg-[var(--bg)]/50 transition-colors"
          onClick={() => setExpandedSection(expandedSection === "generation" ? null : "generation")}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MaterialIcon className={`text-[var(--primary)] ${expandedSection === "generation" ? "" : ""}`}>
                lightbulb
              </MaterialIcon>
              <h3 className="font-semibold text-[var(--t1)]">AI-Powered Generation</h3>
            </div>
            <MaterialIcon>{expandedSection === "generation" ? "expand_less" : "expand_more"}</MaterialIcon>
          </div>
        </div>

        {expandedSection === "generation" && (
          <>
            <div className="border-t border-[var(--border)]" />
            <div className="p-4 space-y-4">
              {/* Enable AI */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-[var(--t1)] block mb-1">Enable AI Generation</label>
                  <p className="text-xs text-[var(--t3)]">
                    Use AI to generate detailed lesson plans with objectives, procedures, and assessment
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.enable_ai_generation || false}
                  onChange={(e) => handleToggle("enable_ai_generation", e.target.checked)}
                  disabled={saving}
                  className="w-5 h-5 rounded cursor-pointer"
                />
              </div>

              {config.enable_ai_generation && (
                <>
                  {/* AI Provider */}
                  <div>
                    <label className="font-medium text-[var(--t1)] block mb-2">AI Provider</label>
                    <select
                      value={config.ai_provider || "rules_based"}
                      onChange={(e) => handleToggle("ai_provider", e.target.value as AutoPlannerConfig["ai_provider"])}
                      disabled={saving}
                      className="input w-full"
                    >
                      <option value="rules_based">Rules-Based (No API needed)</option>
                      <option value="openai">OpenAI GPT-4</option>
                      <option value="claude">Anthropic Claude</option>
                    </select>
                    <p className="text-xs text-[var(--t3)] mt-1">
                      Rules-based uses templates. OpenAI/Claude need API keys configured in settings.
                    </p>
                  </div>

                  {/* Temperature */}
                  <div>
                    <label className="font-medium text-[var(--t1)] block mb-2">
                      AI Temperature ({(config.ai_temperature || 0.7).toFixed(2)})
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={config.ai_temperature || 0.7}
                      onChange={(e) => handleToggle("ai_temperature", parseFloat(e.target.value))}
                      disabled={saving}
                      className="w-full"
                    />
                    <p className="text-xs text-[var(--t3)] mt-1">Lower = more focused, Higher = more creative</p>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </Card>

      {/* Scheduling Section */}
      <Card>
        <div
          className="p-4 cursor-pointer hover:bg-[var(--bg)]/50 transition-colors"
          onClick={() => setExpandedSection(expandedSection === "scheduling" ? null : "scheduling")}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MaterialIcon className="text-[var(--primary)]">calendar_month</MaterialIcon>
              <h3 className="font-semibold text-[var(--t1)]">Smart Scheduling</h3>
            </div>
            <MaterialIcon>{expandedSection === "scheduling" ? "expand_less" : "expand_more"}</MaterialIcon>
          </div>
        </div>

        {expandedSection === "scheduling" && (
          <>
            <div className="border-t border-[var(--border)]" />
            <div className="p-4 space-y-4">
              {/* Enable Scheduling */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-[var(--t1)] block mb-1">Enable Smart Scheduling</label>
                  <p className="text-xs text-[var(--t3)]">
                    Automatically distribute topics across weeks accounting for term dates
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.enable_smart_scheduling || false}
                  onChange={(e) => handleToggle("enable_smart_scheduling", e.target.checked)}
                  disabled={saving}
                  className="w-5 h-5 rounded cursor-pointer"
                />
              </div>

              {config.enable_smart_scheduling && (
                <>
                  {/* Lessons Per Week */}
                  <div>
                    <label className="font-medium text-[var(--t1)] block mb-2">Target Lessons Per Week</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="7"
                      value={config.lessons_per_week_target || 2}
                      onChange={(e) => handleToggle("lessons_per_week_target", parseInt(e.target.value))}
                      disabled={saving}
                      className="input w-full"
                    />
                  </div>

                  {/* Account for Holidays */}
                  <div className="flex items-center justify-between">
                    <label className="font-medium text-[var(--t1)]">Account for Holidays</label>
                    <input
                      type="checkbox"
                      checked={config.account_for_holidays || false}
                      onChange={(e) => handleToggle("account_for_holidays", e.target.checked)}
                      disabled={saving}
                      className="w-5 h-5 rounded cursor-pointer"
                    />
                  </div>

                  {/* Account for Exams */}
                  <div className="flex items-center justify-between">
                    <label className="font-medium text-[var(--t1)]">Account for Exam Dates</label>
                    <input
                      type="checkbox"
                      checked={config.account_for_exams || false}
                      onChange={(e) => handleToggle("account_for_exams", e.target.checked)}
                      disabled={saving}
                      className="w-5 h-5 rounded cursor-pointer"
                    />
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </Card>

      {/* Lesson Structure Section */}
      <Card>
        <div
          className="p-4 cursor-pointer hover:bg-[var(--bg)]/50 transition-colors"
          onClick={() => setExpandedSection(expandedSection === "structure" ? null : "structure")}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MaterialIcon className="text-[var(--primary)]">format_list_bulleted</MaterialIcon>
              <h3 className="font-semibold text-[var(--t1)]">Lesson Structure</h3>
            </div>
            <MaterialIcon>{expandedSection === "structure" ? "expand_less" : "expand_more"}</MaterialIcon>
          </div>
        </div>

        {expandedSection === "structure" && (
          <>
            <div className="border-t border-[var(--border)]" />
            <div className="p-4 space-y-4">
              {/* Default Duration */}
              <div>
                <label className="font-medium text-[var(--t1)] block mb-2">Default Lesson Duration</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="20"
                    max="120"
                    value={config.default_lesson_duration || 40}
                    onChange={(e) => handleToggle("default_lesson_duration", parseInt(e.target.value))}
                    disabled={saving}
                    className="input w-24"
                  />
                  <span className="text-[var(--t3)]">minutes</span>
                </div>
              </div>

              {/* Include Homework */}
              <div className="flex items-center justify-between">
                <label className="font-medium text-[var(--t1)]">Include Homework Assignments</label>
                <input
                  type="checkbox"
                  checked={config.include_homework || false}
                  onChange={(e) => handleToggle("include_homework", e.target.checked)}
                  disabled={saving}
                  className="w-5 h-5 rounded cursor-pointer"
                />
              </div>

              {/* Include Assessment */}
              <div className="flex items-center justify-between">
                <label className="font-medium text-[var(--t1)]">Include Assessment Tasks</label>
                <input
                  type="checkbox"
                  checked={config.include_assessment || false}
                  onChange={(e) => handleToggle("include_assessment", e.target.checked)}
                  disabled={saving}
                  className="w-5 h-5 rounded cursor-pointer"
                />
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <Button onClick={handleGenerateClick} disabled={isGenerating || saving} className="flex-1 gap-2">
          <MaterialIcon>auto_awesome</MaterialIcon>
          {isGenerating ? "Generating Plans..." : "Generate Lesson Plans Now"}
        </Button>
        <Button variant="ghost" className="gap-2">
          <MaterialIcon>info</MaterialIcon>
          Learn More
        </Button>
      </div>

      {/* Info Box */}
      <Card className="bg-amber-50 border border-amber-200 p-4">
        <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
          <MaterialIcon className="text-amber-600">info</MaterialIcon>
          How It Works
        </h4>
        <ul className="text-sm text-amber-800 space-y-1">
          <li>• Analyzes your syllabus topics and week distribution</li>
          <li>• Generates detailed lesson plans with learning objectives</li>
          <li>• Suggests teaching methods and assessment strategies</li>
          <li>• Creates homework and revision materials</li>
          <li>• All lesson plans can be edited before use</li>
        </ul>
      </Card>
    </div>
  );
}
