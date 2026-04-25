import {
  TripoCreateTaskResponse,
  TripoInputMode,
  TripoReferenceImage,
  TripoTaskStatus,
  TripoTaskStatusResponse,
  TRIPO_REFERENCE_IMAGE_ACCEPTED_MIME_TYPES,
  TRIPO_REFERENCE_IMAGE_MAX_BYTES,
} from "@/lib/types";
import { TRIPO_PROMPT_PRESETS } from "@/lib/tripoPresets";

const TRIPO_API_BASE_URL = "https://api.tripo3d.ai/v2/openapi";
const TRIPO_TASK_ENDPOINT = `${TRIPO_API_BASE_URL}/task`;
const TRIPO_UPLOAD_ENDPOINT = `${TRIPO_API_BASE_URL}/upload`;
const TEXT_TO_MODEL_TASK = "text_to_model";
const IMAGE_TO_MODEL_TASK = "image_to_model";

const MODEL_URL_PATHS = [
  ["output", "model"],
  ["output", "pbr_model"],
  ["output", "model_url"],
  ["output", "glb"],
  ["output", "glb_url"],
  ["output", "outputUrl"],
  ["output", "output_url"],
  ["output", "model", "url"],
  ["output", "pbr_model", "url"],
  ["data", "output", "model"],
  ["data", "output", "pbr_model"],
  ["data", "output", "model_url"],
  ["data", "output", "glb"],
  ["data", "output", "glb_url"],
  ["data", "output", "model", "url"],
  ["data", "output", "pbr_model", "url"],
  ["result", "output", "model"],
  ["result", "output", "pbr_model"],
  ["result", "output", "model_url"],
  ["result", "output", "glb"],
  ["result", "output", "glb_url"],
  ["result", "output", "model", "url"],
  ["result", "output", "pbr_model", "url"],
  ["result", "model"],
  ["result", "model", "url"],
  ["result", "pbr_model", "url"],
  ["data", "result", "model", "url"],
  ["data", "result", "pbr_model", "url"],
  ["data", "result", "output", "model", "url"],
  ["data", "result", "output", "pbr_model", "url"],
  ["model"],
  ["modelUrl"],
] as const;

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

const STATUS_PATHS = [
  ["status"],
  ["state"],
  ["data", "status"],
  ["data", "state"],
  ["result", "status"],
  ["result", "state"],
] as const;

const IMAGE_TOKEN_PATHS = [
  ["image_token"],
  ["data", "image_token"],
  ["result", "image_token"],
] as const;

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

function getNumberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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

function getTaskId(raw: unknown) {
  return getFirstStringFromPaths(raw, TASK_ID_PATHS) ?? `mock-text-${Date.now()}`;
}

function getRawStatus(raw: unknown) {
  return getFirstStringFromPaths(raw, STATUS_PATHS);
}

function normalizeStatusValue(value: string | null): TripoTaskStatus {
  switch (value?.toLowerCase()) {
    case "queued":
    case "pending":
    case "mock_queued":
      return "queued";
    case "running":
    case "processing":
    case "mock_running":
      return "running";
    case "success":
    case "finished":
    case "completed":
    case "mock_succeeded":
      return "success";
    case "failed":
    case "error":
      return "failed";
    case "banned":
      return "banned";
    case "expired":
      return "expired";
    case "cancelled":
    case "canceled":
      return "cancelled";
    default:
      return "unknown";
  }
}

export function normalizeStatus(raw: unknown): TripoTaskStatus {
  if (typeof raw === "string") {
    return normalizeStatusValue(raw);
  }

  return normalizeStatusValue(getRawStatus(raw));
}

function isLikelyModelUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

function findStringDeep(
  input: unknown,
  preferredKeys: readonly string[],
  visited = new WeakSet<object>(),
): string | null {
  if (typeof input === "string") {
    return isLikelyModelUrl(input) ? input : null;
  }

  if (!input || typeof input !== "object") {
    return null;
  }

  if (visited.has(input)) {
    return null;
  }

  visited.add(input);

  if (Array.isArray(input)) {
    for (const item of input) {
      const match = findStringDeep(item, preferredKeys, visited);
      if (match) {
        return match;
      }
    }

    return null;
  }

  const record = input as Record<string, unknown>;

  for (const key of preferredKeys) {
    const candidate = record[key];

    if (typeof candidate === "string" && isLikelyModelUrl(candidate)) {
      return candidate;
    }

    const nestedMatch = findStringDeep(candidate, preferredKeys, visited);
    if (nestedMatch) {
      return nestedMatch;
    }
  }

  return null;
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

function buildMockTaskId(inputMode: TripoInputMode) {
  return `mock-${inputMode}-${Date.now()}`;
}

function getMockTaskTimestamp(taskId: string) {
  const timestamp = taskId.match(/(\d{10,})$/)?.[1] ?? "";
  const parsedTimestamp = Number.parseInt(timestamp, 10);

  return Number.isNaN(parsedTimestamp) ? Date.now() : parsedTimestamp;
}

function getMockInputMode(taskId: string): TripoInputMode {
  return taskId.includes("-image-") ? "image" : "text";
}

function buildMockTaskStatus(taskId: string): TripoTaskStatusResponse {
  const ageMs = Date.now() - getMockTaskTimestamp(taskId);
  const inputMode = getMockInputMode(taskId);
  const taskType =
    inputMode === "image" ? IMAGE_TO_MODEL_TASK : TEXT_TO_MODEL_TASK;

  let status: TripoTaskStatus = "queued";
  let modelUrl: string | null = null;
  let progress = 0;

  if (ageMs >= 12_000) {
    status = "success";
    progress = 100;
    modelUrl = `https://example.com/mock/tripo/${taskId}.glb`;
  } else if (ageMs >= 4_000) {
    status = "running";
    progress = 62;
  }

  return {
    taskId,
    status,
    mock: true,
    modelUrl,
    raw: {
      code: 0,
      data: {
        task_id: taskId,
        type: taskType,
        status,
        output: modelUrl
          ? {
              model: modelUrl,
              glb_url: modelUrl,
            }
          : {},
        progress,
        mock: true,
      },
    },
  };
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

async function requestTripo(path: string, init: RequestInit) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${getApiKey()}`);

  const response = await fetch(`${TRIPO_API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const payload = await parseResponseBody(response);
  const responseCode = getNumberValue(asObject(payload).code);

  if (!response.ok || (responseCode !== null && responseCode !== 0)) {
    const apiMessage = getErrorMessage(payload);
    const fallbackMessage = response.ok
      ? "Tripo API returned an unexpected error."
      : `Tripo API request failed with status ${response.status}.`;

    throw new Error(apiMessage ?? fallbackMessage);
  }

  return payload;
}

export function describeTripoReferenceImage(file: File): TripoReferenceImage {
  return {
    name: file.name || "reference-image",
    type: file.type || "application/octet-stream",
    size: file.size,
  };
}

export function validateTripoReferenceImage(file: File) {
  if (!file.size) {
    return "Reference image is empty.";
  }

  if (
    file.type &&
    !TRIPO_REFERENCE_IMAGE_ACCEPTED_MIME_TYPES.includes(
      file.type as (typeof TRIPO_REFERENCE_IMAGE_ACCEPTED_MIME_TYPES)[number],
    )
  ) {
    return "Reference image must be JPEG, PNG, or WEBP.";
  }

  if (file.size > TRIPO_REFERENCE_IMAGE_MAX_BYTES) {
    return "Reference image must be 20MB or smaller.";
  }

  return null;
}

function getReferenceImageFileType(file: File) {
  const normalizedType = file.type.toLowerCase();
  const normalizedName = file.name.toLowerCase();

  if (normalizedType === "image/png" || normalizedName.endsWith(".png")) {
    return "png";
  }

  if (normalizedType === "image/webp" || normalizedName.endsWith(".webp")) {
    return "webp";
  }

  return "jpg";
}

async function uploadTripoReferenceImage(file: File) {
  const formData = new FormData();
  const fileType = getReferenceImageFileType(file);
  const fileName = file.name || `tripo-reference.${fileType}`;

  formData.append("file", file, fileName);

  const payload = await requestTripo("/upload", {
    method: "POST",
    body: formData,
  });
  const imageToken = getFirstStringFromPaths(payload, IMAGE_TOKEN_PATHS);

  if (!imageToken) {
    throw new Error(
      "Tripo image upload succeeded but no image token was returned.",
    );
  }

  return imageToken;
}

export function inferTripoInputMode(raw: unknown): TripoInputMode {
  const taskType = getFirstStringFromPaths(raw, [
    ["type"],
    ["data", "type"],
    ["result", "type"],
  ])?.toLowerCase();

  return taskType === IMAGE_TO_MODEL_TASK ? "image" : "text";
}

export function extractModelUrl(raw: unknown) {
  for (const path of MODEL_URL_PATHS) {
    const candidate = getStringValue(getNestedValue(raw, path));

    if (candidate && isLikelyModelUrl(candidate)) {
      return candidate;
    }
  }

  const searchRoots = [
    raw,
    getNestedValue(raw, ["output"]),
    getNestedValue(raw, ["data", "output"]),
    getNestedValue(raw, ["result"]),
    getNestedValue(raw, ["result", "output"]),
    getNestedValue(raw, ["data", "result"]),
    getNestedValue(raw, ["data", "result", "output"]),
  ];

  for (const root of searchRoots) {
    const deepMatch = findStringDeep(root, [
      "pbr_model",
      "model",
      "glb",
      "glb_url",
      "model_url",
      "modelUrl",
      "outputUrl",
      "url",
    ]);

    if (deepMatch) {
      return deepMatch;
    }
  }

  return null;
}

export async function createTripoTask({
  prompt,
  referenceImage,
}: {
  prompt: string;
  referenceImage?: File | null;
}): Promise<TripoCreateTaskResponse> {
  const inputMode: TripoInputMode = referenceImage ? "image" : "text";
  const referenceImageMeta = referenceImage
    ? describeTripoReferenceImage(referenceImage)
    : null;

  if (referenceImage) {
    const validationError = validateTripoReferenceImage(referenceImage);

    if (validationError) {
      throw new Error(validationError);
    }
  }

  if (shouldUseMockTripo()) {
    const taskId = buildMockTaskId(inputMode);

    return {
      taskId,
      status: "queued",
      mock: true,
      inputMode,
      referenceImage: referenceImageMeta,
      message:
        inputMode === "image"
          ? "Using mock Tripo image task because USE_MOCK_TRIPO is enabled or TRIPO_API_KEY is missing."
          : "Using mock Tripo text task because USE_MOCK_TRIPO is enabled or TRIPO_API_KEY is missing.",
      raw: {
        code: 0,
        data: {
          task_id: taskId,
          status: "queued",
          type: inputMode === "image" ? IMAGE_TO_MODEL_TASK : TEXT_TO_MODEL_TASK,
          prompt,
          mock: true,
        },
      },
    };
  }

  if (referenceImage) {
    const imageToken = await uploadTripoReferenceImage(referenceImage);
    const payload = await requestTripo("/task", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: IMAGE_TO_MODEL_TASK,
        file: {
          type: getReferenceImageFileType(referenceImage),
          file_token: imageToken,
        },
        ...(prompt ? { prompt } : {}),
      }),
    });
    const status = normalizeStatus(payload);

    return {
      taskId: getTaskId(payload),
      status: status === "unknown" ? "queued" : status,
      mock: false,
      inputMode,
      referenceImage: referenceImageMeta,
      message: prompt
        ? "Tripo image-to-3D task created successfully with prompt guidance."
        : "Tripo image-to-3D task created successfully.",
      raw: asObject(payload),
    };
  }

  const payload = await requestTripo("/task", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: TEXT_TO_MODEL_TASK,
      prompt,
    }),
  });
  const status = normalizeStatus(payload);

  return {
    taskId: getTaskId(payload),
    status: status === "unknown" ? "queued" : status,
    mock: false,
    inputMode,
    referenceImage: null,
    message: "Tripo text-to-3D task created successfully.",
    raw: asObject(payload),
  };
}

export async function getTripoTask(
  taskId: string,
): Promise<TripoTaskStatusResponse> {
  if (shouldUseMockTripo() || taskId.startsWith("mock-")) {
    return buildMockTaskStatus(taskId);
  }

  const payload = await requestTripo(`/task/${encodeURIComponent(taskId)}`, {
    method: "GET",
  });
  const taskData = extractApiResponseData(payload);

  return {
    taskId: getTaskId(payload) ?? taskId,
    status: normalizeStatus(payload),
    mock: false,
    modelUrl: extractModelUrl(payload),
    raw: taskData,
  };
}

export {
  TRIPO_PROMPT_PRESETS,
  TRIPO_TASK_ENDPOINT,
  TRIPO_UPLOAD_ENDPOINT,
};
