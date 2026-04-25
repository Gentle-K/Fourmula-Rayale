import { NextResponse } from "next/server";

import { getTripoTask } from "@/lib/tripo";
import { getCachedTask, setCachedTask } from "@/lib/tripoCache";
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

  const cachedEntry = getCachedTask(taskId);

  if (cachedEntry && !refresh && isFinalTripoStatus(cachedEntry.status)) {
    return NextResponse.json({
      ok: true,
      cached: true,
      mock: cachedEntry.mock,
      taskId: cachedEntry.taskId,
      status: cachedEntry.status,
      modelUrl: cachedEntry.modelUrl,
      raw: cachedEntry.raw,
    });
  }

  try {
    const result = await getTripoTask(taskId);

    setCachedTask(taskId, {
      taskId: result.taskId,
      status: result.status,
      modelUrl: result.modelUrl,
      raw: result.raw,
      mock: result.mock,
      inputMode: cachedEntry?.inputMode,
      prompt: cachedEntry?.prompt,
      referenceImage: cachedEntry?.referenceImage ?? null,
      assetType: cachedEntry?.assetType,
      assetCategory: cachedEntry?.assetCategory,
      pipelineMode: cachedEntry?.pipelineMode,
      rigStatus: cachedEntry?.rigStatus,
      rigTaskId: cachedEntry?.rigTaskId,
      animationTaskId: cachedEntry?.animationTaskId,
      riggedModelUrl: cachedEntry?.riggedModelUrl,
      animatedModelUrl: cachedEntry?.animatedModelUrl,
    });

    return NextResponse.json({
      ok: true,
      cached: false,
      mock: result.mock,
      taskId: result.taskId,
      status: result.status,
      modelUrl: result.modelUrl,
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
        modelUrl: cachedEntry.modelUrl,
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
            : "Failed to fetch Tripo task.",
      },
      { status: 500 },
    );
  }
}
