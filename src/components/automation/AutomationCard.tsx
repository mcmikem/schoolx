"use client"

import MaterialIcon from "@/components/MaterialIcon"
import { Button } from "@/components/ui/index"

interface AutomationCardProps {
  title: string
  description: string
  icon: string
  isActive: boolean
  lastRun?: string
  stats?: { label: string; value: string | number }[]
  onToggle: () => void
  onRun?: () => void
  onConfigure?: () => void
  color?: string
}

export default function AutomationCard({
  title,
  description,
  icon,
  isActive,
  lastRun,
  stats,
  onToggle,
  onRun,
  onConfigure,
  color = "blue",
}: AutomationCardProps) {
  const colorMap: Record<string, { bg: string; text: string; icon: string; toggle: string }> = {
    blue: {
      bg: "bg-blue-100",
      text: "text-blue-700",
      icon: "bg-blue-100 text-blue-700",
      toggle: "bg-blue-600",
    },
    green: {
      bg: "bg-green-100",
      text: "text-green-700",
      icon: "bg-green-100 text-green-700",
      toggle: "bg-green-600",
    },
    amber: {
      bg: "bg-amber-100",
      text: "text-amber-700",
      icon: "bg-amber-100 text-amber-700",
      toggle: "bg-amber-600",
    },
    purple: {
      bg: "bg-purple-100",
      text: "text-purple-700",
      icon: "bg-purple-100 text-purple-700",
      toggle: "bg-purple-600",
    },
  }

  const colors = colorMap[color] || colorMap.blue

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 transition-all hover:shadow-md">
      <div
        className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full blur-3xl opacity-20 transition-all ${
          isActive ? colors.bg : "bg-gray-200"
        }`}
      />

      <div className="relative">
        <div className="flex items-center justify-between mb-5">
          <div className={`p-3 rounded-2xl ${isActive ? colors.icon : "bg-gray-100 text-gray-400"}`}>
            <MaterialIcon>{icon}</MaterialIcon>
          </div>

          <button
            onClick={onToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              isActive ? colors.toggle : "bg-gray-300"
            }`}
            aria-label={`Toggle ${title}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isActive ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-bold text-[var(--t1)]">{title}</h3>
            <p className="text-sm text-[var(--t3)] mt-0.5">{description}</p>
          </div>

          {stats && stats.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="p-2.5 rounded-xl bg-[var(--surface-container)] border border-[var(--border)]"
                >
                  <p className="text-xs text-[var(--t3)]">{stat.label}</p>
                  <p className="text-sm font-semibold text-[var(--t1)]">{stat.value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between">
            <p className="text-[10px] text-[var(--t3)] italic">
              Last run: {lastRun ? new Date(lastRun).toLocaleDateString() : "Never"}
            </p>
            <div className="flex items-center gap-1.5">
              {onRun && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!isActive}
                  onClick={onRun}
                >
                  <MaterialIcon className="text-sm">play_arrow</MaterialIcon>
                  Run
                </Button>
              )}
              {onConfigure && (
                <Button variant="ghost" size="sm" onClick={onConfigure}>
                  <MaterialIcon className="text-sm">settings</MaterialIcon>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
