export interface ParsedStudentScan {
  studentId?: string;
  studentNumber?: string;
}

export interface ParsedStaffScan {
  staffId?: string;
}

const UUID_REGEX =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function parseKeyValuePayload(value: string): Record<string, string> {
  const map: Record<string, string> = {};
  const parts = value.split("|").map((part) => part.trim());

  for (const part of parts) {
    const idx = part.indexOf(":");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 1).trim();
    if (key && val) map[key] = val;
  }

  return map;
}

function extractUuid(value: string): string | null {
  const match = value.match(UUID_REGEX);
  return match ? match[0] : null;
}

export function parseStudentScanValue(rawValue: string): ParsedStudentScan {
  const value = (rawValue || "").trim();
  if (!value) return {};

  const payload = parseKeyValuePayload(value);
  const payloadStudent =
    payload.student || payload.student_id || payload.id || payload.studentid;

  if (payloadStudent) {
    const id = extractUuid(payloadStudent);
    if (id) return { studentId: id };
    return { studentNumber: payloadStudent };
  }

  const directUuid = extractUuid(value);
  if (directUuid) return { studentId: directUuid };

  return { studentNumber: value };
}

export function parseStaffScanValue(rawValue: string): ParsedStaffScan {
  const value = (rawValue || "").trim();
  if (!value) return {};

  const payload = parseKeyValuePayload(value);
  const payloadStaff = payload.staff || payload.staff_id || payload.id;

  if (payloadStaff) {
    const id = extractUuid(payloadStaff);
    if (id) return { staffId: id };
  }

  const directUuid = extractUuid(value);
  if (directUuid) return { staffId: directUuid };

  return {};
}
