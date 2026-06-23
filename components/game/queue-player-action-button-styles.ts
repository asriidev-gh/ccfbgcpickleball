import { cn } from "@/lib/utils";

export const queuePlayerActionButtonEmeraldClass =
  "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

export const queuePlayerActionButtonCompactClass =
  "h-7 min-h-7 gap-0.5 px-2 text-[11px] leading-tight xl:h-9 xl:min-h-9 xl:px-3 xl:text-sm";

export const queuePlayerActionDialogFooterClass =
  "!mx-0 !mb-0 shrink-0 flex-row justify-stretch gap-2 rounded-none border-t bg-muted/50 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:justify-end sm:px-5";

export function queuePlayerActionButtonClassName(options?: {
  compact?: boolean;
  className?: string;
}) {
  return cn(
    queuePlayerActionButtonEmeraldClass,
    options?.compact && queuePlayerActionButtonCompactClass,
    options?.className,
  );
}
