import { v2 as cloudinary } from "cloudinary";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

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

  if (file.size > MAX_PHOTO_BYTES) {
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
