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

async function upsertActiveLease(input: {
  gameId: string;
  ownerId: string;
  leaseId: string;
  deviceHint: string;
  now: Date;
}) {
  await OperatorDashboardLease.findOneAndUpdate(
    { gameId: input.gameId },
    {
      $set: {
        ownerId: input.ownerId,
        leaseId: input.leaseId,
        deviceHint: input.deviceHint,
        lastHeartbeatAt: input.now,
      },
      $setOnInsert: {
        createdAt: input.now,
      },
    },
    { upsert: true },
  );
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
    await upsertActiveLease({
      gameId: input.gameId,
      ownerId: input.ownerId,
      leaseId: input.leaseId,
      deviceHint,
      now,
    });
    return { status: "active" };
  }

  if (existing.ownerId !== input.ownerId) {
    return { status: "blocked", deviceHint: existing.deviceHint ?? "Another device" };
  }

  if (existing.leaseId === input.leaseId || input.force) {
    const updated = await OperatorDashboardLease.findOneAndUpdate(
      { gameId: input.gameId, ownerId: input.ownerId },
      {
        $set: {
          leaseId: input.leaseId,
          deviceHint,
          lastHeartbeatAt: now,
        },
      },
    );
    if (updated) return { status: "active" };

    await upsertActiveLease({
      gameId: input.gameId,
      ownerId: input.ownerId,
      leaseId: input.leaseId,
      deviceHint,
      now,
    });
    return { status: "active" };
  }

  return {
    status: "blocked",
    deviceHint: existing.deviceHint ?? "Another device",
    lastSeenAt: existing.lastHeartbeatAt.toISOString(),
  };
}

export async function renewOperatorDashboardLease(input: {
  gameId: string;
  ownerId: string;
  leaseId: string;
  userAgent?: string;
}) {
  const now = new Date();
  const deviceHint = summarizeDeviceHint(input.userAgent);

  const renewed = await OperatorDashboardLease.findOneAndUpdate(
    {
      gameId: input.gameId,
      ownerId: input.ownerId,
      leaseId: input.leaseId,
    },
    {
      $set: {
        deviceHint,
        lastHeartbeatAt: now,
      },
    },
  );

  if (renewed) return { status: "active" as const };

  const existing = await OperatorDashboardLease.findOne({ gameId: input.gameId });
  if (!existing || isLeaseExpired(existing.lastHeartbeatAt, now.getTime())) {
    return acquireOperatorDashboardLease(input);
  }

  if (existing.leaseId !== input.leaseId) {
    return buildBlockedLeaseResult(existing);
  }

  return acquireOperatorDashboardLease(input);
}

export async function checkOperatorDashboardLease(input: {
  gameId: string;
  ownerId: string;
  leaseId: string;
}): Promise<OperatorDashboardLeaseResult> {
  const now = new Date();
  const existing = await OperatorDashboardLease.findOne({ gameId: input.gameId });

  if (!existing || isLeaseExpired(existing.lastHeartbeatAt, now.getTime())) {
    return { status: "blocked" };
  }

  if (existing.ownerId !== input.ownerId) {
    return { status: "blocked", deviceHint: existing.deviceHint ?? "Another device" };
  }

  if (existing.leaseId !== input.leaseId) {
    return buildBlockedLeaseResult(existing);
  }

  return { status: "active" };
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
