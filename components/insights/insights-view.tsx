"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  CalendarPlus,
  Gamepad2,
  LayoutGrid,
  Loader2,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Trophy,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import Swal from "sweetalert2";
import { toast } from "sonner";

import { PlayerAvatar } from "@/components/game/player-avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  USER_FILTERS,
  type PlayerGameHistory,
  type PlayerListItem,
  type UserInsights,
  type UserListFilter,
  type UserListItem,
  type UserOpenPlays,
} from "@/lib/insights-shared";
import { cn } from "@/lib/utils";

type UserSelection =
  | { type: "filter"; filter: UserListFilter }
  | { type: "month"; month: string; label: string };

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: string;
  onClick?: () => void;
}) {
  const interactive = Boolean(onClick);
  return (
    <Card
      className={cn(
        "glass-panel",
        interactive && "cursor-pointer transition-shadow hover:shadow-md hover:ring-1 hover:ring-primary/40",
      )}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <CardContent className="flex items-center gap-4 p-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-semibold leading-tight">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
          {hint ? <p className="text-xs text-muted-foreground/80">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function BarRow({
  label,
  value,
  max,
  onClick,
}: {
  label: string;
  value: number;
  max: number;
  onClick?: () => void;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const interactive = Boolean(onClick);
  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={onClick}
      className={cn(
        "w-full space-y-1 rounded-md text-left",
        interactive && "cursor-pointer rounded-md p-1.5 -m-1.5 transition-colors hover:bg-muted/50",
      )}
    >
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/50">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.max(pct, value > 0 ? 4 : 0)}%` }}
        />
      </div>
    </button>
  );
}

const deleteAlertOptions = {
  background: "#0f172a",
  color: "#e2e8f0",
  confirmButtonColor: "#ef4444",
  cancelButtonColor: "#64748b",
};

function SignupsBarGraph({
  data,
  max,
  onSelectMonth,
}: {
  data: { key: string; label: string; count: number }[];
  max: number;
  onSelectMonth: (key: string, label: string) => void;
}) {
  const tickCount = 4;
  const niceMax = Math.max(tickCount, Math.ceil(max / tickCount) * tickCount);
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((niceMax / tickCount) * (tickCount - i)),
  );

  return (
    <div className="flex gap-2">
      <div className="flex h-48 w-7 flex-col justify-between py-1 text-right text-[10px] tabular-nums text-muted-foreground">
        {ticks.map((tick) => (
          <span key={tick} className="leading-none">
            {tick}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative h-48">
          <div className="absolute inset-0 flex flex-col justify-between">
            {ticks.map((tick, index) => (
              <div
                key={tick}
                className={cn(
                  "h-px w-full",
                  index === ticks.length - 1 ? "bg-border" : "bg-border/40",
                )}
              />
            ))}
          </div>
          <div className="absolute inset-0 flex items-end justify-between gap-2 px-1">
            {data.map((month) => {
              const heightPct = niceMax > 0 ? (month.count / niceMax) * 100 : 0;
              return (
                <button
                  key={month.label}
                  type="button"
                  onClick={() => onSelectMonth(month.key, month.label)}
                  className="group flex h-full flex-1 cursor-pointer flex-col items-center justify-end rounded-md focus-visible:outline-1 focus-visible:outline-ring"
                  title={`View ${month.count} signup${month.count === 1 ? "" : "s"} in ${month.label}`}
                >
                  <span className="mb-1 text-xs font-medium tabular-nums text-foreground/80">
                    {month.count}
                  </span>
                  <div
                    className="w-full max-w-12 rounded-t-md bg-primary transition-all group-hover:bg-primary/70"
                    style={{ height: `${Math.max(heightPct, month.count > 0 ? 3 : 0)}%` }}
                  />
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-2 flex justify-between gap-2 px-1">
          {data.map((month) => (
            <span
              key={month.label}
              className="flex-1 text-center text-xs text-muted-foreground"
            >
              {month.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function UserOpenPlaysDialog({
  user,
  onClose,
}: {
  user: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["user-open-plays", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const response = await fetch(`/api/insights/users/${user!.id}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      return payload as UserOpenPlays;
    },
  });

  return (
    <Dialog open={Boolean(user)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{user?.name ?? "User"} · Open plays created</DialogTitle>
          <DialogDescription>
            Open plays this user created (demo open plays excluded).
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {isLoading ? (
            <p className="flex items-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading open plays…
            </p>
          ) : isError ? (
            <p className="py-6 text-destructive">Failed to load open plays.</p>
          ) : !data || data.games.length === 0 ? (
            <p className="py-6 text-muted-foreground">This user hasn&apos;t created any open plays yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.games.map((game) => (
                <li key={game.gameId} className="surface-muted rounded-xl border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium leading-tight">{game.title}</p>
                      <p className="caption capitalize text-muted-foreground" suppressHydrationWarning>
                        {game.status} · {formatDate(game.createdAt)}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {game.openPlayType}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    <Badge variant="outline" className="gap-1">
                      <Users className="h-3 w-3" aria-hidden />
                      {game.playerCount} {game.playerCount === 1 ? "player" : "players"}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <LayoutGrid className="h-3 w-3" aria-hidden />
                      {game.courtCount} {game.courtCount === 1 ? "court" : "courts"}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UserListPanel({ selection, onSelectFilter }: {
  selection: UserSelection;
  onSelectFilter: (filter: UserListFilter) => void;
}) {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);

  const queryUrl =
    selection.type === "month"
      ? `/api/insights/users?month=${selection.month}`
      : `/api/insights/users?filter=${selection.filter}`;
  const queryKey =
    selection.type === "month"
      ? ["insights-users", "month", selection.month]
      : ["insights-users", "filter", selection.filter];

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await fetch(queryUrl);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      return payload as { count: number; users: UserListItem[] };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/insights/users/${id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      return payload as { message: string };
    },
    onSuccess: (payload) => {
      toast.success(payload.message);
      queryClient.invalidateQueries({ queryKey: ["insights-users"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete user.");
    },
  });

  const handleDelete = async (user: UserListItem) => {
    const result = await Swal.fire({
      ...deleteAlertOptions,
      title: "Delete user?",
      html: `<strong>${user.name}</strong> (${user.email}) will be permanently removed.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;
    deleteMutation.mutate(user.id);
  };

  return (
    <Card className="glass-panel">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="section-title text-xl">User List</CardTitle>
          <Badge variant="secondary" className="tabular-nums">
            {data?.count ?? 0} {data?.count === 1 ? "user" : "users"}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {USER_FILTERS.map((option) => (
            <Button
              key={option.id}
              type="button"
              size="sm"
              variant={
                selection.type === "filter" && selection.filter === option.id
                  ? "default"
                  : "outline"
              }
              onClick={() => onSelectFilter(option.id)}
            >
              {option.label}
            </Button>
          ))}
          {selection.type === "month" ? (
            <Button type="button" size="sm" variant="default" onClick={() => onSelectFilter("all")}>
              Signed up in {selection.label}
              <X className="ml-1 h-3.5 w-3.5" aria-hidden />
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="flex items-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading users…
          </p>
        ) : isError ? (
          <p className="py-6 text-destructive">Failed to load users.</p>
        ) : !data || data.users.length === 0 ? (
          <p className="py-6 text-muted-foreground">No users match this filter.</p>
        ) : (
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Sign-in</TableHead>
                <TableHead>Registered on</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead>Last device</TableHead>
                <TableHead className="text-right">Open Play Count</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.userType === "ccf" ? "default" : "secondary"}>
                      {user.userType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.hasGoogle ? "Google" : "Password"}
                  </TableCell>
                  <TableCell className="max-w-[12rem] truncate text-muted-foreground" title={user.registeredDevice ?? undefined}>
                    {user.registeredDevice ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground" suppressHydrationWarning>
                    {formatDate(user.lastLoginAt)}
                  </TableCell>
                  <TableCell className="max-w-[12rem] truncate text-muted-foreground" title={user.lastLoginDevice ?? undefined}>
                    {user.lastLoginDevice ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {user.openPlayCount > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-8 gap-1.5 px-2 font-medium text-primary hover:text-primary"
                        onClick={() => setSelectedUser({ id: user.id, name: user.name })}
                      >
                        <Gamepad2 className="h-3.5 w-3.5" aria-hidden />
                        {user.openPlayCount}
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground" suppressHydrationWarning>
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Delete ${user.name}`}
                      disabled={deleteMutation.isPending && deleteMutation.variables === user.id}
                      onClick={() => handleDelete(user)}
                    >
                      {deleteMutation.isPending && deleteMutation.variables === user.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="h-4 w-4" aria-hidden />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <UserOpenPlaysDialog user={selectedUser} onClose={() => setSelectedUser(null)} />
    </Card>
  );
}

function PlayerGamesDialog({
  player,
  onClose,
}: {
  player: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["player-history", player?.id],
    enabled: Boolean(player),
    queryFn: async () => {
      const response = await fetch(`/api/insights/players/${player!.id}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      return payload as PlayerGameHistory;
    },
  });

  return (
    <Dialog open={Boolean(player)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{player?.name ?? "Player"} · Game history</DialogTitle>
          <DialogDescription>
            Open plays this player joined, with wins, losses, and awards earned.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {isLoading ? (
            <p className="flex items-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading game history…
            </p>
          ) : isError ? (
            <p className="py-6 text-destructive">Failed to load game history.</p>
          ) : !data || data.games.length === 0 ? (
            <p className="py-6 text-muted-foreground">This player hasn&apos;t joined any open plays yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.games.map((game) => (
                <li key={game.gameId} className="surface-muted rounded-xl border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium leading-tight">{game.title}</p>
                      <p className="caption text-muted-foreground">
                        Created by {game.ownerName}
                      </p>
                      <p className="caption capitalize text-muted-foreground" suppressHydrationWarning>
                        {game.status} · {formatDate(game.joinedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 text-sm tabular-nums">
                      <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        {game.wins}W
                      </Badge>
                      <Badge variant="secondary" className="bg-rose-500/15 text-rose-600 dark:text-rose-400">
                        {game.losses}L
                      </Badge>
                    </div>
                  </div>
                  {game.awards.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {game.awards.map((award) => (
                        <Badge key={award.id} variant="outline" className="gap-1">
                          <Award className="h-3 w-3 text-primary" aria-hidden />
                          {award.title}
                          {award.stat ? (
                            <span className="text-muted-foreground">· {award.stat}</span>
                          ) : null}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="caption mt-2 text-muted-foreground">No awards in this session.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlayersPanel() {
  const queryClient = useQueryClient();
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; name: string } | null>(null);
  const [realPlayersOnly, setRealPlayersOnly] = useState(true);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["insights-players", realPlayersOnly],
    queryFn: async () => {
      const response = await fetch(
        `/api/insights/players?realOnly=${realPlayersOnly ? "true" : "false"}`,
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      return payload as { count: number; players: PlayerListItem[] };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/insights/players/${id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      return payload as { message: string };
    },
    onSuccess: (payload) => {
      toast.success(payload.message);
      queryClient.invalidateQueries({ queryKey: ["insights-players"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete player.");
    },
  });

  const handleDelete = async (player: PlayerListItem) => {
    const result = await Swal.fire({
      ...deleteAlertOptions,
      title: "Delete player?",
      html: `<strong>${player.name}</strong> (${player.email}) and all related queue, court, match, and leaderboard records will be permanently removed.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;
    deleteMutation.mutate(player.id);
  };

  return (
    <Card className="glass-panel">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="section-title text-xl">Players Registered</CardTitle>
          <Badge variant="secondary" className="tabular-nums">
            {data?.count ?? 0} {data?.count === 1 ? "player" : "players"}
          </Badge>
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 pt-1">
          <Checkbox
            checked={realPlayersOnly}
            onCheckedChange={(checked) => setRealPlayersOnly(checked === true)}
          />
          <span className="text-sm text-muted-foreground">Real players only</span>
        </label>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="flex items-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading players…
          </p>
        ) : isError ? (
          <p className="py-6 text-destructive">Failed to load players.</p>
        ) : !data || data.players.length === 0 ? (
          <p className="py-6 text-muted-foreground">
            {realPlayersOnly
              ? "No real players registered yet (demo players are hidden)."
              : "No players registered yet."}
          </p>
        ) : (
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead className="text-right">Games Played Count</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.players.map((player) => (
                <TableRow key={player.id}>
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
                      <span className="font-medium">{player.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{player.email}</TableCell>
                  <TableCell className="text-muted-foreground">{player.mobileNumber}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-8 gap-1.5 px-2 font-medium text-primary hover:text-primary"
                      onClick={() => setSelectedPlayer({ id: player.id, name: player.name })}
                    >
                      <Trophy className="h-3.5 w-3.5" aria-hidden />
                      {player.gamesPlayed}
                    </Button>
                  </TableCell>
                  <TableCell className="text-muted-foreground" suppressHydrationWarning>
                    {formatDate(player.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Delete ${player.name}`}
                      disabled={deleteMutation.isPending && deleteMutation.variables === player.id}
                      onClick={() => handleDelete(player)}
                    >
                      {deleteMutation.isPending && deleteMutation.variables === player.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="h-4 w-4" aria-hidden />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <PlayerGamesDialog player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </Card>
  );
}

type InsightsTab = "overview" | "users" | "players";

export function InsightsView({ insights }: { insights: UserInsights }) {
  const [tab, setTab] = useState<InsightsTab>("overview");
  const [selection, setSelection] = useState<UserSelection>({ type: "filter", filter: "all" });

  const { users, games, activity, signupsByMonth, topOwners } = insights;

  const accountTypeMax = Math.max(users.ccf, users.default, 1);
  const accountMethodMax = Math.max(users.googleLinked, users.passwordOnly, 1);
  const signupMax = Math.max(...signupsByMonth.map((m) => m.count), 1);
  const topOwnerMax = Math.max(...topOwners.map((o) => o.games), 1);

  const showUsers = (nextFilter: UserListFilter) => {
    setSelection({ type: "filter", filter: nextFilter });
    setTab("users");
  };

  const showMonth = (month: string, label: string) => {
    setSelection({ type: "month", month, label });
    setTab("users");
  };

  return (
    <main className="min-h-screen px-6 py-6 lg:px-10">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="section-title flex items-center gap-2 text-3xl">
              <TrendingUp className="h-7 w-7 text-primary" aria-hidden />
              Insights
            </h1>
            <p className="text-sm text-muted-foreground">
              User and activity overview across the platform.
            </p>
          </div>
          <Badge variant="secondary" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Superadmin
          </Badge>
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as InsightsTab)}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">User List</TabsTrigger>
            <TabsTrigger value="players">Players Registered</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <StatCard icon={Users} label="Total users" value={users.total} onClick={() => showUsers("all")} />
              <StatCard icon={UserPlus} label="New (7 days)" value={users.newLast7Days} onClick={() => showUsers("new7")} />
              <StatCard icon={CalendarPlus} label="New (30 days)" value={users.newLast30Days} onClick={() => showUsers("new30")} />
              <StatCard icon={Gamepad2} label="Total games" value={games.total} hint={`${games.active} active · ${games.ended} ended`} />
              <StatCard icon={LayoutGrid} label="Players registered" value={activity.playersRegistered} onClick={() => setTab("players")} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle className="section-title text-xl">Accounts by type</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <BarRow label="CCF" value={users.ccf} max={accountTypeMax} onClick={() => showUsers("ccf")} />
                  <BarRow label="Default" value={users.default} max={accountTypeMax} onClick={() => showUsers("default")} />
                  <div className="my-2 h-px bg-border" />
                  <BarRow label="Google-linked" value={users.googleLinked} max={accountMethodMax} onClick={() => showUsers("google")} />
                  <BarRow label="Password only" value={users.passwordOnly} max={accountMethodMax} onClick={() => showUsers("password")} />
                </CardContent>
              </Card>

              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle className="section-title text-xl">New signups (last 6 months)</CardTitle>
                </CardHeader>
                <CardContent>
                  <SignupsBarGraph data={signupsByMonth} max={signupMax} onSelectMonth={showMonth} />
                </CardContent>
              </Card>
            </div>

            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="section-title text-xl">Top organizers by games created</CardTitle>
              </CardHeader>
              <CardContent>
                {topOwners.length === 0 ? (
                  <p className="text-muted-foreground">No games created yet.</p>
                ) : (
                  <div className="space-y-4">
                    {topOwners.map((owner, index) => (
                      <div key={`${owner.email}-${index}`} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                              {index + 1}
                            </span>
                            <span className="truncate font-medium">{owner.name}</span>
                            <span className="truncate text-muted-foreground">{owner.email}</span>
                          </div>
                          <span className="shrink-0 font-semibold tabular-nums">{owner.games}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.round((owner.games / topOwnerMax) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground">
              Generated{" "}
              <span suppressHydrationWarning>{new Date(insights.generatedAt).toLocaleString()}</span>
            </p>
          </TabsContent>

          <TabsContent value="users">
            <UserListPanel
              selection={selection}
              onSelectFilter={(filter) => setSelection({ type: "filter", filter })}
            />
          </TabsContent>

          <TabsContent value="players">
            <PlayersPanel />
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
}
