"use client";

import { CirclePlay } from "lucide-react";
import { useState } from "react";

import { DemoVideoDialog } from "@/components/demo-video-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WatchDemoButtonProps = {
  className?: string;
};

export function WatchDemoButton({ className }: WatchDemoButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("shrink-0", className)}
        onClick={() => setOpen(true)}
      >
        <CirclePlay className="h-4 w-4" aria-hidden />
        Watch demo
      </Button>

      <DemoVideoDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
