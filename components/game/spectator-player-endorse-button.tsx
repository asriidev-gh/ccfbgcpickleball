"use client";

import { ThumbsUp } from "lucide-react";

import { queuePlayerActionButtonClassName } from "@/components/game/queue-player-action-button-styles";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SpectatorPlayerEndorsementsCountButtonProps = {
  count: number;
  onClick: () => void;
  compact?: boolean;
  className?: string;
};

export function SpectatorPlayerEndorsementsCountButton({
  count,
  onClick,
  compact = false,
  className,
}: SpectatorPlayerEndorsementsCountButtonProps) {
  if (count <= 0) return null;

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={queuePlayerActionButtonClassName({
        compact,
        className: cn("queue-player-endorse-count-btn", className),
      })}
      onClick={onClick}
      aria-label={`${count} endorsements for this player`}
    >
      <ThumbsUp className={compact ? "size-3 shrink-0 xl:size-3.5" : "h-3.5 w-3.5"} aria-hidden />
      <span className="tabular-nums">{count}</span>
    </Button>
  );
}

type SpectatorPlayerEndorseButtonProps = {
  onClick: () => void;
  compact?: boolean;
  className?: string;
};

export function SpectatorPlayerEndorseButton({
  onClick,
  compact = false,
  className,
}: SpectatorPlayerEndorseButtonProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={queuePlayerActionButtonClassName({
        compact,
        className: cn("queue-player-endorse-btn", className),
      })}
      onClick={onClick}
      aria-label="Endorse player"
    >
      <ThumbsUp className={compact ? "size-3 shrink-0 xl:size-3.5" : "h-3.5 w-3.5"} aria-hidden />
      Endorse
    </Button>
  );
}
