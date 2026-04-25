// Tripo3D API client. We hit the public endpoints described at
// https://platform.tripo3d.ai/docs and poll the task until completion.
// All requests run server-side; the API key never reaches the browser.

const BASE = "https://api.tripo3d.ai/v2/openapi"

type CreateTaskResponse = {
  code: number
  data: { task_id: string }
  message?: string
}

type TaskStatusResponse = {
  code: number
  data: {
    task_id: string
    status: string // queued / running / success / failed / banned / expired
    progress?: number
    input?: Record<string, unknown>
    output?: {
      model?: string
      pbr_model?: string
      base_model?: string
      rendered_image?: string
    }
    result?: {
      model?: { url?: string; type?: string }
      pbr_model?: { url?: string }
      rendered_image?: { url?: string }
    }
    error_msg?: string
  }
  message?: string
}

function getKey() {
  const k = process.env.TRIPO_API_KEY?.trim()
  if (!k) throw new Error("TRIPO_API_KEY not set")
  return k
}

export function hasTripoKey() {
  return Boolean(process.env.TRIPO_API_KEY?.trim())
}

export async function createTextToModelTask(prompt: string): Promise<string> {
  const res = await fetch(`${BASE}/task`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getKey()}`,
    },
    body: JSON.stringify({
      type: "text_to_model",
      prompt,
      // sensible defaults for a low-poly habitat asset
      model_version: "v2.5-20250123",
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Tripo create failed: ${res.status} ${body}`)
  }
  const json = (await res.json()) as CreateTaskResponse
  if (json.code !== 0 || !json.data?.task_id) {
    throw new Error(`Tripo create error: ${json.message ?? "unknown"}`)
  }
  return json.data.task_id
}

export async function getTaskStatus(taskId: string): Promise<TaskStatusResponse["data"]> {
  const res = await fetch(`${BASE}/task/${taskId}`, {
    headers: { Authorization: `Bearer ${getKey()}` },
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Tripo status failed: ${res.status} ${body}`)
  }
  const json = (await res.json()) as TaskStatusResponse
  if (json.code !== 0) {
    throw new Error(`Tripo status error: ${json.message ?? "unknown"}`)
  }
  return json.data
}

export function extractModelUrl(data: TaskStatusResponse["data"]): string | undefined {
  return (
    data.result?.pbr_model?.url ??
    data.result?.model?.url ??
    data.output?.pbr_model ??
    data.output?.model ??
    data.output?.base_model
  )
}

export function extractThumbnail(data: TaskStatusResponse["data"]): string | undefined {
  return data.result?.rendered_image?.url ?? data.output?.rendered_image
}

export function isTerminal(status: string): "success" | "failed" | null {
  const s = status.toLowerCase()
  if (s === "success" || s === "succeeded") return "success"
  if (["failed", "banned", "expired", "cancelled", "canceled"].includes(s)) return "failed"
  return null
}
