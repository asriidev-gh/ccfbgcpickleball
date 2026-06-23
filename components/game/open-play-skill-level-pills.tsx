"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { getOpenPlayTypeDisplayLevels } from "@/lib/open-play-types";
import { cn } from "@/lib/utils";

type OpenPlaySkillLevelPillsProps = {
  openPlayType: string;
  className?: string;
  badgeClassName?: string;
};

export function OpenPlaySkillLevelPills({
  openPlayType,
  className,
  badgeClassName,
}: OpenPlaySkillLevelPillsProps) {
  const levels = useMemo(() => getOpenPlayTypeDisplayLevels(openPlayType), [openPlayType]);

  if (levels.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 sm:gap-2", className)}>
      {levels.map((level) => (
        <Badge
          key={level}
          variant="outline"
          className={cn("game-dashboard-meta-badge w-fit", badgeClassName)}
        >
          {level}
        </Badge>
      ))}
    </div>
  );
}
