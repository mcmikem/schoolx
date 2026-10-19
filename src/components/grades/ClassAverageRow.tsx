"use client";

import { averageOfTotals, columnAverage, type StudentMarks } from "@/lib/grades/entry";

interface ClassAverageRowProps {
  marks: StudentMarks;
  studentIds: string[];
  assessmentTypes: readonly string[];
  competencyMode: boolean;
}

/** Footer cells for the mark sheet: per-column averages and the class mean. */
export function ClassAverageRow({ marks, studentIds, assessmentTypes, competencyMode }: ClassAverageRowProps) {
  const classAverage = averageOfTotals(marks, studentIds, competencyMode);

  return (
    <>
      <td className="px-8 py-4">
        <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Class Avg</span>
      </td>
      {assessmentTypes.map((type) => {
        const average = columnAverage(marks, studentIds, type);
        return (
          <td key={type} className="px-4 py-4 text-center">
            <span className={`text-sm font-bold ${average !== null ? "text-primary" : "text-on-surface-variant/50"}`}>
              {average !== null ? average : "—"}
            </span>
          </td>
        );
      })}
      <td className="px-4 py-4 text-center">
        <span className={`text-sm font-bold ${classAverage !== null ? "text-primary" : "text-on-surface-variant/50"}`}>
          {classAverage !== null ? classAverage : "—"}
        </span>
      </td>
      <td />
    </>
  );
}
