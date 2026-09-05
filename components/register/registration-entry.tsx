"use client";

import dynamic from "next/dynamic";
import { Eye, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  fetchGameRegistrationStatus,
  getRegistrationBlockedMessage,
  promptIfRegistrationFullFromStatus,
} from "@/components/game/registration-capacity-prompt";
import { CheckInLanding, CheckInPageShell } from "@/components/register/check-in-landing";
import { useNavigateToSpectate } from "@/components/register/use-navigate-to-spectate";
import { Button } from "@/components/ui/button";
import type { GameRegistrationStatus } from "@/lib/game-registration-limit";
import { getActiveQueueHighlightPlayerIds } from "@/lib/queue-highlight";
import { isQrIdRegistrationEnabled } from "@/lib/registration-feature";
import type { RegistrationFormVariant } from "@/lib/registration-variant";

const RegistrationForm = dynamic(
  () =>
    import("@/components/register/registration-form").then((mod) => mod.RegistrationForm),
  {
    ssr: false,
    loading: () => (
      <main className="register-page">
        <section className="register-shell">
          <div
            className="register-card flex min-h-[12rem] items-center justify-center gap-2 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading registration…
          </div>
        </section>
      </main>
    ),
  },
);

type EntryStep = "role" | "has-qr";
type CheckInAs = "player" | "volunteer";
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

type RegistrationRole = "new-player" | "volunteer" | "upload-qr" | "name-search";

type StatusWithTitle = GameRegistrationStatus & { gameTitle?: string };

export function RegistrationEntry({
  gameId,
  initialMode,
  allowAnotherRegistration = false,
}: {
  gameId: string;
  initialMode?: "upload-qr";
  /** When true (e.g. ?again=1), skip the already-checked-in gate. */
  allowAnotherRegistration?: boolean;
}) {
  const router = useRouter();
  const { navigateToSpectate, navigating: navigatingToSpectate } = useNavigateToSpectate(gameId);
  const skipToUpload = initialMode === "upload-qr";
  const bypassCheckedInGate = allowAnotherRegistration || skipToUpload;

  const [entryStep, setEntryStep] = useState<EntryStep>("role");
  const [checkInAs, setCheckInAs] = useState<CheckInAs | null>(null);
  const [selectedRole, setSelectedRole] = useState<RegistrationRole | null>(
    skipToUpload ? "upload-qr" : null,
  );
  const [pendingEntryAction, setPendingEntryAction] = useState<PendingEntryAction>(null);
  const [pendingRole, setPendingRole] = useState<RegistrationRole | null>(null);
  const [registrationStatus, setRegistrationStatus] = useState<StatusWithTitle | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [checkedInGate, setCheckedInGate] = useState<"unknown" | "yes" | "no">(
    bypassCheckedInGate ? "no" : "unknown",
  );

  useEffect(() => {
    if (bypassCheckedInGate) {
      setCheckedInGate("no");
      return;
    }

    const evaluate = () => {
      const alreadyCheckedIn = getActiveQueueHighlightPlayerIds(gameId).length > 0;
      setCheckedInGate(alreadyCheckedIn ? "yes" : "no");
      if (alreadyCheckedIn) {
        setSelectedRole(null);
        setCheckInAs(null);
        setEntryStep("role");
      }
    };

    evaluate();
    window.addEventListener("pageshow", evaluate);
    return () => window.removeEventListener("pageshow", evaluate);
  }, [gameId, bypassCheckedInGate]);

  useEffect(() => {
    let cancelled = false;
    const loadStatus = async () => {
      setStatusLoading(true);
      setStatusError(null);
      try {
        const status = (await fetchGameRegistrationStatus(gameId)) as StatusWithTitle;
        if (cancelled) return;
        if (status.allowQrRegistration === false) {
          router.replace(`/games/${gameId}/spectate`);
          return;
        }
        setRegistrationStatus(status);
      } catch (error) {
        if (cancelled) return;
        setRegistrationStatus(null);
        setStatusError(
          error instanceof Error ? error.message : "Failed to open registration.",
        );
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    };
    void loadStatus();
    // Warm the heavy registration form chunk while the user picks a role.
    void import("@/components/register/registration-form");
    return () => {
      cancelled = true;
    };
  }, [gameId, router]);

  const formVariant: RegistrationFormVariant =
    registrationStatus?.formVariant ?? "ccf";
  const isGenericForm = formVariant === "generic";
  const qrIdEnabled = isQrIdRegistrationEnabled(registrationStatus?.registrationFeature);
  const registrationBlockedMessage = registrationStatus
    ? getRegistrationBlockedMessage(registrationStatus)
    : null;

  const ensureCanRegister = async () => {
    if (registrationStatus) {
      return promptIfRegistrationFullFromStatus(registrationStatus);
    }
    try {
      const status = (await fetchGameRegistrationStatus(gameId)) as StatusWithTitle;
      if (status.allowQrRegistration === false) {
        router.replace(`/games/${gameId}/spectate`);
        return false;
      }
      setRegistrationStatus(status);
      return promptIfRegistrationFullFromStatus(status);
    } catch {
      return true;
    }
  };

  const selectRole = async (nextRole: RegistrationRole) => {
    if (pendingRole) return;
    setPendingRole(nextRole);
    try {
      if (!(await ensureCanRegister())) return;
      setSelectedRole(nextRole);
    } finally {
      setPendingRole(null);
    }
  };

  const openHasQrStep = async (as: CheckInAs) => {
    if (pendingEntryAction) return;
    setPendingEntryAction(as);
    try {
      if (!(await ensureCanRegister())) return;
      setCheckInAs(as);
      setEntryStep("has-qr");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setPendingEntryAction(null);
    }
  };

  const handleSpectator = async () => {
    if (pendingEntryAction || navigatingToSpectate) return;
    setPendingEntryAction("spectator");
    try {
      await navigateToSpectate({ applyQueueHighlight: false });
    } finally {
      setPendingEntryAction(null);
    }
  };

  const handleHasQrYes = async () => {
    if (pendingEntryAction || pendingRole || !checkInAs) return;
    setPendingEntryAction("has-qr-yes");
    try {
      if (!qrIdEnabled) {
        toast.info("QR check-in is not available for this session. Please complete registration.");
        await selectRole(checkInAs === "volunteer" ? "volunteer" : "new-player");
        return;
      }
      await selectRole("upload-qr");
    } finally {
      setPendingEntryAction(null);
    }
  };

  const handleHasQrNo = async () => {
    if (pendingEntryAction || pendingRole || !checkInAs) return;
    setPendingEntryAction("has-qr-no");
    try {
      await selectRole(checkInAs === "volunteer" ? "volunteer" : "new-player");
    } finally {
      setPendingEntryAction(null);
    }
  };

  const handleViaQr = async () => {
    if (pendingEntryAction || pendingRole || checkInAs !== "player") return;
    setPendingEntryAction("via-qr");
    try {
      if (!qrIdEnabled) {
        toast.info("QR check-in is not available for this session. Please complete registration.");
        await selectRole("new-player");
        return;
      }
      await selectRole("upload-qr");
    } finally {
      setPendingEntryAction(null);
    }
  };

  const handleViaNameSearch = async () => {
    if (pendingEntryAction || pendingRole || checkInAs !== "player") return;
    setPendingEntryAction("via-name-search");
    try {
      await selectRole("name-search");
    } finally {
      setPendingEntryAction(null);
    }
  };

  const handleAsNewPlayer = async () => {
    if (pendingEntryAction || pendingRole || checkInAs !== "player") return;
    setPendingEntryAction("as-new-player");
    try {
      await selectRole("new-player");
    } finally {
      setPendingEntryAction(null);
    }
  };

  const entryBusy =
    pendingEntryAction !== null || pendingRole !== null || navigatingToSpectate;

  if (checkedInGate === "unknown") {
    return (
      <CheckInPageShell title="Opening…" sessionLoading>
        <div
          className="flex min-h-[10rem] flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Opening registration…
        </div>
      </CheckInPageShell>
    );
  }

  if (checkedInGate === "yes") {
    return (
      <CheckInPageShell
        title="You’re already in"
        sessionTitle={registrationStatus?.gameTitle}
        sessionLoading={statusLoading && !registrationStatus}
        clubBranding={registrationStatus?.clubBranding}
        showClubMark
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          You are already checked in for this session. Head back to the live queue anytime.
        </p>
        <Button
          type="button"
          size="lg"
          className="register-submit w-full"
          disabled={navigatingToSpectate}
          onClick={() => void navigateToSpectate()}
        >
          {navigatingToSpectate ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
              Loading queue…
            </>
          ) : (
            <>
              <Eye className="mr-2 h-5 w-5" aria-hidden />
              Go back to game
            </>
          )}
        </Button>
      </CheckInPageShell>
    );
  }

  if (selectedRole && registrationStatus) {
    return (
      <RegistrationForm
        gameId={gameId}
        gameTitle={registrationStatus.gameTitle}
        formVariant={formVariant}
        initialRegistrationStatus={registrationStatus}
        initialRole={selectedRole}
        initialMode={selectedRole === "upload-qr" ? "upload-qr" : undefined}
        onLeaveRole={() => {
          const leaveToRoleStep = selectedRole === "upload-qr" && skipToUpload;
          setSelectedRole(null);
          if (leaveToRoleStep) {
            setCheckInAs(null);
            setEntryStep("role");
          } else {
            setEntryStep("has-qr");
          }
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    );
  }

  if (skipToUpload && statusLoading) {
    return (
      <CheckInPageShell title="Opening…" sessionLoading>
        <div
          className="flex min-h-[10rem] flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Opening registration…
        </div>
      </CheckInPageShell>
    );
  }

  if (statusError && !registrationStatus) {
    return (
      <CheckInPageShell title="Registration unavailable">
        <p className="text-sm leading-relaxed text-muted-foreground">{statusError}</p>
        <Button type="button" className="w-full" onClick={() => router.refresh()}>
          Try again
        </Button>
      </CheckInPageShell>
    );
  }

  return (
    <CheckInLanding
      gameTitle={registrationStatus?.gameTitle}
      clubBranding={registrationStatus?.clubBranding}
      statusLoading={statusLoading}
      statusReady={Boolean(registrationStatus)}
      blockedMessage={registrationBlockedMessage}
      entryStep={entryStep}
      checkInAs={checkInAs}
      isGenericForm={isGenericForm}
      entryBusy={entryBusy}
      pendingEntryAction={pendingEntryAction}
      pendingRole={pendingRole}
      navigatingToSpectate={navigatingToSpectate}
      onPlayer={() => void openHasQrStep("player")}
      onVolunteer={() => void openHasQrStep("volunteer")}
      onSpectator={() => void handleSpectator()}
      onBack={() => {
        setCheckInAs(null);
        setEntryStep("role");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      onHasQrYes={() => void handleHasQrYes()}
      onHasQrNo={() => void handleHasQrNo()}
      onViaQr={() => void handleViaQr()}
      onViaNameSearch={() => void handleViaNameSearch()}
      onAsNewPlayer={() => void handleAsNewPlayer()}
    />
  );
}
