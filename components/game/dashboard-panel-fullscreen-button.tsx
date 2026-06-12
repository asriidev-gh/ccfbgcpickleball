"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import type { RefObject } from "react";

import { usePanelFullscreen } from "@/hooks/use-panel-fullscreen";
import { Button } from "@/components/ui/button";
import { SimpleTooltip } from "@/components/ui/tooltip";

type DashboardPanelFullscreenButtonProps = {
  containerRef: RefObject<HTMLElement | null>;
  panelName: string;
  className?: string;
};

export function DashboardPanelFullscreenButton({
  containerRef,
  panelName,
  className,
}: DashboardPanelFullscreenButtonProps) {
  const { isFullscreen, toggleFullscreen, supportsFullscreen } =
    usePanelFullscreen(containerRef);

  if (!supportsFullscreen) return null;

  const label = isFullscreen ? `Exit ${panelName} fullscreen` : `Fullscreen ${panelName}`;

  return (
    <SimpleTooltip label={label}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={className ?? "dashboard-panel-fullscreen-btn size-8 shrink-0"}
        onClick={() => void toggleFullscreen()}
        aria-label={label}
        aria-pressed={isFullscreen}
      >
        {isFullscreen ? (
          <Minimize2 className="h-4 w-4" aria-hidden />
        ) : (
          <Maximize2 className="h-4 w-4" aria-hidden />
        )}
      </Button>
    </SimpleTooltip>
  );
}
