import type { ReactNode } from "react";
import { ChevronRight, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type CheckInChoiceCardProps = {
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  pending?: boolean;
  emphasis?: "primary" | "default" | "quiet";
};

export function CheckInChoiceCard({
  title,
  description,
  icon,
  onClick,
  disabled = false,
  pending = false,
  emphasis = "default",
}: CheckInChoiceCardProps) {
  return (
    <button
      type="button"
      className={cn(
        "register-checkin-choice",
        emphasis === "primary" && "register-checkin-choice--primary",
        emphasis === "quiet" && "register-checkin-choice--quiet",
      )}
      disabled={disabled}
      aria-busy={pending}
      onClick={onClick}
    >
      <span className="register-checkin-choice__icon" aria-hidden>
        {pending ? <Loader2 className="size-5 animate-spin" /> : icon}
      </span>
      <span className="register-checkin-choice__copy">
        <span className="register-checkin-choice__title">{title}</span>
        <span className="register-checkin-choice__desc">{description}</span>
      </span>
      <ChevronRight className="register-checkin-choice__chevron" aria-hidden />
    </button>
  );
}
