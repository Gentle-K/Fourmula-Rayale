"use client"
import { useRef, useEffect } from "react"
import * as THREE from "three"
import type { AgentState } from "@/lib/types"
import { ARM } from "@/lib/simulator"

type Props = {
  agent: AgentState
  highlightGrip?: boolean
}

export function RobotArm({ agent, highlightGrip }: Props) {
  const baseRef = useRef<THREE.Group>(null)
  const shoulderRef = useRef<THREE.Group>(null)
  const elbowRef = useRef<THREE.Group>(null)
  const wristRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (baseRef.current) baseRef.current.rotation.y = agent.joints.base
    if (shoulderRef.current) shoulderRef.current.rotation.z = agent.joints.shoulder
    if (elbowRef.current) elbowRef.current.rotation.z = agent.joints.elbow
    if (wristRef.current) wristRef.current.rotation.z = agent.joints.wrist
  }, [agent.joints.base, agent.joints.shoulder, agent.joints.elbow, agent.joints.wrist])

  return (
    <group position={[0, -1.6, 0]}>
      {/* Pedestal */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.45, 0.55, 0.3, 24]} />
        <meshStandardMaterial color="#1f2937" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Base (rotates around Y) */}
      <group ref={baseRef} position={[0, ARM.baseHeight, 0]}>
        {/* shoulder pivot housing */}
        <mesh castShadow>
          <cylinderGeometry args={[0.22, 0.22, 0.36, 16]} />
          <meshStandardMaterial color="#0ea5b5" metalness={0.8} roughness={0.3} emissive="#0ea5b5" emissiveIntensity={0.2} />
        </mesh>

        <group ref={shoulderRef}>
          {/* upper arm */}
          <mesh position={[ARM.L1 / 2, 0, 0]} castShadow>
            <boxGeometry args={[ARM.L1, 0.18, 0.18]} />
            <meshStandardMaterial color="#e5e7eb" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[ARM.L1 / 2, 0, 0]}>
            <boxGeometry args={[ARM.L1 - 0.1, 0.04, 0.2]} />
            <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.8} />
          </mesh>

          <group position={[ARM.L1, 0, 0]}>
            {/* elbow */}
            <mesh castShadow>
              <sphereGeometry args={[0.16, 16, 16]} />
              <meshStandardMaterial color="#0ea5b5" metalness={0.8} roughness={0.3} />
            </mesh>
            <group ref={elbowRef}>
              {/* forearm */}
              <mesh position={[ARM.L2 / 2, 0, 0]} castShadow>
                <boxGeometry args={[ARM.L2, 0.14, 0.14]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.4} />
              </mesh>
              <mesh position={[ARM.L2 / 2, 0, 0]}>
                <boxGeometry args={[ARM.L2 - 0.1, 0.03, 0.16]} />
                <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.8} />
              </mesh>

              <group position={[ARM.L2, 0, 0]}>
                {/* wrist */}
                <mesh castShadow>
                  <sphereGeometry args={[0.12, 12, 12]} />
                  <meshStandardMaterial color="#0ea5b5" metalness={0.8} roughness={0.3} />
                </mesh>
                <group ref={wristRef}>
                  <mesh position={[ARM.L3 / 2, 0, 0]} castShadow>
                    <boxGeometry args={[ARM.L3, 0.1, 0.1]} />
                    <meshStandardMaterial color="#e5e7eb" metalness={0.6} roughness={0.4} />
                  </mesh>
                  {/* End effector / gripper */}
                  <group position={[ARM.L3, 0, 0]}>
                    <mesh>
                      <boxGeometry args={[0.16, 0.16, 0.16]} />
                      <meshStandardMaterial
                        color={highlightGrip ? "#f59e0b" : "#22d3ee"}
                        emissive={highlightGrip ? "#f59e0b" : "#22d3ee"}
                        emissiveIntensity={highlightGrip ? 1.4 : 0.4}
                        metalness={0.7}
                        roughness={0.3}
                      />
                    </mesh>
                    {/* Two finger pads */}
                    <mesh position={[0.12, 0.08, 0]}>
                      <boxGeometry args={[0.16, 0.04, 0.1]} />
                      <meshStandardMaterial color="#9ca3af" metalness={0.5} roughness={0.5} />
                    </mesh>
                    <mesh position={[0.12, -0.08, 0]}>
                      <boxGeometry args={[0.16, 0.04, 0.1]} />
                      <meshStandardMaterial color="#9ca3af" metalness={0.5} roughness={0.5} />
                    </mesh>
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
