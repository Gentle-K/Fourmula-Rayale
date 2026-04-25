import { ASSET_KINDS, classifyAssetIntent } from "./AssetIntentClassifier.js";

function cleanPrompt(rawInput = "") {
  return String(rawInput).replace(/\s+/g, " ").trim();
}

export function normalizePrompt(intent, overrides = {}) {
  const raw = cleanPrompt(overrides.prompt ?? intent.rawInput);
  const base = raw || "a compact ISS training asset";

  if (intent.assetKind === ASSET_KINDS.ROBOT_REPLACEMENT) {
    return [
      base,
      "riggable humanoid or service robot character",
      "clear head, torso, two arms, hands, two legs, visible joint structure",
      "space station maintenance robot for ISS WebXR embodied AI training",
      "game-ready GLB, clean topology, neutral T-pose or A-pose, no environment base",
    ].join(", ");
  }

  if (intent.assetKind === ASSET_KINDS.SCENE_LAYOUT) {
    return [
      base,
      "ISS module layout reference",
      "generate concise spatial training props and module layout suggestions",
      "low-poly WebXR friendly visual style",
    ].join(", ");
  }

  return [
    base,
    "static low-poly 3D prop for an International Space Station VR training scene",
    "game-ready GLB, clean silhouette, no rigging, no character body",
    "usable affordances for robot manipulation training",
  ].join(", ");
}

export function buildGenerationRequest({ rawInput, inputType, explicitKind, prompt, semanticClass, imageBase64, imageMime }) {
  const intent = classifyAssetIntent({ rawInput, explicitKind, inputType });
  const normalizedPrompt = normalizePrompt(intent, { prompt });
  return {
    rawInput,
    inputType,
    assetKind: intent.assetKind,
    prompt: normalizedPrompt,
    imageBase64,
    imageMime,
    semanticClass: semanticClass || intent.semanticClass,
    intent,
  };
}
