"use client";

type BoardClass = { id: string; name: string; level?: string | null };
type BoardEntry = {
  class_id: string;
  subject_id?: string | null;
  teacher_id?: string | null;
  day_of_week: number;
  period_number: number;
  room?: string | null;
  subjects?: { name?: string | null; code?: string | null } | null;
};
type BoardSlot = {
  name: string;
  start_time: string;
  end_time: string;
  order_number: number;
  is_lesson?: boolean;
  is_break?: boolean;
};

const DAYS = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
] as const;

function initials(name?: string | null) {
  if (!name) return "";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function time(value: string) {
  return value.slice(0, 5).replace(/^0/, "");
}

export default function KikunyuWallTimetable({
  schoolName,
  classes,
  entries,
  slots,
  teacherNames,
}: {
  schoolName?: string | null;
  classes: BoardClass[];
  entries: BoardEntry[];
  slots: BoardSlot[];
  teacherNames: Record<string, string>;
}) {
  const orderedClasses = [...classes].sort((a, b) => {
    const rank = (value: string) => {
      const upper = value.toUpperCase();
      if (/BABY/.test(upper)) return 0;
      if (/MIDDLE/.test(upper)) return 1;
      if (/TOP/.test(upper)) return 2;
      return Number(upper.match(/\d+/)?.[0] || 99) + 3;
    };
    return rank(a.name) - rank(b.name);
  });
  const entryFor = (day: number, classId: string, period: number) =>
    entries.find((entry) => entry.day_of_week === day && entry.class_id === classId && entry.period_number === period);
  const lessonSlots = slots.filter((slot) => slot.is_lesson !== false && !slot.is_break);

  return (
    <section className="overflow-hidden rounded-2xl border border-rose-200 bg-[#fff8fb] shadow-sm dark:border-rose-900/50 dark:bg-rose-950/20">
      <div className="border-b border-rose-200 bg-gradient-to-r from-rose-100 via-pink-50 to-amber-50 px-5 py-5 dark:border-rose-900/50 dark:from-rose-950/50 dark:via-slate-950 dark:to-amber-950/40">
        <p className="text-center text-xs font-black uppercase tracking-[0.28em] text-rose-700 dark:text-rose-300">
          Wall chart view
        </p>
        <h2 className="mt-1 text-center text-2xl font-black uppercase tracking-[0.12em] text-slate-900 dark:text-white">
          {schoolName || "School timetable"}
        </h2>
        <p className="mt-1 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
          Familiar day × class × time layout · subject code + teacher initials
        </p>
      </div>

      <div className="overflow-x-auto p-3 sm:p-5">
        <table className="min-w-[1100px] border-collapse text-[11px] text-slate-800 dark:text-slate-100">
          <thead>
            <tr>
              <th className="w-28 border border-slate-300 bg-slate-100 px-3 py-3 text-left font-black uppercase tracking-wider dark:border-slate-700 dark:bg-slate-900">
                Day
              </th>
              <th className="w-28 border border-slate-300 bg-slate-100 px-3 py-3 text-left font-black uppercase tracking-wider dark:border-slate-700 dark:bg-slate-900">
                Class
              </th>
              {slots.map((slot) => (
                <th
                  key={slot.order_number}
                  className={`min-w-[98px] border border-slate-300 px-2 py-2 text-center font-black dark:border-slate-700 ${slot.is_lesson === false || slot.is_break ? "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200" : "bg-white dark:bg-slate-900"}`}
                >
                  <span className="block">{slot.name}</span>
                  <span className="mt-1 block text-[10px] font-semibold opacity-70">
                    {time(slot.start_time)}–{time(slot.end_time)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map(([day, dayName]) =>
              orderedClasses.map((classItem, classIndex) => (
                <tr key={`${day}-${classItem.id}`}>
                  {classIndex === 0 && (
                    <th
                      rowSpan={Math.max(1, orderedClasses.length)}
                      className="border border-slate-300 bg-slate-900 px-3 py-4 text-left text-xl font-black uppercase text-white dark:border-slate-700"
                    >
                      {dayName}
                    </th>
                  )}
                  <th className="border border-slate-300 bg-white px-3 py-3 text-left font-black dark:border-slate-700 dark:bg-slate-950">
                    {classItem.name}
                  </th>
                  {slots.map((slot) => {
                    const isActivity = slot.is_lesson === false || slot.is_break;
                    const entry = isActivity ? null : entryFor(day, classItem.id, slot.order_number);
                    const code = entry?.subjects?.code || entry?.subjects?.name?.slice(0, 5).toUpperCase() || "";
                    const teacher = initials(entry?.teacher_id ? teacherNames[entry.teacher_id] : null);
                    return (
                      <td
                        key={slot.order_number}
                        className={`border border-slate-300 p-2 text-center align-middle dark:border-slate-700 ${isActivity ? "bg-rose-50 font-black uppercase text-rose-700 dark:bg-rose-950/40 dark:text-rose-200" : "bg-white dark:bg-slate-950"}`}
                      >
                        {isActivity ? (
                          slot.name
                        ) : entry ? (
                          <>
                            <span className="block font-black">{code}</span>
                            <span className="text-[10px] font-semibold opacity-70">
                              {teacher || "Needs assignment"}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
