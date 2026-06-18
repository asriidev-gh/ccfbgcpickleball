"use client";

import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const CHAMPION_ELECTRIC_FILTER_ID = "leaderboard-champion-electric-filter";

type LeaderboardPodiumFrameProps = {
  rank: 1 | 2 | 3;
  compact?: boolean;
  className?: string;
  children: ReactNode;
};

function ChampionElectricFilterDefs() {
  return (
    <svg className="leaderboard-podium-frame__defs" aria-hidden>
      <defs>
        <filter
          id={CHAMPION_ELECTRIC_FILTER_ID}
          colorInterpolationFilters="sRGB"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise1" seed="1" />
          <feOffset in="noise1" dx="0" dy="0" result="offsetNoise1">
            <animate attributeName="dy" values="280; 0" dur="6s" repeatCount="indefinite" calcMode="linear" />
          </feOffset>

          <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise2" seed="1" />
          <feOffset in="noise2" dx="0" dy="0" result="offsetNoise2">
            <animate attributeName="dy" values="0; -280" dur="6s" repeatCount="indefinite" calcMode="linear" />
          </feOffset>

          <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise3" seed="2" />
          <feOffset in="noise3" dx="0" dy="0" result="offsetNoise3">
            <animate attributeName="dx" values="220; 0" dur="6s" repeatCount="indefinite" calcMode="linear" />
          </feOffset>

          <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise4" seed="2" />
          <feOffset in="noise4" dx="0" dy="0" result="offsetNoise4">
            <animate attributeName="dx" values="0; -220" dur="6s" repeatCount="indefinite" calcMode="linear" />
          </feOffset>

          <feComposite in="offsetNoise1" in2="offsetNoise2" result="part1" />
          <feComposite in="offsetNoise3" in2="offsetNoise4" result="part2" />
          <feBlend in="part1" in2="part2" mode="color-dodge" result="combinedNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="combinedNoise"
            scale="22"
            xChannelSelector="R"
            yChannelSelector="B"
          />
        </filter>
      </defs>
    </svg>
  );
}

export function LeaderboardPodiumFrame({
  rank,
  compact = false,
  className,
  children,
}: LeaderboardPodiumFrameProps) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const variant = rank === 1 ? "gold" : rank === 2 ? "silver" : "bronze";
  const animated = rank === 1 && !compact && !reduceMotion;

  return (
    <div
      className={cn(
        "leaderboard-podium-frame",
        `leaderboard-podium-frame--${variant}`,
        animated && "leaderboard-podium-frame--animated",
        compact && "leaderboard-podium-frame--compact",
        className,
      )}
    >
      {animated ? <ChampionElectricFilterDefs /> : null}
      <div className="leaderboard-podium-frame__halo" aria-hidden />
      <div className="leaderboard-podium-frame__shell">
        <div className="leaderboard-podium-frame__border-outer" aria-hidden>
          <div
            className={cn(
              "leaderboard-podium-frame__edge",
              animated && "leaderboard-podium-frame__edge--animated",
            )}
            style={animated ? { filter: `url(#${CHAMPION_ELECTRIC_FILTER_ID})` } : undefined}
          />
        </div>
        <div className="leaderboard-podium-frame__glow-1" aria-hidden />
        <div className="leaderboard-podium-frame__glow-2" aria-hidden />
        <div className="leaderboard-podium-frame__overlay-1" aria-hidden />
        <div className="leaderboard-podium-frame__overlay-2" aria-hidden />
        <div className="leaderboard-podium-frame__content">{children}</div>
      </div>
    </div>
  );
}
