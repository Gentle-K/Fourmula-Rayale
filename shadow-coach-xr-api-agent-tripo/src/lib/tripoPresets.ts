import { TripoPromptPreset } from "@/lib/types";

export const STATIC_ASSET_PRESETS = {
  ISS_MODULE: {
    id: "ISS_MODULE",
    label: "ISS Module",
    assetType: "iss_module",
    assetCategory: "static",
    prompt:
      "A realistic International Space Station module interior with white curved walls, handrails, control panels, cable details, storage bags, soft lighting, optimized as a low-poly GLB asset for WebXR.",
  },
  ISS_TOOL_KIT: {
    id: "ISS_TOOL_KIT",
    label: "ISS Tool Kit",
    assetType: "tool_kit",
    assetCategory: "static",
    prompt:
      "A compact astronaut tool kit floating in zero gravity, including wrench, screwdriver, tether hooks and small labeled equipment, clean sci-fi style, low-poly game-ready 3D model.",
  },
  ISS_CONTROL_PANEL: {
    id: "ISS_CONTROL_PANEL",
    label: "ISS Control Panel",
    assetType: "control_panel",
    assetCategory: "static",
    prompt:
      "A futuristic ISS control panel with screens, switches, warning labels, cables and modular surface details, low-poly 3D asset for a browser-based WebXR scene.",
  },
  ISS_STORAGE_BAG: {
    id: "ISS_STORAGE_BAG",
    label: "ISS Storage Bag",
    assetType: "storage_bag",
    assetCategory: "static",
    prompt:
      "A soft white fabric storage bag used inside a space station, with straps, zippers, label patches and velcro texture, low-poly 3D model.",
  },
  ISS_HANDRAIL: {
    id: "ISS_HANDRAIL",
    label: "ISS Handrail",
    assetType: "handrail",
    assetCategory: "static",
    prompt:
      "A curved white ISS interior handrail with mounting brackets, subtle wear, clean aerospace finish and low-poly geometry optimized for a browser-based WebXR training scene.",
  },
  ISS_CABLE_BUNDLE: {
    id: "ISS_CABLE_BUNDLE",
    label: "ISS Cable Bundle",
    assetType: "cable_bundle",
    assetCategory: "static",
    prompt:
      "A tidy bundle of ISS utility cables with clips, connectors and soft bends, designed as a low-poly modular prop for a space-station WebXR scene.",
  },
  CUPOLA_WINDOW: {
    id: "CUPOLA_WINDOW",
    label: "Cupola Window",
    assetType: "cupola_window",
    assetCategory: "static",
    prompt:
      "A low-poly ISS cupola observation window assembly with shutters, framing, bolts and a soft Earthlight reflection style for a browser-based WebXR training module.",
  },
  CLEANING_CLOTH: {
    id: "CLEANING_CLOTH",
    label: "Cleaning Cloth",
    assetType: "cleaning_cloth",
    assetCategory: "static",
    prompt:
      "A soft microfiber cleaning cloth used inside the ISS, folded into a compact low-poly prop with clean stitching, subtle fabric texture, and WebXR-friendly topology.",
  },
  DOCKING_PAD: {
    id: "DOCKING_PAD",
    label: "Docking Pad",
    assetType: "docking_pad",
    assetCategory: "static",
    prompt:
      "A compact docking pad for an interior maintenance robot, with guide lights, clean industrial surface details, and simple low-poly geometry for a browser-based XR training demo.",
  },
  FLOATING_TABLET: {
    id: "FLOATING_TABLET",
    label: "Floating Tablet",
    assetType: "floating_tablet",
    assetCategory: "static",
    prompt:
      "A compact astronaut tablet floating in microgravity, protected corners, tether loop, simple mission UI and a clean low-poly sci-fi aesthetic for a WebXR training environment.",
  },
} satisfies Record<string, TripoPromptPreset>;

export const RIGGABLE_ASSET_PRESETS = {
  ASSISTANT_ROBOT: {
    id: "ASSISTANT_ROBOT",
    label: "Assistant Robot",
    assetType: "assistant_robot",
    assetCategory: "riggable",
    defaultPipelineMode: "generate_then_rig",
    prompt:
      "A small friendly assistant robot designed for an ISS training module, symmetrical compact body, clear sensor head, small articulated side arms, simple thruster modules, white shell, blue sensor eye, floating in microgravity, game-ready 3D model suitable for rigging and simple idle animation, clean topology, PBR materials, no people, no readable text, no watermark.",
  },
  ASTRONAUT_GUIDE: {
    id: "ASTRONAUT_GUIDE",
    label: "Astronaut Guide",
    assetType: "astronaut",
    assetCategory: "riggable",
    defaultPipelineMode: "generate_rig_then_animate",
    prompt:
      "A stylized astronaut guide character for an ISS training demo, humanoid proportions, clear arms and legs, simple spacesuit, friendly helmet visor, symmetrical stance, T-pose or neutral pose, game-ready 3D model suitable for rigging and retargeted waving animation, clean topology, no readable text, no watermark.",
  },
  HUMANOID_GUIDE: {
    id: "HUMANOID_GUIDE",
    label: "Humanoid Guide",
    assetType: "humanoid_guide",
    assetCategory: "riggable",
    defaultPipelineMode: "generate_rig_then_animate",
    prompt:
      "A stylized humanoid maintenance guide character for a browser-based ISS training demo, symmetrical body, clear shoulders, arms, hands, legs and feet, simple suit pieces, neutral stance, game-ready 3D model suitable for rigging and retargeted gestures, clean topology, PBR materials, no readable text, no watermark.",
  },
  SMALL_CREATURE_ROBOT: {
    id: "SMALL_CREATURE_ROBOT",
    label: "Small Creature Robot",
    assetType: "small_creature",
    assetCategory: "riggable",
    defaultPipelineMode: "generate_rig_then_animate",
    prompt:
      "A small cute maintenance robot creature for a space station, symmetrical body, clear legs or small articulated appendages, simple clean silhouette, game-ready model suitable for rigging and looping idle animation, PBR materials, no readable text, no watermark.",
  },
} satisfies Record<string, TripoPromptPreset>;

export const STATIC_ASSET_PRESET_ORDER = [
  "ISS_MODULE",
  "ISS_TOOL_KIT",
  "ISS_CONTROL_PANEL",
  "ISS_STORAGE_BAG",
  "ISS_HANDRAIL",
  "ISS_CABLE_BUNDLE",
  "CUPOLA_WINDOW",
  "CLEANING_CLOTH",
  "DOCKING_PAD",
  "FLOATING_TABLET",
] as const;

export const RIGGABLE_ASSET_PRESET_ORDER = [
  "ASSISTANT_ROBOT",
  "ASTRONAUT_GUIDE",
  "HUMANOID_GUIDE",
  "SMALL_CREATURE_ROBOT",
] as const;

export const TRIPO_PROMPT_PRESETS = {
  ...STATIC_ASSET_PRESETS,
  ...RIGGABLE_ASSET_PRESETS,
};

export const TRIPO_PROMPT_PRESET_ORDER = [
  ...STATIC_ASSET_PRESET_ORDER,
  ...RIGGABLE_ASSET_PRESET_ORDER,
] as const;
