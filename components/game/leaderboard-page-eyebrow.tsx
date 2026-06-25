import { Trophy } from "lucide-react";

import { cn } from "@/lib/utils";

export function LeaderboardPageEyebrow({ className }: { className?: string }) {
  return (
    <p className={cn("leaderboard-page-eyebrow", className)}>
      <span className="leaderboard-page-eyebrow__pill">
        <Trophy className="leaderboard-page-eyebrow__icon" aria-hidden />
        Leaderboard
      </span>
    </p>
  );
}
