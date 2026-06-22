import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function LiveQueueOffBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 rounded-full border-violet-500/40 bg-violet-500/10 px-2 py-0 text-[0.625rem] font-semibold tracking-wide text-violet-800 dark:text-violet-200",
        className,
      )}
    >
      Live queuing off
    </Badge>
  );
}