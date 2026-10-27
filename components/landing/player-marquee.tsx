import type { CSSProperties } from "react";

import type { SpotlightPlayer } from "@/lib/public-player-spotlight";

/** One screen of tiles is about this many; a shorter list is repeated to reach it. */
const MIN_TILES_PER_SET = 12;

/** Seconds each tile spends crossing, so a long list does not speed up. */
const SECONDS_PER_TILE = 3.2;

function PlayerTile({ player }: { player: SpotlightPlayer }) {
  return (
    <li className="player-marquee__tile">
      {/* Plain img: photos come from the upload host, which is not an optimised-image origin. */}
      <img
        src={player.photoUrl}
        alt=""
        width={88}
        height={88}
        loading="lazy"
        decoding="async"
        className="player-marquee__photo"
      />
      <span className="player-marquee__name">{player.firstName}</span>
    </li>
  );
}

/**
 * Random club players drifting left to right.
 *
 * The track holds the list twice and slides by exactly half its width, so the loop has no
 * seam. The second copy is hidden from assistive tech, and the motion stops for people who
 * prefer reduced motion (the row then scrolls by hand).
 */
export function PlayerMarquee({ players }: { players: SpotlightPlayer[] }) {
  if (players.length === 0) return null;

  const repeats = Math.max(1, Math.ceil(MIN_TILES_PER_SET / players.length));
  const set = Array.from({ length: repeats }, () => players).flat();
  const duration = `${Math.round(set.length * SECONDS_PER_TILE)}s`;

  return (
    <section className="player-marquee" aria-labelledby="player-marquee-title">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <p className="landing-kicker">The community</p>
        <h2 id="player-marquee-title" className="page-title mt-2">
          Meet the players
        </h2>
      </div>

      <div className="player-marquee__viewport">
        <div
          className="player-marquee__rail"
          style={{ "--marquee-duration": duration } as CSSProperties}
        >
          <ul className="player-marquee__track">
            {set.map((player, index) => (
              <PlayerTile key={`a-${player.id}-${index}`} player={player} />
            ))}
          </ul>
          <ul className="player-marquee__track" aria-hidden>
            {set.map((player, index) => (
              <PlayerTile key={`b-${player.id}-${index}`} player={player} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
