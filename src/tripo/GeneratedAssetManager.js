export class GeneratedAssetManager {
  constructor() {
    this.assets = new Map();
    this.sceneObjects = new Map();
    this.tasks = [];
  }

  createAssetRecord(record) {
    const assetId = record.assetId || `asset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const next = {
      assetId,
      source: "tripo3d",
      status: "created",
      createdAt: performance.now() / 1000,
      ...record,
    };
    this.assets.set(assetId, next);
    return next;
  }

  updateAsset(assetId, patch) {
    const current = this.assets.get(assetId);
    if (!current) return null;
    const next = { ...current, ...patch, updatedAt: performance.now() / 1000 };
    this.assets.set(assetId, next);
    return next;
  }

  registerSceneObject(record) {
    const objectId = record.objectId || `obj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const next = {
      objectId,
      assetKind: "scene_object",
      source: "tripo3d",
      learnable: true,
      createdAt: performance.now() / 1000,
      ...record,
      objectId,
    };
    this.sceneObjects.set(objectId, next);
    return next;
  }

  updateSceneObject(objectId, patch) {
    const current = this.sceneObjects.get(objectId);
    if (!current) return null;
    const next = { ...current, ...patch, updatedAt: performance.now() / 1000 };
    this.sceneObjects.set(objectId, next);
    return next;
  }

  createTaskFromSceneObject(sceneObject) {
    const task = {
      taskId: `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      objectId: sceneObject.objectId,
      type: inferTaskType(sceneObject),
      semanticClass: sceneObject.semanticClass,
      affordances: sceneObject.affordances,
      status: "ready_for_demo_or_training",
      createdAt: performance.now() / 1000,
    };
    this.tasks.unshift(task);
    return task;
  }

  getAssetList() {
    return [...this.assets.values()].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }

  getSceneObjects() {
    return [...this.sceneObjects.values()];
  }

  getLatestTask() {
    return this.tasks[0] ?? null;
  }
}

function inferTaskType(sceneObject) {
  if (sceneObject.affordances?.includes("graspable")) return "learn_grasp_and_place";
  if (sceneObject.semanticClass === "control_panel") return "learn_panel_touch_sequence";
  return "learn_interact_with_object";
}
