"use client";

import { GameQrListRegisterPanel } from "@/components/game/game-qr-list-register-panel";
import { gameListQrGridClass } from "@/lib/game-list-qr-grid";
import { cn } from "@/lib/utils";

export type GameListQrModeGame = {
  _id: string;
  title: string;
  gameId: string;
  openPlayType: string;
  status?: "draft" | "active" | "ended";
  updatedAt?: string;
  allowQrRegistration?: boolean;
};

type GameListQrModeProps = {
  games: GameListQrModeGame[];
  emptyMessage: string;
};

export function GameListQrMode({ games, emptyMessage }: GameListQrModeProps) {
  if (games.length === 0) {
    return <p className="text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div
      className={cn(
        "game-list-qr-mode grid w-full gap-4 sm:gap-5",
        gameListQrGridClass(games.length),
      )}
    >
      {games.map((game) => (
        <article
          key={game._id}
          className="game-list-qr-mode-item flex min-h-0 min-w-0 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-border/80 bg-muted/25 p-4 shadow-sm sm:p-5"
          aria-label={
            game.status === "ended"
              ? `Spectator QR for ${game.title}`
              : `Registration QR for ${game.title}`
          }
        >
          <header className="w-full min-w-0 space-y-1 text-center">
            <h3 className="text-base font-semibold leading-snug sm:text-lg">{game.title}</h3>
            <p className="text-sm text-muted-foreground">{game.openPlayType}</p>
          </header>
          <GameQrListRegisterPanel
            key={`${game.gameId}-${game.updatedAt ?? ""}-${game.status}-${game.allowQrRegistration ?? true}`}
            gameId={game.gameId}
            gameTitle={game.title}
            wall
            spectatorOnly={game.status === "ended"}
            className="w-full max-w-none flex-1"
          />
        </article>
      ))}
    </div>
  );
}
