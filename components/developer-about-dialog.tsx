"use client";

import { useEffect, useRef, useState } from "react";
import { Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DEVELOPER_PHOTO = "/assets/images/andyradam.jpeg";
const DEVELOPER_PHONE = "+63 947-512-7884";
const DEVELOPER_PHONE_TEL = "+639475127884";
const GOALS = [
  "Fair and transparent player rotations",
  "Faster court assignments",
  "Easier player check-ins",
  "Better experience for clubs, organizers, and players",
];

type DeveloperAboutDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeveloperAboutDialog({ open, onOpenChange }: DeveloperAboutDialogProps) {
  const [showPhone, setShowPhone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: 0 });
      return;
    }
    setShowPhone(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="developer-about-dialog flex max-h-[min(90vh,44rem)] max-w-[min(96vw,32rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 items-center px-4 pt-4 pb-3 text-center sm:items-center sm:text-center">
          <div className="developer-about-photo mx-auto overflow-hidden rounded-full ring-2 ring-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={DEVELOPER_PHOTO}
              alt="Andy Radam"
              className="size-28 object-cover sm:size-32"
            />
          </div>
          <DialogTitle className="text-lg sm:text-xl">Welcome to Paddle Flow J316 🏓</DialogTitle>
        </DialogHeader>

        <div
          ref={scrollRef}
          className="developer-about-body min-h-0 flex-1 overflow-y-auto px-4 pb-4"
        >
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p className="text-foreground">Thank you for using Paddle Flow!</p>

          <p>
            Paddle Flow was created to help pickleball enthusiasts manage courts, player
            rotations, and queues more efficiently. Whether you&apos;re participating in open play,
            organizing club sessions, or running tournaments, Paddle Flow aims to create a fairer,
            smoother, and more enjoyable experience for everyone on the court.
          </p>

          <div>
            <h3 className="mb-2 font-semibold text-foreground">Our Goal</h3>
            <ul className="list-disc space-y-1 pl-5">
              {GOALS.map((goal) => (
                <li key={goal}>{goal}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-foreground">For the Pickleball Community</h3>
            <p>
              Pickleball continues to bring people together through sportsmanship, friendship, and
              healthy competition. Paddle Flow is built to support that growing community and help
              every session run smoothly.
            </p>
          </div>

          <p>
            Your feedback, suggestions, and ideas are always welcome. Every improvement to Paddle
            Flow starts with input from players like you.
          </p>

          <p className="font-medium text-foreground">Play fair. Stay active. Have fun.</p>

          <p>Thank you for being part of the Paddle Flow community!</p>

          <div className="border-t border-border/60 pt-4">
            <p className="font-medium text-foreground">
              — Andy Radam, Creator of Paddle Flow J316 🏓
            </p>
            <p className="mt-2 italic text-muted-foreground">All glory to God.</p>
            <div className="mt-3">
              {showPhone ? (
                <a
                  href={`tel:${DEVELOPER_PHONE_TEL}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <Phone className="h-3 w-3" aria-hidden />
                  {DEVELOPER_PHONE}
                </a>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() => setShowPhone(true)}
                >
                  Contact Me
                </Button>
              )}
            </div>
          </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
