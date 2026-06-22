"use client";

import { forwardRef } from "react";

import type { AppTheme } from "@/components/theme/theme-manager";
import type { PlayerPhotoRef } from "@/components/game/player-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  formatSpectatorPlayerGender,
  formatSpectatorPlayerRank,
  formatSpectatorPlayerSkillLevel,
  type SpectatorPlayerCardPlayer,
} from "@/lib/spectator-player-card-shared";
import { resolvePlayerPhotoUrl } from "@/lib/player-avatar-url";
import { cn, formatPlayerDisplayName } from "@/lib/utils";

export type SpectatorPlayerShareCardProps = {
  player: SpectatorPlayerCardPlayer;
  wins: number;
  losses: number;
  rank?: number | null;
  gameTitle?: string;
  clubName?: string | null;
  clubLogoUrl?: string | null;
  clubTagline?: string | null;
  openPlaySchedule?: string | null;
  siteLabel?: string | null;
  theme?: AppTheme;
  className?: string;
};

function getInitials(player: PlayerPhotoRef) {
  const display = formatPlayerDisplayName(player.firstName, player.lastName);
  const parts = display.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function ShareStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="spectator-share-stat rounded-xl border border-border/80 bg-background/50 px-3 py-2 text-center">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-foreground tabular-nums">{value}</p>
    </div>
  );
}

export const SpectatorPlayerShareCard = forwardRef<HTMLDivElement, SpectatorPlayerShareCardProps>(
  function SpectatorPlayerShareCard(
    {
      player,
      wins,
      losses,
      rank,
      gameTitle,
      clubName,
      clubLogoUrl,
      clubTagline,
      openPlaySchedule,
      siteLabel,
      theme,
      className,
    },
    ref,
  ) {
    const displayName = formatPlayerDisplayName(player.firstName, player.lastName) || "Player";
    const photoUrl = resolvePlayerPhotoUrl(player, 320);
    const gender = formatSpectatorPlayerGender(player);
    const skillLevel = formatSpectatorPlayerSkillLevel(player);
    const rankLabel = formatSpectatorPlayerRank(rank);
    const logoUrl = clubLogoUrl?.trim() ?? "";
    const tagline = clubTagline?.trim() ?? "";

    return (
      <div
        ref={ref}
        data-theme={theme}
        className={cn(
          "spectator-player-share-card relative flex w-[min(100%,22rem)] flex-col overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-background via-card to-primary/20 p-5 text-foreground shadow-xl",
          className,
        )}
      >
        <div className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-primary/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 size-36 rounded-full bg-accent/15 blur-2xl" />

        <div className="relative flex min-h-0 flex-1 flex-col space-y-4">
          {clubName ? (
            <div className="space-y-1.5 text-center">
              <div className="flex items-center justify-center gap-2.5">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt=""
                    crossOrigin="anonymous"
                    className="size-9 shrink-0 rounded-full border border-border/80 bg-muted object-cover"
                  />
                ) : null}
                <p className="text-[11px] font-semibold tracking-[0.18em] text-primary uppercase">
                  {clubName}
                </p>
              </div>
              {tagline ? (
                <p className="text-[11px] leading-snug text-muted-foreground italic">
                  &ldquo;{tagline}&rdquo;
                </p>
              ) : null}
            </div>
          ) : null}

          {gameTitle || openPlaySchedule ? (
            <div className="space-y-1 text-center">
              {gameTitle ? (
                <p className="truncate text-xs text-foreground/90">{gameTitle}</p>
              ) : null}
              {openPlaySchedule ? (
                <p className="text-[11px] leading-snug text-muted-foreground">{openPlaySchedule}</p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col items-center gap-3">
            <Avatar className="size-24 border-2 border-border bg-muted shadow-lg">
              <AvatarImage
                src={photoUrl}
                alt={`${displayName} photo`}
                crossOrigin="anonymous"
                className="object-cover"
              />
              <AvatarFallback className="bg-primary/15 text-lg font-semibold text-primary">
                {getInitials(player)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1 text-center">
              <h2 className="text-xl font-semibold tracking-tight">{displayName}</h2>
              <p className="text-sm text-muted-foreground">
                {gender} · {skillLevel}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <ShareStat label="Wins" value={String(wins)} />
            <ShareStat label="Losses" value={String(losses)} />
            <ShareStat label="Rank" value={rankLabel} />
          </div>

          {siteLabel ? (
            <p className="pt-1 text-center text-[10px] tracking-wide text-muted-foreground">
              {siteLabel}
            </p>
          ) : null}
        </div>
      </div>
    );
  },
);
