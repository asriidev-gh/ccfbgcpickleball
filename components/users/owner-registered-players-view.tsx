"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Ban, CalendarDays, Loader2, QrCode, RefreshCw, Search, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { toast } from "sonner";

import { PlayerAvatar } from "@/components/game/player-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OwnerPlayerDetailsDialog } from "@/components/users/owner-player-details-dialog";
import { OwnerPlayerQrDialog } from "@/components/users/owner-player-qr-dialog";
import { OwnerSessionFilterSelect } from "@/components/users/owner-session-filter-select";
import { SimpleTooltip } from "@/components/ui/tooltip";
import type {
  OwnerPlayerSessions,
  OwnerRegisteredPlayerItem,
  OwnerRegisteredPlayersPage,
} from "@/lib/owner-registered-players-shared";
import { cn } from "@/lib/utils";

const alertOptions = {
  background: "#0f172a",
  color: "#e2e8f0",
  confirmButtonColor: "#ef4444",
  cancelButtonColor: "#64748b",
};

function formatSessionDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function WelcomeEmailStatusCell({
  player,
  onShowError,
  onResend,
  isResending,
}: {
  player: OwnerRegisteredPlayerItem;
  onShowError: (player: OwnerRegisteredPlayerItem) => void;
  onResend: (playerId: string) => void;
  isResending: boolean;
}) {
  if (player.welcomeEmailStatus === "success") {
    return (
      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700">
        Success
      </Badge>
    );
  }

  if (player.welcomeEmailStatus === "failed") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={() => onShowError(player)}
          aria-label={`View welcome email error for ${player.name}`}
        >
          <Badge variant="destructive">Failed</Badge>
        </button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          disabled={isResending}
          onClick={() => onResend(player.id)}
          aria-label={`Resend welcome email to ${player.name}`}
        >
          {isResending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          )}
          Resend
        </Button>
      </div>
    );
  }

  if (player.welcomeEmailStatus === "skipped") {
    return (
      <button
        type="button"
        className="inline-flex cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={() => onShowError(player)}
        aria-label={`View welcome email skip reason for ${player.name}`}
      >
        <Badge variant="outline">Skipped</Badge>
      </button>
    );
  }

  return <span className="text-muted-foreground">—</span>;
}

function OwnerPlayerSessionsDialog({
  player,
  onClose,
}: {
  player: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["owner-player-sessions", player?.id],
    enabled: Boolean(player),
    queryFn: async () => {
      const response = await fetch(
        `/api/owner/registered-players/${player!.id}/sessions`,
      );
      const payload = (await response.json()) as OwnerPlayerSessions & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to load sessions.");
      return payload;
    },
  });

  return (
    <Dialog open={Boolean(player)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{player?.name ?? "Player"} · Sessions</DialogTitle>
          <DialogDescription>
            Open play sessions you created that this player registered for.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {isLoading ? (
            <p className="flex items-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading sessions…
            </p>
          ) : isError ? (
            <p className="py-6 text-destructive">Failed to load sessions.</p>
          ) : !data || data.sessions.length === 0 ? (
            <p className="py-6 text-muted-foreground">No sessions found for this player.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.sessions.map((session) => (
                <li key={session.gameId} className="surface-muted rounded-xl border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium leading-tight">{session.title}</p>
                      <p className="caption text-muted-foreground">
                        {session.openPlayType} · {session.courtCount}{" "}
                        {session.courtCount === 1 ? "court" : "courts"}
                      </p>
                      <p className="caption capitalize text-muted-foreground">
                        {session.status}
                        {session.queueStatus ? ` · ${session.queueStatus.replace("_", " ")}` : ""}
                      </p>
                      <p className="caption text-muted-foreground" suppressHydrationWarning>
                        Registered {formatSessionDate(session.registeredAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 text-sm tabular-nums">
                      <Badge
                        variant="secondary"
                        className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      >
                        {session.wins}W
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="bg-rose-500/15 text-rose-600 dark:text-rose-400"
                      >
                        {session.losses}L
                      </Badge>
                    </div>
                  </div>
                  <p className="caption mt-2 text-muted-foreground">
                    {session.gamesPlayed} {session.gamesPlayed === 1 ? "match" : "matches"} played
                    {session.gamesPlayed > 0 ? ` · ${session.winRate}% win rate` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getPaginationItems(page: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 1) return [1];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: Array<number | "ellipsis"> = [1];
  if (page > 3) items.push("ellipsis");

  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    items.push(pageNumber);
  }

  if (page < totalPages - 2) items.push("ellipsis");
  items.push(totalPages);
  return items;
}

function RegisteredPlayersPagination({
  page,
  totalPages,
  total,
  pageSize,
  disabled,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  disabled?: boolean;
  onPageChange: (page: number) => void;
}) {
  if (total === 0) return null;

  const safeTotalPages = Math.max(1, totalPages);
  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const pageItems = getPaginationItems(page, safeTotalPages);

  return (
    <nav
      className="flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Registered players pagination"
    >
      <p className="text-sm text-muted-foreground tabular-nums">
        Showing {rangeStart}–{rangeEnd} of {total}
        <span className="hidden sm:inline">
          {" "}
          · Page {page} of {safeTotalPages}
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>

        <div className="flex items-center gap-1">
          {pageItems.map((item, index) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="px-1 text-sm text-muted-foreground"
                aria-hidden
              >
                …
              </span>
            ) : (
              <Button
                key={item}
                type="button"
                variant={item === page ? "default" : "outline"}
                size="sm"
                className="min-w-9 px-2 tabular-nums"
                disabled={disabled || item === page}
                aria-label={`Go to page ${item}`}
                aria-current={item === page ? "page" : undefined}
                onClick={() => onPageChange(item)}
              >
                {item}
              </Button>
            ),
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || page >= safeTotalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}

export function OwnerRegisteredPlayersView() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sessionGameId, setSessionGameId] = useState("");
  const [page, setPage] = useState(1);
  const [sessionsPlayer, setSessionsPlayer] = useState<{ id: string; name: string } | null>(null);
  const [detailsPlayer, setDetailsPlayer] = useState<{ id: string; name: string } | null>(null);
  const [qrPlayer, setQrPlayer] = useState<{ id: string; name: string } | null>(null);
  const [emailErrorPlayer, setEmailErrorPlayer] = useState<OwnerRegisteredPlayerItem | null>(null);

  const { data: authData } = useQuery({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me");
      if (!response.ok) return null;
      return (await response.json()) as {
        user: { name: string; isSuperAdmin?: boolean } | null;
      };
    },
    staleTime: 60_000,
  });
  const isSuperAdmin = Boolean(authData?.user?.isSuperAdmin);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const { data: sessionOptionsData, isLoading: sessionOptionsLoading } = useQuery({
    queryKey: ["owner-session-filter-options"],
    queryFn: async () => {
      const response = await fetch("/api/owner/registered-players/session-options");
      const payload = (await response.json()) as {
        sessions: import("@/lib/owner-session-filter-options-shared").OwnerSessionFilterOption[];
        message?: string;
      };
      if (!response.ok) throw new Error(payload.message ?? "Failed to load sessions.");
      return payload;
    },
    staleTime: 60_000,
  });

  const sessionOptions = sessionOptionsData?.sessions ?? [];

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["owner-registered-players", page, debouncedSearch, sessionGameId],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
      });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (sessionGameId) params.set("gameId", sessionGameId);

      const response = await fetch(`/api/owner/registered-players?${params.toString()}`);
      const payload = (await response.json()) as OwnerRegisteredPlayersPage & {
        count: number;
        message?: string;
      };
      if (!response.ok) throw new Error(payload.message ?? "Failed to load registered players.");
      if (payload.page !== page) setPage(payload.page);
      return payload;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/owner/registered-players/${id}`, { method: "DELETE" });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to remove player.");
      return payload;
    },
    onSuccess: (payload) => {
      toast.success(payload.message ?? "Player removed.");
      queryClient.invalidateQueries({ queryKey: ["owner-registered-players"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to remove player.");
    },
  });

  const blockMutation = useMutation({
    mutationFn: async ({ id, blocked }: { id: string; blocked: boolean }) => {
      const response = await fetch(`/api/owner/registered-players/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocked }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to update block status.");
      return payload;
    },
    onSuccess: (payload) => {
      toast.success(payload.message ?? "Block status updated.");
      queryClient.invalidateQueries({ queryKey: ["owner-registered-players"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update block status.");
    },
  });

  const retryWelcomeEmailMutation = useMutation({
    mutationFn: async (playerId: string) => {
      const response = await fetch(
        `/api/owner/registered-players/${encodeURIComponent(playerId)}/welcome-email`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        message?: string;
        emailSent?: boolean;
        welcomeEmailStatus?: OwnerRegisteredPlayerItem["welcomeEmailStatus"];
        welcomeEmailError?: string;
        welcomeEmailSentAt?: string | null;
      };
      if (!response.ok) throw new Error(payload.message ?? "Failed to resend welcome email.");
      return payload;
    },
    onSuccess: (payload, playerId) => {
      if (payload.emailSent) {
        toast.success(payload.message ?? "Welcome email sent.");
        setEmailErrorPlayer(null);
      } else {
        toast.error(payload.message ?? "Welcome email could not be sent.");
        setEmailErrorPlayer((current) =>
          current?.id === playerId
            ? {
                ...current,
                welcomeEmailStatus: payload.welcomeEmailStatus ?? "failed",
                welcomeEmailError: payload.welcomeEmailError ?? current.welcomeEmailError,
                welcomeEmailSentAt: payload.welcomeEmailSentAt ?? current.welcomeEmailSentAt,
              }
            : current,
        );
      }
      queryClient.invalidateQueries({ queryKey: ["owner-registered-players"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to resend welcome email.");
    },
  });

  const handleDelete = async (player: OwnerRegisteredPlayerItem) => {
    const result = await Swal.fire({
      ...alertOptions,
      title: "Remove player?",
      html: `<strong>${player.name}</strong> (${player.email}) will be removed from <strong>all of your open play sessions</strong>. Match and queue records in your games will be deleted.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, remove",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;
    deleteMutation.mutate(player.id);
  };

  const handleBlockToggle = async (player: OwnerRegisteredPlayerItem) => {
    const blocking = !player.isBlocked;
    const result = await Swal.fire({
      ...alertOptions,
      title: blocking ? "Block player?" : "Unblock player?",
      html: blocking
        ? `<strong>${player.name}</strong> (${player.email}) will not be able to register for your future open plays.`
        : `<strong>${player.name}</strong> (${player.email}) will be allowed to register for your open plays again.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: blocking ? "Yes, block" : "Yes, unblock",
      cancelButtonText: "Cancel",
      confirmButtonColor: blocking ? "#ef4444" : "#22c55e",
    });
    if (!result.isConfirmed) return;
    blockMutation.mutate({ id: player.id, blocked: blocking });
  };

  const players = data?.players ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const currentPage = data?.page ?? page;

  const countLabel = debouncedSearch || sessionGameId ? `${total} matching` : String(total);
  const hasActiveFilters = Boolean(debouncedSearch || sessionGameId);

  const pendingDeleteId = deleteMutation.isPending ? deleteMutation.variables : null;
  const pendingBlockId = blockMutation.isPending ? blockMutation.variables?.id : null;
  const pendingResendId = retryWelcomeEmailMutation.isPending
    ? retryWelcomeEmailMutation.variables
    : null;

  return (
    <Card className="glass-panel">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="section-title text-base font-medium text-muted-foreground">
            Player list
          </CardTitle>
          <Badge variant="secondary" className="tabular-nums">
            {countLabel} {total === 1 ? "player" : "players"}
          </Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Filter by name, email, or mobile…"
              className="pl-9"
              aria-label="Filter registered players"
            />
          </div>
          <OwnerSessionFilterSelect
            sessions={sessionOptions}
            value={sessionGameId}
            loading={sessionOptionsLoading}
            disabled={isLoading}
            onChange={(gameId) => {
              setSessionGameId(gameId);
              setPage(1);
            }}
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="flex items-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading registered players…
          </p>
        ) : isError ? (
          <p className="py-6 text-destructive">Failed to load registered players.</p>
        ) : total === 0 && !hasActiveFilters ? (
          <div className="space-y-4 py-6 text-muted-foreground">
            <p>No players have registered in your open play sessions yet.</p>
            <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "inline-flex")}>
              Back to dashboard
            </Link>
          </div>
        ) : total === 0 ? (
          <p className="py-6 text-muted-foreground">
            {sessionGameId
              ? "No players registered for this session match your filters."
              : "No players match your search."}
          </p>
        ) : (
          <>
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                {isSuperAdmin ? <TableHead>Email status</TableHead> : null}
                <TableHead>Mobile</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead>Last registered</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((player) => (
                <TableRow key={`${player.id}-${player.email}`}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <PlayerAvatar
                        player={{
                          _id: player.id,
                          firstName: player.firstName,
                          lastName: player.lastName,
                          photoUrl: player.photoUrl,
                          photoPublicId: player.photoPublicId,
                          personalQrCode: player.personalQrCode,
                        }}
                        size="sm"
                        className="!size-8 sm:!size-8"
                      />
                      <div className="min-w-0">
                        <button
                          type="button"
                          className="cursor-pointer font-medium text-left text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                          onClick={() => setDetailsPlayer({ id: player.id, name: player.name })}
                        >
                          {player.name}
                        </button>
                        {player.isBlocked ? (
                          <Badge variant="destructive" className="ml-2 align-middle text-[0.625rem]">
                            Blocked
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{player.email}</TableCell>
                  {isSuperAdmin ? (
                    <TableCell>
                      <WelcomeEmailStatusCell
                        player={player}
                        onShowError={setEmailErrorPlayer}
                        onResend={(playerId) => retryWelcomeEmailMutation.mutate(playerId)}
                        isResending={pendingResendId === player.id}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className="text-muted-foreground">{player.mobileNumber}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-8 gap-1.5 px-2 font-medium text-primary hover:text-primary"
                      onClick={() => setSessionsPlayer({ id: player.id, name: player.name })}
                    >
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                      {player.sessionsCount}
                    </Button>
                  </TableCell>
                  <TableCell className="text-muted-foreground" suppressHydrationWarning>
                    {player.lastRegisteredAt
                      ? formatDistanceToNow(new Date(player.lastRegisteredAt), {
                          addSuffix: true,
                        })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center justify-end gap-1">
                      <SimpleTooltip label="Show QR code">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-primary hover:bg-primary/10 hover:text-primary"
                          aria-label={`Show QR code for ${player.name}`}
                          onClick={() => setQrPlayer({ id: player.id, name: player.name })}
                        >
                          <QrCode className="h-4 w-4" aria-hidden />
                        </Button>
                      </SimpleTooltip>
                      <SimpleTooltip
                        label={
                          player.isBlocked
                            ? "Unblock player — allow registration again"
                            : "Block player from your open plays"
                        }
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "size-8",
                            player.isBlocked
                              ? "text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600"
                              : "text-amber-600 hover:bg-amber-500/10 hover:text-amber-600",
                          )}
                          aria-label={
                            player.isBlocked ? `Unblock ${player.name}` : `Block ${player.name}`
                          }
                          disabled={pendingBlockId === player.id}
                          onClick={() => handleBlockToggle(player)}
                        >
                          {pendingBlockId === player.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : player.isBlocked ? (
                            <ShieldCheck className="h-4 w-4" aria-hidden />
                          ) : (
                            <Ban className="h-4 w-4" aria-hidden />
                          )}
                        </Button>
                      </SimpleTooltip>
                      <SimpleTooltip label="Remove player from all your open plays">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Remove ${player.name}`}
                          disabled={pendingDeleteId === player.id}
                          onClick={() => handleDelete(player)}
                        >
                          {pendingDeleteId === player.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            <Trash2 className="h-4 w-4" aria-hidden />
                          )}
                        </Button>
                      </SimpleTooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <RegisteredPlayersPagination
            page={currentPage}
            totalPages={totalPages}
            total={total}
            pageSize={data?.pageSize ?? 10}
            disabled={isFetching}
            onPageChange={setPage}
          />
          </>
        )}
      </CardContent>

      <OwnerPlayerSessionsDialog
        player={sessionsPlayer}
        onClose={() => setSessionsPlayer(null)}
      />
      <OwnerPlayerDetailsDialog
        player={detailsPlayer}
        onClose={() => setDetailsPlayer(null)}
      />
      <OwnerPlayerQrDialog player={qrPlayer} onClose={() => setQrPlayer(null)} />
      {isSuperAdmin ? (
      <Dialog
        open={Boolean(emailErrorPlayer)}
        onOpenChange={(open) => {
          if (!open) setEmailErrorPlayer(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Welcome email failed</DialogTitle>
            <DialogDescription>
              {emailErrorPlayer?.name} · {emailErrorPlayer?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 leading-relaxed text-destructive">
              {emailErrorPlayer?.welcomeEmailError?.trim() || "Unknown error."}
            </p>
            {emailErrorPlayer?.welcomeEmailSentAt ? (
              <p className="text-muted-foreground">
                Attempted {formatSessionDate(emailErrorPlayer.welcomeEmailSentAt)}
              </p>
            ) : null}
          </div>
          {emailErrorPlayer?.welcomeEmailStatus === "failed" ? (
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEmailErrorPlayer(null)}
                disabled={retryWelcomeEmailMutation.isPending}
              >
                Close
              </Button>
              <Button
                type="button"
                disabled={retryWelcomeEmailMutation.isPending}
                onClick={() => {
                  if (!emailErrorPlayer) return;
                  retryWelcomeEmailMutation.mutate(emailErrorPlayer.id);
                }}
              >
                {retryWelcomeEmailMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Sending…
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
                    Retry email
                  </>
                )}
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
      ) : null}
    </Card>
  );
}
