"use client"
import { useMemo } from "react"
import * as THREE from "three"
import { StarField } from "./star-field"

export function IssEnvironment() {
  // module ribs
  const ribs = useMemo(() => Array.from({ length: 9 }, (_, i) => -4 + i), [])
  return (
    <group>
      {/* Outer space backdrop */}
      <StarField radius={105} depth={58} count={1800} speed={0.014} />
      <fog attach="fog" args={["#0a1020", 12, 28]} />

      {/* Cabin shell: cylinder along Z */}
      <mesh rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <cylinderGeometry args={[3.4, 3.4, 11, 32, 1, true]} />
        <meshStandardMaterial
          color="#0f1729"
          metalness={0.6}
          roughness={0.5}
          side={THREE.BackSide}
          emissive="#0a1020"
          emissiveIntensity={0.4}
        />
      </mesh>

      {/* Inner ribs */}
      {ribs.map((z) => (
        <mesh key={z} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[3.35, 0.04, 8, 64]} />
          <meshStandardMaterial color="#1c2540" emissive="#22d3ee" emissiveIntensity={0.18} metalness={0.7} />
        </mesh>
      ))}

      {/* Floor / equipment rack */}
      <mesh position={[0, -1.6, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[6.2, 10]} />
        <meshStandardMaterial color="#111827" metalness={0.3} roughness={0.9} />
      </mesh>

      {/* Side equipment panels */}
      {[-3, -1, 1, 3].map((z) => (
        <group key={z} position={[2.4, 0.2, z]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh>
            <boxGeometry args={[1.2, 1.4, 0.18]} />
            <meshStandardMaterial color="#172033" metalness={0.5} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.4, 0.1]}>
            <boxGeometry args={[0.9, 0.18, 0.04]} />
            <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.7} />
          </mesh>
          <mesh position={[0, 0, 0.1]}>
            <boxGeometry args={[0.9, 0.05, 0.02]} />
            <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[0, -0.4, 0.1]}>
            <boxGeometry args={[0.9, 0.05, 0.02]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>
        </group>
      ))}
      {[-3, -1, 1, 3].map((z) => (
        <group key={`l${z}`} position={[-2.4, 0.2, z]} rotation={[0, Math.PI / 2, 0]}>
          <mesh>
            <boxGeometry args={[1.2, 1.4, 0.18]} />
            <meshStandardMaterial color="#172033" metalness={0.5} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.3, 0.1]}>
            <boxGeometry args={[1, 0.6, 0.02]} />
            <meshStandardMaterial color="#0b1220" emissive="#22d3ee" emissiveIntensity={0.25} />
          </mesh>
        </group>
      ))}

      {/* Window into space */}
      <mesh position={[0, 1.7, 4.9]}>
        <circleGeometry args={[0.8, 32]} />
        <meshStandardMaterial color="#020617" emissive="#1e3a8a" emissiveIntensity={0.4} />
      </mesh>

      {/* Lights */}
      <ambientLight intensity={0.35} color="#a5b4fc" />
      <directionalLight position={[3, 5, 4]} intensity={0.9} color="#ffffff" castShadow />
      <pointLight position={[0, 2, 0]} intensity={0.6} color="#22d3ee" />
      <pointLight position={[0, 0.5, 4.6]} intensity={1.2} color="#1e3a8a" distance={6} />
    </group>
  )
}
