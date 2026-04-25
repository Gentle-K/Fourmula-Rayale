import * as THREE from "three";

const DEFAULT_AFFORDANCES = {
  toolbox: ["graspable", "movable", "placeable"],
  tool: ["graspable", "movable", "usable"],
  control_panel: ["touchable", "inspectable", "repair"],
  cup: ["graspable", "movable", "openable"],
  pipe: ["inspectable", "repair", "alignable"],
  debris: ["graspable", "movable", "cleaning"],
  training_object: ["graspable", "movable", "placeable"],
};

export class AssetPostProcessor {
  constructor({ targetSize = 0.55 } = {}) {
    this.targetSize = targetSize;
  }

  processSceneObject(gltfScene, { semanticClass = "training_object", displayName = "Generated object", modelUrl = "" } = {}) {
    const container = new THREE.Group();
    container.name = `Generated_${displayName.replace(/[^a-z0-9]+/gi, "_")}`;
    const model = gltfScene;
    container.add(model);

    model.traverse((object) => {
      if (object.isMesh || object.isSkinnedMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        object.frustumCulled = false;
      }
    });

    this.normalizeChild(model);
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    model.position.sub(center);
    model.updateWorldMatrix(true, true);

    const normalizedBox = new THREE.Box3().setFromObject(model);
    const colliderSize = new THREE.Vector3();
    normalizedBox.getSize(colliderSize);
    const collider = this.createCollider(colliderSize);
    container.add(collider);

    const affordances = DEFAULT_AFFORDANCES[semanticClass] ?? DEFAULT_AFFORDANCES.training_object;
    const interactionPoints = [
      {
        id: "grasp_top",
        type: affordances.includes("touchable") ? "touch" : "grasp",
        localPosition: [0, Math.max(0.05, colliderSize.y * 0.5), 0],
      },
    ];

    return {
      root: container,
      collider,
      colliderSize,
      metadata: {
        assetKind: "scene_object",
        requiresRig: false,
        source: "tripo3d",
        semanticClass,
        displayName,
        modelUrl,
        collider: {
          type: "box",
          size: colliderSize.toArray().map((value) => Number(value.toFixed(3))),
        },
        affordances,
        interactionPoints,
        learnable: true,
        taskHooks: inferTaskHooks(semanticClass, affordances),
      },
    };
  }

  normalizeChild(model) {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.scale.setScalar(1);
    model.updateWorldMatrix(true, true);

    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const max = Math.max(size.x, size.y, size.z);
    if (max > 0 && Number.isFinite(max)) model.scale.setScalar(this.targetSize / max);
    model.updateWorldMatrix(true, true);
  }

  createCollider(size) {
    const safeSize = new THREE.Vector3(
      Math.max(0.08, size.x),
      Math.max(0.08, size.y),
      Math.max(0.08, size.z),
    );
    const collider = new THREE.Mesh(
      new THREE.BoxGeometry(safeSize.x, safeSize.y, safeSize.z),
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.12,
        wireframe: true,
        depthWrite: false,
      }),
    );
    collider.name = "GeneratedObjectCollider";
    collider.userData.isGeneratedObjectCollider = true;
    return collider;
  }
}

function inferTaskHooks(semanticClass, affordances) {
  const hooks = new Set();
  if (affordances.includes("graspable")) hooks.add("grasp");
  if (affordances.includes("placeable")) hooks.add("place");
  if (semanticClass === "control_panel") hooks.add("repair");
  if (semanticClass === "debris") hooks.add("cleaning");
  if (semanticClass === "toolbox" || semanticClass === "tool") hooks.add("storage");
  return [...hooks];
}
