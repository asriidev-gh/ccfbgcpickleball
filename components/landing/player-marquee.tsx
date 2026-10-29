import { PlayerGrid } from "@/components/landing/player-grid";
import type { SpotlightPlayer } from "@/lib/public-player-spotlight";

/** Heading plus the rotating three-row grid of club players. */
export function PlayerMarquee({ players }: { players: SpotlightPlayer[] }) {
  if (players.length === 0) return null;

  // Same container as the "On the court" gallery below, so the two sections line up.
  return (
    <section
      className="player-marquee mx-auto max-w-7xl px-6 lg:px-10"
      aria-labelledby="player-marquee-title"
    >
      <header className="max-w-2xl">
        <p className="landing-kicker">The community</p>
        <h2 id="player-marquee-title" className="page-title mt-2">
          Meet the players
        </h2>
      </header>

      <PlayerGrid players={players} />
    </section>
  );
}
