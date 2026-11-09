"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Sports the landing hero cycles through. To add one (e.g. basketball), add an entry here:
 * a `court` drawing, a `ball`, and the word shown in the title. The order is the rotation.
 */
type HeroScene = {
  id: string;
  /** Word shown under "CCF BGC" in the title. */
  label: string;
  court: ReactNode;
  /** Net height as a share of the court plane's length, and where it stands (see globals.css). */
  net: { top: string; height: string };
  ball: ReactNode;
  /** Larger glyph that floats over the join card. */
  glyph: ReactNode;
};

const ROTATE_MS = 5000;

/* ---------------------------------------------------------------- pickleball */

/** Hole pattern: one centre hole, an inner ring of 6, an outer ring of 8. */
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

function PickleballGlyph() {
  return (
    <svg viewBox="0 0 64 64" className="size-full" aria-hidden>
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

/** Top-down pickleball court, 1 unit = 0.1 ft: 20 x 44 ft with a 7 ft kitchen each side of the net. */
const PICKLEBALL_COURT = (
  <>
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
  </>
);

/* ----------------------------------------------------------------- badminton */

function ShuttlecockGlyph() {
  return (
    <svg viewBox="0 0 64 64" className="size-full" aria-hidden>
      <defs>
        <linearGradient id="landing-shuttle-skirt" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d7dde3" />
          <stop offset="0.5" stopColor="#ffffff" />
          <stop offset="1" stopColor="#cfd6dd" />
        </linearGradient>
        <radialGradient id="landing-shuttle-cork" cx="0.36" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff1c9" />
          <stop offset="1" stopColor="#d9a441" />
        </radialGradient>
      </defs>
      {/* Feather skirt opening upward, cork head at the bottom. */}
      <path d="M22 44 L8 8 Q32 -2 56 8 L42 44 Z" fill="url(#landing-shuttle-skirt)" />
      <g stroke="rgb(90 100 110 / 0.45)" strokeWidth="1.2" fill="none">
        <path d="M22 44 L8 8" />
        <path d="M27 44 L22 5" />
        <path d="M32 44 L32 3" />
        <path d="M37 44 L42 5" />
        <path d="M42 44 L56 8" />
        <path d="M13 24 Q32 30 51 24" />
      </g>
      <circle cx="32" cy="50" r="11" fill="url(#landing-shuttle-cork)" />
    </svg>
  );
}

/**
 * Top-down badminton doubles court, same 20 x 44 ft footprint so the camera and rally path are
 * shared: singles side lines 1.5 ft in, short service lines 6.5 ft from the net, doubles back
 * service lines 2.5 ft in from the baselines, centre line between the service lines and baselines.
 */
const BADMINTON_COURT = (
  <>
    <rect className="landing-court__apron" x="-120" y="-40" width="440" height="520" />
    <rect className="landing-court__surface" x="0" y="0" width="200" height="440" />
    <g className="landing-court__lines">
      <rect x="0" y="0" width="200" height="440" />
      <line x1="15" y1="0" x2="15" y2="440" />
      <line x1="185" y1="0" x2="185" y2="440" />
      <line x1="0" y1="155" x2="200" y2="155" />
      <line x1="0" y1="285" x2="200" y2="285" />
      <line x1="0" y1="25" x2="200" y2="25" />
      <line x1="0" y1="415" x2="200" y2="415" />
      <line x1="100" y1="0" x2="100" y2="155" />
      <line x1="100" y1="285" x2="100" y2="440" />
    </g>
  </>
);

const SCENES: HeroScene[] = [
  {
    id: "pickleball",
    label: "Pickleball",
    court: PICKLEBALL_COURT,
    // 3 ft net at the centre line (y 220 of a -40..480 plane).
    net: { top: "44.23%", height: "5.77%" },
    ball: <span className="landing-court__ball" />,
    glyph: <PickleballGlyph />,
  },
  {
    id: "badminton",
    label: "Badminton",
    court: BADMINTON_COURT,
    // 5 ft net.
    net: { top: "40.38%", height: "9.62%" },
    ball: (
      <span className="landing-court__ball landing-court__ball--shuttle">
        <ShuttlecockGlyph />
      </span>
    ),
    glyph: <ShuttlecockGlyph />,
  },
];

/* ------------------------------------------------------------------ rotation */

const ActiveSceneContext = createContext<string>(SCENES[0].id);

/** The hero section: owns the rotation and exposes the current sport to the pieces below. */
export function HeroSportSection({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (SCENES.length < 2) return;
    let timer: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      timer = setInterval(() => setIndex((current) => (current + 1) % SCENES.length), ROTATE_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    // No point animating a background tab, and it keeps the cycle from jumping on return.
    const onVisibility = () => {
      stop();
      if (!document.hidden) start();
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const active = SCENES[index].id;
  return (
    <ActiveSceneContext.Provider value={active}>
      <section className="landing-hero" data-sport={active}>
        {children}
      </section>
    </ActiveSceneContext.Provider>
  );
}

function useIsActive(id: string) {
  return useContext(ActiveSceneContext) === id;
}

/** "CCF BGC" plus the sport word, which crossfades in place. */
export function HeroSportTitle() {
  const active = useContext(ActiveSceneContext);
  return (
    <h1 className="landing-title">
      CCF BGC
      <span className="landing-title__sport">
        {SCENES.map((scene) => (
          <span
            key={scene.id}
            className={cn("hero-scene landing-title__word", scene.id === active && "is-active")}
            aria-hidden={scene.id !== active}
          >
            {scene.label}
          </span>
        ))}
      </span>
    </h1>
  );
}

/** "CCF BGC <sport>" as running text, with the sport word crossfading in place. */
export function HeroSportName() {
  const active = useContext(ActiveSceneContext);
  return (
    <>
      CCF BGC{" "}
      <span className="landing-name__sport">
        {SCENES.map((scene) => (
          <span
            key={scene.id}
            className={cn("hero-scene landing-name__word", scene.id === active && "is-active")}
            aria-hidden={scene.id !== active}
          >
            {scene.label}
          </span>
        ))}
      </span>
    </>
  );
}

function CourtScene({ scene }: { scene: HeroScene }) {
  const active = useIsActive(scene.id);
  return (
    <div className={cn("landing-court hero-scene", active && "is-active")}>
      <svg className="landing-court__svg" viewBox="-120 -40 440 520" preserveAspectRatio="none">
        {scene.court}
      </svg>
      <div className="landing-court__net" style={{ top: scene.net.top, height: scene.net.height }} />
      <div className="landing-court__run">
        <span className="landing-court__shadow" />
        <div className="landing-court__hop">{scene.ball}</div>
      </div>
    </div>
  );
}

/**
 * Court floor that CSS tips back into perspective. Every sport's court is mounted and stacked;
 * only the active one is visible. Positions in globals.css (net, ball baselines) are derived
 * from the shared 440 x 520 viewBox.
 */
export function HeroCourtFloor() {
  return (
    <div className="landing-hero__floor" aria-hidden>
      {SCENES.map((scene) => (
        <CourtScene key={scene.id} scene={scene} />
      ))}
    </div>
  );
}

/** Ball floating over the join card's corner. */
export function HeroFloatBall() {
  const active = useContext(ActiveSceneContext);
  return (
    <div className="landing-float-ball" aria-hidden>
      {SCENES.map((scene) => (
        <div key={scene.id} className={cn("hero-scene absolute inset-0", scene.id === active && "is-active")}>
          {scene.glyph}
        </div>
      ))}
    </div>
  );
}
