import { v2 as cloudinary } from "cloudinary";

import { REGISTRATION_PHOTO_ACCEPT_TYPES } from "@/lib/registration-photo";

const MAX_ANNOUNCEMENT_IMAGE_BYTES = 5 * 1024 * 1024;
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

export async function uploadClubAnnouncementImage(
  file: File,
  options: { userId: string },
): Promise<{ photoUrl: string; photoPublicId: string }> {
  const config = getCloudinaryConfig();
  if (!config) {
    throw new Error("Image upload is not configured on this server.");
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("Please use a JPG, PNG, WebP, or GIF image.");
  }

  if (file.size > MAX_ANNOUNCEMENT_IMAGE_BYTES) {
    throw new Error("Image must be 5 MB or smaller.");
  }

  cloudinary.config(config);

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const publicId = `${Date.now()}-announcement`;

  const result = await new Promise<{
    secure_url: string;
    public_id: string;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `paddleflow/club-announcements/${options.userId}`,
        public_id: publicId,
        resource_type: "image",
        overwrite: false,
        transformation: [{ width: 1600, height: 1600, crop: "limit", quality: "auto:good" }],
      },
      (error, uploadResult) => {
        if (error || !uploadResult?.secure_url || !uploadResult.public_id) {
          reject(error ?? new Error("Image upload failed."));
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
