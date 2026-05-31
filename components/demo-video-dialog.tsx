"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const LOOM_EMBED_URL =
  "https://www.loom.com/embed/f75e398721d44343bb205aecac6a10ff?hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true";

type DemoVideoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DemoVideoDialog({ open, onOpenChange }: DemoVideoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="demo-video-dialog w-[96vw] max-w-[96vw] gap-2 p-3 sm:max-w-[96vw] sm:p-4">
        <DialogHeader className="shrink-0">
          <DialogTitle className="section-title text-lg sm:text-xl">Watch demo</DialogTitle>
        </DialogHeader>
        <div className="relative min-h-[70vh] w-full overflow-hidden rounded-lg bg-muted/30 sm:min-h-[78vh]">
          {open ? (
            <iframe
              src={LOOM_EMBED_URL}
              title="PaddleFlow demo video"
              className="absolute inset-0 h-full w-full border-0"
              allowFullScreen
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
