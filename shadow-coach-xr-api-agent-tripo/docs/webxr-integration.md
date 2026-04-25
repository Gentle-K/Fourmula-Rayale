# WebXR Integration

## Goal

`/xr` is the stable WebXR demo shell for Orbital Skill Habitat. It adds a headset-ready route with a desktop fallback preview, without changing the secure Tripo backend semantics or replacing Member C's learning logic.

## Route purpose

- Route: `/xr`
- Purpose: render an ISS-style maintenance demo shell with React Three Fiber and `@react-three/xr`
- Scope: visualization shell only
- Out of scope:
  - Web Speech / STT inside WebXR
  - Tripo model generation from the headset view
  - Member C's real episode, scoring, or learning implementation

## WebXR vs OpenXR

- WebXR is the browser API for immersive web experiences.
- OpenXR is a native application standard and is not what this Next.js demo uses.
- This project targets WebXR in-browser preview and headset entry, not a native Unity or OpenXR runtime.

## What WebXR does and does not do

- WebXR handles immersive device sessions, viewer pose, render loop, and controller/input integration.
- WebXR does not handle speech-to-text, AI planning, or Tripo model generation.
- Voice prompt generation remains in `/tripo`, which is the isolated Tripo debug page.

## Desktop fallback

- `/xr` works without a headset.
- Desktop preview renders the same scene with Orbit controls and HUD controls.
- If `navigator.xr` is unavailable, the page shows a support notice and keeps the desktop preview usable.

## Headset / Quest testing

- WebXR generally requires a secure context.
- Localhost works for local development.
- Quest or other headset testing should use an HTTPS deployment URL.
- Recommended test flow:
  1. Run `npm run dev` locally and open `http://localhost:3000/xr`
  2. Verify desktop preview
  3. Deploy to Vercel
  4. Open the HTTPS URL in Quest Browser or another compatible WebXR browser
  5. Click `Enter VR`

## Asset paths

The scene tries to load local GLB assets first, but never hard-depends on them.

- `/assets/base-scene/iss_interior_base.glb`
- `/assets/tripo/assistant_robot.glb`
- `/assets/tripo/tool_kit.glb`
- `/assets/tripo/storage_bag.glb`
- `/assets/tripo/control_panel.glb`
- `/assets/tripo/docking_pad.glb`
- `/assets/tripo/cleaning_cloth.glb`

If a model file is missing or fails to load, the scene falls back to primitive geometry so the route does not white-screen.

## B / C / D integration contract

- Member B owns the main polished 3D scene, detailed interaction design, controller UX, and the final WebXR viewer experience.
- This `/xr` shell is intentionally lightweight and safe: it gives B a working route, scene scaffold, HUD, and fallback asset loading without replacing B's eventual main scene architecture.
- Member C owns real `TaskDef`, `Episode`, `Measures`, scoring, replay logic, and learning curves.
- Current `/xr` uses a lightweight mock episode adapter in `src/lib/xr/mockEpisode.ts` so the visual shell can run before C's final data contracts arrive.
- Member C can later replace the mock episode source while keeping the same visualization surface.
- Member D owns Tripo asset supply, cache bridge, secure backend routes, deployment safety, and the model URL contract.

## Tripo integration

- `/xr` never reads `TRIPO_API_KEY` on the client.
- `/xr` only reads cached model URLs through `GET /api/tripo/cache`.
- If a recent successful Tripo asset exists, the HUD can load the latest cached `modelUrl` into the scene.
- `/tripo` remains the isolated place for prompt authoring, image-assisted generation, and voice prompt input.

## How to run

```bash
npm run dev
```

Open:

- `http://localhost:3000/xr`
- `http://localhost:3000/tripo`

## Deployment notes

- WebXR headset testing needs HTTPS.
- Vercel preview or production deployments are suitable for Quest Browser testing.
- Avoid checking large raw GLB packages into Git. Use optimized assets and external object storage if necessary.

## Known limitations

- Controller grab / pointer interactions are still MVP / TODO.
- The current robot motion is a mock visualization, not a physics-accurate controller or RL policy.
- Real scoring and learning remain owned by Member C.
- Memory cache and Tripo asset URLs are still demo-grade.
- Asset optimization is still needed for headset performance.
- Browser WebXR support varies by device and browser.

## Official references checked

- WebXR Device API (MDN): https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API
- WebXR Device API (W3C): https://www.w3.org/TR/webxr/
- @react-three/xr docs: https://pmndrs.github.io/xr/docs/getting-started/convert-to-xr
- React Three Fiber docs: https://r3f.docs.pmnd.rs/
- Drei docs: https://github.com/pmndrs/drei
- Next.js App Router docs: https://nextjs.org/docs/app
- Vercel docs: https://vercel.com/docs
