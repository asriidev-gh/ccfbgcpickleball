import { OperatorDashboardLease } from "@/models/OperatorDashboardLease";

/** Lease expires when heartbeats stop for this long (keep ~3× heartbeat interval). */
export const OPERATOR_DASHBOARD_LEASE_TTL_MS = 45_000;

export type OperatorDashboardLeaseStatus = "active" | "blocked";

export type OperatorDashboardLeaseResult = {
  status: OperatorDashboardLeaseStatus;
  deviceHint?: string;
  lastSeenAt?: string;
  takenOver?: boolean;
};

function isLeaseExpired(lastHeartbeatAt: Date, now = Date.now()) {
  return now - lastHeartbeatAt.getTime() > OPERATOR_DASHBOARD_LEASE_TTL_MS;
}

function summarizeDeviceHint(userAgent?: string) {
  const agent = userAgent?.trim();
  if (!agent) return "Another device";

  if (/iPhone|iPad|iPod|Android|Mobile/i.test(agent)) return "A mobile device";
  if (/Macintosh|Mac OS X/i.test(agent)) return "A Mac";
  if (/Windows/i.test(agent)) return "A Windows device";
  if (/Linux/i.test(agent)) return "A Linux device";
  return "Another device";
}

export async function acquireOperatorDashboardLease(input: {
  gameId: string;
  ownerId: string;
  leaseId: string;
  userAgent?: string;
  force?: boolean;
}): Promise<OperatorDashboardLeaseResult> {
  const now = new Date();
  const deviceHint = summarizeDeviceHint(input.userAgent);
  const existing = await OperatorDashboardLease.findOne({ gameId: input.gameId });

  if (!existing || isLeaseExpired(existing.lastHeartbeatAt, now.getTime())) {
    await OperatorDashboardLease.findOneAndUpdate(
      { gameId: input.gameId },
      {
        $set: {
          ownerId: input.ownerId,
          leaseId: input.leaseId,
          deviceHint,
          lastHeartbeatAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return { status: "active" };
  }

  if (existing.ownerId !== input.ownerId) {
    return { status: "blocked", deviceHint: existing.deviceHint ?? "Another device" };
  }

  if (existing.leaseId === input.leaseId) {
    existing.lastHeartbeatAt = now;
    existing.deviceHint = deviceHint;
    await existing.save();
    return { status: "active" };
  }

  if (input.force) {
    existing.leaseId = input.leaseId;
    existing.deviceHint = deviceHint;
    existing.lastHeartbeatAt = now;
    await existing.save();
    return { status: "active" };
  }

  return {
    status: "blocked",
    deviceHint: existing.deviceHint ?? "Another device",
    lastSeenAt: existing.lastHeartbeatAt.toISOString(),
  };
}

function buildBlockedLeaseResult(existing: {
  deviceHint?: string | null;
  lastHeartbeatAt: Date;
}) {
  return {
    status: "blocked" as const,
    deviceHint: existing.deviceHint ?? "Another device",
    lastSeenAt: existing.lastHeartbeatAt.toISOString(),
    takenOver: true,
  };
}

export async function renewOperatorDashboardLease(input: {
  gameId: string;
  ownerId: string;
  leaseId: string;
  userAgent?: string;
}) {
  const now = new Date();
  const existing = await OperatorDashboardLease.findOne({
    gameId: input.gameId,
    ownerId: input.ownerId,
  });

  if (!existing || isLeaseExpired(existing.lastHeartbeatAt, now.getTime())) {
    return acquireOperatorDashboardLease(input);
  }

  if (existing.leaseId !== input.leaseId) {
    return buildBlockedLeaseResult(existing);
  }

  existing.lastHeartbeatAt = now;
  existing.deviceHint = summarizeDeviceHint(input.userAgent);
  await existing.save();

  return { status: "active" as const };
}

export async function releaseOperatorDashboardLease(input: {
  gameId: string;
  ownerId: string;
  leaseId: string;
}) {
  await OperatorDashboardLease.deleteOne({
    gameId: input.gameId,
    ownerId: input.ownerId,
    leaseId: input.leaseId,
  });
}
