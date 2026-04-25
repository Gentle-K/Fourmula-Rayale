"use client"

import { useFrame } from "@react-three/fiber"
import { useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { useHabitat } from "@/lib/store"
import { ModelSlot } from "./model-slot"
import { StarField } from "./star-field"
import { CanvasLabel } from "./canvas-label"

const ISS_SLOT = "/models/iss.glb"

function ProceduralISS({ selected }: { selected: boolean }) {
  const panelMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: selected ? "#38bdf8" : "#1d4ed8",
        emissive: selected ? "#22d3ee" : "#0f172a",
        emissiveIntensity: selected ? 0.55 : 0.16,
        metalness: 0.35,
        roughness: 0.42,
      }),
    [selected],
  )
  const hullMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#e5e7eb",
        metalness: 0.72,
        roughness: 0.28,
      }),
    [],
  )

  return (
    <group scale={0.72}>
      <mesh castShadow material={hullMat}>
        <cylinderGeometry args={[0.34, 0.34, 2.2, 24]} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]} castShadow material={hullMat}>
        <cylinderGeometry args={[0.22, 0.22, 3.8, 18]} />
      </mesh>
      {[-1.6, 1.6].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh material={panelMat} position={[0, 0, -0.48]} castShadow>
            <boxGeometry args={[1.5, 0.04, 0.62]} />
          </mesh>
          <mesh material={panelMat} position={[0, 0, 0.48]} castShadow>
            <boxGeometry args={[1.5, 0.04, 0.62]} />
          </mesh>
        </group>
      ))}
      {[-0.88, 0.88].map((z) => (
        <mesh key={z} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]} material={hullMat} castShadow>
          <torusGeometry args={[0.4, 0.035, 8, 28]} />
        </mesh>
      ))}
      <mesh position={[0, 0.42, 0]} castShadow>
        <sphereGeometry args={[0.2, 18, 18]} />
        <meshStandardMaterial color="#f8fafc" metalness={0.55} roughness={0.3} />
      </mesh>
    </group>
  )
}

function EarthLimb() {
  return (
    <group position={[0, -6.8, -5]} rotation={[-0.18, 0, 0]}>
      <mesh>
        <sphereGeometry args={[6.8, 64, 32]} />
        <meshStandardMaterial color="#123c69" emissive="#0f766e" emissiveIntensity={0.2} roughness={0.9} />
      </mesh>
      <mesh scale={1.012}>
        <sphereGeometry args={[6.8, 64, 32]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
    </group>
  )
}

export function OrbitScene() {
  const groupRef = useRef<THREE.Group>(null)
  const enterHabitat = useHabitat((s) => s.enterHabitat)
  const [hovered, setHovered] = useState(false)

  useFrame((_, dt) => {
    if (groupRef.current) groupRef.current.rotation.y += dt * 0.16
  })

  return (
    <group>
      <StarField radius={120} depth={65} count={2600} speed={0.018} />
      <EarthLimb />
      <ambientLight intensity={0.48} color="#93c5fd" />
      <directionalLight position={[4, 5, 7]} intensity={1.35} color="#ffffff" castShadow />
      <pointLight position={[-3, 1.5, 2]} intensity={0.8} color="#22d3ee" />

      <group
        ref={groupRef}
        position={[0, 0.15, 0]}
        onClick={(event) => {
          event.stopPropagation()
          enterHabitat()
        }}
        onPointerOver={(event) => {
          event.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        <ModelSlot url={ISS_SLOT} normalizeSize={3.2} fallback={<ProceduralISS selected={hovered} />} />
        <mesh>
          <sphereGeometry args={[1.9, 24, 24]} />
          <meshBasicMaterial colorWrite={false} depthWrite={false} depthTest={false} transparent opacity={0} />
        </mesh>
      </group>

      <group position={[0, 2.2, -0.2]}>
        <CanvasLabel text="Trigger ISS to enter habitat" fontSize={0.18} color="#e2e8f0" />
        <CanvasLabel
          text="Quest trigger and desktop click share interaction"
          position={[0, -0.26, 0]}
          fontSize={0.09}
          color="#67e8f9"
        />
      </group>
    </group>
  )
}
