import { NextResponse } from "next/server";

import { shouldRigAsset } from "@/lib/tripoAssetClassify";
import { createRigTask } from "@/lib/tripoAnimation";
import { setCachedAnimationTask } from "@/lib/tripoAnimationCache";
import { getCachedTask, setCachedTask } from "@/lib/tripoCache";
import { TripoAssetType } from "@/lib/types";

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
  const generateTaskId =
    bodyRecord && typeof bodyRecord.generateTaskId === "string"
      ? bodyRecord.generateTaskId.trim()
      : sourceTaskId;
  const assetType =
    bodyRecord && typeof bodyRecord.assetType === "string"
      ? bodyRecord.assetType.trim()
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
          "This asset type is static and does not need rigging. Static props should not be rigged.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await createRigTask({
      sourceTaskId: sourceTaskId || undefined,
      sourceModelUrl: sourceModelUrl || undefined,
    });
    const raw = {
      ...result.raw,
      request: {
        sourceTaskId: sourceTaskId || undefined,
        sourceModelUrl: sourceModelUrl || undefined,
        assetType,
      },
    };

    setCachedAnimationTask(result.taskId, {
      taskId: result.taskId,
      sourceTaskId: sourceTaskId || undefined,
      sourceModelUrl: sourceModelUrl || undefined,
      kind: "rig",
      assetType,
      status: result.status,
      rigStatus: result.rigStatus,
      modelUrl: result.modelUrl,
      riggedModelUrl: result.riggedModelUrl,
      animatedModelUrl: result.animatedModelUrl,
      raw,
      mock: result.mock,
    });

    const sourceEntry = generateTaskId ? getCachedTask(generateTaskId) : null;

    if (generateTaskId) {
      setCachedTask(generateTaskId, {
        taskId: generateTaskId,
        status: sourceEntry?.status ?? "success",
        modelUrl: sourceEntry?.modelUrl ?? null,
        raw: sourceEntry?.raw ?? {},
        mock: sourceEntry?.mock ?? result.mock,
        inputMode: sourceEntry?.inputMode,
        prompt: sourceEntry?.prompt,
        referenceImage: sourceEntry?.referenceImage ?? null,
        assetType,
        assetCategory: "riggable",
        pipelineMode: sourceEntry?.pipelineMode ?? "generate_then_rig",
        rigStatus: "rigging",
        rigTaskId: result.taskId,
        animationTaskId: sourceEntry?.animationTaskId,
        riggedModelUrl: result.riggedModelUrl,
        animatedModelUrl: sourceEntry?.animatedModelUrl,
      });
    }

    return NextResponse.json({
      ok: true,
      mock: result.mock,
      assetCategory: "riggable",
      assetType,
      pipelineMode: "generate_then_rig",
      generateTaskId: generateTaskId || undefined,
      rigTaskId: result.taskId,
      status: result.status,
      rigStatus: "rigging",
      message:
        "Rig task created. Poll /api/tripo/animation/task for rigged model URL.",
      raw,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to create rig task.",
      },
      { status: 500 },
    );
  }
}
