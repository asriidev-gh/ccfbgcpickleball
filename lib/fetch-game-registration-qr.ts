export type GameRegistrationQrPayload = {
  title?: string;
  registerUrl: string;
  publicQrCodeDataUrl: string;
};

export async function fetchGameRegistrationQr(gameId: string): Promise<GameRegistrationQrPayload> {
  const response = await fetch(`/api/games/${gameId}/qr`);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof payload.message === "string" ? payload.message : "Failed to load registration QR.",
    );
  }
  return payload as GameRegistrationQrPayload;
}
