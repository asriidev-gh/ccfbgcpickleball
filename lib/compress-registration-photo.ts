import {
  MAX_REGISTRATION_PHOTO_BYTES,
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

/** Resize and compress camera/gallery photos so they fit the upload limit. */
export async function compressRegistrationPhoto(file: File): Promise<File> {
  const image = await loadImageFromFile(file);
  const longest = Math.max(image.width, image.height);
  const needsResize = longest > REGISTRATION_PHOTO_MAX_DIMENSION;
  const needsShrink = file.size > MAX_REGISTRATION_PHOTO_BYTES;

  if (!needsResize && !needsShrink && file.type === "image/jpeg") {
    return file;
  }

  const scale = needsResize ? REGISTRATION_PHOTO_MAX_DIMENSION / longest : 1;
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
    if (blob && blob.size <= MAX_REGISTRATION_PHOTO_BYTES) {
      break;
    }
    quality -= 0.08;
  }

  if (!blob || blob.size > MAX_REGISTRATION_PHOTO_BYTES) {
    throw new Error("Could not compress this photo enough. Try a different picture.");
  }

  const baseName = file.name.replace(/\.[^.]+$/i, "") || "registration-photo";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export function shouldCompressRegistrationPhoto(file: File) {
  return file.size > MAX_REGISTRATION_PHOTO_BYTES;
}
