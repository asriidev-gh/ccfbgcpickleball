import { getPlayerQrDownloadFilename } from "@/lib/player-qr";

export function getPlayerQrPngFilename(firstName: string, personalQrCode: string) {
  return getPlayerQrDownloadFilename(firstName, personalQrCode).replace(/\.svg$/i, ".png");
}

export function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Rasterize the labeled SVG preview to a PNG blob (2x for sharp printing). */
export function dataUrlToPngBlob(dataUrl: string, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (!width || !height) {
        reject(new Error("QR image could not be prepared for download."));
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;

      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("QR image could not be prepared for download."));
        return;
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.scale(scale, scale);
      context.drawImage(image, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("QR image could not be prepared for download."));
        },
        "image/png",
        1,
      );
    };
    image.onerror = () => reject(new Error("QR image could not be prepared for download."));
    image.src = dataUrl;
  });
}

export type SavePlayerQrResult = "shared" | "downloaded";

/**
 * On mobile, opens the system share sheet so the user can save to Photos/Downloads.
 * On desktop, triggers a normal PNG file download.
 */
export async function savePlayerQrPng(input: {
  dataUrl: string;
  filename: string;
}): Promise<SavePlayerQrResult> {
  const blob = await dataUrlToPngBlob(input.dataUrl);
  const file = new File([blob], input.filename, { type: "image/png" });

  if (
    isMobileDevice() &&
    typeof navigator.share === "function" &&
    navigator.canShare?.({ files: [file] })
  ) {
    await navigator.share({
      files: [file],
      title: "Personal QR ID",
    });
    return "shared";
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = input.filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
  return "downloaded";
}
