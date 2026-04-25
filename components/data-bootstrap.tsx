"use client"
import { useEffect } from "react"
import useSWR from "swr"
import { useHabitat } from "@/lib/store"
import type { Episode, Policy, TaskSpec, AssetItem } from "@/lib/types"

const fetcher = (u: string) => fetch(u).then((r) => r.json())

/**
 * Hydrates the Zustand store from server endpoints on mount and refreshes
 * periodically. Mounted once at the page root so child components can
 * focus on UI without re-fetching.
 */
export function DataBootstrap() {
  const setTasks = useHabitat((s) => s.setTasks)
  const setEpisodes = useHabitat((s) => s.setEpisodes)
  const setPolicies = useHabitat((s) => s.setPolicies)
  const setAssets = useHabitat((s) => s.setAssets)

  const tasks = useSWR<{ tasks: TaskSpec[] }>("/api/tasks", fetcher, { refreshInterval: 12000 })
  const episodes = useSWR<{ episodes: Episode[] }>("/api/episodes", fetcher, { refreshInterval: 6000 })
  const policies = useSWR<{ policies: Policy[] }>("/api/policies", fetcher, { refreshInterval: 12000 })
  const assets = useSWR<{ assets: AssetItem[] }>("/api/assets", fetcher, { refreshInterval: 8000 })

  useEffect(() => {
    if (tasks.data?.tasks) setTasks(tasks.data.tasks)
  }, [tasks.data]) // eslint-disable-line
  useEffect(() => {
    if (episodes.data?.episodes) setEpisodes(episodes.data.episodes)
  }, [episodes.data]) // eslint-disable-line
  useEffect(() => {
    if (policies.data?.policies) setPolicies(policies.data.policies)
  }, [policies.data]) // eslint-disable-line
  useEffect(() => {
    if (assets.data?.assets) setAssets(assets.data.assets)
  }, [assets.data]) // eslint-disable-line

  return null
}
