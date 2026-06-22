export const CLUB_SLUG_MIN_LENGTH = 3;
export const CLUB_SLUG_MAX_LENGTH = 40;

const CLUB_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function hostFromAppUrl(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** Build `{host}/club` for display before the slug input. */
export function buildClubLinkPrefix(host: string) {
  const normalizedHost = host.trim().replace(/\/$/, "");
  return `${normalizedHost}/club`;
}

/** Server-safe fallback when `window` is unavailable. */
export function getClubLinkPrefixFallback() {
  const configured = process.env.NEXT_PUBLIC_CLUB_LINK_PREFIX?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    const host = hostFromAppUrl(appUrl);
    if (host) return buildClubLinkPrefix(host);
  }

  return buildClubLinkPrefix("localhost");
}

/** Prefer the live browser host; optional override via NEXT_PUBLIC_CLUB_LINK_PREFIX. */
export function getClubLinkPrefix(host?: string) {
  const configured = process.env.NEXT_PUBLIC_CLUB_LINK_PREFIX?.trim();
  if (configured) return configured.replace(/\/$/, "");

  if (host) return buildClubLinkPrefix(host);
  return getClubLinkPrefixFallback();
}

export function normalizeClubSlug(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function suggestClubSlugFromName(clubName: string) {
  return normalizeClubSlug(clubName);
}

export function validateClubSlug(slug: string): string | null {
  if (!slug) return "Club link is required.";
  if (slug.length < CLUB_SLUG_MIN_LENGTH) {
    return `Club link must be at least ${CLUB_SLUG_MIN_LENGTH} characters.`;
  }
  if (slug.length > CLUB_SLUG_MAX_LENGTH) {
    return `Club link must be at most ${CLUB_SLUG_MAX_LENGTH} characters.`;
  }
  if (!CLUB_SLUG_PATTERN.test(slug)) {
    return "Use lowercase letters, numbers, and hyphens only.";
  }
  return null;
}
