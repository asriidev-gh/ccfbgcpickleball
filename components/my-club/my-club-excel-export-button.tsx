"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

function parseFilenameFromDisposition(header: string | null) {
  if (!header) return null;
  const match = /filename="([^"]+)"/i.exec(header) ?? /filename=([^;]+)/i.exec(header);
  return match?.[1]?.trim() ?? null;
}

export function MyClubExcelExportButton({
  buildUrl,
  defaultFilename,
  disabled,
  label = "Export Excel",
}: {
  buildUrl: () => string;
  defaultFilename: string;
  disabled?: boolean;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const response = await fetch(buildUrl());
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Export failed.");
      }

      const blob = await response.blob();
      const filename =
        parseFilenameFromDisposition(response.headers.get("Content-Disposition")) ??
        defaultFilename;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);

      toast.success("Excel export downloaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 px-3 text-sm"
      disabled={disabled || loading}
      onClick={handleExport}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        <Download className="h-4 w-4 shrink-0" aria-hidden />
      )}
      {loading ? "Exporting…" : label}
    </Button>
  );
}
