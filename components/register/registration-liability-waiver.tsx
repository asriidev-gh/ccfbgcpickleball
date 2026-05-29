"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type RegistrationLiabilityWaiverProps = {
  checked: boolean;
  disabled?: boolean;
  error?: string;
  onCheckedChange: (checked: boolean) => void;
};

const WAIVER_ITEMS = [
  {
    title: "Voluntary Participation",
    body: "I voluntarily participate in basketball activities organized by CCF Makati Sports.",
  },
  {
    title: "Assumption of Risk",
    body: "Basketball involves inherent risks including sprains, fractures, and physical harm.",
  },
  {
    title: "Release of Liability",
    body: "I release CCF Makati Sports, its organizers, and staff from all liability for injuries sustained during participation.",
  },
  {
    title: "Medical Responsibility",
    body: "I am physically fit to participate and solely responsible for my medical expenses.",
  },
  {
    title: "Emergency Consent",
    body: "I authorize organizers to seek emergency care on my behalf if needed.",
  },
] as const;

export function RegistrationLiabilityWaiver({
  checked,
  disabled = false,
  error,
  onCheckedChange,
}: RegistrationLiabilityWaiverProps) {
  return (
    <div
      className={cn(
        "register-block space-y-4 rounded-lg border border-border bg-muted/25 px-4 py-4",
        error && "ring-2 ring-destructive/40",
      )}
    >
      <div className="space-y-1">
        <h3 className="register-label text-base">Liability Waiver</h3>
      </div>
      <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-muted-foreground">
        {WAIVER_ITEMS.map((item, index) => (
          <li key={item.title} className="space-y-0.5">
            <span className="font-medium text-foreground">
              {index + 1}. {item.title}.
            </span>{" "}
            {item.body}
          </li>
        ))}
      </ol>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background px-3 py-3">
        <Checkbox
          id="registration-waiver-accepted"
          checked={checked}
          disabled={disabled}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "waiverAccepted-error" : undefined}
        />
        <span className="text-sm leading-snug text-foreground">
          I have read, understood, and agree to this liability waiver.{" "}
          <span className="text-destructive" aria-hidden>
            *
          </span>
        </span>
      </label>
      {error ? (
        <p id="waiverAccepted-error" className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
