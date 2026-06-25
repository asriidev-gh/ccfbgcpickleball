"use client";

import { ArrowLeftRight, Loader2, Shuffle } from "lucide-react";

import {
  PlayerAvatar,
  PlayerProfileTrigger,
  type PlayerPhotoRef,
} from "@/components/game/player-avatar";
import { PlayerGenderPill } from "@/components/game/player-gender-pill";
import {
  formatSessionRecordLabel,
  formatSessionRecordWithRankLabel,
  getPlayerLeaderboardRank,
  getPlayerSessionStats,
  type PlayerSessionStats,
} from "@/lib/games-played-map";
import { useShuffleTeamsAnimation } from "@/hooks/use-shuffle-teams-animation";
import {
  capitalizeNameWords,
  cn,
  formatPlayerCourtName,
  formatPlayerDisplayName,
} from "@/lib/utils";
import { Button } from "@/components/ui/button";

type PlayerRef = PlayerPhotoRef & { _id?: string };

function courtReplacePendingKey(
  courtNumber: number,
  team: "A" | "B",
  slotIndex: number,
) {
  return `${courtNumber}-${team}-${slotIndex}`;
}

type ServiceBoxProps = {
  player?: PlayerRef;
  slotIndex: number;
  courtNumber: number;
  team: "A" | "B";
  playerSessionStats: Map<string, PlayerSessionStats>;
  playerLeaderboardRanks?: Map<string, number>;
  showLeaderboardRank?: boolean;
  canReplace?: boolean;
  onReplacePlayer?: (slotIndex: number, player: PlayerRef) => void;
  replacePendingKey?: string | null;
  empty?: boolean;
  obscured?: boolean;
};

function ServiceBox({
  player,
  slotIndex,
  courtNumber,
  team,
  playerSessionStats,
  playerLeaderboardRanks,
  showLeaderboardRank = false,
  canReplace = false,
  onReplacePlayer,
  replacePendingKey = null,
  empty = false,
  obscured = false,
}: ServiceBoxProps) {
  if (!player) {
    return (
      <div className="pickleball-court__box pickleball-court__box--empty">
        <span className="pickleball-court__box-placeholder" aria-hidden>
          —
        </span>
      </div>
    );
  }

  const firstName = capitalizeNameWords(player.firstName);
  const courtName = formatPlayerCourtName(player.firstName, player.lastName);
  const fullName = formatPlayerDisplayName(player.firstName, player.lastName);
  const stats = getPlayerSessionStats(playerSessionStats, player._id);
  const rank = showLeaderboardRank
    ? getPlayerLeaderboardRank(playerLeaderboardRanks ?? new Map(), player._id)
    : null;
  const sessionRecordLabel = showLeaderboardRank
    ? formatSessionRecordWithRankLabel(stats, rank)
    : formatSessionRecordLabel(stats);
  const pending =
    replacePendingKey === courtReplacePendingKey(courtNumber, team, slotIndex);

  return (
    <div
      className={cn(
        "pickleball-court__box",
        empty && "pickleball-court__box--vacant",
        obscured && "pickleball-court__box--obscured",
      )}
    >
      <PlayerAvatar
        player={player}
        className={cn("pickleball-court__avatar", obscured && "fill-court-player-avatar--obscured")}
      />
      <div className="pickleball-court__box-info min-w-0 flex-1">
        <div className="pickleball-court__box-main flex min-w-0 items-center gap-1">
          <span className="inline-flex min-w-0 max-w-full flex-1 items-center gap-1">
            <PlayerProfileTrigger
              player={player}
              className="pickleball-court__player-name min-w-0 truncate"
            >
              <span
                className={cn(
                  "court-player-name--first",
                  obscured && "fill-court-player-name--obscured",
                )}
              >
                {firstName || courtName}
              </span>
              <span
                className={cn(
                  "court-player-name--full",
                  obscured && "fill-court-player-name--obscured",
                )}
              >
                {courtName}
              </span>
            </PlayerProfileTrigger>
            <PlayerGenderPill gender={player.gender} birthdate={player.birthdate} />
          </span>
          {onReplacePlayer ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="court-replace-btn pickleball-court__replace-btn size-7 shrink-0"
              aria-label={`Replace ${fullName}`}
              title={canReplace ? `Replace ${fullName}` : "No players in the queue"}
              onClick={(event) => {
                event.stopPropagation();
                onReplacePlayer(slotIndex, player);
              }}
              disabled={!canReplace || pending || obscured}
            >
              {pending ? (
                <Loader2 className="size-3 animate-spin" aria-hidden />
              ) : (
                <ArrowLeftRight className="size-3" aria-hidden />
              )}
            </Button>
          ) : null}
        </div>
        <p
          className={cn(
            "pickleball-court__record",
            obscured && "fill-court-player-name--obscured",
          )}
        >
          {sessionRecordLabel}
        </p>
      </div>
    </div>
  );
}

type PickleballCourtLayoutProps = {
  courtNumber: number;
  teamA: PlayerRef[];
  teamB: PlayerRef[];
  playerSessionStats: Map<string, PlayerSessionStats>;
  playerLeaderboardRanks?: Map<string, number>;
  showLeaderboardRank?: boolean;
  canReplacePlayers?: boolean;
  onReplacePlayer?: (input: {
    courtNumber: number;
    team: "A" | "B";
    slotIndex: number;
    player: PlayerRef;
  }) => void;
  replacePendingKey?: string | null;
  onSwapTeams?: () => void | Promise<void>;
  swapPending?: boolean;
  mixedDoubles?: boolean;
  hideEndGame?: boolean;
  empty?: boolean;
};

export function PickleballCourtLayout({
  courtNumber,
  teamA,
  teamB,
  playerSessionStats,
  playerLeaderboardRanks,
  showLeaderboardRank = false,
  canReplacePlayers = false,
  onReplacePlayer,
  replacePendingKey = null,
  onSwapTeams,
  swapPending = false,
  mixedDoubles = false,
  hideEndGame = false,
  empty = false,
}: PickleballCourtLayoutProps) {
  const {
    isShuffling,
    isRevealing,
    obscured,
    displayTeamA,
    displayTeamB,
    canShuffle,
    handleShuffleClick,
  } = useShuffleTeamsAnimation({
    teamA,
    teamB,
    onShuffle: onSwapTeams ?? (async () => {}),
    enabled: Boolean(onSwapTeams) && !empty,
    resetKey: courtNumber,
    mixedDoubles,
    getGender: (player) => player.gender,
  });

  const replaceHandler =
    onReplacePlayer &&
    ((team: "A" | "B") => (slotIndex: number, player: PlayerRef) =>
      onReplacePlayer({ courtNumber, team, slotIndex, player }));

  const showShuffle =
    !hideEndGame && onSwapTeams && displayTeamA.length > 0 && displayTeamB.length > 0;
  const shuffleDisabled = swapPending || isShuffling || !canShuffle;

  return (
    <div
      className={cn(
        "pickleball-court",
        empty && "pickleball-court--vacant",
        isShuffling && "fill-court-teams--shuffling pickleball-court--shuffling",
        isRevealing && "fill-court-teams--reveal pickleball-court--reveal",
      )}
      aria-busy={isShuffling}
    >
      {isShuffling ? (
        <p className="fill-court-shuffle-status caption px-2 pb-1 text-center font-medium text-primary">
          Shuffling teams…
        </p>
      ) : null}
      <div
        className={cn(
          "pickleball-court__surface",
          empty && "pickleball-court__surface--vacant",
        )}
        role="img"
        aria-label={`Pickleball court ${courtNumber}`}
      >
        <div
          className={cn(
            "pickleball-court__service pickleball-court__service--a",
            obscured && "pickleball-court__service--obscured",
          )}
        >
          <p className="pickleball-court__team-label pickleball-court__team-label--a">Team A</p>
          <ServiceBox
            player={displayTeamA[0]}
            slotIndex={0}
            courtNumber={courtNumber}
            team="A"
            playerSessionStats={playerSessionStats}
            playerLeaderboardRanks={playerLeaderboardRanks}
            showLeaderboardRank={showLeaderboardRank}
            canReplace={canReplacePlayers}
            onReplacePlayer={replaceHandler?.("A")}
            replacePendingKey={replacePendingKey}
            empty={empty}
            obscured={obscured}
          />
          <ServiceBox
            player={displayTeamA[1]}
            slotIndex={1}
            courtNumber={courtNumber}
            team="A"
            playerSessionStats={playerSessionStats}
            playerLeaderboardRanks={playerLeaderboardRanks}
            showLeaderboardRank={showLeaderboardRank}
            canReplace={canReplacePlayers}
            onReplacePlayer={replaceHandler?.("A")}
            replacePendingKey={replacePendingKey}
            empty={empty}
            obscured={obscured}
          />
        </div>

        <div className="pickleball-court__kitchen pickleball-court__kitchen--a" aria-hidden />

        <div className="pickleball-court__net" aria-hidden={false}>
          {showShuffle ? (
            <div
              className={cn(
                "fill-court-shuffle-row relative flex flex-col items-center gap-0.5",
                isShuffling && "fill-court-shuffle-row--active",
              )}
            >
              {isShuffling ? (
                <span className="fill-court-roulette-ring pointer-events-none" aria-hidden />
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  "fill-court-shuffle-btn pickleball-court__swap-btn relative z-10 size-8 shrink-0",
                  isShuffling && "fill-court-shuffle-btn--spinning",
                )}
                aria-label="Shuffle players into new teams"
                title="Shuffle teams (re-roll until it looks right)"
                disabled={shuffleDisabled}
                onClick={() => void handleShuffleClick()}
              >
                <Shuffle className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </div>
          ) : null}
          <span className="pickleball-court__vs">VS</span>
        </div>

        <div className="pickleball-court__kitchen pickleball-court__kitchen--b" aria-hidden />

        <div
          className={cn(
            "pickleball-court__service pickleball-court__service--b",
            obscured && "pickleball-court__service--obscured",
          )}
        >
          <p className="pickleball-court__team-label pickleball-court__team-label--b">Team B</p>
          <ServiceBox
            player={displayTeamB[0]}
            slotIndex={0}
            courtNumber={courtNumber}
            team="B"
            playerSessionStats={playerSessionStats}
            playerLeaderboardRanks={playerLeaderboardRanks}
            showLeaderboardRank={showLeaderboardRank}
            canReplace={canReplacePlayers}
            onReplacePlayer={replaceHandler?.("B")}
            replacePendingKey={replacePendingKey}
            empty={empty}
            obscured={obscured}
          />
          <ServiceBox
            player={displayTeamB[1]}
            slotIndex={1}
            courtNumber={courtNumber}
            team="B"
            playerSessionStats={playerSessionStats}
            playerLeaderboardRanks={playerLeaderboardRanks}
            showLeaderboardRank={showLeaderboardRank}
            canReplace={canReplacePlayers}
            onReplacePlayer={replaceHandler?.("B")}
            replacePendingKey={replacePendingKey}
            empty={empty}
            obscured={obscured}
          />
        </div>
      </div>
    </div>
  );
}
