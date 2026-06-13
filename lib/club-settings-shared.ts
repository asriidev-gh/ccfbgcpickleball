export const MAX_CLUB_NAME_LENGTH = 80;
export const MAX_CLUB_TAGLINE_LENGTH = 120;
export const MAX_CLUB_ADDITIONAL_INFO_LENGTH = 300;
export const MAX_CLUB_MISSION_VISION_LENGTH = 2000;
export const MAX_CLUB_LOGO_BYTES = 2 * 1024 * 1024;
export const CLUB_LOGO_MAX_DIMENSION = 512;
export const MAX_CLUB_SOCIAL_URL_LENGTH = 240;
export const MAX_CLUB_ADDRESS_LENGTH = 500;
export const MAX_CLUB_GOOGLE_MAP_EMBED_URL_LENGTH = 2000;

export type ClubSettings = {
  clubName: string;
  clubTagline: string;
  clubAdditionalInfo: string;
  clubMissionVision: string;
  clubLogoUrl: string;
  clubFacebookUrl: string;
  clubInstagramUrl: string;
  clubAddress: string;
  clubGoogleMapEmbedUrl: string;
};

export function normalizeClubGoogleMapEmbedUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const iframeMatch = trimmed.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  const candidate = (iframeMatch?.[1] ?? trimmed).trim();

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return "";
    const host = url.hostname.replace(/^www\./, "");
    if (host !== "google.com") return "";
    if (!url.pathname.startsWith("/maps/embed")) return "";
    return url.href;
  } catch {
    return "";
  }
}

export function isValidClubGoogleMapEmbedUrl(value: string) {
  if (!value.trim()) return true;
  return normalizeClubGoogleMapEmbedUrl(value).length > 0;
}

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
