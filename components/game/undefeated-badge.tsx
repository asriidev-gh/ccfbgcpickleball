"use client";

import { Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type UndefeatedBadgeProps = {
  onClick?: () => void;
  className?: string;
};

export function UndefeatedBadge({ onClick, className }: UndefeatedBadgeProps) {
  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "queue-undefeated-badge whitespace-nowrap",
        onClick && "cursor-pointer transition-colors hover:bg-amber-500/20",
        className,
      )}
      aria-label="Undefeated — 3 or more wins, no losses"
    >
      <Trophy className="queue-undefeated-badge-icon" aria-hidden />
      <span className="queue-undefeated-badge-text">Undefeated</span>
    </Badge>
  );

  if (!onClick) return badge;

  return (
    <button
      type="button"
      className="inline-flex"
      onClick={onClick}
      aria-label="View undefeated player's match history"
    >
      {badge}
    </button>
  );
}
