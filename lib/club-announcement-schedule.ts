const CLUB_ANNOUNCEMENT_TIME_ZONE = "Asia/Manila";

export function getClubAnnouncementTodayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CLUB_ANNOUNCEMENT_TIME_ZONE }).format(date);
}

export function normalizeClubAnnouncementDateInput(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;

  const [year, month, day] = trimmed.split("-").map((part) => Number.parseInt(part, 10));
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return trimmed;
}

export function isClubAnnouncementVisibleToPlayers(
  postingDate: string | null | undefined,
  expirationDate: string | null | undefined,
  today = getClubAnnouncementTodayKey(),
) {
  const posting = postingDate?.trim() || null;
  const expiration = expirationDate?.trim() || null;
  if (posting && today < posting) return false;
  if (expiration && today >= expiration) return false;
  return true;
}

export function isClubAnnouncementExpiredForArchive(
  expirationDate: string | null | undefined,
  today = getClubAnnouncementTodayKey(),
) {
  const expiration = expirationDate?.trim() || null;
  return Boolean(expiration && today >= expiration);
}

export function buildPlayerVisibleClubAnnouncementFilter(today = getClubAnnouncementTodayKey()) {
  return {
    isPublished: true,
    isArchived: { $ne: true },
    $and: [
      { $or: [{ postingDate: null }, { postingDate: { $lte: today } }] },
      { $or: [{ expirationDate: null }, { expirationDate: { $gt: today } }] },
    ],
  };
}

export function formatClubAnnouncementDateLabel(dateKey: string | null | undefined) {
  const normalized = dateKey?.trim();
  if (!normalized) return null;
  const [year, month, day] = normalized.split("-").map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
