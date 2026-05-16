"use client";
import { useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import MaterialIcon from "@/components/MaterialIcon";
import PersonInitials from "@/components/ui/PersonInitials";
import { ROLE_LABELS, type UserRole } from "@/lib/roles";
import {
  FEATURE_STAGES,
  canUseModule,
  type FeatureStage,
  type ModuleKey,
} from "@/lib/featureStages";

interface UserItem {
  id: string;
  full_name: string;
  phone: string;
  role: string;
  is_active: boolean;
}

interface UserManagerProps {
  users: UserItem[];
  loadingUsers: boolean;
  onToggleUserStatus: (id: string, currentStatus: boolean) => void;
  onAddUser: (data: {
    full_name: string;
    phone: string;
    role: UserRole;
    password: string;
  }) => void;
  selectedStage: FeatureStage;
}

const ROLE_OPTIONS: {
  value: UserRole;
  description: string;
  modules: ModuleKey[];
}[] = [
  {
    value: "teacher",
    description:
      "Attendance, grades, homework, lesson plans and classroom communication.",
    modules: ["attendance", "marks", "communications"],
  },
  {
    value: "school_admin",
    description:
      "Oversee operations, exports, dashboards, and general settings.",
    modules: ["operations", "exports", "reports"],
  },
  {
    value: "dean_of_studies",
    description: "Academic oversight, grading, exams, and report card views.",
    modules: ["marks", "exam", "reports"],
  },
  {
    value: "bursar",
    description:
      "Finance, invoicing, payroll, budgeting, and payment tracking.",
    modules: ["finance", "exports"],
  },
  {
    value: "secretary",
    description: "Communications, visits, notices and calendar management.",
    modules: ["communications", "operations"],
  },
];

const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Dashboard",
  attendance: "Attendance",
  marks: "Marks & Exams",
  exam: "Exams",
  communications: "Communication",
  finance: "Finance",
  reports: "Reports",
  exports: "Exports",
  staff: "Staff",
  operations: "Operations",
  settings: "Settings",
  parentPortal: "Parent Portal",
  dorm: "Dorm",
  health: "Health",
  analytics: "Analytics",
};

export default function UserManager({
  users,
  loadingUsers,
  onToggleUserStatus,
  onAddUser,
  selectedStage,
}: UserManagerProps) {
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    full_name: "",
    phone: "",
    role: "teacher" as UserRole,
    password: "",
  });

  const selectedRoleOption = ROLE_OPTIONS.find(
    (option) => option.value === newUser.role,
  );
  const missingModules =
    selectedRoleOption?.modules.filter(
      (module) => !canUseModule(selectedStage, module),
    ) || [];
  const missingModuleLabels = missingModules.map(
    (module) => MODULE_LABELS[module],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddUser(newUser);
    setShowAddUser(false);
    setNewUser({ full_name: "", phone: "", role: "teacher", password: "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setShowAddUser(true)}>
          <MaterialIcon icon="person_add" className="text-lg" />
          Add User
        </Button>
      </div>

      {loadingUsers ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardBody>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[var(--surface-container)] rounded-full" />
                  <div className="flex-1">
                    <div className="w-32 h-4 bg-[var(--border)] rounded mb-2" />
                    <div className="w-24 h-3 bg-[var(--border)] rounded" />
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <Card key={u.id}>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <PersonInitials name={u.full_name} size={48} />
                    <div>
                      <div className="font-medium text-[var(--on-surface)]">
                        {u.full_name}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-1 rounded-lg text-xs font-medium bg-[var(--green-soft)] text-[var(--green)]">
                          {u.role === "dos"
                            ? "Director of Studies"
                            : u.role === "school_admin"
                              ? "Administrator"
                              : u.role === "bursar"
                                ? "Bursar"
                                : u.role.charAt(0).toUpperCase() +
                                  u.role.slice(1)}
                        </span>
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-medium ${u.is_active ? "bg-[var(--green-soft)] text-[var(--green)]" : "bg-[var(--red-soft)] text-[var(--red)]"}`}
                        >
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={u.is_active ? "secondary" : "primary"}
                    onClick={() => onToggleUserStatus(u.id, u.is_active)}
                  >
                    {u.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {showAddUser && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddUser(false)}
        >
          <div
            className="bg-[var(--surface)] rounded-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[var(--border)]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--on-surface)]">
                  Add Staff Member
                </h2>
                <button
                  onClick={() => setShowAddUser(false)}
                  className="p-2 text-[var(--t3)] hover:text-[var(--on-surface)]"
                >
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={newUser.full_name}
                    onChange={(e) =>
                      setNewUser({ ...newUser, full_name: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="0700000000"
                    value={newUser.phone}
                    onChange={(e) =>
                      setNewUser({ ...newUser, phone: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                    Role
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) =>
                      setNewUser({
                        ...newUser,
                        role: e.target.value as UserRole,
                      })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {ROLE_LABELS[option.value] || option.value}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-container-low)] p-4 text-sm space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.4em] text-[var(--t3)]">
                    Access summary
                  </div>
                  <div className="text-sm text-[var(--on-surface)]">
                    {selectedRoleOption?.description ||
                      "This role inherits the default access for the selected profile."}
                  </div>
                  <div className="text-xs text-[var(--t3)]">
                    Current stage: {FEATURE_STAGES[selectedStage].label}
                  </div>
                  {missingModuleLabels.length > 0 && (
                    <div className="text-xs text-[var(--amber)]">
                      Stage {FEATURE_STAGES[selectedStage].label} does not
                      include {missingModuleLabels.join(", ")}. Upgrade or
                      choose a broader stage before assigning this role.
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="Min 6 characters"
                    value={newUser.password}
                    onChange={(e) =>
                      setNewUser({ ...newUser, password: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                    required
                    minLength={6}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setShowAddUser(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1">
                    Add User
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
