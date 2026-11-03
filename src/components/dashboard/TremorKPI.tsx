"use client";

import { Card, Metric, Text, BadgeDelta } from "@tremor/react";

export default function TremorKPI({
  label,
  value,
  hint,
  delta,
  deltaType = "moderateIncrease",
}: {
  label: string;
  value: string;
  hint?: string | null;
  delta?: string;
  deltaType?: "increase" | "moderateIncrease" | "decrease" | "moderateDecrease" | "unchanged";
}) {
  return (
    <Card className="ring-0 shadow-sm">
      <Text className="text-xs font-medium text-[var(--t3)]">{label}</Text>
      <Metric className="mt-1 text-[var(--t1)]">{value}</Metric>
      {hint && <Text className="mt-1 text-xs text-[var(--t3)]">{hint}</Text>}
      {delta && (
        <BadgeDelta deltaType={deltaType} className="mt-2">
          {delta}
        </BadgeDelta>
      )}
    </Card>
  );
}
