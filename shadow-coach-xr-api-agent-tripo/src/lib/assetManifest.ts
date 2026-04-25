import { TripoAssetCategory, TripoAssetType } from "@/lib/types";

export const ASSET_PIPELINE_RULES = {
  staticAssetTypes: [
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
  ],
  riggableAssetTypes: [
    "assistant_robot",
    "astronaut",
    "humanoid_guide",
    "small_creature",
  ],
} as const;

export type AssetManifestEntry = {
  assetType: TripoAssetType;
  assetCategory: TripoAssetCategory;
  modelUrl?: string | null;
  riggedModelUrl?: string | null;
  animatedModelUrl?: string | null;
};
