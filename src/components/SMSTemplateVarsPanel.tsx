"use client";
import { useState, useCallback } from "react";
import MaterialIcon from "@/components/MaterialIcon";

export interface TemplateVariable {
  variable: string;
  description: string;
  testValue: string;
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  {
    variable: "{{student_name}}",
    description: "Student's full name",
    testValue: "John Kintu",
  },
  {
    variable: "{{parent_name}}",
    description: "Parent/guardian name",
    testValue: "Sarah Kintu",
  },
  {
    variable: "{{amount}}",
    description: "Fee payment amount",
    testValue: "150,000",
  },
  {
    variable: "{{balance}}",
    description: "Outstanding fee balance",
    testValue: "350,000",
  },
  {
    variable: "{{days_overdue}}",
    description: "Days fee is overdue",
    testValue: "14",
  },
  {
    variable: "{{school_name}}",
    description: "School name",
    testValue: "St. Mary's Primary School",
  },
  {
    variable: "{{term}}",
    description: "Current term",
    testValue: "1",
  },
  {
    variable: "{{subject}}",
    description: "Subject name",
    testValue: "Mathematics",
  },
  {
    variable: "{{date}}",
    description: "Current date",
    testValue: new Date().toLocaleDateString(),
  },
  {
    variable: "{{status}}",
    description: "Status text",
    testValue: "completed",
  },
];

const TEST_DATA: Record<string, string> = {};
TEMPLATE_VARIABLES.forEach((v) => {
  TEST_DATA[v.variable.replace(/{{|}}/g, "")] = v.testValue;
});

export function renderTemplateWithTestData(template: string): string {
  let result = template;
  for (const [key, value] of Object.entries(TEST_DATA)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

interface SMSTemplateVarsPanelProps {
  onInsertVariable?: (variable: string) => void;
}

export function SMSTemplateVarsPanel({
  onInsertVariable,
}: SMSTemplateVarsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [testTemplate, setTestTemplate] = useState("");
  const [testValues, setTestValues] = useState<Record<string, string>>({
    ...TEST_DATA,
  });
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = useCallback(
    async (variable: string, index: number) => {
      try {
        await navigator.clipboard.writeText(variable);
      } catch {
        const textarea = document.createElement("textarea");
        textarea.value = variable;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    },
    [],
  );

  const renderPreview = (): string => {
    let result = testTemplate;
    for (const tv of TEMPLATE_VARIABLES) {
      const key = tv.variable.replace(/{{|}}/g, "");
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), testValues[key] || "");
    }
    return result;
  };

  const preview = renderPreview();

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container)] transition-colors"
      >
        <span className="flex items-center gap-2">
          <MaterialIcon icon="data_object" className="text-[var(--primary)]" />
          Available Template Variables
        </span>
        <MaterialIcon
          icon={isOpen ? "expand_less" : "expand_more"}
          className="text-[var(--t4)]"
        />
      </button>

      {isOpen && (
        <div className="border-t border-[var(--border)]">
          <div className="p-4 space-y-1">
            {TEMPLATE_VARIABLES.map((tv, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[var(--surface-container)] group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <code
                    className="text-sm font-mono text-[var(--primary)] cursor-pointer shrink-0"
                    onClick={() => onInsertVariable?.(tv.variable)}
                    title={`Click to insert ${tv.variable}`}
                  >
                    {tv.variable}
                  </code>
                  <span className="text-xs text-[var(--t4)] truncate">
                    {tv.description}
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(tv.variable, i)}
                  className="shrink-0 ml-2 w-7 h-7 flex items-center justify-center rounded-lg text-[var(--t4)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/5 opacity-0 group-hover:opacity-100 transition-all"
                  title={`Copy ${tv.variable}`}
                >
                  <MaterialIcon
                    icon={copiedIndex === i ? "check" : "content_copy"}
                    size={14}
                  />
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-[var(--border)] p-4 space-y-3">
            <h4 className="text-sm font-medium text-[var(--on-surface)] flex items-center gap-2">
              <MaterialIcon icon="preview" size={16} />
              Test Template
            </h4>
            <textarea
              value={testTemplate}
              onChange={(e) => setTestTemplate(e.target.value)}
              placeholder='Type your template here using {{variables}}...'
              className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--on-surface)] placeholder-[var(--t4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors resize-none min-h-[80px]"
              rows={3}
            />
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {TEMPLATE_VARIABLES.map((tv, i) => {
                const key = tv.variable.replace(/{{|}}/g, "");
                return (
                  <div key={i}>
                    <label className="text-xs text-[var(--t4)] mb-0.5 block font-mono">
                      {tv.variable}
                    </label>
                    <input
                      type="text"
                      value={testValues[key] || ""}
                      onChange={(e) =>
                        setTestValues((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      className="w-full px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--on-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors"
                    />
                  </div>
                );
              })}
            </div>
            {testTemplate && (
              <div>
                <label className="text-xs font-medium text-[var(--t4)] mb-1.5 block">
                  Preview:
                </label>
                <div className="px-3 py-2.5 rounded-xl bg-[var(--surface-container)] text-sm text-[var(--on-surface)] whitespace-pre-wrap break-words min-h-[40px]">
                  {preview || <span className="text-[var(--t4)]">—</span>}
                </div>
                <p className="text-xs text-[var(--t4)] mt-1">
                  {preview.length} character{preview.length !== 1 ? "s" : ""} (
                  ~{Math.max(1, Math.ceil(preview.length / 160))} SMS segment
                  {Math.ceil(preview.length / 160) > 1 ? "s" : ""})
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
