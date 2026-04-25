export type TripoTaskStatus =
  | "queued"
  | "running"
  | "success"
  | "failed"
  | "banned"
  | "expired"
  | "cancelled"
  | "unknown";

export type TripoInputMode = "text" | "image";

export type TripoAssetCategory = "static" | "riggable";

export type TripoAssetType =
  | "iss_module"
  | "tool_kit"
  | "control_panel"
  | "storage_bag"
  | "handrail"
  | "cable_bundle"
  | "cupola_window"
  | "cleaning_cloth"
  | "docking_pad"
  | "floating_tablet"
  | "assistant_robot"
  | "astronaut"
  | "humanoid_guide"
  | "small_creature"
  | "custom";

export type TripoPipelineMode =
  | "static_generate"
  | "generate_then_rig"
  | "generate_rig_then_animate";

export type TripoRigStatus =
  | "not_required"
  | "pending"
  | "prerigcheck"
  | "rigging"
  | "rigged"
  | "animating"
  | "animated"
  | "failed";

export type TripoReferenceImage = {
  name: string;
  type: string;
  size: number;
};

export type TripoCreateTaskResponse = {
  taskId: string;
  status: TripoTaskStatus;
  mock: boolean;
  inputMode: TripoInputMode;
  referenceImage: TripoReferenceImage | null;
  message: string;
  raw: Record<string, unknown>;
};

export type TripoTaskStatusResponse = {
  taskId: string;
  status: TripoTaskStatus;
  mock: boolean;
  modelUrl: string | null;
  raw: Record<string, unknown>;
};

export type TripoPromptPreset = {
  id: string;
  label: string;
  prompt: string;
  assetType?: TripoAssetType;
  assetCategory?: TripoAssetCategory;
  defaultPipelineMode?: TripoPipelineMode;
};

export type TripoCacheEntry = {
  taskId: string;
  status: TripoTaskStatus;
  mock: boolean;
  inputMode?: TripoInputMode;
  prompt?: string;
  referenceImage?: TripoReferenceImage | null;
  modelUrl: string | null;
  assetType?: TripoAssetType;
  assetCategory?: TripoAssetCategory;
  pipelineMode?: TripoPipelineMode;
  rigStatus?: TripoRigStatus;
  rigTaskId?: string;
  animationTaskId?: string;
  riggedModelUrl?: string | null;
  animatedModelUrl?: string | null;
  raw: Record<string, unknown>;
  cachedAt: number;
  expiresAt: number;
};

export type TripoAnimationKind = "prerigcheck" | "rig" | "retarget";

export type TripoAnimationStatus = TripoTaskStatus;

export type TripoAnimationPresetId =
  | "robot_idle"
  | "robot_pointing"
  | "guide_wave"
  | "guide_pointing"
  | "walk_loop";

export type TripoAnimationPreset = {
  id: TripoAnimationPresetId;
  label: string;
  targetAssetTypes: TripoAssetType[];
  motionHint: string;
  tripoAnimation: string;
  fallbackTripoAnimation?: string;
};

export type TripoAnimationCreateTaskResponse = {
  taskId: string;
  kind: TripoAnimationKind;
  status: TripoAnimationStatus;
  rigStatus: TripoRigStatus;
  mock: boolean;
  modelUrl: string | null;
  riggedModelUrl: string | null;
  animatedModelUrl: string | null;
  raw: Record<string, unknown>;
  message: string;
};

export type TripoAnimationTaskResponse = {
  taskId: string;
  kind: TripoAnimationKind;
  status: TripoAnimationStatus;
  rigStatus: TripoRigStatus;
  mock: boolean;
  modelUrl: string | null;
  riggedModelUrl: string | null;
  animatedModelUrl: string | null;
  raw: Record<string, unknown>;
};

export type TripoAnimationCacheEntry = {
  taskId: string;
  sourceTaskId?: string;
  sourceModelUrl?: string;
  kind: TripoAnimationKind;
  assetType?: TripoAssetType;
  presetId?: TripoAnimationPresetId;
  status: TripoAnimationStatus;
  rigStatus: TripoRigStatus;
  modelUrl: string | null;
  riggedModelUrl: string | null;
  animatedModelUrl: string | null;
  raw: Record<string, unknown>;
  mock: boolean;
  cachedAt: number;
  expiresAt: number;
};

export type TripoAssetPipelineResult = {
  ok: boolean;
  assetCategory: TripoAssetCategory;
  assetType: TripoAssetType;
  pipelineMode: TripoPipelineMode;
  mock: boolean;
  generateTaskId?: string;
  rigTaskId?: string;
  animationTaskId?: string;
  status: string;
  rigStatus?: TripoRigStatus;
  modelUrl?: string | null;
  riggedModelUrl?: string | null;
  animatedModelUrl?: string | null;
  message: string;
  raw?: unknown;
};

export const TRIPO_MAX_PROMPT_LENGTH = 800;
export const TRIPO_REFERENCE_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
export const TRIPO_REFERENCE_IMAGE_ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;
export const TRIPO_REFERENCE_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

export const TRIPO_TERMINAL_STATUSES: TripoTaskStatus[] = [
  "success",
  "failed",
  "banned",
  "expired",
  "cancelled",
  "unknown",
];

export function isFinalTripoStatus(status: TripoTaskStatus) {
  return TRIPO_TERMINAL_STATUSES.includes(status);
}
