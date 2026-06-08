import Link from "next/link";
import { Gauge, LayoutGrid, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { isDemoOpenPlayTitle } from "@/lib/demo-open-play";
import {
  formatOpenPlayDate,
  formatOpenPlayStartTimeDisplay,
} from "@/lib/open-play-time-range";
import { cn } from "@/lib/utils";

import type { HomeGameSummary } from "./home-game-summary";

function DemoOnlyBadge() {
  return (
    <Badge
      variant="outline"
      className="shrink-0 rounded-full border-amber-500/40 bg-amber-500/10 px-2 py-0 text-[0.625rem] font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-200"
    >
      Demo
    </Badge>
  );
}

export function HomeSessionSummaryCard({
  game,
  variant,
}: {
  game: HomeGameSummary;
  variant: "active" | "past";
}) {
  const timeLabel = formatOpenPlayStartTimeDisplay(game.openPlayTimeRange);
  const dateLabel = formatOpenPlayDate(game.openPlayDate);
  const isDemo = isDemoOpenPlayTitle(game.title);

  return (
    <Link
      href={`/games/${game.gameId}`}
      className="home-session-summary group block rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        {timeLabel ? (
          <time className="home-session-summary__time shrink-0 pt-0.5 text-sm font-semibold text-foreground">
            {timeLabel}
          </time>
        ) : (
          <span className="home-session-summary__time shrink-0 pt-0.5 text-sm font-semibold text-muted-foreground">
            —
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold leading-snug text-foreground group-hover:text-primary">
                  {game.title}
                </h3>
                {isDemo ? <DemoOnlyBadge /> : null}
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Gauge className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {game.openPlayType}
              </p>
            </div>
            <Badge
              variant="secondary"
              className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary"
            >
              {game.expectedPlayers}
              {game.strictPlayerCount ? "" : "+"}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <LayoutGrid className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {game.courtCount} {game.courtCount === 1 ? "court" : "courts"}
            </span>
            {dateLabel ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {dateLabel}
              </span>
            ) : null}
          </div>

          <Badge
            variant="outline"
            className={cn(
              "rounded-full text-xs font-medium",
              variant === "active"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-border text-muted-foreground",
            )}
          >
            {variant === "active" ? (game.status === "draft" ? "Draft" : "Active") : "Ended"}
          </Badge>
        </div>
      </div>
    </Link>
  );
}
