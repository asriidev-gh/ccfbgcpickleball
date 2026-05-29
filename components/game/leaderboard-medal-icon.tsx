import { cn } from "@/lib/utils";

type MedalRank = 1 | 2 | 3;

type LeaderboardMedalIconProps = {
  rank: MedalRank;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClass = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-14 w-14",
};

export function LeaderboardMedalIcon({ rank, className, size = "md" }: LeaderboardMedalIconProps) {
  const label = rank === 1 ? "1st place" : rank === 2 ? "2nd place" : "3rd place";

  if (rank === 1) {
    return (
      <svg
        viewBox="0 0 48 56"
        className={cn(sizeClass[size], className)}
        role="img"
        aria-label={label}
      >
        <defs>
          <linearGradient id="medal-gold-face" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="45%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <linearGradient id="medal-gold-ribbon-l" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <linearGradient id="medal-gold-ribbon-r" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>
        </defs>
        <path fill="url(#medal-gold-ribbon-l)" d="M8 4 18 22 14 24 8 16Z" />
        <path fill="url(#medal-gold-ribbon-r)" d="M40 4 30 22 34 24 40 16Z" />
        <circle cx="24" cy="38" r="15" fill="url(#medal-gold-face)" stroke="#b45309" strokeWidth="1.5" />
        <circle cx="24" cy="38" r="11" fill="none" stroke="#fef3c7" strokeWidth="1" opacity="0.85" />
        <path
          fill="#fef9c3"
          d="M24 30 26.2 35.8 32.4 36 27.4 39.6 29 45.5 24 42.2 19 45.5 20.6 39.6 15.6 36 21.8 35.8Z"
        />
      </svg>
    );
  }

  if (rank === 2) {
    return (
      <svg
        viewBox="0 0 48 56"
        className={cn(sizeClass[size], className)}
        role="img"
        aria-label={label}
      >
        <defs>
          <linearGradient id="medal-silver-face" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="45%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
          <linearGradient id="medal-silver-ribbon-l" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
          <linearGradient id="medal-silver-ribbon-r" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
        </defs>
        <path fill="url(#medal-silver-ribbon-l)" d="M8 4 18 22 14 24 8 16Z" />
        <path fill="url(#medal-silver-ribbon-r)" d="M40 4 30 22 34 24 40 16Z" />
        <circle cx="24" cy="38" r="15" fill="url(#medal-silver-face)" stroke="#64748b" strokeWidth="1.5" />
        <circle cx="24" cy="38" r="11" fill="none" stroke="#f1f5f9" strokeWidth="1" opacity="0.9" />
        <text
          x="24"
          y="42"
          textAnchor="middle"
          fill="#334155"
          fontSize="14"
          fontWeight="700"
          fontFamily="system-ui, sans-serif"
        >
          2
        </text>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 48 56"
      className={cn(sizeClass[size], className)}
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id="medal-bronze-face" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fdba74" />
          <stop offset="45%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#9a3412" />
        </linearGradient>
        <linearGradient id="medal-bronze-ribbon-l" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#7c2d12" />
        </linearGradient>
        <linearGradient id="medal-bronze-ribbon-r" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#431407" />
        </linearGradient>
      </defs>
      <path fill="url(#medal-bronze-ribbon-l)" d="M8 4 18 22 14 24 8 16Z" />
      <path fill="url(#medal-bronze-ribbon-r)" d="M40 4 30 22 34 24 40 16Z" />
      <circle cx="24" cy="38" r="15" fill="url(#medal-bronze-face)" stroke="#9a3412" strokeWidth="1.5" />
      <circle cx="24" cy="38" r="11" fill="none" stroke="#ffedd5" strokeWidth="1" opacity="0.85" />
      <text
        x="24"
        y="42"
        textAnchor="middle"
        fill="#431407"
        fontSize="14"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        3
      </text>
    </svg>
  );
}
