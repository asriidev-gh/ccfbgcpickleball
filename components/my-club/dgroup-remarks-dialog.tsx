"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Loader2, MessageSquarePlus, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_DGROUP_REMARK_LENGTH,
  type DgroupRemarkItem,
} from "@/lib/owner-dgroup-remarks-shared";

const deleteAlertOptions = {
  background: "#0f172a",
  color: "#e2e8f0",
  confirmButtonColor: "#ef4444",
  cancelButtonColor: "#64748b",
};

export function DgroupRemarksDialog({
  playerId,
  playerName,
  open,
  onOpenChange,
}: {
  playerId: string;
  playerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [draftText, setDraftText] = useState("");
  const [editingRemark, setEditingRemark] = useState<DgroupRemarkItem | null>(null);

  useEffect(() => {
    if (!open) {
      setDraftText("");
      setEditingRemark(null);
    }
  }, [open]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-club-dgroup-remarks", playerId],
    queryFn: async () => {
      const response = await fetch(`/api/my-club/dgroup-requests/${playerId}/remarks`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Failed to load remarks.");
      return payload as { remarks: DgroupRemarkItem[] };
    },
    enabled: open,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["my-club-dgroup-remarks", playerId] });
    queryClient.invalidateQueries({ queryKey: ["my-club-dgroup-requests"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const text = draftText.trim();
      if (!text) throw new Error("Remark is required.");

      const response = await fetch(
        editingRemark
          ? `/api/my-club/dgroup-requests/${playerId}/remarks/${editingRemark.id}`
          : `/api/my-club/dgroup-requests/${playerId}/remarks`,
        {
          method: editingRemark ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Failed to save remark.");
      return payload as { message?: string };
    },
    onSuccess: (payload) => {
      toast.success(payload.message ?? "Remark saved.");
      setDraftText("");
      setEditingRemark(null);
      invalidate();
    },
    onError: (saveError) => {
      toast.error(saveError instanceof Error ? saveError.message : "Failed to save remark.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (remarkId: string) => {
      const response = await fetch(
        `/api/my-club/dgroup-requests/${playerId}/remarks/${remarkId}`,
        { method: "DELETE" },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Failed to delete remark.");
      return payload as { message?: string };
    },
    onSuccess: (payload) => {
      toast.success(payload.message ?? "Remark deleted.");
      if (editingRemark) {
        setEditingRemark(null);
        setDraftText("");
      }
      invalidate();
    },
    onError: (deleteError) => {
      toast.error(deleteError instanceof Error ? deleteError.message : "Failed to delete remark.");
    },
  });

  const confirmDelete = async (remark: DgroupRemarkItem) => {
    const result = await Swal.fire({
      title: "Delete remark?",
      text: "This remark will be removed permanently.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      ...deleteAlertOptions,
    });
    if (result.isConfirmed) {
      deleteMutation.mutate(remark.id);
    }
  };

  const remarks = data?.remarks ?? [];
  const isSaving = saveMutation.isPending || deleteMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-amber-600" aria-hidden />
            D-group remarks
          </DialogTitle>
          <DialogDescription>
            Private follow-up notes for {playerName}. Players cannot see these remarks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2 rounded-xl border border-border/70 bg-muted/5 p-4">
            <Label htmlFor="dgroup-remark-draft">
              {editingRemark ? "Edit remark" : "Add remark"}
            </Label>
            <Textarea
              id="dgroup-remark-draft"
              value={draftText}
              maxLength={MAX_DGROUP_REMARK_LENGTH}
              rows={4}
              placeholder="Add a follow-up note about this D-group request…"
              className="min-h-[6rem] resize-y"
              onChange={(event) => setDraftText(event.target.value)}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground tabular-nums">
                {draftText.length}/{MAX_DGROUP_REMARK_LENGTH}
              </p>
              <div className="flex gap-2">
                {editingRemark ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isSaving}
                    onClick={() => {
                      setEditingRemark(null);
                      setDraftText("");
                    }}
                  >
                    Cancel edit
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  disabled={isSaving || !draftText.trim()}
                  onClick={() => saveMutation.mutate()}
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      Saving…
                    </>
                  ) : editingRemark ? (
                    "Update remark"
                  ) : (
                    "Add remark"
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Saved remarks</p>
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Loading remarks…
              </div>
            ) : error ? (
              <p className="text-sm text-destructive">
                {error instanceof Error ? error.message : "Failed to load remarks."}
              </p>
            ) : remarks.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                No remarks yet.
              </p>
            ) : (
              <div className="space-y-2">
                {remarks.map((remark) => (
                  <div
                    key={remark.id}
                    className="rounded-xl border border-border/70 bg-background/60 p-3"
                  >
                    <p className="whitespace-pre-wrap text-sm text-foreground">{remark.text}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(remark.updatedAt), { addSuffix: true })}
                      </p>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isSaving}
                          onClick={() => {
                            setEditingRemark(remark);
                            setDraftText(remark.text);
                          }}
                        >
                          <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={isSaving}
                          onClick={() => void confirmDelete(remark)}
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
