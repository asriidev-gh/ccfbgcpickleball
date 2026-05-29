import * as XLSX from "xlsx";

import { connectToDatabase } from "@/lib/db";
import { getRegistrationFormVariant } from "@/lib/registration-variant";
import { PickleGame } from "@/models/PickleGame";
import { QueueEntry } from "@/models/QueueEntry";
import { User } from "@/models/User";
import { Volunteer } from "@/models/Volunteer";
import "@/models/Player";

type PopulatedPlayer = {
  _id: { toString(): string };
  firstName?: string;
  lastName?: string;
  email?: string;
  mobileNumber?: string;
  personalQrCode?: string;
  firstTimeSportsMinistry?: boolean;
  isPartOfDgroup?: boolean;
  attendedEvents?: string[];
  attendedEventsOther?: string;
};

export type SessionExportRow = {
  "#": number;
  "Player Name": string;
  "First Name": string;
  "Last Name": string;
  Email: string;
  Mobile: string;
  "Personal QR Code": string;
  "Registered At": string;
  "Queue Status": string;
  Role: string;
  "Volunteer Type": string;
  "Volunteer Type (Other)": string;
  "In a D-Group": string;
  "First Time at CCF Sports Ministry": string;
  "Attended CCF Events": string;
  "Other Event (Specify)": string;
};

const BASE_EXPORT_COLUMNS = [
  "#",
  "Player Name",
  "First Name",
  "Last Name",
  "Email",
  "Mobile",
  "Personal QR Code",
  "Registered At",
  "Queue Status",
] as const;

const CCF_QUESTIONNAIRE_COLUMNS = [
  "Role",
  "Volunteer Type",
  "Volunteer Type (Other)",
  "In a D-Group",
  "First Time at CCF Sports Ministry",
  "Attended CCF Events",
  "Other Event (Specify)",
] as const;

const EXPORT_COLUMNS: (keyof SessionExportRow)[] = [
  ...BASE_EXPORT_COLUMNS,
  ...CCF_QUESTIONNAIRE_COLUMNS,
];

const GENERIC_EXPORT_COLUMNS = [...BASE_EXPORT_COLUMNS];

function formatYesNo(value: boolean | undefined) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "";
}

function formatDateTime(value: Date | string | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatQueueStatus(status: string | undefined) {
  switch (status) {
    case "queued":
      return "Waiting";
    case "on_court":
      return "On Court";
    case "done":
      return "Done";
    default:
      return status ?? "";
  }
}

function formatPlayerName(player: PopulatedPlayer | null) {
  return `${player?.firstName ?? ""} ${player?.lastName ?? ""}`.trim();
}

function playerNameKey(player: PopulatedPlayer | null) {
  const first = (player?.firstName ?? "").trim().toLowerCase();
  const last = (player?.lastName ?? "").trim().toLowerCase();
  if (!first && !last) return "";
  return `${first}|${last}`;
}

export function sanitizeExportFilename(title: string) {
  const base = title
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return `${base || "session"}-registrations.xlsx`;
}

export async function buildSessionExportWorkbook(gameId: string, ownerId: string) {
  await connectToDatabase();

  const game = await PickleGame.findOne({ gameId, ownerId }).select("title gameId");
  if (!game) return null;

  const owner = await User.findById(ownerId).select("userType").lean();
  const userType =
    owner && typeof owner === "object" && typeof owner.userType === "string"
      ? owner.userType
      : undefined;
  const isGenericExport = getRegistrationFormVariant(userType) === "generic";
  const exportColumns = isGenericExport ? GENERIC_EXPORT_COLUMNS : EXPORT_COLUMNS;

  const entries = await QueueEntry.find({ gameId })
    .sort({ registeredAt: 1 })
    .populate("playerId");

  const volunteerByPlayerId = new Map<
    string,
    { volunteerType?: string; volunteerTypeOther?: string }
  >();
  if (!isGenericExport) {
    const volunteers = await Volunteer.find({ gameId }).lean();
    for (const record of volunteers) {
      volunteerByPlayerId.set(String(record.playerId), record);
    }
  }

  const seenNames = new Set<string>();
  const rows: Record<(typeof exportColumns)[number], string | number>[] = [];

  for (const entry of entries) {
    const player = entry.playerId as PopulatedPlayer | null;
    const nameKey = playerNameKey(player);
    if (!nameKey || seenNames.has(nameKey)) continue;

    seenNames.add(nameKey);

    const baseRow = {
      "#": rows.length + 1,
      "Player Name": formatPlayerName(player),
      "First Name": player?.firstName ?? "",
      "Last Name": player?.lastName ?? "",
      Email: player?.email ?? "",
      Mobile: player?.mobileNumber ?? "",
      "Personal QR Code": player?.personalQrCode ?? "",
      "Registered At": formatDateTime(entry.registeredAt),
      "Queue Status": formatQueueStatus(entry.status),
    };

    if (isGenericExport) {
      rows.push(baseRow);
      continue;
    }

    const playerId = player?._id?.toString() ?? "";
    const volunteer = playerId ? volunteerByPlayerId.get(playerId) : undefined;

    rows.push({
      ...baseRow,
      Role: volunteer ? "Volunteer" : "Player",
      "Volunteer Type": volunteer?.volunteerType ?? "",
      "Volunteer Type (Other)": volunteer?.volunteerTypeOther ?? "",
      "In a D-Group": formatYesNo(player?.isPartOfDgroup),
      "First Time at CCF Sports Ministry": formatYesNo(player?.firstTimeSportsMinistry),
      "Attended CCF Events": (player?.attendedEvents ?? []).join(", "),
      "Other Event (Specify)": player?.attendedEventsOther ?? "",
    });
  }

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: [...exportColumns] });
  worksheet["!cols"] = (isGenericExport
    ? [5, 22, 14, 14, 28, 16, 18, 22, 22]
    : [5, 22, 14, 14, 28, 16, 18, 22, 22, 10, 14, 18, 12, 28, 36, 22]
  ).map((wch) => ({ wch }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Registrations");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return {
    title: game.title,
    filename: sanitizeExportFilename(game.title),
    buffer,
    playerCount: rows.length,
  };
}
