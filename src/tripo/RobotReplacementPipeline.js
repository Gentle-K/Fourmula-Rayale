import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { classifyAssetIntent } from "./AssetIntentClassifier.js";
import { normalizePrompt } from "./PromptNormalizer.js";

export class RobotReplacementPipeline {
  constructor({
    client,
    assetManager,
    rigValidator,
    boneMappingManager,
    robotSwapManager,
    loader = new GLTFLoader(),
    onStatus = () => {},
    onManualMappingRequired = () => {},
  }) {
    this.client = client;
    this.assetManager = assetManager;
    this.rigValidator = rigValidator;
    this.boneMappingManager = boneMappingManager;
    this.robotSwapManager = robotSwapManager;
    this.loader = loader;
    this.onStatus = onStatus;
    this.onManualMappingRequired = onManualMappingRequired;
  }

  async generateRobotReplacement({ rawInput, inputType = "text", explicitKind, imageBase64, imageMime }) {
    const intent = classifyAssetIntent({ rawInput, explicitKind: explicitKind || "robot_replacement", inputType });
    const prompt = normalizePrompt(intent);
    const assetRecord = this.assetManager.createAssetRecord({
      assetKind: "robot_replacement",
      requiresRig: true,
      rawInput,
      inputType,
      prompt,
      status: "submitting",
    });

    this.onStatus("Creating Tripo robot base model task.");
    const created = await this.client.generate({
      rawInput,
      inputType,
      assetKind: "robot_replacement",
      prompt,
      imageBase64,
      imageMime,
    });
    this.assetManager.updateAsset(assetRecord.assetId, { taskId: created.taskId, status: created.status || "queued" });

    this.onStatus(`Polling robot base model task ${created.taskId}.`);
    const modelTask = await this.client.waitForTask(created.taskId, {
      type: "model",
      onProgress: (progress) => {
        this.assetManager.updateAsset(assetRecord.assetId, { status: `model_${progress.status}`, modelUrl: progress.modelUrl });
        this.onStatus(`Robot base model task ${created.taskId}: ${progress.status}.`);
      },
    });

    this.onStatus("Creating Tripo rig task for robot replacement.");
    const rigCreated = await this.client.createRig({
      sourceTaskId: created.taskId,
      sourceModelUrl: modelTask.modelUrl,
      assetId: assetRecord.assetId,
    });
    this.assetManager.updateAsset(assetRecord.assetId, { rigTaskId: rigCreated.rigTaskId, status: rigCreated.rigStatus || "rigging" });

    const rigTask = await this.client.waitForTask(rigCreated.rigTaskId, {
      type: "rig",
      onProgress: (progress) => {
        this.assetManager.updateAsset(assetRecord.assetId, {
          status: `rig_${progress.rigStatus || progress.status}`,
          riggedModelUrl: progress.riggedModelUrl || progress.modelUrl,
        });
        this.onStatus(`Robot rig task ${rigCreated.rigTaskId}: ${progress.rigStatus || progress.status}.`);
      },
    });

    const riggedModelUrl = rigTask.riggedModelUrl || rigTask.modelUrl;
    if (!riggedModelUrl) throw new Error("Tripo rig task completed without a rigged model URL.");
    this.assetManager.updateAsset(assetRecord.assetId, { status: "loading_rigged_model", riggedModelUrl });

    const gltf = await this.loadGLB(riggedModelUrl);
    const validation = this.rigValidator.validate(gltf.scene);
    this.assetManager.updateAsset(assetRecord.assetId, { validation });
    if (!validation.ok) {
      throw new Error(`Generated robot was not swapped in: ${validation.reason}`);
    }

    const boneMapping = this.boneMappingManager.createMap(gltf.scene);
    this.assetManager.updateAsset(assetRecord.assetId, { boneMap: boneMapping.boneMap, boneMapping });
    if (!boneMapping.ok) {
      this.onManualMappingRequired(boneMapping);
      throw new Error(`Bone mapping failed. Missing: ${boneMapping.missingBones.join(", ")}`);
    }

    const result = await this.robotSwapManager.replaceCurrentRobot({
      robotRoot: gltf.scene,
      boneMap: boneMapping.boneMap,
      validation,
      assetRecord: { ...assetRecord, riggedModelUrl },
    });
    this.assetManager.updateAsset(assetRecord.assetId, { status: "inserted", swappedAt: performance.now() / 1000 });
    this.onStatus(`Robot replaced. Bone map confidence ${boneMapping.confidence}.`);
    return { ok: true, result, validation, boneMapping };
  }

  loadGLB(url) {
    return new Promise((resolve, reject) => {
      this.loader.load(url, resolve, undefined, reject);
    });
  }
}
