"use client";

import { forwardRef } from "react";

import type { AppTheme } from "@/components/theme/theme-manager";
import type { PlayerPhotoRef } from "@/components/game/player-avatar";
import { PlayerEndorsementBadgeList } from "@/components/player/player-endorsement-badge-list";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  formatSpectatorPlayerRank,
  resolveSpectatorPlayerSkillLevelLabel,
  type SpectatorPlayerCardPlayer,
} from "@/lib/spectator-player-card-shared";
import { resolvePlayerPhotoUrl } from "@/lib/player-avatar-url";
import type { PlayerCardShareContent } from "@/lib/player-card-share-content";
import { resolvePlayerCardShareSections } from "@/lib/player-card-share-content";
import { canShowSessionRank, isSessionRecordEmpty } from "@/lib/games-played-map";
import type { SpectatePlayerEndorsementReceived } from "@/lib/spectate-player-endorsement";
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
  venueLabel?: string | null;
  siteLabel?: string | null;
  theme?: AppTheme;
  className?: string;
  shareContent?: PlayerCardShareContent;
  endorsements?: SpectatePlayerEndorsementReceived[];
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
    <div className="spectator-share-stat rounded-xl border border-border/80 bg-background/50 px-2.5 py-1.5 text-center">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-base font-semibold text-foreground tabular-nums">{value}</p>
    </div>
  );
}

function ShareClubHeader({
  clubName,
  clubLogoUrl,
  clubTagline,
}: {
  clubName: string;
  clubLogoUrl: string;
  clubTagline: string;
}) {
  return (
    <div className="flex items-center justify-center gap-3">
      {clubLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={clubLogoUrl}
          alt=""
          crossOrigin="anonymous"
          className="size-12 shrink-0 rounded-full border-2 border-border/80 bg-muted object-cover shadow-sm"
        />
      ) : null}
      <div className={cn("min-w-0", !clubLogoUrl && "text-center")}>
        <p className="text-sm leading-tight font-bold tracking-[0.1em] text-primary uppercase">
          {clubName}
        </p>
        {clubTagline ? (
          <p className="mt-0.5 text-xs leading-tight text-muted-foreground italic">
            &ldquo;{clubTagline}&rdquo;
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ShareSessionMeta({
  gameTitle,
  openPlaySchedule,
  venueLabel,
}: {
  gameTitle?: string;
  openPlaySchedule?: string | null;
  venueLabel?: string | null;
}) {
  const schedule = openPlaySchedule?.trim() ?? "";
  const venue = venueLabel?.trim() ?? "";
  if (!gameTitle && !schedule && !venue) return null;

  return (
    <div className="space-y-0.5 border-t border-border/50 pt-2 text-center">
      {gameTitle ? (
        <p className="text-sm leading-tight font-semibold text-foreground">{gameTitle}</p>
      ) : null}
      {schedule ? (
        <p className="text-xs leading-snug text-muted-foreground">{schedule}</p>
      ) : null}
      {venue ? (
        <p className="text-xs leading-snug text-muted-foreground">@ {venue}</p>
      ) : null}
    </div>
  );
}

function ShareEndorsementsSection({
  endorsements,
}: {
  endorsements: SpectatePlayerEndorsementReceived[];
}) {
  if (endorsements.length === 0) return null;

  return (
    <div className="space-y-2 border-t border-border/50 pt-2">
      <p className="text-center text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        Endorsements
      </p>
      <ul className="space-y-1.5">
        {endorsements.map((endorsement) => (
          <li
            key={`${endorsement.endorserPlayerId}-${endorsement.createdAt}`}
            className="rounded-lg border border-border/80 bg-background/40 px-2.5 py-2"
          >
            <p className="text-xs font-semibold text-foreground">{endorsement.endorserPlayerName}</p>
            <PlayerEndorsementBadgeList badges={endorsement.badges} compact className="mt-1" />
            {endorsement.notes.trim() ? (
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground italic">
                &ldquo;{endorsement.notes.trim()}&rdquo;
              </p>
            ) : null}
          </li>
        ))}
      </ul>
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
      venueLabel,
      siteLabel,
      theme,
      className,
      shareContent = "both",
      endorsements = [],
    },
    ref,
  ) {
    const displayName = formatPlayerDisplayName(player.firstName, player.lastName) || "Player";
    const photoUrl = resolvePlayerPhotoUrl(player, 320);
    const skillLevelLabel = resolveSpectatorPlayerSkillLevelLabel(player);
    const rankLabel = formatSpectatorPlayerRank(rank);
    const sessionRecordEmpty = isSessionRecordEmpty({ wins, losses });
    const showSessionRank = canShowSessionRank({ wins, losses });
    const logoUrl = clubLogoUrl?.trim() ?? "";
    const tagline = clubTagline?.trim() ?? "";
    const resolvedClubName = clubName?.trim() ?? "";
    const { showStats, showEndorsements } = resolvePlayerCardShareSections(
      shareContent,
      endorsements.length,
    );

    return (
      <div
        ref={ref}
        data-theme={theme}
        className={cn(
          "spectator-player-share-card relative flex w-[min(100%,22rem)] flex-col overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-background via-card to-primary/20 p-4 text-foreground shadow-xl",
          className,
        )}
      >
        <div className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-primary/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 size-36 rounded-full bg-accent/15 blur-2xl" />

        <div className="relative flex min-h-0 flex-1 flex-col gap-2.5">
          {resolvedClubName ? (
            <ShareClubHeader
              clubName={resolvedClubName}
              clubLogoUrl={logoUrl}
              clubTagline={tagline}
            />
          ) : null}

          <ShareSessionMeta
            gameTitle={gameTitle}
            openPlaySchedule={openPlaySchedule}
            venueLabel={venueLabel}
          />

          <div className="flex flex-col items-center gap-2 pt-0.5">
            <Avatar className="size-[5.5rem] border-2 border-border bg-muted shadow-md">
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
            <div className="space-y-0.5 text-center">
              <h2 className="text-xl font-semibold tracking-tight">{displayName}</h2>
              {skillLevelLabel ? (
                <p className="text-sm text-muted-foreground">{skillLevelLabel}</p>
              ) : null}
            </div>
          </div>

          {showStats ? (
            sessionRecordEmpty ? (
              <p className="text-center text-sm font-medium text-muted-foreground">No Rank Yet</p>
            ) : (
              <div className={cn("grid gap-1.5", showSessionRank ? "grid-cols-3" : "grid-cols-2")}>
                <ShareStat label="Wins" value={String(wins)} />
                <ShareStat label="Losses" value={String(losses)} />
                {showSessionRank ? <ShareStat label="Rank" value={rankLabel} /> : null}
              </div>
            )
          ) : null}

          {showEndorsements ? <ShareEndorsementsSection endorsements={endorsements} /> : null}

          {siteLabel ? (
            <p className="text-center text-[10px] tracking-wide text-muted-foreground">
              {siteLabel}
            </p>
          ) : null}
        </div>
      </div>
    );
  },
);
