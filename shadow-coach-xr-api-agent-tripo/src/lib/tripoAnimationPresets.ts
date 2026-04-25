import { TripoAnimationPreset } from "@/lib/types";

export const TRIPO_ANIMATION_PRESETS = {
  ROBOT_IDLE: {
    id: "robot_idle",
    label: "Robot Idle Hover",
    targetAssetTypes: ["assistant_robot", "small_creature"],
    motionHint:
      "subtle idle hover loop in microgravity, slight bobbing and gentle rotation",
    tripoAnimation: "preset:idle",
  },
  ROBOT_POINTING: {
    id: "robot_pointing",
    label: "Robot Pointing",
    targetAssetTypes: ["assistant_robot"],
    motionHint: "robot turns and points toward a maintenance panel",
    tripoAnimation: "preset:turn",
  },
  GUIDE_WAVE: {
    id: "guide_wave",
    label: "Guide Wave",
    targetAssetTypes: ["astronaut", "humanoid_guide"],
    motionHint: "friendly waving animation",
    tripoAnimation: "preset:biped:wave_goodbye_01",
    fallbackTripoAnimation: "preset:idle",
  },
  GUIDE_POINTING: {
    id: "guide_pointing",
    label: "Guide Pointing",
    targetAssetTypes: ["astronaut", "humanoid_guide"],
    motionHint: "pointing toward a tool or control panel",
    tripoAnimation: "preset:turn",
  },
  WALK_LOOP: {
    id: "walk_loop",
    label: "Walk Loop",
    targetAssetTypes: ["astronaut", "humanoid_guide"],
    motionHint: "slow walking loop",
    tripoAnimation: "preset:walk",
  },
} satisfies Record<string, TripoAnimationPreset>;

export const TRIPO_ANIMATION_PRESET_ORDER = [
  "ROBOT_IDLE",
  "ROBOT_POINTING",
  "GUIDE_WAVE",
  "GUIDE_POINTING",
  "WALK_LOOP",
] as const;
