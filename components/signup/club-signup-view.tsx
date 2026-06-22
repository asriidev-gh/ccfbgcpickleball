"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ThemeMenu } from "@/components/theme-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME } from "@/lib/app-config";
import {
  completePendingEphemeralQuickGameTransfer,
  readPendingEphemeralQuickGameTransfer,
} from "@/lib/ephemeral-quick-game-transfer";
import {
  normalizeClubSlug,
  suggestClubSlugFromName,
  validateClubSlug,
} from "@/lib/club-signup-shared";
import { useClubLinkPrefix } from "@/hooks/use-club-link-prefix";
import { getQuickGameDashboardPath } from "@/lib/local-game-id";
import {
  WIZARD_PRIMARY_FIELD_BORDER,
  WIZARD_PRIMARY_FIELDS_SCOPE,
} from "@/lib/wizard-field-styles";
import { cn } from "@/lib/utils";

type SignupTab = "new" | "existing";

function SignupTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={cn(
        "rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function SignupPasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn("h-11 pr-9 text-base", WIZARD_PRIMARY_FIELD_BORDER)}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="absolute top-1/2 right-1 z-10 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}

export function ClubSignupPage({ defaultTab = "new" }: { defaultTab?: SignupTab }) {
  return (
    <Suspense fallback={null}>
      <ClubSignupForm defaultTab={defaultTab} />
    </Suspense>
  );
}

function ClubSignupForm({ defaultTab }: { defaultTab: SignupTab }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const saveQuickPlay = searchParams.get("saveQuickPlay") === "1";
  const clubLinkPrefix = useClubLinkPrefix();

  const [tab, setTab] = useState<SignupTab>(defaultTab);
  const isSignInPage = defaultTab === "existing";
  const [loading, setLoading] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  const [newClubForm, setNewClubForm] = useState({
    clubName: "",
    email: "",
    clubSlug: "",
    password: "",
    confirmPassword: "",
  });

  const [existingClubForm, setExistingClubForm] = useState({
    clubSlug: "",
    password: "",
  });

  useEffect(() => {
    if (slugTouched || !newClubForm.clubName.trim()) return;
    setNewClubForm((prev) => ({
      ...prev,
      clubSlug: suggestClubSlugFromName(prev.clubName),
    }));
  }, [newClubForm.clubName, slugTouched]);

  const finishAuth = async (message: string) => {
    void queryClient.invalidateQueries({ queryKey: ["auth-me"] });

    if (readPendingEphemeralQuickGameTransfer()) {
      const newGameId = await completePendingEphemeralQuickGameTransfer(queryClient);
      if (newGameId) {
        toast.success("Your public session has been saved in your account.");
        router.push(getQuickGameDashboardPath(newGameId));
        router.refresh();
        return;
      }
    }

    toast.success(message);
    const returnTo = searchParams.get("returnTo");
    const destination =
      returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
    router.push(destination);
    router.refresh();
  };

  const submitNewClub = async () => {
    const clubSlug = normalizeClubSlug(newClubForm.clubSlug);
    const slugError = validateClubSlug(clubSlug);
    if (!newClubForm.clubName.trim()) {
      toast.error("Club name is required.");
      return;
    }
    if (!newClubForm.email.trim()) {
      toast.error("Recovery email is required.");
      return;
    }
    if (slugError) {
      toast.error(slugError);
      return;
    }
    if (newClubForm.password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (newClubForm.password !== newClubForm.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/auth/club-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clubName: newClubForm.clubName.trim(),
          email: newClubForm.email.trim(),
          clubSlug,
          password: newClubForm.password,
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Failed to create club.");

      await finishAuth("Club created. Check your email to verify your account.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create club.");
    } finally {
      setLoading(false);
    }
  };

  const submitExistingClub = async () => {
    const clubSlug = normalizeClubSlug(existingClubForm.clubSlug);
    if (!clubSlug || !existingClubForm.password) {
      toast.error("Club link and password are required.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/auth/club-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clubSlug,
          password: existingClubForm.password,
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Failed to join club.");

      await finishAuth("Welcome back!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to join club.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page flex min-h-[100dvh] flex-col bg-background">
      <header className="border-b border-border/60 bg-background/95 py-3 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-6">
          <span className="app-brand">{APP_NAME}</span>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeMenu />
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center p-6">
        <div className="relative z-10 flex w-full max-w-lg flex-col gap-5">
          <div className="text-center">
            <h1 className="section-title text-2xl font-bold text-foreground">Set Up Your Club</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Set up your club once — your team can sign in from any device.
            </p>
          </div>

          {saveQuickPlay ? (
            <p className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-center text-sm text-foreground">
              Create or join a club to save this open play session to your account.
            </p>
          ) : null}

          <div
            className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1 shadow-sm"
            role="tablist"
            aria-label="Club signup type"
          >
            <SignupTabButton active={tab === "new"} onClick={() => setTab("new")}>
              New Club
            </SignupTabButton>
            <SignupTabButton active={tab === "existing"} onClick={() => setTab("existing")}>
              Existing Club
            </SignupTabButton>
          </div>

          {tab === "new" ? (
              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle className="section-title text-lg">Create Your Club</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Your club profile and sessions stay in sync across every device your team uses.
                  </p>
                </CardHeader>
                <CardContent className={cn("space-y-4", WIZARD_PRIMARY_FIELDS_SCOPE)}>
                  <div className="space-y-2">
                    <Label>Club Name</Label>
                    <Input
                      className={cn("h-11 text-base", WIZARD_PRIMARY_FIELD_BORDER)}
                      placeholder="e.g., BGC Pickleball, Sunday Sesh"
                      value={newClubForm.clubName}
                      onChange={(event) =>
                        setNewClubForm((prev) => ({ ...prev, clubName: event.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Recovery Email{" "}
                      <span className="font-normal text-muted-foreground">(required)</span>
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Kept private — used only if you need to reset your password.
                    </p>
                    <Input
                      type="email"
                      className={cn("h-11 text-base", WIZARD_PRIMARY_FIELD_BORDER)}
                      placeholder="admin@example.com"
                      value={newClubForm.email}
                      onChange={(event) =>
                        setNewClubForm((prev) => ({ ...prev, email: event.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Club Link</Label>
                    <p className="text-xs text-muted-foreground">
                      Choose a short link for your club, e.g. bgc-pickleball. Use it when you sign in.
                    </p>
                    <div
                      className={cn(
                        "flex overflow-hidden rounded-md border bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30",
                        WIZARD_PRIMARY_FIELD_BORDER,
                      )}
                    >
                      <span className="flex items-center whitespace-nowrap border-r border-border bg-muted/50 px-3 text-sm text-muted-foreground">
                        {clubLinkPrefix}/
                      </span>
                      <Input
                        className="h-11 rounded-none border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
                        placeholder="your-club"
                        value={newClubForm.clubSlug}
                        onChange={(event) => {
                          setSlugTouched(true);
                          setNewClubForm((prev) => ({
                            ...prev,
                            clubSlug: normalizeClubSlug(event.target.value),
                          }));
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Club Password</Label>
                    <p className="text-xs text-muted-foreground">
                      You'll sign in to your club with this password.
                    </p>
                    <SignupPasswordInput
                      value={newClubForm.password}
                      onChange={(password) => setNewClubForm((prev) => ({ ...prev, password }))}
                      placeholder="Create a password"
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Confirm Password</Label>
                    <SignupPasswordInput
                      value={newClubForm.confirmPassword}
                      onChange={(confirmPassword) =>
                        setNewClubForm((prev) => ({ ...prev, confirmPassword }))
                      }
                      placeholder="Confirm your password"
                      autoComplete="new-password"
                    />
                  </div>

                  <Button className="w-full" onClick={submitNewClub} disabled={loading}>
                    {loading ? "Please wait..." : "Create Club"}
                  </Button>
                </CardContent>
              </Card>
          ) : (
              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle className="section-title text-lg">Login to Your Club</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Enter your club link name and password.
                  </p>
                </CardHeader>
                <CardContent className={cn("space-y-4", WIZARD_PRIMARY_FIELDS_SCOPE)}>
                  <div className="space-y-2">
                    <Label>Club Link</Label>
                    <div
                      className={cn(
                        "flex overflow-hidden rounded-md border bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30",
                        WIZARD_PRIMARY_FIELD_BORDER,
                      )}
                    >
                      <span className="flex items-center whitespace-nowrap border-r border-border bg-muted/50 px-3 text-sm text-muted-foreground">
                        {clubLinkPrefix}/
                      </span>
                      <Input
                        className="h-11 rounded-none border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
                        placeholder="club-slug"
                        value={existingClubForm.clubSlug}
                        onChange={(event) =>
                          setExistingClubForm((prev) => ({
                            ...prev,
                            clubSlug: normalizeClubSlug(event.target.value),
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Club Password</Label>
                    <SignupPasswordInput
                      value={existingClubForm.password}
                      onChange={(password) =>
                        setExistingClubForm((prev) => ({ ...prev, password }))
                      }
                      placeholder="Enter club password"
                      autoComplete="current-password"
                    />
                  </div>

                  <div className="space-y-1 text-center">
                    <Link href="/login" className="text-sm font-medium text-primary hover:underline">
                      Forgot password?
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Use your recovery email on the login page to reset your password.
                    </p>
                  </div>

                  <Button className="w-full" onClick={submitExistingClub} disabled={loading}>
                    {loading ? "Please wait..." : isSignInPage ? "Sign In" : "Join Club"}
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    New here?{" "}
                    {isSignInPage ? (
                      <Link href="/signup" className="font-medium text-primary hover:underline">
                        Create a club
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="font-medium text-primary hover:underline"
                        onClick={() => setTab("new")}
                      >
                        Create a club
                      </button>
                    )}
                  </p>
                </CardContent>
              </Card>
          )}

        </div>
      </main>
    </div>
  );
}
