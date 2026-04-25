import { NextResponse } from "next/server";

import { getTripoAnimationTask } from "@/lib/tripoAnimation";
import {
  getCachedAnimationTask,
  setCachedAnimationTask,
} from "@/lib/tripoAnimationCache";
import { isFinalTripoStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId")?.trim();
  const refresh =
    searchParams.get("refresh") === "1" ||
    searchParams.get("refresh") === "true";

  if (!taskId) {
    return NextResponse.json(
      {
        ok: false,
        error: "taskId query parameter is required.",
      },
      { status: 400 },
    );
  }

  const cachedEntry = getCachedAnimationTask(taskId);

  if (cachedEntry && !refresh && isFinalTripoStatus(cachedEntry.status)) {
    return NextResponse.json({
      ok: true,
      cached: true,
      mock: cachedEntry.mock,
      taskId: cachedEntry.taskId,
      status: cachedEntry.status,
      rigStatus: cachedEntry.rigStatus,
      modelUrl: cachedEntry.modelUrl,
      riggedModelUrl: cachedEntry.riggedModelUrl,
      animatedModelUrl: cachedEntry.animatedModelUrl,
      raw: cachedEntry.raw,
    });
  }

  try {
    const result = await getTripoAnimationTask(taskId);

    setCachedAnimationTask(taskId, {
      taskId: result.taskId,
      sourceTaskId: cachedEntry?.sourceTaskId,
      sourceModelUrl: cachedEntry?.sourceModelUrl,
      kind: result.kind,
      assetType: cachedEntry?.assetType,
      presetId: cachedEntry?.presetId,
      status: result.status,
      rigStatus: result.rigStatus,
      modelUrl: result.modelUrl,
      riggedModelUrl: result.riggedModelUrl,
      animatedModelUrl: result.animatedModelUrl,
      raw: result.raw,
      mock: result.mock,
    });

    return NextResponse.json({
      ok: true,
      cached: false,
      mock: result.mock,
      taskId: result.taskId,
      status: result.status,
      rigStatus: result.rigStatus,
      modelUrl: result.modelUrl,
      riggedModelUrl: result.riggedModelUrl,
      animatedModelUrl: result.animatedModelUrl,
      raw: result.raw,
    });
  } catch (error) {
    if (cachedEntry) {
      return NextResponse.json({
        ok: true,
        cached: true,
        mock: cachedEntry.mock,
        taskId: cachedEntry.taskId,
        status: cachedEntry.status,
        rigStatus: cachedEntry.rigStatus,
        modelUrl: cachedEntry.modelUrl,
        riggedModelUrl: cachedEntry.riggedModelUrl,
        animatedModelUrl: cachedEntry.animatedModelUrl,
        raw: {
          ...cachedEntry.raw,
          cacheFallback: true,
        },
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch Tripo animation task.",
      },
      { status: 500 },
    );
  }
}
