import type { AssetItem, Episode, Policy, TaskSpec } from "./types"
import { emptyPolicy } from "./policy"
import { SEED_TASKS } from "./curriculum"

// In-memory server store. Survives across requests within the same Node process.
type Store = {
  tasks: Map<string, TaskSpec>
  episodes: Map<string, Episode>
  policies: Map<string, Policy>
  assets: Map<string, AssetItem>
  // SSE listeners per asset
  assetListeners: Map<string, Set<(chunk: string) => void>>
  initialized: boolean
}

declare global {
  // eslint-disable-next-line no-var
  var __orbitalStore: Store | undefined
}

function init(): Store {
  const s: Store = {
    tasks: new Map(),
    episodes: new Map(),
    policies: new Map(),
    assets: new Map(),
    assetListeners: new Map(),
    initialized: true,
  }
  for (const t of SEED_TASKS) s.tasks.set(t.id, t)
  const seedPolicy = emptyPolicy("baseline-v0")
  seedPolicy.taskFamily = SEED_TASKS.map((t) => t.id)
  s.policies.set(seedPolicy.id, seedPolicy)
  return s
}

export function store(): Store {
  if (!globalThis.__orbitalStore) {
    globalThis.__orbitalStore = init()
  }
  return globalThis.__orbitalStore
}

export function emitAssetEvent(assetId: string, payload: unknown) {
  const s = store()
  const set = s.assetListeners.get(assetId)
  if (!set) return
  const chunk = `data: ${JSON.stringify(payload)}\n\n`
  for (const fn of set) {
    try {
      fn(chunk)
    } catch {
      // ignore
    }
  }
}

export function subscribeAsset(assetId: string, fn: (chunk: string) => void) {
  const s = store()
  let set = s.assetListeners.get(assetId)
  if (!set) {
    set = new Set()
    s.assetListeners.set(assetId, set)
  }
  set.add(fn)
  return () => {
    set!.delete(fn)
    if (set!.size === 0) s.assetListeners.delete(assetId)
  }
}
