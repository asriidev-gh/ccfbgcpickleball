import { toPng } from "html-to-image";

export async function captureElementAsPng(
  element: HTMLElement,
  options?: { pixelRatio?: number },
): Promise<string> {
  return toPng(element, {
    cacheBust: true,
    pixelRatio: options?.pixelRatio ?? 2,
    skipAutoScale: true,
  });
}

export async function dataUrlToPngFile(dataUrl: string, filename: string): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], filename, { type: "image/png" });
}

export function downloadImageFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}

export async function shareImageFile(file: File, title: string): Promise<"shared" | "downloaded"> {
  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title });
    return "shared";
  }

  downloadImageFile(file);
  return "downloaded";
}
