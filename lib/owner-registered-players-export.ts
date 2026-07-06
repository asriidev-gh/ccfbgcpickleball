import * as XLSX from "xlsx";

import { formatAppDateTime } from "@/lib/format-datetime";
import {
  getOwnerRegisteredPlayers,
  type OwnerRegisteredPlayersQuery,
} from "@/lib/owner-registered-players";
import {
  getOwnerSessionInsightFilterLabel,
  type OwnerSessionInsightFilter,
} from "@/lib/owner-session-insight-filter-shared";
import {
  hasOwnerRegisteredPlayersCcfFilter,
  parseOwnerRegisteredPlayersDuplicateAccountsFilter,
} from "@/lib/owner-registered-players-filter-shared";
import { PickleGame } from "@/models/PickleGame";

const EXPORT_HEADERS = [
  "#",
  "Player Name",
  "First Name",
  "Last Name",
  "Email",
  "Mobile",
  "Personal QR Code",
  "Sessions",
  "Accounts",
  "Last Registered At",
  "Blocked",
] as const;

function sanitizeExportFilename(parts: string[]) {
  const base = parts
    .filter(Boolean)
    .join("-")
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return `${base || "registered-players-filtered"}.xlsx`;
}

function formatExportDateTime(value: string | null | undefined) {
  if (!value) return "";
  const formatted = formatAppDateTime(value);
  return formatted === "—" ? "" : formatted;
}

function hasRegisteredPlayersExportFilter(options: OwnerRegisteredPlayersQuery) {
  return Boolean(
    options.query?.trim() ||
      options.gameId?.trim() ||
      options.insight ||
      options.duplicateAccountsOnly ||
      options.expandAccountGroup ||
      hasOwnerRegisteredPlayersCcfFilter(options.ccfFilter),
  );
}

export async function buildOwnerRegisteredPlayersExportWorkbook(
  ownerId: string,
  options: OwnerRegisteredPlayersQuery,
) {
  if (!hasRegisteredPlayersExportFilter(options)) {
    throw new Error("Apply a filter before exporting.");
  }

  const result = await getOwnerRegisteredPlayers(ownerId, {
    ...options,
    exportAll: true,
    page: 1,
  });

  const rows = result.players.map((player, index) => ({
    "#": index + 1,
    "Player Name": player.name,
    "First Name": player.firstName,
    "Last Name": player.lastName,
    Email: player.email,
    Mobile: player.mobileNumber,
    "Personal QR Code": player.personalQrCode ?? "",
    Sessions: player.sessionsCount,
    Accounts: player.accountCount,
    "Last Registered At": formatExportDateTime(player.lastRegisteredAt),
    Blocked: player.isBlocked ? "Yes" : "No",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: [...EXPORT_HEADERS] });
  worksheet["!cols"] = EXPORT_HEADERS.map((header) => ({
    wch: Math.min(48, Math.max(10, header.length + 2)),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Registered players");

  const filenameParts = ["registered-players"];
  const sessionGameId = options.gameId?.trim() ?? "";
  if (sessionGameId) {
    const game = await PickleGame.findOne({ ownerId, gameId: sessionGameId })
      .select("title")
      .lean<{ title?: string } | null>();
    if (game?.title?.trim()) filenameParts.push(game.title.trim());
  }
  if (options.query?.trim()) filenameParts.push("search");
  if (options.insight) {
    filenameParts.push(
      getOwnerSessionInsightFilterLabel(options.insight as OwnerSessionInsightFilter)
        .toLowerCase()
        .replace(/\s+/g, "-"),
    );
  }
  if (options.ccfFilter?.attendedCcf) filenameParts.push("ccf-attended");
  if (options.ccfFilter?.notAttendedCcf) filenameParts.push("ccf-not-attended");
  if (options.ccfFilter?.withDgroup) filenameParts.push("with-dgroup");
  if (options.ccfFilter?.noDgroupYet) filenameParts.push("no-dgroup-yet");
  if (options.duplicateAccountsOnly) filenameParts.push("duplicate-accounts");
  if (options.expandAccountGroup) filenameParts.push("account-group");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return {
    buffer,
    filename: sanitizeExportFilename(filenameParts),
    count: result.total,
  };
}
