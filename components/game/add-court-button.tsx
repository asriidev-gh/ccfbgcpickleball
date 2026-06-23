"use client";

import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AddCourtButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  pending?: boolean;
  className?: string;
};

export function AddCourtButton({
  onClick,
  disabled = false,
  pending = false,
  className,
}: AddCourtButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "add-court-btn h-11 w-full border-dashed text-muted-foreground hover:text-foreground",
        className,
      )}
      disabled={disabled || pending}
      onClick={onClick}
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          Adding court…
        </>
      ) : (
        <>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Add court
        </>
      )}
    </Button>
  );
}
