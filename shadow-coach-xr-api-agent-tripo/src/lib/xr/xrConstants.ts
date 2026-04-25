export const XR_CAMERA_POSITION: [number, number, number] = [0, 1.6, 4];
export const XR_PHASE_DURATION_MS = 2500;
export const XR_LOADING_TEXT = "Loading WebXR scene...";

export const XR_OBJECT_POSITIONS = {
  dock: [-1.6, 0.15, 2.2] as [number, number, number],
  robotStart: [0, 1.3, 0] as [number, number, number],
  toolKit: [1.25, 1.12, -0.55] as [number, number, number],
  storageBag: [1.6, 1.05, 1.25] as [number, number, number],
  controlPanel: [-1.65, 1.2, -1.35] as [number, number, number],
  cleaningCloth: [-0.2, 1.02, -1.65] as [number, number, number],
  latestAsset: [1.9, 1.02, -1.55] as [number, number, number],
  sensitiveZone: [0.85, 1.15, 1.45] as [number, number, number],
} as const;

export const XR_PHASE_LABELS = {
  idle: "Idle",
  approach: "Approach Target",
  stabilize: "Stabilize Pose",
  grasp: "Grasp Tool",
  place: "Place Tool",
  wipe: "Wipe Panel",
  return_dock: "Return Dock",
  success: "Success",
  failed: "Failed",
} as const;
