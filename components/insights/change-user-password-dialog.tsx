"use client";

import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MIN_PASSWORD_LENGTH = 6;

type ChangeUserPasswordDialogProps = {
  user: { id: string; name: string; email: string } | null;
  onClose: () => void;
};

export function ChangeUserPasswordDialog({ user, onClose }: ChangeUserPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setFieldErrors({});
  }, [user]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const errors: Record<string, string> = {};

      if (password.length < MIN_PASSWORD_LENGTH) {
        errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
      }
      if (!confirmPassword) {
        errors.confirmPassword = "Please confirm the password.";
      } else if (password !== confirmPassword) {
        errors.confirmPassword = "Passwords do not match.";
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        throw new Error("validation");
      }

      setFieldErrors({});

      const response = await fetch(`/api/insights/users/${user!.id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to update password.");
      return payload;
    },
    onSuccess: (payload) => {
      toast.success(payload.message ?? "Password updated.");
      onClose();
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "validation") return;
      toast.error(error instanceof Error ? error.message : "Failed to update password.");
    },
  });

  const clearFieldError = (name: string) => {
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  return (
    <Dialog open={Boolean(user)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            Set a new password for <span className="font-medium text-foreground">{user?.name}</span>{" "}
            ({user?.email}).
          </DialogDescription>
        </DialogHeader>

        <form
          id="change-user-password-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={password}
                autoComplete="new-password"
                aria-invalid={Boolean(fieldErrors.password)}
                disabled={saveMutation.isPending}
                className="pr-9"
                onChange={(event) => {
                  clearFieldError("password");
                  setPassword(event.target.value);
                }}
              />
              <button
                type="button"
                disabled={saveMutation.isPending}
                className="absolute top-1/2 right-1 z-10 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
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
            {fieldErrors.password ? (
              <p className="text-sm text-destructive" role="alert">
                {fieldErrors.password}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Minimum {MIN_PASSWORD_LENGTH} characters.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                autoComplete="new-password"
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                disabled={saveMutation.isPending}
                className="pr-9"
                onChange={(event) => {
                  clearFieldError("confirmPassword");
                  setConfirmPassword(event.target.value);
                }}
              />
              <button
                type="button"
                disabled={saveMutation.isPending}
                className="absolute top-1/2 right-1 z-10 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
            {fieldErrors.confirmPassword ? (
              <p className="text-sm text-destructive" role="alert">
                {fieldErrors.confirmPassword}
              </p>
            ) : null}
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saveMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="change-user-password-form" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save password"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
