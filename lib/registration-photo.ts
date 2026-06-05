export const REGISTRATION_PHOTO_REQUIRED_MESSAGE = "A photo is required.";

export const MAX_REGISTRATION_PHOTO_BYTES = 5 * 1024 * 1024;

export const REGISTRATION_PHOTO_ACCEPT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type RegistrationPhotoMimeType = (typeof REGISTRATION_PHOTO_ACCEPT_TYPES)[number];

export const REGISTRATION_PHOTO_MAX_DIMENSION = 1200;

export function isAcceptedRegistrationPhotoType(type: string): type is RegistrationPhotoMimeType {
  return (REGISTRATION_PHOTO_ACCEPT_TYPES as readonly string[]).includes(type);
}
