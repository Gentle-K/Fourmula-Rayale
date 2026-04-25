const TRIPO_API_BASE_URL = "https://api.tripo3d.ai/v2/openapi";

const TEXT_TO_MODEL_TASK = "text_to_model";
const IMAGE_TO_MODEL_TASK = "image_to_model";

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
];

const STATUS_PATHS = [
  ["status"],
  ["state"],
  ["data", "status"],
  ["data", "state"],
  ["result", "status"],
  ["result", "state"],
];

const MODEL_URL_PATHS = [
  ["output", "model"],
  ["output", "pbr_model"],
  ["output", "model_url"],
  ["output", "glb"],
  ["output", "glb_url"],
  ["output", "rigged_model"],
  ["output", "animated_model"],
  ["output", "model", "url"],
  ["output", "pbr_model", "url"],
  ["data", "output", "model"],
  ["data", "output", "pbr_model"],
  ["data", "output", "rigged_model"],
  ["data", "output", "animated_model"],
  ["data", "output", "model", "url"],
  ["data", "output", "pbr_model", "url"],
  ["result", "output", "model"],
  ["result", "output", "pbr_model"],
  ["result", "output", "rigged_model"],
  ["result", "output", "animated_model"],
  ["result", "model"],
  ["result", "model", "url"],
  ["result", "pbr_model", "url"],
  ["model"],
  ["modelUrl"],
];

const THUMBNAIL_URL_PATHS = [
  ["output", "rendered_image"],
  ["output", "rendered_image", "url"],
  ["data", "output", "rendered_image"],
  ["data", "output", "rendered_image", "url"],
  ["result", "rendered_image", "url"],
  ["result", "output", "rendered_image"],
  ["result", "output", "rendered_image", "url"],
  ["thumbnailUrl"],
];

const IMAGE_TOKEN_PATHS = [
  ["image_token"],
  ["data", "image_token"],
  ["result", "image_token"],
];

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function getStringValue(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getNumberValue(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getNestedValue(input, path) {
  let current = input;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return null;
    current = current[segment];
  }
  return current ?? null;
}

function getFirstStringFromPaths(input, paths) {
  for (const path of paths) {
    const value = getStringValue(getNestedValue(input, path));
    if (value) return value;
  }
  return null;
}

function isLikelyModelUrl(value) {
  return typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://"));
}

function findStringDeep(input, preferredKeys, visited = new WeakSet()) {
  if (typeof input === "string") return isLikelyModelUrl(input) ? input : null;
  if (!input || typeof input !== "object") return null;
  if (visited.has(input)) return null;
  visited.add(input);

  if (Array.isArray(input)) {
    for (const item of input) {
      const match = findStringDeep(item, preferredKeys, visited);
      if (match) return match;
    }
    return null;
  }

  for (const key of preferredKeys) {
    const candidate = input[key];
    if (isLikelyModelUrl(candidate)) return candidate;
    const nested = findStringDeep(candidate, preferredKeys, visited);
    if (nested) return nested;
  }
  return null;
}

function normalizeStatus(raw) {
  const value = typeof raw === "string" ? raw : getFirstStringFromPaths(raw, STATUS_PATHS);
  switch (value?.toLowerCase()) {
    case "queued":
    case "pending":
      return "queued";
    case "running":
    case "processing":
      return "running";
    case "success":
    case "succeeded":
    case "finished":
    case "completed":
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

function getTaskId(raw) {
  return getFirstStringFromPaths(raw, TASK_ID_PATHS);
}

function extractUrl(raw, paths, preferredKeys) {
  for (const path of paths) {
    const candidate = getStringValue(getNestedValue(raw, path));
    if (candidate && isLikelyModelUrl(candidate)) return candidate;
  }
  const roots = [
    raw,
    getNestedValue(raw, ["output"]),
    getNestedValue(raw, ["data", "output"]),
    getNestedValue(raw, ["result"]),
    getNestedValue(raw, ["result", "output"]),
    getNestedValue(raw, ["data", "result"]),
    getNestedValue(raw, ["data", "result", "output"]),
  ];
  for (const root of roots) {
    const deep = findStringDeep(root, preferredKeys);
    if (deep) return deep;
  }
  return null;
}

function extractModelUrl(raw) {
  return extractUrl(raw, MODEL_URL_PATHS, [
    "rigged_model",
    "animated_model",
    "pbr_model",
    "model",
    "glb",
    "glb_url",
    "model_url",
    "modelUrl",
    "url",
  ]);
}

function extractThumbnailUrl(raw) {
  return extractUrl(raw, THUMBNAIL_URL_PATHS, ["rendered_image", "thumbnail", "preview", "url"]);
}

function getApiKey() {
  return process.env.TRIPO_API_KEY?.trim() ?? "";
}

function shouldUseMockTripo() {
  return process.env.USE_MOCK_TRIPO?.toLowerCase() === "true";
}

function getErrorMessage(payload) {
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
    asObject(raw.result).message,
    asObject(raw.result).error,
    asObject(raw.result).detail,
  ];
  for (const candidate of candidates) {
    const message = getStringValue(candidate);
    if (message) return message;
  }
  return null;
}

async function parseResponseBody(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text };
  }
}

async function requestTripo(path, init) {
  const key = getApiKey();
  if (!key) throw new Error("TRIPO_API_KEY not set");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${key}`);

  const response = await fetch(`${TRIPO_API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  const payload = await parseResponseBody(response);
  const responseCode = getNumberValue(asObject(payload).code);
  if (!response.ok || (responseCode !== null && responseCode !== 0)) {
    const apiMessage = getErrorMessage(payload);
    const fallback = response.ok
      ? "Tripo API returned an unexpected error."
      : `Tripo API request failed with status ${response.status}.`;
    throw new Error(apiMessage ?? fallback);
  }
  return payload;
}

function mockTaskStatus(taskId, kind = "model") {
  const timestamp = Number.parseInt(taskId.match(/(\d{10,})$/)?.[1] ?? "", 10);
  const ageMs = Date.now() - (Number.isNaN(timestamp) ? Date.now() : timestamp);
  const status = ageMs >= 12_000 ? "success" : ageMs >= 4_000 ? "running" : "queued";
  const modelUrl = status === "success" ? `https://example.com/mock/tripo/${taskId}-${kind}.glb` : null;
  return {
    ok: true,
    taskId,
    status,
    progress: status === "success" ? 1 : status === "running" ? 0.62 : 0.05,
    modelUrl,
    thumbnailUrl: null,
    mock: true,
    raw: { code: 0, data: { task_id: taskId, status, output: { model: modelUrl }, mock: true } },
  };
}

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function getAssetKind(rawInput, explicitKind) {
  if (explicitKind) return explicitKind;
  const input = String(rawInput ?? "").toLowerCase();
  if (/(robot|agent|character|humanoid|arm|leg|walk|replace robot|maintenance robot)/.test(input)) {
    return "robot_replacement";
  }
  if (/(floor plan|layout|blueprint|平面图|布局)/.test(input)) return "scene_layout";
  return "scene_object";
}

function buildMockCreateTask(assetKind) {
  const taskId = `mock-${assetKind}-${Date.now()}`;
  return { taskId, status: "queued", mock: true, raw: { code: 0, data: { task_id: taskId, status: "queued", mock: true } } };
}

async function uploadBase64ReferenceImage({ imageBase64, imageMime }) {
  if (!imageBase64) return null;
  const mime = imageMime || "image/png";
  if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(mime)) {
    throw new Error("Reference image must be JPEG, PNG, or WEBP.");
  }
  const cleanBase64 = imageBase64.includes(",") ? imageBase64.split(",").pop() : imageBase64;
  const buffer = Buffer.from(cleanBase64, "base64");
  if (!buffer.length) throw new Error("Reference image is empty.");
  if (buffer.length > 20 * 1024 * 1024) throw new Error("Reference image must be 20MB or smaller.");

  const fileType = mime.includes("webp") ? "webp" : mime.includes("png") ? "png" : "jpg";
  const formData = new FormData();
  formData.append("file", new Blob([buffer], { type: mime }), `tripo-reference.${fileType}`);
  const payload = await requestTripo("/upload", { method: "POST", body: formData });
  const token = getFirstStringFromPaths(payload, IMAGE_TOKEN_PATHS);
  if (!token) throw new Error("Tripo image upload succeeded but no image token was returned.");
  return { fileType, token };
}

async function createModelTask({ prompt, imageBase64, imageMime, assetKind }) {
  if (shouldUseMockTripo()) return buildMockCreateTask(assetKind);

  const image = await uploadBase64ReferenceImage({ imageBase64, imageMime });
  const body = image
    ? { type: IMAGE_TO_MODEL_TASK, file: { type: image.fileType, file_token: image.token }, ...(prompt ? { prompt } : {}) }
    : { type: TEXT_TO_MODEL_TASK, prompt };

  const payload = await requestTripo("/task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    taskId: getTaskId(payload),
    status: normalizeStatus(payload) === "unknown" ? "queued" : normalizeStatus(payload),
    mock: false,
    raw: payload,
  };
}

async function getModelTask(taskId) {
  if (shouldUseMockTripo() || taskId.startsWith("mock-")) return mockTaskStatus(taskId, "model");
  const payload = await requestTripo(`/task/${encodeURIComponent(taskId)}`, { method: "GET" });
  const status = normalizeStatus(payload);
  const progress = getNumberValue(getNestedValue(payload, ["data", "progress"])) ?? getNumberValue(getNestedValue(payload, ["progress"]));
  return {
    ok: true,
    taskId: getTaskId(payload) ?? taskId,
    status,
    progress: typeof progress === "number" ? Math.max(0, Math.min(1, progress > 1 ? progress / 100 : progress)) : null,
    modelUrl: extractModelUrl(payload),
    thumbnailUrl: extractThumbnailUrl(payload),
    mock: false,
    raw: payload,
  };
}

async function createRigTask({ sourceTaskId }) {
  if (shouldUseMockTripo()) {
    const taskId = `mock-rig-${Date.now()}`;
    return { taskId, status: "queued", rigStatus: "rigging", riggedModelUrl: null, raw: { code: 0, data: { task_id: taskId, status: "queued", mock: true } }, mock: true };
  }
  if (!sourceTaskId) throw new Error("sourceTaskId is required for Tripo rig tasks.");
  const payload = await requestTripo("/task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "animate_rig",
      original_model_task_id: sourceTaskId,
      out_format: "glb",
      spec: "tripo",
    }),
  });
  const status = normalizeStatus(payload);
  const riggedModelUrl = extractModelUrl(payload);
  return {
    taskId: getTaskId(payload),
    status: status === "unknown" ? "queued" : status,
    rigStatus: status === "success" ? "rigged" : "rigging",
    riggedModelUrl,
    raw: payload,
    mock: false,
  };
}

async function getRigTask(taskId) {
  if (shouldUseMockTripo() || taskId.startsWith("mock-")) {
    const status = mockTaskStatus(taskId, "rigged");
    return { ...status, rigStatus: status.status === "success" ? "rigged" : "rigging", riggedModelUrl: status.modelUrl };
  }
  const payload = await requestTripo(`/task/${encodeURIComponent(taskId)}`, { method: "GET" });
  const status = normalizeStatus(payload);
  const riggedModelUrl = extractModelUrl(payload);
  return {
    ok: true,
    taskId: getTaskId(payload) ?? taskId,
    status,
    progress: null,
    rigStatus: status === "success" ? "rigged" : status === "failed" ? "failed" : "rigging",
    modelUrl: riggedModelUrl,
    riggedModelUrl,
    mock: false,
    raw: payload,
  };
}

module.exports = {
  createModelTask,
  createRigTask,
  getAssetKind,
  getModelTask,
  getRigTask,
  json,
  readJsonBody,
};
