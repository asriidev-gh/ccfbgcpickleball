"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { AppToaster } from "@/components/app-toaster";
import { ClientErrorReporter } from "@/components/client-error-reporter";
import { CompleteEphemeralQuickGameTransfer } from "@/components/play/complete-ephemeral-quick-game-transfer";
import { ThemeManager } from "@/components/theme/theme-manager";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ClientErrorReporter>
        <CompleteEphemeralQuickGameTransfer />
        <ThemeManager />
        <TooltipProvider>{children}</TooltipProvider>
        <AppToaster />
      </ClientErrorReporter>
    </QueryClientProvider>
  );
}
