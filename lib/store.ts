"use client"

import { create } from "zustand"
import type {
  Action,
  AssetItem,
  ControlMode,
  Episode,
  InterventionEvent,
  ScenePhase,
  StepRecord,
  Policy,
  TaskSpec,
} from "./types"
import { initSim, stepSim, buildFeatures, type SimState } from "./simulator"
import { policyAct } from "./policy"
import { shortId } from "./utils"

type RunState = "idle" | "running" | "paused" | "completed"

type State = {
  // catalog
  tasks: TaskSpec[]
  episodes: Episode[]
  policies: Policy[]
  assets: AssetItem[]
  // selection
  activeTaskId: string | null
  activePolicyId: string | null
  mode: ControlMode
  // runtime
  scenePhase: ScenePhase
  sim: SimState | null
  steps: StepRecord[]
  runState: RunState
  robotAssetId: string | null
  intervention: {
    active: boolean
    reason: string | null
    startedAtStep: number | null
  }
  interventions: InterventionEvent[]
  deadlock: {
    active: boolean
    staleSteps: number
    bestReward: number
    lastImprovementStep: number
  }
  // replay
  replayIndex: number
  replayEpisodeId: string | null
  // metrics
  trainingProgress: {
    iter: number
    total: number
    eliteAvg: number
    best: number
    successRate: number
    history: { iter: number; eliteAvg: number; best: number; successRate: number }[]
  } | null
  // input (manual)
  manualInput: Action

  // actions
  setTasks: (t: TaskSpec[]) => void
  addTask: (t: TaskSpec) => void
  setPolicies: (p: Policy[]) => void
  upsertPolicy: (p: Policy) => void
  setEpisodes: (e: Episode[]) => void
  addEpisode: (e: Episode) => void
  setAssets: (a: AssetItem[]) => void
  upsertAsset: (a: AssetItem) => void
  setActiveTask: (id: string | null) => void
  setActivePolicy: (id: string | null) => void
  setMode: (m: ControlMode) => void
  setManual: (a: Partial<Action>) => void
  enterHabitat: () => void
  returnToOrbit: () => void
  applyRobotAsset: (assetId: string) => void
  insertAssetAsTask: (assetId: string, taskPreset?: "dock" | "grasp" | "open-cap" | "inspect") => Promise<void>
  beginIntervention: (reason: string) => void
  endIntervention: () => void
  startRun: () => void
  pauseRun: () => void
  resumeRun: () => void
  stopRun: () => void
  resetRun: () => void
  tickManual: () => void
  tickAuto: () => void
  startReplay: (episodeId: string) => void
  tickReplay: () => boolean
  setTrainingProgress: (p: State["trainingProgress"]) => void
}

export const useHabitat = create<State>((set, get) => ({
  tasks: [],
  episodes: [],
  policies: [],
  assets: [],
  activeTaskId: null,
  activePolicyId: null,
  mode: "manual",
  scenePhase: "orbit",
  sim: null,
  steps: [],
  runState: "idle",
  robotAssetId: null,
  intervention: { active: false, reason: null, startedAtStep: null },
  interventions: [],
  deadlock: { active: false, staleSteps: 0, bestReward: -Infinity, lastImprovementStep: 0 },
  replayIndex: 0,
  replayEpisodeId: null,
  trainingProgress: null,
  manualInput: { base: 0, shoulder: 0, elbow: 0, wrist: 0, grip: 0, thrust: 0 },

  setTasks: (t) => set({ tasks: t, activeTaskId: get().activeTaskId ?? t[0]?.id ?? null }),
  addTask: (t) => set((s) => ({ tasks: [t, ...s.tasks], activeTaskId: s.activeTaskId ?? t.id })),
  setPolicies: (p) => set({ policies: p, activePolicyId: get().activePolicyId ?? p[0]?.id ?? null }),
  upsertPolicy: (p) =>
    set((s) => {
      const idx = s.policies.findIndex((x) => x.id === p.id)
      const next = [...s.policies]
      if (idx >= 0) next[idx] = p
      else next.unshift(p)
      return { policies: next, activePolicyId: s.activePolicyId ?? p.id }
    }),
  setEpisodes: (e) => set({ episodes: e }),
  addEpisode: (e) => set((s) => ({ episodes: [e, ...s.episodes].slice(0, 200) })),
  setAssets: (a) => set({ assets: a }),
  upsertAsset: (a) =>
    set((s) => {
      const idx = s.assets.findIndex((x) => x.id === a.id)
      const next = [...s.assets]
      if (idx >= 0) next[idx] = a
      else next.unshift(a)
      return { assets: next }
    }),
  setActiveTask: (id) => set({ activeTaskId: id }),
  setActivePolicy: (id) => set({ activePolicyId: id }),
  setMode: (m) => set({ mode: m, runState: "idle", sim: null, steps: [], replayIndex: 0 }),
  setManual: (a) => set((s) => ({ manualInput: { ...s.manualInput, ...a } })),
  enterHabitat: () => {
    set({ scenePhase: "transitioning" })
    window.setTimeout(() => {
      useHabitat.setState({ scenePhase: "habitat" })
    }, 850)
  },
  returnToOrbit: () =>
    set({
      scenePhase: "orbit",
      runState: "idle",
      sim: null,
      steps: [],
      replayIndex: 0,
      replayEpisodeId: null,
      intervention: { active: false, reason: null, startedAtStep: null },
    }),
  applyRobotAsset: (assetId) => {
    const asset = get().assets.find((a) => a.id === assetId)
    if (!asset || asset.kind !== "robot" || asset.status !== "succeeded" || !asset.modelUrl) return
    set({ robotAssetId: assetId })
  },
  insertAssetAsTask: async (assetId, taskPreset = "dock") => {
    const asset = get().assets.find((a) => a.id === assetId)
    if (!asset || asset.kind === "robot" || asset.status !== "succeeded" || !asset.modelUrl) return
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId,
        taskPreset,
        difficulty: 0.45,
        name: asset.prompt.slice(0, 18),
      }),
    }).then((r) => r.json())
    if (res.task) {
      get().addTask(res.task)
      get().setActiveTask(res.task.id)
      get().enterHabitat()
    }
  },
  beginIntervention: (reason) => {
    const s = get()
    if (!s.sim || s.runState !== "running") return
    set({ intervention: { active: true, reason, startedAtStep: s.sim.step } })
  },
  endIntervention: () => {
    const s = get()
    if (!s.intervention.active) return
    const startedAtStep = s.intervention.startedAtStep ?? s.sim?.step ?? 0
    const endedAtStep = s.sim?.step ?? startedAtStep
    const slice = s.steps.filter((step) => step.t >= startedAtStep && step.t <= endedAtStep)
    const event: InterventionEvent = {
      id: "iv_" + shortId(),
      reason: s.intervention.reason ?? "assist",
      startedAtStep,
      endedAtStep,
      durationSteps: Math.max(0, endedAtStep - startedAtStep),
      taskId: s.sim?.task.id,
      targetId: s.sim?.task.target.id,
      actions: slice.map((step) => step.action),
      targetPositions: slice.map((step) => step.targetPos),
      createdAt: Date.now(),
    }
    set((cur) => ({
      intervention: { active: false, reason: null, startedAtStep: null },
      interventions: [...cur.interventions, event],
      deadlock: { ...cur.deadlock, active: false, staleSteps: 0, lastImprovementStep: endedAtStep },
    }))
  },

  startRun: () => {
    const s = get()
    const task = s.tasks.find((t) => t.id === s.activeTaskId)
    if (!task) return
    set({
      sim: initSim(task, Date.now() & 0xffff),
      steps: [],
      runState: "running",
      interventions: [],
      intervention: { active: false, reason: null, startedAtStep: null },
      deadlock: { active: false, staleSteps: 0, bestReward: -Infinity, lastImprovementStep: 0 },
    })
  },
  pauseRun: () => set({ runState: "paused" }),
  resumeRun: () => set({ runState: "running" }),
  stopRun: () => {
    const s = get()
    if (!s.sim) {
      set({ runState: "idle" })
      return
    }
    finalizeEpisode()
  },
  resetRun: () =>
    set({
      sim: null,
      steps: [],
      runState: "idle",
      replayIndex: 0,
      replayEpisodeId: null,
      interventions: [],
      intervention: { active: false, reason: null, startedAtStep: null },
      deadlock: { active: false, staleSteps: 0, bestReward: -Infinity, lastImprovementStep: 0 },
    }),

  tickManual: () => {
    const s = get()
    if (!s.sim || s.runState !== "running") return
    const { state, record } = stepSim(s.sim, s.manualInput)
    set({ sim: state, steps: [...s.steps, record], deadlock: updateDeadlock(s.deadlock, state) })
    if (state.done) finalizeEpisode()
  },

  tickAuto: () => {
    const s = get()
    if (!s.sim || s.runState !== "running") return
    const policy = s.policies.find((p) => p.id === s.activePolicyId)
    if (!policy && !s.intervention.active) return
    const f = buildFeatures(s.sim)
    const a = s.intervention.active || !policy ? s.manualInput : policyAct(policy, f)
    const { state, record } = stepSim(s.sim, a)
    set({ sim: state, steps: [...s.steps, record], deadlock: updateDeadlock(s.deadlock, state) })
    if (state.done) finalizeEpisode()
  },

  startReplay: (episodeId) => {
    const s = get()
    const ep = s.episodes.find((e) => e.id === episodeId)
    if (!ep) return
    const task = s.tasks.find((t) => t.id === ep.taskId)
    if (!task) return
    set({
      sim: initSim(task, 1),
      steps: [],
      runState: "running",
      replayIndex: 0,
      replayEpisodeId: episodeId,
      mode: "replay",
      activeTaskId: task.id,
      scenePhase: "habitat",
      interventions: ep.interventions ?? [],
      intervention: { active: false, reason: null, startedAtStep: null },
    })
  },

  tickReplay: () => {
    const s = get()
    if (!s.sim || s.runState !== "running" || !s.replayEpisodeId) return false
    const ep = s.episodes.find((e) => e.id === s.replayEpisodeId)
    if (!ep) return false
    const i = s.replayIndex
    if (i >= ep.steps.length) {
      set({ runState: "completed" })
      return false
    }
    const action = ep.steps[i].action
    const { state, record } = stepSim(s.sim, action)
    set({ sim: state, steps: [...s.steps, record], replayIndex: i + 1, deadlock: updateDeadlock(s.deadlock, state) })
    if (state.done) set({ runState: "completed" })
    return true
  },

  setTrainingProgress: (p) => set({ trainingProgress: p }),
}))

function finalizeEpisode() {
  const s = useHabitat.getState()
  if (!s.sim) {
    useHabitat.setState({ runState: "idle" })
    return
  }
  const task = s.sim.task
  const policy = s.policies.find((p) => p.id === s.activePolicyId)
  const interventions = [...s.interventions]
  if (s.intervention.active) {
    const startedAtStep = s.intervention.startedAtStep ?? s.sim.step
    const endedAtStep = s.sim.step
    const slice = s.steps.filter((step) => step.t >= startedAtStep && step.t <= endedAtStep)
    interventions.push({
      id: "iv_" + shortId(),
      reason: s.intervention.reason ?? "assist",
      startedAtStep,
      endedAtStep,
      durationSteps: Math.max(0, endedAtStep - startedAtStep),
      taskId: task.id,
      targetId: task.target.id,
      actions: slice.map((step) => step.action),
      targetPositions: slice.map((step) => step.targetPos),
      createdAt: Date.now(),
    })
  }
  const ep: Episode = {
    id: "ep_" + shortId(),
    taskId: task.id,
    taskName: task.name,
    mode: s.mode,
    steps: s.steps,
    totalReward: s.sim.totalReward,
    success: s.sim.success,
    durationSteps: s.sim.step,
    energyUsed: s.sim.agent.energyUsed,
    createdAt: Date.now(),
    policyId: policy?.id,
    interventions,
  }
  useHabitat.setState({
    runState: "completed",
    episodes: [ep, ...s.episodes].slice(0, 200),
    interventions,
    intervention: { active: false, reason: null, startedAtStep: null },
  })
  // Persist to server in the background
  fetch("/api/episodes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ep),
  }).catch(() => {})
}

function updateDeadlock(current: State["deadlock"], sim: SimState): State["deadlock"] {
  if (sim.totalReward > current.bestReward + 0.04) {
    return {
      active: false,
      staleSteps: 0,
      bestReward: sim.totalReward,
      lastImprovementStep: sim.step,
    }
  }
  const staleSteps = Math.max(0, sim.step - current.lastImprovementStep)
  return {
    ...current,
    staleSteps,
    active: staleSteps >= 80 && !sim.done,
  }
}
