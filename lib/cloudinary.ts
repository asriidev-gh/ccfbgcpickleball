import { v2 as cloudinary } from "cloudinary";

import { GENERATED_AVATAR_PUBLIC_ID } from "@/lib/player-avatar-url";
import { MAX_CLUB_LOGO_BYTES } from "@/lib/club-settings-shared";
import {
  MAX_REGISTRATION_PHOTO_BYTES,
  REGISTRATION_PHOTO_ACCEPT_TYPES,
} from "@/lib/registration-photo";

const ALLOWED_MIME_TYPES = new Set<string>(REGISTRATION_PHOTO_ACCEPT_TYPES);

function getCloudinaryConfig() {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const api_key = process.env.CLOUDINARY_API_KEY?.trim();
  const api_secret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloud_name || !api_key || !api_secret) {
    return null;
  }
  return { cloud_name, api_key, api_secret };
}

export function isCloudinaryConfigured() {
  return getCloudinaryConfig() !== null;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export type RegistrationPhotoUpload = {
  photoUrl: string;
  photoPublicId: string;
};

export async function uploadRegistrationPhoto(
  file: File,
  options: { gameId: string; firstName: string; lastName: string },
): Promise<RegistrationPhotoUpload> {
  const config = getCloudinaryConfig();
  if (!config) {
    throw new Error("Photo upload is not configured. Contact the event organizer.");
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("Please use a JPG, PNG, WebP, or GIF photo.");
  }

  if (file.size > MAX_REGISTRATION_PHOTO_BYTES) {
    throw new Error("Photo must be 5 MB or smaller.");
  }

  cloudinary.config(config);

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const nameSlug = slugify(`${options.firstName}-${options.lastName}`) || "registrant";
  const publicId = `${Date.now()}-${nameSlug}`;

  const result = await new Promise<{
    secure_url: string;
    public_id: string;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `paddleflow/registrations/${options.gameId}`,
        public_id: publicId,
        resource_type: "image",
        overwrite: false,
        transformation: [{ width: 1200, height: 1200, crop: "limit", quality: "auto:good" }],
      },
      (error, uploadResult) => {
        if (error || !uploadResult?.secure_url || !uploadResult.public_id) {
          reject(error ?? new Error("Photo upload failed."));
          return;
        }
        resolve({
          secure_url: uploadResult.secure_url,
          public_id: uploadResult.public_id,
        });
      },
    );
    stream.end(buffer);
  });

  return {
    photoUrl: result.secure_url,
    photoPublicId: result.public_id,
  };
}

export async function uploadProfilePhoto(
  file: File,
  options: { gameId: string; playerId: string; firstName: string; lastName: string },
): Promise<RegistrationPhotoUpload> {
  const config = getCloudinaryConfig();
  if (!config) {
    throw new Error("Photo upload is not configured. Contact support.");
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("Please use a JPG, PNG, WebP, or GIF photo.");
  }

  if (file.size > MAX_REGISTRATION_PHOTO_BYTES) {
    throw new Error("Photo must be 5 MB or smaller.");
  }

  cloudinary.config(config);

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const nameSlug = slugify(`${options.firstName}-${options.lastName}`) || "profile";
  const publicId = `${Date.now()}-${nameSlug}`;

  const result = await new Promise<{
    secure_url: string;
    public_id: string;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `paddleflow/player-profiles/${options.gameId}/${options.playerId}`,
        public_id: publicId,
        resource_type: "image",
        overwrite: false,
        transformation: [{ width: 1200, height: 1200, crop: "limit", quality: "auto:good" }],
      },
      (error, uploadResult) => {
        if (error || !uploadResult?.secure_url || !uploadResult.public_id) {
          reject(error ?? new Error("Photo upload failed."));
          return;
        }
        resolve({
          secure_url: uploadResult.secure_url,
          public_id: uploadResult.public_id,
        });
      },
    );
    stream.end(buffer);
  });

  return {
    photoUrl: result.secure_url,
    photoPublicId: result.public_id,
  };
}

export async function uploadClubLogo(
  file: File,
  options: { userId: string },
): Promise<RegistrationPhotoUpload> {
  const config = getCloudinaryConfig();
  if (!config) {
    throw new Error("Logo upload is not configured. Contact support.");
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("Please use a JPG, PNG, WebP, or GIF image.");
  }

  if (file.size > MAX_CLUB_LOGO_BYTES) {
    throw new Error("Logo must be 2 MB or smaller.");
  }

  cloudinary.config(config);

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const publicId = `${Date.now()}-club-logo`;

  const result = await new Promise<{
    secure_url: string;
    public_id: string;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `paddleflow/club-logos/${options.userId}`,
        public_id: publicId,
        resource_type: "image",
        overwrite: false,
        transformation: [{ width: 512, height: 512, crop: "limit", quality: "auto:good" }],
      },
      (error, uploadResult) => {
        if (error || !uploadResult?.secure_url || !uploadResult.public_id) {
          reject(error ?? new Error("Logo upload failed."));
          return;
        }
        resolve({
          secure_url: uploadResult.secure_url,
          public_id: uploadResult.public_id,
        });
      },
    );
    stream.end(buffer);
  });

  return {
    photoUrl: result.secure_url,
    photoPublicId: result.public_id,
  };
}

export async function uploadClubOrganizerPhoto(
  file: File,
  options: { userId: string; index: number },
): Promise<RegistrationPhotoUpload> {
  const config = getCloudinaryConfig();
  if (!config) {
    throw new Error("Photo upload is not configured. Contact support.");
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("Please use a JPG, PNG, WebP, or GIF image.");
  }

  if (file.size > MAX_CLUB_LOGO_BYTES) {
    throw new Error("Organizer photo must be 2 MB or smaller.");
  }

  cloudinary.config(config);

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const publicId = `${Date.now()}-organizer-${options.index}`;

  const result = await new Promise<{
    secure_url: string;
    public_id: string;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `paddleflow/club-organizers/${options.userId}`,
        public_id: publicId,
        resource_type: "image",
        overwrite: false,
        transformation: [{ width: 512, height: 512, crop: "limit", quality: "auto:good" }],
      },
      (error, uploadResult) => {
        if (error || !uploadResult?.secure_url || !uploadResult.public_id) {
          reject(error ?? new Error("Photo upload failed."));
          return;
        }
        resolve({
          secure_url: uploadResult.secure_url,
          public_id: uploadResult.public_id,
        });
      },
    );
    stream.end(buffer);
  });

  return {
    photoUrl: result.secure_url,
    photoPublicId: result.public_id,
  };
}

/** Removes uploaded registration images from Cloudinary (no-op if not configured). */
export async function deleteRegistrationPhotos(publicIds: Iterable<string>) {
  const config = getCloudinaryConfig();
  if (!config) return;

  const unique = [
    ...new Set(
      [...publicIds]
        .map((id) => id.trim())
        .filter((id) => id && id !== GENERATED_AVATAR_PUBLIC_ID),
    ),
  ];
  if (unique.length === 0) return;

  cloudinary.config(config);
  await Promise.all(
    unique.map(
      (publicId) =>
        new Promise<void>((resolve) => {
          cloudinary.uploader.destroy(publicId, { resource_type: "image" }, (error) => {
            if (error) {
              console.error(`Cloudinary delete failed for ${publicId}:`, error);
            }
            resolve();
          });
        }),
    ),
  );
}
