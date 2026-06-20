"use client";

import { APP_NAME, APP_VERSION } from "@/lib/app-config";

export function AppFooter() {
  return (
    <footer className="app-footer mt-auto border-t border-border/60 bg-muted/20 px-6 py-4 text-center text-xs text-muted-foreground">
      <p>
        {APP_NAME} v{APP_VERSION}
      </p>
    </footer>
  );
}
