"use client";

import { ArrowRight, Eye, ScanLine, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { ClubSocialLinks } from "@/components/landing/club-social-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME } from "@/lib/app-config";
import type { PublicClubLinks } from "@/lib/public-club-links";
import { cn } from "@/lib/utils";

type JoinMode = "check-in" | "watch";

const MIN_CODE_LENGTH = 6;

/** Session codes are nanoid(10): letters, digits, `-` and `_`. */
function sanitizeCode(raw: string) {
  return raw.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
}

/**
 * Accepts a bare code or a pasted session link (`/register/<code>`,
 * `/games/<code>/spectate`) and returns just the code.
 */
function extractCode(raw: string) {
  const value = raw.trim();
  if (!value.includes("/")) return sanitizeCode(value);

  const path = value.replace(/^https?:\/\/[^/]+/i, "").split(/[?#]/, 1)[0] ?? "";
  const segments = path.split("/").filter(Boolean);
  const keyword = segments.findIndex(
    (segment) => segment === "register" || segment === "games" || segment === "play",
  );
  const candidate = keyword >= 0 ? segments[keyword + 1] : segments.at(-1);
  return sanitizeCode(candidate ?? "");
}

const MODES: { value: JoinMode; label: string; icon: typeof ScanLine }[] = [
  { value: "check-in", label: "Check in", icon: ScanLine },
  { value: "watch", label: "Watch courts", icon: Eye },
];

export function JoinSessionCard({ clubLinks }: { clubLinks?: PublicClubLinks }) {
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();
  const [mode, setMode] = useState<JoinMode>("check-in");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleaned = extractCode(code);

    if (cleaned.length < MIN_CODE_LENGTH) {
      setError("Enter the full session code from the organizer's QR poster.");
      return;
    }

    setError(null);
    setNavigating(true);
    router.push(
      mode === "check-in" ? `/register/${cleaned}` : `/games/${cleaned}/spectate`,
    );
  };

  return (
    <div className="landing-join glass-panel rounded-3xl p-6 sm:p-7">
      <div className="flex items-start gap-3">
        <span className="landing-join__icon" aria-hidden>
          <Search className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          {/* Explicit utilities rather than `.section-title`: some themes restyle that class
              as a dim sub-label, which would rank this heading below its own body copy. */}
          <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
            Search us on Reclub
          </h2>
          <p className="caption mt-1">
            Open the Reclub app and look for{" "}
            <span className="font-semibold text-foreground">&ldquo;{APP_NAME}&rdquo;</span> to see
            our open play schedule and reserve your slot.
          </p>
        </div>
      </div>

      <div className="landing-join__divider" role="presentation" />

      <p className="text-sm font-semibold text-foreground">Already at the venue?</p>
      <p className="caption mt-1">
        Scan the QR code at the registration table, or type the session code below.
      </p>

      <div
        className="landing-join__modes mt-4"
        role="radiogroup"
        aria-label="What do you want to do?"
      >
        {MODES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            onClick={() => setMode(value)}
            className={cn(
              "landing-join__mode",
              mode === value && "landing-join__mode--active",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-5 space-y-2">
        <Label htmlFor={inputId} className="text-sm font-semibold">
          Session code
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id={inputId}
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. 7Kq2Vb9Lmz"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="text"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="h-12 flex-1 rounded-xl font-mono text-base tracking-[0.12em] md:text-base"
          />
          <Button
            type="submit"
            size="lg"
            disabled={navigating}
            className="h-12 rounded-xl px-5 text-base font-semibold sm:w-auto"
          >
            {navigating ? "Opening…" : mode === "check-in" ? "Check in" : "Watch"}
            <ArrowRight className="h-5 w-5" aria-hidden />
          </Button>
        </div>
        {error ? (
          <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : (
          <p className="caption">
            {mode === "check-in"
              ? "Checking in adds you to the queue for the next available court."
              : "Watching opens the live court and queue board. No check-in needed."}
          </p>
        )}
      </form>

      <ClubSocialLinks links={clubLinks} />
    </div>
  );
}
