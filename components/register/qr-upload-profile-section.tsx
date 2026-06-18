"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GENDER_OPTIONS,
  PICKLEBALL_LEVELS,
  type GenderOption,
  type PickleballLevel,
} from "@/lib/player-profile-shared";
import type { QrUploadProfileFormValues } from "@/lib/qr-upload-profile-shared";
import { cn } from "@/lib/utils";

type QrUploadProfileSectionProps = {
  values: QrUploadProfileFormValues;
  fieldErrors: Record<string, string>;
  disabled?: boolean;
  onChange: (patch: Partial<QrUploadProfileFormValues>) => void;
};

function ProfileSelectField({
  id,
  placeholder,
  value,
  options,
  disabled,
  invalid,
  onChange,
}: {
  id: string;
  placeholder: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value || null} disabled={disabled} onValueChange={(next) => onChange(next ?? "")}>
      <SelectTrigger
        id={id}
        aria-invalid={invalid}
        className="h-11 w-full bg-background text-foreground"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-popover text-popover-foreground">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function QrUploadProfileSection({
  values,
  fieldErrors,
  disabled = false,
  onChange,
}: QrUploadProfileSectionProps) {
  return (
    <div className="register-block space-y-4 rounded-lg border border-border/70 bg-muted/5 p-4">
      <div>
        <p className="register-label">Complete your profile</p>
        <p className="caption mt-1 text-muted-foreground">
          We need a few more details before you can join the queue.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="qr-upload-gender">Gender</Label>
        <ProfileSelectField
          id="qr-upload-gender"
          placeholder="Select gender"
          value={values.gender}
          options={GENDER_OPTIONS}
          disabled={disabled}
          invalid={Boolean(fieldErrors.gender)}
          onChange={(gender) => onChange({ gender: gender as GenderOption | "" })}
        />
        {fieldErrors.gender ? (
          <p className="text-sm text-destructive" role="alert">
            {fieldErrors.gender}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="qr-upload-birthdate">Birthdate</Label>
        <Input
          id="qr-upload-birthdate"
          type="date"
          value={values.birthdate}
          disabled={disabled}
          aria-invalid={Boolean(fieldErrors.birthdate)}
          className={cn(fieldErrors.birthdate && "border-destructive")}
          onChange={(event) => onChange({ birthdate: event.target.value })}
        />
        {fieldErrors.birthdate ? (
          <p className="text-sm text-destructive" role="alert">
            {fieldErrors.birthdate}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="qr-upload-level">Self-rate level</Label>
        <ProfileSelectField
          id="qr-upload-level"
          placeholder="Select your pickleball level"
          value={values.pickleballLevel}
          options={PICKLEBALL_LEVELS}
          disabled={disabled}
          invalid={Boolean(fieldErrors.pickleballLevel)}
          onChange={(level) => onChange({ pickleballLevel: level as PickleballLevel | "" })}
        />
        {fieldErrors.pickleballLevel ? (
          <p className="text-sm text-destructive" role="alert">
            {fieldErrors.pickleballLevel}
          </p>
        ) : null}
      </div>
    </div>
  );
}
