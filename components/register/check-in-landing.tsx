"use client";

import type { ReactNode } from "react";
import { ChevronLeft, Eye, HeartHandshake, QrCode, Search, UserPlus, UserRound } from "lucide-react";

import { CheckInChoiceCard } from "@/components/register/check-in-choice-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClubBranding } from "@/lib/club-branding";

type CheckInAs = "player" | "volunteer";
type EntryStep = "role" | "has-qr";
type PendingEntryAction =
  | "player"
  | "volunteer"
  | "spectator"
  | "has-qr-yes"
  | "has-qr-no"
  | "via-qr"
  | "via-name-search"
  | "as-new-player"
  | null;

function clubInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function CheckInClubMark({ branding }: { branding?: ClubBranding | null }) {
  const logoUrl = branding?.clubLogoUrl?.trim() ?? "";
  const clubName = branding?.clubName?.trim() ?? "";
  const initials = clubName ? clubInitials(clubName) : "";
  if (!logoUrl && !initials) return <div className="register-checkin-brand" aria-hidden />;

  return (
    <div className="register-checkin-brand">
      <div className="register-checkin-logo-frame">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={clubName || "Club logo"} className="register-checkin-logo" />
        ) : (
          <span className="register-checkin-monogram" aria-hidden>
            {initials}
          </span>
        )}
      </div>
      {clubName ? <p className="register-checkin-club-name">{clubName}</p> : null}
    </div>
  );
}

export function CheckInPageShell({
  children,
  kicker = "Check in",
  title,
  sessionTitle,
  sessionLoading = false,
  clubBranding,
  showClubMark = false,
}: {
  children: ReactNode;
  kicker?: string;
  title: string;
  sessionTitle?: string | null;
  sessionLoading?: boolean;
  clubBranding?: ClubBranding | null;
  showClubMark?: boolean;
}) {
  return (
    <main className="register-page register-page--check-in">
      <section className="register-shell">
        <Card className="register-card register-card--check-in border border-border bg-card shadow-sm">
          <CardHeader className="register-card-header">
            <p className="register-checkin-kicker">{kicker}</p>
            <CardTitle className="register-checkin-title">{title}</CardTitle>
            {sessionTitle ? (
              <p className="register-checkin-session">{sessionTitle}</p>
            ) : sessionLoading ? (
              <p className="register-checkin-session">Loading session…</p>
            ) : null}
          </CardHeader>
          <CardContent className="register-form-compact">
            {showClubMark ? <CheckInClubMark branding={clubBranding} /> : null}
            {children}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

export function CheckInLanding({
  gameTitle,
  clubBranding,
  statusLoading = false,
  statusReady = false,
  blockedMessage,
  entryStep,
  checkInAs,
  isGenericForm,
  entryBusy,
  pendingEntryAction,
  pendingRole,
  navigatingToSpectate = false,
  onPlayer,
  onVolunteer,
  onSpectator,
  onBack,
  onHasQrYes,
  onHasQrNo,
  onViaQr,
  onViaNameSearch,
  onAsNewPlayer,
}: {
  gameTitle?: string | null;
  clubBranding?: ClubBranding | null;
  statusLoading?: boolean;
  statusReady?: boolean;
  blockedMessage?: string | null;
  entryStep: EntryStep;
  checkInAs: CheckInAs | null;
  isGenericForm: boolean;
  entryBusy: boolean;
  pendingEntryAction: PendingEntryAction;
  pendingRole?: string | null;
  navigatingToSpectate?: boolean;
  onPlayer: () => void;
  onVolunteer: () => void;
  onSpectator: () => void;
  onBack: () => void;
  onHasQrYes: () => void;
  onHasQrNo: () => void;
  onViaQr: () => void;
  onViaNameSearch: () => void;
  onAsNewPlayer: () => void;
}) {
  const title =
    entryStep === "role"
      ? "How are you joining?"
      : checkInAs === "volunteer"
        ? "Do you have a QR?"
        : "How should we find you?";

  return (
    <CheckInPageShell
      title={title}
      sessionTitle={gameTitle}
      sessionLoading={statusLoading}
      clubBranding={clubBranding}
      showClubMark
    >
      {blockedMessage ? (
        <div
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-snug text-foreground"
          role="alert"
        >
          {blockedMessage}
        </div>
      ) : null}

      {entryStep === "has-qr" ? (
        <button
          type="button"
          className="register-checkin-back"
          onClick={onBack}
          disabled={entryBusy}
        >
          <ChevronLeft className="size-4" aria-hidden />
          Back
        </button>
      ) : null}

      <div className="register-checkin-choices">
        {entryStep === "role" ? (
          <>
            <CheckInChoiceCard
              title="Player"
              description="Join the queue and get on a court"
              icon={<UserRound className="size-5" />}
              emphasis="primary"
              disabled={entryBusy || Boolean(blockedMessage)}
              pending={pendingEntryAction === "player"}
              onClick={onPlayer}
            />
            {!isGenericForm ? (
              <CheckInChoiceCard
                title="Volunteer"
                description="Help run today’s session"
                icon={<HeartHandshake className="size-5" />}
                disabled={entryBusy || Boolean(blockedMessage) || (statusLoading && !statusReady)}
                pending={pendingEntryAction === "volunteer"}
                onClick={onVolunteer}
              />
            ) : null}
            <CheckInChoiceCard
              title="Spectator"
              description="Watch live games and the queue"
              icon={<Eye className="size-5" />}
              emphasis="quiet"
              disabled={entryBusy}
              pending={pendingEntryAction === "spectator" || navigatingToSpectate}
              onClick={onSpectator}
            />
          </>
        ) : checkInAs === "volunteer" ? (
          <>
            <CheckInChoiceCard
              title="Yes, I have a QR"
              description="Scan or upload your saved QR ID"
              icon={<QrCode className="size-5" />}
              emphasis="primary"
              disabled={entryBusy || Boolean(blockedMessage)}
              pending={pendingEntryAction === "has-qr-yes" || pendingRole === "upload-qr"}
              onClick={onHasQrYes}
            />
            <CheckInChoiceCard
              title="No, register me"
              description="Fill in volunteer details to get started"
              icon={<UserPlus className="size-5" />}
              disabled={entryBusy || Boolean(blockedMessage)}
              pending={pendingEntryAction === "has-qr-no" || pendingRole === "volunteer"}
              onClick={onHasQrNo}
            />
          </>
        ) : (
          <>
            <CheckInChoiceCard
              title="Via QR"
              description="Scan or upload your saved player QR"
              icon={<QrCode className="size-5" />}
              emphasis="primary"
              disabled={entryBusy || Boolean(blockedMessage)}
              pending={pendingEntryAction === "via-qr" || pendingRole === "upload-qr"}
              onClick={onViaQr}
            />
            <CheckInChoiceCard
              title="Find my name"
              description="Search if you’ve checked in before"
              icon={<Search className="size-5" />}
              disabled={entryBusy || Boolean(blockedMessage)}
              pending={pendingEntryAction === "via-name-search" || pendingRole === "name-search"}
              onClick={onViaNameSearch}
            />
            <CheckInChoiceCard
              title="I’m new"
              description="First time? Register in about a minute"
              icon={<UserPlus className="size-5" />}
              emphasis="quiet"
              disabled={entryBusy || Boolean(blockedMessage)}
              pending={pendingEntryAction === "as-new-player" || pendingRole === "new-player"}
              onClick={onAsNewPlayer}
            />
          </>
        )}
      </div>
    </CheckInPageShell>
  );
}
