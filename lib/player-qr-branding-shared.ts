export const DEFAULT_QR_BRAND_NAME = "PaddleFlowJ316";
export const MAX_PLAYER_QR_TITLE_LENGTH = 20;

export type PlayerQrBranding = {
  headerTitle: string;
  brandSubtitle: string | null;
};

export function buildPlayerQrBrandingFromTitle(
  customTitle: string | null | undefined,
): PlayerQrBranding {
  const trimmed = customTitle?.trim() ?? "";
  if (!trimmed) {
    return { headerTitle: DEFAULT_QR_BRAND_NAME, brandSubtitle: null };
  }

  return {
    headerTitle: trimmed.slice(0, MAX_PLAYER_QR_TITLE_LENGTH),
    brandSubtitle: DEFAULT_QR_BRAND_NAME,
  };
}
