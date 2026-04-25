import * as THREE from "three";

export class RigValidator {
  validate(robotRoot) {
    const bones = [];
    const skinnedMeshes = [];
    let meshCount = 0;
    let triangleCount = 0;

    robotRoot.traverse((object) => {
      if (object.isBone) bones.push(object);
      if (object.isSkinnedMesh) skinnedMeshes.push(object);
      if (object.isMesh || object.isSkinnedMesh) {
        meshCount += 1;
        const position = object.geometry?.attributes?.position;
        triangleCount += position ? Math.floor(position.count / 3) : 0;
      }
    });

    const boneNames = bones.map((bone) => bone.name || "(unnamed)");
    const box = new THREE.Box3().setFromObject(robotRoot);
    const size = new THREE.Vector3();
    box.getSize(size);
    const hasHead = boneNames.some((name) => /head|neck/i.test(name));
    const hasLeftArm = boneNames.some((name) => /(left|\.l|_l| l\b).*(arm|forearm|hand)|arm.*(\.l|left|_l)/i.test(name));
    const hasRightArm = boneNames.some((name) => /(right|\.r|_r| r\b).*(arm|forearm|hand)|arm.*(\.r|right|_r)/i.test(name));
    const missing = [];
    if (bones.length === 0) missing.push("Armature bones");
    if (skinnedMeshes.length === 0) missing.push("SkinnedMesh");
    if (!hasHead) missing.push("head bone");
    if (!hasLeftArm) missing.push("left arm bones");
    if (!hasRightArm) missing.push("right arm bones");

    const warnings = [];
    if (triangleCount > 180000) warnings.push(`High triangle count: ${triangleCount}`);
    if (!Number.isFinite(size.y) || size.y <= 0) warnings.push("Could not compute robot scale.");

    return {
      ok: missing.length === 0,
      reason: missing.length ? `Missing ${missing.join(", ")}.` : null,
      missing,
      warnings,
      metrics: {
        boneCount: bones.length,
        skinnedMeshCount: skinnedMeshes.length,
        meshCount,
        triangleCount,
        size: size.toArray().map((value) => Number(value.toFixed(3))),
      },
      boneNames,
    };
  }
}
