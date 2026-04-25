import * as THREE from "three";

// TODO: Edit this BONE_MAP to match the names printed in the console.
// The current doctor.glb uses Mixamo-style names such as mixamorig_LeftArm.
// If you rename bones in Blender to semantic names, this is the only mapping
// that should need changing.
export const BONE_MAP = {
  root: "mixamorig_Hips",
  spine: "mixamorig_Spine",
  neck: "mixamorig_Neck",
  head: "mixamorig_Head",
  leftUpperArm: "mixamorig_LeftArm",
  leftForearm: "mixamorig_LeftForeArm",
  leftHand: "mixamorig_LeftHand",
  rightUpperArm: "mixamorig_RightArm",
  rightForearm: "mixamorig_RightForeArm",
  rightHand: "mixamorig_RightHand",
  leftThigh: "mixamorig_LeftUpLeg",
  leftShin: "mixamorig_LeftLeg",
  leftFoot: "mixamorig_LeftFoot",
  rightThigh: "mixamorig_RightUpLeg",
  rightShin: "mixamorig_RightLeg",
  rightFoot: "mixamorig_RightFoot",
};

const DEFAULT_SPEED_DEG = 520;

export function createJointDefsFromBoneMap(boneMap = BONE_MAP, axisOverrides = {}) {
  const axisFor = (jointName, fallback) => axisOverrides[jointName] ?? fallback;
  return [
    { jointName: "head_yaw", boneName: boneMap.head, axis: axisFor("head_yaw", [0, 1, 0]), min: -45, max: 45, speed: 360 },
    { jointName: "head_pitch", boneName: boneMap.head, axis: axisFor("head_pitch", [1, 0, 0]), min: -22, max: 22, speed: 360 },
    { jointName: "left_shoulder", boneName: boneMap.leftUpperArm, axis: axisFor("left_shoulder", [1, 0, 0]), min: -85, max: 85, speed: 540 },
    { jointName: "left_elbow", boneName: boneMap.leftForearm, axis: axisFor("left_elbow", [1, 0, 0]), min: -105, max: 8, speed: 560 },
    { jointName: "left_hand", boneName: boneMap.leftHand, axis: axisFor("left_hand", [0, 0, 1]), min: -32, max: 32, speed: 520 },
    { jointName: "right_shoulder", boneName: boneMap.rightUpperArm, axis: axisFor("right_shoulder", [1, 0, 0]), min: -85, max: 85, speed: 540 },
    { jointName: "right_elbow", boneName: boneMap.rightForearm, axis: axisFor("right_elbow", [1, 0, 0]), min: -105, max: 8, speed: 560 },
    { jointName: "right_hand", boneName: boneMap.rightHand, axis: axisFor("right_hand", [0, 0, 1]), min: -32, max: 32, speed: 520 },
    { jointName: "left_hip", boneName: boneMap.leftThigh ?? boneMap.leftLeg, axis: axisFor("left_hip", [1, 0, 0]), min: -42, max: 42, speed: 560 },
    { jointName: "left_knee", boneName: boneMap.leftShin, axis: axisFor("left_knee", [-1, 0, 0]), min: -4, max: 72, speed: 620 },
    { jointName: "left_ankle", boneName: boneMap.leftFoot, axis: axisFor("left_ankle", [1, 0, 0]), min: -26, max: 26, speed: 560 },
    { jointName: "right_hip", boneName: boneMap.rightThigh ?? boneMap.rightLeg, axis: axisFor("right_hip", [1, 0, 0]), min: -42, max: 42, speed: 560 },
    { jointName: "right_knee", boneName: boneMap.rightShin, axis: axisFor("right_knee", [-1, 0, 0]), min: -4, max: 72, speed: 620 },
    { jointName: "right_ankle", boneName: boneMap.rightFoot, axis: axisFor("right_ankle", [1, 0, 0]), min: -26, max: 26, speed: 560 },
  ].filter((jointDef) => Boolean(jointDef.boneName));
}

export const DEFAULT_JOINT_DEFS = createJointDefsFromBoneMap(BONE_MAP);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toAxis(axis) {
  const v = new THREE.Vector3(axis[0], axis[1], axis[2]);
  if (v.lengthSq() === 0) v.set(1, 0, 0);
  return v.normalize();
}

function findBoneByName(root, name) {
  const exact = root.getObjectByName(name);
  if (exact?.isBone) return exact;

  let loose = null;
  const normalized = name.toLowerCase();
  root.traverse((object) => {
    if (!loose && object.isBone && object.name.toLowerCase() === normalized) loose = object;
  });
  return loose;
}

export class RobotJointController {
  constructor(robotRoot, options = {}) {
    this.robotRoot = robotRoot;
    this.joints = new Map();
    this.jointOrder = [];
    this.bones = new Map();
    this.restRotations = new Map();
    this.missingBones = new Set();
    this.availableBones = [];
    this.lastUpdateTime = performance.now();
    this._deltaQuaternion = new THREE.Quaternion();

    this.collectBones();
    this.boneMap = options.boneMap ?? BONE_MAP;
    this.axisOverrides = options.axisOverrides ?? {};
    const jointDefs = options.jointDefs ?? createJointDefsFromBoneMap(this.boneMap, this.axisOverrides);
    jointDefs.forEach((jointDef) => this.addJoint(jointDef));
    this.printAvailableBones();
    this.printMappedJoints();
  }

  collectBones() {
    this.availableBones = [];
    this.robotRoot.traverse((object) => {
      if (object.isBone) this.availableBones.push(object.name || "(unnamed bone)");
    });
  }

  printAvailableBones() {
    console.log("Bone list:");
    console.log("Bone names:", this.availableBones.join(", "));
    console.table(this.availableBones);
    if (this.availableBones.length === 0) {
      console.warn("No bones found in robotRoot. Confirm the GLB contains an Armature with exported bones.");
    }
  }

  addJoint(jointDef) {
    const boneName = jointDef.boneName;
    const bone = findBoneByName(this.robotRoot, boneName);
    const joint = {
      jointName: jointDef.jointName,
      boneName,
      bone,
      axis: toAxis(jointDef.axis),
      min: jointDef.min,
      max: jointDef.max,
      speed: jointDef.speed ?? DEFAULT_SPEED_DEG,
      value: clamp(jointDef.value ?? 0, jointDef.min, jointDef.max),
      target: clamp(jointDef.target ?? jointDef.value ?? 0, jointDef.min, jointDef.max),
    };

    this.joints.set(joint.jointName, joint);
    this.jointOrder.push(joint.jointName);

    if (!bone) {
      this.missingBones.add(boneName);
      console.warn(`Missing bone for joint "${joint.jointName}": expected "${boneName}".`);
      return;
    }

    this.bones.set(boneName, bone);
    if (!this.restRotations.has(boneName)) this.restRotations.set(boneName, bone.quaternion.clone());
  }

  printMappedJoints() {
    const mapped = this.jointOrder.map((jointName) => {
      const joint = this.joints.get(jointName);
      return {
        jointName,
        boneName: joint.boneName,
        mapped: Boolean(joint.bone),
        axis: joint.axis.toArray().map((v) => Number(v.toFixed(3))).join(", "),
        min: joint.min,
        max: joint.max,
      };
    });

    console.log("Mapped joints:");
    console.table(mapped);
    console.log("Missing bones:");
    console.table([...this.missingBones]);
  }

  setJointTarget(jointName, angleDeg) {
    const joint = this.joints.get(jointName);
    if (!joint) {
      console.warn(`Unknown joint target "${jointName}".`);
      return;
    }
    joint.target = clamp(Number(angleDeg) || 0, joint.min, joint.max);
  }

  getJointValue(jointName) {
    return this.joints.get(jointName)?.value ?? null;
  }

  getJointDefinitions() {
    return this.jointOrder.map((jointName) => this.joints.get(jointName));
  }

  getBoneForJoint(jointName) {
    return this.joints.get(jointName)?.bone ?? null;
  }

  applyAction(action) {
    if (!action) return;
    for (const [jointName, angleDeg] of Object.entries(action)) {
      this.setJointTarget(jointName, angleDeg);
    }
  }

  update(dt) {
    const safeDt = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    for (const joint of this.joints.values()) {
      const diff = joint.target - joint.value;
      const maxStep = joint.speed * safeDt;
      if (Math.abs(diff) <= maxStep || maxStep === 0) joint.value = joint.target;
      else joint.value += Math.sign(diff) * maxStep;
    }

    this.applyBoneRotations();
    this.lastUpdateTime = performance.now();
  }

  applyBoneRotations() {
    const jointsByBone = new Map();
    for (const jointName of this.jointOrder) {
      const joint = this.joints.get(jointName);
      if (!joint?.bone) continue;
      if (!jointsByBone.has(joint.boneName)) jointsByBone.set(joint.boneName, []);
      jointsByBone.get(joint.boneName).push(joint);
    }

    for (const [boneName, joints] of jointsByBone.entries()) {
      const bone = this.bones.get(boneName);
      const rest = this.restRotations.get(boneName);
      if (!bone || !rest) continue;

      const combined = rest.clone();
      for (const joint of joints) {
        this._deltaQuaternion.setFromAxisAngle(joint.axis, THREE.MathUtils.degToRad(joint.value));
        combined.multiply(this._deltaQuaternion);
      }
      bone.quaternion.copy(combined);
      bone.updateMatrixWorld(true);
    }
  }

  getObservation() {
    const joints = {};
    for (const jointName of this.jointOrder) {
      const joint = this.joints.get(jointName);
      joints[jointName] = {
        value: joint.value,
        target: joint.target,
        min: joint.min,
        max: joint.max,
        mapped: Boolean(joint.bone),
      };
    }

    return {
      t: performance.now() / 1000,
      joints,
      missingBones: [...this.missingBones],
      availableBones: [...this.availableBones],
    };
  }

  getActionSnapshot() {
    const action = {};
    for (const jointName of this.jointOrder) {
      const joint = this.joints.get(jointName);
      action[jointName] = joint.target;
    }
    return action;
  }

  reset() {
    for (const joint of this.joints.values()) {
      joint.value = 0;
      joint.target = 0;
    }
    this.applyBoneRotations();
  }
}
