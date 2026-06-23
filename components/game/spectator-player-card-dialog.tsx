"use client";

import { Loader2, Share2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { SpectatorPlayerShareCard } from "@/components/game/spectator-player-share-card";
import { useAppTheme } from "@/components/theme/theme-manager";
import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getPlayerLeaderboardRank } from "@/lib/games-played-map";
import {
  captureElementAsPng,
  dataUrlToPngFile,
  shareImageFile,
} from "@/lib/share-player-card-image";
import {
  formatSpectatorPlayerGender,
  formatSpectatorPlayerRank,
  formatSpectatorPlayerSkillLevel,
  type SpectatorPlayerCardPlayer,
} from "@/lib/spectator-player-card-shared";
import { resolvePlayerPhotoUrl } from "@/lib/player-avatar-url";
import { trackSpectatorPlayerCardShare } from "@/lib/fetch-spectate-player-card-share";
import { getShareCardSiteLabel } from "@/lib/share-card-site-label";
import { formatPlayerDisplayName } from "@/lib/utils";

type SpectatorPlayerCardDialogProps = {
  gameId: string;
  entry: QueueEntryView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameTitle?: string;
  clubName?: string | null;
  clubLogoUrl?: string | null;
  clubTagline?: string | null;
  openPlaySchedule?: string | null;
  leaderboardRankMap?: Map<string, number>;
};

function slugifyFilename(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function SpectatorPlayerCardDialog({
  gameId,
  entry,
  open,
  onOpenChange,
  gameTitle,
  clubName,
  clubLogoUrl,
  clubTagline,
  openPlaySchedule,
  leaderboardRankMap,
}: SpectatorPlayerCardDialogProps) {
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const theme = useAppTheme();
  const siteLabel = useMemo(() => getShareCardSiteLabel(), []);

  const player = entry?.playerId as SpectatorPlayerCardPlayer | undefined;
  const displayName = player
    ? formatPlayerDisplayName(player.firstName, player.lastName) || "Player"
    : "Player";
  const wins = entry?.wins ?? 0;
  const losses = entry?.losses ?? 0;
  const rank =
    player && leaderboardRankMap
      ? getPlayerLeaderboardRank(leaderboardRankMap, player)
      : null;
  const photoUrl = player ? resolvePlayerPhotoUrl(player, 320) : "";

  const handleShare = async () => {
    const node = shareCardRef.current;
    const queueEntryId = entry?._id;
    if (!node || !player || !queueEntryId) return;

    try {
      setSharing(true);
      const dataUrl = await captureElementAsPng(node);
      const file = await dataUrlToPngFile(
        dataUrl,
        `${slugifyFilename(displayName) || "player"}-card.png`,
      );
      const result = await shareImageFile(file, `${displayName} — open play stats`);
      toast.success(
        result === "shared" ? "Player card shared." : "Player card downloaded.",
      );
      if (gameId) {
        void trackSpectatorPlayerCardShare(gameId, queueEntryId).catch(() => {
          // Share already succeeded; tracking is best-effort for organizers.
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(
        error instanceof Error ? error.message : "Could not create share image.",
      );
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0 sm:max-w-lg">
        {entry && player ? (
          <>
            <DialogHeader className="border-b px-5 py-4">
              <DialogTitle>{displayName}</DialogTitle>
              <DialogDescription>
                {openPlaySchedule
                  ? `Session stats · ${openPlaySchedule}`
                  : "Session stats for this open play."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 px-5 py-5">
              <div className="mx-auto flex max-w-sm flex-col items-center gap-4 rounded-2xl border bg-card p-5 text-center shadow-sm">
                <div className="size-28 overflow-hidden rounded-full border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl}
                    alt={`${displayName} photo`}
                    crossOrigin="anonymous"
                    className="size-full object-cover"
                  />
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-lg font-semibold">{displayName}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatSpectatorPlayerGender(player)} ·{" "}
                      {formatSpectatorPlayerSkillLevel(player)}
                    </p>
                  </div>
                  <dl className="grid grid-cols-3 gap-3 text-sm">
                    <div className="rounded-lg border bg-muted/30 px-3 py-2">
                      <dt className="text-xs text-muted-foreground">Wins</dt>
                      <dd className="text-lg font-semibold tabular-nums">{wins}</dd>
                    </div>
                    <div className="rounded-lg border bg-muted/30 px-3 py-2">
                      <dt className="text-xs text-muted-foreground">Losses</dt>
                      <dd className="text-lg font-semibold tabular-nums">{losses}</dd>
                    </div>
                    <div className="rounded-lg border bg-muted/30 px-3 py-2">
                      <dt className="text-xs text-muted-foreground">Rank</dt>
                      <dd className="text-lg font-semibold tabular-nums">
                        {formatSpectatorPlayerRank(rank)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div
                className="pointer-events-none fixed top-0 -left-[10000px] opacity-0"
                aria-hidden
              >
                <SpectatorPlayerShareCard
                  ref={shareCardRef}
                  theme={theme}
                  player={player}
                  wins={wins}
                  losses={losses}
                  rank={rank}
                  gameTitle={gameTitle}
                  clubName={clubName}
                  clubLogoUrl={clubLogoUrl}
                  clubTagline={clubTagline}
                  openPlaySchedule={openPlaySchedule}
                  siteLabel={siteLabel}
                />
              </div>
            </div>

            <DialogFooter className="!mx-0 !mb-0 shrink-0 flex-row justify-end gap-2 rounded-none border-t bg-muted/50 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button type="button" onClick={() => void handleShare()} disabled={sharing}>
                {sharing ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    Preparing image…
                  </>
                ) : (
                  <>
                    <Share2 className="mr-2 size-4" aria-hidden />
                    Share
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
