import { ThumbsUp } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PlayerEndorsementStatusBadgeProps = {
  count: number;
  onClick?: () => void;
  className?: string;
};

export function PlayerEndorsementStatusBadge({
  count,
  onClick,
  className,
}: PlayerEndorsementStatusBadgeProps) {
  if (count <= 0) return null;

  const label = count === 1 ? "1 endorsement" : `${count} endorsements`;
  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "gap-0.5 whitespace-nowrap border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
        onClick && "cursor-pointer transition-colors hover:bg-emerald-500/20",
        className,
      )}
      aria-label={label}
    >
      <ThumbsUp className="size-3 shrink-0" aria-hidden />
      Endorsed{count > 1 ? ` (${count})` : ""}
    </Badge>
  );

  if (!onClick) return badge;

  const handleClick = (event: MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    onClick();
  };

  // Use a span (not <button>) so this can sit beside name triggers without nested buttons.
  return (
    <span
      role="button"
      tabIndex={0}
      className="inline-flex"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`View ${label}`}
    >
      {badge}
    </span>
  );
}
