import { hasMeaningfulLastName } from "@/lib/utils";

/** Dice Bear styles — picked deterministically per player so the avatar stays stable. */
const AVATAR_STYLES = [
  "avataaars",
  "lorelei",
  "notionists",
  "fun-emoji",
  "thumbs",
  "micah",
  "adventurer",
] as const;

export type PlayerAvatarSeed = {
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  photoPublicId?: string | null;
  personalQrCode?: string;
  _id?: string;
  gender?: string;
  openPlayLevel?: string;
};

function hashCode(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getAvatarSeed(player: PlayerAvatarSeed) {
  const first = player.firstName.trim();
  const last = player.lastName.trim();
  const nameSeed = hasMeaningfulLastName(last) ? `${first}-${last}` : first;
  return player.personalQrCode?.trim() || (player._id != null ? String(player._id) : "") || nameSeed;
}

export function getGeneratedAvatarUrl(seed: string, size = 256) {
  const style = AVATAR_STYLES[hashCode(seed) % AVATAR_STYLES.length];
  return `https://api.dicebear.com/9.x/${style}/png?seed=${encodeURIComponent(seed)}&size=${size}`;
}

export const GENERATED_AVATAR_PUBLIC_ID = "generated";

export type PlayerPhotoSource = {
  photoUrl?: string | null;
  photoPublicId?: string | null;
};

export function isUploadedPlayerPhoto(player: PlayerPhotoSource) {
  const publicId = player.photoPublicId?.trim();
  if (!publicId || publicId === GENERATED_AVATAR_PUBLIC_ID) return false;
  return Boolean(player.photoUrl?.trim());
}

export function resolvePlayerPhotoUrl(player: PlayerAvatarSeed, size = 256) {
  const url = player.photoUrl?.trim();
  const publicId = player.photoPublicId?.trim();

  if (url && publicId === GENERATED_AVATAR_PUBLIC_ID) {
    return url;
  }

  if (url && publicId && publicId !== GENERATED_AVATAR_PUBLIC_ID) {
    return url;
  }

  if (url && !publicId && url.includes("res.cloudinary.com")) {
    return url;
  }

  return getGeneratedAvatarUrl(getAvatarSeed(player), size);
}
