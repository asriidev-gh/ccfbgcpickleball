"use client";

import { AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MATCHUP_CHECK_GUIDE_SCENARIOS,
  type MatchupCheckGuideScenario,
} from "@/lib/next-court-match-analysis";
import { cn } from "@/lib/utils";

type NextCourtMatchupHelpDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function GuideToneIcon({ tone }: { tone: MatchupCheckGuideScenario["tone"] }) {
  const className = "h-4 w-4 shrink-0";
  if (tone === "balanced") {
    return <CheckCircle2 className={cn(className, "text-emerald-500")} aria-hidden />;
  }
  if (tone === "caution") {
    return <AlertTriangle className={cn(className, "text-amber-500")} aria-hidden />;
  }
  return <Lightbulb className={cn(className, "text-sky-500")} aria-hidden />;
}

function guideRowClass(tone: MatchupCheckGuideScenario["tone"]) {
  if (tone === "balanced") return "matchup-guide-row matchup-guide-row--balanced";
  if (tone === "caution") return "matchup-guide-row matchup-guide-row--caution";
  return "matchup-guide-row matchup-guide-row--tip";
}

export function NextCourtMatchupHelpDialog({ open, onOpenChange }: NextCourtMatchupHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="matchup-guide-dialog max-h-[min(90vh,40rem)] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border/70 px-5 py-4 text-left">
          <DialogTitle>Matchup check</DialogTitle>
          <DialogDescription className="text-left leading-relaxed">
            Before you fill the court, we review the next four players as slots 1–2 vs 3–4 and
            flag patterns that can make games feel uneven. Tips are advisory — shuffle, reorder, or
            fill whenever you are ready.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(60vh,28rem)] overflow-y-auto px-5 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Scenarios we look for
          </p>
          <ul className="matchup-guide-list space-y-2">
            {MATCHUP_CHECK_GUIDE_SCENARIOS.map((scenario) => (
              <li key={scenario.id} className={guideRowClass(scenario.tone)}>
                <span className="matchup-guide-row__icon" aria-hidden>
                  <GuideToneIcon tone={scenario.tone} />
                </span>
                <div className="min-w-0">
                  <p className="matchup-guide-row__title">{scenario.title}</p>
                  <p className="matchup-guide-row__description">{scenario.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
