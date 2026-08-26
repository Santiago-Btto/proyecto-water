function parseLocalDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return null;

  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

export function isDashboardDateInRange({ date, range, currentDate }) {
  const recordDate = parseLocalDate(date);
  const today = parseLocalDate(currentDate);
  if (!recordDate || !today) return false;

  if (range === "mes") {
    return recordDate.getFullYear() === today.getFullYear()
      && recordDate.getMonth() === today.getMonth();
  }
  if (range !== "semana") return false;

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return recordDate >= weekStart && recordDate <= weekEnd;
}
