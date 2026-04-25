import { NextResponse } from "next/server";

import { getAssetCategory, shouldRigAsset } from "@/lib/tripoAssetClassify";
import { createTripoTask } from "@/lib/tripo";
import { setCachedTask } from "@/lib/tripoCache";
import {
  TripoAssetType,
  TripoPipelineMode,
  TRIPO_MAX_PROMPT_LENGTH,
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

function isPipelineMode(value: string): value is TripoPipelineMode {
  return [
    "static_generate",
    "generate_then_rig",
    "generate_rig_then_animate",
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

  const prompt =
    bodyRecord && typeof bodyRecord.prompt === "string"
      ? bodyRecord.prompt.trim()
      : "";
  const assetType =
    bodyRecord && typeof bodyRecord.assetType === "string"
      ? bodyRecord.assetType.trim()
      : "";
  const pipelineMode =
    bodyRecord && typeof bodyRecord.pipelineMode === "string"
      ? bodyRecord.pipelineMode.trim()
      : "";
  const manualOverrideRig =
    bodyRecord?.manualOverrideRig === true;

  if (!prompt) {
    return NextResponse.json(
      {
        ok: false,
        error: "prompt must be a non-empty string.",
      },
      { status: 400 },
    );
  }

  if (prompt.length > TRIPO_MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      {
        ok: false,
        error: `Prompt must be ${TRIPO_MAX_PROMPT_LENGTH} characters or fewer.`,
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
          "This asset type is static and does not need rigging. Use /api/tripo/generate for static props.",
      },
      { status: 400 },
    );
  }

  if (!pipelineMode || !isPipelineMode(pipelineMode)) {
    return NextResponse.json(
      {
        ok: false,
        error: "pipelineMode must be a valid riggable pipeline mode.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await createTripoTask({
      prompt,
    });
    const raw = {
      ...result.raw,
      request: {
        prompt,
        assetType,
        assetCategory: getAssetCategory(assetType),
        pipelineMode,
      },
    };

    setCachedTask(result.taskId, {
      taskId: result.taskId,
      status: result.status,
      modelUrl: null,
      raw,
      mock: result.mock,
      inputMode: result.inputMode,
      prompt,
      referenceImage: null,
      assetType,
      assetCategory: "riggable",
      pipelineMode,
      rigStatus: "pending",
    });

    return NextResponse.json({
      ok: true,
      mock: result.mock,
      assetCategory: "riggable",
      assetType,
      pipelineMode,
      generateTaskId: result.taskId,
      status: result.status,
      rigStatus: "pending",
      message:
        "Riggable model generation task created. Poll this task before rigging.",
      raw,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create riggable Tripo generation task.",
      },
      { status: 500 },
    );
  }
}
