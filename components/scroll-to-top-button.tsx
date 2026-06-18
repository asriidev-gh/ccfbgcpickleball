"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SCROLL_THRESHOLD_PX = 320;

type ScrollToTopButtonProps = {
  className?: string;
  /** Sit above the fixed mobile bottom nav on small screens. */
  mobileBottomNavOffset?: boolean;
};

export function ScrollToTopButton({
  className,
  mobileBottomNavOffset = false,
}: ScrollToTopButtonProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > SCROLL_THRESHOLD_PX);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
    window.scrollTo({ top: 0, behavior });
  };

  if (!visible) return null;

  return (
    <Button
      type="button"
      size="icon"
      variant="secondary"
      aria-label="Back to top"
      className={cn(
        "scroll-to-top-btn fixed right-4 z-50 size-11 rounded-full border border-border/70 bg-background/95 shadow-lg backdrop-blur-sm",
        mobileBottomNavOffset
          ? "bottom-[calc(4.75rem+env(safe-area-inset-bottom)+0.75rem)] lg:bottom-6"
          : "bottom-6",
        className,
      )}
      onClick={scrollToTop}
    >
      <ArrowUp className="h-5 w-5 shrink-0" aria-hidden />
    </Button>
  );
}
