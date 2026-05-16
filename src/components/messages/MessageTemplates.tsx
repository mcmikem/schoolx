"use client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import MaterialIcon from "@/components/MaterialIcon";

interface SMSTemplate {
  id: string;
  name: string;
  category: string;
  message: string;
  is_active: boolean;
}

interface MessageTemplatesProps {
  templates: SMSTemplate[];
  showCreateTemplate: boolean;
  onShowCreateTemplateChange: (show: boolean) => void;
  editingTemplate: SMSTemplate | null;
  onEditingTemplateChange: (t: SMSTemplate | null) => void;
  newTemplate: { name: string; category: string; message: string };
  onNewTemplateChange: (t: {
    name: string;
    category: string;
    message: string;
  }) => void;
  templateCategories: { value: string; label: string }[];
  onCreateTemplate: () => void;
  onUpdateTemplate: () => void;
  onDeleteTemplate: (id: string) => void;
  onCreateDefaultTemplates: () => void;
}

export default function MessageTemplates({
  templates,
  showCreateTemplate,
  onShowCreateTemplateChange,
  editingTemplate,
  onEditingTemplateChange,
  newTemplate,
  onNewTemplateChange,
  templateCategories,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onCreateDefaultTemplates,
}: MessageTemplatesProps) {
  return (
    <>
      <div className="flex gap-2 mb-6 flex-wrap">
        <Button variant="secondary" onClick={onCreateDefaultTemplates}>
          <MaterialIcon icon="auto_awesome" className="text-lg" />
          Add Defaults
        </Button>
        <Button onClick={() => onShowCreateTemplateChange(true)}>
          <MaterialIcon icon="add" className="text-lg" />
          Create Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <Card key={template.id} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[var(--t1)]">
                {template.name}
              </h3>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${template.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
              >
                {template.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="text-xs text-[var(--t3)] mb-2 uppercase">
              {template.category.replace("_", " ")}
            </div>
            <p className="text-sm text-[var(--t3)] mb-4 line-clamp-3">
              {template.message}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => onEditingTemplateChange(template)}
                className="flex-1"
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => onDeleteTemplate(template.id)}
              >
                Delete
              </Button>
            </div>
          </Card>
        ))}
        {templates.length === 0 && (
          <div className="col-span-full text-center py-12 text-[var(--t3)]">
            <MaterialIcon className="text-5xl opacity-50 mx-auto">
              sms
            </MaterialIcon>
            <p className="mt-2">
              No templates yet. Create one or add defaults.
            </p>
          </div>
        )}
      </div>

      {showCreateTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-[var(--t1)] mb-4">
              Create SMS Template
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Template Name
                </label>
                <input
                  value={newTemplate.name}
                  onChange={(e) =>
                    onNewTemplateChange({
                      ...newTemplate,
                      name: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  placeholder="e.g., Fee Reminder"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Category
                </label>
                <select
                  value={newTemplate.category}
                  onChange={(e) =>
                    onNewTemplateChange({
                      ...newTemplate,
                      category: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                >
                  {templateCategories.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Message
                </label>
                <textarea
                  value={newTemplate.message}
                  onChange={(e) =>
                    onNewTemplateChange({
                      ...newTemplate,
                      message: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  rows={4}
                  placeholder="Enter message template..."
                />
                <p className="text-xs text-[var(--t3)] mt-1">
                  Use {"{{variable}}"} for dynamic content (e.g.,{" "}
                  {"{{student_name}}"}, {"{{amount}}"})
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => onShowCreateTemplateChange(false)}
              >
                Cancel
              </Button>
              <Button className="flex-1" onClick={onCreateTemplate}>
                Create Template
              </Button>
            </div>
          </div>
        </div>
      )}

      {editingTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-[var(--t1)] mb-4">
              Edit SMS Template
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Template Name
                </label>
                <input
                  value={editingTemplate.name}
                  onChange={(e) =>
                    onEditingTemplateChange({
                      ...editingTemplate,
                      name: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Category
                </label>
                <select
                  value={editingTemplate.category}
                  onChange={(e) =>
                    onEditingTemplateChange({
                      ...editingTemplate,
                      category: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                >
                  {templateCategories.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Message
                </label>
                <textarea
                  value={editingTemplate.message}
                  onChange={(e) =>
                    onEditingTemplateChange({
                      ...editingTemplate,
                      message: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  rows={4}
                />
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingTemplate.is_active}
                    onChange={(e) =>
                      onEditingTemplateChange({
                        ...editingTemplate,
                        is_active: e.target.checked,
                      })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Active</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => onEditingTemplateChange(null)}
              >
                Cancel
              </Button>
              <Button className="flex-1" onClick={onUpdateTemplate}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
