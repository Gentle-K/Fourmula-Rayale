export const ASSET_KINDS = {
  AUTO: "auto",
  ROBOT_REPLACEMENT: "robot_replacement",
  SCENE_OBJECT: "scene_object",
  SCENE_LAYOUT: "scene_layout",
};

const ROBOT_KEYWORDS = [
  "robot",
  "agent",
  "character",
  "humanoid",
  "android",
  "walk",
  "walking",
  "replace",
  "replacement",
  "maintenance robot",
  "repair robot",
  "机械人",
  "机器人",
  "替换",
  "人形",
];

const OBJECT_KEYWORDS = [
  "tool",
  "toolbox",
  "panel",
  "box",
  "cup",
  "button",
  "switch",
  "pipe",
  "debris",
  "module",
  "object",
  "prop",
  "水杯",
  "工具",
  "工具箱",
  "面板",
  "按钮",
  "管道",
];

const LAYOUT_KEYWORDS = ["floor plan", "layout", "blueprint", "map", "平面图", "布局", "舱段图"];

const SEMANTIC_KEYWORDS = [
  ["toolbox", ["toolbox", "tool box", "工具箱"]],
  ["tool", ["tool", "wrench", "screwdriver", "drill", "工具", "扳手", "螺丝刀"]],
  ["control_panel", ["panel", "switch", "button", "console", "面板", "开关", "按钮"]],
  ["container", ["box", "crate", "case", "storage", "盒", "箱"]],
  ["cup", ["cup", "bottle", "mug", "水杯", "杯子"]],
  ["pipe", ["pipe", "tube", "hose", "管道"]],
  ["debris", ["debris", "fragment", "floating", "碎片", "漂浮物"]],
];

function includesAny(input, keywords) {
  return keywords.some((keyword) => input.includes(keyword));
}

export function inferSemanticClass(rawInput = "") {
  const input = rawInput.toLowerCase();
  for (const [semanticClass, keywords] of SEMANTIC_KEYWORDS) {
    if (includesAny(input, keywords)) return semanticClass;
  }
  return "training_object";
}

export function classifyAssetIntent({ rawInput = "", explicitKind = ASSET_KINDS.AUTO, inputType = "text" } = {}) {
  const normalizedKind = explicitKind === ASSET_KINDS.AUTO ? null : explicitKind;
  const input = rawInput.toLowerCase();
  const fromLayoutInput = inputType === "floor_plan" || includesAny(input, LAYOUT_KEYWORDS);
  const fromRobotInput = includesAny(input, ROBOT_KEYWORDS);
  const fromObjectInput = includesAny(input, OBJECT_KEYWORDS);

  let assetKind = normalizedKind;
  let confidence = normalizedKind ? 1 : 0.5;
  let ambiguous = false;

  if (!assetKind) {
    if (fromLayoutInput) {
      assetKind = ASSET_KINDS.SCENE_LAYOUT;
      confidence = 0.92;
    } else if (fromRobotInput && !fromObjectInput) {
      assetKind = ASSET_KINDS.ROBOT_REPLACEMENT;
      confidence = 0.88;
    } else if (fromObjectInput && !fromRobotInput) {
      assetKind = ASSET_KINDS.SCENE_OBJECT;
      confidence = 0.86;
    } else if (fromRobotInput && fromObjectInput) {
      assetKind = ASSET_KINDS.ROBOT_REPLACEMENT;
      confidence = 0.62;
      ambiguous = true;
    } else {
      assetKind = ASSET_KINDS.SCENE_OBJECT;
      confidence = 0.55;
      ambiguous = true;
    }
  }

  const requiresRig = assetKind === ASSET_KINDS.ROBOT_REPLACEMENT;
  return {
    assetKind,
    confidence,
    ambiguous,
    inputType,
    rawInput,
    requiresRig,
    requiresRobotSwap: assetKind === ASSET_KINDS.ROBOT_REPLACEMENT,
    requiresScenePlacement: assetKind === ASSET_KINDS.SCENE_OBJECT,
    targetSlot: assetKind === ASSET_KINDS.ROBOT_REPLACEMENT ? "main_robot_agent" : "jpm_habitat_scene",
    semanticClass: assetKind === ASSET_KINDS.SCENE_OBJECT ? inferSemanticClass(rawInput) : null,
  };
}
