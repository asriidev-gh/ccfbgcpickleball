"use client";

import {
  Clock,
  Gift,
  Handshake,
  Heart,
  Laugh,
  Lightbulb,
  Rocket,
  Scale,
  Smile,
  Star,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  PLAYER_ENDORSEMENT_BADGE_LABELS,
  type PlayerEndorsementBadge,
} from "@/lib/player-endorsement-shared";
import { cn } from "@/lib/utils";

export const PLAYER_ENDORSEMENT_BADGE_ICONS: Record<PlayerEndorsementBadge, LucideIcon> = {
  friendly: Smile,
  enthusiastic: Heart,
  competitive: Trophy,
  inspiring: Rocket,
  fair: Scale,
  organized: Star,
  punctual: Clock,
  funny: Laugh,
  smart: Lightbulb,
  focused: Target,
  generous: Gift,
  helpful: Handshake,
};

type PlayerEndorsementBadgeListProps = {
  badges: PlayerEndorsementBadge[];
  className?: string;
  compact?: boolean;
};

export function PlayerEndorsementBadgeList({
  badges,
  className,
  compact = false,
}: PlayerEndorsementBadgeListProps) {
  if (badges.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {badges.map((badge) => {
        const Icon = PLAYER_ENDORSEMENT_BADGE_ICONS[badge];
        return (
          <Badge
            key={badge}
            variant="outline"
            className={cn(
              "gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
              compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
            )}
          >
            <Icon className={compact ? "size-3" : "size-3.5"} aria-hidden />
            {PLAYER_ENDORSEMENT_BADGE_LABELS[badge]}
          </Badge>
        );
      })}
    </div>
  );
}
