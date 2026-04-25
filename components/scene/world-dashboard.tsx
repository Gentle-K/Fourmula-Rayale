"use client"

import { useMemo } from "react"
import { useHabitat } from "@/lib/store"
import { fmt } from "@/lib/utils"
import { CanvasLabel } from "./canvas-label"

function PanelButton({
  label,
  position,
  active,
  disabled,
  onClick,
}: {
  label: string
  position: [number, number, number]
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <group
      position={position}
      onClick={(event) => {
        event.stopPropagation()
        if (!disabled) onClick()
      }}
    >
      <mesh>
        <boxGeometry args={[0.92, 0.18, 0.035]} />
        <meshStandardMaterial
          color={disabled ? "#1e293b" : active ? "#f59e0b" : "#0f172a"}
          emissive={disabled ? "#020617" : active ? "#f59e0b" : "#0891b2"}
          emissiveIntensity={disabled ? 0.08 : active ? 0.24 : 0.18}
          transparent
          opacity={0.92}
        />
      </mesh>
      <CanvasLabel text={label} position={[0, 0, 0.026]} fontSize={0.052} color={disabled ? "#64748b" : active ? "#111827" : "#e2e8f0"} />
    </group>
  )
}

function Row({ y, label, value, color = "#e2e8f0" }: { y: number; label: string; value: string; color?: string }) {
  return (
    <group position={[0, y, 0.026]}>
      <CanvasLabel text={label} position={[-0.56, 0, 0]} fontSize={0.045} color="#94a3b8" anchorX="left" />
      <CanvasLabel text={value} position={[0.58, 0, 0]} fontSize={0.049} color={color} anchorX="right" />
    </group>
  )
}

export function WorldDashboard() {
  const mode = useHabitat((s) => s.mode)
  const runState = useHabitat((s) => s.runState)
  const sim = useHabitat((s) => s.sim)
  const deadlock = useHabitat((s) => s.deadlock)
  const intervention = useHabitat((s) => s.intervention)
  const assets = useHabitat((s) => s.assets)
  const tasks = useHabitat((s) => s.tasks)
  const policies = useHabitat((s) => s.policies)
  const episodes = useHabitat((s) => s.episodes)
  const robotAssetId = useHabitat((s) => s.robotAssetId)
  const startRun = useHabitat((s) => s.startRun)
  const pauseRun = useHabitat((s) => s.pauseRun)
  const resumeRun = useHabitat((s) => s.resumeRun)
  const beginIntervention = useHabitat((s) => s.beginIntervention)
  const endIntervention = useHabitat((s) => s.endIntervention)
  const returnToOrbit = useHabitat((s) => s.returnToOrbit)

  const latestAsset = assets[0]
  const recent = useMemo(() => episodes.slice(0, 12), [episodes])
  const successRate = recent.length ? recent.filter((episode) => episode.success).length / recent.length : 0
  const activeRobot = assets.find((asset) => asset.id === robotAssetId)

  const toggleRun = () => {
    if (runState === "running") pauseRun()
    else if (runState === "paused") resumeRun()
    else startRun()
  }

  return (
    <group position={[2.85, 0.35, -1.25]} rotation={[0, -0.62, 0]}>
      <mesh>
        <boxGeometry args={[1.45, 1.86, 0.045]} />
        <meshStandardMaterial color="#020617" emissive="#0f172a" emissiveIntensity={0.45} transparent opacity={0.82} />
      </mesh>
      <mesh position={[0, 0.79, 0.028]}>
        <boxGeometry args={[1.36, 0.17, 0.02]} />
        <meshStandardMaterial color="#0f172a" emissive="#22d3ee" emissiveIntensity={0.16} />
      </mesh>
      <CanvasLabel text="ISS TRAINING DASH" position={[-0.62, 0.79, 0.05]} fontSize={0.06} color="#e2e8f0" anchorX="left" />
      <CanvasLabel text={mode.toUpperCase()} position={[0.62, 0.79, 0.05]} fontSize={0.045} color="#67e8f9" anchorX="right" />

      <Row y={0.55} label="Run" value={runState} color={runState === "running" ? "#34d399" : "#e2e8f0"} />
      <Row y={0.39} label="Reward" value={fmt(sim?.totalReward ?? 0)} color="#fbbf24" />
      <Row y={0.23} label="Step" value={`${sim?.step ?? 0}`} />
      <Row y={0.07} label="Success" value={`${Math.round(successRate * 100)}%`} color="#34d399" />
      <Row y={-0.09} label="Deadlock" value={deadlock.active ? `${deadlock.staleSteps} steps` : "clear"} color={deadlock.active ? "#f59e0b" : "#94a3b8"} />
      <Row y={-0.25} label="Tripo" value={latestAsset ? `${latestAsset.kind} · ${latestAsset.status}` : "idle"} color={latestAsset?.status === "failed" ? "#f87171" : "#67e8f9"} />
      <Row y={-0.41} label="Robot Skin" value={activeRobot ? "applied" : "procedural"} color={activeRobot ? "#a78bfa" : "#94a3b8"} />
      <Row y={-0.57} label="Scale" value={`${tasks.length} tasks · ${policies.length} policies`} />

      <PanelButton label={runState === "running" ? "PAUSE" : runState === "paused" ? "RESUME" : "START RUN"} position={[-0.26, -0.82, 0.05]} active={runState === "running"} onClick={toggleRun} />
      <PanelButton
        label={intervention.active ? "END ASSIST" : "ASSIST"}
        position={[0.48, -0.82, 0.05]}
        active={intervention.active || deadlock.active}
        disabled={runState !== "running"}
        onClick={() => (intervention.active ? endIntervention() : beginIntervention(deadlock.active ? "deadlock" : "user-assist"))}
      />
      <PanelButton label="ORBIT" position={[0.11, -1.05, 0.05]} onClick={returnToOrbit} />
    </group>
  )
}
