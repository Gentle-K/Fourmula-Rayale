"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Group, MathUtils, Mesh, Vector3 } from "three";

import XRAssetLoader from "@/components/xr/XRAssetLoader";
import { XR_OBJECT_POSITIONS } from "@/lib/xr/xrConstants";
import { XR_ASSETS } from "@/lib/xr/xrAssetRegistry";
import { XRTaskPhase } from "@/lib/xr/taskTypes";

type XRTaskObjectsProps = {
  phase: XRTaskPhase;
  robotTargetPosition: [number, number, number];
  latestAssetUrl: string | null;
};

function ToolKitFallback() {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.34, 0.18, 0.2]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.2} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <torusGeometry args={[0.08, 0.018, 12, 32]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.4} roughness={0.28} />
      </mesh>
    </group>
  );
}

function StorageBagFallback() {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.34, 0.26, 0.24]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.16, 0]}>
        <torusGeometry args={[0.12, 0.02, 8, 24]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.65} />
      </mesh>
    </group>
  );
}

function ControlPanelFallback({
  wipeCoverage,
}: {
  wipeCoverage: number;
}) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.16, 0.7, 1.15]} />
        <meshStandardMaterial color="#0f172a" metalness={0.45} roughness={0.45} />
      </mesh>
      <mesh position={[0.09, 0.15, 0]}>
        <boxGeometry args={[0.02, 0.38, 0.62]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh position={[0.1, 0.15, 0]}>
        <planeGeometry args={[0.005, 0.62 * Math.max(0.08, wipeCoverage)]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.9} />
      </mesh>
      <mesh position={[0.1, -0.2, -0.18]}>
        <boxGeometry args={[0.03, 0.08, 0.08]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}

function DockingPadFallback() {
  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.44, 0.44, 0.08, 32]} />
        <meshStandardMaterial color="#0f172a" metalness={0.45} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.26, 0.34, 32]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.45} />
      </mesh>
    </group>
  );
}

function CleaningClothFallback() {
  return (
    <mesh castShadow receiveShadow rotation={[-Math.PI / 2.2, 0.18, 0.28]}>
      <boxGeometry args={[0.22, 0.02, 0.16]} />
      <meshStandardMaterial color="#e0f2fe" roughness={0.9} />
    </mesh>
  );
}

function LatestAssetFallback() {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <dodecahedronGeometry args={[0.18, 0]} />
        <meshStandardMaterial color="#a78bfa" metalness={0.22} roughness={0.28} />
      </mesh>
      <Html center position={[0, 0.4, 0]}>
        <div className="rounded-full border border-violet-400/20 bg-slate-950/90 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-violet-100">
          Latest Tripo Asset
        </div>
      </Html>
    </group>
  );
}

export default function XRTaskObjects({
  phase,
  robotTargetPosition,
  latestAssetUrl,
}: XRTaskObjectsProps) {
  const toolRef = useRef<Group>(null);
  const clothRef = useRef<Group>(null);
  const latestAssetRef = useRef<Group>(null);
  const wipeProgressMeshRef = useRef<Mesh>(null);

  const isToolAttached = phase === "grasp";
  const isToolStored =
    phase === "place" || phase === "wipe" || phase === "return_dock" || phase === "success";
  const wipeCoverage =
    phase === "wipe" ? 0.82 : phase === "return_dock" || phase === "success" ? 0.96 : 0.18;

  const robotOffsetTool = useMemo(
    () =>
      new Vector3(
        robotTargetPosition[0] - 0.08,
        robotTargetPosition[1] - 0.06,
        robotTargetPosition[2] + 0.22,
      ),
    [robotTargetPosition],
  );

  useFrame((_, delta) => {
    const tool = toolRef.current;
    const cloth = clothRef.current;
    const latestAsset = latestAssetRef.current;
    const wipeProgressMesh = wipeProgressMeshRef.current;

    if (tool) {
      const toolTarget = isToolStored
        ? new Vector3(...XR_OBJECT_POSITIONS.storageBag)
        : isToolAttached
          ? robotOffsetTool
          : new Vector3(...XR_OBJECT_POSITIONS.toolKit);

      tool.position.lerp(toolTarget, Math.min(1, delta * 3));
      tool.rotation.y = MathUtils.lerp(
        tool.rotation.y,
        isToolStored ? Math.PI / 2 : 0.32,
        Math.min(1, delta * 2.2),
      );
    }

    if (cloth) {
      const clothTarget =
        phase === "wipe"
          ? new Vector3(-1.42, 1.24, -1.2)
          : new Vector3(...XR_OBJECT_POSITIONS.cleaningCloth);

      cloth.position.lerp(clothTarget, Math.min(1, delta * 3));
    }

    if (latestAsset) {
      latestAsset.rotation.y += delta * 0.35;
      latestAsset.position.y =
        XR_OBJECT_POSITIONS.latestAsset[1] + Math.sin(performance.now() * 0.0012) * 0.03;
    }

    if (wipeProgressMesh) {
      wipeProgressMesh.scale.y = MathUtils.lerp(
        wipeProgressMesh.scale.y,
        Math.max(0.08, wipeCoverage),
        Math.min(1, delta * 2.4),
      );
    }
  });

  return (
    <group>
      <group ref={toolRef} position={XR_OBJECT_POSITIONS.toolKit}>
        <XRAssetLoader
          url={XR_ASSETS.toolKit.path}
          name={XR_ASSETS.toolKit.label}
          scale={0.45}
          fallback={<ToolKitFallback />}
        />
      </group>

      <group position={XR_OBJECT_POSITIONS.storageBag}>
        <XRAssetLoader
          url={XR_ASSETS.storageBag.path}
          name={XR_ASSETS.storageBag.label}
          scale={0.52}
          rotation={[0, Math.PI / 2, 0]}
          fallback={<StorageBagFallback />}
        />
      </group>

      <group position={XR_OBJECT_POSITIONS.controlPanel} rotation={[0, Math.PI / 2, 0]}>
        <XRAssetLoader
          url={XR_ASSETS.controlPanel.path}
          name={XR_ASSETS.controlPanel.label}
          scale={0.58}
          fallback={<ControlPanelFallback wipeCoverage={wipeCoverage} />}
        />
        <mesh
          ref={wipeProgressMeshRef}
          position={[0.12, 0.15, 0]}
          scale={[1, Math.max(0.08, wipeCoverage), 1]}
        >
          <planeGeometry args={[0.005, 0.62]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.85} />
        </mesh>
      </group>

      <group position={XR_OBJECT_POSITIONS.dock}>
        <XRAssetLoader
          url={XR_ASSETS.dockingPad.path}
          name={XR_ASSETS.dockingPad.label}
          scale={0.7}
          fallback={<DockingPadFallback />}
        />
      </group>

      <group ref={clothRef} position={XR_OBJECT_POSITIONS.cleaningCloth}>
        <XRAssetLoader
          url={XR_ASSETS.cleaningCloth.path}
          name={XR_ASSETS.cleaningCloth.label}
          scale={0.42}
          fallback={<CleaningClothFallback />}
        />
      </group>

      <mesh position={XR_OBJECT_POSITIONS.sensitiveZone}>
        <boxGeometry args={[0.9, 0.5, 0.5]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.16} />
      </mesh>
      <Html position={[XR_OBJECT_POSITIONS.sensitiveZone[0], XR_OBJECT_POSITIONS.sensitiveZone[1] + 0.42, XR_OBJECT_POSITIONS.sensitiveZone[2]]} center>
        <div className="rounded-full border border-rose-400/20 bg-slate-950/90 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-rose-100">
          Sensitive Zone
        </div>
      </Html>

      {latestAssetUrl ? (
        <group ref={latestAssetRef} position={XR_OBJECT_POSITIONS.latestAsset}>
          <XRAssetLoader
            url={latestAssetUrl}
            name="Latest Tripo Asset"
            scale={0.58}
            fallback={<LatestAssetFallback />}
          />
        </group>
      ) : null}
    </group>
  );
}
