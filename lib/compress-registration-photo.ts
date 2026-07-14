import { CLUB_LOGO_MAX_DIMENSION, MAX_CLUB_LOGO_BYTES } from "@/lib/club-settings-shared";
import {
  MAX_REGISTRATION_PHOTO_BYTES,
  REGISTRATION_PHOTO_COMPRESS_THRESHOLD_BYTES,
  REGISTRATION_PHOTO_MAX_DIMENSION,
} from "@/lib/registration-photo";

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this image."));
    };
    image.src = url;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

async function compressImageFile(
  file: File,
  options: {
    maxBytes: number;
    maxDimension: number;
    outputBaseName: string;
    tooLargeMessage: string;
  },
): Promise<File> {
  const image = await loadImageFromFile(file);
  const longest = Math.max(image.width, image.height);
  const needsResize = longest > options.maxDimension;
  const needsShrink = file.size > options.maxBytes;

  if (!needsResize && !needsShrink && file.type === "image/jpeg") {
    return file;
  }

  const scale = needsResize ? options.maxDimension / longest : 1;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not process this photo.");
  }
  context.drawImage(image, 0, 0, width, height);

  let quality = 0.88;
  let blob: Blob | null = null;
  while (quality >= 0.45) {
    blob = await canvasToJpegBlob(canvas, quality);
    if (blob && blob.size <= options.maxBytes) {
      break;
    }
    quality -= 0.08;
  }

  if (!blob || blob.size > options.maxBytes) {
    throw new Error(options.tooLargeMessage);
  }

  const baseName = file.name.replace(/\.[^.]+$/i, "") || options.outputBaseName;
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

/** Resize and compress camera/gallery photos so they fit the upload limit. */
export async function compressRegistrationPhoto(file: File): Promise<File> {
  return compressImageFile(file, {
    maxBytes: MAX_REGISTRATION_PHOTO_BYTES,
    maxDimension: REGISTRATION_PHOTO_MAX_DIMENSION,
    outputBaseName: "registration-photo",
    tooLargeMessage: "Could not compress this photo enough. Try a different picture.",
  });
}

export function shouldCompressRegistrationPhoto(file: File) {
  return file.size > REGISTRATION_PHOTO_COMPRESS_THRESHOLD_BYTES;
}

/** Resize and compress club logos to fit the 2 MB upload limit. */
export async function compressClubLogo(file: File): Promise<File> {
  return compressImageFile(file, {
    maxBytes: MAX_CLUB_LOGO_BYTES,
    maxDimension: CLUB_LOGO_MAX_DIMENSION,
    outputBaseName: "club-logo",
    tooLargeMessage: "Could not compress this logo enough. Try a smaller image.",
  });
}

export function shouldCompressClubLogo(file: File) {
  return file.size > MAX_CLUB_LOGO_BYTES;
}
