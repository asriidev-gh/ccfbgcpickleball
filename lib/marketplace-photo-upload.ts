import { v2 as cloudinary } from "cloudinary";

import { REGISTRATION_PHOTO_ACCEPT_TYPES } from "@/lib/registration-photo";

type PhotoUpload = {
  photoUrl: string;
  photoPublicId: string;
};

const MAX_MARKETPLACE_PHOTO_BYTES = 5 * 1024 * 1024;
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

export async function uploadMarketplaceListingPhoto(
  file: File,
  options: { userId: string; listingId: string },
): Promise<PhotoUpload> {
  const config = getCloudinaryConfig();
  if (!config) {
    throw new Error("Photo upload is not configured. Contact support.");
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("Please use a JPG, PNG, WebP, or GIF photo.");
  }

  if (file.size > MAX_MARKETPLACE_PHOTO_BYTES) {
    throw new Error("Photo must be 5 MB or smaller.");
  }

  cloudinary.config(config);

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const publicId = `${Date.now()}-listing`;

  const result = await new Promise<{
    secure_url: string;
    public_id: string;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `paddleflow/marketplace/${options.userId}/${options.listingId}`,
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

export async function uploadMarketplaceOrderPaymentProof(
  file: File,
  options: { gameId: string; playerId: string; listingId: string },
): Promise<PhotoUpload> {
  const config = getCloudinaryConfig();
  if (!config) {
    throw new Error("Photo upload is not configured. Contact support.");
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("Please use a JPG, PNG, WebP, or GIF image for payment proof.");
  }

  if (file.size > MAX_MARKETPLACE_PHOTO_BYTES) {
    throw new Error("Payment proof must be 5 MB or smaller.");
  }

  cloudinary.config(config);

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const publicId = `${Date.now()}-payment-proof`;

  const result = await new Promise<{
    secure_url: string;
    public_id: string;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `paddleflow/marketplace-orders/${options.gameId}/${options.playerId}/${options.listingId}`,
        public_id: publicId,
        resource_type: "image",
        overwrite: false,
        transformation: [{ width: 1600, height: 1600, crop: "limit", quality: "auto:good" }],
      },
      (error, uploadResult) => {
        if (error || !uploadResult?.secure_url || !uploadResult.public_id) {
          reject(error ?? new Error("Payment proof upload failed."));
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

export async function deleteMarketplacePhotos(publicIds: Iterable<string>) {
  const { deleteRegistrationPhotos } = await import("@/lib/cloudinary");
  await deleteRegistrationPhotos(publicIds);
}
