"use client";

import type { PlayerPhotoRef } from "@/components/game/player-avatar";
import { PlayerAvatar, PlayerProfileTrigger } from "@/components/game/player-avatar";
import { PlayerGenderPill } from "@/components/game/player-gender-pill";
import {
  formatSessionRecordWithRankLabel,
  getPlayerLeaderboardRank,
  getPlayerSessionStats,
  type PlayerSessionStats,
} from "@/lib/games-played-map";
import { capitalizeNameWords, cn, formatPlayerCourtName } from "@/lib/utils";

type PlayerRef = PlayerPhotoRef & { _id?: string };

function SinglesPlayerSlot({
  player,
  team,
  playerSessionStats,
  playerLeaderboardRanks,
  empty = false,
}: {
  player?: PlayerRef;
  team: "A" | "B";
  playerSessionStats: Map<string, PlayerSessionStats>;
  playerLeaderboardRanks?: Map<string, number>;
  empty?: boolean;
}) {
  const label = team === "A" ? "Player A" : "Player B";

  if (!player || empty) {
    return (
      <div
        className={cn(
          "singles-court__player singles-court__player--vacant",
          team === "A" ? "singles-court__player--a" : "singles-court__player--b",
        )}
      >
        <span className="singles-court__label">{label}</span>
        <div className="singles-court__avatar singles-court__avatar--empty" aria-hidden />
      </div>
    );
  }

  const firstName = capitalizeNameWords(player.firstName);
  const courtName = formatPlayerCourtName(player.firstName, player.lastName);
  const stats = getPlayerSessionStats(playerSessionStats, player._id);
  const rank = playerLeaderboardRanks
    ? getPlayerLeaderboardRank(playerLeaderboardRanks, player._id)
    : null;
  const sessionRecordLabel = formatSessionRecordWithRankLabel(stats, rank);

  return (
    <div
      className={cn(
        "singles-court__player",
        team === "A" ? "singles-court__player--a" : "singles-court__player--b",
      )}
    >
      <span className="singles-court__label">{label}</span>
      <PlayerAvatar player={player} className="singles-court__avatar" />
      <div className="singles-court__info">
        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
          <PlayerProfileTrigger player={player} className="singles-court__name">
            <span className="court-player-name--first">{firstName || courtName}</span>
            <span className="court-player-name--full">{courtName}</span>
          </PlayerProfileTrigger>
          <PlayerGenderPill gender={player.gender} />
        </span>
        <p className="singles-court__record">{sessionRecordLabel}</p>
      </div>
    </div>
  );
}

type SinglesCourtLayoutProps = {
  courtNumber: number;
  teamA: PlayerRef[];
  teamB: PlayerRef[];
  playerSessionStats: Map<string, PlayerSessionStats>;
  playerLeaderboardRanks?: Map<string, number>;
  empty?: boolean;
};

export function SinglesCourtLayout({
  courtNumber,
  teamA,
  teamB,
  playerSessionStats,
  playerLeaderboardRanks,
  empty = false,
}: SinglesCourtLayoutProps) {
  return (
    <div
      className={cn(
        "pickleball-court pickleball-court--singles",
        empty && "pickleball-court--vacant",
      )}
    >
      <div
        className={cn("singles-court__surface", empty && "singles-court__surface--vacant")}
        role="img"
        aria-label={`Singles pickleball court ${courtNumber}`}
      >
        <SinglesPlayerSlot
          player={teamA[0]}
          team="A"
          playerSessionStats={playerSessionStats}
          playerLeaderboardRanks={playerLeaderboardRanks}
          empty={empty}
        />

        <div className="singles-court__net" aria-hidden={false}>
          <span className="singles-court__vs">VS</span>
        </div>

        <SinglesPlayerSlot
          player={teamB[0]}
          team="B"
          playerSessionStats={playerSessionStats}
          playerLeaderboardRanks={playerLeaderboardRanks}
          empty={empty}
        />
      </div>
    </div>
  );
}
