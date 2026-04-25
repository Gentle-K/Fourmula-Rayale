import { TripoCacheEntry } from "@/lib/types";

const DEFAULT_TTL_SECONDS = 3600;
const taskCache = new Map<string, TripoCacheEntry>();

export function getTripoCacheTtlSeconds() {
  const ttlValue = Number.parseInt(
    process.env.TRIPO_CACHE_TTL_SECONDS ?? "",
    10,
  );

  if (Number.isNaN(ttlValue) || ttlValue <= 0) {
    return DEFAULT_TTL_SECONDS;
  }

  return ttlValue;
}

function isExpired(entry: TripoCacheEntry) {
  return entry.expiresAt <= Date.now();
}

function pruneExpiredEntry(taskId: string, entry?: TripoCacheEntry | null) {
  if (!entry || !isExpired(entry)) {
    return entry ?? null;
  }

  taskCache.delete(taskId);
  return null;
}

export function getCachedTask(taskId: string) {
  return pruneExpiredEntry(taskId, taskCache.get(taskId));
}

export function setCachedTask(
  taskId: string,
  data: Omit<TripoCacheEntry, "cachedAt" | "expiresAt">,
) {
  const cachedAt = Date.now();
  const entry: TripoCacheEntry = {
    ...data,
    taskId,
    cachedAt,
    expiresAt: cachedAt + getTripoCacheTtlSeconds() * 1000,
  };

  taskCache.set(taskId, entry);

  return entry;
}

export function listCachedTasks() {
  const entries = Array.from(taskCache.entries())
    .map(([taskId, entry]) => pruneExpiredEntry(taskId, entry))
    .filter((entry): entry is TripoCacheEntry => Boolean(entry));

  return entries.sort((left, right) => right.cachedAt - left.cachedAt);
}
