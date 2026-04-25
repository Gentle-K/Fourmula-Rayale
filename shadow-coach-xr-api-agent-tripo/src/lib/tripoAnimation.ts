import { extractModelUrl, normalizeStatus } from "@/lib/tripo";
import { TRIPO_ANIMATION_PRESETS } from "@/lib/tripoAnimationPresets";
import {
  TripoAnimationCreateTaskResponse,
  TripoAnimationKind,
  TripoAnimationPresetId,
  TripoAnimationStatus,
  TripoAnimationTaskResponse,
  TripoRigStatus,
} from "@/lib/types";

const TRIPO_API_BASE_URL = "https://api.tripo3d.ai/v2/openapi";

const TASK_ID_PATHS = [
  ["task_id"],
  ["taskId"],
  ["id"],
  ["data", "task_id"],
  ["data", "taskId"],
  ["data", "id"],
  ["result", "task_id"],
  ["result", "taskId"],
  ["result", "id"],
] as const;

const TASK_TYPE_PATHS = [
  ["type"],
  ["data", "type"],
  ["result", "type"],
] as const;

const URL_PATH_GROUPS = {
  rigged: [
    ["output", "rigged_model"],
    ["output", "riggedModel"],
    ["output", "model"],
    ["output", "pbr_model"],
    ["output", "glb"],
    ["output", "glb_url"],
    ["data", "output", "rigged_model"],
    ["data", "output", "model"],
    ["result", "output", "rigged_model"],
    ["result", "output", "model"],
    ["modelUrl"],
  ],
  animated: [
    ["output", "animated_model"],
    ["output", "animation"],
    ["output", "model"],
    ["output", "pbr_model"],
    ["output", "glb"],
    ["output", "glb_url"],
    ["data", "output", "animated_model"],
    ["data", "output", "model"],
    ["result", "output", "animated_model"],
    ["result", "output", "model"],
    ["modelUrl"],
  ],
} as const;

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function getStringValue(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function getNestedValue(
  input: unknown,
  path: readonly string[],
): unknown | null {
  let current: unknown = input;

  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current ?? null;
}

function getFirstStringFromPaths(
  input: unknown,
  paths: readonly (readonly string[])[],
) {
  for (const path of paths) {
    const candidate = getStringValue(getNestedValue(input, path));

    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function getApiKey() {
  return process.env.TRIPO_API_KEY?.trim() ?? "";
}

function shouldUseMockTripo() {
  return process.env.USE_MOCK_TRIPO?.toLowerCase() === "true" || !getApiKey();
}

async function parseResponseBody(response: Response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { rawText: text };
  }
}

function getErrorMessage(payload: unknown) {
  const raw = asObject(payload);
  const candidates = [
    raw.message,
    raw.error,
    raw.detail,
    raw.msg,
    raw.error_msg,
    asObject(raw.data).message,
    asObject(raw.data).error,
    asObject(raw.data).detail,
    asObject(raw.data).error_msg,
    asObject(raw.result).message,
    asObject(raw.result).error,
    asObject(raw.result).detail,
  ];

  for (const candidate of candidates) {
    const message = getStringValue(candidate);

    if (message) {
      return message;
    }
  }

  return null;
}

async function requestTripo(path: string, init: RequestInit) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${getApiKey()}`);

  const response = await fetch(`${TRIPO_API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  const payload = await parseResponseBody(response);
  const raw = asObject(payload);
  const code = raw.code;

  if (!response.ok || (typeof code === "number" && code !== 0)) {
    const apiMessage = getErrorMessage(payload);
    const fallbackMessage = response.ok
      ? "Tripo animation API returned an unexpected error."
      : `Tripo animation API request failed with status ${response.status}.`;

    throw new Error(apiMessage ?? fallbackMessage);
  }

  return payload;
}

function extractApiResponseData(payload: unknown) {
  const raw = asObject(payload);
  const data = asObject(raw.data);
  const result = asObject(raw.result);

  return Object.keys(data).length > 0
    ? data
    : Object.keys(result).length > 0
      ? result
      : raw;
}

function getTaskId(raw: unknown) {
  return (
    getFirstStringFromPaths(raw, TASK_ID_PATHS) ??
    `mock-animation-${Date.now()}`
  );
}

function getTaskKind(raw: unknown): TripoAnimationKind {
  const taskType = getFirstStringFromPaths(raw, TASK_TYPE_PATHS)?.toLowerCase();

  switch (taskType) {
    case "animate_prerigcheck":
      return "prerigcheck";
    case "animate_retarget":
      return "retarget";
    case "animate_rig":
    default:
      return "rig";
  }
}

function getMockTaskTimestamp(taskId: string) {
  const timestamp = taskId.match(/(\d{10,})$/)?.[1] ?? "";
  const parsedTimestamp = Number.parseInt(timestamp, 10);

  return Number.isNaN(parsedTimestamp) ? Date.now() : parsedTimestamp;
}

function getMockTaskKind(taskId: string): TripoAnimationKind {
  if (taskId.includes("prerigcheck")) {
    return "prerigcheck";
  }

  if (taskId.includes("retarget") || taskId.includes("animate")) {
    return "retarget";
  }

  return "rig";
}

function buildMockTaskId(kind: TripoAnimationKind) {
  return `mock-${kind}-${Date.now()}`;
}

function resolveSourceTaskId(input: {
  sourceTaskId?: string;
  sourceModelUrl?: string;
}) {
  const sourceTaskId = input.sourceTaskId?.trim();
  const sourceModelUrl = input.sourceModelUrl?.trim();

  if (sourceTaskId) {
    return sourceTaskId;
  }

  if (sourceModelUrl && shouldUseMockTripo()) {
    return `mock-source-${Date.now()}`;
  }

  if (sourceModelUrl) {
    throw new Error(
      "Tripo animation currently requires sourceTaskId (original_model_task_id) from a prior successful Tripo task. sourceModelUrl alone is not supported by the official public animation endpoint.",
    );
  }

  throw new Error(
    "sourceTaskId or sourceModelUrl is required for Tripo animation tasks.",
  );
}

function getRigStatusForTask(
  kind: TripoAnimationKind,
  status: TripoAnimationStatus,
  options?: {
    riggedModelUrl?: string | null;
    animatedModelUrl?: string | null;
  },
): TripoRigStatus {
  if (status === "failed" || status === "banned" || status === "expired") {
    return "failed";
  }

  if (kind === "prerigcheck") {
    return "prerigcheck";
  }

  if (kind === "rig") {
    if (status === "success" && options?.riggedModelUrl) {
      return "rigged";
    }

    return status === "success" ? "rigged" : "rigging";
  }

  if (status === "success" && options?.animatedModelUrl) {
    return "animated";
  }

  return status === "success" ? "animated" : "animating";
}

function getAnimationName(
  presetId?: TripoAnimationPresetId,
  explicitAnimationName?: string,
) {
  const customName = explicitAnimationName?.trim();

  if (customName) {
    return customName;
  }

  if (!presetId) {
    return TRIPO_ANIMATION_PRESETS.ROBOT_IDLE.tripoAnimation;
  }

  const preset = Object.values(TRIPO_ANIMATION_PRESETS).find(
    (entry) => entry.id === presetId,
  );

  return preset?.tripoAnimation ?? TRIPO_ANIMATION_PRESETS.ROBOT_IDLE.tripoAnimation;
}

function extractUrlFromPathGroup(
  raw: unknown,
  paths: readonly (readonly string[])[],
) {
  for (const path of paths) {
    const candidate = getStringValue(getNestedValue(raw, path));

    if (
      candidate &&
      (candidate.startsWith("http://") || candidate.startsWith("https://"))
    ) {
      return candidate;
    }
  }

  return null;
}

export function extractRiggedModelUrl(raw: unknown) {
  return extractUrlFromPathGroup(raw, URL_PATH_GROUPS.rigged) ?? extractModelUrl(raw);
}

export function extractAnimatedModelUrl(raw: unknown) {
  return (
    extractUrlFromPathGroup(raw, URL_PATH_GROUPS.animated) ?? extractModelUrl(raw)
  );
}

export function normalizeTripoAnimationStatus(
  raw: unknown,
): TripoAnimationStatus {
  return normalizeStatus(raw);
}

function buildMockAnimationTaskStatus(taskId: string): TripoAnimationTaskResponse {
  const ageMs = Date.now() - getMockTaskTimestamp(taskId);
  const kind = getMockTaskKind(taskId);

  let status: TripoAnimationStatus = "queued";
  let riggedModelUrl: string | null = null;
  let animatedModelUrl: string | null = null;

  if (ageMs >= 12_000) {
    status = "success";

    if (kind === "rig") {
      riggedModelUrl = `https://example.com/mock/tripo/${taskId}-rigged.glb`;
    }

    if (kind === "retarget") {
      animatedModelUrl = `https://example.com/mock/tripo/${taskId}-animated.glb`;
    }
  } else if (ageMs >= 4_000) {
    status = "running";
  }

  const modelUrl = animatedModelUrl ?? riggedModelUrl;

  return {
    taskId,
    kind,
    status,
    rigStatus: getRigStatusForTask(kind, status, {
      riggedModelUrl,
      animatedModelUrl,
    }),
    mock: true,
    modelUrl,
    riggedModelUrl,
    animatedModelUrl,
    raw: {
      code: 0,
      data: {
        task_id: taskId,
        type:
          kind === "prerigcheck"
            ? "animate_prerigcheck"
            : kind === "retarget"
              ? "animate_retarget"
              : "animate_rig",
        status,
        output:
          kind === "prerigcheck"
            ? {
                riggable: true,
                rig_type: "biped",
              }
            : {
                model: modelUrl,
                rigged_model: riggedModelUrl,
                animated_model: animatedModelUrl,
              },
        mock: true,
      },
    },
  };
}

export async function createPreRigCheckTask(input: {
  sourceTaskId?: string;
  sourceModelUrl?: string;
}): Promise<TripoAnimationCreateTaskResponse> {
  const sourceTaskId = resolveSourceTaskId(input);

  if (shouldUseMockTripo()) {
    const taskId = buildMockTaskId("prerigcheck");

    return {
      ...buildMockAnimationTaskStatus(taskId),
      message:
        "Using mock Tripo PreRigCheck because USE_MOCK_TRIPO is enabled or TRIPO_API_KEY is missing.",
    };
  }

  const payload = await requestTripo("/task", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "animate_prerigcheck",
      original_model_task_id: sourceTaskId,
    }),
  });

  return {
    taskId: getTaskId(payload),
    kind: "prerigcheck",
    status:
      normalizeTripoAnimationStatus(payload) === "unknown"
        ? "queued"
        : normalizeTripoAnimationStatus(payload),
    rigStatus: "prerigcheck",
    mock: false,
    modelUrl: null,
    riggedModelUrl: null,
    animatedModelUrl: null,
    raw: asObject(payload),
    message: "Tripo PreRigCheck task created successfully.",
  };
}

export async function createRigTask(input: {
  sourceTaskId?: string;
  sourceModelUrl?: string;
}): Promise<TripoAnimationCreateTaskResponse> {
  const sourceTaskId = resolveSourceTaskId(input);

  if (shouldUseMockTripo()) {
    const taskId = buildMockTaskId("rig");

    return {
      ...buildMockAnimationTaskStatus(taskId),
      message:
        "Using mock Tripo rig task because USE_MOCK_TRIPO is enabled or TRIPO_API_KEY is missing.",
    };
  }

  const payload = await requestTripo("/task", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "animate_rig",
      original_model_task_id: sourceTaskId,
      out_format: "glb",
      spec: "tripo",
    }),
  });
  const riggedModelUrl = extractRiggedModelUrl(payload);
  const normalizedStatus = normalizeTripoAnimationStatus(payload);
  const status = normalizedStatus === "unknown" ? "queued" : normalizedStatus;

  return {
    taskId: getTaskId(payload),
    kind: "rig",
    status,
    rigStatus: getRigStatusForTask("rig", status, { riggedModelUrl }),
    mock: false,
    modelUrl: riggedModelUrl,
    riggedModelUrl,
    animatedModelUrl: null,
    raw: asObject(payload),
    message: "Tripo rig task created successfully.",
  };
}

export async function createRetargetTask(input: {
  sourceTaskId?: string;
  sourceModelUrl?: string;
  presetId?: TripoAnimationPresetId;
  animationName?: string;
}): Promise<TripoAnimationCreateTaskResponse> {
  const sourceTaskId = resolveSourceTaskId(input);
  const animation = getAnimationName(input.presetId, input.animationName);

  if (shouldUseMockTripo()) {
    const taskId = buildMockTaskId("retarget");

    return {
      ...buildMockAnimationTaskStatus(taskId),
      message:
        "Using mock Tripo animation retarget task because USE_MOCK_TRIPO is enabled or TRIPO_API_KEY is missing.",
    };
  }

  const payload = await requestTripo("/task", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "animate_retarget",
      original_model_task_id: sourceTaskId,
      out_format: "glb",
      animation,
      bake_animation: true,
      export_with_geometry: true,
      animate_in_place: false,
    }),
  });
  const animatedModelUrl = extractAnimatedModelUrl(payload);
  const normalizedStatus = normalizeTripoAnimationStatus(payload);
  const status = normalizedStatus === "unknown" ? "queued" : normalizedStatus;

  return {
    taskId: getTaskId(payload),
    kind: "retarget",
    status,
    rigStatus: getRigStatusForTask("retarget", status, {
      animatedModelUrl,
    }),
    mock: false,
    modelUrl: animatedModelUrl,
    riggedModelUrl: null,
    animatedModelUrl,
    raw: asObject(payload),
    message: "Tripo animation retarget task created successfully.",
  };
}

export async function getTripoAnimationTask(
  taskId: string,
): Promise<TripoAnimationTaskResponse> {
  if (shouldUseMockTripo() || taskId.startsWith("mock-")) {
    return buildMockAnimationTaskStatus(taskId);
  }

  const payload = await requestTripo(`/task/${encodeURIComponent(taskId)}`, {
    method: "GET",
  });
  const status = normalizeTripoAnimationStatus(payload);
  const kind = getTaskKind(payload);
  const extractedRiggedModelUrl = extractRiggedModelUrl(payload);
  const extractedAnimatedModelUrl = extractAnimatedModelUrl(payload);
  const riggedModelUrl =
    kind === "retarget" ? null : extractedRiggedModelUrl;
  const animatedModelUrl =
    kind === "retarget" ? extractedAnimatedModelUrl : null;
  const modelUrl =
    kind === "retarget"
      ? animatedModelUrl ?? extractModelUrl(payload)
      : riggedModelUrl ?? extractModelUrl(payload);

  return {
    taskId: getTaskId(payload) ?? taskId,
    kind,
    status,
    rigStatus: getRigStatusForTask(kind, status, {
      riggedModelUrl,
      animatedModelUrl,
    }),
    mock: false,
    modelUrl,
    riggedModelUrl,
    animatedModelUrl,
    raw: extractApiResponseData(payload),
  };
}
