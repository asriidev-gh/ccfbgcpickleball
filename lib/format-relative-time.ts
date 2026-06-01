import { formatDistanceToNow, type FormatDistanceToNowOptions } from "date-fns";

/** Relative time for queue/court player cards; uses "min"/"mins" instead of "minute(s)". */
export function formatRelativeTimeForCard(
  date: Date | string | number,
  options?: FormatDistanceToNowOptions,
) {
  return formatDistanceToNow(date, options)
    .replace(/\bminutes\b/g, "mins")
    .replace(/\bminute\b/g, "min");
}
