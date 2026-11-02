# AGENTS.md

Liquid Metal: a fullscreen WebGL2 fragment-shader page. Vite + TypeScript, no graphics libraries.

## Layout

- `src/shader.ts`: GLSL vertex and fragment source. Height field (domain-warped fbm + click ripples), finite-difference normals, environment reflection, fresnel, iridescence, mouse light.
- `src/main.ts`: WebGL setup, uniforms, pointer input, render loop, material switching. Material presets live in `MATERIALS`.
- `src/style.css`: overlay UI (title, material pill) and the dark scrim behind the text.
- `index.html`: markup, canvas, material buttons (`data-material` index must match `MATERIALS`).
- `wrangler.jsonc`: Cloudflare static assets config (serves `./dist`).

## Commands

- `npm install`
- `npm run dev`: dev server on port 47193 (strict).
- `npm run build`: type check + production build into `dist/`.
- `npx tsc --noEmit`: type check only.

## Conventions

- Keep the shader single-pass and dependency-free. Uniforms are declared in `src/shader.ts` and set in `src/main.ts`; add both sides together.
- `MAX_RIPPLES` is shared between the shader and the JS ripple buffer.
- After shader changes, open the page and check all four materials; a compile error shows only in the browser console.
- Cap device pixel ratio in `resize()` if performance is a concern on mobile.

## Deploy

Pushing to `main` on GitHub triggers a Cloudflare Workers build: build command `npm run build`, deploy command `npx wrangler deploy`.
