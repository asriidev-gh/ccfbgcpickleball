"use client";

import {
  AlertTriangle,
  ArrowDownUp,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Lightbulb,
  Loader2,
  Shuffle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { MatchHistoryView } from "@/components/game/match-history-list";
import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { NextCourtMatchupHelpDialog } from "@/components/game/next-court-matchup-help-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  canSwapWaitingLinePlayers,
  computeNextCourtMatchSuggestions,
  formatLeastBalancedLineupNote,
  getQueueSwapSuggestion,
  nextCourtPlayerSetKey,
  type NextCourtMatchSuggestion,
} from "@/lib/next-court-match-analysis";
import type { QuickPlayMatchingType } from "@/lib/quick-play-wizard-shared";
import { cn } from "@/lib/utils";

type NextCourtMatchAnalysisProps = {
  foursome: QueueEntryView[];
  naturalFoursome?: QueueEntryView[];
  waitingLine?: QueueEntryView[];
  queue?: QueueEntryView[];
  matchingType?: QuickPlayMatchingType | null;
  matches?: MatchHistoryView[];
  matchesLoading?: boolean;
  onShuffle?: () => void;
  shufflePending?: boolean;
  onSwapWaiting?: () => void;
  swapWaitingPending?: boolean;
  maxVisible?: number;
  className?: string;
};

function SuggestionIcon({ tone }: { tone: NextCourtMatchSuggestion["tone"] }) {
  const className = "h-3.5 w-3.5 shrink-0";
  if (tone === "balanced") {
    return <CheckCircle2 className={cn(className, "text-emerald-500")} aria-hidden />;
  }
  if (tone === "caution") {
    return <AlertTriangle className={cn(className, "text-amber-500")} aria-hidden />;
  }
  return <Lightbulb className={cn(className, "text-sky-500")} aria-hidden />;
}

function suggestionItemClass(tone: NextCourtMatchSuggestion["tone"]) {
  if (tone === "balanced") {
    return "next-court-analysis__item next-court-analysis__item--balanced";
  }
  if (tone === "caution") {
    return "next-court-analysis__item next-court-analysis__item--caution";
  }
  return "next-court-analysis__item next-court-analysis__item--tip";
}

function nextCourtFoursomeKey(foursome: QueueEntryView[]) {
  return foursome.map((entry) => entry._id).join("|");
}

export function NextCourtMatchAnalysis({
  foursome,
  naturalFoursome,
  waitingLine,
  queue = [],
  matchingType = null,
  matches = [],
  matchesLoading = false,
  onShuffle,
  shufflePending = false,
  onSwapWaiting,
  swapWaitingPending = false,
  maxVisible = 3,
  className,
}: NextCourtMatchAnalysisProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [dismissedFoursomeKey, setDismissedFoursomeKey] = useState<string | null>(null);
  const [acknowledgedBalancedKey, setAcknowledgedBalancedKey] = useState<string | null>(null);
  const [shuffleExhaustedKey, setShuffleExhaustedKey] = useState<string | null>(null);

  const foursomeKey = useMemo(() => nextCourtFoursomeKey(foursome), [foursome]);
  const playerSetKey = useMemo(() => nextCourtPlayerSetKey(foursome), [foursome]);
  const warningsDismissed = dismissedFoursomeKey === foursomeKey;
  const shuffleExhausted = shuffleExhaustedKey === playerSetKey;

  useEffect(() => {
    setShuffleExhaustedKey((current) => (current === playerSetKey ? current : null));
  }, [playerSetKey]);

  const suggestions = useMemo(
    () =>
      computeNextCourtMatchSuggestions(foursome, matches, {
        queue,
        matchingType,
        naturalFoursome,
        waitingLine,
      }),
    [foursome, matches, queue, matchingType, naturalFoursome, waitingLine],
  );

  const hasActionableWarnings = suggestions.some((item) => item.tone !== "balanced");
  const isBalanced = !hasActionableWarnings;
  const balancedAcknowledged = acknowledgedBalancedKey === foursomeKey;
  const queueSwapSuggestion = getQueueSwapSuggestion(suggestions);
  const waitingLineSwapAvailable = canSwapWaitingLinePlayers(queue);
  const shuffleOptionalOnly =
    hasActionableWarnings &&
    suggestions.filter((item) => item.tone !== "balanced").every((item) => item.tone === "tip");
  const leastBalanceNote =
    shuffleExhausted && hasActionableWarnings
      ? formatLeastBalancedLineupNote(suggestions, {
          canSwapWaiting: waitingLineSwapAvailable,
        })
      : null;
  const showSwap =
    Boolean(onSwapWaiting) &&
    (queueSwapSuggestion != null ||
      (waitingLineSwapAvailable &&
        (Boolean(leastBalanceNote) || (shuffleOptionalOnly && suggestions.some((item) => item.suggestsShuffle)))));
  const showShuffle =
    Boolean(onShuffle) &&
    suggestions.some((item) => item.suggestsShuffle) &&
    suggestions.every((item) => item.tone !== "balanced") &&
    (!shuffleExhausted || shuffleOptionalOnly);
  const showFooter = !warningsDismissed && hasActionableWarnings;
  const showBalancedFooter = isBalanced && !balancedAcknowledged;
  const showBothActions = showShuffle && showSwap;
  const showQueueSwapAfterShuffle = shuffleExhausted && queueSwapSuggestion != null;

  const handleShuffleClick = async () => {
    if (!onShuffle) return;
    await onShuffle();
    setShuffleExhaustedKey(playerSetKey);
  };

  const helpButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="next-court-analysis__help-btn"
      aria-label="About matchup check"
      onClick={() => setHelpOpen(true)}
    >
      <CircleHelp className="h-3.5 w-3.5" aria-hidden />
    </Button>
  );

  const header = (
    <div className="next-court-analysis__header">
      <p className="next-court-analysis__label">Matchup check</p>
      {helpButton}
    </div>
  );

  if (matchesLoading && matches.length === 0) {
    return (
      <div className={cn("queue-next-up-analysis", className)}>
        {header}
        <p className="next-court-analysis__loading">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Analyzing matchup…
        </p>
        <NextCourtMatchupHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      </div>
    );
  }

  if (isBalanced && balancedAcknowledged) {
    return null;
  }

  const visible = suggestions.slice(0, maxVisible);

  return (
    <section className={cn("queue-next-up-analysis", className)} aria-label="Matchup analysis">
      {header}
      {warningsDismissed ? (
        <p className="next-court-analysis__accepted">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
          Matchup accepted — fill the court when ready.
        </p>
      ) : showQueueSwapAfterShuffle || leastBalanceNote ? (
        <div className="next-court-analysis__list space-y-2">
          {queueSwapSuggestion ? (
            <p className={suggestionItemClass(queueSwapSuggestion.tone)}>
              <span className="next-court-analysis__icon" aria-hidden>
                <SuggestionIcon tone={queueSwapSuggestion.tone} />
              </span>
              <span className="next-court-analysis__text">{queueSwapSuggestion.message}</span>
            </p>
          ) : null}
          {leastBalanceNote ? (
            <p className="next-court-analysis__item next-court-analysis__item--tip">
              <span className="next-court-analysis__icon" aria-hidden>
                <Lightbulb className="h-3.5 w-3.5 shrink-0 text-sky-500" />
              </span>
              <span className="next-court-analysis__text">{leastBalanceNote}</span>
            </p>
          ) : null}
        </div>
      ) : (
        <ul className="next-court-analysis__list">
          {visible.map((item) =>
            item.bulletPoints && item.bulletPoints.length > 0 ? (
              <li key={item.id} className={suggestionItemClass(item.tone)}>
                <span className="next-court-analysis__icon" aria-hidden>
                  <SuggestionIcon tone={item.tone} />
                </span>
                <div className="next-court-analysis__text-block min-w-0">
                  <p className="next-court-analysis__text">{item.message}</p>
                  <ul className="next-court-analysis__bullets">
                    {item.bulletPoints.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                  <p className="next-court-analysis__ready caption text-muted-foreground">
                    Fill when ready.
                  </p>
                </div>
              </li>
            ) : (
              <li key={item.id} className={suggestionItemClass(item.tone)}>
                <span className="next-court-analysis__icon" aria-hidden>
                  <SuggestionIcon tone={item.tone} />
                </span>
                <p className="next-court-analysis__text">{item.message}</p>
              </li>
            ),
          )}
        </ul>
      )}
      {showFooter ? (
        <div className="next-court-analysis__footer">
          <p className="next-court-analysis__footer-hint">
            {showBothActions
              ? "Shuffle partners, swap in waiting players (5th and 6th), or accept to keep this lineup."
              : showSwap
                ? "Swap in waiting players, or accept to keep this lineup."
                : shuffleExhausted
                  ? shuffleOptionalOnly
                    ? "Shuffle is optional, or accept to keep this lineup."
                    : "Accept to proceed with this lineup."
                  : shuffleOptionalOnly
                    ? "Shuffle is optional, or accept to keep this lineup."
                    : "Shuffle finds the best balance once, or accept to keep this lineup."}
          </p>
          <div className="next-court-analysis__actions">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="next-court-analysis__accept-btn h-8 shrink-0 gap-1.5 px-2.5 text-xs"
              onClick={() => setDismissedFoursomeKey(foursomeKey)}
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              Accept
            </Button>
            {showBothActions ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="next-court-analysis__adjust-btn h-8 shrink-0 gap-1.5 px-2.5 text-xs"
                      disabled={shufflePending || swapWaitingPending}
                    />
                  }
                >
                  {shufflePending || swapWaitingPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Shuffle className="h-3.5 w-3.5" aria-hidden />
                  )}
                  Adjust
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[11rem]">
                  <DropdownMenuItem
                    className="gap-2 text-xs"
                    disabled={shufflePending}
                    onClick={() => void handleShuffleClick()}
                  >
                    <Shuffle className="h-3.5 w-3.5" aria-hidden />
                    Shuffle partners
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2 text-xs"
                    disabled={swapWaitingPending}
                    onClick={() => void onSwapWaiting?.()}
                  >
                    <ArrowDownUp className="h-3.5 w-3.5" aria-hidden />
                    Swap in (5th & 6th)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : showSwap ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="next-court-analysis__swap-btn h-8 shrink-0 gap-1.5 px-2.5 text-xs"
                onClick={onSwapWaiting}
                disabled={swapWaitingPending}
              >
                {swapWaitingPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <ArrowDownUp className="h-3.5 w-3.5" aria-hidden />
                )}
                Swap in
              </Button>
            ) : showShuffle ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="next-court-analysis__shuffle-btn h-8 shrink-0 gap-1.5 px-2.5 text-xs"
                onClick={handleShuffleClick}
                disabled={shufflePending}
              >
                {shufflePending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Shuffle className="h-3.5 w-3.5" aria-hidden />
                )}
                Shuffle
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {showBalancedFooter ? (
        <div className="next-court-analysis__footer">
          <p className="next-court-analysis__footer-hint">
            Acknowledge when you have read the balance summary.
          </p>
          <div className="next-court-analysis__actions">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="next-court-analysis__acknowledge-btn h-8 shrink-0 gap-1.5 px-2.5 text-xs"
              onClick={() => setAcknowledgedBalancedKey(foursomeKey)}
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              Acknowledge
            </Button>
          </div>
        </div>
      ) : null}
      <NextCourtMatchupHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </section>
  );
}
