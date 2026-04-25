import * as THREE from "three";

export class XRObjectManipulator {
  constructor({
    controllers = [],
    jointInteractor = null,
    pickTargetsProvider = () => [],
    enabled = false,
    rayLength = 6,
    onSelectionChange = () => {},
    onTransform = () => {},
  } = {}) {
    this.controllers = controllers;
    this.jointInteractor = jointInteractor;
    this.pickTargetsProvider = pickTargetsProvider;
    this.enabled = enabled;
    this.rayLength = rayLength;
    this.onSelectionChange = onSelectionChange;
    this.onTransform = onTransform;
    this.raycaster = new THREE.Raycaster();
    this.tempOrigin = new THREE.Vector3();
    this.tempDirection = new THREE.Vector3();
    this.tempQuaternion = new THREE.Quaternion();
    this.selected = null;
    this.controllerListeners = [];

    for (const controller of this.controllers) {
      const selectStart = () => this.onSelectStart(controller);
      const selectEnd = () => this.onSelectEnd(controller);
      controller.addEventListener("selectstart", selectStart);
      controller.addEventListener("selectend", selectEnd);
      this.controllerListeners.push({ controller, selectStart, selectEnd });
    }
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) this.clearSelection();
  }

  getObjectHit(controller) {
    const targets = this.pickTargetsProvider().filter(Boolean);
    if (!this.enabled || targets.length === 0) return null;
    this.tempOrigin.setFromMatrixPosition(controller.matrixWorld);
    this.tempDirection.set(0, 0, -1).applyQuaternion(controller.getWorldQuaternion(this.tempQuaternion)).normalize();
    this.raycaster.set(this.tempOrigin, this.tempDirection);
    this.raycaster.far = this.rayLength;
    return this.raycaster.intersectObjects(targets, true)[0] ?? null;
  }

  onSelectStart(controller) {
    if (!this.enabled) return;
    if (this.jointInteractor?.getHandleHit(controller)) return;
    const hit = this.getObjectHit(controller);
    if (!hit) return;

    const root = hit.object.userData.sceneObjectRoot ?? hit.object.parent;
    if (!root) return;
    const distance = this.tempOrigin.distanceTo(hit.point);
    this.selected = {
      controller,
      root,
      distance: THREE.MathUtils.clamp(distance, 0.45, this.rayLength),
    };
    setObjectHighlight(root, true);
    this.onSelectionChange(root.userData.sceneObjectRecord ?? null);
  }

  onSelectEnd(controller) {
    if (!this.selected || this.selected.controller !== controller) return;
    this.clearSelection();
  }

  clearSelection() {
    if (this.selected?.root) setObjectHighlight(this.selected.root, false);
    this.selected = null;
  }

  update() {
    if (!this.enabled || !this.selected) return;
    const { controller, root, distance } = this.selected;
    this.tempOrigin.setFromMatrixPosition(controller.matrixWorld);
    this.tempDirection.set(0, 0, -1).applyQuaternion(controller.getWorldQuaternion(this.tempQuaternion)).normalize();
    root.position.copy(this.tempOrigin).addScaledVector(this.tempDirection, distance);
    root.quaternion.copy(controller.getWorldQuaternion(this.tempQuaternion));
    this.onTransform(root);
  }

  dispose() {
    this.clearSelection();
    for (const { controller, selectStart, selectEnd } of this.controllerListeners) {
      controller.removeEventListener("selectstart", selectStart);
      controller.removeEventListener("selectend", selectEnd);
    }
    this.controllerListeners = [];
  }
}

function setObjectHighlight(root, selected) {
  root.traverse((object) => {
    if (object.userData.isGeneratedObjectCollider && object.material) {
      object.material.opacity = selected ? 0.35 : 0.12;
      object.material.color.setHex(selected ? 0xf59e0b : 0x22d3ee);
    }
  });
}
