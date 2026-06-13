export const DGROUP_WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export type DgroupWeekday = (typeof DGROUP_WEEKDAYS)[number];

export const DGROUP_WEEKDAY_LABELS: Record<DgroupWeekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export function getDgroupTimeRangeError(timeFrom: string, timeTo: string): string | null {
  if (!timeFrom || !timeTo) return null;
  if (timeFrom >= timeTo) return "End time must be after start time.";
  return null;
}

export function formatDgroupAvailabilitySummary(
  days: string[],
  timeFrom: string,
  timeTo: string,
) {
  const labels = days
    .filter((day): day is DgroupWeekday => DGROUP_WEEKDAYS.includes(day as DgroupWeekday))
    .map((day) => DGROUP_WEEKDAY_LABELS[day].slice(0, 3));
  const dayPart = labels.length > 0 ? labels.join(", ") : "No days selected";
  const timePart = timeFrom && timeTo ? `${timeFrom} – ${timeTo}` : "";
  return timePart ? `${dayPart} · ${timePart}` : dayPart;
}
