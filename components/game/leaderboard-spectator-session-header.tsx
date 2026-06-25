import { CalendarDays, Clock, Loader2, MapPin } from "lucide-react";

import { LeaderboardPageEyebrow } from "@/components/game/leaderboard-page-eyebrow";
import { Badge } from "@/components/ui/badge";
import type { SpectateGameSummary } from "@/lib/spectate-payload";
import { formatOpenPlayDate, formatVenueShareLabel } from "@/lib/open-play-time-range";

type LeaderboardSpectatorSessionHeaderProps = {
  game?: SpectateGameSummary | null;
  loading?: boolean;
};

export function LeaderboardSpectatorSessionHeader({
  game,
  loading = false,
}: LeaderboardSpectatorSessionHeaderProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        <LeaderboardPageEyebrow />
        <p className="caption flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Loading session…
        </p>
      </div>
    );
  }

  if (!game) {
    return <LeaderboardPageEyebrow />;
  }

  const openPlayDateLabel = formatOpenPlayDate(game.openPlayDate);
  const openPlayTimeLabel = game.openPlayTimeRange?.trim() || null;
  const venueLabel = formatVenueShareLabel(game.venueName, game.venueAddress);

  return (
    <div className="min-w-0 space-y-2">
      <h1 className="page-title">{game.title}</h1>
      <div className="flex flex-wrap items-center gap-2">
        {openPlayDateLabel ? (
          <Badge variant="outline" className="game-dashboard-meta-badge w-fit">
            <CalendarDays className="mr-1 size-3 shrink-0" aria-hidden />
            {openPlayDateLabel}
          </Badge>
        ) : null}
        {openPlayTimeLabel ? (
          <Badge variant="outline" className="game-dashboard-meta-badge w-fit">
            <Clock className="mr-1 size-3 shrink-0" aria-hidden />
            {openPlayTimeLabel}
          </Badge>
        ) : null}
        {venueLabel ? (
          <Badge variant="outline" className="game-dashboard-meta-badge w-fit max-w-full">
            <MapPin className="mr-1 size-3 shrink-0" aria-hidden />
            <span className="truncate">{venueLabel}</span>
          </Badge>
        ) : null}
        {game.status === "ended" ? (
          <Badge variant="destructive" className="game-dashboard-meta-badge w-fit">
            Ended
          </Badge>
        ) : null}
      </div>
      <LeaderboardPageEyebrow />
    </div>
  );
}
