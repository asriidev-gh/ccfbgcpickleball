export type OpenPlayMeridiem = "AM" | "PM";

const OPEN_PLAY_TIME_RANGE_PATTERN = /^(\d{1,2})(AM|PM) - (\d{1,2})(AM|PM)$/;

export function openPlayTimeToMinutes(hour: number, meridiem: OpenPlayMeridiem): number {
  if (!Number.isInteger(hour) || hour < 1 || hour > 12) {
    throw new Error("Hour must be between 1 and 12.");
  }

  if (hour === 12) {
    return meridiem === "AM" ? 0 : 12 * 60;
  }

  return meridiem === "AM" ? hour * 60 : (hour + 12) * 60;
}

export function formatOpenPlayTimeRange(
  fromHour: string | number,
  fromMeridiem: OpenPlayMeridiem,
  toHour: string | number,
  toMeridiem: OpenPlayMeridiem,
) {
  return `${fromHour}${fromMeridiem} - ${toHour}${toMeridiem}`;
}

export function validateOpenPlayTimeOrder(
  fromHour: string | number,
  fromMeridiem: OpenPlayMeridiem,
  toHour: string | number,
  toMeridiem: OpenPlayMeridiem,
): { ok: true } | { ok: false; message: string } {
  const fromHourNumber = typeof fromHour === "string" ? Number(fromHour) : fromHour;
  const toHourNumber = typeof toHour === "string" ? Number(toHour) : toHour;

  if (
    !Number.isInteger(fromHourNumber) ||
    fromHourNumber < 1 ||
    fromHourNumber > 12 ||
    !Number.isInteger(toHourNumber) ||
    toHourNumber < 1 ||
    toHourNumber > 12
  ) {
    return { ok: false, message: "Select a valid hour from 1 to 12." };
  }

  const fromMinutes = openPlayTimeToMinutes(fromHourNumber, fromMeridiem);
  const toMinutes = openPlayTimeToMinutes(toHourNumber, toMeridiem);

  if (toMinutes <= fromMinutes) {
    return {
      ok: false,
      message: `To time (${toHourNumber}${toMeridiem}) must be after from time (${fromHourNumber}${fromMeridiem}).`,
    };
  }

  return { ok: true };
}

export function parseOpenPlayTimeRange(value: string) {
  const match = OPEN_PLAY_TIME_RANGE_PATTERN.exec(value.trim());
  if (!match) return null;

  const fromHour = Number(match[1]);
  const fromMeridiem = match[2] as OpenPlayMeridiem;
  const toHour = Number(match[3]);
  const toMeridiem = match[4] as OpenPlayMeridiem;

  if (
    !Number.isInteger(fromHour) ||
    fromHour < 1 ||
    fromHour > 12 ||
    !Number.isInteger(toHour) ||
    toHour < 1 ||
    toHour > 12
  ) {
    return null;
  }

  return { fromHour, fromMeridiem, toHour, toMeridiem };
}

export function getTodayOpenPlayDateInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatOpenPlayDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type OpenPlayTimeFields = {
  openPlayFromHour: string;
  openPlayFromMeridiem: OpenPlayMeridiem | "";
  openPlayToHour: string;
  openPlayToMeridiem: OpenPlayMeridiem | "";
};

export function isOpenPlayTimeComplete(
  form: OpenPlayTimeFields,
): form is OpenPlayTimeFields & {
  openPlayFromMeridiem: OpenPlayMeridiem;
  openPlayToMeridiem: OpenPlayMeridiem;
} {
  return Boolean(
    form.openPlayFromHour &&
      form.openPlayFromMeridiem &&
      form.openPlayToHour &&
      form.openPlayToMeridiem,
  );
}

export function openPlayScheduleFieldsFromStored(
  openPlayDate: string | Date | null | undefined,
  openPlayTimeRange: string | null | undefined,
): { openPlayDate: string } & OpenPlayTimeFields {
  const parsed = openPlayTimeRange?.trim()
    ? parseOpenPlayTimeRange(openPlayTimeRange.trim())
    : null;

  return {
    openPlayDate:
      formatOpenPlayDateInputValue(openPlayDate) || getTodayOpenPlayDateInputValue(),
    openPlayFromHour: parsed ? String(parsed.fromHour) : "",
    openPlayFromMeridiem: parsed?.fromMeridiem ?? "",
    openPlayToHour: parsed ? String(parsed.toHour) : "",
    openPlayToMeridiem: parsed?.toMeridiem ?? "",
  };
}

export function formatOpenPlayDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function validateOpenPlayTimeRangeString(
  value: string,
): { ok: true } | { ok: false; message: string } {
  const parsed = parseOpenPlayTimeRange(value);
  if (!parsed) {
    return { ok: false, message: "Enter a valid open play time range." };
  }

  return validateOpenPlayTimeOrder(
    parsed.fromHour,
    parsed.fromMeridiem,
    parsed.toHour,
    parsed.toMeridiem,
  );
}
