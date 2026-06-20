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
import { courtsViewHref } from "@/lib/courts-view-focus";
import { cn } from "@/lib/utils";

type SwitchToCourtViewButtonProps = {
  /** When set, Court View opens focused on this session. */
  gameId?: string;
  className?: string;
  buttonClassName?: string;
};

export function SwitchToCourtViewButton({
  gameId,
  className,
  buttonClassName,
}: SwitchToCourtViewButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const allCourtsView = !gameId;

  const handleConfirm = () => {
    setOpen(false);
    router.push(courtsViewHref(gameId));
  };

  const dialogTitle = allCourtsView ? "All courts view" : "Switch to Court View?";
  const confirmLabel = allCourtsView ? "All Courts View" : "Switch to Court View";

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
