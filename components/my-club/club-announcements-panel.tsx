"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Archive, ArchiveRestore, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { ClubAnnouncementItem } from "@/lib/club-announcements-shared";
import {
  MAX_CLUB_ANNOUNCEMENT_BODY_LENGTH,
  MAX_CLUB_ANNOUNCEMENT_TITLE_LENGTH,
} from "@/lib/club-announcements-shared";
import { formatAppDateTime } from "@/lib/format-datetime";
import { cn } from "@/lib/utils";

const alertOptions = {
  background: "#0f172a",
  color: "#e2e8f0",
  confirmButtonColor: "#ef4444",
  cancelButtonColor: "#64748b",
};

type AnnouncementFormState = {
  title: string;
  body: string;
  isPublished: boolean;
};

const emptyForm: AnnouncementFormState = {
  title: "",
  body: "",
  isPublished: true,
};

type AnnouncementStatusFilter = "draft" | "published" | "archived";

function wasUpdatedAfterCreate(createdAt: string, updatedAt: string) {
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 60_000;
}

function AnnouncementList({
  announcements,
  deletePending,
  archivePending,
  isArchivedView = false,
  onEdit,
  onDelete,
  onArchive,
  onRestore,
}: {
  announcements: ClubAnnouncementItem[];
  deletePending: boolean;
  archivePending: boolean;
  isArchivedView?: boolean;
  onEdit: (announcement: ClubAnnouncementItem) => void;
  onDelete: (announcement: ClubAnnouncementItem) => void;
  onArchive: (announcement: ClubAnnouncementItem) => void;
  onRestore: (announcement: ClubAnnouncementItem) => void;
}) {
  if (announcements.length === 0) {
    return (
      <Card className="glass-panel border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <Megaphone className="h-10 w-10 text-muted-foreground/70" aria-hidden />
          <div>
            <p className="font-medium text-foreground">
              {isArchivedView ? "No archived announcements" : "No announcements in this view"}
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {isArchivedView
                ? "Archived announcements will appear here after you archive them."
                : "Try another filter or create a new announcement."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {announcements.map((announcement) => (
        <Card key={announcement.id} className="glass-panel overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg">{announcement.title}</CardTitle>
                {isArchivedView ? (
                  <Badge variant="outline" className="bg-muted/40 text-muted-foreground">
                    Archived
                  </Badge>
                ) : (
                  <Badge
                    variant={announcement.isPublished ? "secondary" : "outline"}
                    className={cn(
                      announcement.isPublished &&
                        "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                    )}
                  >
                    {announcement.isPublished ? "Published" : "Draft"}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Created {formatAppDateTime(announcement.createdAt)}
                {!isArchivedView && wasUpdatedAfterCreate(announcement.createdAt, announcement.updatedAt) ? (
                  <>
                    {" "}
                    · Updated{" "}
                    {formatDistanceToNow(new Date(announcement.updatedAt), { addSuffix: true })}
                  </>
                ) : null}
                {isArchivedView && announcement.archivedAt ? (
                  <> · Archived {formatAppDateTime(announcement.archivedAt)}</>
                ) : null}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              {isArchivedView ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Restore ${announcement.title}`}
                  disabled={archivePending}
                  onClick={() => void onRestore(announcement)}
                >
                  <ArchiveRestore className="h-4 w-4" />
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Edit ${announcement.title}`}
                    onClick={() => onEdit(announcement)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Archive ${announcement.title}`}
                    disabled={archivePending}
                    onClick={() => void onArchive(announcement)}
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                aria-label={`Delete ${announcement.title}`}
                disabled={deletePending}
                onClick={() => void onDelete(announcement)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {announcement.body}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AnnouncementEditorDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: AnnouncementFormState;
  onSubmit: (values: AnnouncementFormState) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState(initial);

  useEffect(() => {
    if (open) setForm(initial);
  }, [open, initial]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onOpenChange(false);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial.title ? "Edit announcement" : "New announcement"}</DialogTitle>
          <DialogDescription>
            Share updates with your club. Published announcements are visible to your team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <Label htmlFor="announcement-title">Title</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {form.title.length}/{MAX_CLUB_ANNOUNCEMENT_TITLE_LENGTH}
              </span>
            </div>
            <Input
              id="announcement-title"
              value={form.title}
              maxLength={MAX_CLUB_ANNOUNCEMENT_TITLE_LENGTH}
              disabled={isPending}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <Label htmlFor="announcement-body">Message</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {form.body.length}/{MAX_CLUB_ANNOUNCEMENT_BODY_LENGTH}
              </span>
            </div>
            <Textarea
              id="announcement-body"
              value={form.body}
              rows={6}
              maxLength={MAX_CLUB_ANNOUNCEMENT_BODY_LENGTH}
              disabled={isPending}
              className="min-h-[9rem] border-border bg-background shadow-sm"
              onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Published</p>
              <p className="text-xs text-muted-foreground">Drafts stay private until published.</p>
            </div>
            <Checkbox
              checked={form.isPublished}
              disabled={isPending}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, isPublished: checked === true }))
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending || !form.title.trim() || !form.body.trim()}
            onClick={() => onSubmit(form)}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save announcement"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClubAnnouncementsPanel({ embedded = false }: { embedded?: boolean }) {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ClubAnnouncementItem | null>(null);
  const [draft, setDraft] = useState<AnnouncementFormState>(emptyForm);
  const [statusFilter, setStatusFilter] = useState<AnnouncementStatusFilter>("published");

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-club-announcements"],
    queryFn: async () => {
      const response = await fetch("/api/my-club/announcements");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Failed to load announcements.");
      return payload as { announcements: ClubAnnouncementItem[] };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: AnnouncementFormState) => {
      const isEdit = Boolean(editing);
      const response = await fetch(
        isEdit ? `/api/my-club/announcements/${editing!.id}` : "/api/my-club/announcements",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Failed to save announcement.");
      return payload;
    },
    onSuccess: (payload) => {
      toast.success(payload.message ?? "Announcement saved.");
      queryClient.invalidateQueries({ queryKey: ["my-club-announcements"] });
      setEditorOpen(false);
      setEditing(null);
      setDraft(emptyForm);
    },
    onError: (saveError) => {
      toast.error(saveError instanceof Error ? saveError.message : "Failed to save announcement.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/my-club/announcements/${id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Failed to delete announcement.");
      return payload;
    },
    onSuccess: (payload) => {
      toast.success(payload.message ?? "Announcement deleted.");
      queryClient.invalidateQueries({ queryKey: ["my-club-announcements"] });
    },
    onError: (deleteError) => {
      toast.error(deleteError instanceof Error ? deleteError.message : "Failed to delete announcement.");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, isArchived }: { id: string; isArchived: boolean }) => {
      const response = await fetch(`/api/my-club/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "Failed to update announcement.");
      }
      return { ...payload, isArchived };
    },
    onSuccess: (payload) => {
      toast.success(
        payload.isArchived ? "Announcement archived." : "Announcement restored.",
      );
      queryClient.invalidateQueries({ queryKey: ["my-club-announcements"] });
    },
    onError: (archiveError) => {
      toast.error(
        archiveError instanceof Error ? archiveError.message : "Failed to update announcement.",
      );
    },
  });

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyForm);
    setEditorOpen(true);
  };

  const openEdit = (announcement: ClubAnnouncementItem) => {
    setEditing(announcement);
    setDraft({
      title: announcement.title,
      body: announcement.body,
      isPublished: announcement.isPublished,
    });
    setEditorOpen(true);
  };

  const confirmDelete = async (announcement: ClubAnnouncementItem) => {
    const result = await Swal.fire({
      title: "Delete announcement?",
      text: `"${announcement.title}" will be removed permanently.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      ...alertOptions,
    });
    if (result.isConfirmed) deleteMutation.mutate(announcement.id);
  };

  const confirmArchive = async (announcement: ClubAnnouncementItem) => {
    const result = await Swal.fire({
      title: "Archive announcement?",
      html: `<strong>${announcement.title}</strong> will be hidden from players and moved to your archive.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Archive",
      confirmButtonColor: "#64748b",
      cancelButtonColor: "#475569",
      background: "#0f172a",
      color: "#e2e8f0",
    });
    if (result.isConfirmed) {
      archiveMutation.mutate({ id: announcement.id, isArchived: true });
    }
  };

  const confirmRestore = async (announcement: ClubAnnouncementItem) => {
    const result = await Swal.fire({
      title: "Restore announcement?",
      text: `"${announcement.title}" will return to your active announcements list.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Restore",
      confirmButtonColor: "#22c55e",
      cancelButtonColor: "#64748b",
      background: "#0f172a",
      color: "#e2e8f0",
    });
    if (result.isConfirmed) {
      archiveMutation.mutate({ id: announcement.id, isArchived: false });
    }
  };

  const announcements = data?.announcements ?? [];
  const activeAnnouncements = announcements.filter((item) => !item.isArchived);
  const archivedAnnouncements = announcements.filter((item) => item.isArchived);
  const draftAnnouncements = activeAnnouncements.filter((item) => !item.isPublished);
  const publishedAnnouncements = activeAnnouncements.filter((item) => item.isPublished);
  const filteredAnnouncements =
    statusFilter === "archived"
      ? archivedAnnouncements
      : statusFilter === "draft"
        ? draftAnnouncements
        : publishedAnnouncements;
  const hasAnyAnnouncements = announcements.length > 0;

  return (
    <div className={cn("space-y-5", embedded && "my-club-tab-content")}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          {!embedded ? (
            <>
              <h2 className="section-title">Announcements</h2>
              <p className="caption mt-1">Create and manage club-wide updates for your community.</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">Manage announcements</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Post updates for schedules, fellowship notes, or open-play reminders.
              </p>
            </>
          )}
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          New announcement
        </Button>
      </div>

      {isLoading ? (
        <div className="flex min-h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
          Loading announcements…
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load announcements."}
        </p>
      ) : !hasAnyAnnouncements ? (
        <Card className="glass-panel border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Megaphone className="h-10 w-10 text-muted-foreground/70" aria-hidden />
            <div>
              <p className="font-medium text-foreground">No announcements yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Post your first update — training schedules, fellowship notes, or open-play reminders.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={openCreate}>
              Create announcement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as AnnouncementStatusFilter)}
          className="gap-4"
        >
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/40 p-1 sm:w-auto">
            <TabsTrigger value="published" className="gap-1.5 px-3">
              Published
              {publishedAnnouncements.length > 0 ? (
                <Badge variant="secondary" className="px-1.5 py-0 text-xs tabular-nums">
                  {publishedAnnouncements.length}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="draft" className="gap-1.5 px-3">
              Draft
              {draftAnnouncements.length > 0 ? (
                <Badge variant="secondary" className="px-1.5 py-0 text-xs tabular-nums">
                  {draftAnnouncements.length}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="archived" className="gap-1.5 px-3">
              Archived
              {archivedAnnouncements.length > 0 ? (
                <Badge variant="secondary" className="px-1.5 py-0 text-xs tabular-nums">
                  {archivedAnnouncements.length}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={statusFilter} className="mt-0 outline-none">
            <AnnouncementList
              announcements={filteredAnnouncements}
              deletePending={deleteMutation.isPending}
              archivePending={archiveMutation.isPending}
              isArchivedView={statusFilter === "archived"}
              onEdit={openEdit}
              onDelete={confirmDelete}
              onArchive={confirmArchive}
              onRestore={confirmRestore}
            />
          </TabsContent>
        </Tabs>
      )}

      <AnnouncementEditorDialog
        key={editing?.id ?? "new"}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={draft}
        isPending={saveMutation.isPending}
        onSubmit={(values) => saveMutation.mutate(values)}
      />
    </div>
  );
}
