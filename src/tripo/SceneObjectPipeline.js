import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { classifyAssetIntent } from "./AssetIntentClassifier.js";
import { normalizePrompt } from "./PromptNormalizer.js";

export class SceneObjectPipeline {
  constructor({
    client,
    assetManager,
    postProcessor,
    loader = new GLTFLoader(),
    onInsertObject,
    onStatus = () => {},
  }) {
    this.client = client;
    this.assetManager = assetManager;
    this.postProcessor = postProcessor;
    this.loader = loader;
    this.onInsertObject = onInsertObject;
    this.onStatus = onStatus;
  }

  async generateSceneObject({ rawInput, inputType = "text", explicitKind, imageBase64, imageMime, semanticClass }) {
    const intent = classifyAssetIntent({ rawInput, explicitKind: explicitKind || "scene_object", inputType });
    const prompt = normalizePrompt(intent);
    const assetRecord = this.assetManager.createAssetRecord({
      assetKind: "scene_object",
      requiresRig: false,
      rawInput,
      inputType,
      semanticClass: semanticClass || intent.semanticClass,
      prompt,
      status: "submitting",
    });

    this.onStatus(`Creating Tripo scene object task: ${assetRecord.semanticClass}.`);
    const created = await this.client.generate({
      rawInput,
      inputType,
      assetKind: "scene_object",
      prompt,
      imageBase64,
      imageMime,
      semanticClass: assetRecord.semanticClass,
    });
    this.assetManager.updateAsset(assetRecord.assetId, { taskId: created.taskId, status: created.status || "queued" });

    this.onStatus(`Polling Tripo model task ${created.taskId}.`);
    const completed = await this.client.waitForTask(created.taskId, {
      type: "model",
      onProgress: (progress) => {
        this.assetManager.updateAsset(assetRecord.assetId, { status: progress.status, modelUrl: progress.modelUrl });
        this.onStatus(`Scene object task ${created.taskId}: ${progress.status}.`);
      },
    });

    if (!completed.modelUrl) throw new Error("Tripo task completed without a model URL.");
    this.assetManager.updateAsset(assetRecord.assetId, { status: "loading_model", modelUrl: completed.modelUrl });
    const gltf = await this.loadGLB(completed.modelUrl);
    const processed = this.postProcessor.processSceneObject(gltf.scene, {
      semanticClass: assetRecord.semanticClass,
      displayName: rawInput || assetRecord.semanticClass,
      modelUrl: completed.modelUrl,
    });

    const sceneObject = this.onInsertObject(processed, {
      assetId: assetRecord.assetId,
      prompt,
      taskId: created.taskId,
    });
    this.assetManager.updateAsset(assetRecord.assetId, { status: "inserted", objectId: sceneObject.objectId });
    this.onStatus(`Inserted ${sceneObject.displayName || sceneObject.semanticClass} and created a training task.`);
    return sceneObject;
  }

  loadGLB(url) {
    return new Promise((resolve, reject) => {
      this.loader.load(url, resolve, undefined, reject);
    });
  }
}
