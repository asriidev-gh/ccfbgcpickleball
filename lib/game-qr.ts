import QRCode from "qrcode";

import {
  getGameRegisterUrl,
  getPublicAppBaseUrl,
  isLocalhostAppUrl,
} from "@/lib/app-url";
import { PickleGame } from "@/models/PickleGame";

type GameQrFields = {
  _id: unknown;
  gameId: string;
  registerUrl?: string | null;
  publicQrCodeDataUrl?: string | null;
};

export async function buildGameRegistrationQr(gameId: string) {
  const registerUrl = getGameRegisterUrl(getPublicAppBaseUrl(), gameId);
  const publicQrCodeDataUrl = await QRCode.toDataURL(registerUrl, {
    margin: 1,
    width: 360,
    errorCorrectionLevel: "M",
  });
  return { registerUrl, publicQrCodeDataUrl };
}

export function shouldRefreshGameQr(
  storedRegisterUrl: string | null | undefined,
  expectedRegisterUrl: string,
) {
  if (!storedRegisterUrl) return true;
  if (storedRegisterUrl !== expectedRegisterUrl) return true;
  if (isLocalhostAppUrl(storedRegisterUrl) && !isLocalhostAppUrl(expectedRegisterUrl)) return true;
  return false;
}

export async function ensureGameRegistrationQr(game: GameQrFields) {
  const expectedRegisterUrl = getGameRegisterUrl(getPublicAppBaseUrl(), game.gameId);
  let registerUrl = game.registerUrl ?? expectedRegisterUrl;
  let publicQrCodeDataUrl = game.publicQrCodeDataUrl;

  if (shouldRefreshGameQr(registerUrl, expectedRegisterUrl) || !publicQrCodeDataUrl) {
    const qr = await buildGameRegistrationQr(game.gameId);
    registerUrl = qr.registerUrl;
    publicQrCodeDataUrl = qr.publicQrCodeDataUrl;
    await PickleGame.updateOne(
      { _id: game._id },
      { $set: { registerUrl, publicQrCodeDataUrl } },
    );
  }

  return { registerUrl, publicQrCodeDataUrl };
}
