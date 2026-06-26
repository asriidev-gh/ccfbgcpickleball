"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type MutableRefObject } from "react";
import { toast } from "sonner";

import { Toaster } from "@/components/ui/sonner";
import { shouldSuppressOperatorDashboardToasts } from "@/lib/operator-game-dashboard-path";

type ToastFn = typeof toast.success;

function noopToast() {
  return "";
}

function patchToastMethods(patch: boolean, originals: MutableRefObject<Record<string, ToastFn> | null>) {
  if (patch) {
    if (!originals.current) {
      originals.current = {
        success: toast.success,
        error: toast.error,
        info: toast.info,
        warning: toast.warning,
        message: toast.message,
      };
    }
    toast.success = noopToast as typeof toast.success;
    toast.error = noopToast as typeof toast.error;
    toast.info = noopToast as typeof toast.info;
    toast.warning = noopToast as typeof toast.warning;
    toast.message = noopToast as typeof toast.message;
    return;
  }

  if (!originals.current) return;
  toast.success = originals.current.success;
  toast.error = originals.current.error;
  toast.info = originals.current.info;
  toast.warning = originals.current.warning;
  toast.message = originals.current.message;
  originals.current = null;
}

export function AppToaster() {
  const pathname = usePathname() ?? "";
  const suppress = shouldSuppressOperatorDashboardToasts(pathname);
  const originalsRef = useRef<Record<string, ToastFn> | null>(null);

  useEffect(() => {
    if (suppress) {
      toast.dismiss();
    }
    patchToastMethods(suppress, originalsRef);
    return () => {
      patchToastMethods(false, originalsRef);
    };
  }, [suppress]);

  return (
    <Toaster
      richColors
      position="top-right"
      className={suppress ? "pointer-events-none hidden" : undefined}
    />
  );
}
