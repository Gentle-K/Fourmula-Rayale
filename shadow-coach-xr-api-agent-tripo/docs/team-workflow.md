# Shadow Coach XR Team Workflow

We are 4 people working in the same GitHub repository for the Shadow Coach XR hackathon project.

## Core Rules

- `main` must always stay runnable.
- Do not make direct ad hoc edits on `main`.
- Every person works on their own feature branch.
- Merge work back together every 60-90 minutes.
- Run `npm run build` before every merge.
- Never commit `.env.local`.
- API keys may only live in local `.env.local` or in Vercel environment variables.

## Team Ownership

### Person 1 - Product / Pitch / Integration Lead

- Branch: `pitch-integration`
- Files:
- `README.md`
- `docs/*`
- `demo-script.md`
- `pitch.md`
- `src/app/page.tsx` only for final integration

### Person 2 - Frontend UI Lead

- Branch: `ui-dashboard`
- Files:
- `src/components/dashboard/*`
- `src/components/landing/*`

### Person 3 - 3D / Spatial UX Lead

- Branch: `three-arena`
- Files:
- `src/components/three/*`
- `public/models/*`

### Person 4 - AI / API / Tripo Lead

- Branch: `api-agent-tripo`
- Files:
- `src/app/api/*`
- `src/lib/*`

## Integration Note

- Avoid multiple people editing `src/app/page.tsx` at the same time.
- Final integration should be done by one person only.
