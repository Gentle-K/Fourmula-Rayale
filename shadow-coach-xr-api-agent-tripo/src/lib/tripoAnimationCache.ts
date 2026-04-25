import { getTripoCacheTtlSeconds } from "@/lib/tripoCache";
import { TripoAnimationCacheEntry } from "@/lib/types";

const animationTaskCache = new Map<string, TripoAnimationCacheEntry>();

function isExpired(entry: TripoAnimationCacheEntry) {
  return entry.expiresAt <= Date.now();
}

function pruneExpiredEntry(
  taskId: string,
  entry?: TripoAnimationCacheEntry | null,
) {
  if (!entry || !isExpired(entry)) {
    return entry ?? null;
  }

  animationTaskCache.delete(taskId);
  return null;
}

export function getCachedAnimationTask(taskId: string) {
  return pruneExpiredEntry(taskId, animationTaskCache.get(taskId));
}

export function setCachedAnimationTask(
  taskId: string,
  data: Omit<TripoAnimationCacheEntry, "cachedAt" | "expiresAt">,
) {
  const cachedAt = Date.now();
  const entry: TripoAnimationCacheEntry = {
    ...data,
    taskId,
    cachedAt,
    expiresAt: cachedAt + getTripoCacheTtlSeconds() * 1000,
  };

  animationTaskCache.set(taskId, entry);

  return entry;
}

export function listCachedAnimationTasks() {
  const entries = Array.from(animationTaskCache.entries())
    .map(([taskId, entry]) => pruneExpiredEntry(taskId, entry))
    .filter((entry): entry is TripoAnimationCacheEntry => Boolean(entry));

  return entries.sort((left, right) => right.cachedAt - left.cachedAt);
}
