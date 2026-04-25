"use client"

import { Suspense, useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import type { AgentState } from "@/lib/types"
import { ARM } from "@/lib/simulator"
import { ModelSlot } from "./model-slot"

type Props = {
  agent: AgentState
  highlightGrip?: boolean
  skinUrl?: string | null
}

function Joint({ radius = 0.12, active = false }: { radius?: number; active?: boolean }) {
  return (
    <mesh castShadow>
      <sphereGeometry args={[radius, 18, 18]} />
      <meshStandardMaterial
        color={active ? "#f59e0b" : "#0ea5b5"}
        emissive={active ? "#f59e0b" : "#0891b2"}
        emissiveIntensity={active ? 0.75 : 0.22}
        metalness={0.75}
        roughness={0.28}
      />
    </mesh>
  )
}

function LimbSegment({
  length,
  radius = 0.08,
  color = "#e5e7eb",
}: {
  length: number
  radius?: number
  color?: string
}) {
  return (
    <group>
      <mesh position={[length / 2, 0, 0]} castShadow>
        <boxGeometry args={[length, radius * 1.25, radius * 1.25]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.38} />
      </mesh>
      <mesh position={[length / 2, 0, radius * 0.72]}>
        <boxGeometry args={[Math.max(0.1, length - 0.14), radius * 0.22, radius * 0.24]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.55} />
      </mesh>
    </group>
  )
}

function Gripper({ active }: { active?: boolean }) {
  const gap = active ? 0.045 : 0.09
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.16, 0.16, 0.16]} />
        <meshStandardMaterial
          color={active ? "#f59e0b" : "#22d3ee"}
          emissive={active ? "#f59e0b" : "#22d3ee"}
          emissiveIntensity={active ? 1.2 : 0.4}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0.13, gap, 0]} castShadow>
        <boxGeometry args={[0.18, 0.035, 0.11]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.45} />
      </mesh>
      <mesh position={[0.13, -gap, 0]} castShadow>
        <boxGeometry args={[0.18, 0.035, 0.11]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.45} />
      </mesh>
    </group>
  )
}

function StabilizerLimb({ side }: { side: -1 | 1 }) {
  return (
    <group position={[side * 0.35, 1.15, -0.28]} rotation={[0.2, 0.2 * side, side * 0.32]}>
      <Joint radius={0.1} />
      <group rotation={[0, 0, side * 1.78]}>
        <LimbSegment length={0.48} radius={0.075} color="#cbd5e1" />
        <group position={[0.48, 0, 0]} rotation={[0, 0, side * -0.62]}>
          <Joint radius={0.085} />
          <LimbSegment length={0.38} radius={0.062} />
          <group position={[0.38, 0, 0]}>
            <Joint radius={0.07} />
            <Gripper active={false} />
          </group>
        </group>
      </group>
    </group>
  )
}

function Leg({ side }: { side: -1 | 1 }) {
  return (
    <group position={[side * 0.22, 0.62, -0.32]} rotation={[0, side * 0.22, -side * 0.18]}>
      <Joint radius={0.095} />
      <group rotation={[0, 0, -Math.PI / 2 - side * 0.16]}>
        <LimbSegment length={0.48} radius={0.075} color="#94a3b8" />
        <group position={[0.48, 0, 0]} rotation={[0, 0, side * 0.42]}>
          <Joint radius={0.08} />
          <LimbSegment length={0.42} radius={0.065} color="#cbd5e1" />
          <group position={[0.42, 0, 0]}>
            <Joint radius={0.065} />
            <mesh position={[0.08, 0, 0]} castShadow>
              <boxGeometry args={[0.22, 0.07, 0.14]} />
              <meshStandardMaterial color="#64748b" metalness={0.55} roughness={0.42} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}

function RobotBody({ skinUrl }: { skinUrl?: string | null }) {
  const fallback = (
    <group>
      <mesh position={[0, 1.08, -0.34]} castShadow>
        <boxGeometry args={[0.6, 0.62, 0.34]} />
        <meshStandardMaterial color="#dbeafe" metalness={0.52} roughness={0.32} />
      </mesh>
      <mesh position={[0, 1.08, -0.16]}>
        <boxGeometry args={[0.38, 0.18, 0.035]} />
        <meshStandardMaterial color="#020617" emissive="#22d3ee" emissiveIntensity={0.42} />
      </mesh>
      <mesh position={[0, 1.56, -0.34]} castShadow>
        <sphereGeometry args={[0.22, 24, 18]} />
        <meshStandardMaterial color="#f8fafc" metalness={0.45} roughness={0.28} />
      </mesh>
      <mesh position={[0, 1.57, -0.15]}>
        <boxGeometry args={[0.22, 0.06, 0.025]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.8} />
      </mesh>
    </group>
  )

  return (
    <>
      {fallback}
      {skinUrl && (
        <Suspense fallback={null}>
          <group position={[0, 1.08, -0.34]}>
            <ModelSlot url={skinUrl} normalizeSize={1.15} fallback={null} />
          </group>
        </Suspense>
      )}
    </>
  )
}

export function ProceduralRobot({ agent, highlightGrip, skinUrl }: Props) {
  const baseRef = useRef<THREE.Group>(null)
  const shoulderRef = useRef<THREE.Group>(null)
  const elbowRef = useRef<THREE.Group>(null)
  const wristRef = useRef<THREE.Group>(null)

  const pedestalMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1f2937",
        metalness: 0.65,
        roughness: 0.36,
      }),
    [],
  )

  useEffect(() => {
    if (baseRef.current) baseRef.current.rotation.y = agent.joints.base
    if (shoulderRef.current) shoulderRef.current.rotation.z = agent.joints.shoulder
    if (elbowRef.current) elbowRef.current.rotation.z = agent.joints.elbow
    if (wristRef.current) wristRef.current.rotation.z = agent.joints.wrist
  }, [agent.joints.base, agent.joints.shoulder, agent.joints.elbow, agent.joints.wrist])

  return (
    <group position={[0, -1.6, 0]}>
      <mesh position={[0, 0.15, 0]} castShadow material={pedestalMaterial}>
        <cylinderGeometry args={[0.46, 0.56, 0.3, 28]} />
      </mesh>
      <mesh position={[0, 0.38, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.32, 0.28, 24]} />
        <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.35} />
      </mesh>

      <RobotBody skinUrl={skinUrl} />
      <StabilizerLimb side={-1} />
      <Leg side={-1} />
      <Leg side={1} />

      <group ref={baseRef} position={[0, ARM.baseHeight, 0]}>
        <Joint radius={0.19} />
        <group ref={shoulderRef}>
          <LimbSegment length={ARM.L1} radius={0.15} />
          <group position={[ARM.L1, 0, 0]}>
            <Joint radius={0.15} />
            <group ref={elbowRef}>
              <LimbSegment length={ARM.L2} radius={0.12} color="#cbd5e1" />
              <group position={[ARM.L2, 0, 0]}>
                <Joint radius={0.11} />
                <group ref={wristRef}>
                  <LimbSegment length={ARM.L3} radius={0.085} />
                  <group position={[ARM.L3, 0, 0]}>
                    <Joint radius={0.08} active={highlightGrip} />
                    <Gripper active={highlightGrip} />
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}
