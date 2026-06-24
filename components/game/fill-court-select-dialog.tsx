"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type FillCourtSelectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emptyCourtNumbers: number[];
  onSelect: (courtNumber: number) => void;
};

export function FillCourtSelectDialog({
  open,
  onOpenChange,
  emptyCourtNumbers,
  onSelect,
}: FillCourtSelectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Which court should be filled?</DialogTitle>
          <DialogDescription>
            {emptyCourtNumbers.length} courts are available. Choose one to fill from the queue.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {emptyCourtNumbers.map((courtNumber) => (
            <Button
              key={courtNumber}
              type="button"
              variant="outline"
              className="h-11 justify-center text-base"
              onClick={() => onSelect(courtNumber)}
            >
              Court {courtNumber}
            </Button>
          ))}
        </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
