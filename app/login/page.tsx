"use client";

import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { LoginVideoIntro } from "@/components/login/login-video-intro";
import { DeveloperCreditLink } from "@/components/developer-credit-link";
import { WatchDemoButton } from "@/components/watch-demo-button";
import { APP_NAME } from "@/lib/app-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [introDone, setIntroDone] = useState(false);

  const handleIntroComplete = useCallback(() => {
    setIntroDone(true);
  }, []);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      toast.error(error);
      router.replace("/login");
    }
  }, [searchParams, router]);

  const submit = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      toast.success(mode === "login" ? "Welcome back!" : "Account created.");
      const returnTo = searchParams.get("returnTo");
      const destination =
        returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
      router.push(destination);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="login-page__bg" aria-hidden="true">
        <Image
          src="/assets/images/login_logo.jpeg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      <header className="login-page-header absolute inset-x-0 top-0 z-20 border-b border-border/60 bg-background/85 py-3 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-6">
          <span className="app-brand">{APP_NAME}</span>
          <WatchDemoButton />
        </div>
      </header>

      <main className="login-page relative isolate z-10 flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden p-6">
        {!introDone ? <LoginVideoIntro onComplete={handleIntroComplete} /> : null}

      <div
        className={cn(
          "relative z-10 flex w-full max-w-md flex-col items-center gap-6 transition-all duration-700 ease-out",
          introDone
            ? "-translate-y-[60px] opacity-100"
            : "pointer-events-none translate-y-4 opacity-0",
        )}
        aria-hidden={!introDone}
      >
        <Card className="glass-panel w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="section-title">
              {mode === "login" ? "Login" : "Create Account"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === "register" ? (
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  className="pr-9"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  className="absolute top-1/2 right-1 z-10 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
            </div>
            <Button className="w-full" onClick={submit} disabled={loading || !introDone}>
              {loading ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
            </Button>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={loading || !introDone}
              onClick={() => {
                window.location.href = "/api/auth/google";
              }}
            >
              <GoogleIcon />
              Continue with Google
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              disabled={!introDone}
              onClick={() => setMode((prev) => (prev === "login" ? "register" : "login"))}
            >
              {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
            </Button>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">
          <DeveloperCreditLink />
        </p>
      </div>
    </main>
    </>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
