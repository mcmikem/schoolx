"use client";

import { useState, useCallback, useEffect } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { useAuth } from "@/lib/auth-context";

interface DashboardWidget {
  id: string;
  title: string;
  icon: string;
  description: string;
  enabled: boolean;
  order: number;
}

const AVAILABLE_WIDGETS: DashboardWidget[] = [
  {
    id: "overview",
    title: "Overview Stats",
    icon: "insights",
    description: "Key metrics at a glance",
    enabled: true,
    order: 0,
  },
  {
    id: "attendance-today",
    title: "Today's Attendance",
    icon: "event",
    description: "Live attendance status",
    enabled: true,
    order: 1,
  },
  {
    id: "fee-collection",
    title: "Fee Collection",
    icon: "payments",
    description: "Recent payments and balances",
    enabled: true,
    order: 2,
  },
  {
    id: "recent-students",
    title: "Recent Students",
    icon: "group",
    description: "New and recently updated",
    enabled: true,
    order: 3,
  },
  {
    id: "pending-actions",
    title: "Pending Actions",
    icon: "task_alt",
    description: "Tasks requiring attention",
    enabled: true,
    order: 4,
  },
  {
    id: "staff-on-duty",
    title: "Staff on Duty",
    icon: "people",
    description: "Today's staff schedule",
    enabled: false,
    order: 5,
  },
  {
    id: "upcoming-events",
    title: "Upcoming Events",
    icon: "event_note",
    description: "School events and deadlines",
    enabled: false,
    order: 6,
  },
  {
    id: "messages-summary",
    title: "Messages",
    icon: "sms",
    description: "Recent SMS and alerts",
    enabled: false,
    order: 7,
  },
  {
    id: "alerts",
    title: "Alerts",
    icon: "notifications",
    description: "Important notifications",
    enabled: true,
    order: 8,
  },
];

export function useDashboardCustomization() {
  const { user } = useAuth();
  const [widgets, setWidgets] = useState<DashboardWidget[]>(AVAILABLE_WIDGETS);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(
        `omuto_dashboard_widgets_${user?.id || "demo"}`,
      );
      if (saved) {
        try {
          const savedWidgets = JSON.parse(saved);
          const merged = AVAILABLE_WIDGETS.map((w) => {
            const saved = savedWidgets.find(
              (s: DashboardWidget) => s.id === w.id,
            );
            return saved
              ? { ...w, enabled: saved.enabled, order: saved.order }
              : w;
          });
          setWidgets(merged);
        } catch (e) {
          console.error("Failed to load dashboard preferences", e);
        }
      }
    }
  }, [user?.id]);

  const saveWidgets = useCallback(
    (updatedWidgets: DashboardWidget[]) => {
      setWidgets(updatedWidgets);
      if (typeof window !== "undefined") {
        localStorage.setItem(
          `omuto_dashboard_widgets_${user?.id || "demo"}`,
          JSON.stringify(updatedWidgets),
        );
      }
    },
    [user?.id],
  );

  const toggleWidget = useCallback(
    (widgetId: string) => {
      const updated = widgets.map((w) =>
        w.id === widgetId ? { ...w, enabled: !w.enabled } : w,
      );
      saveWidgets(updated);
    },
    [widgets, saveWidgets],
  );

  const reorderWidgets = useCallback(
    (fromIndex: number, toIndex: number) => {
      const enabledWidgets = widgets
        .filter((w) => w.enabled)
        .sort((a, b) => a.order - b.order);
      const disabledWidgets = widgets.filter((w) => !w.enabled);

      const [moved] = enabledWidgets.splice(fromIndex, 1);
      enabledWidgets.splice(toIndex, 0, moved);

      const reordered = [
        ...enabledWidgets.map((w, i) => ({ ...w, order: i })),
        ...disabledWidgets,
      ];

      saveWidgets(reordered);
    },
    [widgets, saveWidgets],
  );

  const startCustomizing = useCallback(() => setIsCustomizing(true), []);
  const stopCustomizing = useCallback(() => setIsCustomizing(false), []);

  const resetToDefault = useCallback(() => {
    saveWidgets(AVAILABLE_WIDGETS);
  }, [saveWidgets]);

  return {
    widgets,
    enabledWidgets: widgets
      .filter((w) => w.enabled)
      .sort((a, b) => a.order - b.order),
    disabledWidgets: widgets.filter((w) => !w.enabled),
    isCustomizing,
    draggedWidget,
    setDraggedWidget,
    toggleWidget,
    reorderWidgets,
    startCustomizing,
    stopCustomizing,
    resetToDefault,
  };
}

export function DashboardCustomizer() {
  const customization = useDashboardCustomization();

  if (!customization.isCustomizing) {
    return (
      <button
        onClick={customization.startCustomizing}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <MaterialIcon icon="tune" />
        <span>Customize</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MaterialIcon icon="tune" className="text-blue-600" />
            <h2 className="font-semibold text-gray-900">Customize Dashboard</h2>
          </div>
          <button
            onClick={customization.stopCustomizing}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <MaterialIcon icon="close" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <p className="text-sm text-gray-600">
            Drag to reorder enabled widgets. Toggle to show/hide widgets.
          </p>
        </div>

        <div className="p-4 max-h-96 overflow-y-auto">
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              Enabled Widgets
            </div>
            {customization.enabledWidgets.map((widget, index) => (
              <div
                key={widget.id}
                draggable
                onDragStart={() => customization.setDraggedWidget(widget.id)}
                onDragEnd={() => customization.setDraggedWidget(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (customization.draggedWidget) {
                    const fromIdx = customization.enabledWidgets.findIndex(
                      (w) => w.id === customization.draggedWidget,
                    );
                    if (fromIdx !== -1 && fromIdx !== index) {
                      customization.reorderWidgets(fromIdx, index);
                    }
                  }
                }}
                className={`flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl cursor-move transition-all ${
                  customization.draggedWidget === widget.id
                    ? "opacity-50 scale-95"
                    : "hover:border-blue-300 hover:shadow-sm"
                }`}
              >
                <div className="text-gray-400 cursor-grab">
                  <MaterialIcon icon="drag_indicator" />
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <MaterialIcon icon={widget.icon} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900">
                    {widget.title}
                  </div>
                  <div className="text-xs text-gray-500">
                    {widget.description}
                  </div>
                </div>
                <button
                  onClick={() => customization.toggleWidget(widget.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <MaterialIcon icon="visibility_off" />
                </button>
              </div>
            ))}
          </div>

          {customization.disabledWidgets.length > 0 && (
            <div className="mt-6 space-y-2">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                Hidden Widgets
              </div>
              {customization.disabledWidgets.map((widget) => (
                <div
                  key={widget.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl opacity-60"
                >
                  <div className="w-10 h-10 bg-gray-200 rounded-xl flex items-center justify-center">
                    <MaterialIcon
                      icon={widget.icon}
                      className="text-gray-500"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-700">
                      {widget.title}
                    </div>
                    <div className="text-xs text-gray-500">
                      {widget.description}
                    </div>
                  </div>
                  <button
                    onClick={() => customization.toggleWidget(widget.id)}
                    className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                  >
                    <MaterialIcon icon="visibility" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={customization.resetToDefault}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Reset to default
          </button>
          <button
            onClick={customization.stopCustomizing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default DashboardCustomizer;
