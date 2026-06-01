"use client";

import { GameQrListRegisterPanel } from "@/components/game/game-qr-list-register-panel";

type GameQrRegistrationSlotProps = {
  gameId: string;
  gameTitle: string;
  compact?: boolean;
  spectatorOnly?: boolean;
};

export function GameQrRegistrationSlot({
  gameId,
  gameTitle,
  compact = false,
  spectatorOnly = false,
}: GameQrRegistrationSlotProps) {
  return (
    <GameQrListRegisterPanel
      gameId={gameId}
      gameTitle={gameTitle}
      compact={compact}
      spectatorOnly={spectatorOnly}
    />
  );
}
