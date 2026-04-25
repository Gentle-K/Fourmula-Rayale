# Tripo Backend

## Purpose

This module calls Tripo through backend route handlers so the frontend never
touches `TRIPO_API_KEY`. It is used to generate ISS-themed, WebXR-friendly, low
poly training assets for the hackathon demo, including station interiors,
panels, storage props, tools, and helper robot variants.

Current prompt presets are defined in `src/lib/tripoPresets.ts` and exported
through `src/lib/tripo.ts`.

The dual-track static vs. riggable character pipeline is documented in
`docs/tripo-animation.md`.

## Required Reading

These official docs were reviewed before implementation:

- Tripo Quick Start: <https://platform.tripo3d.ai/docs/quick-start>
- Tripo Generation: <https://platform.tripo3d.ai/docs/generation>
- Tripo Task: <https://platform.tripo3d.ai/docs/task>
- Tripo Upload: <https://platform.tripo3d.ai/docs/upload>
- Tripo Rate Limit: <https://platform.tripo3d.ai/docs/limit>
- Tripo Schema: <https://platform.tripo3d.ai/docs/schema>
- Tripo Post Process: <https://platform.tripo3d.ai/docs/post-process>
- Tripo Changelog: <https://platform.tripo3d.ai/docs/changelog>
- Next.js Route Handlers: <https://nextjs.org/docs/app/getting-started/route-handlers>
- Next.js Environment Variables: <https://nextjs.org/docs/app/guides/environment-variables>
- Vercel Environment Variables: <https://vercel.com/docs/environment-variables>

## Local Configuration

`.env.local`

```bash
TRIPO_API_KEY=your_tripo_api_key_here
USE_MOCK_TRIPO=false
TRIPO_CACHE_TTL_SECONDS=3600
```

`.env.example`

```bash
TRIPO_API_KEY=
USE_MOCK_TRIPO=true
TRIPO_CACHE_TTL_SECONDS=3600
```

Rules:

- Do not commit `.env.local`.
- Do not expose Tripo secrets with any `NEXT_PUBLIC_` prefix.
- Tripo credentials must stay server-side only.
- `.env.local` is read from the project root for local development.

## Official API Notes

Confirmed from the official docs:

- Authentication uses `Authorization: Bearer <TRIPO_API_KEY>`.
- The task creation endpoint is `POST https://api.tripo3d.ai/v2/openapi/task`.
- The image upload endpoint is `POST https://api.tripo3d.ai/v2/openapi/upload`.
- Task polling uses `GET https://api.tripo3d.ai/v2/openapi/task/{task_id}`.
- The task must be queried with the same API key that created it.
- `text_to_model` accepts `prompt`, while `model_version` is optional.
- The official Python SDK shows `image_to_model` sending a `file` object with
  `type` and `file_token` after upload.
- Official text-to-model prompt length is up to 1024 characters, but this app
  intentionally enforces a stricter 800-character UI limit.
- Task output may include `output.model`, `output.base_model`,
  `output.pbr_model`, rendered previews, and additional undocumented fields.
- Official output model URLs are temporary and may expire after about five
  minutes.

Current implementation intentionally omits `model_version`, so Tripo uses its
default generation model. Based on the latest changelog, `P1-20260311` is the
most interesting future option for clean topology and real-time workflows, while
`v3.1-20260211` targets higher fidelity assets.

## API Usage

For rigging and animation debug routes, see `docs/tripo-animation.md`.

### `POST /api/tripo/generate`

Creates either a text-to-model or image-to-model Tripo task through the
backend.

Text-only JSON request:

```json
{
  "prompt": "A realistic ISS module interior with control panels, floating tools and storage bags"
}
```

Example:

```bash
curl -X POST http://localhost:3000/api/tripo/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"A realistic ISS module interior with control panels, floating tools and storage bags"}'
```

Image-assisted multipart request:

```bash
curl -X POST http://localhost:3000/api/tripo/generate \
  -F 'prompt=A compact astronaut tool kit for a browser-based WebXR training scene' \
  -F 'image=@/absolute/path/to/reference.png'
```

Current debug-page validation rules:

- `prompt` stays optional when an image is attached
- prompt length is capped at 800 characters
- reference image types are `JPEG`, `PNG`, and `WEBP`
- reference image size is capped at 20MB in this app
- the frontend never uploads directly to Tripo; it only sends the file to our
  backend route

### `GET /api/tripo/task?taskId=xxx`

Polls a task, normalizes status, and tries to extract a model URL from the
official output shapes.

```bash
curl "http://localhost:3000/api/tripo/task?taskId=task_xxx"
```

### `GET /api/tripo/cache`

Returns the current in-memory cache list for debug and demo use.

```bash
curl "http://localhost:3000/api/tripo/cache"
```

## Frontend Page

Page path:

- `/tripo`

Current UI supports:

- preset selector
- prompt editor
- reference image upload
- generate button for text-only or text + image
- auto polling
- manual refresh
- result card
- `modelUrl` copy/open actions
- cache panel for recent tasks

No existing GLB/WebXR viewer was found in this repo, so the current frontend
shows asset cards and URL output first. The next step is wiring `modelUrl` into
an existing or new Three.js / WebXR viewer.

This page is intentionally an isolated debug console for Tripo backend testing.
It is not the main 3D scene, not the main viewer, and not a replacement for
Member B's Three.js / WebXR work.

## Teammate Integration Contract

Member B can call:

- `POST /api/tripo/generate`
- `GET /api/tripo/task?taskId=...`
- `GET /api/tripo/cache`

Member B should use the returned `modelUrl` to load GLB or model assets into
the Three.js / React Three Fiber / WebXR scene that B owns.

If B wants image-assisted generation, B can submit `multipart/form-data` to
`POST /api/tripo/generate` with:

- `prompt`
- `image`

Member C should not depend on Tripo directly. If C needs asset references for
evaluation or experiment metadata, C should only consume final asset IDs or
model URLs after generation is complete.

## Polling Strategy

The Tripo limit docs describe concurrency pools and 429 behavior, so the UI uses
lightweight polling instead of aggressive retries:

- start polling every 4 seconds
- stop polling on `success`, `failed`, `banned`, `expired`, `cancelled`, or
  `unknown`
- stop auto polling after 5 minutes
- let the user manually refresh after timeout
- avoid infinite retry loops after an error

## Mock Fallback

Mock mode activates when either condition is true:

- `USE_MOCK_TRIPO=true`
- `TRIPO_API_KEY` is missing

This prevents the hackathon UI from crashing when real Tripo access is not
available. Mock tasks move through queued, running, and success states so the UI
can still be demonstrated end to end.

## Vercel Deployment

Configure these variables in Vercel Project Settings:

- `TRIPO_API_KEY`
- `USE_MOCK_TRIPO=false`
- `TRIPO_CACHE_TTL_SECONDS=3600`

Notes:

- Do not store secrets in `vercel.json`.
- Do not put the real key in GitHub.
- Environment variable changes only apply to new deployments, so redeploy after
  editing them.
- Local development can keep using `.env.local`.

## Known Limitations

- The current cache is a process-local memory cache, not a durable store.
- On Vercel serverless infrastructure, memory cache is not guaranteed across
  invocations or instances.
- Future work can move cache state to Vercel KV, Upstash, or Supabase.
- The current frontend supports a single reference image only; multi-view image
  generation is still future work.
- Post-process conversion is not wired yet; future work can trigger
  `convert_model` for formats such as `OBJ`, `FBX`, `USDZ`, or `GLTF`.
