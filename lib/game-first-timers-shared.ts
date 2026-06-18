import type { PlayerPhotoRef } from "@/components/game/player-avatar";

export type GameFirstTimerPlayer = PlayerPhotoRef & {
  playerId: string;
};

export type GameFirstTimers = {
  count: number;
  players: GameFirstTimerPlayer[];
};
