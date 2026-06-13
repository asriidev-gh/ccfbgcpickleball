export const MAX_CLUB_NAME_LENGTH = 80;
export const MAX_CLUB_TAGLINE_LENGTH = 120;
export const MAX_CLUB_MISSION_VISION_LENGTH = 2000;
export const MAX_CLUB_LOGO_BYTES = 2 * 1024 * 1024;
export const CLUB_LOGO_MAX_DIMENSION = 512;
export const MAX_CLUB_SOCIAL_URL_LENGTH = 240;

export type ClubSettings = {
  clubName: string;
  clubTagline: string;
  clubMissionVision: string;
  clubLogoUrl: string;
  clubFacebookUrl: string;
  clubInstagramUrl: string;
};

export function normalizeClubSocialUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return trimmed;
    }
    return url.href.replace(/\/$/, "");
  } catch {
    return trimmed;
  }
}

export function isValidClubSocialUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
