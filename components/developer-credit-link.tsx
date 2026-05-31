"use client";

import { useState } from "react";

import { DeveloperAboutDialog } from "@/components/developer-about-dialog";
import { cn } from "@/lib/utils";

type DeveloperCreditLinkProps = {
  className?: string;
};

export function DeveloperCreditLink({ className }: DeveloperCreditLinkProps) {
  const [developerDialogOpen, setDeveloperDialogOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setDeveloperDialogOpen(true)}
        className={cn(
          "cursor-pointer underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className,
        )}
      >
        Developed by: Andy R.
      </button>

      <DeveloperAboutDialog open={developerDialogOpen} onOpenChange={setDeveloperDialogOpen} />
    </>
  );
}
