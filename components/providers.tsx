"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { ClientErrorReporter } from "@/components/client-error-reporter";
import { ThemeManager } from "@/components/theme/theme-manager";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ClientErrorReporter>
        <ThemeManager />
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster richColors position="top-right" />
      </ClientErrorReporter>
    </QueryClientProvider>
  );
}
