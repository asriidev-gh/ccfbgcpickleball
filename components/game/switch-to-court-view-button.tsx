"use client";

import { ArrowLeftRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { courtsViewHref, spectatorCourtsViewHref } from "@/lib/courts-view-focus";
import { cn } from "@/lib/utils";

type SwitchToCourtViewButtonProps = {
  /** When set, Court View opens focused on this session. */
  gameId?: string;
  variant?: "operator" | "spectator";
  /** Show a text label on sm+ viewports (for dashboard header placement). */
  showLabel?: boolean;
  className?: string;
  buttonClassName?: string;
};

export function SwitchToCourtViewButton({
  gameId,
  variant = "operator",
  showLabel = false,
  className,
  buttonClassName,
}: SwitchToCourtViewButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const allCourtsView = !gameId;
  const isSpectator = variant === "spectator";

  const handleConfirm = () => {
    setOpen(false);
    if (isSpectator && gameId) {
      router.push(spectatorCourtsViewHref(gameId));
      return;
    }
    router.push(courtsViewHref(gameId));
  };

  const dialogTitle = allCourtsView
    ? "All courts view"
    : isSpectator
      ? "Switch to Court View?"
      : "Switch to Court View?";
  const confirmLabel = allCourtsView
    ? "All Courts View"
    : isSpectator
      ? "Open Court View"
      : "Switch to Court View";

  return (
    <>
      {allCourtsView ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className={cn("courts-view-btn w-full gap-2 sm:w-auto", className, buttonClassName)}
          aria-label="All Courts View"
          onClick={() => setOpen(true)}
        >
          <ArrowLeftRight className="h-4 w-4 shrink-0" aria-hidden />
          All Courts View
        </Button>
      ) : showLabel ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("courts-view-btn inline-flex shrink-0", className, buttonClassName)}
          aria-label="Switch Court View"
          onClick={() => setOpen(true)}
        >
          <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 lg:h-5 lg:w-5" aria-hidden />
          <span>Switch Court View</span>
        </Button>
      ) : (
        <SimpleTooltip label="Switch to Court View">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("courts-view-btn h-8 w-8 shrink-0 px-0", buttonClassName, className)}
            aria-label="Switch to Court View"
            onClick={() => setOpen(true)}
          >
            <ArrowLeftRight className="h-4 w-4" aria-hidden />
          </Button>
        </SimpleTooltip>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription className="space-y-2">
              {allCourtsView ? (
                <>
                  <span className="block">
                    You will open Court View showing courts for all of your active open play
                    sessions on one page.
                  </span>
                  <span className="block">
                    From Court View you can manage courts, fill games, pause courts, and choose
                    which sessions to show.
                  </span>
                </>
              ) : isSpectator ? (
                <>
                  <span className="block">
                    You will open a courts-focused view of this session with larger court layouts.
                  </span>
                  <span className="block">
                    Court View is read-only for spectators — queue and match history stay on the
                    game dashboard.
                  </span>
                </>
              ) : (
                <>
                  <span className="block">
                    You will leave this game dashboard and open Court View focused on this session.
                  </span>
                  <span className="block">
                    From Court View you can manage courts, fill games, pause courts, and work
                    across your active open play sessions from one page.
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleConfirm}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
