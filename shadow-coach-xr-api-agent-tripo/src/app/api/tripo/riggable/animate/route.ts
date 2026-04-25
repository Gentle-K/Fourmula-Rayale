import { NextResponse } from "next/server";

import { shouldRigAsset } from "@/lib/tripoAssetClassify";
import { createRetargetTask } from "@/lib/tripoAnimation";
import { setCachedAnimationTask } from "@/lib/tripoAnimationCache";
import { getCachedTask, setCachedTask } from "@/lib/tripoCache";
import { TRIPO_ANIMATION_PRESETS } from "@/lib/tripoAnimationPresets";
import {
  TripoAnimationPresetId,
  TripoAssetType,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isTripoAssetType(value: string): value is TripoAssetType {
  return [
    "iss_module",
    "tool_kit",
    "control_panel",
    "storage_bag",
    "handrail",
    "cable_bundle",
    "cupola_window",
    "cleaning_cloth",
    "docking_pad",
    "floating_tablet",
    "assistant_robot",
    "astronaut",
    "humanoid_guide",
    "small_creature",
    "custom",
  ].includes(value);
}

function isAnimationPresetId(value: string): value is TripoAnimationPresetId {
  return Object.values(TRIPO_ANIMATION_PRESETS).some(
    (preset) => preset.id === value,
  );
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid JSON body.",
      },
      { status: 400 },
    );
  }

  const bodyRecord =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : null;

  const sourceTaskId =
    bodyRecord && typeof bodyRecord.sourceTaskId === "string"
      ? bodyRecord.sourceTaskId.trim()
      : "";
  const sourceModelUrl =
    bodyRecord && typeof bodyRecord.sourceModelUrl === "string"
      ? bodyRecord.sourceModelUrl.trim()
      : "";
  const assetType =
    bodyRecord && typeof bodyRecord.assetType === "string"
      ? bodyRecord.assetType.trim()
      : "";
  const animationPresetId =
    bodyRecord && typeof bodyRecord.animationPresetId === "string"
      ? bodyRecord.animationPresetId.trim()
      : "";
  const manualOverrideRig =
    bodyRecord?.manualOverrideRig === true;

  if (!sourceTaskId && !sourceModelUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: "sourceTaskId or sourceModelUrl is required.",
      },
      { status: 400 },
    );
  }

  if (!assetType || !isTripoAssetType(assetType)) {
    return NextResponse.json(
      {
        ok: false,
        error: "assetType must be a valid Tripo asset type.",
      },
      { status: 400 },
    );
  }

  if (!shouldRigAsset(assetType, manualOverrideRig)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "This asset type is static and does not need rigging or animation.",
      },
      { status: 400 },
    );
  }

  if (!animationPresetId || !isAnimationPresetId(animationPresetId)) {
    return NextResponse.json(
      {
        ok: false,
        error: "animationPresetId must be a valid animation preset.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await createRetargetTask({
      sourceTaskId: sourceTaskId || undefined,
      sourceModelUrl: sourceModelUrl || undefined,
      presetId: animationPresetId,
    });
    const raw = {
      ...result.raw,
      request: {
        sourceTaskId: sourceTaskId || undefined,
        sourceModelUrl: sourceModelUrl || undefined,
        assetType,
        animationPresetId,
      },
    };

    setCachedAnimationTask(result.taskId, {
      taskId: result.taskId,
      sourceTaskId: sourceTaskId || undefined,
      sourceModelUrl: sourceModelUrl || undefined,
      kind: "retarget",
      assetType,
      presetId: animationPresetId,
      status: result.status,
      rigStatus: result.rigStatus,
      modelUrl: result.modelUrl,
      riggedModelUrl: result.riggedModelUrl,
      animatedModelUrl: result.animatedModelUrl,
      raw,
      mock: result.mock,
    });

    const sourceEntry = sourceTaskId ? getCachedTask(sourceTaskId) : null;

    if (sourceTaskId && sourceEntry) {
      setCachedTask(sourceTaskId, {
        taskId: sourceEntry.taskId,
        status: sourceEntry.status,
        modelUrl: sourceEntry.modelUrl,
        raw: sourceEntry.raw,
        mock: sourceEntry.mock,
        inputMode: sourceEntry.inputMode,
        prompt: sourceEntry.prompt,
        referenceImage: sourceEntry.referenceImage ?? null,
        assetType,
        assetCategory: "riggable",
        pipelineMode: "generate_rig_then_animate",
        rigStatus: "animating",
        rigTaskId: sourceEntry.rigTaskId ?? sourceTaskId,
        animationTaskId: result.taskId,
        riggedModelUrl: sourceEntry.riggedModelUrl,
        animatedModelUrl: result.animatedModelUrl,
      });
    }

    return NextResponse.json({
      ok: true,
      mock: result.mock,
      assetCategory: "riggable",
      assetType,
      pipelineMode: "generate_rig_then_animate",
      animationTaskId: result.taskId,
      status: result.status,
      rigStatus: "animating",
      message:
        "Animation retarget task created. Poll animation task for animated model URL.",
      raw,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create animation retarget task.",
      },
      { status: 500 },
    );
  }
}
