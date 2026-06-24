"use client";

import { Mail, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuthMe } from "@/hooks/use-auth-me";
import { cn } from "@/lib/utils";

export function EmailVerificationBanner({ className }: { className?: string }) {
  const [resending, setResending] = useState(false);

  const { data } = useAuthMe();

  const user = data?.user;
  if (!user || user.emailVerified) return null;

  const resend = async () => {
    try {
      setResending(true);
      const response = await fetch("/api/auth/resend-verification-email", { method: "POST" });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message);
      toast.success(payload.message ?? "Verification email sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resend verification email.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex gap-3">
        <Mail className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Verify your email to create games</p>
          <p className="text-sm text-foreground/80">
            We sent a welcome email to <span className="font-medium">{user.email}</span>. Open it and
            click the verification link before creating a new game.
          </p>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0 border-amber-600/50 bg-background text-foreground hover:bg-amber-500/10 dark:border-amber-400/40"
        disabled={resending}
        onClick={() => void resend()}
      >
        {resending ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
            Sending…
          </>
        ) : (
          "Resend email"
        )}
      </Button>
    </div>
  );
}

export function useEmailVerified() {
  const { data, isLoading } = useAuthMe();

  return {
    isLoading,
    emailVerified: data?.user?.emailVerified === true,
    user: data?.user ?? null,
  };
}
