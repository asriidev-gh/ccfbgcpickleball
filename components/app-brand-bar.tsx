"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import { DashboardHeaderLink } from "@/components/dashboard-header-link";
import { MyClubHeaderLink } from "@/components/my-club-header-link";
import { SpectateClubProfileDialog } from "@/components/player/spectate-club-profile-dialog";
import { PlayerSessionMenu } from "@/components/player/player-session-menu";
import { RegisteredPlayersHeaderLink } from "@/components/registered-players-header-link";
import { ThemeMenu } from "@/components/theme-menu";
import { UserHeaderGreeting } from "@/components/user-header-greeting";
import { UserMenu } from "@/components/user-menu";
import { useGameClubBranding } from "@/hooks/use-game-club-branding";
import { getSpectateGameIdFromPath } from "@/lib/player-session";
import { APP_NAME } from "@/lib/app-config";
import {
  getBrandShellClasses,
  isGameDashboardPath,
  isPublicAppPath,
  isSpectatorPath,
  shouldHideAppBrandBar,
  shouldShowDashboardHeaderLink,
  shouldShowOwnerDashboardNavLinks,
  shouldShowUserHeaderGreeting,
} from "@/lib/app-shell";
import { dispatchRegistrationReset } from "@/lib/registration-reset";
import { cn } from "@/lib/utils";
import type { ClubBranding } from "@/lib/club-branding";

function ClubBrandLabel({ branding }: { branding: ClubBranding }) {
  return (
    <>
      {branding.clubLogoUrl ? (
        <img
          src={branding.clubLogoUrl}
          alt=""
          className="app-brand__logo h-10 w-10 shrink-0 rounded-md border border-border/60 object-cover md:h-11 md:w-11"
        />
      ) : null}
      <span className="truncate">{branding.clubName}</span>
    </>
  );
}

function BrandTitle({
  pathname,
  fromParam,
  clubBranding,
  spectateGameId,
  onSpectateClubBrandClick,
}: {
  pathname: string;
  fromParam: string | null;
  clubBranding: ClubBranding | null;
  spectateGameId: string | null;
  onSpectateClubBrandClick?: () => void;
}) {
  const useClubBrand = isGameDashboardPath(pathname) && clubBranding;
  const brandClassName = cn(
    "app-brand",
    useClubBrand && "app-brand--club inline-flex min-w-0 max-w-full items-center gap-2.5",
  );
  const label = useClubBrand ? (
    <ClubBrandLabel branding={clubBranding} />
  ) : (
    APP_NAME
  );

  if (isSpectatorPath(pathname, fromParam)) {
    if (spectateGameId && onSpectateClubBrandClick) {
      return (
        <button
          type="button"
          className={cn(brandClassName, "app-brand--action")}
          onClick={onSpectateClubBrandClick}
          aria-label={
            clubBranding?.clubName
              ? `View ${clubBranding.clubName} club profile`
              : "View club profile"
          }
        >
          {label}
        </button>
      );
    }

    return <span className={brandClassName}>{label}</span>;
  }

  const match = pathname.match(/^\/register\/([^/]+)(?:\/success)?\/?$/);
  if (!match) {
    return (
      <Link href="/" className={cn(brandClassName, "app-brand--action")}>
        {label}
      </Link>
    );
  }

  const gameId = match[1];
  const isSuccess = /\/success\/?$/.test(pathname);

  if (isSuccess) {
    return (
      <Link href={`/register/${gameId}`} className={cn(brandClassName, "app-brand--action")}>
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={cn(brandClassName, "app-brand--action")}
      onClick={() => dispatchRegistrationReset()}
    >
      {label}
    </button>
  );
}

export function AppBrandBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");
  const clubBranding = useGameClubBranding(pathname, fromParam);
  const { pad, container } = getBrandShellClasses(pathname);
  const showThemeOnly = isPublicAppPath(pathname, fromParam);
  const spectateGameId = getSpectateGameIdFromPath(pathname);
  const [clubProfileOpen, setClubProfileOpen] = useState(false);

  if (shouldHideAppBrandBar(pathname)) {
    return null;
  }

  return (
    <>
      <header className="app-brand-bar">
        <div className={pad}>
          <div className={cn("app-brand-bar__inner mx-auto flex w-full items-center justify-between gap-3", container)}>
            <BrandTitle
              pathname={pathname}
              fromParam={fromParam}
              clubBranding={clubBranding}
              spectateGameId={spectateGameId}
              onSpectateClubBrandClick={
                spectateGameId ? () => setClubProfileOpen(true) : undefined
              }
            />
            <div className="app-brand-actions flex shrink-0 items-center gap-2">
              {showThemeOnly ? (
                spectateGameId ? (
                  <PlayerSessionMenu gameId={spectateGameId} fallback={<ThemeMenu />} />
                ) : (
                  <ThemeMenu />
                )
              ) : (
                <>
                  {shouldShowOwnerDashboardNavLinks(pathname) ? (
                    <div className="flex items-center gap-2">
                      <RegisteredPlayersHeaderLink />
                      <MyClubHeaderLink />
                    </div>
                  ) : null}
                  {shouldShowDashboardHeaderLink(pathname) ? <DashboardHeaderLink /> : null}
                  {shouldShowUserHeaderGreeting(pathname) ? <UserHeaderGreeting /> : null}
                  <UserMenu />
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {spectateGameId ? (
        <SpectateClubProfileDialog
          gameId={spectateGameId}
          open={clubProfileOpen}
          onOpenChange={setClubProfileOpen}
        />
      ) : null}
    </>
  );
}
