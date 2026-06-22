"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = searchParams.get("token")?.trim() ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("This verification link is missing a token.");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
        );
        const data = (await response.json()) as { message?: string };
        if (cancelled) return;
        if (!response.ok) {
          setStatus("error");
          setMessage(data.message ?? "Email verification failed.");
          return;
        }
        setStatus("success");
        setMessage(data.message ?? "Your email has been verified.");
        toast.success("Email verified. You can now create games.");
        void queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      } catch {
        if (cancelled) return;
        setStatus("error");
        setMessage("Email verification failed. Please try again.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [queryClient, token]);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-6">
      <Card className="glass-panel w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="section-title">Email verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {status === "loading" ? (
            <div className="flex flex-col items-center gap-3 py-4 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
              <p>Verifying your email…</p>
            </div>
          ) : (
            <p className={status === "error" ? "text-destructive" : "text-foreground"}>{message}</p>
          )}
          {status === "success" ? (
            <Button className="w-full" onClick={() => router.replace("/")}>
              Go to dashboard
            </Button>
          ) : null}
          {status === "error" ? (
            <Button variant="outline" className="w-full" nativeButton={false} render={<Link href="/" />}>
              Back to dashboard
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
