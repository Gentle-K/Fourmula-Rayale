"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { Color, Group, MathUtils, Vector3 } from "three";

import XRAssetLoader from "@/components/xr/XRAssetLoader";
import { XR_ASSETS } from "@/lib/xr/xrAssetRegistry";
import { XRTaskPhase } from "@/lib/xr/taskTypes";

type XRRobotProps = {
  phase: XRTaskPhase;
  targetPosition: [number, number, number];
};

function RobotFallback({ phase }: { phase: XRTaskPhase }) {
  const accent = useMemo(() => {
    if (phase === "success") {
      return new Color("#10b981");
    }

    if (phase === "wipe") {
      return new Color("#38bdf8");
    }

    if (phase === "grasp") {
      return new Color("#f59e0b");
    }

    return new Color("#60a5fa");
  }, [phase]);

  return (
    <group>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[0.22, 32, 32]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.4} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0, 0.18]}>
        <sphereGeometry args={[0.065, 24, 24]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.2} />
      </mesh>
      {[
        [0.22, -0.1, 0.06],
        [-0.22, -0.1, 0.06],
        [0.12, -0.18, -0.14],
        [-0.12, -0.18, -0.14],
      ].map((position, index) => (
        <mesh key={index} position={position as [number, number, number]}>
          <cylinderGeometry args={[0.035, 0.055, 0.18, 14]} />
          <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.45} />
        </mesh>
      ))}
      <mesh position={[0, -0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.26, 32]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

export default function XRRobot({ phase, targetPosition }: XRRobotProps) {
  const groupRef = useRef<Group>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const targetVector = useMemo(
    () => new Vector3(targetPosition[0], targetPosition[1], targetPosition[2]),
    [targetPosition],
  );

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;

    if (!group) {
      return;
    }

    const floatOffset = Math.sin(clock.elapsedTime * 1.8) * 0.05;
    const bobOffset = Math.cos(clock.elapsedTime * 1.25) * 0.02;

    group.position.lerp(
      new Vector3(targetVector.x, targetVector.y + floatOffset, targetVector.z),
      Math.min(1, delta * 2.8),
    );
    group.rotation.y = MathUtils.lerp(group.rotation.y, -0.28, Math.min(1, delta * 1.6));
    group.rotation.z = bobOffset;
  });

  return (
    <group ref={groupRef}>
      <XRAssetLoader
        url={XR_ASSETS.assistantRobot.path}
        name={XR_ASSETS.assistantRobot.label}
        scale={0.52}
        fallback={<RobotFallback phase={phase} />}
        onError={(message) => setLoadError(message)}
      />
      {loadError ? null : null}
    </group>
  );
}
