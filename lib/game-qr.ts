import QRCode from "qrcode";

import {
  getGameRegisterUrl,
  getGameSpectatorUrl,
  getPublicAppBaseUrl,
  isLocalhostAppUrl,
} from "@/lib/app-url";
import { PickleGame } from "@/models/PickleGame";

type GameQrFields = {
  _id: unknown;
  gameId: string;
  status?: "draft" | "active" | "ended";
  allowQrRegistration?: boolean | null;
  registerUrl?: string | null;
  publicQrCodeDataUrl?: string | null;
};

export function getGamePublicUrl(baseUrl: string, gameId: string, allowQrRegistration = true) {
  return allowQrRegistration
    ? getGameRegisterUrl(baseUrl, gameId)
    : getGameSpectatorUrl(baseUrl, gameId);
}

export async function buildGameRegistrationQr(
  gameId: string,
  options?: { allowQrRegistration?: boolean },
) {
  const allowQrRegistration = options?.allowQrRegistration !== false;
  const registerUrl = getGamePublicUrl(getPublicAppBaseUrl(), gameId, allowQrRegistration);
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
  const allowQrRegistration =
    game.status === "ended" ? false : game.allowQrRegistration !== false;
  const expectedRegisterUrl = getGamePublicUrl(
    getPublicAppBaseUrl(),
    game.gameId,
    allowQrRegistration,
  );
  let registerUrl = game.registerUrl ?? expectedRegisterUrl;
  let publicQrCodeDataUrl = game.publicQrCodeDataUrl;

  if (shouldRefreshGameQr(registerUrl, expectedRegisterUrl) || !publicQrCodeDataUrl) {
    const qr = await buildGameRegistrationQr(game.gameId, { allowQrRegistration });
    registerUrl = qr.registerUrl;
    publicQrCodeDataUrl = qr.publicQrCodeDataUrl;
    await PickleGame.updateOne(
      { _id: game._id },
      { $set: { registerUrl, publicQrCodeDataUrl } },
    );
  }

  return { registerUrl, publicQrCodeDataUrl };
}
