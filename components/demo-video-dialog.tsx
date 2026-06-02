"use client";

import { ArrowLeft, CirclePlay } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEMO_VIDEO_OPTIONS,
  getDemoVideoById,
  type DemoVideoId,
} from "@/lib/demo-videos";
import { USER_TYPE_CCF } from "@/lib/registration-variant";
import { cn } from "@/lib/utils";

function DemoVideoPlayer({
  sources,
  title,
  active,
}: {
  sources: string[];
  title: string;
  active: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [index, setIndex] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [needsPlayTap, setNeedsPlayTap] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const src = sources[index] ?? sources[0];
  const hasMultiple = sources.length > 1;

  useEffect(() => {
    setIndex(0);
    setLoadError(false);
    setNeedsPlayTap(false);
    setIsLoading(true);
  }, [sources]);

  const tryPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !active) return;

    try {
      video.muted = false;
      await video.play();
      setNeedsPlayTap(false);
      return;
    } catch {
      // Unmuted autoplay blocked — try muted so playback still starts.
    }

    try {
      video.muted = true;
      await video.play();
      setNeedsPlayTap(false);
    } catch {
      setNeedsPlayTap(true);
    }
  }, [active]);

  const handleCanPlay = useCallback(() => {
    setIsLoading(false);
    void tryPlay();
  }, [tryPlay]);

  const handlePlayTap = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    void video.play().then(
      () => setNeedsPlayTap(false),
      () => setNeedsPlayTap(true),
    );
  }, []);

  const advanceToNext = useCallback(() => {
    if (index < sources.length - 1) {
      setIndex((current) => current + 1);
      setLoadError(false);
      setNeedsPlayTap(false);
      setIsLoading(true);
      return true;
    }
    return false;
  }, [index, sources.length]);

  const handleEnded = useCallback(() => {
    advanceToNext();
  }, [advanceToNext]);

  const handleError = useCallback(() => {
    if (!advanceToNext()) {
      setLoadError(true);
      setIsLoading(false);
    }
  }, [advanceToNext]);

  useEffect(() => {
    if (!active) return;
    const video = videoRef.current;
    if (!video) return;
    video.load();
  }, [active, src]);

  if (!active || !src) {
    return null;
  }

  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-black">
      {hasMultiple ? (
        <p className="absolute left-0 right-0 top-0 z-10 bg-black/60 px-3 py-1.5 text-center text-xs font-medium text-white">
          Part {index + 1} of {sources.length}
        </p>
      ) : null}

      {isLoading && !loadError ? (
        <p className="absolute inset-0 z-20 flex items-center justify-center text-sm text-white/80">
          Loading video…
        </p>
      ) : null}

      {loadError ? (
        <div className="flex aspect-video max-h-[78vh] w-full flex-col items-center justify-center gap-3 p-6 text-center text-white">
          <p className="text-sm">Could not load this video.</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setLoadError(false);
              setIsLoading(true);
              videoRef.current?.load();
            }}
          >
            Try again
          </Button>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            key={src}
            className={cn("aspect-video max-h-[78vh] w-full", hasMultiple && "pt-8")}
            src={src}
            controls
            playsInline
            preload="auto"
            title={hasMultiple ? `${title} — part ${index + 1}` : title}
            onCanPlay={handleCanPlay}
            onWaiting={() => setIsLoading(true)}
            onPlaying={() => {
              setIsLoading(false);
              setNeedsPlayTap(false);
            }}
            onEnded={handleEnded}
            onError={handleError}
          >
            Your browser does not support video playback.
          </video>

          {needsPlayTap ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
              <Button
                type="button"
                size="lg"
                className="gap-2"
                onClick={handlePlayTap}
              >
                <CirclePlay className="h-5 w-5" aria-hidden />
                Play video
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

type DemoVideoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userType?: string;
};

function getDemoSourcesForOwner(sources: string[], userType?: string) {
  const normalized = userType?.trim().toLowerCase();
  if (normalized !== USER_TYPE_CCF) return sources;

  const defaultSrc = "/assets/videos/demo/player_registration.webm";
  const ccfSrc = "/assets/videos/demo/ccf_player_registration.webm";

  // Part 2 of the Player Registration demo swaps for CCF-owned sessions.
  return sources.map((src) => (src === defaultSrc ? ccfSrc : src));
}

export function DemoVideoDialog({ open, onOpenChange, userType }: DemoVideoDialogProps) {
  const [selectedId, setSelectedId] = useState<DemoVideoId | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
    }
  }, [open]);

  const selected = selectedId ? getDemoVideoById(selectedId) : null;
  const selectedSources = selected ? getDemoSourcesForOwner(selected.sources, userType) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "demo-video-dialog w-[96vw] gap-3 p-3 sm:p-4",
          selected ? "max-w-[96vw] sm:max-w-4xl" : "max-w-[96vw] sm:max-w-lg",
        )}
      >
        <DialogHeader className="shrink-0 gap-2 sm:text-left">
          {selected ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 px-2"
                onClick={() => setSelectedId(null)}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back
              </Button>
              <DialogTitle className="section-title min-w-0 flex-1 text-base sm:text-lg">
                {selected.title}
              </DialogTitle>
            </div>
          ) : (
            <DialogTitle className="section-title text-lg sm:text-xl">
              Watch demo
            </DialogTitle>
          )}
        </DialogHeader>

        {selected ? (
          <DemoVideoPlayer
            key={selected.id}
            sources={selectedSources}
            title={selected.title}
            active={open}
          />
        ) : (
          <ul className="flex flex-col gap-2" role="list">
            {DEMO_VIDEO_OPTIONS.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 text-left transition-colors",
                    "hover:border-primary/40 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                  onClick={() => setSelectedId(option.id)}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <CirclePlay className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-foreground">{option.title}</span>
                    {option.description ? (
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
