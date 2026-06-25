"use client";

import { Badge } from "@/components/ui/badge";
import { resolveGameFormatSettings } from "@/lib/game-format-settings";
import {
  getQuickPlayGameModeLabel,
  getQuickPlayQueueMatchingLabel,
  type QuickPlayGameMode,
  type QuickPlayMatchingType,
} from "@/lib/quick-play-wizard-shared";

type GameFormatHeaderBadgesProps = {
  gameMode?: QuickPlayGameMode | null;
  matchingType?: QuickPlayMatchingType | null;
};

export function GameFormatHeaderBadges({ gameMode, matchingType }: GameFormatHeaderBadgesProps) {
  const format = resolveGameFormatSettings({ gameMode, matchingType });

  return (
    <>
      <Badge variant="outline" className="game-dashboard-meta-badge w-fit">
        {getQuickPlayGameModeLabel(format.gameMode)}
      </Badge>
      <Badge variant="outline" className="game-dashboard-meta-badge w-fit">
        {getQuickPlayQueueMatchingLabel(format.gameMode, format.matchingType)}
      </Badge>
    </>
  );
}
