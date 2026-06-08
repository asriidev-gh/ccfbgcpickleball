"use client";

import { Share2 } from "lucide-react";
import { type ComponentProps, useMemo, useState } from "react";

import { GameSpectatorShareDialog } from "@/components/game/game-spectator-share-dialog";
import { Button } from "@/components/ui/button";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { getClientSpectatorShareUrl } from "@/lib/app-url";
import { cn } from "@/lib/utils";

type GameSpectatorShareButtonProps = {
  gameId: string;
  gameTitle: string;
  iconOnly?: boolean;
} & Partial<Pick<ComponentProps<typeof Button>, "variant" | "size" | "className">>;

export function GameSpectatorShareButton({
  gameId,
  gameTitle,
  iconOnly = false,
  variant = "outline",
  size,
  className,
}: GameSpectatorShareButtonProps) {
  const [open, setOpen] = useState(false);
  const spectatorUrl = useMemo(() => getClientSpectatorShareUrl(gameId), [gameId]);

  const shareButton = iconOnly ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-9 shrink-0", className)}
      aria-label={`Share spectator view for ${gameTitle}`}
      onClick={() => setOpen(true)}
    >
      <Share2 className="h-4 w-4" aria-hidden />
    </Button>
  ) : (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() => setOpen(true)}
    >
      <Share2 className="mr-2 h-4 w-4 shrink-0" aria-hidden />
      Share spectator view
    </Button>
  );

  return (
    <>
      {iconOnly ? (
        <SimpleTooltip label="Share spectator view">
          <span>{shareButton}</span>
        </SimpleTooltip>
      ) : (
        shareButton
      )}
      <GameSpectatorShareDialog
        open={open}
        onOpenChange={setOpen}
        gameTitle={gameTitle}
        spectatorUrl={spectatorUrl}
      />
    </>
  );
}
