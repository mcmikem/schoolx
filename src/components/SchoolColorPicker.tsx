"use client";
import { useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";

const PRESET_PRIMARY = ["#005ce6", "#0d9488", "#7c3aed", "#dc2626", "#f59e0b", "#002045"];
const PRESET_ACCENT = ["#f97316", "#3b82f6", "#8b5cf6", "#ec4899", "#10b981", "#eab308"];

interface SchoolColorPickerProps {
  label: string;
  value: string;
  presets?: string[];
  onChange: (color: string) => void;
}

export default function SchoolColorPicker({
  label,
  value,
  presets = PRESET_PRIMARY,
  onChange,
}: SchoolColorPickerProps) {
  const [customOpen, setCustomOpen] = useState(false);

  return (
    <div>
      <label className="block text-sm font-semibold text-[var(--t1)] mb-2">
        {label}
      </label>
      <div className="flex gap-2 flex-wrap items-center">
        {presets.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={`w-9 h-9 rounded-full border-2 transition-transform hover:scale-110 ${
              value === color
                ? "border-[var(--t1)] ring-2 ring-offset-2 ring-[var(--border)]"
                : "border-transparent"
            }`}
            style={{ backgroundColor: color }}
            aria-label={`Select color ${color}`}
          />
        ))}
        <div className="relative">
          <button
            type="button"
            onClick={() => setCustomOpen(!customOpen)}
            className="w-9 h-9 rounded-full border-2 border-dashed border-[var(--border)] flex items-center justify-center hover:bg-[var(--surface-container)] transition-colors"
            aria-label="Custom color"
          >
            <MaterialIcon icon="add" className="text-[var(--t3)] text-sm" />
          </button>
          {customOpen && (
            <div className="absolute top-full left-0 mt-2 z-10 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-xl">
              <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-32 h-32 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
              />
              <p className="text-[10px] text-[var(--t3)] mt-1 text-center">{value}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
