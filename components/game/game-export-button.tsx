"use client";

import { Download, Loader2 } from "lucide-react";
import { type ComponentProps, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type GameExportButtonProps = {
  gameId: string;
  gameTitle: string;
  iconOnly?: boolean;
  /** Defaults to `/api/games/{id}/export`. */
  exportPath?: string;
  successMessage?: string;
} & Partial<Pick<ComponentProps<typeof Button>, "variant" | "size" | "className">>;

function parseFilenameFromDisposition(header: string | null) {
  if (!header) return null;
  const match = /filename="([^"]+)"/i.exec(header) ?? /filename=([^;]+)/i.exec(header);
  return match?.[1]?.trim() ?? null;
}

export function GameExportButton({
  gameId,
  gameTitle,
  iconOnly = false,
  exportPath,
  successMessage = "Registration export downloaded.",
  variant = "outline",
  size,
  className,
}: GameExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const resolvedExportPath = exportPath ?? `/api/games/${gameId}/export`;

  const handleExport = async () => {
    setLoading(true);
    try {
      const response = await fetch(resolvedExportPath);
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Export failed.");
      }

      const blob = await response.blob();
      const filename =
        parseFilenameFromDisposition(response.headers.get("Content-Disposition")) ??
        `${gameTitle.replace(/\s+/g, "-")}-registrations.xlsx`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);

      toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setLoading(false);
    }
  };

  if (iconOnly) {
    return (
      <SimpleTooltip label="Download Player List">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-9 shrink-0", className)}
          disabled={loading}
          aria-label={
            loading ? `Exporting ${gameTitle} registrations` : `Export ${gameTitle} registrations`
          }
          onClick={handleExport}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Download className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </SimpleTooltip>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={loading}
      onClick={handleExport}
    >
      <Download className="mr-2 h-4 w-4" />
      {loading ? "Exporting…" : "Export"}
    </Button>
  );
}
