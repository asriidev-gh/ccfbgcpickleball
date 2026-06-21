import { ArrowLeftRight, Loader2, Shuffle } from "lucide-react";

import {
  PlayerAvatar,
  PlayerProfileTrigger,
  type PlayerPhotoRef,
} from "@/components/game/player-avatar";
import {
  formatSessionRecordLabel,
  getPlayerSessionStats,
  type PlayerSessionStats,
} from "@/lib/games-played-map";
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
  canReplace?: boolean;
  onReplacePlayer?: (slotIndex: number, player: PlayerRef) => void;
  replacePendingKey?: string | null;
  empty?: boolean;
};

function ServiceBox({
  player,
  slotIndex,
  courtNumber,
  team,
  playerSessionStats,
  canReplace = false,
  onReplacePlayer,
  replacePendingKey = null,
  empty = false,
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
  const pending =
    replacePendingKey === courtReplacePendingKey(courtNumber, team, slotIndex);

  return (
    <div
      className={cn(
        "pickleball-court__box",
        empty && "pickleball-court__box--vacant",
      )}
    >
      <PlayerAvatar player={player} className="pickleball-court__avatar" />
      <div className="pickleball-court__box-info min-w-0 flex-1">
        <div className="pickleball-court__box-main flex min-w-0 items-center gap-1">
          <PlayerProfileTrigger
            player={player}
            className="pickleball-court__player-name min-w-0 truncate"
          >
            <span className="court-player-name--first">{firstName || courtName}</span>
            <span className="court-player-name--full">{courtName}</span>
          </PlayerProfileTrigger>
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
              disabled={!canReplace || pending}
            >
              {pending ? (
                <Loader2 className="size-3 animate-spin" aria-hidden />
              ) : (
                <ArrowLeftRight className="size-3" aria-hidden />
              )}
            </Button>
          ) : null}
        </div>
        <p className="pickleball-court__record">{formatSessionRecordLabel(stats)}</p>
      </div>
    </div>
  );
}

type PickleballCourtLayoutProps = {
  courtNumber: number;
  teamA: PlayerRef[];
  teamB: PlayerRef[];
  playerSessionStats: Map<string, PlayerSessionStats>;
  canReplacePlayers?: boolean;
  onReplacePlayer?: (input: {
    courtNumber: number;
    team: "A" | "B";
    slotIndex: number;
    player: PlayerRef;
  }) => void;
  replacePendingKey?: string | null;
  onSwapTeams?: () => void;
  swapPending?: boolean;
  hideEndGame?: boolean;
  empty?: boolean;
};

export function PickleballCourtLayout({
  courtNumber,
  teamA,
  teamB,
  playerSessionStats,
  canReplacePlayers = false,
  onReplacePlayer,
  replacePendingKey = null,
  onSwapTeams,
  swapPending = false,
  hideEndGame = false,
  empty = false,
}: PickleballCourtLayoutProps) {
  const replaceHandler =
    onReplacePlayer &&
    ((team: "A" | "B") => (slotIndex: number, player: PlayerRef) =>
      onReplacePlayer({ courtNumber, team, slotIndex, player }));

  return (
    <div
      className={cn("pickleball-court", empty && "pickleball-court--vacant")}
    >
      <div
        className={cn(
          "pickleball-court__surface",
          empty && "pickleball-court__surface--vacant",
        )}
        role="img"
        aria-label={`Pickleball court ${courtNumber}`}
      >
        <div className="pickleball-court__service pickleball-court__service--a">
          <p className="pickleball-court__team-label pickleball-court__team-label--a">Team A</p>
          <ServiceBox
            player={teamA[0]}
            slotIndex={0}
            courtNumber={courtNumber}
            team="A"
            playerSessionStats={playerSessionStats}
            canReplace={canReplacePlayers}
            onReplacePlayer={replaceHandler?.("A")}
            replacePendingKey={replacePendingKey}
            empty={empty}
          />
          <ServiceBox
            player={teamA[1]}
            slotIndex={1}
            courtNumber={courtNumber}
            team="A"
            playerSessionStats={playerSessionStats}
            canReplace={canReplacePlayers}
            onReplacePlayer={replaceHandler?.("A")}
            replacePendingKey={replacePendingKey}
            empty={empty}
          />
        </div>

        <div className="pickleball-court__kitchen pickleball-court__kitchen--a" aria-hidden />

        <div className="pickleball-court__net" aria-hidden={false}>
          {!hideEndGame && onSwapTeams && teamA.length > 0 && teamB.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="pickleball-court__swap-btn size-8 shrink-0"
              aria-label="Shuffle players into new teams"
              title="Shuffle teams (re-roll until it looks right)"
              disabled={swapPending}
              onClick={onSwapTeams}
            >
              <Shuffle className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <span className="pickleball-court__vs">VS</span>
        </div>

        <div className="pickleball-court__kitchen pickleball-court__kitchen--b" aria-hidden />

        <div className="pickleball-court__service pickleball-court__service--b">
          <p className="pickleball-court__team-label pickleball-court__team-label--b">Team B</p>
          <ServiceBox
            player={teamB[0]}
            slotIndex={0}
            courtNumber={courtNumber}
            team="B"
            playerSessionStats={playerSessionStats}
            canReplace={canReplacePlayers}
            onReplacePlayer={replaceHandler?.("B")}
            replacePendingKey={replacePendingKey}
            empty={empty}
          />
          <ServiceBox
            player={teamB[1]}
            slotIndex={1}
            courtNumber={courtNumber}
            team="B"
            playerSessionStats={playerSessionStats}
            canReplace={canReplacePlayers}
            onReplacePlayer={replaceHandler?.("B")}
            replacePendingKey={replacePendingKey}
            empty={empty}
          />
        </div>
      </div>
    </div>
  );
}
