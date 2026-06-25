"use client";

import { CircleUser, HeartHandshake, History, Megaphone, Store, UserPen, Users } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { SpectateAnnouncementsDialog } from "@/components/player/spectate-announcements-dialog";
import { SpectateDgroupRequestDialog } from "@/components/player/spectate-dgroup-request-dialog";
import { SpectatePlayerGameHistoryDialog } from "@/components/player/spectate-player-game-history-dialog";
import { SpectatePrayerRequestDialog } from "@/components/player/spectate-prayer-request-dialog";
import { ThemeMenuItems } from "@/components/theme-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getLinkedPlayerIdForGame } from "@/lib/player-session";
import type { SpectatePlayerFeatures } from "@/lib/spectate-player-features-shared";
import { cn } from "@/lib/utils";

export function PlayerSessionMenu({
  gameId,
  fallback = null,
}: {
  gameId: string;
  fallback?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [gameHistoryOpen, setGameHistoryOpen] = useState(false);
  const [prayerOpen, setPrayerOpen] = useState(false);
  const [prayerHistoryOnly, setPrayerHistoryOnly] = useState(false);
  const [dgroupOpen, setDgroupOpen] = useState(false);

  useEffect(() => {
    const readSession = () => setPlayerId(getLinkedPlayerIdForGame(gameId));
    readSession();

    const onFocus = () => readSession();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [gameId, pathname]);

  const { data: features } = useQuery({
    queryKey: ["spectate-player-features", gameId, playerId],
    queryFn: async () => {
      const response = await fetch(
        `/api/games/${gameId}/spectate/player/features?playerId=${encodeURIComponent(playerId!)}`,
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Failed to load player menu.");
      return payload as SpectatePlayerFeatures;
    },
    enabled: Boolean(playerId),
    staleTime: 0,
    refetchOnMount: "always",
  });

  if (!playerId) return fallback;

  const unreadCount = features?.unreadAnnouncementCount ?? 0;
  const showCommunityPosts = (features?.communityPostCount ?? 0) > 0;
  const showMarketplace = features?.showMarketplace === true;
  const showCcf = features?.showCcfFeatures ?? false;
  const showDgroup = Boolean(features?.showDgroupJoinMenu);
  const dgroupSubmitted = Boolean(features?.hasSubmittedDgroupRequest);
  const dgroupAcknowledged = dgroupSubmitted && Boolean(features?.isDgroupRequestAcknowledged);
  const dgroupMenuDisabled = dgroupSubmitted;
  const prayerSubmitted = Boolean(features?.hasSubmittedPrayerRequest);
  const prayerAcknowledged = Boolean(features?.isPrayerRequestAcknowledged);
  const prayerReplyCount = features?.prayerReplyCount ?? 0;

  const openPrayer = (historyOnly = false) => {
    setPrayerHistoryOnly(historyOnly);
    setPrayerOpen(true);
  };

  const marketplaceHref = `/games/${gameId}/spectate/marketplace`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              className="relative h-11 w-11 shrink-0 rounded-full border-border"
              aria-label="Player menu"
            />
          }
        >
          <CircleUser className="h-6 w-6" />
          {showCommunityPosts && unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem
            onClick={() => router.push(`/games/${gameId}/spectate/profile`)}
          >
            <UserPen />
            Update profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setGameHistoryOpen(true)}>
            <History />
            Game History
          </DropdownMenuItem>
          {showMarketplace ? (
            <DropdownMenuItem onClick={() => router.push(marketplaceHref)}>
              <Store />
              Marketplace
            </DropdownMenuItem>
          ) : null}
          {showCommunityPosts ? (
            <DropdownMenuItem onClick={() => setAnnouncementsOpen(true)}>
              <Megaphone />
              <span className="flex-1">Community Posts</span>
              {unreadCount > 0 ? (
                <Badge variant="secondary" className="ml-auto h-5 min-w-5 justify-center px-1.5 text-[10px]">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              ) : null}
            </DropdownMenuItem>
          ) : null}
          {showCcf ? (
            <DropdownMenuItem onClick={() => openPrayer(prayerSubmitted || prayerReplyCount > 0)}>
              <HeartHandshake />
              <span className="flex-1">Request a prayer</span>
              {prayerAcknowledged ? (
                <Badge className="ml-auto prayer-acknowledged-badge">
                  Acknowledged
                </Badge>
              ) : prayerSubmitted ? (
                <Badge variant="secondary" className="ml-auto">
                  Submitted
                </Badge>
              ) : null}
              {prayerReplyCount > 0 ? (
                <button
                  type="button"
                  className={cn(
                    "ml-auto inline-flex h-5 items-center rounded-md border border-transparent bg-secondary px-1.5 text-xs font-medium text-secondary-foreground tabular-nums",
                    "cursor-pointer transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    (prayerAcknowledged || prayerSubmitted) && "ml-1",
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    openPrayer(true);
                  }}
                  aria-label={`View ${prayerReplyCount} repl${prayerReplyCount === 1 ? "y" : "ies"}`}
                >
                  {prayerReplyCount} repl{prayerReplyCount === 1 ? "y" : "ies"}
                </button>
              ) : null}
            </DropdownMenuItem>
          ) : null}
          {showDgroup ? (
            <DropdownMenuItem
              disabled={dgroupMenuDisabled}
              onClick={() => {
                if (!dgroupMenuDisabled) setDgroupOpen(true);
              }}
            >
              <Users />
              <span className="flex-1">Join a D-group</span>
              {dgroupAcknowledged ? (
                <Badge className="ml-auto dgroup-acknowledged-badge">
                  Acknowledged
                </Badge>
              ) : features?.hasSubmittedDgroupRequest ? (
                <Badge variant="secondary" className="ml-auto">
                  Submitted
                </Badge>
              ) : null}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <ThemeMenuItems />
        </DropdownMenuContent>
      </DropdownMenu>

      <SpectatePlayerGameHistoryDialog
        gameId={gameId}
        playerId={playerId}
        open={gameHistoryOpen}
        onOpenChange={setGameHistoryOpen}
      />

      {showCommunityPosts ? (
        <SpectateAnnouncementsDialog
          gameId={gameId}
          playerId={playerId}
          open={announcementsOpen}
          onOpenChange={(open) => {
            setAnnouncementsOpen(open);
            if (!open) {
              void queryClient.refetchQueries({
                queryKey: ["spectate-player-features", gameId, playerId],
              });
            }
          }}
        />
      ) : null}

      {showCcf ? (
        <SpectatePrayerRequestDialog
          gameId={gameId}
          playerId={playerId}
          open={prayerOpen}
          historyOnly={prayerHistoryOnly}
          onOpenChange={(open) => {
            setPrayerOpen(open);
            if (!open) {
              setPrayerHistoryOnly(false);
              void queryClient.refetchQueries({
                queryKey: ["spectate-player-features", gameId, playerId],
              });
            }
          }}
        />
      ) : null}

      {showDgroup && features && !dgroupMenuDisabled ? (
        <SpectateDgroupRequestDialog
          gameId={gameId}
          playerId={playerId}
          open={dgroupOpen}
          onOpenChange={setDgroupOpen}
          initial={features}
        />
      ) : null}
    </>
  );
}
