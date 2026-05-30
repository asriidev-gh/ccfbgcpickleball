import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import {
  getUsersByMonth,
  getUsersList,
  USER_FILTERS,
  type UserListFilter,
} from "@/lib/insights";
import { isSuperAdmin } from "@/lib/superadmin";

const VALID_FILTERS = new Set(USER_FILTERS.map((f) => f.id));

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    if (!isSuperAdmin(authUser.email)) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    const searchParams = new URL(request.url).searchParams;
    const month = searchParams.get("month");
    if (month) {
      const users = await getUsersByMonth(month);
      return NextResponse.json({ month, count: users.length, users });
    }

    const param = searchParams.get("filter") ?? "all";
    const filter: UserListFilter = VALID_FILTERS.has(param as UserListFilter)
      ? (param as UserListFilter)
      : "all";

    const users = await getUsersList(filter);
    return NextResponse.json({ filter, count: users.length, users });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load users." },
      { status: 400 },
    );
  }
}
