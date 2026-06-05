import QRCode from "qrcode";

import {
  DEFAULT_QR_BRAND_NAME,
  type PlayerQrBranding,
} from "@/lib/player-qr-branding-shared";

const QR_SIZE = 360;
const TOP_BAND = 44;
const BOTTOM_BAND = 48;
const BOTTOM_BAND_WITH_SUBTITLE = 64;

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function getRegistrantLabel(firstName: string, lastName?: string | null) {
  const first = firstName.trim();
  const last = lastName?.trim() ?? "";
  return last ? `${first} ${last}` : first;
}

function parseQrSvg(qrSvg: string) {
  const openTagMatch = qrSvg.match(/<svg([^>]*)>/i);
  const innerMatch = qrSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  const viewBoxMatch = openTagMatch?.[1]?.match(/viewBox="([^"]+)"/i);

  return {
    viewBox: viewBoxMatch?.[1] ?? `0 0 ${QR_SIZE} ${QR_SIZE}`,
    inner: innerMatch?.[1]?.trim() ?? "",
    shapeRendering: openTagMatch?.[1]?.match(/shape-rendering="([^"]+)"/i)?.[1] ?? "crispEdges",
  };
}

export async function buildPlayerQrDataUrl(
  personalQrCode: string,
  options: {
    registrantFirstName: string;
    registrantLastName?: string | null;
    headerTitle?: string;
    brandSubtitle?: string | null;
    /** @deprecated Use headerTitle instead */
    appName?: string;
  },
) {
  const personalQrCodeTrimmed = personalQrCode.trim();

  const headerTitle = options.headerTitle?.trim() || options.appName?.trim() || DEFAULT_QR_BRAND_NAME;
  const brandSubtitle = options.brandSubtitle?.trim() || null;
  const registrantLabel = getRegistrantLabel(
    options.registrantFirstName ?? "",
    options.registrantLastName ?? null,
  );

  const qrSvg = await QRCode.toString(personalQrCodeTrimmed, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    width: QR_SIZE,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });

  const { viewBox, inner, shapeRendering } = parseQrSvg(qrSvg);
  const bottomBand = brandSubtitle ? BOTTOM_BAND_WITH_SUBTITLE : BOTTOM_BAND;
  const totalHeight = TOP_BAND + QR_SIZE + bottomBand;
  const headerY = TOP_BAND / 2;
  const nameY = brandSubtitle ? TOP_BAND + QR_SIZE + 22 : TOP_BAND + QR_SIZE + bottomBand / 2;
  const subtitleY = TOP_BAND + QR_SIZE + 48;

  const labeledSvg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${QR_SIZE}" height="${totalHeight}" viewBox="0 0 ${QR_SIZE} ${totalHeight}">`,
    `<rect width="${QR_SIZE}" height="${totalHeight}" fill="#ffffff"/>`,
    `<text x="${QR_SIZE / 2}" y="${headerY}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="16" font-weight="600" fill="#333333">${escapeXml(headerTitle)}</text>`,
    `<svg x="0" y="${TOP_BAND}" width="${QR_SIZE}" height="${QR_SIZE}" viewBox="${viewBox}" shape-rendering="${shapeRendering}">`,
    inner,
    `</svg>`,
    `<text x="${QR_SIZE / 2}" y="${nameY}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#111111">${escapeXml(registrantLabel)}</text>`,
    brandSubtitle
      ? `<text x="${QR_SIZE / 2}" y="${subtitleY}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="11" font-weight="500" fill="#666666">${escapeXml(brandSubtitle)}</text>`
      : "",
    `</svg>`,
  ].join("");

  const base64 = Buffer.from(labeledSvg, "utf8").toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

export async function buildPlayerQrDataUrlWithBranding(
  personalQrCode: string,
  options: {
    registrantFirstName: string;
    registrantLastName?: string | null;
    branding: PlayerQrBranding;
  },
) {
  return buildPlayerQrDataUrl(personalQrCode, {
    registrantFirstName: options.registrantFirstName,
    registrantLastName: options.registrantLastName,
    headerTitle: options.branding.headerTitle,
    brandSubtitle: options.branding.brandSubtitle,
  });
}

export function getPlayerQrDownloadFilename(firstName: string, personalQrCode: string) {
  const safeName = firstName
    .trim()
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "player";
  const safeCode = personalQrCode.trim().replace(/[^\w-]+/g, "");
  return `pickleball-qr-${safeName}-${safeCode}.png`;
}
