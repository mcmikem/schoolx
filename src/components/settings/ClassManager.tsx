"use client";
import { useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import MaterialIcon from "@/components/MaterialIcon";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface ClassItem {
  id: string;
  name: string;
  stream?: string | null;
  class_teacher_id?: string | null;
}

interface UserItem {
  id: string;
  full_name: string;
  role: string;
}

interface HouseItem {
  id: string;
  name: string;
  color: string;
  motto?: string | null;
}

interface SchoolConfig {
  student_id_format: string;
  has_boarding: boolean;
  has_houses: boolean;
  has_student_council: boolean;
  has_prefects: boolean;
  location_type: string;
}

interface ClassManagerProps {
  schoolConfig: SchoolConfig;
  onSchoolConfigChange: (config: SchoolConfig) => void;
  classes: ClassItem[];
  loadingClasses: boolean;
  schoolType: string;
  houses: HouseItem[];
  loadingHouses: boolean;
  users: UserItem[];
  savingConfig: boolean;
  onSaveConfig: () => void;
  onAddHouse: (name: string, color: string, motto: string) => void;
  onDeleteHouse: (id: string) => void;
  onAddClass: (name: string, stream: string) => void;
  onDeleteClass: (id: string) => void;
  onSeedDefaultClasses: () => void;
  onAssignClassTeacher: (classId: string, teacherId: string) => void;
}

export default function ClassManager({
  schoolConfig,
  onSchoolConfigChange,
  classes,
  loadingClasses,
  schoolType,
  houses,
  loadingHouses,
  users,
  savingConfig,
  onSaveConfig,
  onAddHouse,
  onDeleteHouse,
  onAddClass,
  onDeleteClass,
  onSeedDefaultClasses,
  onAssignClassTeacher,
}: ClassManagerProps) {
  const [showAddHouse, setShowAddHouse] = useState(false);
  const [newHouse, setNewHouse] = useState({ name: "", color: "#3b82f6", motto: "" });
  const [showAddClass, setShowAddClass] = useState(false);
  const [newClass, setNewClass] = useState({ name: "", stream: "" });
  const [pendingDeleteClassId, setPendingDeleteClassId] = useState<string | null>(null);
  const [pendingDeleteHouseId, setPendingDeleteHouseId] = useState<string | null>(null);

  const handleAddHouse = () => {
    onAddHouse(newHouse.name, newHouse.color, newHouse.motto);
    setShowAddHouse(false);
    setNewHouse({ name: "", color: "#3b82f6", motto: "" });
  };

  const handleAddClass = () => {
    onAddClass(newClass.name, newClass.stream);
    setShowAddClass(false);
    setNewClass({ name: "", stream: "" });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <h2 className="text-lg font-semibold text-[var(--on-surface)] mb-4">
            School Type
          </h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {(["urban", "peri_urban", "rural"] as const).map((type) => (
              <button
                key={type}
                onClick={() =>
                  onSchoolConfigChange({ ...schoolConfig, location_type: type })
                }
                className={`p-4 rounded-xl border-2 text-center transition-all ${schoolConfig.location_type === type ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
              >
                <div className="font-medium capitalize">
                  {type.replace("_", " ")}
                </div>
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {([
              { key: "has_boarding" as const, label: "Boarding School", desc: "Students stay overnight" },
              { key: "has_houses" as const, label: "House System", desc: "Students belong to colored houses (e.g., Nile, Victoria)" },
              { key: "has_student_council" as const, label: "Student Council", desc: "President, VP, Secretary, etc." },
              { key: "has_prefects" as const, label: "Prefects", desc: "Head Boy, Head Girl, Sports Prefect, etc." },
            ]).map(({ key, label, desc }) => (
              <label
                key={key}
                className="flex items-center justify-between p-3 bg-[var(--surface-container)] rounded-xl cursor-pointer"
              >
                <div>
                  <div className="font-medium text-[var(--on-surface)]">{label}</div>
                  <div className="text-xs text-[var(--t3)]">{desc}</div>
                </div>
                <input
                  type="checkbox"
                  checked={schoolConfig[key]}
                  onChange={(e) =>
                    onSchoolConfigChange({
                      ...schoolConfig,
                      [key]: e.target.checked,
                    })
                  }
                  className="w-5 h-5 rounded border-[var(--border)] text-[var(--primary)]"
                />
              </label>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="text-lg font-semibold text-[var(--on-surface)] mb-2">
            Student ID Format
          </h2>
          <p className="text-sm text-[var(--t3)] mb-4">
            Customize how student numbers are generated. Tokens:{" "}
            <code className="bg-[var(--surface-container)] px-1.5 py-0.5 rounded text-xs">{`{YYYY}`}</code>{" "}
            = year,{" "}
            <code className="bg-[var(--surface-container)] px-1.5 py-0.5 rounded text-xs">{`{####}`}</code>{" "}
            = sequential number,{" "}
            <code className="bg-[var(--surface-container)] px-1.5 py-0.5 rounded text-xs">{`{CLASS}`}</code>{" "}
            = class code,{" "}
            <code className="bg-[var(--surface-container)] px-1.5 py-0.5 rounded text-xs">{`{GENDER}`}</code>{" "}
            = M/F
          </p>
          <input
            type="text"
            value={schoolConfig.student_id_format}
            onChange={(e) =>
              onSchoolConfigChange({
                ...schoolConfig,
                student_id_format: e.target.value,
              })
            }
            className="input mb-2"
            placeholder="STU{YYYY}{####}"
          />
          <div className="text-xs text-[var(--t3)]">
            Example:{" "}
            <code className="bg-[var(--surface-container)] px-1.5 py-0.5 rounded">
              {schoolConfig.student_id_format
                .replace("{YYYY}", "2026")
                .replace("{####}", "0001")
                .replace("{CLASS}", "P7")
                .replace("{GENDER}", "M")}
            </code>
          </div>
        </CardBody>
      </Card>

      {schoolConfig.has_houses && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--on-surface)]">
                Houses
              </h2>
              <Button size="sm" onClick={() => setShowAddHouse(true)}>
                <MaterialIcon icon="add" className="text-sm" /> Add House
              </Button>
            </div>
            {loadingHouses ? (
              <div className="text-sm text-[var(--t3)]">Loading houses...</div>
            ) : houses.length === 0 ? (
              <div className="text-sm text-[var(--t3)]">
                No houses configured yet
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {houses.map((house) => (
                  <div
                    key={house.id}
                    className="p-4 rounded-xl border-2 text-center"
                    style={{ borderColor: house.color }}
                  >
                    <div
                      className="w-10 h-10 rounded-full mx-auto mb-2"
                      style={{ backgroundColor: house.color }}
                    />
                    <div className="font-semibold text-sm">{house.name}</div>
                    {house.motto && (
                      <div className="text-xs text-[var(--t3)] italic mt-0.5">
                        {house.motto}
                      </div>
                    )}
                    <button
                      onClick={() => setPendingDeleteHouseId(house.id)}
                      className="text-xs text-red-500 mt-2 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          onClick={onSaveConfig}
          disabled={savingConfig}
          variant="primary"
        >
          <MaterialIcon icon="save" className="text-sm" />
          {savingConfig ? "Saving..." : "Save Configuration"}
        </Button>
      </div>

      <Card>
        <CardBody>
          <h2 className="text-lg font-semibold text-[var(--on-surface)] mb-4">
            Class Teachers
          </h2>
          <p className="text-sm text-[var(--t3)] mb-4">
            Assign class teachers to each class. Class teachers manage
            attendance, behavior, and communicate with parents.
          </p>
          {loadingClasses ? (
            <div className="text-sm text-[var(--t3)]">Loading classes...</div>
          ) : (
            <div className="space-y-2">
              {classes.slice(0, 10).map((cls) => (
                <div
                  key={cls.id}
                  className="flex items-center justify-between p-3 bg-[var(--surface-container)] rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-[var(--on-surface)]">
                      {cls.name}
                      {cls.stream ? ` ${cls.stream}` : ""}
                    </span>
                    {cls.class_teacher_id && (
                      <span className="text-xs text-[var(--t3)]">
                        Teacher assigned
                      </span>
                    )}
                  </div>
                  <select
                    value={cls.class_teacher_id || ""}
                    onChange={(e) =>
                      onAssignClassTeacher(cls.id, e.target.value)
                    }
                    className="input text-sm"
                    style={{ width: "auto", minWidth: "150px" }}
                  >
                    <option value="">No teacher</option>
                    {users
                      .filter((s) => s.role === "teacher")
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name}
                        </option>
                      ))}
                  </select>
                </div>
              ))}
              {classes.length > 10 && (
                <div className="text-sm text-[var(--t3)]">
                  + {classes.length - 10} more classes
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex items-center justify-between mb-4 gap-2">
            <h2 className="text-lg font-semibold text-[var(--on-surface)]">
              Manage Classes
            </h2>
            <div className="flex items-center gap-2">
              {classes.length === 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onSeedDefaultClasses}
                >
                  <MaterialIcon icon="auto_awesome" className="text-sm" />
                  Load Standard Set
                </Button>
              )}
              <Button size="sm" onClick={() => setShowAddClass(true)}>
                <MaterialIcon icon="add" className="text-sm" />
                Add Class
              </Button>
            </div>
          </div>
          <p className="text-sm text-[var(--t3)] mb-4">
            Add or remove classes. Use streams (A, B, C) if your school has
            multiple classes per level.
          </p>
          {loadingClasses ? (
            <div className="text-sm text-[var(--t3)]">Loading...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {classes.map((cls) => (
                <div
                  key={cls.id}
                  className="flex items-center justify-between p-3 bg-[var(--surface-container)] rounded-lg border border-[var(--border)]"
                >
                  <span className="font-medium text-[var(--on-surface)]">
                    {cls.name}
                    {cls.stream ? ` ${cls.stream}` : ""}
                  </span>
                  <button
                    onClick={() => setPendingDeleteClassId(cls.id)}
                    className="text-[var(--t3)] hover:text-red-500 p-1"
                    title="Delete class"
                  >
                    <MaterialIcon icon="delete" className="text-sm" />
                  </button>
                </div>
              ))}
              {classes.length === 0 && (
                <div className="col-span-full text-sm text-[var(--t3)] text-center py-4">
                  No classes yet. Add your first class above.
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {showAddHouse && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddHouse(false)}
        >
          <div
            className="bg-[var(--surface)] rounded-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[var(--border)]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--on-surface)]">
                  Add House
                </h2>
                <button
                  onClick={() => setShowAddHouse(false)}
                  className="p-2 text-[var(--t3)] hover:text-[var(--on-surface)]"
                >
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                  House Name
                </label>
                <input
                  type="text"
                  value={newHouse.name}
                  onChange={(e) =>
                    setNewHouse({ ...newHouse, name: e.target.value })
                  }
                  className="input"
                  placeholder="e.g., Nile"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                  Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={newHouse.color}
                    onChange={(e) =>
                      setNewHouse({ ...newHouse, color: e.target.value })
                    }
                    className="w-12 h-10 rounded border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newHouse.color}
                    onChange={(e) =>
                      setNewHouse({ ...newHouse, color: e.target.value })
                    }
                    className="input flex-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                  Motto (optional)
                </label>
                <input
                  type="text"
                  value={newHouse.motto}
                  onChange={(e) =>
                    setNewHouse({ ...newHouse, motto: e.target.value })
                  }
                  className="input"
                  placeholder="e.g., Flowing Forward"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowAddHouse(false)}
                >
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleAddHouse}>
                  Add House
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddClass && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddClass(false)}
        >
          <div
            className="bg-[var(--surface)] rounded-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[var(--border)]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--on-surface)]">
                  Add Class
                </h2>
                <button
                  onClick={() => setShowAddClass(false)}
                  className="p-2 text-[var(--t3)] hover:text-[var(--on-surface)]"
                >
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                  Class Name
                </label>
                <input
                  type="text"
                  value={newClass.name}
                  onChange={(e) =>
                    setNewClass({ ...newClass, name: e.target.value })
                  }
                  className="input"
                  placeholder="e.g., P.5 or S.1"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                  Stream (Optional)
                </label>
                <input
                  type="text"
                  value={newClass.stream}
                  onChange={(e) =>
                    setNewClass({ ...newClass, stream: e.target.value })
                  }
                  className="input"
                  placeholder="e.g., A, B, or C (leave empty if none)"
                />
                <p className="text-xs text-[var(--t3)] mt-1">
                  Only use streams if you have multiple classes at the same level
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowAddClass(false)}
                >
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleAddClass}>
                  Add Class
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!pendingDeleteClassId}
        onClose={() => setPendingDeleteClassId(null)}
        onConfirm={() => {
          if (pendingDeleteClassId) onDeleteClass(pendingDeleteClassId);
          setPendingDeleteClassId(null);
        }}
        title="Delete Class"
        message="Delete this class? All students in this class will need to be reassigned."
        confirmLabel="Delete"
        variant="danger"
      />
      <ConfirmDialog
        isOpen={!!pendingDeleteHouseId}
        onClose={() => setPendingDeleteHouseId(null)}
        onConfirm={() => {
          if (pendingDeleteHouseId) onDeleteHouse(pendingDeleteHouseId);
          setPendingDeleteHouseId(null);
        }}
        title="Remove House"
        message="Remove this house? Students assigned to it will be unassigned."
        confirmLabel="Remove"
        variant="danger"
      />
    </div>
  );
}
