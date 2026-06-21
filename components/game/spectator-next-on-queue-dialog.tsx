"use client";

import { useMemo, useState } from "react";
import { Users, Zap } from "lucide-react";

import { QueueEntryRow, type QueueEntryView } from "@/components/game/queue-entry-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type SpectatorNextOnQueueButtonProps = {
  queue: QueueEntryView[];
  className?: string;
};

export function SpectatorNextOnQueueButton({
  queue,
  className,
}: SpectatorNextOnQueueButtonProps) {
  const [open, setOpen] = useState(false);
  const nextUp = useMemo(() => queue.slice(0, 4), [queue]);
  const count = nextUp.length;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("inline-flex shrink-0", className)}
        onClick={() => setOpen(true)}
        aria-label={`Next on queue: ${count} of 4 players`}
      >
        <Users className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
        <span className="sm:hidden">Queue</span>
        <span className="hidden sm:inline">Next on queue</span>
        <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 tabular-nums">
          {count}/4
        </Badge>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Next on queue</DialogTitle>
            <DialogDescription>
              {count === 0
                ? "No players are waiting in the queue right now."
                : `Top ${count} ${count === 1 ? "player" : "players"} waiting for the next open court.`}
            </DialogDescription>
          </DialogHeader>

          {count === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">The queue is empty.</p>
          ) : (
            <div className="queue-next-up-group">
              <div className="queue-next-up-banner">
                <div className="flex items-center gap-2">
                  <span className="queue-next-up-icon">
                    <Zap className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <p className="queue-next-up-title">Next on court</p>
                    <p className="caption">
                      Top {count} {count === 1 ? "player" : "players"} — ready to play
                    </p>
                  </div>
                </div>
                <Badge className="badge-next-up-count shrink-0">{count} / 4</Badge>
              </div>
              <div className="queue-next-up-slots">
                {nextUp.map((entry, index) => (
                  <QueueEntryRow
                    key={entry._id}
                    entry={entry}
                    index={index}
                    isNextUp
                    hideReplacePanel
                    onReplace={() => {}}
                    replacePending={false}
                  />
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
