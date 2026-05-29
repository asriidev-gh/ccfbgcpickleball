import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** First letter uppercase, rest lowercase (per word). */
export function capitalizeNameWord(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

export function capitalizeNameWords(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => capitalizeNameWord(word))
    .join(" ");
}

/** Demo/seed players use rank labels instead of fake names (Player1 CCF, etc.). */
export function isRankPlaceholderPlayer(firstName: string, lastName: string) {
  const first = firstName.trim();
  const last = lastName.trim();
  if (first === "Rank" && /^\d+$/.test(last)) return true;
  return /^Player\d+$/i.test(first) && last === "CCF";
}

/** Leaderboard/queue label — real registrations keep full name. */
export function formatPlayerDisplayName(
  firstName: string,
  lastName: string,
  rank?: number,
) {
  if (isRankPlaceholderPlayer(firstName, lastName)) {
    if (rank != null) return `Rank ${rank}`;
    const legacy = firstName.trim().match(/^Player(\d+)$/i);
    if (legacy) return `Rank ${legacy[1]}`;
    if (lastName.trim()) return `Rank ${lastName.trim()}`;
  }
  return `${capitalizeNameWords(firstName)} ${capitalizeNameWords(lastName)}`.trim();
}

/** Table view: rank is its own column — never repeat "Rank N" in the player cell. */
export function formatPlayerTableName(firstName: string, lastName: string) {
  if (isRankPlaceholderPlayer(firstName, lastName)) {
    const legacy = firstName.trim().match(/^Player(\d+)$/i);
    const num = legacy ? legacy[1] : lastName.trim();
    return num ? `Player ${num}` : "Unknown player";
  }
  return `${capitalizeNameWords(firstName)} ${capitalizeNameWords(lastName)}`.trim();
}
