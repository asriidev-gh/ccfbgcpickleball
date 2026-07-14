"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  fetchGameRegistrationStatus,
  getRegistrationBlockedMessage,
  promptIfRegistrationFullFromStatus,
} from "@/components/game/registration-capacity-prompt";
import { useNavigateToSpectate } from "@/components/register/use-navigate-to-spectate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { GameRegistrationStatus } from "@/lib/game-registration-limit";
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
  | null;

type RegistrationRole = "new-player" | "volunteer" | "upload-qr";

type StatusWithTitle = GameRegistrationStatus & { gameTitle?: string };

export function RegistrationEntry({
  gameId,
  initialMode,
}: {
  gameId: string;
  initialMode?: "upload-qr";
}) {
  const router = useRouter();
  const { navigateToSpectate, navigating: navigatingToSpectate } = useNavigateToSpectate(gameId);
  const skipToUpload = initialMode === "upload-qr";

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

  const entryBusy =
    pendingEntryAction !== null || pendingRole !== null || navigatingToSpectate;

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
      <main className="register-page">
        <section className="register-shell">
          <div
            className="register-card flex min-h-[12rem] items-center justify-center gap-2 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Opening registration…
          </div>
        </section>
      </main>
    );
  }

  if (statusError && !registrationStatus) {
    return (
      <main className="register-page">
        <section className="register-shell">
          <Card className="register-card border border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="section-title">Registration unavailable</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{statusError}</p>
              <Button type="button" className="w-full" onClick={() => router.refresh()}>
                Try again
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  return (
    <main className="register-page">
      <section className="register-shell">
        <Card className="register-card border border-border bg-card shadow-sm">
          <CardHeader className="register-card-header">
            <div className="min-w-0">
              <CardTitle className="section-title">Check In</CardTitle>
              {registrationStatus?.gameTitle ? (
                <p className="caption mt-1 text-muted-foreground">
                  {registrationStatus.gameTitle}
                </p>
              ) : statusLoading ? (
                <p className="caption mt-1 flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Loading session…
                </p>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="register-form-compact">
            {registrationBlockedMessage ? (
              <div
                className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
                role="alert"
              >
                {registrationBlockedMessage}
              </div>
            ) : null}

            {entryStep === "role" ? (
              <div className="register-block">
                <Label className="register-label">Check In as:</Label>
                <div className="flex flex-col gap-3">
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="register-toggle-btn w-full"
                    disabled={entryBusy || Boolean(registrationBlockedMessage)}
                    onClick={() => void openHasQrStep("player")}
                  >
                    {pendingEntryAction === "player" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        Loading…
                      </>
                    ) : (
                      "Player"
                    )}
                  </Button>
                  {!isGenericForm ? (
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      className="register-toggle-btn w-full"
                      disabled={
                        entryBusy ||
                        Boolean(registrationBlockedMessage) ||
                        (statusLoading && !registrationStatus)
                      }
                      onClick={() => void openHasQrStep("volunteer")}
                    >
                      {pendingEntryAction === "volunteer" ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                          Loading…
                        </>
                      ) : (
                        "Volunteer"
                      )}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="register-toggle-btn w-full"
                    disabled={entryBusy}
                    onClick={() => void handleSpectator()}
                  >
                    {pendingEntryAction === "spectator" || navigatingToSpectate ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        Opening…
                      </>
                    ) : (
                      "Spectator"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="register-back"
                  onClick={() => {
                    setCheckInAs(null);
                    setEntryStep("role");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  disabled={entryBusy}
                >
                  ← Back
                </Button>

                <div className="register-block">
                  <Label className="register-label">Do you have a QR already?</Label>
                  <div className="register-toggle-row">
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      className="register-toggle-btn"
                      disabled={entryBusy || Boolean(registrationBlockedMessage)}
                      onClick={() => void handleHasQrYes()}
                    >
                      {pendingEntryAction === "has-qr-yes" || pendingRole === "upload-qr" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          Loading…
                        </>
                      ) : (
                        "Yes"
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      className="register-toggle-btn"
                      disabled={entryBusy || Boolean(registrationBlockedMessage)}
                      onClick={() => void handleHasQrNo()}
                    >
                      {pendingEntryAction === "has-qr-no" ||
                      pendingRole === "new-player" ||
                      pendingRole === "volunteer" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          Loading…
                        </>
                      ) : (
                        "No"
                      )}
                    </Button>
                  </div>
                  <p className="caption text-center text-muted-foreground">
                    {checkInAs === "volunteer"
                      ? "Choose Yes to check in with your saved QR ID, or No to register as a new volunteer."
                      : "Choose Yes to upload your saved QR ID, or No to register as a new player."}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
