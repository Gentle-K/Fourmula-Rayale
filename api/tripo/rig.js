const { createRigTask, json, readJsonBody } = require("../../server/tripo-common.cjs");

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

  if (body.assetKind && body.assetKind !== "robot_replacement") {
    return json(res, 400, { ok: false, error: "Only robot_replacement assets can request rigging." });
  }

  try {
    const result = await createRigTask({ sourceTaskId: body.sourceTaskId });
    return json(res, 200, {
      ok: true,
      assetId: body.assetId,
      assetKind: "robot_replacement",
      rigTaskId: result.taskId,
      status: result.status,
      rigStatus: result.rigStatus,
      riggedModelUrl: result.riggedModelUrl,
      raw: result.raw,
      mock: result.mock,
    });
  } catch (error) {
    return json(res, 500, { ok: false, error: error instanceof Error ? error.message : "Failed to create rig task." });
  }
};
