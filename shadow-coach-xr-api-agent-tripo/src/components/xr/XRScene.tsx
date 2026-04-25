"use client";

import { Html, OrbitControls, Preload } from "@react-three/drei";
import { NotInXR } from "@react-three/xr";

import XRAssetLoader from "@/components/xr/XRAssetLoader";
import XRRobot from "@/components/xr/XRRobot";
import XRTaskObjects from "@/components/xr/XRTaskObjects";
import { XR_OBJECT_POSITIONS } from "@/lib/xr/xrConstants";
import { XR_ASSETS } from "@/lib/xr/xrAssetRegistry";
import { XREpisodeStep, XRTaskPhase } from "@/lib/xr/taskTypes";

type XRSceneProps = {
  currentStep: XREpisodeStep;
  latestAssetUrl: string | null;
  phase: XRTaskPhase;
};

function BaseSceneFallback() {
  return (
    <group>
      <mesh receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[4.4, 0.08, 7.8]} />
        <meshStandardMaterial color="#0f172a" roughness={0.92} />
      </mesh>

      <mesh receiveShadow position={[0, 2.32, 0]}>
        <boxGeometry args={[4.4, 0.08, 7.8]} />
        <meshStandardMaterial color="#111827" roughness={0.88} />
      </mesh>

      <mesh receiveShadow position={[-2.18, 1.14, 0]}>
        <boxGeometry args={[0.08, 2.2, 7.8]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.72} />
      </mesh>

      <mesh receiveShadow position={[2.18, 1.14, 0]}>
        <boxGeometry args={[0.08, 2.2, 7.8]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.72} />
      </mesh>

      {[-2.2, -0.8, 0.6, 2].map((z) => (
        <mesh key={z} position={[-1.95, 1.4, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.03, 1.25, 18]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.48} roughness={0.32} />
        </mesh>
      ))}

      {[-2.2, -0.8, 0.6, 2].map((z) => (
        <mesh key={`right-${z}`} position={[1.95, 1.05, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.028, 0.028, 1.1, 18]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.42} roughness={0.28} />
        </mesh>
      ))}

      {[[-1.75, 1.38, 1.4], [-1.75, 0.9, 1.4], [1.7, 1.3, -1.2]].map((position, index) => (
        <mesh key={index} position={position as [number, number, number]}>
          <boxGeometry args={[0.25, 0.32, 0.42]} />
          <meshStandardMaterial color="#334155" roughness={0.65} />
        </mesh>
      ))}

      <mesh position={[XR_OBJECT_POSITIONS.controlPanel[0], XR_OBJECT_POSITIONS.controlPanel[1], XR_OBJECT_POSITIONS.controlPanel[2] - 0.3]}>
        <boxGeometry args={[0.14, 0.85, 1.4]} />
        <meshStandardMaterial color="#1e293b" metalness={0.35} roughness={0.45} />
      </mesh>

      <Html position={[0, 2.65, 0]} center>
        <div className="rounded-full border border-white/10 bg-slate-950/90 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-200">
          ISS mock corridor fallback
        </div>
      </Html>
    </group>
  );
}

export default function XRScene({
  currentStep,
  latestAssetUrl,
  phase,
}: XRSceneProps) {
  return (
    <>
      <color attach="background" args={["#020617"]} />
      <fog attach="fog" args={["#020617", 7.5, 16]} />
      <ambientLight intensity={0.7} />
      <directionalLight
        castShadow
        intensity={1.7}
        position={[4, 6, 3]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight intensity={18} distance={8} color="#c4b5fd" position={[0, 2.1, -2.8]} />
      <pointLight intensity={14} distance={7} color="#38bdf8" position={[0, 1.4, 2.4]} />

      <XRAssetLoader
        url={XR_ASSETS.baseScene.path}
        name={XR_ASSETS.baseScene.label}
        fallback={<BaseSceneFallback />}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[5.5, 64]} />
        <meshBasicMaterial color="#020617" />
      </mesh>
      <gridHelper args={[10, 20, "#38bdf8", "#1e293b"]} position={[0, 0.02, 0]} />

      <XRRobot phase={phase} targetPosition={currentStep.robotPosition} />
      <XRTaskObjects
        phase={phase}
        robotTargetPosition={currentStep.robotPosition}
        latestAssetUrl={latestAssetUrl}
      />

      <NotInXR>
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          maxDistance={8}
          minDistance={2.2}
          maxPolarAngle={Math.PI * 0.52}
          target={[0, 1.2, 0]}
        />
      </NotInXR>

      <Preload all />
    </>
  );
}
