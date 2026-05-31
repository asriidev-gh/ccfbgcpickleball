"use client";

import { useState } from "react";

import { DeveloperAboutDialog } from "@/components/developer-about-dialog";
import { APP_NAME, APP_VERSION } from "@/lib/app-config";

export function AppFooter() {
  const [developerDialogOpen, setDeveloperDialogOpen] = useState(false);

  return (
    <>
      <footer className="mt-auto border-t border-border/60 bg-muted/20 px-6 py-4 text-center text-xs text-muted-foreground">
        <p>
          {APP_NAME} v{APP_VERSION}
          <span className="mx-2 text-muted-foreground/50" aria-hidden>
            ·
          </span>
          <button
            type="button"
            onClick={() => setDeveloperDialogOpen(true)}
            className="cursor-pointer underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Developed by: Andy R.
          </button>
        </p>
      </footer>

      <DeveloperAboutDialog open={developerDialogOpen} onOpenChange={setDeveloperDialogOpen} />
    </>
  );
}
