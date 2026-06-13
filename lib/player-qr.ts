import QRCode from "qrcode";

import {
  DEFAULT_QR_BRAND_NAME,
  type PlayerQrBranding,
} from "@/lib/player-qr-branding-shared";

const QR_SIZE = 360;
const TOP_BAND = 44;
const BOTTOM_BAND = 48;
const BOTTOM_BAND_WITH_SUBTITLE = 64;
const CLUB_LOGO_SIZE_RATIO = 0.2;
const CLUB_LOGO_PAD_RATIO = 0.15;

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

function parseViewBoxDimensions(viewBox: string) {
  const parts = viewBox.trim().split(/[\s,]+/).map(Number);
  if (parts.length >= 4 && parts[2] > 0 && parts[3] > 0) {
    return { width: parts[2], height: parts[3] };
  }
  return { width: QR_SIZE, height: QR_SIZE };
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

function buildClubLogoOverlay(
  viewBox: string,
  logoDataUrl: string,
) {
  const { width, height } = parseViewBoxDimensions(viewBox);
  const logoSize = Math.round(Math.min(width, height) * CLUB_LOGO_SIZE_RATIO);
  const pad = Math.max(1, Math.round(logoSize * CLUB_LOGO_PAD_RATIO));
  const frameSize = logoSize + pad * 2;
  const frameX = (width - frameSize) / 2;
  const frameY = (height - frameSize) / 2;

  return [
    `<rect x="${frameX}" y="${frameY}" width="${frameSize}" height="${frameSize}" fill="#ffffff"/>`,
    `<image href="${escapeXml(logoDataUrl)}" x="${frameX + pad}" y="${frameY + pad}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`,
  ].join("");
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
    clubLogoDataUrl?: string | null;
  },
) {
  const personalQrCodeTrimmed = personalQrCode.trim();

  const headerTitle = options.headerTitle?.trim() || options.appName?.trim() || DEFAULT_QR_BRAND_NAME;
  const brandSubtitle = options.brandSubtitle?.trim() || null;
  const registrantLabel = getRegistrantLabel(
    options.registrantFirstName ?? "",
    options.registrantLastName ?? null,
  );
  const includeClubLogo = Boolean(options.clubLogoDataUrl?.trim());

  const qrSvg = await QRCode.toString(personalQrCodeTrimmed, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: includeClubLogo ? "H" : "M",
    width: QR_SIZE,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });

  const { viewBox, inner, shapeRendering } = parseQrSvg(qrSvg);
  const clubLogoOverlay = includeClubLogo
    ? buildClubLogoOverlay(viewBox, options.clubLogoDataUrl!.trim())
    : "";
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
    clubLogoOverlay,
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
    includeClubLogo?: boolean;
    clubLogoUrl?: string | null;
  },
) {
  let clubLogoDataUrl: string | null = null;
  if (options.includeClubLogo && options.clubLogoUrl?.trim()) {
    clubLogoDataUrl = await fetchImageAsDataUrl(options.clubLogoUrl.trim());
  }

  return buildPlayerQrDataUrl(personalQrCode, {
    registrantFirstName: options.registrantFirstName,
    registrantLastName: options.registrantLastName,
    headerTitle: options.branding.headerTitle,
    brandSubtitle: options.branding.brandSubtitle,
    clubLogoDataUrl,
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
