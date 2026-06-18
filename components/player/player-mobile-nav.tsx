"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  LayoutDashboard,
  Loader2,
  LogOut,
  Megaphone,
  Store,
  Trophy,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SpectateAnnouncementsDialog } from "@/components/player/spectate-announcements-dialog";
import { SpectateClubProfileDialog } from "@/components/player/spectate-club-profile-dialog";
import { MobileBottomNavButton, MobileBottomNavShell } from "@/components/mobile-bottom-nav";
import { confirmAndPerformPlayerSelfCheckout } from "@/lib/player-self-checkout";
import { getLinkedPlayerIdForGame } from "@/lib/player-session";
import { fetchSpectateClubProfile, spectateClubProfileQueryKey } from "@/lib/fetch-spectate-club-profile";
import { spectatorLiveQueryKey } from "@/lib/fetch-spectate-game";
import type { SpectateClubProfile } from "@/lib/spectate-club-profile-shared";
import type { SpectatePlayerFeatures } from "@/lib/spectate-player-features-shared";

function ClubNavIcon({ profile }: { profile: SpectateClubProfile | undefined }) {
  if (profile?.clubLogoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.clubLogoUrl}
        alt=""
        className="h-6 w-6 shrink-0 rounded-full border border-border/70 bg-background object-cover"
      />
    );
  }

  return <Building2 className="h-5 w-5 shrink-0" aria-hidden />;
}

function CommunityPostsNavIcon({ unreadCount }: { unreadCount: number }) {
  return (
    <span className="relative inline-flex">
      <Megaphone className="h-5 w-5 shrink-0" aria-hidden />
      {unreadCount > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[9px] font-bold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </span>
  );
}

export function PlayerMobileNav({ gameId }: { gameId: string }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [clubProfileOpen, setClubProfileOpen] = useState(false);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);

  const dashboardHref = `/games/${gameId}/spectate`;
  const marketplaceHref = `/games/${gameId}/spectate/marketplace`;
  const leaderboardHref = `/leaderboard/${gameId}?from=spectator`;
  const isDashboard = pathname === dashboardHref;
  const isMarketplace = pathname === marketplaceHref;
  const isLeaderboard = pathname === `/leaderboard/${gameId}`;
  const hasSession = Boolean(playerId);

  useEffect(() => {
    const readSession = () => setPlayerId(getLinkedPlayerIdForGame(gameId));
    readSession();

    const onFocus = () => readSession();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [gameId, pathname]);

  const { data: clubProfile } = useQuery({
    queryKey: spectateClubProfileQueryKey(gameId),
    queryFn: () => fetchSpectateClubProfile(gameId),
    staleTime: 60_000,
  });

  const { data: playerFeatures } = useQuery({
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
    staleTime: 30_000,
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!playerId) throw new Error("Register for this open play first.");
      return confirmAndPerformPlayerSelfCheckout(gameId, playerId);
    },
    onSuccess: (result) => {
      if (!result.checkedOut) return;
      toast.success(result.message ?? "Checked out of the queue.");
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
      queryClient.invalidateQueries({ queryKey: spectatorLiveQueryKey(gameId) });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to check out.");
    },
  });

  const clubNavLabel = clubProfile?.clubName?.trim() || "Club";
  const unreadAnnouncementCount = playerFeatures?.unreadAnnouncementCount ?? 0;
  const showMarketplace = playerFeatures?.showMarketplace === true;

  return (
    <>
      <MobileBottomNavShell ariaLabel="Player navigation">
        <MobileBottomNavButton
          href={dashboardHref}
          label="Game"
          active={isDashboard}
          icon={<LayoutDashboard className="h-5 w-5 shrink-0" aria-hidden />}
        />
        <MobileBottomNavButton
          label="Community Posts"
          onClick={() => setAnnouncementsOpen(true)}
          icon={<CommunityPostsNavIcon unreadCount={unreadAnnouncementCount} />}
        />
        {showMarketplace ? (
          <MobileBottomNavButton
            href={marketplaceHref}
            label="Marketplace"
            active={isMarketplace}
            icon={<Store className="h-5 w-5 shrink-0" aria-hidden />}
          />
        ) : null}
        <MobileBottomNavButton
          label={clubNavLabel}
          onClick={() => setClubProfileOpen(true)}
          icon={<ClubNavIcon profile={clubProfile} />}
        />
        <MobileBottomNavButton
          href={leaderboardHref}
          label="Leaderboard"
          active={isLeaderboard}
          icon={<Trophy className="h-5 w-5 shrink-0" aria-hidden />}
        />
        {hasSession ? (
          <MobileBottomNavButton
            label={checkoutMutation.isPending ? "Checking out…" : "Checkout"}
            disabled={checkoutMutation.isPending}
            onClick={() => checkoutMutation.mutate()}
            icon={
              checkoutMutation.isPending ? (
                <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
              ) : (
                <LogOut className="h-5 w-5 shrink-0" aria-hidden />
              )
            }
          />
        ) : null}
      </MobileBottomNavShell>

      <SpectateAnnouncementsDialog
        gameId={gameId}
        playerId={playerId}
        open={announcementsOpen}
        onOpenChange={(open) => {
          setAnnouncementsOpen(open);
          if (!open && playerId) {
            void queryClient.refetchQueries({
              queryKey: ["spectate-player-features", gameId, playerId],
            });
          }
        }}
      />

      <SpectateClubProfileDialog
        gameId={gameId}
        open={clubProfileOpen}
        onOpenChange={setClubProfileOpen}
      />
    </>
  );
}
