import { Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { lockInGroupToneClass } from "@/lib/lock-in-groups-shared";
import { cn } from "@/lib/utils";

type LockInGroupBadgeProps = {
  groupId: string;
  className?: string;
};

export function LockInGroupBadge({ groupId, className }: LockInGroupBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 text-[10px] font-medium",
        lockInGroupToneClass(groupId),
        className,
      )}
      title="Locked-in partners"
    >
      <Lock className="h-3 w-3" aria-hidden />
      Lock-in
    </Badge>
  );
}
