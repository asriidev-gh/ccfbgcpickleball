"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

const LOGIN_INTRO_VIDEOS = [
  "/assets/videos/Logo_for_PaddleFlow_J316_202605302338.mp4",
  "/assets/videos/Logo_for_PaddleFlow_J316_202605302339.mp4",
] as const;

function pickRandomIntroVideo() {
  const index = Math.floor(Math.random() * LOGIN_INTRO_VIDEOS.length);
  return LOGIN_INTRO_VIDEOS[index];
}

type LoginVideoIntroProps = {
  onComplete: () => void;
};

export function LoginVideoIntro({ onComplete }: LoginVideoIntroProps) {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const completeRef = useRef(false);
  const autoplayAttemptedRef = useRef(false);

  const finishIntro = useCallback(() => {
    if (completeRef.current) return;
    completeRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      finishIntro();
      return;
    }
    setVideoSrc(pickRandomIntroVideo());
    const onChange = () => {
      if (media.matches) finishIntro();
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [finishIntro]);

  const autoplay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    video.loop = false;
    video.volume = 1;

    video.muted = false;
    try {
      await video.play();
      return;
    } catch {
      // Unmuted autoplay blocked — fall back to muted so playback still starts.
    }

    video.muted = true;
    try {
      await video.play();
    } catch {
      // Autoplay fully blocked; Skip still available.
    }
  }, []);

  const startPlayback = useCallback(() => {
    if (autoplayAttemptedRef.current) return;
    autoplayAttemptedRef.current = true;
    void autoplay();
  }, [autoplay]);

  return (
    <div className="login-video-intro">
      {videoSrc ? (
        <video
          ref={videoRef}
          className="login-video-intro__video"
          src={videoSrc}
          autoPlay
          muted
          playsInline
          preload="auto"
          loop={false}
          onEnded={finishIntro}
          onLoadedData={startPlayback}
        />
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="login-video-intro__skip"
        onClick={finishIntro}
      >
        Skip
      </Button>
    </div>
  );
}
