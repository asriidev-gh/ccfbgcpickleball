"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getShuffleAnimationDurationMs,
  randomTeamSplit,
  SHUFFLE_REVEAL_MS,
  SHUFFLE_TICK_MS,
} from "@/lib/shuffle-teams-animation";

type TeamPreview<T> = { teamA: T[]; teamB: T[] };

type UseShuffleTeamsAnimationOptions<T> = {
  teamA: T[];
  teamB: T[];
  onShuffle: () => void | Promise<void>;
  /** When false, shuffle UI is disabled (e.g. no handler). */
  enabled?: boolean;
  /** Increment or change to cancel in-flight shuffle and reset state. */
  resetKey?: string | number | boolean;
  mixedDoubles?: boolean;
  getGender?: (item: T) => string | null | undefined;
};

export function useShuffleTeamsAnimation<T>({
  teamA,
  teamB,
  onShuffle,
  enabled = true,
  resetKey,
  mixedDoubles = false,
  getGender,
}: UseShuffleTeamsAnimationOptions<T>) {
  const [isShuffling, setIsShuffling] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [preview, setPreview] = useState<TeamPreview<T> | null>(null);
  const shuffleRunId = useRef(0);

  const poolLength = teamA.length + teamB.length;
  const canShuffle = enabled && poolLength >= 4;
  const obscured = isShuffling;
  const displayTeamA = isShuffling && preview ? preview.teamA : teamA;
  const displayTeamB = isShuffling && preview ? preview.teamB : teamB;

  useEffect(() => {
    shuffleRunId.current += 1;
    setIsShuffling(false);
    setIsRevealing(false);
    setPreview(null);
  }, [resetKey]);

  const handleShuffleClick = useCallback(async () => {
    const pool = [...teamA, ...teamB];
    if (!enabled || pool.length < 4 || isShuffling) return;

    const runId = shuffleRunId.current + 1;
    shuffleRunId.current = runId;
    const duration = getShuffleAnimationDurationMs();

    setIsShuffling(true);
    setIsRevealing(false);
    const splitOptions = mixedDoubles && getGender ? { mixedDoubles: true, getGender } : undefined;

    // Apply the real lineup immediately (optimistic); ticks are only visual.
    const shufflePromise = Promise.resolve(onShuffle());
    setPreview(randomTeamSplit(pool, splitOptions));

    const tickInterval =
      duration > 0
        ? window.setInterval(() => {
            if (shuffleRunId.current !== runId) return;
            setPreview(randomTeamSplit(pool, splitOptions));
          }, SHUFFLE_TICK_MS)
        : undefined;

    try {
      await Promise.all([
        shufflePromise,
        new Promise<void>((resolve) => setTimeout(resolve, duration)),
      ]);
    } catch {
      if (shuffleRunId.current === runId) {
        setPreview(null);
        setIsShuffling(false);
        setIsRevealing(false);
      }
      return;
    } finally {
      if (tickInterval != null) window.clearInterval(tickInterval);
    }

    if (shuffleRunId.current !== runId) return;

    // Drop preview so the optimistic teams from props show through.
    setPreview(null);
    setIsShuffling(false);

    if (duration > 0) {
      setIsRevealing(true);
      window.setTimeout(() => {
        if (shuffleRunId.current === runId) setIsRevealing(false);
      }, SHUFFLE_REVEAL_MS);
    }
  }, [enabled, getGender, isShuffling, mixedDoubles, onShuffle, teamA, teamB]);

  return {
    isShuffling,
    isRevealing,
    obscured,
    displayTeamA,
    displayTeamB,
    canShuffle,
    handleShuffleClick,
  };
}
