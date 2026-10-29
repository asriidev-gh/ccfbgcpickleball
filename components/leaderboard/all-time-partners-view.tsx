"use client";

import { Handshake, Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PhotoLightboxTrigger } from "@/components/leaderboard/photo-lightbox-trigger";
import { Input } from "@/components/ui/input";
import {
  MIN_PARTNER_GAMES,
  type AllTimePartnerPair,
  type AllTimePartnerPlayer,
} from "@/lib/all-time-partners-shared";
import { resolvePlayerPhotoUrl } from "@/lib/player-avatar-url";
import { cn, formatPlayerDisplayName, formatPlayerTableName } from "@/lib/utils";

const PAGE_SIZE = 50;

type SortMode = "winRate" | "games";

const SORTS: Array<{ value: SortMode; label: string }> = [
  { value: "winRate", label: "Best win rate" },
  { value: "games", label: "Most games together" },
];

function initialsOf(player: AllTimePartnerPlayer) {
  const parts = formatPlayerDisplayName(player.firstName, player.lastName)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function PartnerAvatar({ player, className }: { player: AllTimePartnerPlayer; className?: string }) {
  return (
    <Avatar size="lg" className={cn("shrink-0 ring-2 ring-background", className)}>
      <AvatarImage
        src={resolvePlayerPhotoUrl({
          firstName: player.firstName,
          lastName: player.lastName,
          photoUrl: player.photoUrl,
          photoPublicId: player.photoPublicId,
        })}
        alt=""
      />
      <AvatarFallback className="text-sm font-medium">{initialsOf(player)}</AvatarFallback>
    </Avatar>
  );
}

function PartnerStat({ label, value, tone }: { label: string; value: string; tone?: "win" | "loss" }) {
  return (
    <div className="all-time-stat">
      <span
        className={cn(
          "all-time-stat__value",
          tone === "win" && "text-emerald-600 dark:text-emerald-400",
          tone === "loss" && "text-muted-foreground",
        )}
      >
        {value}
      </span>
      <span className="all-time-stat__label">{label}</span>
    </div>
  );
}

function PartnerRow({ pair, rank }: { pair: AllTimePartnerPair; rank: number }) {
  const [first, second] = pair.players;
  const medal = rank <= 3;

  return (
    <li className={cn("all-time-row", medal && `all-time-row--podium all-time-row--rank${rank}`)}>
      <div className="all-time-row__rank">
        <span className="all-time-row__rank-number">{rank}</span>
      </div>

      <div className="flex shrink-0 items-center -space-x-3">
        <PhotoLightboxTrigger player={first}>
          <PartnerAvatar player={first} />
        </PhotoLightboxTrigger>
        <PhotoLightboxTrigger player={second}>
          <PartnerAvatar player={second} />
        </PhotoLightboxTrigger>
      </div>

      <div className="all-time-row__identity">
        <p className="all-time-row__name">
          {formatPlayerTableName(first.firstName, first.lastName)} &amp;{" "}
          {formatPlayerTableName(second.firstName, second.lastName)}
        </p>
        <p className="all-time-row__meta">{pair.gamesTogether} games together</p>
      </div>

      <div className="all-time-row__stats">
        <PartnerStat label="Win %" value={`${pair.winRate}%`} tone="win" />
        <PartnerStat label="Won" value={String(pair.wins)} />
        <PartnerStat label="Lost" value={String(pair.losses)} tone="loss" />
        <PartnerStat label="Games" value={String(pair.gamesTogether)} />
      </div>
    </li>
  );
}

/** Doubles pairs ranked by how they do together; pairs under the minimum aren't listed. */
export function AllTimePartnersView({ pairs }: { pairs: AllTimePartnerPair[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("winRate");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const deferredQuery = useDeferredValue(query);

  const ranked = useMemo(() => {
    const sorted = [...pairs].sort((a, b) =>
      sort === "games"
        ? b.gamesTogether - a.gamesTogether || b.winRate - a.winRate || b.wins - a.wins
        : b.winRate - a.winRate || b.gamesTogether - a.gamesTogether || b.wins - a.wins,
    );
    return sorted.map((pair, index) => ({ pair, rank: index + 1 }));
  }, [pairs, sort]);

  // Search only looks a pair up, so it keeps the rank it holds in the current sort.
  const visible = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    if (!needle) return ranked;
    return ranked.filter(({ pair }) =>
      pair.players.some((player) =>
        formatPlayerTableName(player.firstName, player.lastName).toLowerCase().includes(needle),
      ),
    );
  }, [ranked, deferredQuery]);

  if (pairs.length === 0) {
    return (
      <div className="all-time-empty">
        <Handshake className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="mt-3 text-base font-semibold text-foreground">No partner stats yet</p>
        <p className="caption mt-1 max-w-sm">
          Pairs show up here once they&apos;ve played more than {MIN_PARTNER_GAMES - 1} doubles games
          together and won at least once.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="all-time-filters">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(PAGE_SIZE);
            }}
            placeholder="Search a player"
            aria-label="Search a player"
            className="h-11 w-full rounded-xl pl-9 text-base md:text-sm"
          />
        </div>

        <div
          className="inline-flex shrink-0 rounded-xl border border-border bg-muted/40 p-0.5"
          role="group"
          aria-label="Sort partners"
        >
          {SORTS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={sort === option.value ? "default" : "ghost"}
              className="h-10 rounded-lg px-3"
              aria-pressed={sort === option.value}
              onClick={() => {
                setSort(option.value);
                setLimit(PAGE_SIZE);
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Pairs with more than {MIN_PARTNER_GAMES - 1} doubles games together and at least one win.
      </p>

      {visible.length === 0 ? (
        <p className="px-1 py-8 text-center text-sm text-muted-foreground">
          No pair matches &ldquo;{query.trim()}&rdquo;.
        </p>
      ) : (
        <>
          <ol className="all-time-list">
            {visible.slice(0, limit).map(({ pair, rank }) => (
              <PartnerRow key={pair.id} pair={pair} rank={rank} />
            ))}
          </ol>
          {limit < visible.length ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                className="h-11 rounded-xl px-5 font-semibold"
                onClick={() => setLimit((current) => current + PAGE_SIZE)}
              >
                Show next {Math.min(PAGE_SIZE, visible.length - limit)}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
