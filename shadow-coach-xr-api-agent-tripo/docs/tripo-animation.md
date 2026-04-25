# Tripo Animation Pipeline

## Dual-Track Asset Pipeline

This project uses two different Tripo asset paths.

### Static Asset Pipeline

These asset types should stay static and only use normal Tripo generation:

- ISS module
- tool kit
- control panel
- storage bag
- handrail
- cable bundle
- dock / docking pad
- cleaning cloth
- floating tablet

These assets should generate a normal GLB and stop there. They do not need
rigging.

### Riggable Character Pipeline

These asset types are allowed to go through rigging and optional animation:

- assistant robot
- astronaut
- humanoid guide
- small creature

These assets first generate a base model, then optionally go through rigging,
and then optionally through animation retargeting.

## Why Split the Pipelines

- Static props do not benefit from rigging.
- Separating the pipelines saves Tripo quota.
- It reduces failure risk on props that should remain rigid.
- It keeps the downstream WebXR scene simpler and more stable.

## Official Tripo Workflow

Reviewed official docs:

- Tripo Generation: <https://platform.tripo3d.ai/docs/generation>
- Tripo Task: <https://platform.tripo3d.ai/docs/task>
- Tripo Animation: <https://platform.tripo3d.ai/docs/animation>
- Tripo Post Process: <https://platform.tripo3d.ai/docs/post-process>
- Tripo Rate Limit: <https://platform.tripo3d.ai/docs/limit>
- Tripo Schema: <https://platform.tripo3d.ai/docs/schema>

Current implementation follows these official behaviors:

- normal generation still uses `POST /task` with `type: "text_to_model"` or
  `type: "image_to_model"`
- task polling still uses `GET /task/{task_id}`
- animation tasks also use `POST /task`
- public animation endpoints use `original_model_task_id`
- current public animation types are:
  - `animate_prerigcheck`
  - `animate_rig`
  - `animate_retarget`

Important note:

- the public animation docs center the workflow around a prior Tripo task id
- because of that, the real backend currently requires `sourceTaskId` for
  rigging / animation
- `sourceModelUrl` is accepted by our route shape for future compatibility, but
  the real Tripo public animation request currently still relies on
  `original_model_task_id`

## API Routes

### Static generation

- `POST /api/tripo/generate`
- `GET /api/tripo/task?taskId=...`
- `GET /api/tripo/cache`

### Riggable character pipeline

- `POST /api/tripo/riggable/generate`
- `POST /api/tripo/riggable/rig`
- `POST /api/tripo/riggable/animate`
- `GET /api/tripo/animation/task?taskId=...`

## Debug UI

`/tripo` is now split into:

- `Static Asset Generator`
- `Riggable Character Generator`

The page is still a debug console. It is not the main WebXR animation
controller.

## Animation Presets

Current debug presets:

- Robot Idle Hover
- Robot Pointing
- Guide Wave
- Guide Pointing
- Walk Loop

These presets are mapped to Tripo retarget values as conservatively as possible
based on the public animation docs and schema. If a real retarget request fails
for a specific model or preset combination, the UI shows the error and mock mode
can still be used for demo continuity.

## Member B Contract

Member B should consume:

- `modelUrl` for static assets
- `riggedModelUrl` for riggable assets that stop after rigging
- `animatedModelUrl` for riggable assets that complete retarget animation

B owns the main WebXR scene and animation playback. If an animated GLB includes
animation clips, B can load and play them with Three.js:

```ts
const gltf = useGLTF(animatedModelUrl);
const mixer = new THREE.AnimationMixer(gltf.scene);
gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
```

If a clip is missing or rigging fails, B should fall back to procedural floating
or idle animation in the scene layer.

## Member C Contract

Member C should not call Tripo animation directly.

- C may decide which episode or policy state should trigger which asset state.
- C still owns learning, scoring, and evaluation.
- C should consume only final asset references if needed.

## Limitations

- Not every robot or character model is successfully riggable.
- Humanoid guide characters are better candidates for retargeted animation than
  static props.
- Assistant robots may still need procedural floating animation fallback.
- Serverless functions should not block while waiting for long multi-step
  pipelines to finish.
- Polling is still required.
- Tripo output URLs may expire.
- Final animated GLBs should be downloaded or stored in stable object storage
  before a live demo if persistence matters.

## Security

- `TRIPO_API_KEY` stays server-side only.
- No client-side `NEXT_PUBLIC_` Tripo secret variable.
- Do not commit `.env.local`.
