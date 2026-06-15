"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  LayoutDashboard,
  Loader2,
  LogOut,
  Palette,
  Store,
  UserPen,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SpectateClubProfileDialog } from "@/components/player/spectate-club-profile-dialog";
import { MobileBottomNavButton, MobileBottomNavShell } from "@/components/mobile-bottom-nav";
import { ThemePickerDialog } from "@/components/theme-menu";
import { confirmAndPerformPlayerSelfCheckout } from "@/lib/player-self-checkout";
import { getLinkedPlayerIdForGame } from "@/lib/player-session";
import { fetchSpectateClubProfile, spectateClubProfileQueryKey } from "@/lib/fetch-spectate-club-profile";
import { spectatorLiveQueryKey } from "@/lib/fetch-spectate-game";
import type { SpectateClubProfile } from "@/lib/spectate-club-profile-shared";

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

export function PlayerMobileNav({ gameId }: { gameId: string }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [clubProfileOpen, setClubProfileOpen] = useState(false);
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);

  const dashboardHref = `/games/${gameId}/spectate`;
  const profileHref = `/games/${gameId}/spectate/profile`;
  const marketplaceHref = `/games/${gameId}/spectate/marketplace`;
  const isDashboard = pathname === dashboardHref;
  const isProfile = pathname === profileHref;
  const isMarketplace = pathname === marketplaceHref;
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

  return (
    <>
      <MobileBottomNavShell ariaLabel="Player navigation">
        <MobileBottomNavButton
          href={dashboardHref}
          label="Dashboard"
          active={isDashboard}
          icon={<LayoutDashboard className="h-5 w-5 shrink-0" aria-hidden />}
        />
        <MobileBottomNavButton
          href={profileHref}
          label="My Profile"
          active={isProfile}
          icon={<UserPen className="h-5 w-5 shrink-0" aria-hidden />}
        />
        {hasSession ? (
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
        ) : (
          <MobileBottomNavButton
            label="Change Theme"
            onClick={() => setThemeDialogOpen(true)}
            icon={<Palette className="h-5 w-5 shrink-0" aria-hidden />}
          />
        )}
      </MobileBottomNavShell>

      <SpectateClubProfileDialog
        gameId={gameId}
        open={clubProfileOpen}
        onOpenChange={setClubProfileOpen}
      />

      <ThemePickerDialog open={themeDialogOpen} onOpenChange={setThemeDialogOpen} />
    </>
  );
}

