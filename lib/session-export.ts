import * as XLSX from "xlsx";

import { connectToDatabase } from "@/lib/db";
import { PickleGame } from "@/models/PickleGame";
import { QueueEntry } from "@/models/QueueEntry";
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

const EXPORT_COLUMNS: (keyof SessionExportRow)[] = [
  "#",
  "Player Name",
  "First Name",
  "Last Name",
  "Email",
  "Mobile",
  "Personal QR Code",
  "Registered At",
  "Queue Status",
  "Role",
  "Volunteer Type",
  "Volunteer Type (Other)",
  "In a D-Group",
  "First Time at CCF Sports Ministry",
  "Attended CCF Events",
  "Other Event (Specify)",
];

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

  const [entries, volunteers] = await Promise.all([
    QueueEntry.find({ gameId }).sort({ registeredAt: 1 }).populate("playerId"),
    Volunteer.find({ gameId }).lean(),
  ]);

  const volunteerByPlayerId = new Map(
    volunteers.map((record) => [String(record.playerId), record]),
  );

  const seenNames = new Set<string>();
  const rows: SessionExportRow[] = [];

  for (const entry of entries) {
    const player = entry.playerId as PopulatedPlayer | null;
    const nameKey = playerNameKey(player);
    if (!nameKey || seenNames.has(nameKey)) continue;

    seenNames.add(nameKey);

    const playerId = player?._id?.toString() ?? "";
    const volunteer = playerId ? volunteerByPlayerId.get(playerId) : undefined;

    rows.push({
      "#": rows.length + 1,
      "Player Name": formatPlayerName(player),
      "First Name": player?.firstName ?? "",
      "Last Name": player?.lastName ?? "",
      Email: player?.email ?? "",
      Mobile: player?.mobileNumber ?? "",
      "Personal QR Code": player?.personalQrCode ?? "",
      "Registered At": formatDateTime(entry.registeredAt),
      "Queue Status": formatQueueStatus(entry.status),
      Role: volunteer ? "Volunteer" : "Player",
      "Volunteer Type": volunteer?.volunteerType ?? "",
      "Volunteer Type (Other)": volunteer?.volunteerTypeOther ?? "",
      "In a D-Group": formatYesNo(player?.isPartOfDgroup),
      "First Time at CCF Sports Ministry": formatYesNo(player?.firstTimeSportsMinistry),
      "Attended CCF Events": (player?.attendedEvents ?? []).join(", "),
      "Other Event (Specify)": player?.attendedEventsOther ?? "",
    });
  }

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: EXPORT_COLUMNS });
  worksheet["!cols"] = [
    { wch: 5 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 28 },
    { wch: 16 },
    { wch: 18 },
    { wch: 22 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
    { wch: 18 },
    { wch: 12 },
    { wch: 28 },
    { wch: 36 },
    { wch: 22 },
  ];

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
