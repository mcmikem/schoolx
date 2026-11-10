const RESPONSE_TARGET_DAYS: Record<string, number> = {
  access: 7,
  correction: 7,
  deletion: 7,
  objection: 14,
};

/** Response target from the Uganda Data Protection and Privacy Regulations. */
export function getPrivacyRequestResponseTarget(type: string, createdAt: string): { days: number; dueAt: Date } | null {
  const days = RESPONSE_TARGET_DAYS[type];
  const created = new Date(createdAt);
  if (!days || Number.isNaN(created.getTime())) return null;
  return { days, dueAt: new Date(created.getTime() + days * 24 * 60 * 60 * 1000) };
}

export function isPrivacyRequestClosed(status: string): boolean {
  return status === "completed" || status === "declined";
}
