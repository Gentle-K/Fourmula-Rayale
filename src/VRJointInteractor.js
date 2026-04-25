import * as THREE from "three";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory.js";

const DEFAULT_HANDLES = [
  { jointName: "head_yaw", offset: [0, 0.18, 0] },
  { jointName: "left_shoulder", offset: [0, 0.06, 0] },
  { jointName: "left_elbow", offset: [0, 0.28, 0] },
  { jointName: "left_hand", offset: [0, 0.58, 0] },
  { jointName: "right_shoulder", offset: [0, 0.06, 0] },
  { jointName: "right_elbow", offset: [0, 0.28, 0] },
  { jointName: "right_hand", offset: [0, 0.58, 0] },
];

export class VRJointInteractor {
  constructor({ renderer, scene, camera, robotController, options = {}, onSelectedJointChange = () => {} }) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.robotController = robotController;
    this.onSelectedJointChange = onSelectedJointChange;
    this.handleRadius = options.handleRadius ?? 0.06;
    this.angleSensitivity = options.angleSensitivity ?? 140;
    this.rayLength = options.rayLength ?? 5;
    this.controllerParent = options.controllerParent ?? scene;
    this.handles = [];
    this.controllers = [];
    this.controllerGrips = [];
    this.enabled = options.enabled ?? true;
    this.selected = null;
    this.raycaster = new THREE.Raycaster();
    this.tempMatrix = new THREE.Matrix4();
    this.tempOrigin = new THREE.Vector3();
    this.tempDirection = new THREE.Vector3();
    this.tempPosition = new THREE.Vector3();
    this.defaultMaterial = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.35,
      roughness: 0.32,
      metalness: 0.1,
    });
    this.selectedMaterial = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x22d3ee,
      emissiveIntensity: 0.85,
      roughness: 0.25,
      metalness: 0.2,
    });

    this.createHandles(options.handles ?? DEFAULT_HANDLES);
    this.createControllers();
  }

  createHandles(handleDefs) {
    for (const handleDef of handleDefs) {
      const bone = this.robotController.getBoneForJoint(handleDef.jointName);
      if (!bone) {
        console.warn(`Joint handle skipped for "${handleDef.jointName}" because its bone is missing.`);
        continue;
      }

      const material = this.defaultMaterial.clone();
      const handle = new THREE.Mesh(
        new THREE.SphereGeometry(this.handleRadius, 24, 16),
        material,
      );
      handle.name = `handle_${handleDef.jointName}`;
      handle.userData.jointName = handleDef.jointName;
      handle.userData.defaultMaterial = material;
      handle.position.fromArray(handleDef.offset ?? [0, 0, 0]);
      handle.renderOrder = 10;
      bone.add(handle);
      this.handles.push(handle);
    }
  }

  createControllers() {
    const controllerModelFactory = new XRControllerModelFactory();

    for (let i = 0; i < 2; i += 1) {
      const controller = this.renderer.xr.getController(i);
      controller.name = `xr_controller_${i}`;
      controller.add(this.createRayLine());
      controller.addEventListener("selectstart", (event) => this.onSelectStart(event, controller));
      controller.addEventListener("selectend", () => this.onSelectEnd(controller));
      this.controllerParent.add(controller);
      this.controllers.push(controller);

      const grip = this.renderer.xr.getControllerGrip(i);
      grip.name = `xr_controller_grip_${i}`;
      grip.add(controllerModelFactory.createControllerModel(grip));
      this.controllerParent.add(grip);
      this.controllerGrips.push(grip);
    }
  }

  createRayLine() {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -this.rayLength),
    ]);
    const material = new THREE.LineBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.75,
    });
    const line = new THREE.Line(geometry, material);
    line.name = "controller_ray";
    return line;
  }

  onSelectStart(_event, controller) {
    if (!this.enabled) return;
    const hit = this.getHandleHit(controller);
    if (!hit) return;

    const handle = hit.object;
    const jointName = handle.userData.jointName;
    this.tempPosition.setFromMatrixPosition(controller.matrixWorld);
    this.selected = {
      controller,
      handle,
      jointName,
      startY: this.tempPosition.y,
      startAngle: this.robotController.getJointValue(jointName) ?? 0,
    };
    handle.material = this.selectedMaterial;
    console.log("Selected joint:", jointName);
    this.onSelectedJointChange(jointName);
  }

  getHandleHit(controller) {
    if (this.handles.length === 0) return null;
    this.tempOrigin.setFromMatrixPosition(controller.matrixWorld);
    this.tempDirection.set(0, 0, -1).applyQuaternion(controller.getWorldQuaternion(new THREE.Quaternion()));
    this.raycaster.set(this.tempOrigin, this.tempDirection.normalize());
    this.raycaster.far = this.rayLength;
    return this.raycaster.intersectObjects(this.handles, true)[0] ?? null;
  }

  update() {
    if (!this.enabled || !this.selected) return;

    this.tempPosition.setFromMatrixPosition(this.selected.controller.matrixWorld);
    const deltaY = this.tempPosition.y - this.selected.startY;
    const newAngle = this.selected.startAngle + deltaY * this.angleSensitivity;
    this.robotController.setJointTarget(this.selected.jointName, newAngle);
  }

  onSelectEnd(controller) {
    if (!this.selected || this.selected.controller !== controller) return;
    this.selected.handle.material = this.selected.handle.userData.defaultMaterial ?? this.defaultMaterial;
    this.selected = null;
    this.onSelectedJointChange(null);
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled && this.selected) {
      this.selected.handle.material = this.selected.handle.userData.defaultMaterial ?? this.defaultMaterial;
      this.selected = null;
      this.onSelectedJointChange(null);
    }
  }

  dispose() {
    for (const handle of this.handles) {
      handle.geometry.dispose();
      handle.userData.defaultMaterial?.dispose?.();
      handle.removeFromParent();
    }
    this.handles = [];

    for (const controller of this.controllers) {
      controller.removeFromParent();
    }
    for (const grip of this.controllerGrips) {
      grip.removeFromParent();
    }
    this.defaultMaterial.dispose();
    this.selectedMaterial.dispose();
  }
}
