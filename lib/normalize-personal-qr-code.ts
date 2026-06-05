/** Extracts a stored personal QR code value from scanned QR text or URLs. */
export function normalizePersonalQrCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const fromQuery =
      url.searchParams.get("code") ??
      url.searchParams.get("personalQrCode") ??
      url.searchParams.get("qr");
    if (fromQuery?.trim()) return fromQuery.trim();

    const parts = url.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (last?.startsWith("P-")) return last.trim();
  } catch {
    /* plain text code */
  }

  return trimmed;
}
