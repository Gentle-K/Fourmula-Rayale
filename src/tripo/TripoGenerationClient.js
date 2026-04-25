const TERMINAL_SUCCESS = new Set(["success", "succeeded", "completed", "finished"]);
const TERMINAL_FAILURE = new Set(["failed", "error", "banned", "expired", "cancelled", "canceled"]);

async function parseJsonResponse(response) {
  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { rawText: text };
    }
  }
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || payload.message || `Request failed with status ${response.status}.`);
  }
  return payload;
}

export class TripoGenerationClient {
  constructor({ baseUrl = "" } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async generate(request) {
    const response = await fetch(`${this.baseUrl}/api/tripo/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    return parseJsonResponse(response);
  }

  async getTask(taskId) {
    const response = await fetch(`${this.baseUrl}/api/tripo/task?taskId=${encodeURIComponent(taskId)}`, { cache: "no-store" });
    return parseJsonResponse(response);
  }

  async createRig({ sourceTaskId, sourceModelUrl, assetId }) {
    const response = await fetch(`${this.baseUrl}/api/tripo/rig`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceTaskId,
        sourceModelUrl,
        assetId,
        assetKind: "robot_replacement",
      }),
    });
    return parseJsonResponse(response);
  }

  async getRigTask(taskId) {
    const response = await fetch(`${this.baseUrl}/api/tripo/rig-task?taskId=${encodeURIComponent(taskId)}`, { cache: "no-store" });
    return parseJsonResponse(response);
  }

  async waitForTask(taskId, { type = "model", onProgress = () => {}, pollMs = 4000, timeoutMs = 420000 } = {}) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const result = type === "rig" ? await this.getRigTask(taskId) : await this.getTask(taskId);
      const status = String(result.status || result.rigStatus || "").toLowerCase();
      onProgress(result);
      if (TERMINAL_SUCCESS.has(status) && (result.modelUrl || result.riggedModelUrl)) return result;
      if (TERMINAL_FAILURE.has(status)) throw new Error(`Tripo ${type} task ${taskId} failed with status ${result.status}.`);
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    throw new Error(`Timed out waiting for Tripo ${type} task ${taskId}.`);
  }
}
