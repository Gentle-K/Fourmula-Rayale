export const CANONICAL_BONES = {
  root: ["hips", "pelvis", "root", "mixamorig_hips"],
  spine: ["spine", "chest", "torso"],
  neck: ["neck"],
  head: ["head"],
  leftUpperArm: ["leftarm", "left_arm", "upper_arm.l", "upperarm.l", "l_upperarm", "mixamorig_leftarm"],
  leftForearm: ["leftforearm", "left_forearm", "forearm.l", "lower_arm.l", "mixamorig_leftforearm"],
  leftHand: ["lefthand", "left_hand", "hand.l", "mixamorig_lefthand"],
  rightUpperArm: ["rightarm", "right_arm", "upper_arm.r", "upperarm.r", "r_upperarm", "mixamorig_rightarm"],
  rightForearm: ["rightforearm", "right_forearm", "forearm.r", "lower_arm.r", "mixamorig_rightforearm"],
  rightHand: ["righthand", "right_hand", "hand.r", "mixamorig_righthand"],
  leftThigh: ["leftupleg", "left_thigh", "thigh.l", "upper_leg.l", "mixamorig_leftupleg"],
  leftShin: ["leftleg", "left_shin", "shin.l", "lower_leg.l", "calf.l", "mixamorig_leftleg"],
  leftFoot: ["leftfoot", "left_foot", "foot.l", "mixamorig_leftfoot"],
  rightThigh: ["rightupleg", "right_thigh", "thigh.r", "upper_leg.r", "mixamorig_rightupleg"],
  rightShin: ["rightleg", "right_shin", "shin.r", "lower_leg.r", "calf.r", "mixamorig_rightleg"],
  rightFoot: ["rightfoot", "right_foot", "foot.r", "mixamorig_rightfoot"],
};

const CRITICAL_KEYS = ["head", "leftUpperArm", "leftForearm", "leftHand", "rightUpperArm", "rightForearm", "rightHand"];

export class BoneMappingManager {
  createMap(robotRoot) {
    const bones = [];
    robotRoot.traverse((object) => {
      if (object.isBone) bones.push(object);
    });

    const availableBones = bones.map((bone) => bone.name).filter(Boolean);
    const boneMap = {};
    const confidenceByKey = {};
    for (const [canonicalKey, synonyms] of Object.entries(CANONICAL_BONES)) {
      const match = findBestBone(availableBones, synonyms);
      if (match) {
        boneMap[canonicalKey] = match.name;
        confidenceByKey[canonicalKey] = match.score;
      }
    }

    const missingBones = CRITICAL_KEYS.filter((key) => !boneMap[key]);
    const mappedCount = Object.keys(boneMap).length;
    const confidence = mappedCount
      ? Object.values(confidenceByKey).reduce((sum, value) => sum + value, 0) / mappedCount
      : 0;

    return {
      ok: missingBones.length === 0,
      boneMap,
      missingBones,
      availableBones,
      confidence: Number(confidence.toFixed(2)),
      confidenceByKey,
    };
  }
}

function normalizeName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findBestBone(availableBones, synonyms) {
  let best = null;
  for (const boneName of availableBones) {
    const normalizedBone = normalizeName(boneName);
    for (const synonym of synonyms) {
      const normalizedSynonym = normalizeName(synonym);
      let score = 0;
      if (normalizedBone === normalizedSynonym) score = 1;
      else if (normalizedBone.endsWith(normalizedSynonym) || normalizedBone.includes(normalizedSynonym)) score = 0.82;
      else if (normalizedSynonym.includes(normalizedBone)) score = 0.68;
      if (score > (best?.score ?? 0)) best = { name: boneName, score };
    }
  }
  return best;
}
