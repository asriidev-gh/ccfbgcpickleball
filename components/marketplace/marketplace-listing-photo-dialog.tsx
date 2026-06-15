"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function MarketplaceListingPhotoDialog({
  photoUrl,
  title,
  open,
  onOpenChange,
}: {
  photoUrl: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(96vw,48rem)] gap-3 border-border p-3 sm:p-4">
        <DialogHeader className="pr-8">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[min(90vh,1200px)] w-full items-center justify-center overflow-auto rounded-lg bg-muted/40 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt={`${title} — full size`}
            className="h-auto max-h-[min(90vh,1200px)] w-auto max-w-full object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
