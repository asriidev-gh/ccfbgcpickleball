"use client";

import { Crown, Search, Trophy, X } from "lucide-react";
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";

import { LeaderboardMedalIcon } from "@/components/game/leaderboard-medal-icon";
import { PlayerEndorsementStatusBadge } from "@/components/game/player-endorsement-status-badge";
import {
  AllTimeEndorsementsDialog,
  type AllTimeEndorsementsScope,
} from "@/components/leaderboard/all-time-endorsements-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PICKLEBALL_LEVELS } from "@/lib/player-profile-shared";
import {
  useAllTimeLeaderboard,
  usePublicAllTimeLeaderboard,
} from "@/hooks/use-all-time-leaderboard";
import type {
  AllTimeLeaderboardPayload,
  AllTimeLeaderboardRow,
} from "@/lib/all-time-leaderboard";
import { resolvePlayerPhotoUrl } from "@/lib/player-avatar-url";
import { cn, formatPlayerDisplayName, formatPlayerTableName } from "@/lib/utils";

const LEVEL_LABELS = new Map<string, string>(
  PICKLEBALL_LEVELS.map((option) => [option.value, option.label]),
);

function initialsOf(row: AllTimeLeaderboardRow) {
  const display = formatPlayerDisplayName(row.firstName, row.lastName).trim();
  const parts = display.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function Stat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone?: "win" | "loss";
  icon?: ReactNode;
}) {
  return (
    <div className="all-time-stat">
      <span
        className={cn(
          "all-time-stat__value",
          tone === "win" && "text-emerald-600 dark:text-emerald-400",
          tone === "loss" && "text-muted-foreground",
        )}
      >
        {icon}
        {value}
      </span>
      <span className="all-time-stat__label">{label}</span>
    </div>
  );
}

function PlayerRow({
  row,
  rank,
  onEndorsementsClick,
}: {
  row: AllTimeLeaderboardRow;
  rank: number;
  onEndorsementsClick: (row: AllTimeLeaderboardRow) => void;
}) {
  const name = formatPlayerTableName(row.firstName, row.lastName);
  const medal = rank <= 3 ? (rank as 1 | 2 | 3) : null;

  return (
    <li className={cn("all-time-row", medal && `all-time-row--podium all-time-row--rank${rank}`)}>
      <div className="all-time-row__rank">
        {medal ? (
          <LeaderboardMedalIcon rank={medal} size="sm" />
        ) : (
          <span className="all-time-row__rank-number">{rank}</span>
        )}
      </div>

      <Avatar size="lg" className="all-time-row__avatar shrink-0">
        <AvatarImage src={resolvePlayerPhotoUrl(row)} alt="" />
        <AvatarFallback className="text-sm font-medium">{initialsOf(row)}</AvatarFallback>
      </Avatar>

      <div className="all-time-row__identity">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <p className="all-time-row__name">{name}</p>
          <PlayerEndorsementStatusBadge
            count={row.endorsements ?? 0}
            alwaysShowCount
            onClick={() => onEndorsementsClick(row)}
          />
        </div>
        <p className="all-time-row__meta">
          {[
            `${row.sessionsPlayed} ${row.sessionsPlayed === 1 ? "session" : "sessions"}`,
            LEVEL_LABELS.get(row.pickleballLevel),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <div className="all-time-row__stats">
        <Stat label="Won" value={String(row.wins)} tone="win" />
        <Stat label="Lost" value={String(row.losses)} tone="loss" />
        <Stat label="Games" value={String(row.gamesPlayed)} />
        <Stat label="Win %" value={`${row.winRate}%`} />
        <Stat
          label="Undefeated"
          value={String(row.undefeatedSessions)}
          icon={<Trophy className="h-3.5 w-3.5 text-amber-500" aria-hidden />}
        />
        <Stat
          label="MVP"
          value={String(row.mvpSessions)}
          icon={<Crown className="h-3.5 w-3.5 text-amber-500" aria-hidden />}
        />
      </div>
    </li>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading standings">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} className="h-20 w-full rounded-2xl" />
      ))}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="all-time-empty">
      <Trophy className="h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="mt-3 text-base font-semibold text-foreground">{title}</p>
      <p className="caption mt-1 max-w-sm">{body}</p>
    </div>
  );
}

/** Rows rendered per step: drawing every player at once is what made long boards slow. */
const PAGE_SIZE = 100;

const ANY = "all";
/** Matches players who never filled the field in. */
const UNSET = "unset";

const GENDER_ORDER = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

const LEVEL_ORDER = PICKLEBALL_LEVELS;

type FilterOption = { value: string; label: string; count: number };

/**
 * Only offer values that somebody actually has, with counts. Most players have no level
 * recorded, so a fixed list would offer several options that can only ever return nothing.
 */
function buildFilterOptions(
  rows: AllTimeLeaderboardRow[],
  field: "gender" | "pickleballLevel",
  order: readonly { value: string; label: string }[],
): FilterOption[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = row[field] || UNSET;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const options = order
    .filter((option) => counts.has(option.value))
    .map((option) => ({ ...option, count: counts.get(option.value) ?? 0 }));

  const unsetCount = counts.get(UNSET) ?? 0;
  if (unsetCount > 0) {
    options.push({ value: UNSET, label: "Not set", count: unsetCount });
  }
  return options;
}

function matchesFilter(value: string, filter: string) {
  if (filter === ANY) return true;
  if (filter === UNSET) return value === "";
  return value === filter;
}

function FilterSelect({
  value,
  onChange,
  options,
  allLabel,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  allLabel: string;
  ariaLabel: string;
  className?: string;
}) {
  if (options.length === 0) return null;

  const items = [
    { value: ANY, label: allLabel },
    ...options.map((option) => ({
      value: option.value,
      label: `${option.label} (${option.count})`,
    })),
  ];

  return (
    // `items` lets the trigger show a label while the menu is closed; without it the raw
    // value ("all") is what appears.
    <Select
      value={value}
      onValueChange={(next) => onChange(next ?? ANY)}
      items={items}
    >
      <SelectTrigger aria-label={ariaLabel} className={cn("h-11 w-full rounded-xl", className)}>
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent className="max-h-72 bg-popover text-popover-foreground">
        <SelectItem value={ANY}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label} ({option.count})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Ranked list shared by the owner and public pages. */
function StandingsList({
  data,
  scope,
}: {
  data: AllTimeLeaderboardPayload;
  scope: AllTimeEndorsementsScope;
}) {
  const [endorsementsRow, setEndorsementsRow] = useState<AllTimeLeaderboardRow | null>(null);
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState<string>(ANY);
  const [level, setLevel] = useState<string>(ANY);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const deferredQuery = useDeferredValue(query);

  const rows = data.rows;
  const filtersActive = gender !== ANY || level !== ANY;

  // Gender and level narrow the field, so ranks are recomputed within it: the top of a
  // filtered board reads 1-2-3 and takes the medals.
  const ranked = useMemo(() => {
    const field = rows.filter(
      (row) =>
        matchesFilter(row.gender, gender) && matchesFilter(row.pickleballLevel, level),
    );
    return field.map((row, index) => ({ row, rank: index + 1 }));
  }, [rows, gender, level]);

  const genderOptions = useMemo(() => buildFilterOptions(rows, "gender", GENDER_ORDER), [rows]);
  const levelOptions = useMemo(
    () => buildFilterOptions(rows, "pickleballLevel", LEVEL_ORDER),
    [rows],
  );

  // Search only looks someone up, so it keeps the rank they hold in the current field.
  const visible = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    if (!needle) return ranked;
    return ranked.filter(({ row }) =>
      formatPlayerTableName(row.firstName, row.lastName).toLowerCase().includes(needle),
    );
  }, [ranked, deferredQuery]);

  const clearFilters = () => {
    setGender(ANY);
    setLevel(ANY);
    setLimit(PAGE_SIZE);
  };

  return (
    <div className="space-y-5">
      <div className="all-time-totals">
        <Stat label="Players" value={String(data.totals.players)} />
        <Stat label="Sessions" value={String(data.totals.sessions)} />
        <Stat label="Games played" value={String(data.totals.gamesPlayed)} />
      </div>

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

        <FilterSelect
          value={gender}
          onChange={(next) => {
            setGender(next);
            setLimit(PAGE_SIZE);
          }}
          options={genderOptions}
          allLabel="Select Genders"
          ariaLabel="Filter by gender"
          className="sm:w-44"
        />

        <FilterSelect
          value={level}
          onChange={(next) => {
            setLevel(next);
            setLimit(PAGE_SIZE);
          }}
          options={levelOptions}
          allLabel="Select Self Rating Level"
          ariaLabel="Filter by self rating level"
          className="sm:w-60"
        />
      </div>

      {filtersActive ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">
            Showing {ranked.length} of {rows.length} players.
          </p>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4" aria-hidden />
            Clear filters
          </Button>
        </div>
      ) : null}

      {ranked.length === 0 ? (
        <p className="px-1 py-8 text-center text-sm text-muted-foreground">
          No player matches these filters.
        </p>
      ) : visible.length === 0 ? (
        <p className="px-1 py-8 text-center text-sm text-muted-foreground">
          No player matches &ldquo;{query.trim()}&rdquo;.
        </p>
      ) : (
        <>
          <ol className="all-time-list">
            {visible.slice(0, limit).map(({ row, rank }) => (
              <PlayerRow
                key={row.id}
                row={row}
                rank={rank}
                onEndorsementsClick={setEndorsementsRow}
              />
            ))}
          </ol>

          {visible.length > PAGE_SIZE ? (
            <div className="flex flex-col items-center gap-2 pt-1">
              <p className="text-sm text-muted-foreground">
                Showing {Math.min(limit, visible.length)} of {visible.length} players.
              </p>
              {limit < visible.length ? (
                <Button
                  variant="outline"
                  className="h-11 rounded-xl px-5 font-semibold"
                  onClick={() => setLimit((current) => current + PAGE_SIZE)}
                >
                  Show next {Math.min(PAGE_SIZE, visible.length - limit)}
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <AllTimeEndorsementsDialog
        scope={scope}
        rowId={endorsementsRow?.id ?? null}
        playerName={
          endorsementsRow
            ? formatPlayerTableName(endorsementsRow.firstName, endorsementsRow.lastName)
            : "Player"
        }
        open={endorsementsRow != null}
        onOpenChange={(open) => {
          if (!open) setEndorsementsRow(null);
        }}
      />
    </div>
  );
}

function ErrorState({ error }: { error: unknown }) {
  return (
    <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
      {error instanceof Error ? error.message : "Failed to load the all-time leaderboard."}
    </p>
  );
}

const NO_RESULTS_BODY =
  "Standings appear once matches have been played and scored in a session.";

/** Signed-in owner view: standings across their own sessions. */
export function AllTimeLeaderboardView() {
  const { data, isLoading, isError, error } = useAllTimeLeaderboard();

  if (isLoading) return <LoadingRows />;
  if (isError) return <ErrorState error={error} />;
  if (!data || data.rows.length === 0) {
    return <EmptyState title="No results yet" body={NO_RESULTS_BODY} />;
  }
  return <StandingsList data={data} scope="owner" />;
}

/** Each cause needs a different fix, so say which one it is rather than a generic notice. */
const UNAVAILABLE_BODY = {
  "not-configured":
    "The club account for the public leaderboard has not been set. An organizer can enable it from the server configuration.",
  "unknown-email":
    "The club account set for the public leaderboard was not found. An organizer should check that the configured email matches an existing account.",
  ambiguous:
    "More than one account has sessions and no club account is set for the public leaderboard. An organizer can choose one from the server configuration.",
} as const;

/** Public view: club-wide standings, no sign-in required. */
export function PublicAllTimeLeaderboardView() {
  const { data, isLoading, isError, error } = usePublicAllTimeLeaderboard();

  if (isLoading) return <LoadingRows />;
  if (isError) return <ErrorState error={error} />;

  if (data && !data.available) {
    return (
      <EmptyState
        title="Standings are not published yet"
        body={UNAVAILABLE_BODY[data.unavailableReason ?? "not-configured"]}
      />
    );
  }

  if (!data || data.rows.length === 0) {
    return <EmptyState title="No results yet" body={NO_RESULTS_BODY} />;
  }

  return <StandingsList data={data} scope="public" />;
}
