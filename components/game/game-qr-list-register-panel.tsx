"use client";

import { GameQrTabletSquare } from "@/components/game/game-qr-tablet-square";
import { cn } from "@/lib/utils";

type GameQrListRegisterPanelProps = {
  gameId: string;
  gameTitle: string;
  /** Fits within a narrow column (e.g. card view 30% width). */
  compact?: boolean;
  className?: string;
};

export function GameQrListRegisterPanel({
  gameId,
  gameTitle,
  compact = false,
  className,
}: GameQrListRegisterPanelProps) {
  return (
    <div
      className={cn(
        "game-list-qr-panel flex w-full min-w-0 flex-col items-center justify-center border-2 border-border/80 bg-muted/35 shadow-sm",
        compact
          ? "max-w-[7.5rem] rounded-2xl px-1.5 py-1.5 sm:max-w-[8rem]"
          : "min-w-[11.5rem] rounded-3xl px-5 py-4 sm:min-w-[12.5rem]",
        className,
      )}
    >
      <GameQrTabletSquare
        gameId={gameId}
        gameTitle={gameTitle}
        embedded
        compact={compact}
      />
    </div>
  );
}
