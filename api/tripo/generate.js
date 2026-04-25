const { createModelTask, getAssetKind, json, readJsonBody } = require("../../server/tripo-common.cjs");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return json(res, 400, { ok: false, error: "Invalid JSON body." });
  }

  const rawInput = String(body.rawInput ?? body.prompt ?? "").trim();
  const inputType = String(body.inputType ?? "text");
  const assetKind = getAssetKind(rawInput, body.assetKind);
  const prompt = String(body.prompt ?? rawInput).trim();
  const requiresRig = assetKind === "robot_replacement";

  if (!prompt && !body.imageBase64) {
    return json(res, 400, { ok: false, error: "rawInput, prompt, or imageBase64 is required." });
  }
  if (prompt.length > 800) {
    return json(res, 400, { ok: false, error: "Prompt must be 800 characters or fewer." });
  }

  try {
    const result = await createModelTask({
      prompt,
      imageBase64: body.imageBase64,
      imageMime: body.imageMime,
      assetKind,
    });
    return json(res, 200, {
      ok: true,
      requestId: `gen_${Date.now().toString(36)}`,
      inputType,
      assetKind,
      taskId: result.taskId,
      status: result.status,
      prompt,
      semanticClass: body.semanticClass,
      requiresRig,
      message: requiresRig
        ? "Robot base model task created. Poll task, then request rigging."
        : "Scene object model task created. Poll task, then insert the model.",
      raw: result.raw,
      mock: result.mock,
    });
  } catch (error) {
    return json(res, 500, { ok: false, error: error instanceof Error ? error.message : "Failed to create Tripo task." });
  }
};
