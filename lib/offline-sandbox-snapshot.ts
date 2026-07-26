import type { OperatorFullPayload } from "@/lib/operator-payload";

/** Deep-clone JSON-safe operator payload for an offline sandbox session. */
export function cloneOperatorPayloadForOfflineSandbox(
  live: OperatorFullPayload,
  offlineGameId: string,
): OperatorFullPayload {
  const cloned = structuredClone(live) as OperatorFullPayload;
  const liveTitle = cloned.game.title?.trim() || "Open play";
  const offlineTitle = liveTitle.startsWith("OFFLINE —")
    ? liveTitle
    : `OFFLINE — ${liveTitle}`;

  return {
    ...cloned,
    game: {
      ...cloned.game,
      gameId: offlineGameId,
      title: offlineTitle,
      // Never treat this as a live DB queue session.
      liveQueue: false,
      quickGamePersistence: "ephemeral",
      // Offline sandbox should not invite QR check-ins to a fake game id.
      allowQrRegistration: false,
      registerUrl: undefined,
      publicQrCodeDataUrl: undefined,
    },
  };
}
