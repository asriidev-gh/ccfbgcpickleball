"use client";

import { useEffect, useRef, useState } from "react";

import type { SpotlightPlayer } from "@/lib/public-player-spotlight";

/** Three rows at the widest layout (10 columns); narrower screens hide the overflow in CSS. */
const MAX_TILES = 30;

/** A burst of tiles changes this often, each after its own random delay within the spread. */
const BURST_INTERVAL_MS = 1500;
const BURST_SPREAD_MS = 1200;
/** Min and max tiles per burst. */
const BURST_SIZE = [3, 6] as const;

/** How long the outgoing photo stays so it can fade out. */
const LEAVE_MS = 800;

function PlayerTile({ player, slot }: { player: SpotlightPlayer; slot: number }) {
  const [shown, setShown] = useState(player);
  const [leaving, setLeaving] = useState<SpotlightPlayer | null>(null);

  // Adjust state while rendering (not in an effect) so the outgoing photo is on screen in the
  // very same frame the new one mounts, with no flash of the new photo alone.
  if (player.id !== shown.id) {
    setLeaving(shown);
    setShown(player);
  }

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setLeaving(null), LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  return (
    <li className="player-grid__tile" data-slot={slot}>
      <span className="player-grid__frame">
        <span className="player-grid__clip">
          {leaving ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`out-${leaving.id}`}
              src={leaving.photoUrl}
              alt=""
              className="player-grid__photo player-grid__photo--out"
            />
          ) : null}
          {/* Plain img: photos come from the upload host, which is not an optimised-image origin. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={`in-${shown.id}`}
            src={shown.photoUrl}
            alt=""
            width={88}
            height={88}
            loading="lazy"
            decoding="async"
            className="player-grid__photo player-grid__photo--in"
          />
        </span>
        {leaving ? <span key={`ring-${shown.id}`} className="player-grid__ring" aria-hidden /> : null}
      </span>
      <span key={`name-${shown.id}`} className="player-grid__name">
        {shown.firstName}
      </span>
    </li>
  );
}

/**
 * Three rows of club players that twinkle: every beat, a handful of tiles picked at random
 * among the ones on screen swap to players who are not currently shown, each after its own
 * short random delay so they do not change in lockstep. A new photo is fetched first, so a
 * slow image never leaves an empty circle mid-transition.
 */
export function PlayerGrid({ players }: { players: SpotlightPlayer[] }) {
  const [slots, setSlots] = useState(() => players.slice(0, MAX_TILES));
  const slotsRef = useRef(slots);
  const gridRef = useRef<HTMLUListElement>(null);
  const bench = useRef(players.slice(MAX_TILES));

  useEffect(() => {
    if (players.length < 2) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const pending = new Set<number>();
    const timeouts = new Set<number>();
    let disposed = false;

    const commit = (updated: SpotlightPlayer[]) => {
      slotsRef.current = updated;
      setSlots(updated);
    };

    const later = (run: () => void, delay: number) => {
      const id = window.setTimeout(() => {
        timeouts.delete(id);
        if (!disposed) run();
      }, delay);
      timeouts.add(id);
    };

    const swapWithBench = (slot: number) => {
      const index = Math.floor(Math.random() * bench.current.length);
      const [next] = bench.current.splice(index, 1);
      if (!next) return;

      const preload = new Image();
      preload.onload = () => {
        if (disposed) return;
        const updated = [...slotsRef.current];
        bench.current.push(updated[slot]);
        updated[slot] = next;
        commit(updated);
      };
      preload.onerror = () => bench.current.push(next);
      preload.src = next.photoUrl;
    };

    const swapPair = (a: number, b: number) => {
      const updated = [...slotsRef.current];
      [updated[a], updated[b]] = [updated[b], updated[a]];
      commit(updated);
    };

    const timer = window.setInterval(() => {
      if (document.hidden || !gridRef.current) return;

      // Only tiles that are laid out count: narrower screens hide the extra columns.
      const visible = Array.from(gridRef.current.children)
        .filter((tile): tile is HTMLElement => tile instanceof HTMLElement && tile.offsetParent !== null)
        .map((tile) => Number(tile.dataset.slot))
        .filter((slot) => !pending.has(slot));

      const [minBurst, maxBurst] = BURST_SIZE;
      const burst = Math.min(
        minBurst + Math.floor(Math.random() * (maxBurst - minBurst + 1)),
        Math.floor(visible.length / 3),
      );

      // Partial shuffle: the first `burst` entries are a random sample without repeats.
      for (let i = 0; i < burst; i += 1) {
        const j = i + Math.floor(Math.random() * (visible.length - i));
        [visible[i], visible[j]] = [visible[j], visible[i]];
      }

      if (bench.current.length >= burst) {
        for (const slot of visible.slice(0, burst)) {
          pending.add(slot);
          later(() => {
            pending.delete(slot);
            swapWithBench(slot);
          }, Math.random() * BURST_SPREAD_MS);
        }
        return;
      }

      // Everyone already fits on screen: pairs of tiles trade places instead.
      for (let i = 0; i + 1 < burst; i += 2) {
        const [a, b] = [visible[i], visible[i + 1]];
        pending.add(a);
        pending.add(b);
        later(() => {
          pending.delete(a);
          pending.delete(b);
          swapPair(a, b);
        }, Math.random() * BURST_SPREAD_MS);
      }
    }, BURST_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      timeouts.forEach((id) => window.clearTimeout(id));
    };
  }, [players]);

  return (
    <ul ref={gridRef} className="player-grid">
      {slots.map((player, index) => (
        <PlayerTile key={index} player={player} slot={index} />
      ))}
    </ul>
  );
}
