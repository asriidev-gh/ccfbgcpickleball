import jsQR from "jsqr";

import { normalizePersonalQrCode } from "@/lib/normalize-personal-qr-code";

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image."));
    };
    image.src = url;
  });
}

function decodeFromImageData(imageData: ImageData): string | null {
  const result = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "attemptBoth",
  });
  if (!result?.data) return null;
  const code = normalizePersonalQrCode(result.data);
  return code || null;
}

export async function decodeQrCodeFromImageFile(file: File): Promise<string> {
  const image = await loadImageElement(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not read image.");

  const maxEdge = 1024;
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const code = decodeFromImageData(imageData);
  if (!code) throw new Error("Could not read QR code. Try a clearer photo.");
  return code;
}
