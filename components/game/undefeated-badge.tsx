"use client";

import { Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type UndefeatedBadgeProps = {
  onClick?: () => void;
  className?: string;
  /** Hide the "Undefeated" label and keep the trophy icon. */
  iconOnly?: boolean;
};

export function UndefeatedBadge({ onClick, className, iconOnly = false }: UndefeatedBadgeProps) {
  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "queue-undefeated-badge whitespace-nowrap",
        iconOnly && "queue-undefeated-badge--icon-only px-1.5",
        onClick && "cursor-pointer transition-colors hover:bg-amber-500/20",
        className,
      )}
      aria-label="Undefeated — 3 or more wins, no losses"
      title="Undefeated"
    >
      <Trophy className="queue-undefeated-badge-icon" aria-hidden />
      {iconOnly ? null : <span className="queue-undefeated-badge-text">Undefeated</span>}
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
