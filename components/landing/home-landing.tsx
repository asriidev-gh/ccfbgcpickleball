import {
  Cross,
  HeartHandshake,
  LogIn,
  Megaphone,
  MonitorPlay,
  QrCode,
  ScanLine,
  Shuffle,
  Sparkles,
  Trophy,
} from "lucide-react";
import Link from "next/link";

import { ClubGallery } from "@/components/landing/club-gallery";
import { PlayerMarquee } from "@/components/landing/player-marquee";
import { CommunityBand } from "@/components/landing/community-band";
import { JoinSessionCard } from "@/components/landing/join-session-card";
import { Button } from "@/components/ui/button";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-config";
import type { PublicClubLinks } from "@/lib/public-club-links";
import type { SpotlightPlayer } from "@/lib/public-player-spotlight";

const HERO_CHIPS = [
  { icon: QrCode, label: "QR check-in" },
  { icon: Shuffle, label: "Auto-balanced matches" },
  { icon: MonitorPlay, label: "Live queue board" },
];

const STEPS = [
  {
    title: "Scan or enter the code",
    body: "Point your camera at the QR poster, or type the session code into the box above.",
  },
  {
    title: "Check in",
    body: "Confirm your name once. Returning players are recognized from previous sessions.",
  },
  {
    title: "Get matched",
    body: "The queue groups you into a balanced doubles or singles match and calls your court.",
  },
  {
    title: "Play, then rotate",
    body: "Scores are recorded at the end of the match and you rejoin the queue automatically.",
  },
];

const FEATURES = [
  {
    icon: MonitorPlay,
    title: "Live court board",
    body: "Every court, every match in progress, and where you sit in the queue.",
  },
  {
    icon: Shuffle,
    title: "Match formats",
    body: "Auto-balanced, winner and loser groups, or mixed doubles, depending on how the session is set.",
  },
  {
    icon: ScanLine,
    title: "QR check-in",
    body: "A scan replaces the clipboard at the registration table.",
  },
  {
    icon: Trophy,
    title: "Leaderboard and stats",
    body: "Wins, losses and games played per session, with a shareable player card.",
  },
  {
    icon: Megaphone,
    title: "Announcements",
    body: "Session updates reach everyone who checked in.",
  },
  {
    icon: HeartHandshake,
    title: "Prayer and DGroup requests",
    body: "Ask for prayer or join a discipleship group from the session screen.",
  },
];

/** Hole pattern for the hero pickleball: one centre hole, an inner ring of 6, an outer ring of 8. */
function ballRing(radius: number, count: number, offsetDeg: number, size: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = ((offsetDeg + (index * 360) / count) * Math.PI) / 180;
    return [
      Math.round((32 + radius * Math.cos(angle)) * 100) / 100,
      Math.round((32 + radius * Math.sin(angle)) * 100) / 100,
      size,
    ] as const;
  });
}

const BALL_HOLES = [[32, 32, 3.2] as const, ...ballRing(12, 6, 0, 3), ...ballRing(21, 8, 22.5, 2.4)];

function PickleballGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <radialGradient id="landing-ball-shade" cx="0.36" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#fbffd6" />
          <stop offset="0.45" stopColor="#e3f046" />
          <stop offset="1" stopColor="#a9ba1f" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="29" fill="url(#landing-ball-shade)" />
      {BALL_HOLES.map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="rgb(70 82 10 / 0.38)" />
      ))}
    </svg>
  );
}

/**
 * Top-down pickleball court (1 unit = 0.1 ft: 20 x 44 ft, kitchen 7 ft each side of the net)
 * that CSS tips back into perspective, with a ball rallying over the net. Positions in
 * globals.css (net, ball baselines) are derived from this viewBox.
 */
function HeroCourtFloor() {
  return (
    <div className="landing-hero__floor" aria-hidden>
      <div className="landing-court">
        <svg className="landing-court__svg" viewBox="-120 -40 440 520" preserveAspectRatio="none">
          <rect className="landing-court__apron" x="-120" y="-40" width="440" height="520" />
          <rect className="landing-court__surface" x="0" y="0" width="200" height="440" />
          <rect className="landing-court__kitchen" x="0" y="150" width="200" height="140" />
          <g className="landing-court__lines">
            <rect x="0" y="0" width="200" height="440" />
            <line x1="0" y1="150" x2="200" y2="150" />
            <line x1="0" y1="290" x2="200" y2="290" />
            <line x1="100" y1="0" x2="100" y2="150" />
            <line x1="100" y1="290" x2="100" y2="440" />
          </g>
        </svg>
        <div className="landing-court__net" />
        <div className="landing-court__run">
          <span className="landing-court__shadow" />
          <div className="landing-court__hop">
            <span className="landing-court__ball" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomeLanding({
  clubLinks,
  players = [],
}: {
  clubLinks?: PublicClubLinks;
  players?: SpotlightPlayer[];
}) {
  return (
    <main className="landing">
      <section className="landing-hero">
        <div className="landing-hero__sky" aria-hidden />
        <div className="landing-hero__glow" aria-hidden />
        <div className="landing-hero__beams" aria-hidden />
        <HeroCourtFloor />
        <div className="landing-hero__scrim" aria-hidden />
        <div className="landing-hero__grain" aria-hidden />

        <div className="relative mx-auto grid max-w-7xl gap-10 px-6 py-14 lg:grid-cols-[1.05fr_minmax(0,0.95fr)] lg:items-center lg:gap-16 lg:px-10 lg:py-20">
          <div className="flex flex-col items-start gap-6">
            <div className="landing-rise space-y-4">
              <p className="landing-kicker landing-kicker--pill inline-flex items-center gap-2">
                <Cross className="h-3.5 w-3.5" aria-hidden />
                Fellowship on the court
              </p>
              <h1 className="landing-title">{APP_NAME}</h1>
              <div className="landing-rally" aria-hidden>
                <span className="landing-rally__track" />
                <span className="landing-rally__x">
                  <span className="landing-rally__ball" />
                </span>
              </div>
              <p className="landing-lead">{APP_TAGLINE}</p>
            </div>

            <ul className="landing-rise landing-rise--2 flex flex-wrap gap-2">
              {HERO_CHIPS.map(({ icon: Icon, label }) => (
                <li key={label} className="landing-chip">
                  <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>

            <div className="landing-rise landing-rise--3 flex w-full gap-2 sm:w-auto sm:gap-3">
              <Button
                size="lg"
                className="h-12 min-w-0 flex-1 rounded-xl px-3 text-sm font-semibold whitespace-nowrap sm:flex-none sm:px-5 sm:text-base"
                nativeButton={false}
                render={<Link href="/standings" />}
              >
                <Trophy className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
                {/* The full label overflows its half of the row on phones. */}
                <span className="sm:hidden">Leaderboard</span>
                <span className="hidden sm:inline">All-time Leaderboard</span>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 min-w-0 flex-1 rounded-xl px-3 text-sm font-semibold whitespace-nowrap sm:flex-none sm:px-5 sm:text-base"
                nativeButton={false}
                render={<Link href="#how-it-works" />}
              >
                See how it works
              </Button>
            </div>
          </div>

          <div className="landing-rise landing-rise--card relative">
            <PickleballGlyph className="landing-float-ball" />
            <JoinSessionCard clubLinks={clubLinks} />
          </div>
        </div>
      </section>

      <PlayerMarquee players={players} />

      <ClubGallery />

      <section
        id="how-it-works"
        className="mt-14 scroll-mt-24 border-y border-border/60 bg-muted/20 lg:mt-20"
      >
        <div className="mx-auto max-w-7xl px-6 py-14 lg:px-10 lg:py-20">
          <header className="max-w-2xl">
            <p className="landing-kicker">How it works</p>
            <h2 className="page-title mt-2">From the door to the court in four steps</h2>
            <p className="caption mt-3 text-base">
              No sign-up sheet, no shouting names across the gym, no guessing when you are up next.
            </p>
          </header>

          <ol className="landing-steps mt-10">
            {STEPS.map(({ title, body }, index) => (
              <li key={title} className="landing-step">
                <span className="landing-step__num" aria-hidden>
                  {index + 1}
                </span>
                <div className="landing-step__body">
                  <h3 className="text-base font-semibold text-foreground">{title}</h3>
                  <p className="caption mt-1.5">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14 lg:px-10 lg:py-20">
        <header className="max-w-2xl">
          <p className="landing-kicker">In the app</p>
          <h2 className="page-title mt-2">What is on your screen during open play</h2>
        </header>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <article key={title} className="landing-feature">
              <span className="landing-feature__icon" aria-hidden>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-foreground">{title}</h3>
                <p className="caption mt-1">{body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <CommunityBand />

      <section className="px-6 pt-14 pb-16 lg:px-10 lg:pt-20 lg:pb-24">
        <div className="landing-cta mx-auto max-w-7xl">
          <div className="landing-cta__body">
            {/* Explicit utilities rather than `.section-title`: some themes restyle that class
                as a dim sub-label, which would rank this heading below its own body copy. */}
            <h2 className="font-heading text-xl font-semibold tracking-tight text-balance text-foreground">
              Running today&rsquo;s session?
            </h2>
            <p className="caption mt-2 max-w-xl text-base">
              Open the organizer dashboard to set up courts, share the QR, and manage the queue.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:shrink-0">
            <Button
              size="lg"
              className="h-12 rounded-xl px-5 text-base font-semibold"
              nativeButton={false}
              render={<a href="https://www.paddlestacks.com/signup?saveQuickPlay=1&referrer=ccf" />}
            >
              <LogIn className="h-5 w-5" aria-hidden />
              Organizer sign up
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 rounded-xl px-5 text-base font-semibold"
              nativeButton={false}
              render={<a href="https://www.paddlestacks.com/play?referrer=ccf" />}
            >
              <Sparkles className="h-5 w-5" aria-hidden />
              Quick session
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
