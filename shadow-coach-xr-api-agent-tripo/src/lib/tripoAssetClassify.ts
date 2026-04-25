import {
  TripoAssetCategory,
  TripoAssetType,
  TripoPipelineMode,
} from "@/lib/types";

const STATIC_ASSET_TYPES: TripoAssetType[] = [
  "iss_module",
  "tool_kit",
  "control_panel",
  "storage_bag",
  "handrail",
  "cable_bundle",
  "cupola_window",
  "cleaning_cloth",
  "docking_pad",
  "floating_tablet",
  "custom",
];

const RIGGABLE_ASSET_TYPES: TripoAssetType[] = [
  "assistant_robot",
  "astronaut",
  "humanoid_guide",
  "small_creature",
];

export function getAssetCategory(
  assetType: TripoAssetType,
): TripoAssetCategory {
  return RIGGABLE_ASSET_TYPES.includes(assetType) ? "riggable" : "static";
}

export function shouldRigAsset(
  assetType: TripoAssetType,
  manualOverride = false,
) {
  return manualOverride || RIGGABLE_ASSET_TYPES.includes(assetType);
}

export function getRecommendedPipelineMode(
  assetType: TripoAssetType,
  options?: {
    includeAnimation?: boolean;
    manualOverrideRig?: boolean;
  },
): TripoPipelineMode {
  if (!shouldRigAsset(assetType, options?.manualOverrideRig)) {
    return "static_generate";
  }

  if (assetType === "assistant_robot") {
    return options?.includeAnimation
      ? "generate_rig_then_animate"
      : "generate_then_rig";
  }

  return "generate_rig_then_animate";
}

export { RIGGABLE_ASSET_TYPES, STATIC_ASSET_TYPES };
