import { NextResponse } from "next/server";

import { getTripoCacheTtlSeconds, listCachedTasks } from "@/lib/tripoCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tasks = listCachedTasks();

  return NextResponse.json({
    ok: true,
    count: tasks.length,
    ttlSeconds: getTripoCacheTtlSeconds(),
    tasks,
  });
}
