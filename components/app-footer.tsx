"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";

import { DeveloperAboutDialog } from "@/components/developer-about-dialog";
import { Button } from "@/components/ui/button";
import { APP_NAME, APP_VERSION } from "@/lib/app-config";

export function AppFooter() {
  const pathname = usePathname();
  const [developerDialogOpen, setDeveloperDialogOpen] = useState(false);
  if (pathname.startsWith("/register")) return null;

  return (
    <footer className="app-footer mt-auto border-t border-border/60 bg-muted/20 px-6 py-4 text-xs text-muted-foreground">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
        <p>
          {APP_NAME} v{APP_VERSION}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 rounded-full px-3 text-xs"
          onClick={() => setDeveloperDialogOpen(true)}
        >
          <MessageCircle className="h-3 w-3" aria-hidden />
          Contact Developer
        </Button>
      </div>

      <DeveloperAboutDialog open={developerDialogOpen} onOpenChange={setDeveloperDialogOpen} />
    </footer>
  );
}
