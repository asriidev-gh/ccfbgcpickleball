"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { PlayerSessionMenu } from "@/components/player/player-session-menu";
import { RegisteredPlayersHeaderLink } from "@/components/registered-players-header-link";
import { ThemeMenu } from "@/components/theme-menu";
import { UserMenu } from "@/components/user-menu";
import { getSpectateGameIdFromPath } from "@/lib/player-session";
import { APP_NAME } from "@/lib/app-config";
import { getBrandShellClasses, isPublicAppPath, isSpectatorPath, shouldHideAppBrandBar, shouldShowRegisteredPlayersHeaderLink } from "@/lib/app-shell";
import { dispatchRegistrationReset } from "@/lib/registration-reset";
import { cn } from "@/lib/utils";

function BrandTitle({ pathname, fromParam }: { pathname: string; fromParam: string | null }) {
  if (isSpectatorPath(pathname, fromParam)) {
    return <span className="app-brand">{APP_NAME}</span>;
  }

  const match = pathname.match(/^\/register\/([^/]+)(?:\/success)?\/?$/);
  if (!match) {
    return (
      <Link href="/" className="app-brand app-brand--action">
        {APP_NAME}
      </Link>
    );
  }

  const gameId = match[1];
  const isSuccess = /\/success\/?$/.test(pathname);

  if (isSuccess) {
    return (
      <Link href={`/register/${gameId}`} className="app-brand app-brand--action">
        {APP_NAME}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className="app-brand app-brand--action"
      onClick={() => dispatchRegistrationReset()}
    >
      {APP_NAME}
    </button>
  );
}

export function AppBrandBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");
  const { pad, container } = getBrandShellClasses(pathname);
  const showThemeOnly = isPublicAppPath(pathname, fromParam);
  const spectateGameId = getSpectateGameIdFromPath(pathname);

  if (shouldHideAppBrandBar(pathname)) {
    return null;
  }

  return (
    <header className="app-brand-bar">
      <div className={pad}>
        <div className={cn("app-brand-bar__inner mx-auto flex w-full items-center justify-between gap-3", container)}>
          <BrandTitle pathname={pathname} fromParam={fromParam} />
          <div className="app-brand-actions flex shrink-0 items-center gap-2">
            {showThemeOnly ? (
              spectateGameId ? (
                <PlayerSessionMenu gameId={spectateGameId} fallback={<ThemeMenu />} />
              ) : (
                <ThemeMenu />
              )
            ) : (
              <>
                {shouldShowRegisteredPlayersHeaderLink(pathname) ? (
                  <RegisteredPlayersHeaderLink />
                ) : null}
                <UserMenu />
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
