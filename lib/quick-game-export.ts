import * as XLSX from "xlsx";

import { formatPlayerDisplayName } from "@/lib/utils";
import type { PlayerPhotoRef } from "@/components/game/player-avatar";
import { GENDER_OPTIONS } from "@/lib/player-profile-shared";
import type { OperatorFullPayload } from "@/lib/operator-payload";
import { sanitizeExportFilename } from "@/lib/session-export";
import { loadOwnerQuickGameSession } from "@/lib/quick-game-persistence-server";

const EXPORT_COLUMNS = ["#", "Player Name", "Gender", "Queue Status"] as const;

function genderLabel(value: string | undefined) {
  if (!value) return "";
  return GENDER_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function playerKey(player: PlayerPhotoRef) {
  return player._id ?? player.personalQrCode ?? "";
}

function playerDisplayName(player: PlayerPhotoRef) {
  return formatPlayerDisplayName(player.firstName, player.lastName);
}

export function collectQuickGameExportPlayers(payload: OperatorFullPayload) {
  const rows = new Map<string, { name: string; gender: string; queueStatus: string }>();

  const add = (player: PlayerPhotoRef, queueStatus: string) => {
    const key = playerKey(player);
    if (!key) return;
    const existing = rows.get(key);
    if (existing) {
      if (queueStatus === "On Court") {
        rows.set(key, { ...existing, queueStatus });
      }
      return;
    }
    rows.set(key, {
      name: playerDisplayName(player),
      gender: genderLabel(player.gender),
      queueStatus,
    });
  };

  for (const entry of payload.queue) {
    add(entry.playerId, "Waiting");
  }
  for (const entry of payload.checkedOut ?? []) {
    add(entry.playerId, "Checked out");
  }
  for (const court of payload.courts) {
    for (const player of [...court.teamA.playerIds, ...court.teamB.playerIds]) {
      add(player, "On Court");
    }
  }

  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function buildQuickGameExportWorkbook(payload: OperatorFullPayload) {
  const players = collectQuickGameExportPlayers(payload);
  const rows = players.map((player, index) => ({
    "#": index + 1,
    "Player Name": player.name,
    Gender: player.gender,
    "Queue Status": player.queueStatus,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: [...EXPORT_COLUMNS] });
  worksheet["!cols"] = [{ wch: 5 }, { wch: 24 }, { wch: 18 }, { wch: 16 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Players");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return {
    title: payload.game.title,
    filename: sanitizeExportFilename(payload.game.title).replace(
      "-registrations.xlsx",
      "-players.xlsx",
    ),
    buffer,
    playerCount: rows.length,
  };
}

export async function buildOwnerQuickGameExportWorkbook(ownerId: string, gameId: string) {
  const doc = await loadOwnerQuickGameSession(ownerId, gameId);
  if (!doc) return null;
  return buildQuickGameExportWorkbook(doc.payload as OperatorFullPayload);
}
