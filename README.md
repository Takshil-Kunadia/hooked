# Hooked: how WordPress really works

An interactive 3D explainer for WordPress core. One page visit is a metro journey: the request is a train, hooks are stations, the listeners on an action are ticket passes on the platform, and filters are a workshop of portals the cargo rides through. It's written for people touching WordPress or web development for the first time, with the real WordPress names (and code, in developer mode) on every sign.

- **Design record:** [`docs/design.md`](docs/design.md)
- **Locked visual system:** [`docs/design-system.md`](docs/design-system.md)
- **Where the WordPress facts come from:** [`docs/data-pipeline.md`](docs/data-pipeline.md)
- **How the hook engine is proven against real WordPress:** [`docs/hook-engine.md`](docs/hook-engine.md)
- **How the scroll story works, and how to add an act or beat:** [`docs/story-engine.md`](docs/story-engine.md)
- **Throwaway design rounds:** `explorations/` (served as static HTML, not part of the build)

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · React Three Fiber 9 + drei · three r187 · GSAP + Lenis · Tailwind CSS 4 · zod · Vitest · Playwright · pnpm on Node 26.

## Getting started

```bash
nvm use            # Node 26 (see .nvmrc)
pnpm install
pnpm dev           # http://localhost:3000
```

## Scripts

| Script                                               | What it does                                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `pnpm dev`                                           | Development server                                                                       |
| `pnpm build` / `pnpm start`                          | Production build / serve it                                                              |
| `pnpm lint` / `pnpm typecheck` / `pnpm format:check` | Static checks                                                                            |
| `pnpm test` / `pnpm test:coverage`                   | Unit tests (Vitest); coverage gate is 80% on `src/lib`                                   |
| `pnpm test:e2e`                                      | Playwright smoke and accessibility tests against a production build (`pnpm build` first) |
| `pnpm check`                                         | Everything CI runs, except e2e                                                           |
| `pnpm wp-data <x.y>`                                 | Trace a WordPress version in Playground and regenerate `content/versions/<x.y>`          |
| `pnpm hook-conformance`                              | Record real WordPress hook behaviour for the engine's conformance test (needs PHP 8)     |

## Project layout

```
src/app/               routes, layout, fonts
src/components/three/  the 3D stage (client-only, loaded after the text paints)
src/lib/               pure, tested logic: story timeline, transit geometry, metro map data, WordPress data
content/versions/      generated WordPress data, one folder per version (pnpm wp-data)
tools/wp-data/         the data pipeline: tracer, Playground blueprints, demo fixtures
src/lib/hook-engine/   the TypeScript port of WP_Hook and plugin.php
tools/hook-engine/     conformance scenarios, the PHP runner and the recorded expectations
src/styles/tokens.css  design tokens (source of truth: docs/design-system.md)
tests/e2e/             Playwright
tests/data/            integrity tests for the generated WordPress data
explorations/          throwaway design mockups
```

## Supply chain

`pnpm-workspace.yaml` sets `minimumReleaseAge: 1440`, so package versions published less than a day ago are never installed. Don't add exclusions; pin a settled version instead.

## Licence

GPL-2.0-or-later, the same as WordPress. Departure Mono is MIT (`src/app/fonts/DepartureMono-LICENSE.txt`).
