import * as XLSX from "xlsx";

import { formatDgroupAvailabilitySummary } from "@/lib/dgroup-availability-shared";
import { formatAppDateTime } from "@/lib/format-datetime";
import { getOwnerDgroupRequests } from "@/lib/owner-dgroup-requests";
import type { DgroupRequestItem, DgroupRequestView } from "@/lib/owner-dgroup-requests-shared";
import { getOwnerPrayerRequests } from "@/lib/owner-prayer-requests";
import type { PrayerRequestView } from "@/lib/owner-prayer-requests-shared";

function sanitizeExportFilename(prefix: string, suffix: string) {
  const base = prefix
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${base || "export"}-${suffix}.xlsx`;
}

function formatExportDateTime(value: string | null | undefined) {
  if (!value) return "";
  const formatted = formatAppDateTime(value);
  return formatted === "—" ? "" : formatted;
}

function buildWorkbookBuffer(
  rows: Array<Record<string, string | number>>,
  headers: string[],
  sheetName: string,
) {
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  worksheet["!cols"] = headers.map((header) => ({
    wch: Math.min(48, Math.max(10, header.length + 2)),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

const DGROUP_PENDING_HEADERS = [
  "#",
  "Player Name",
  "First Name",
  "Last Name",
  "Email",
  "Mobile",
  "Personal QR Code",
  "Sessions",
  "Last Registered At",
  "Requested At",
  "Acknowledged",
  "Acknowledged At",
  "Remark Count",
  "D-group Availability",
] as const;

const DGROUP_JOINED_HEADERS = [
  "#",
  "Player Name",
  "First Name",
  "Last Name",
  "Email",
  "Mobile",
  "Personal QR Code",
  "Sessions",
  "Last Registered At",
  "Joined Source",
  "Joined / Marked At",
] as const;

const PRAYER_HEADERS = [
  "#",
  "Player Name",
  "First Name",
  "Last Name",
  "Email",
  "Mobile",
  "Prayer Request",
  "Submitted At",
  "Acknowledged At",
  "Status",
  "Sessions",
  "Last Registered At",
  "Reply Count",
  "Game ID",
] as const;

function mapDgroupPendingRow(request: DgroupRequestItem, index: number) {
  return {
    "#": index + 1,
    "Player Name": request.name,
    "First Name": request.firstName,
    "Last Name": request.lastName,
    Email: request.email,
    Mobile: request.mobileNumber,
    "Personal QR Code": request.personalQrCode ?? "",
    Sessions: request.sessionCount,
    "Last Registered At": formatExportDateTime(request.lastRegisteredAt),
    "Requested At": formatExportDateTime(request.requestedAt),
    Acknowledged: request.isAcknowledged ? "Yes" : "No",
    "Acknowledged At": formatExportDateTime(request.acknowledgedAt),
    "Remark Count": request.remarkCount ?? 0,
    "D-group Availability": formatDgroupAvailabilitySummary(
      request.dgroupAvailableDays,
      request.dgroupAvailableTimeFrom,
      request.dgroupAvailableTimeTo,
    ),
  };
}

function mapDgroupJoinedRow(request: DgroupRequestItem, index: number) {
  const joinedSource =
    request.joinedSource === "registration"
      ? "In D-group (registration)"
      : "Marked joined by organizer";

  return {
    "#": index + 1,
    "Player Name": request.name,
    "First Name": request.firstName,
    "Last Name": request.lastName,
    Email: request.email,
    Mobile: request.mobileNumber,
    "Personal QR Code": request.personalQrCode ?? "",
    Sessions: request.sessionCount,
    "Last Registered At": formatExportDateTime(request.lastRegisteredAt),
    "Joined Source": joinedSource,
    "Joined / Marked At": formatExportDateTime(request.requestedAt),
  };
}

function mapPrayerRow(
  request: Awaited<ReturnType<typeof getOwnerPrayerRequests>>["requests"][number],
  index: number,
) {
  return {
    "#": index + 1,
    "Player Name": request.name,
    "First Name": request.firstName,
    "Last Name": request.lastName,
    Email: request.email,
    Mobile: request.mobileNumber,
    "Prayer Request": request.requestText,
    "Submitted At": formatExportDateTime(request.submittedAt),
    "Acknowledged At": formatExportDateTime(request.acknowledgedAt),
    Status: request.status,
    Sessions: request.sessionCount,
    "Last Registered At": formatExportDateTime(request.lastRegisteredAt),
    "Reply Count": request.replyCount,
    "Game ID": request.gameId,
  };
}

export async function buildDgroupRequestsExportWorkbook(
  ownerId: string,
  query = "",
  view: DgroupRequestView = "pending",
  includeRegistrationDgroup = false,
  showAcknowledged = false,
) {
  const { requests } = await getOwnerDgroupRequests(
    ownerId,
    query,
    view,
    includeRegistrationDgroup,
    showAcknowledged,
  );

  if (view === "joined") {
    const rows = requests.map((request, index) => mapDgroupJoinedRow(request, index));
    const suffix = includeRegistrationDgroup ? "joined-with-registration" : "joined";
    return {
      filename: sanitizeExportFilename("dgroup-requests", suffix),
      buffer: buildWorkbookBuffer(rows, [...DGROUP_JOINED_HEADERS], "Joined"),
      rowCount: rows.length,
    };
  }

  const rows = requests.map((request, index) => mapDgroupPendingRow(request, index));
  const suffix = showAcknowledged ? "acknowledged" : "open";
  return {
    filename: sanitizeExportFilename("dgroup-requests", suffix),
    buffer: buildWorkbookBuffer(rows, [...DGROUP_PENDING_HEADERS], "Active requests"),
    rowCount: rows.length,
  };
}

export async function buildPrayerRequestsExportWorkbook(
  ownerId: string,
  query = "",
  view: PrayerRequestView = "pending",
) {
  const { requests } = await getOwnerPrayerRequests(ownerId, query, view);
  const rows = requests.map((request, index) => mapPrayerRow(request, index));

  return {
    filename: sanitizeExportFilename("prayer-requests", view),
    buffer: buildWorkbookBuffer(rows, [...PRAYER_HEADERS], view === "pending" ? "Pending" : "Acknowledged"),
    rowCount: rows.length,
  };
}
