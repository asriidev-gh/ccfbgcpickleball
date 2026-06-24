"use client";

import { Share2 } from "lucide-react";

import { queuePlayerActionButtonClassName } from "@/components/game/queue-player-action-button-styles";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SpectatorPlayerCardShareButtonProps = {
  onOpen: () => void;
  compact?: boolean;
  className?: string;
};

export function SpectatorPlayerCardShareButton({
  onOpen,
  compact = false,
  className,
}: SpectatorPlayerCardShareButtonProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={queuePlayerActionButtonClassName({
        compact,
        className: cn("queue-player-share-btn", className),
      })}
      onClick={onOpen}
      aria-label="Share player card"
    >
      <Share2 className={compact ? "size-3 shrink-0 xl:size-3.5" : "h-3.5 w-3.5"} aria-hidden />
      Share
    </Button>
  );
}
