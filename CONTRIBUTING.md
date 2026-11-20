# Contributing to Hooked

Thanks for helping people understand WordPress. A few rules keep the site accurate and consistent.

## Ground rules

1. **Accuracy first.** Every factual claim about WordPress must be checkable against core source at the pinned version. Link to it with an anchor (a code snippet), not a line number.
2. **One world.** All visuals use the metro-line prop vocabulary in [`docs/design-system.md`](docs/design-system.md). If something you want to explain has no prop yet, propose one there first; don't add one-off visuals.
3. **Beginner-first copy.** Write for someone new to WordPress. Label analogies as analogies, and keep real names visible.

## Workflow

- Node 26 (`nvm use`), pnpm 12.
- Write the test first for anything in `src/lib/` (coverage gate: 80%).
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:`, `ci:`. A commit-msg hook checks this.
- Git hooks (lefthook) run lint, format and typecheck on commit, and the unit tests on push.
- Before opening a PR, run `pnpm check` and `pnpm build && pnpm test:e2e`.

## Adding things

- **A story step:** add it to the chapter's stage data with its beat, resting pose and copy, then check the copy against core source.
- **An act or beat:** add it to `src/content/chapter-1/spec.ts`, write its copy in `copy.tsx`, add an explainer for every name it shows in `content/explainers.json`, and update the outline in `chapter.test.ts`. The tests check hooks, copy and explainers against the real data. See [`docs/story-engine.md`](docs/story-engine.md).
- **A WordPress version:** run `pnpm wp-data <x.y>`, then `pnpm hook-conformance` and `pnpm test`. Story text only needs edits where the integrity tests flag drift. See [`docs/data-pipeline.md`](docs/data-pipeline.md).
- **A 3D set piece:** build it from existing props in the vocabulary, and keep geometry helpers pure and tested in `src/lib/geometry/`.
