import * as THREE from "three";

export class VRTeleportController {
  constructor({
    scene,
    camera,
    playerRig,
    controllers = [],
    jointInteractor = null,
    options = {},
  }) {
    this.scene = scene;
    this.camera = camera;
    this.playerRig = playerRig;
    this.controllers = controllers;
    this.jointInteractor = jointInteractor;
    this.enabled = options.enabled ?? false;
    this.rayLength = options.rayLength ?? 8;
    this.teleportPlane = null;
    this.raycaster = new THREE.Raycaster();
    this.tempOrigin = new THREE.Vector3();
    this.tempDirection = new THREE.Vector3();
    this.tempCameraWorld = new THREE.Vector3();
    this.reticle = this.createReticle();
    this.scene.add(this.reticle);

    for (const controller of this.controllers) {
      controller.addEventListener("selectstart", () => this.onSelectStart(controller));
    }
  }

  createReticle() {
    const geometry = new THREE.RingGeometry(0.13, 0.18, 40);
    const material = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const reticle = new THREE.Mesh(geometry, material);
    reticle.name = "teleport_reticle";
    reticle.rotation.x = -Math.PI / 2;
    reticle.visible = false;
    reticle.renderOrder = 30;
    return reticle;
  }

  setTeleportPlane(plane) {
    this.teleportPlane = plane;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) this.reticle.visible = false;
  }

  getTeleportHit(controller) {
    if (!this.enabled || !this.teleportPlane) return null;
    this.tempOrigin.setFromMatrixPosition(controller.matrixWorld);
    this.tempDirection.set(0, 0, -1).applyQuaternion(controller.getWorldQuaternion(new THREE.Quaternion())).normalize();
    this.raycaster.set(this.tempOrigin, this.tempDirection);
    this.raycaster.far = this.rayLength;
    return this.raycaster.intersectObject(this.teleportPlane, false)[0] ?? null;
  }

  onSelectStart(controller) {
    if (!this.enabled) return;
    if (this.jointInteractor?.getHandleHit(controller)) return;

    const hit = this.getTeleportHit(controller);
    if (!hit) return;
    this.teleportTo(hit.point);
  }

  teleportTo(point) {
    this.camera.getWorldPosition(this.tempCameraWorld);
    this.playerRig.position.x += point.x - this.tempCameraWorld.x;
    this.playerRig.position.z += point.z - this.tempCameraWorld.z;
  }

  update() {
    if (!this.enabled) return;

    let bestHit = null;
    for (const controller of this.controllers) {
      const hit = this.getTeleportHit(controller);
      if (hit && (!bestHit || hit.distance < bestHit.distance)) bestHit = hit;
    }

    if (!bestHit) {
      this.reticle.visible = false;
      return;
    }

    this.reticle.visible = true;
    this.reticle.position.copy(bestHit.point);
    this.reticle.position.y += 0.012;
  }

  reset() {
    this.reticle.visible = false;
  }
}
