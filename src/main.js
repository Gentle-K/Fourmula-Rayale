import "./style.css";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { VRButton } from "three/examples/jsm/webxr/VRButton.js";
import { RobotJointController } from "./RobotJointController.js";
import { VRJointInteractor } from "./VRJointInteractor.js";
import { SimpleAgentPolicy } from "./AgentPolicy.js";
import { DemoRecorder } from "./DemoRecorder.js";
import { Measures } from "./Measures.js";
import { CEMTrainer } from "./CEMTrainer.js";
import { VRTeleportController } from "./VRTeleportController.js";
import { TripoGenerationClient } from "./tripo/TripoGenerationClient.js";
import { GeneratedAssetManager } from "./tripo/GeneratedAssetManager.js";
import { AssetPostProcessor } from "./tripo/AssetPostProcessor.js";
import { SceneObjectPipeline } from "./tripo/SceneObjectPipeline.js";
import { RobotReplacementPipeline } from "./tripo/RobotReplacementPipeline.js";
import { RigValidator } from "./tripo/RigValidation.js";
import { BoneMappingManager } from "./tripo/BoneMappingManager.js";
import { RobotSwapManager } from "./tripo/RobotSwapManager.js";
import { XRObjectManipulator } from "./tripo/XRObjectManipulator.js";
import { classifyAssetIntent } from "./tripo/AssetIntentClassifier.js";

const ASSET_VERSION = "20260425-vercel-assets";
const ROBOT_MODEL_URL = `/models/doctor.glb?v=${ASSET_VERSION}`;
const STATION_MODEL_URL = `/models/iss_interiorinternational_space_station.glb?v=${ASSET_VERSION}`;
const ROBOT_HABITAT_YAW = Math.PI / 2;
const ROBOT_FLOOR_CLEARANCE = 0.02;
const HABITAT_BASE_MAX_SIZE = 5.8;
const HABITAT_MAX_SIZE = 10.4;
const HABITAT_MIN_TELEPORT_WIDTH = 2.8;
const HABITAT_MIN_TELEPORT_DEPTH = 2.8;
const HABITAT_TELEPORT_ZONE_RATIO = 0.72;
const DEFAULT_ROBOT_POSE = {
  yawDeg: THREE.MathUtils.radToDeg(ROBOT_HABITAT_YAW),
  offsetX: 0,
  offsetZ: 0,
  floorOffset: ROBOT_FLOOR_CLEARANCE,
  scaleMultiplier: 1,
};
const ROOT_CONTROL_DEFS = [
  { key: "yawDeg", label: "Yaw", min: -180, max: 180, step: 1, unit: "deg" },
  { key: "offsetX", label: "Body X", min: -1.2, max: 1.2, step: 0.01, unit: "m" },
  { key: "offsetZ", label: "Body Z", min: -1.2, max: 1.2, step: 0.01, unit: "m" },
  { key: "floorOffset", label: "Foot Y", min: -0.18, max: 0.35, step: 0.01, unit: "m" },
  { key: "scaleMultiplier", label: "Scale", min: 0.65, max: 1.35, step: 0.01, unit: "x" },
];

const canvas = document.querySelector("#xr-canvas");
const phaseValue = document.querySelector("#phase-value");
const habitatValue = document.querySelector("#habitat-value");
const modeValue = document.querySelector("#mode-value");
const modePill = document.querySelector("#mode-pill");
const selectedJointValue = document.querySelector("#selected-joint");
const sampleCountValue = document.querySelector("#sample-count");
const trainBestValue = document.querySelector("#train-best");
const jointValues = document.querySelector("#joint-values");
const sceneHint = document.querySelector("#scene-hint");
const warningsList = document.querySelector("#warnings");
const rootControls = document.querySelector("#root-controls");
const jointControls = document.querySelector("#joint-controls");
const poseResetButton = document.querySelector("#pose-reset");
const tripoPrompt = document.querySelector("#tripo-prompt");
const tripoKind = document.querySelector("#tripo-kind");
const tripoGenerateButton = document.querySelector("#tripo-generate");
const tripoFileInput = document.querySelector("#tripo-file");
const tripoVoiceButton = document.querySelector("#tripo-voice");
const tripoStatusValue = document.querySelector("#tripo-status");
const tripoAssetsList = document.querySelector("#tripo-assets");
const objectControls = document.querySelector("#object-controls");
const selectedObjectValue = document.querySelector("#selected-object");
const latestTaskValue = document.querySelector("#latest-task");

const app = {
  phase: "orbit",
  mode: "manual",
  selectedJoint: null,
  orbitGroup: null,
  habitatGroup: null,
  debugSurfaceGroup: null,
  issRoot: null,
  issLoaded: false,
  robotLoaded: false,
  issPickTargets: [],
  habitatModuleName: "JPM",
  habitatModuleRoot: null,
  habitatMetrics: null,
  teleportController: null,
  xrObjectManipulator: null,
  teleportRig: null,
  teleportPlane: null,
  robotRoot: null,
  robotController: null,
  robotPose: { ...DEFAULT_ROBOT_POSE },
  currentRobotBoneMap: null,
  vrInteractor: null,
  generatedObjectPickTargets: [],
  selectedSceneObject: null,
  tripoClient: new TripoGenerationClient(),
  generatedAssetManager: new GeneratedAssetManager(),
  assetPostProcessor: new AssetPostProcessor(),
  sceneObjectPipeline: null,
  robotReplacementPipeline: null,
  robotSwapManager: null,
  tripoBusy: false,
  tripoStatus: "idle",
  recorder: new DemoRecorder(),
  agentPolicy: new SimpleAgentPolicy(),
  measures: new Measures(),
  cemTrainer: null,
  lastRecordTime: 0,
  trainAccumulator: 0,
  warnings: [],
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030712);
scene.fog = new THREE.Fog(0x030712, 9, 24);

app.teleportRig = new THREE.Group();
app.teleportRig.name = "TeleportPlayerRig";
scene.add(app.teleportRig);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.05, 100);
camera.position.set(3.4, 2.25, 4.8);
app.teleportRig.add(camera);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.xr.enabled = true;
document.body.appendChild(VRButton.createButton(renderer));

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.05, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const xrRayOrigin = new THREE.Vector3();
const xrRayDirection = new THREE.Vector3();

setupScene();
setPhase("orbit");
loadStation();
loadRobot();
setupTripoPipelines();
bindKeyboard();
bindOrbitPointer();
poseResetButton?.addEventListener("click", resetPoseTuning);
tripoGenerateButton?.addEventListener("click", () => runTripoGeneration());
tripoVoiceButton?.addEventListener("click", startVoicePrompt);
checkWebXRSupport();

const clock = new THREE.Clock();
renderer.setAnimationLoop(render);

function setupScene() {
  app.orbitGroup = new THREE.Group();
  app.orbitGroup.name = "OrbitScene";
  app.habitatGroup = new THREE.Group();
  app.habitatGroup.name = "HabitatTrainingScene";
  scene.add(app.orbitGroup, app.habitatGroup);

  const hemi = new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 1.6);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(4, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  scene.add(key);

  const rim = new THREE.PointLight(0x22d3ee, 2.5, 8);
  rim.position.set(-2, 2.2, -1.5);
  scene.add(rim);

  app.orbitGroup.add(createStarField());
  app.orbitGroup.add(createEarthArc());

  app.debugSurfaceGroup = new THREE.Group();
  app.debugSurfaceGroup.name = "FallbackTrainingSurface";
  app.habitatGroup.add(app.debugSurfaceGroup);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.82,
      metalness: 0.15,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  app.debugSurfaceGroup.add(floor);

  const grid = new THREE.GridHelper(9, 18, 0x155e75, 0x1e293b);
  grid.position.y = 0.006;
  app.debugSurfaceGroup.add(grid);

  const axes = new THREE.AxesHelper(0.75);
  axes.position.set(-3.7, 0.04, -3.7);
  app.debugSurfaceGroup.add(axes);
}

function createStarField() {
  const count = 1800;
  const radius = 46;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
    const r = radius * THREE.MathUtils.randFloat(0.72, 1);
    const index = i * 3;

    positions[index] = r * Math.sin(phi) * Math.cos(theta);
    positions[index + 1] = r * Math.cos(phi);
    positions[index + 2] = r * Math.sin(phi) * Math.sin(theta);

    color.setHSL(THREE.MathUtils.randFloat(0.55, 0.65), 0.35, THREE.MathUtils.randFloat(0.62, 1));
    colors[index] = color.r;
    colors[index + 1] = color.g;
    colors[index + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.08,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    fog: false,
  });

  const stars = new THREE.Points(geometry, material);
  stars.name = "ProceduralStarField";
  return stars;
}

function createEarthArc() {
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(18, 64, 32),
    new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      emissive: 0x082f49,
      emissiveIntensity: 0.45,
      roughness: 0.78,
      metalness: 0.05,
    }),
  );
  earth.name = "DistantEarthArc";
  earth.position.set(0, -19.5, -15);
  earth.rotation.set(0.12, 0.25, -0.08);
  return earth;
}

async function checkWebXRSupport() {
  if (!("xr" in navigator)) {
    addWarning("WebXR is unavailable in this browser. Desktop controls and agent mode still work.");
    return;
  }
  const supported = await navigator.xr.isSessionSupported("immersive-vr").catch(() => false);
  if (!supported) addWarning("Immersive VR is not available here. Use a WebXR-compatible HTTPS browser for Quest testing.");
}

function setupTripoPipelines() {
  app.robotSwapManager = new RobotSwapManager({
    onPauseAgent: () => {
      app.robotSwapPreviousMode = app.mode;
      if (app.mode === "agent" || app.mode === "train") setMode("manual");
    },
    onResumeAgent: () => {
      if (app.robotSwapPreviousMode === "agent") setMode("agent");
    },
    onSwapRobot: ({ robotRoot, boneMap, validation, assetRecord }) => swapCurrentRobot({ robotRoot, boneMap, validation, assetRecord }),
  });

  app.sceneObjectPipeline = new SceneObjectPipeline({
    client: app.tripoClient,
    assetManager: app.generatedAssetManager,
    postProcessor: app.assetPostProcessor,
    onInsertObject: insertGeneratedSceneObject,
    onStatus: setTripoStatus,
  });

  app.robotReplacementPipeline = new RobotReplacementPipeline({
    client: app.tripoClient,
    assetManager: app.generatedAssetManager,
    rigValidator: new RigValidator(),
    boneMappingManager: new BoneMappingManager(),
    robotSwapManager: app.robotSwapManager,
    onStatus: setTripoStatus,
    onManualMappingRequired: (mapping) => {
      addWarning(`Robot bone mapping needs manual edit. Missing: ${mapping.missingBones.join(", ")}. Available bones are printed in console.`);
      console.log("Bone mapping candidates:", mapping);
    },
  });

  setTripoStatus("idle");
  renderTripoAssetList();
  buildSelectedObjectControls();
}

async function runTripoGeneration() {
  if (app.tripoBusy) return;
  const rawInput = tripoPrompt?.value?.trim() ?? "";
  const explicitKind = tripoKind?.value && tripoKind.value !== "auto" ? tripoKind.value : null;
  if (!rawInput && !tripoFileInput?.files?.[0]) {
    setTripoStatus("Enter a prompt or choose an image first.");
    return;
  }

  app.tripoBusy = true;
  if (tripoGenerateButton) tripoGenerateButton.disabled = true;
  setTripoStatus("Preparing Tripo request.");
  try {
    const imagePayload = await getSelectedImagePayload();
    const inputType = imagePayload ? (tripoFileInput?.files?.[0]?.name?.toLowerCase().includes("plan") ? "floor_plan" : "image") : "text";
    const intent = classifyAssetIntent({ rawInput, explicitKind: explicitKind || "auto", inputType });
    const payload = {
      rawInput,
      inputType,
      explicitKind: intent.assetKind,
      ...imagePayload,
    };

    if (intent.assetKind === "scene_layout") {
      setTripoStatus("Scene layout parsing is scaffolded in v1. Generate concrete props or robot replacements from the layout suggestions.");
      app.generatedAssetManager.createAssetRecord({
        assetKind: "scene_layout",
        requiresRig: false,
        rawInput,
        inputType,
        status: "layout_scaffold",
      });
    } else if (intent.assetKind === "robot_replacement") {
      await app.robotReplacementPipeline.generateRobotReplacement(payload);
    } else {
      await app.sceneObjectPipeline.generateSceneObject(payload);
    }
    tripoFileInput.value = "";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tripo generation failed.";
    setTripoStatus(message);
    addWarning(`${message} Use npx vercel dev for local API testing and set TRIPO_API_KEY on the server.`);
  } finally {
    app.tripoBusy = false;
    if (tripoGenerateButton) tripoGenerateButton.disabled = false;
    renderTripoAssetList();
    updateHud();
  }
}

function getSelectedImagePayload() {
  const file = tripoFileInput?.files?.[0];
  if (!file) return Promise.resolve(null);
  if (!file.type.startsWith("image/")) throw new Error("Tripo reference upload must be an image file.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve({ imageBase64: String(reader.result), imageMime: file.type }));
    reader.addEventListener("error", () => reject(new Error("Failed to read reference image.")));
    reader.readAsDataURL(file);
  });
}

function startVoicePrompt() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setTripoStatus("Voice input is not available in this browser.");
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.addEventListener("result", (event) => {
    const text = event.results?.[0]?.[0]?.transcript;
    if (text && tripoPrompt) tripoPrompt.value = text;
    setTripoStatus(text ? "Voice prompt captured." : "No speech recognized.");
  });
  recognition.addEventListener("error", () => setTripoStatus("Voice prompt failed."));
  recognition.start();
  setTripoStatus("Listening for a Tripo prompt.");
}

function setTripoStatus(message) {
  app.tripoStatus = message;
  if (tripoStatusValue) tripoStatusValue.textContent = message;
}

function loadStation() {
  const loader = new GLTFLoader();
  loader.load(
    STATION_MODEL_URL,
    (gltf) => {
      console.log("ISS GLB loaded", gltf);
      app.issRoot = gltf.scene;
      app.issLoaded = true;
      app.issRoot.name = app.issRoot.name || "ISSRoot";
      buildHabitatModule(app.issRoot);
      prepareStationRoot(app.issRoot);
      app.orbitGroup.add(app.issRoot);
      app.issPickTargets = [];
      app.issRoot.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
          object.userData.isISSSelectable = true;
          app.issPickTargets.push(object);
        }
      });
      createStationClickVolume(app.issRoot);
      updateHud();
    },
    undefined,
    (error) => {
      console.warn(`Failed to load ${STATION_MODEL_URL}`, error);
      addWarning(`Failed to load ${STATION_MODEL_URL}. Place ISS GLB at public/models/iss_interiorinternational_space_station.glb.`);
      createStationPlaceholder();
      updateHud();
    },
  );
}

function loadRobot() {
  const loader = new GLTFLoader();
  loader.load(
    ROBOT_MODEL_URL,
    (gltf) => {
      console.log("Doctor GLB loaded", gltf);
      app.robotRoot = gltf.scene;
      app.robotLoaded = true;
      app.robotRoot.name = app.robotRoot.name || "DoctorRobotRoot";
      prepareRobotRoot(app.robotRoot);
      app.habitatGroup.add(app.robotRoot);

      printObjectAndBoneDebug(app.robotRoot);
      initializeRobotControlStack();

      if (app.robotController.missingBones.size > 0) {
        addWarning(`Missing expected bones: ${[...app.robotController.missingBones].join(", ")}. Edit BONE_MAP in RobotJointController.js.`);
      }
      updateHud();
    },
    undefined,
    (error) => {
      console.warn(`Failed to load ${ROBOT_MODEL_URL}`, error);
      addWarning(`Failed to load ${ROBOT_MODEL_URL}. Place doctor.glb at public/models/doctor.glb.`);
      createMissingRobotPlaceholder();
    },
  );
}

function initializeRobotControlStack({ boneMap = null } = {}) {
  cleanupRobotInteractions();
  app.currentRobotBoneMap = boneMap;
  app.robotController = new RobotJointController(app.robotRoot, boneMap ? { boneMap } : {});
  app.vrInteractor = new VRJointInteractor({
    renderer,
    scene,
    camera,
    robotController: app.robotController,
    options: {
      controllerParent: app.teleportRig,
    },
    onSelectedJointChange: (jointName) => {
      app.selectedJoint = jointName;
      selectedJointValue.textContent = jointName ?? "none";
    },
  });
  app.vrInteractor.setEnabled(app.phase === "habitat");
  bindOrbitControllerSelection();
  app.xrObjectManipulator = new XRObjectManipulator({
    controllers: app.vrInteractor.controllers,
    jointInteractor: app.vrInteractor,
    pickTargetsProvider: () => app.generatedObjectPickTargets,
    enabled: app.phase === "habitat",
    onSelectionChange: (sceneObject) => {
      selectSceneObject(sceneObject?.objectId ?? null);
    },
    onTransform: (root) => {
      updateSceneObjectTransform(root);
      buildSelectedObjectControls();
    },
  });
  app.teleportController = new VRTeleportController({
    scene,
    camera,
    playerRig: app.teleportRig,
    controllers: app.vrInteractor.controllers,
    jointInteractor: app.vrInteractor,
    objectManipulator: app.xrObjectManipulator,
    options: {
      enabled: app.phase === "habitat",
    },
  });
  if (app.teleportPlane) app.teleportController.setTeleportPlane(app.teleportPlane);
  app.cemTrainer = new CEMTrainer(app.robotController, app.measures);
  buildPoseTuningControls();
}

function cleanupRobotInteractions() {
  app.teleportController?.dispose?.();
  app.xrObjectManipulator?.dispose?.();
  app.vrInteractor?.dispose?.();
  app.teleportController = null;
  app.xrObjectManipulator = null;
  app.vrInteractor = null;
}

function insertGeneratedSceneObject(processed, context = {}) {
  const root = processed.root;
  const metadata = processed.metadata;
  const placement = getSceneObjectPlacement(processed.colliderSize);
  root.position.copy(placement.position);
  root.rotation.set(0, placement.yaw, 0);
  root.scale.setScalar(1);

  const sceneObject = app.generatedAssetManager.registerSceneObject({
    ...metadata,
    assetId: context.assetId,
    taskId: context.taskId,
    prompt: context.prompt,
    transform: getTransformRecord(root),
    root,
  });
  root.userData.sceneObjectRecord = sceneObject;
  root.traverse((object) => {
    object.userData.sceneObjectId = sceneObject.objectId;
    object.userData.sceneObjectRoot = root;
  });
  app.habitatGroup.add(root);
  app.generatedObjectPickTargets.push(processed.collider);
  const task = app.generatedAssetManager.createTaskFromSceneObject(sceneObject);
  sceneObject.taskId = task.taskId;
  app.generatedAssetManager.updateSceneObject(sceneObject.objectId, { taskId: task.taskId });
  selectSceneObject(sceneObject.objectId);
  renderTripoAssetList();
  buildSelectedObjectControls();
  updateHud();
  return sceneObject;
}

function getSceneObjectPlacement(colliderSize = new THREE.Vector3(0.4, 0.4, 0.4)) {
  const metrics = app.habitatMetrics ?? getFallbackHabitatMetrics();
  const floorY = metrics.floorY ?? 0;
  const height = colliderSize.y || 0.4;
  const cameraWorld = new THREE.Vector3();
  const forward = new THREE.Vector3();
  camera.getWorldPosition(cameraWorld);
  camera.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
  forward.normalize();

  const desired = cameraWorld.clone().addScaledVector(forward, 1.25);
  const margin = 0.22;
  desired.x = clampBetween(desired.x, metrics.center.x - metrics.teleportWidth * 0.5 + margin, metrics.center.x + metrics.teleportWidth * 0.5 - margin);
  desired.z = clampBetween(desired.z, metrics.center.z - metrics.teleportDepth * 0.5 + margin, metrics.center.z + metrics.teleportDepth * 0.5 - margin);
  desired.y = floorY + height * 0.5 + 0.04;
  return { position: desired, yaw: Math.atan2(forward.x, forward.z) };
}

async function swapCurrentRobot({ robotRoot, boneMap, validation, assetRecord }) {
  cleanupRobotInteractions();
  if (app.robotRoot) app.robotRoot.removeFromParent();
  app.robotRoot = robotRoot;
  app.robotLoaded = true;
  app.robotRoot.name = assetRecord?.assetId ? `TripoRobot_${assetRecord.assetId}` : "TripoRobotRoot";
  prepareRobotRoot(app.robotRoot);
  app.habitatGroup.add(app.robotRoot);
  printObjectAndBoneDebug(app.robotRoot);
  console.log("Rig validation:", validation);
  initializeRobotControlStack({ boneMap });
  placeRobotInHabitat({ frameCamera: true });
  updateHud();
  return { ok: true };
}

function selectSceneObject(objectId) {
  app.selectedSceneObject = objectId ? app.generatedAssetManager.sceneObjects.get(objectId) ?? null : null;
  if (selectedObjectValue) selectedObjectValue.textContent = app.selectedSceneObject?.displayName || app.selectedSceneObject?.semanticClass || "none";
  buildSelectedObjectControls();
}

function updateSceneObjectTransform(root) {
  const record = root?.userData?.sceneObjectRecord;
  if (!record) return;
  const transform = getTransformRecord(root);
  app.generatedAssetManager.updateSceneObject(record.objectId, { transform });
  root.userData.sceneObjectRecord = app.generatedAssetManager.sceneObjects.get(record.objectId);
  if (app.selectedSceneObject?.objectId === record.objectId) app.selectedSceneObject = root.userData.sceneObjectRecord;
}

function getTransformRecord(root) {
  return {
    position: root.position.toArray().map((value) => Number(value.toFixed(3))),
    rotation: [0, Number(THREE.MathUtils.radToDeg(root.rotation.y).toFixed(1)), 0],
    scale: root.scale.toArray().map((value) => Number(value.toFixed(3))),
  };
}

function prepareRobotRoot(root) {
  root.position.set(0, 0, 0);
  root.rotation.set(0, getRobotYawRadians(), 0);
  root.scale.setScalar(1);
  root.traverse((object) => {
    if (object.isMesh || object.isSkinnedMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
    if (object.isSkinnedMesh) object.frustumCulled = false;
  });

  placeRobotInHabitat();
}

function placeRobotInHabitat({ frameCamera = true } = {}) {
  const root = app.robotRoot;
  if (!root) return;

  const pose = app.robotPose;
  root.position.set(0, 0, 0);
  root.rotation.set(0, getRobotYawRadians(), 0);
  root.scale.setScalar(1);
  root.updateWorldMatrix(true, true);

  const metrics = app.habitatMetrics ?? getFallbackHabitatMetrics();
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const naturalHeight = size.y > 0 ? size.y : Math.max(size.x, size.z);
  const cabinHeight = metrics.size.y || 1.8;
  const cabinDepth = metrics.size.z || metrics.teleportDepth || 1.8;
  const targetHeight = THREE.MathUtils.clamp(
    Math.min(cabinHeight * 0.68, cabinDepth * 0.82),
    0.9,
    1.58,
  );
  const tunedTargetHeight = THREE.MathUtils.clamp(
    targetHeight * pose.scaleMultiplier,
    0.55,
    Math.max(0.65, cabinHeight * 0.82),
  );
  if (naturalHeight > 0 && Number.isFinite(naturalHeight)) root.scale.setScalar(tunedTargetHeight / naturalHeight);

  box.setFromObject(root);
  const center = new THREE.Vector3();
  const scaledSize = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(scaledSize);

  const marginX = Math.max(0.16, Math.min(0.28, metrics.teleportWidth * 0.16));
  const marginZ = Math.max(0.16, Math.min(0.28, metrics.teleportDepth * 0.16));
  const minX = metrics.center.x - metrics.teleportWidth * 0.5 + marginX;
  const maxX = metrics.center.x + metrics.teleportWidth * 0.5 - marginX;
  const minZ = metrics.center.z - metrics.teleportDepth * 0.5 + marginZ;
  const maxZ = metrics.center.z + metrics.teleportDepth * 0.5 - marginZ;
  const desiredX = clampBetween(metrics.center.x + metrics.teleportWidth * 0.24 + pose.offsetX, minX, maxX);
  const desiredZ = clampBetween(metrics.center.z + metrics.teleportDepth * 0.22 + pose.offsetZ, minZ, maxZ);
  const floorY = metrics.floorY ?? 0;

  root.position.x += desiredX - center.x;
  root.position.z += desiredZ - center.z;
  root.position.y += floorY + pose.floorOffset - box.min.y;
  root.userData.habitatTargetHeight = tunedTargetHeight;
  root.userData.habitatFloorY = floorY;
  root.userData.habitatYawDeg = pose.yawDeg;
  root.updateWorldMatrix(true, true);

  if (frameCamera && app.phase === "habitat") frameHabitatCamera();
}

function getRobotYawRadians() {
  return THREE.MathUtils.degToRad(app.robotPose.yawDeg);
}

function getFallbackHabitatMetrics() {
  return {
    center: new THREE.Vector3(0, 0, 0),
    size: new THREE.Vector3(5.2, 2.1, 5.2),
    floorY: 0,
    teleportWidth: 4.8,
    teleportDepth: 4.8,
  };
}

function clampBetween(value, min, max) {
  if (min > max) return (min + max) * 0.5;
  return THREE.MathUtils.clamp(value, min, max);
}

function buildHabitatModule(stationRoot) {
  const moduleSource = stationRoot.getObjectByName("JPM") ?? stationRoot.getObjectByName("US_Lab");
  if (!moduleSource) {
    addWarning("Could not find JPM or US_Lab in ISS model. Using fallback training floor.");
    return;
  }

  app.habitatModuleName = moduleSource.name;
  const moduleClone = moduleSource.clone(true);
  moduleClone.name = `${moduleSource.name}_HabitatTrainingModule`;
  moduleClone.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      object.frustumCulled = false;
      if (Array.isArray(object.material)) {
        object.material = object.material.map((material) => prepareHabitatMaterial(material));
      } else if (object.material) {
        object.material = prepareHabitatMaterial(object.material);
      }
    }
  });

  const box = new THREE.Box3().setFromObject(moduleClone);
  const size = new THREE.Vector3();
  box.getSize(size);
  const max = Math.max(size.x, size.y, size.z);
  if (max > 0 && Number.isFinite(max)) {
    const baseScale = HABITAT_BASE_MAX_SIZE / max;
    const baseTeleportWidth = size.x * baseScale * HABITAT_TELEPORT_ZONE_RATIO;
    const baseTeleportDepth = size.z * baseScale * HABITAT_TELEPORT_ZONE_RATIO;
    const expandForWidth = baseTeleportWidth > 0 ? HABITAT_MIN_TELEPORT_WIDTH / baseTeleportWidth : 1;
    const expandForDepth = baseTeleportDepth > 0 ? HABITAT_MIN_TELEPORT_DEPTH / baseTeleportDepth : 1;
    const targetMax = THREE.MathUtils.clamp(
      HABITAT_BASE_MAX_SIZE * Math.max(1, expandForWidth, expandForDepth),
      HABITAT_BASE_MAX_SIZE,
      HABITAT_MAX_SIZE,
    );
    moduleClone.scale.setScalar(targetMax / max);
    moduleClone.userData.habitatTargetMaxSize = targetMax;
  }

  box.setFromObject(moduleClone);
  const center = new THREE.Vector3();
  box.getCenter(center);
  moduleClone.position.sub(center);
  moduleClone.position.y += 1.28;

  app.habitatModuleRoot = moduleClone;
  app.habitatGroup.add(moduleClone);
  if (app.debugSurfaceGroup) app.debugSurfaceGroup.visible = false;
  createTeleportZoneForModule(moduleClone);
  addHabitatLights();
  placeRobotInHabitat();
  updateHud();
}

function prepareHabitatMaterial(material) {
  const next = material.clone();
  next.transparent = true;
  next.opacity = 0.32;
  next.depthWrite = false;
  next.side = THREE.DoubleSide;
  return next;
}

function createTeleportZoneForModule(moduleRoot) {
  const box = new THREE.Box3().setFromObject(moduleRoot);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const width = Math.max(HABITAT_MIN_TELEPORT_WIDTH, size.x * HABITAT_TELEPORT_ZONE_RATIO);
  const depth = Math.max(HABITAT_MIN_TELEPORT_DEPTH, size.z * HABITAT_TELEPORT_ZONE_RATIO);
  const geometry = new THREE.PlaneGeometry(width, depth);
  const material = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const plane = new THREE.Mesh(geometry, material);
  plane.name = "JPMTeleportZone";
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(center.x, Math.max(0.04, box.min.y + 0.08), center.z);
  plane.visible = true;
  app.teleportPlane = plane;
  app.habitatMetrics = {
    box: box.clone(),
    center: center.clone(),
    size: size.clone(),
    floorY: plane.position.y,
    teleportWidth: width,
    teleportDepth: depth,
  };
  app.habitatGroup.add(plane);
  app.teleportController?.setTeleportPlane(plane);
}

function addHabitatLights() {
  if (app.habitatGroup.getObjectByName("HabitatSoftFillLight")) return;

  const fill = new THREE.PointLight(0xe0f2fe, 3.2, 7);
  fill.name = "HabitatSoftFillLight";
  fill.position.set(0.2, 2.0, 0.8);
  const rim = new THREE.PointLight(0x38bdf8, 2.4, 6);
  rim.name = "HabitatBlueRimLight";
  rim.position.set(-1.6, 1.5, -1.8);
  app.habitatGroup.add(fill, rim);
}

function prepareStationRoot(root) {
  root.position.set(0, 0, 0);
  root.rotation.set(0.2, -0.55, 0.08);
  root.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const max = Math.max(size.x, size.y, size.z);
  if (max > 0 && Number.isFinite(max)) root.scale.setScalar(5.4 / max);

  box.setFromObject(root);
  const center = new THREE.Vector3();
  box.getCenter(center);
  root.position.sub(center);
  root.position.x += 2.6;
  root.position.y += 1.15;
}

function createStationClickVolume(root) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const geometry = new THREE.BoxGeometry(size.x * 1.08, size.y * 1.12, size.z * 1.08);
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const proxy = new THREE.Mesh(geometry, material);
  proxy.name = "ISSClickVolume";
  proxy.position.copy(center);
  proxy.userData.isISSSelectable = true;
  app.orbitGroup.add(proxy);
  app.issPickTargets.push(proxy);
}

function createStationPlaceholder() {
  const group = new THREE.Group();
  group.name = "ISSPlaceholder";
  const moduleMaterial = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.48, metalness: 0.22 });
  const trussMaterial = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    emissive: 0x0f172a,
    emissiveIntensity: 0.35,
    roughness: 0.5,
  });

  const core = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 0.55), moduleMaterial);
  const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.1, 24), moduleMaterial);
  lab.rotation.z = Math.PI / 2;
  lab.position.x = -1.45;
  const node = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.0, 24), moduleMaterial);
  node.rotation.z = Math.PI / 2;
  node.position.x = 1.45;
  const truss = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 0.08), trussMaterial);
  truss.position.y = 0.5;

  group.add(core, lab, node, truss);
  group.position.y = 1.1;
  group.position.x = 2.6;
  group.rotation.set(0.2, -0.55, 0.08);
  group.traverse((object) => {
    if (object.isMesh) {
      object.userData.isISSSelectable = true;
      app.issPickTargets.push(object);
    }
  });
  app.issRoot = group;
  app.orbitGroup.add(group);
}

function bindOrbitPointer() {
  renderer.domElement.addEventListener("pointerdown", (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    raycaster.far = 40;
    if (app.phase === "orbit") {
      const hit = raycaster.intersectObjects(app.issPickTargets, true)[0];
      if (hit) enterHabitat();
      return;
    }
    if (app.phase === "habitat") {
      const hit = raycaster.intersectObjects(app.generatedObjectPickTargets, true)[0];
      const objectId = hit?.object?.userData?.sceneObjectId;
      if (objectId) selectSceneObject(objectId);
    }
  });
}

function bindOrbitControllerSelection() {
  if (!app.vrInteractor) return;
  for (const controller of app.vrInteractor.controllers) {
    if (controller.userData.orbitSelectBound) continue;
    controller.userData.orbitSelectBound = true;
    controller.addEventListener("selectstart", () => {
      if (app.phase !== "orbit") return;
      xrRayOrigin.setFromMatrixPosition(controller.matrixWorld);
      xrRayDirection.set(0, 0, -1).applyQuaternion(controller.getWorldQuaternion(new THREE.Quaternion())).normalize();
      raycaster.set(xrRayOrigin, xrRayDirection);
      raycaster.far = 40;
      const hit = raycaster.intersectObjects(app.issPickTargets, true)[0];
      if (hit) enterHabitat();
    });
  }
}

function enterHabitat() {
  setPhase("habitat");
}

function returnToOrbit() {
  setPhase("orbit");
}

function setPhase(phase) {
  app.phase = phase;
  if (app.orbitGroup) app.orbitGroup.visible = phase === "orbit";
  if (app.habitatGroup) app.habitatGroup.visible = phase === "habitat";
  app.vrInteractor?.setEnabled(phase === "habitat");
  app.xrObjectManipulator?.setEnabled(phase === "habitat");
  app.teleportController?.setEnabled(phase === "habitat");
  app.teleportController?.reset();
  app.teleportRig?.position.set(0, 0, 0);

  if (phase === "orbit") {
    camera.position.set(4.8, 2.3, 6.4);
    controls.target.set(0, 1.15, 0);
    app.selectedJoint = null;
  } else {
    frameHabitatCamera();
  }
  controls.update();
  console.log("Current phase:", phase);
  updateHud();
}

function getHabitatFocusPoint() {
  const metrics = app.habitatMetrics ?? getFallbackHabitatMetrics();
  if (!app.robotRoot) {
    return new THREE.Vector3(metrics.center.x, (metrics.floorY ?? 0) + 0.9, metrics.center.z);
  }

  const box = new THREE.Box3().setFromObject(app.robotRoot);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);
  return new THREE.Vector3(center.x, (metrics.floorY ?? box.min.y) + size.y * 0.56, center.z);
}

function frameHabitatCamera() {
  const metrics = app.habitatMetrics ?? getFallbackHabitatMetrics();
  const focus = getHabitatFocusPoint();
  const viewTarget = focus.clone();
  const sideOffset = THREE.MathUtils.clamp(metrics.teleportWidth * 0.56, 2.35, 4.6);
  const depthOffset = THREE.MathUtils.clamp(metrics.teleportDepth * 0.9, 3.1, 5.7);
  const eyeY = Math.max(focus.y + 0.78, (metrics.floorY ?? 0) + 1.45);

  viewTarget.x -= THREE.MathUtils.clamp(metrics.teleportWidth * 0.38, 0.72, 1.65);
  controls.target.copy(viewTarget);
  camera.position.set(focus.x + sideOffset, eyeY, focus.z + depthOffset);
  controls.update();
}

function printObjectAndBoneDebug(root) {
  const objects = [];
  const bones = [];
  root.traverse((object) => {
    objects.push({
      type: object.type,
      name: object.name || "(unnamed)",
      isBone: Boolean(object.isBone),
      isSkinnedMesh: Boolean(object.isSkinnedMesh),
    });
    if (object.isBone) bones.push(object.name || "(unnamed bone)");
  });
  console.log("All objects:");
  console.table(objects);
  console.log("Object names:", objects.map((object) => `${object.name} <${object.type}>`).join(", "));
  console.log("Bone list:");
  console.log("Bone names:", bones.join(", "));
  console.table(bones);
}

function createMissingRobotPlaceholder() {
  const group = new THREE.Group();
  group.name = "MissingDoctorPlaceholder";
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x0891b2,
    emissiveIntensity: 0.45,
  });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.95, 8, 24), bodyMaterial);
  body.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 18), bodyMaterial);
  head.position.y = 2.0;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.035, 0.02), accentMaterial);
  visor.position.set(0, 2.02, 0.32);
  group.add(body, head, visor);
  app.habitatGroup.add(group);
}

function bindKeyboard() {
  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key === "h") {
      returnToOrbit();
      return;
    }
    if (app.phase !== "habitat") return;
    if (key === "1") setMode("manual");
    if (key === "2") setMode("agent");
    if (key === "3") {
      app.recorder.clear();
      app.lastRecordTime = 0;
      setMode("record");
    }
    if (key === "4") {
      setMode("train");
      runTrainStep();
    }
    if (key === "s") app.recorder.exportJSON();
    if (key === "r") {
      app.robotController?.reset();
      app.agentPolicy.reset();
      buildPoseTuningControls();
      console.log("Robot joints reset.");
    }
    if (key === "p") console.log("Current observation:", app.robotController?.getObservation() ?? null);
  });
}

function setMode(mode) {
  app.mode = mode;
  console.log("Current mode:", mode);
  if (mode === "agent") app.agentPolicy.reset();
  updateHud();
}

function runTrainStep() {
  if (!app.cemTrainer) {
    addWarning("CEMTrainer is waiting for a loaded robot controller.");
    return;
  }
  const result = app.cemTrainer.step();
  trainBestValue.textContent = result.best.toFixed(2);
}

function buildPoseTuningControls() {
  if (!rootControls || !jointControls) return;

  rootControls.innerHTML = "";
  for (const def of ROOT_CONTROL_DEFS) {
    rootControls.appendChild(createRangeControl({
      label: def.label,
      dataType: "root",
      dataKey: def.key,
      min: def.min,
      max: def.max,
      step: def.step,
      value: app.robotPose[def.key],
      unit: def.unit,
      onInput: (value) => {
        enterManualForTuning();
        app.robotPose[def.key] = value;
        placeRobotInHabitat({ frameCamera: false });
      },
    }));
  }

  if (!app.robotController) {
    jointControls.textContent = "Waiting for robot...";
    return;
  }

  jointControls.innerHTML = "";
  for (const joint of app.robotController.getJointDefinitions()) {
    const row = createRangeControl({
      label: joint.jointName,
      dataType: "joint",
      dataKey: joint.jointName,
      min: joint.min,
      max: joint.max,
      step: 1,
      value: joint.target,
      unit: "deg",
      disabled: !joint.bone,
      onInput: (value) => {
        enterManualForTuning();
        app.selectedJoint = joint.jointName;
        selectedJointValue.textContent = joint.jointName;
        app.robotController?.setJointTarget(joint.jointName, value);
      },
    });
    jointControls.appendChild(row);
  }
}

function buildSelectedObjectControls() {
  if (!objectControls) return;
  const sceneObject = app.selectedSceneObject;
  const root = sceneObject?.root;
  if (!sceneObject || !root) {
    objectControls.innerHTML = '<span class="empty">Select a generated object to edit placement.</span>';
    return;
  }

  const metrics = app.habitatMetrics ?? getFallbackHabitatMetrics();
  const defs = [
    { key: "x", label: "Obj X", min: metrics.center.x - metrics.teleportWidth * 0.5, max: metrics.center.x + metrics.teleportWidth * 0.5, step: 0.01, value: root.position.x, unit: "m" },
    { key: "y", label: "Obj Y", min: metrics.floorY, max: metrics.floorY + Math.max(2, metrics.size.y), step: 0.01, value: root.position.y, unit: "m" },
    { key: "z", label: "Obj Z", min: metrics.center.z - metrics.teleportDepth * 0.5, max: metrics.center.z + metrics.teleportDepth * 0.5, step: 0.01, value: root.position.z, unit: "m" },
    { key: "yaw", label: "Obj yaw", min: -180, max: 180, step: 1, value: THREE.MathUtils.radToDeg(root.rotation.y), unit: "deg" },
    { key: "scale", label: "Obj scale", min: 0.25, max: 2, step: 0.01, value: root.scale.x, unit: "x" },
  ];

  objectControls.innerHTML = "";
  for (const def of defs) {
    objectControls.appendChild(createRangeControl({
      label: def.label,
      dataType: "scene-object",
      dataKey: def.key,
      min: def.min,
      max: def.max,
      step: def.step,
      value: def.value,
      unit: def.unit,
      onInput: (value) => {
        if (def.key === "x") root.position.x = value;
        if (def.key === "y") root.position.y = value;
        if (def.key === "z") root.position.z = value;
        if (def.key === "yaw") root.rotation.y = THREE.MathUtils.degToRad(value);
        if (def.key === "scale") root.scale.setScalar(value);
        updateSceneObjectTransform(root);
      },
    }));
  }
}

function renderTripoAssetList() {
  if (!tripoAssetsList) return;
  const assets = app.generatedAssetManager.getAssetList();
  if (assets.length === 0) {
    tripoAssetsList.innerHTML = '<span class="empty">No generated assets yet.</span>';
    return;
  }
  tripoAssetsList.innerHTML = assets.slice(0, 5).map((asset) => {
    const label = asset.assetKind === "robot_replacement" ? "robot" : asset.semanticClass || asset.assetKind;
    const status = asset.status || "created";
    return `<button class="asset-row" type="button" data-asset-id="${asset.assetId}">
      <span>${label}</span>
      <strong>${status}</strong>
    </button>`;
  }).join("");
  for (const button of tripoAssetsList.querySelectorAll("[data-asset-id]")) {
    button.addEventListener("click", () => {
      const asset = app.generatedAssetManager.assets.get(button.dataset.assetId);
      if (asset?.objectId) selectSceneObject(asset.objectId);
    });
  }
}

function createRangeControl({ label, dataType, dataKey, min, max, step, value, unit, disabled = false, onInput }) {
  const row = document.createElement("div");
  row.className = "control-row";

  const id = `control-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  const labelEl = document.createElement("label");
  labelEl.htmlFor = id;
  labelEl.textContent = label;

  const input = document.createElement("input");
  input.id = id;
  input.type = "range";
  input.dataset.tuningType = dataType;
  input.dataset.tuningKey = dataKey;
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.disabled = disabled;

  const output = document.createElement("output");
  output.textContent = formatControlValue(value, unit);

  input.addEventListener("input", () => {
    const nextValue = Number(input.value);
    output.textContent = formatControlValue(nextValue, unit);
    onInput?.(nextValue);
  });

  row.append(labelEl, input, output);
  return row;
}

function formatControlValue(value, unit) {
  if (unit === "m") return `${Number(value).toFixed(2)}m`;
  if (unit === "x") return `${Number(value).toFixed(2)}x`;
  return `${Number(value).toFixed(0)}deg`;
}

function enterManualForTuning() {
  if (app.mode === "agent" || app.mode === "train") setMode("manual");
}

function resetPoseTuning() {
  app.robotPose = { ...DEFAULT_ROBOT_POSE };
  app.robotController?.reset();
  app.agentPolicy.reset();
  placeRobotInHabitat({ frameCamera: true });
  buildPoseTuningControls();
  updateHud();
}

function syncPoseTuningControls() {
  const inputs = document.querySelectorAll("[data-tuning-type]");
  for (const input of inputs) {
    if (input === document.activeElement) continue;
    let value = null;
    const type = input.dataset.tuningType;
    const key = input.dataset.tuningKey;
    if (type === "root") {
      value = app.robotPose[key];
    } else if (type === "joint") {
      value = app.robotController?.joints.get(key)?.target;
    }
    if (value === null || value === undefined) continue;
    if (Number(input.value) !== Number(value)) input.value = String(value);
    const unit = type === "root" ? ROOT_CONTROL_DEFS.find((def) => def.key === key)?.unit : "deg";
    const output = input.nextElementSibling;
    if (output) output.textContent = formatControlValue(value, unit);
  }
}

function render() {
  const dt = Math.min(clock.getDelta(), 0.1);
  controls.update();
  if (app.phase === "habitat") app.teleportController?.update();
  if (app.phase === "habitat") app.xrObjectManipulator?.update();

  if (app.phase === "habitat" && app.robotController) {
    const observation = app.robotController.getObservation();

    if (app.mode === "manual") {
      app.vrInteractor?.update();
    } else if (app.mode === "record") {
      app.vrInteractor?.update();
      const now = performance.now();
      if (now - app.lastRecordTime >= 100) {
        app.recorder.record(observation, app.robotController.getActionSnapshot(), { mode: app.mode, selectedJoint: app.selectedJoint });
        app.lastRecordTime = now;
      }
    } else if (app.mode === "agent") {
      app.robotController.applyAction(app.agentPolicy.act(observation));
    } else if (app.mode === "train") {
      app.trainAccumulator += dt;
      if (app.trainAccumulator >= 1.0) {
        app.trainAccumulator = 0;
        runTrainStep();
      }
    }

    app.robotController.update(dt);
  }

  updateHud();
  renderer.render(scene, camera);
}

function updateHud() {
  phaseValue.textContent = app.phase;
  habitatValue.textContent = app.habitatModuleName;
  modeValue.textContent = app.mode;
  modePill.textContent = app.phase === "orbit" ? "orbit" : app.mode;
  selectedJointValue.textContent = app.selectedJoint ?? "none";
  if (selectedObjectValue) selectedObjectValue.textContent = app.selectedSceneObject?.displayName || app.selectedSceneObject?.semanticClass || "none";
  if (latestTaskValue) latestTaskValue.textContent = app.generatedAssetManager.getLatestTask()?.type ?? "none";
  if (tripoStatusValue) tripoStatusValue.textContent = app.tripoStatus;
  sampleCountValue.textContent = String(app.recorder.getSamples().length);
  sceneHint.textContent = app.phase === "orbit"
    ? (app.issLoaded ? "ISS ready. Click / trigger ISS to enter training habitat." : "Loading ISS station model...")
    : `In ${app.habitatModuleName}: use VR arm/leg handles, telepoint movement, robotic walk agent mode, recording, or CEM train step.`;
  syncPoseTuningControls();

  if (app.phase === "orbit") {
    jointValues.innerHTML = '<span class="empty">Orbit view active. Select the ISS to enter the training habitat.</span>';
    return;
  }

  if (!app.robotController) {
    jointValues.innerHTML = '<span class="empty">Waiting for robot...</span>';
    return;
  }

  const observation = app.robotController.getObservation();
  jointValues.innerHTML = Object.entries(observation.joints)
    .map(([jointName, joint]) => {
      const mapped = joint.mapped ? "" : " missing";
      return `<div class="joint-row"><span>${jointName}${mapped}</span><strong>${joint.value.toFixed(1)}°</strong></div>`;
    })
    .join("");
}

function addWarning(message) {
  if (app.warnings.includes(message)) return;
  app.warnings.push(message);
  const item = document.createElement("li");
  item.textContent = message;
  warningsList.appendChild(item);
  console.warn(message);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.domElement.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  addWarning("WebGL context lost. Reload the page if rendering does not recover.");
});
