export function toLocalDateString(date?: Date): string {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function toLocalISOString(date?: Date): string {
  return toLocalDateString(date) + "T00:00:00";
}