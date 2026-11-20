# Phase 5a: the metro scene and Chapter 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the scroll-story engine and the full metro scene in the real app, and ship Chapter 1 on `/`. The chapter covers Stop 0 "Before WordPress", then a front-end request booting from `index.php` through `wp-settings.php` to `init` and `wp_loaded`. Its copy is accuracy-reviewed, its facts come from data, and it is responsive, with reduced-motion and no-WebGL fallbacks.

**Architecture:**

- **Pure logic in `src/lib/story/`:** layout modes, the chapter model, scroll math, train motion, camera shots, data facts and card placement. It is unit-tested in Node.
- **The scene:** a port of the approved design-round-5 scene to React Three Fiber. It reads one zustand store.
- **Text renders on the server:** the copy is server-rendered HTML with sticky pins. A small client controller turns scroll position into store updates (act, beat, entered-at time). The scene and the boards react to the store.

**Tech Stack:** Next.js 16.4 (App Router, Cache Components), React 19.3, React Three Fiber 9.8, three r187 and its `three/addons` post-processing, zustand (new), Tailwind 4.3, zod, Vitest 5.1, Playwright 1.65.

**Spec:** `docs/design.md` (plan) and `docs/design-system.md` (locked design system). The visual and behaviour reference is `explorations/design-round-5/index.html`, with screenshots in `explorations/design-round-5/screenshots/`. Read all three.

**Not in this slice:**

- **Later slices of phase 5:**
  - 5b: `WP::main()`, the query and the depot.
  - 5c: the template junction and the block/classic switch.
  - 5d: rendering, the response and `shutdown`.
- **Later in phase 5:** the global Beginner/Developer toggle (the "Under the hood" expanders cover developers for now) and the day → dusk → dark-core lighting narrative. The palette follows the colour scheme for now.
- **Phase 10:** static posters for no-WebGL (copy-only for now), `wp.hooks` easter eggs and JSON-LD.

## Global Constraints

**Toolchain and stack**

- Run `source ~/.nvm/nvm.sh && nvm use 26` before any `pnpm` command.
- **TypeScript:** strict, with `noUncheckedIndexedAccess` and `erasableSyntaxOnly`, so no enums and no parameter properties.
- **New dependencies:** `zustand` only. Pin an exact version at least 1 day old (`pnpm-workspace.yaml` sets `minimumReleaseAge: 1440`). The deliberate omissions:
  - **No GSAP or Lenis.** Round 5's motion needs neither; add them only when a later scene needs timeline choreography.
  - **No drei, no `@react-three/postprocessing`.** Use the `three/addons` passes round 5 uses.
- Read the version-specific Next docs in `node_modules/next/dist/docs/` before using `"use cache"` or any other Next API.

**Content and facts**

- Content is pinned to the latest stable version in `content/versions/index.json` (7.1, WordPress 7.1.5). **Facts come from data, never hardcoded in copy:** hook names, file and line, priorities, run order and callbacks.
- **Writing:**
  - Write for someone touching WordPress or web development for the first time, keeping real WordPress names visible.
  - Each beat opens with a **bold lead-in**, followed by body text in the body colour.
  - Label analogies as analogies ("Think of a town-hall bell").
  - Body copy is never under 17px. Headlines use `clamp(38px, 6.2vw, 98px)`, weight 700, tracking −0.038em.

**Props and colour**

- One prop per idea, from the table in `docs/design-system.md` §1. **No one-off props.** Stop 0's web server and PHP are **stations** (stations are "core files and stages").
- Never show meaning by colour alone: origins always carry a text chip.
- Never put text over the 3D without a backdrop: a scrim on desktop, a frosted sheet on phones.
- Inactive copy uses `--muted`, with no opacity tricks.

**Layout and scene**

- **Layout modes:**
  - stacked: ≤ 760px, or portrait ≤ 1180px
  - tablet: landscape 761–1180px
  - desktop: 1181–1799px
  - wide: ≥ 1800px
- The canvas uses `100lvh` and ignores height-only resizes on coarse pointers.
- **Rendering:**
  - MSAA ×4 on the post-processing target.
  - Label textures at 2× and unlit, not tone-mapped.
  - No overlapping coplanar surfaces.
  - Bloom in Dusk only, with a threshold of about 0.93.
- **Motion:**
  - Train tweens use ease-in-out-cubic, lasting 0.9–3s depending on distance.
  - Each ticket takes its turn about 0.5s after the previous one.
  - Snap settles after 160ms idle. ↓/↑/Space/PageUp/PageDown step through beats, and the rail is clickable.
  - With `prefers-reduced-motion`, there are no tweens: poses jump and the camera cuts.
- **Camera:** the subject sits about 36% right of centre on desktop, and in the top half on stacked layouts.
- Hide map labels that don't belong to the current stop (focus mode); don't just dim them.

**Budgets and quality bar**

- **Budgets:**
  - LCP ≤ 2.0s, and the hero text is the LCP element.
  - CLS ≤ 0.05.
  - Route JS ≤ 180 KB gzip, excluding the 3D chunk.
  - 3D chunk ≤ 350 KB gzip, loaded after LCP.
- Coverage ≥ 80% on `src/lib/**`, and `pnpm check` green.

**Workflow**

- Commits use conventional types (feat, fix, refactor, docs, test, chore, perf, ci), with body lines ≤ 100 characters and no attribution lines. Run `/verify` before every commit that isn't docs-only or tests-only.
- Work on branch `feat/story-chapter-1`. Push and open a PR at the end. The user merges.

## Review Focus

1. **Rotating a phone, or the URL bar collapsing, mid-story:** the pins re-measure, the same beat stays active, and the canvas doesn't jump. Pinned in Task 13: `keeps the beat across a resize`.
2. **Reloading mid-page, or opening `/#init`:** the train is already at that beat's pose on first paint, with no ride from the start. Pinned in Task 13: `restores the beat after reload` and `deep link starts at the act`.
3. **Fast scrolling, or dragging the scrollbar across many beats:** the train goes straight to the final target from wherever it is. Skipped beats' events never fire late. Pinned in Task 5: `retargets from the current position` and `skipped beats fire nothing`.
4. **Scrolling backwards:** state reverses. Tickets go back to waiting before the announcement; arriving at the tickets beat from a later beat shows them all done. Pinned in Task 5: `entering from a later beat shows every ticket done`.
5. **Keyboard users inside the copy:** Space or Enter on a focused `<summary>`, button or link activates it and doesn't step beats, and focus stays visible. Pinned in Task 13: `space on a focused summary toggles it`.

---

## File structure

| File                                                     | Responsibility                                                                                                                                                       |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/story/layout.ts`                                | `layoutMode()`, the one definition of the four layout modes, mirrored by CSS custom variants                                                                         |
| `src/lib/story/store.ts`                                 | zustand store: current act and beat, enteredAt, layout, reduced motion, hovered and pinned card                                                                      |
| `src/lib/story/chapter.ts`                               | Chapter, act and beat types; `validateChapter()`; `flattenBeats()`                                                                                                   |
| `src/lib/story/scroll.ts`                                | Pin and beat math: scroll position ↔ act/beat, snap and step targets                                                                                                 |
| `src/lib/story/motion.ts`                                | Train travel (tween, retarget) and the ticket cascade, as functions of time                                                                                          |
| `src/lib/story/camera.ts`                                | Per-layout camera rigs and `shotFor()`                                                                                                                               |
| `src/lib/story/facts.ts`                                 | Picks story facts from WordPress data: tickets, announcements, source and docs URLs                                                                                  |
| `src/lib/story/data.ts`                                  | Server-only `getStoryData()`, reading the latest version's data                                                                                                      |
| `src/lib/story/explainers.ts`                            | Schema and lookup for hover-card summaries                                                                                                                           |
| `src/lib/story/placement.ts`                             | `placeCard()`: keeps cards inside the viewport and off the copy, boards and header                                                                                   |
| `src/lib/metro/route.ts`                                 | Map data: main line, feeder lines (now including mu-plugins and drop-ins), stations, depot                                                                           |
| `src/lib/geometry/transit.ts`                            | Adds `nearestParam()`, the arc-length position of a point on a path                                                                                                  |
| `content/explainers.json`                                | Plain-English summaries for every card in Chapter 1                                                                                                                  |
| `src/content/chapter-1/spec.ts`                          | Chapter 1 data: acts, beats, stations, shots, focus, hooks                                                                                                           |
| `src/content/chapter-1/copy.tsx`                         | Chapter 1 copy (server components), keyed by beat id                                                                                                                 |
| `src/components/story/*`                                 | `Story` (server), `Act`, `StoryController`, `ProgressRail`, `DepartureBoard`, `TrainPill`, `HookCard`, `Hook` (inline code word)                                     |
| `src/components/three/*`                                 | `MetroStage` (canvas and render loop), `Effects`, `palette.ts`, `map/MetroMap`, `map/labels.ts`, `map/Depot`, `map/InitPlatform`, `Train`, `CameraRig`, `usePicking` |
| `tests/e2e/story.spec.ts`, `tests/e2e/fallbacks.spec.ts` | Story behaviour, Review Focus, fallbacks, axe and viewport screenshots                                                                                               |
| `docs/story-engine.md`                                   | How a chapter is built, and how to add an act or beat                                                                                                                |

---

### Task 1: Layout modes and the story store

**Files:**

- Create: `src/lib/story/layout.ts`, `src/lib/story/layout.test.ts`, `src/lib/story/store.ts`, `src/lib/story/store.test.ts`
- Modify: `package.json` (add `zustand`), `src/app/globals.css` (add `@custom-variant stacked|tablet|desktop|wide` using the same queries)

**Interfaces:**

- Produces:
  - `type LayoutMode = "stacked" | "tablet" | "desktop" | "wide"`
  - `LAYOUT_QUERIES: Readonly<Record<LayoutMode, string>>`
  - `layoutMode(width: number, height: number): LayoutMode`
  - `createStoryStore(initial?: Partial<StoryState>): StoreApi<StoryState & StoryActions>` and the app-wide `storyStore`
  - `StoryState { actId: string; beat: number; enteredAt: number; fromLater: boolean; layout: LayoutMode; reducedMotion: boolean; hovered: string | null; pinned: string | null }`
  - `StoryActions { goTo(actId: string, beat: number, globalIndex: number, nowS: number): void; setLayout(m: LayoutMode): void; setReducedMotion(r: boolean): void; hover(name: string | null): void; pin(name: string | null): void }`
- `fromLater` is true when the new beat's global index is lower than the previous one.

- [ ] **Step 1: Write the failing tests.**
  - `layoutMode` maps `[390,844]`, `[820,1180]`, `[760,400]` → `"stacked"`, `[1180,820]`, `[761,500]` → `"tablet"`, `[1440,900]`, `[1181,1300]` → `"desktop"`, and `[1920,1080]`, `[1800,1000]` → `"wide"`.
  - `css queries match LAYOUT_QUERIES`: read `src/app/globals.css` and expect each query string to appear in its `@custom-variant`.
  - Store:
    - `goTo` sets `enteredAt` only when the act or beat changes.
    - `fromLater` follows the global index.
    - `hover` is ignored while a card is pinned.
    - `pin(null)` clears both `pinned` and `hovered`.
- [ ] **Step 2:** Run `pnpm vitest run src/lib/story`. Expected: FAIL, the modules don't exist.
- [ ] **Step 3:** Implement both modules. Use `createStore` from `zustand/vanilla`, and have components read it with `useStore`.
- [ ] **Step 4:** Run `pnpm vitest run src/lib/story`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(story): add layout modes and the story store`.

### Task 2: Map data for the whole line

**Files:**

- Modify: `src/lib/metro/route.ts`, `src/lib/geometry/transit.ts`, `src/lib/design/tokens.ts` (if a spur or feeder colour is missing)
- Create: `src/lib/metro/route.test.ts`
- Test: `src/lib/geometry/transit.test.ts`

**Interfaces:**

- Produces:
  - `type StationId = "browser" | "server" | "php" | "index" | "config" | "settings" | "init" | "query" | "template" | "the_title" | "response"`
  - `interface Station { id: StationId; title: string; sub: string; x: number; z: number; labelSide: -1 | 1; len?: number; featured?: boolean; card: string }`
  - `STATIONS: ReadonlyArray<Station>`, in travel order
  - `stationById(id: StationId): Station`
  - `DEPOT: { x: number; z: number }`
  - `FEEDER_LINES`, now with `mu` (origin `mu`) and `dropins` (origin `dropin`), joining at wp-settings beside the plugin and theme lines
  - `nearestParam(path: CurvePath<Vector3>, x: number, z: number, samples?: number): number` (0..1 by arc length)
- **Titles and subs, in this order:**

  | Station   | Title             | Sub                              |
  | --------- | ----------------- | -------------------------------- |
  | browser   | "your browser"    | "start & finish"                 |
  | server    | "web server"      | "nginx or Apache"                |
  | php       | "PHP"             | "runs the code"                  |
  | index     | "index.php"       | "front door"                     |
  | config    | "wp-config.php"   | "control room"                   |
  | settings  | "wp-settings.php" | "interchange"                    |
  | init      | "init"            | "do_action( 'init' )" (featured) |
  | query     | "WP_Query"        | "to the depot"                   |
  | template  | "template"        | "junction"                       |
  | the_title | "the_title"       | "filter workshop"                |
  | response  | "200 OK"          | "back to your browser"           |

- **Layout:** extend `MAIN_LINE` left, so Stop 0's three stations come before `index.php`. Keep round 5's positions from `index.php` onward, shifted as needed.

- [ ] **Step 1: Write the failing tests.**
  - `nearestParam` returns 0, 0.5 and 1 for the start, middle and end of a straight path, and is monotonic along a bent path.
  - `stations sit on the main line`: each is within 0.05 units of the path.
  - `stations run in travel order`: `nearestParam` strictly increases through `STATIONS`.
  - `stations are spaced`: at least 2.4 units apart.
  - `ids are unique`.
  - `feeder lines join at wp-settings`: each feeder's last point is within 0.6 units of the main line, and within 3 units of `settings` on x.
  - `the depot spur starts on the main line near WP_Query`.
- [ ] **Step 2:** Run `pnpm vitest run src/lib/metro src/lib/geometry`. Expected: FAIL.
- [ ] **Step 3:** Implement. Port `uOf` from `explorations/design-round-5/index.html` (around lines 705–716) as `nearestParam`.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `feat(metro): lay out the whole line, from your browser to 200 OK`.

### Task 3: The chapter model

**Files:**

- Create: `src/lib/story/chapter.ts`, `src/lib/story/chapter.test.ts`

**Interfaces:**

- Consumes: `StationId` (Task 2).
- Produces:
  - `type ShotId = "overview" | "station" | "depot" | "feeders" | "platform"`
  - `type FocusId = StationId | "feeders" | "depot"`
  - `interface BeatSpec { id: string; rail: string; station: StationId; shot: ShotId; focus: ReadonlyArray<FocusId>; board?: "announcements" | "init"; pill?: "request" | "init" | "response"; hooks: ReadonlyArray<string> }`
  - `interface ActSpec { id: string; kicker: string; title: string; beats: ReadonlyArray<BeatSpec> }`
  - `interface ChapterSpec { id: string; acts: ReadonlyArray<ActSpec> }`
  - `type ChapterIssue = { code: "duplicate-act" | "duplicate-beat" | "empty-act" | "unknown-hook" | "train-reverses"; where: string }`
  - `validateChapter(spec: ChapterSpec, hookExists: (name: string) => boolean): ChapterIssue[]`
  - `flattenBeats(spec: ChapterSpec): ReadonlyArray<{ actId: string; actIndex: number; beat: number; globalIndex: number; spec: BeatSpec }>`

- [ ] **Step 1: Write the failing tests.**
  - A valid two-act spec returns `[]`.
  - Each issue code is reported with its `where` (e.g. `"init/announce"`).
  - `train-reverses` fires when a beat's station comes before the previous beat's station in `STATIONS` order.
  - `flattenBeats` numbers beats globally, in order.
- [ ] **Step 2:** Run `pnpm vitest run src/lib/story/chapter.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `feat(story): model chapters, acts and beats`.

### Task 4: Scroll math

**Files:**

- Create: `src/lib/story/scroll.ts`, `src/lib/story/scroll.test.ts`
- Reuse: `beatAt`, `clamp01` from `src/lib/story/timeline.ts`

**Interfaces:**

- Produces:
  - `BEAT_SPAN_VH = 70`, `BREATHER_VH = 40`
  - `interface MeasuredAct { id: string; top: number; height: number; beats: number }`
  - `actHeightVh(beats: number): number`, which returns `100 + beats * BEAT_SPAN_VH`
  - `positionAt(acts: ReadonlyArray<MeasuredAct>, scrollY: number, viewportH: number): { actIndex: number; beat: number; inBreather: boolean }`
  - `beatScrollY(act: MeasuredAct, beat: number, viewportH: number): number`, the centre of the beat's span
  - `snapTarget(acts, scrollY, viewportH): number`
  - `stepTarget(acts, scrollY, viewportH, direction: 1 | -1): number`
- **Rules:**
  - Beat k of n occupies `[k/n, (k+1)/n)` of the act's pinned range (`height − viewportH`).
  - Above the first act, the position is act 0, beat 0.
  - In a breather (the gap after an act and before the next), the position is the next act's beat 0, with `inBreather: true`, which hides the copy.
  - Past the end, the position is the last beat.

- [ ] **Step 1: Write the failing tests.** Use two acts (3 and 2 beats) measured at `viewportH = 1000`.
  - `positionAt` at each beat centre gives that beat.
  - In the breather, `inBreather` is true.
  - A NaN scroll gives act 0, beat 0.
  - `snapTarget` from just past a beat's centre returns that centre.
  - `stepTarget` moves +1 and −1 across the act boundary, and clamps at both ends.
- [ ] **Step 2:** Run `pnpm vitest run src/lib/story/scroll.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `feat(story): map scroll position to acts and beats`.

### Task 5: Train motion and the ticket cascade

**Files:**

- Create: `src/lib/story/motion.ts`, `src/lib/story/motion.test.ts`

**Interfaces:**

- Produces:
  - `TWEEN = { minS: 0.9, maxS: 3.0, sPerUnit: 0.16 } as const`
  - `ANNOUNCE_DELAY_S = 0.6`, `TICKET_GAP_S = 0.5`
  - `interface Travel { from: number; to: number; start: number; duration: number }`
  - `tweenDuration(distanceUnits: number, reducedMotion: boolean): number`
  - `travelU(t: Travel, nowS: number): number`, eased with `easeInOutCubic`
  - `retarget(t: Travel, nowS: number, toU: number, lineLength: number, reducedMotion: boolean): Travel`, which starts from `travelU(t, nowS)`
  - `arrivalS(t: Travel): number`
  - `type TicketPhase = "waiting" | "running" | "done"`
  - `ticketPhase(index: number, sinceArrivalS: number | null, fromLater: boolean): TicketPhase` (`null` means not arrived)
  - `announced(sinceArrivalS: number | null, fromLater: boolean): boolean`

- [ ] **Step 1: Write the failing tests.**
  - `tweenDuration`:
    - 1 unit → 0.9s, 10 units → 1.6s, 40 units → 3.0s;
    - reduced motion → 0.
  - `retargets from the current position`: halfway through A→B, retargeting to C starts at the current u, not at A or B.
  - `skipped beats fire nothing`: while travelling (`sinceArrivalS === null`), `announced` is false and every ticket is waiting.
  - `cascade`:
    - at 0.59s nothing is announced;
    - at 0.6s it is announced and ticket 0 is running;
    - ticket 1 runs at 1.1s, and ticket 0 is done by then.
  - `entering from a later beat shows every ticket done`.
- [ ] **Step 2:** Run `pnpm vitest run src/lib/story/motion.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `feat(story): time the train and the ticket cascade`.

### Task 6: Camera shots

**Files:**

- Create: `src/lib/story/camera.ts`, `src/lib/story/camera.test.ts`

**Interfaces:**

- Consumes: `LayoutMode`, `STATIONS`.
- Produces:
  - `CAMERA: Readonly<Record<LayoutMode, { fov: 30; dist: number; elev: number; shiftFrac: number; lookY: number; overview: { look: readonly [number, number, number]; dist: number; elev: number } }>>`
  - `type Vec3 = readonly [number, number, number]`
  - `shotFor(subject: Vec3 | "overview", layout: LayoutMode, aspect: number): { position: Vec3; lookAt: Vec3 }`
  - `subjectFor(shot: ShotId, station: StationId): Vec3 | "overview"`:
    - `station` → the station, 0.7 up;
    - `depot` → `DEPOT`;
    - `feeders` → midway between wp-settings and the feeder lines' start;
    - `platform` → the init platform's centre, as in round 5 (`INIT.x + 0.8, 0.7, 0.4`);
    - `overview` → `"overview"`.
- Start from round 5's constants (`index.html` around line 384) and its rig math (`rig()` / `shotFor()`, lines 944–960). Retune `overview` so the longer line fits.

- [ ] **Step 1: Write the failing tests.** Project with a real `PerspectiveCamera` (three runs in Node) at the aspects 390/844, 820/1180, 1180/820, 1440/900 and 1920/1080.
  - Desktop: the subject's NDC x is in [0.30, 0.42] and |y| < 0.25.
  - Stacked: the subject's NDC y is in [0.15, 0.7] and |x| < 0.15.
  - `overview fits the whole line`: every station's NDC is within [−0.95, 0.95] in every layout.
  - `subjectFor` returns the depot for `depot` and `"overview"` for `overview`, and lifts station subjects 0.7 units up.
- [ ] **Step 2:** Run `pnpm vitest run src/lib/story/camera.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement and tune the constants until the tests pass.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `feat(story): frame each beat's subject per layout`.

### Task 7: Story facts from WordPress data

**Files:**

- Create: `src/lib/story/facts.ts`, `src/lib/story/facts.test.ts`, `src/lib/story/data.ts`

**Interfaces:**

- Consumes: `Listener`, `normalizeListeners` and `priorityValue` from `src/lib/wp-data/trace.ts`; `isDemoName` from `scenarios.ts`; `readIndex`, `readMeta` and `readTrace` from `files.ts`; `Origin` from `route.ts`.
- Produces:
  - `interface Ticket { callback: string; priority: Priority; origin: Origin; demo: boolean; file: string | null }`
  - `initTickets(listeners: ReadonlyArray<Listener>, max?: number /* 8 */): { shown: Ticket[]; hidden: number; all: Ticket[] }`
  - `firedOrder(trace: TraceFile, names: ReadonlyArray<string>): string[]`
  - `hookSource(trace: TraceFile, name: string): { type: "action" | "filter"; file: string; line: number } | undefined`
  - `sourceUrl(wpRelease: string, file: string, line?: number): string`, giving `https://github.com/WordPress/WordPress/blob/<release>/<file>#L<line>`
  - `docsUrl(kind: "hooks" | "functions", name: string): string`, giving `https://developer.wordpress.org/reference/<kind>/<lowercased>/`
  - `interface StoryData { version: string; wp: string; request: { method: string; path: string }; status: number; tickets: ReturnType<typeof initTickets>; bootAnnouncements: string[]; sources: Readonly<Record<string, { file: string; line: number; url: string }>> }`
  - `getStoryData(): Promise<StoryData>` (`data.ts`, `import "server-only"`, `"use cache"`)
- **Ticket rules:**
  - Listeners with origin `php` or `tooling` are dropped.
  - `shown` keeps every non-core listener (demo plugin, theme, mu), then fills up to `max` with the core listeners that run first.
  - Run order is preserved.
- `bootAnnouncements` is `firedOrder` of `muplugins_loaded`, `plugins_loaded`, `setup_theme` and `after_setup_theme`. The trace is `block-single`.

- [ ] **Step 1: Write the failing tests.** Use a fixture of 12 listeners (core at 0, 1, 5, 10…, a `hooked_demo_*` plugin listener at 10, a theme listener at 10 and a tooling listener).
  - `shown` has 8 tickets in run order, with the plugin and theme tickets included and tooling dropped.
  - `hidden` equals the remaining core count.
  - `sourceUrl("7.1.5", "wp-settings.php", 779)` and `docsUrl("hooks", "WP_Loaded")` give the exact strings.
  - `firedOrder` follows `firstIndex`.
  - On the real 7.1 `block-single` trace, `hookSource(trace, "init")` is an action in `wp-settings.php`.
- [ ] **Step 2:** Run `pnpm vitest run src/lib/story/facts.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `facts.ts`, then `data.ts`. Read the Next `"use cache"` docs first.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `feat(story): pick Chapter 1's facts from the WordPress data`.

### Task 8: Hover-card explainers and placement

**Files:**

- Create: `src/lib/story/explainers.ts`, `src/lib/story/explainers.test.ts`, `src/lib/story/placement.ts`, `src/lib/story/placement.test.ts`, `content/explainers.json` (an empty `{"explainers": []}` for now; Task 12 fills it)

**Interfaces:**

- Produces:
  - `explainerSchema` (zod): `{ name: string; kind: "hook" | "function" | "file" | "concept"; summary: string (min 20); example?: string; demo?: boolean }`
  - `loadExplainers(json: unknown): ReadonlyMap<string, Explainer>`, which throws on a duplicate name or a schema error
  - `docsLink(e: Explainer): string | null`: hook → `docsUrl("hooks")`, function → `docsUrl("functions")`, otherwise `null`
  - `interface Rect { x: number; y: number; w: number; h: number }`
  - `placeCard(anchor: Rect, card: { w: number; h: number }, viewport: { w: number; h: number }, avoid: ReadonlyArray<Rect>): { x: number; y: number } | null`
- **Placement rules:**
  - Try below-right, below-left, above-right, then above-left of the anchor, with a 12px gap.
  - Keep 16px inside the viewport.
  - Return `null` if every spot overlaps an `avoid` rect.

- [ ] **Step 1: Write the failing tests.**
  - The schema rejects a summary that's too short and an unknown kind.
  - A duplicate name throws.
  - `docsLink` gives the right URL for each kind.
  - `placeCard`:
    - picks below-right when it fits;
    - flips at the right and bottom edges;
    - returns `null` when the copy column covers every option.
- [ ] **Step 2:** Run `pnpm vitest run src/lib/story/explainers.test.ts src/lib/story/placement.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `feat(story): add hover-card explainers and placement`.

### Task 9: The static metro map (scene part 1)

**Files:**

- Modify: `src/components/three/MetroStage.tsx`
- Create: `src/components/three/palette.ts`, `src/components/three/Effects.tsx`, `src/components/three/map/MetroMap.tsx`, `src/components/three/map/labels.ts`, `src/components/three/map/Depot.tsx`

**Interfaces:**

- Consumes: `STATIONS`, `FEEDER_LINES`, `MAIN_LINE`, `DEPOT`, `ORIGIN_COLOURS`, `storyStore` (`actId`, `beat`, `layout`) and the chapter's `focus` for the current beat.
- Produces:
  - `<MetroMap focus={ReadonlyArray<FocusId>} />`
  - `labelTexture(title: string, sub: string, opts): CanvasTexture` (2× resolution)
  - `PALETTES: Record<"day" | "dusk", ...>`, chosen by `prefers-color-scheme`
- **Port from round 5:**
  - `buildScene()`: lines, pill station markers (blue outline on the current stop), tilted labels (`TILT = 0.6`), the depot vault, `applyPalette()` and `toneCompensated()`.
  - The `EffectComposer`: MSAA ×4, `RenderPass`, `GTAOPass`, `UnrealBloomPass` (Dusk only, threshold 0.93) and `OutputPass`.
- **Rendering:** keep `frameloop="demand"`, and `invalidate()` on store changes.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Run `pnpm dev`, open `http://127.0.0.1:3000/`, and check:
  - the whole line shows in overview at 1440×900 and 390×844;
  - labels are crisp, with no jagged edges and no flicker;
  - the Dusk palette applies under a dark colour scheme.
  - Compare against `explorations/design-round-5/screenshots/d-hero.png`.
- [ ] **Step 3:** Run `pnpm typecheck && pnpm lint`. Expected: clean.
- [ ] **Step 4:** Run `/verify`, then commit `feat(scene): render the full metro map in the app`.

### Task 10: Train, camera, tickets and picking (scene part 2)

**Files:**

- Create: `src/components/three/Train.tsx`, `src/components/three/CameraRig.tsx`, `src/components/three/map/InitPlatform.tsx`, `src/components/three/usePicking.ts`
- Modify: `src/components/three/MetroStage.tsx`, `src/components/three/StageMount.tsx`

**Interfaces:**

- Consumes:
  - `retarget`, `travelU`, `arrivalS`, `ticketPhase` and `announced` (Task 5);
  - `shotFor` (Task 6);
  - `nearestParam` and `stationById` (Task 2);
  - `StoryData.tickets.shown` (Task 7);
  - `storyStore`.
- Produces:
  - `TrainScreen`: a small vanilla store `{ x: number; y: number; visible: boolean }`, updated every frame with the train's projected screen position, for `TrainPill`.
  - `data-train="travelling" | "arrived"` and `data-beat="<act>/<beat>"` on the stage container, for E2E.
  - `storyStore.hover(name)` and `storyStore.pin(name)` from picking: raycast on pointer move or tap over stations, tickets and the depot.
  - **Two-way hover linking:** when `storyStore.hovered` names a map object, that object is highlighted (station outline, ticket lift). `DepartureBoard` and `<Hook>` highlight their own matches from the same field.
- **Port from round 5:**
  - `placeTrain` (two cars, glazing, windscreen, headlights).
  - The ticket pass meshes and flip animation, coloured by origin, with a ✓ badge when done.
  - Camera damping, with a hard cut under reduced motion.
- **Render loop:** request frames only while travelling, while the camera is damping or during the cascade.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** In `pnpm dev`, step through beats with temporary store calls from the console, or after Task 11 by scrolling. Check:
  - the train eases between stations;
  - a fast change retargets smoothly;
  - init tickets take turns 0.5s apart;
  - going back resets them.
- [ ] **Step 3:** Run `pnpm typecheck && pnpm lint`. Expected: clean.
- [ ] **Step 4:** Run `/verify`, then commit `feat(scene): run the train, the camera and the init tickets`.

### Task 11: The story DOM

**Files:**

- Create: `src/components/story/Story.tsx` (server), `Act.tsx`, `StoryController.tsx` (client), `ProgressRail.tsx` (client), `DepartureBoard.tsx` (client), `TrainPill.tsx` (client), `HookCard.tsx` (client), `Hook.tsx` (inline code word)
- Modify: `src/app/globals.css`

**Interfaces:**

- Consumes: `ChapterSpec`, `flattenBeats`, `positionAt`, `snapTarget`, `stepTarget`, `actHeightVh`, `layoutMode`, `storyStore`, `StoryData`, `loadExplainers`, `placeCard`, `TrainScreen`.
- Produces:
  - `<Story spec={ChapterSpec} copy={Readonly<Record<string, ReactNode>>} data={StoryData} explainers={...} />`
  - `<Hook name="init" />`, which renders `<code data-card="init" tabindex="0">`
- **Pins and copy:**
  - Each act is a `<section id={act.id}>` with `height: calc(actHeightVh(n) * 1svh)`, plus a `position: sticky` 100svh pin.
  - The beats are an `<ol>`. The active beat is in `--text`/`--text-2` and the others in `--muted`. Stacked layouts show only the active beat.
  - Copy fades only while pinned, and is hidden in breathers.
- **Controller:**
  - Measures on load and on width changes (or any resize on fine pointers), converts scroll to `storyStore.goTo`, and snaps after 160ms idle.
  - Keys: ↓/↑/Space/PageUp/PageDown step through beats, unless focus is in a form control, `summary`, `button`, `a` or `[contenteditable]`.
  - `?snap=off` disables snapping.
- **Rail:** `ProgressRail` lists every beat's `rail` label as a button that scrolls to `beatScrollY`.
- **Boards and cards:**
  - `DepartureBoard` shows `bootAnnouncements` in the boot act, and the init tickets with their phases in the init act. It sits bottom-right on desktop and inside the sheet on stacked layouts.
  - `HookCard`:
    - opens on hover or focus;
    - pins on click or tap;
    - closes on Esc;
    - shows the origin chip as text;
    - shows "Made up for this demo. Not in core." for demo items;
    - links "Official docs ↗" when `docsLink` isn't null;
    - is placed with `placeCard`, avoiding the copy, boards and header.

- [ ] **Step 1:** Implement, with a placeholder two-act spec, so the DOM can be checked before Task 12's copy exists.
- [ ] **Step 2:** In `pnpm dev`, check:
  - scrolling pins each act, steps the beats and snaps;
  - the keys step;
  - rail clicks jump;
  - only one copy block is visible at a time;
  - cards open, pin and stay off the copy.
  - Check at 1440×900 and 390×844.
- [ ] **Step 3:** Run `pnpm typecheck && pnpm lint && pnpm test`. Expected: clean.
- [ ] **Step 4:** Run `/verify`, then commit `feat(story): pin acts, step beats and show boards and cards`.

### Task 12: Chapter 1 content

**Files:**

- Create: `src/content/chapter-1/spec.ts`, `src/content/chapter-1/copy.tsx`, `src/content/chapter-1/chapter.test.ts`
- Modify: `content/explainers.json`, `src/app/page.tsx` (render `<Story>` with Chapter 1; the hero `<h1>` stays the LCP element)

**Interfaces:**

- Consumes: everything above.
- Produces: `CHAPTER_1: ChapterSpec` and `CHAPTER_1_COPY: Record<beatId, ReactNode>`. Each act also gets an "Under the hood" `<details>`, generated from `StoryData`: hooks in fired order, each with `file:line` linked through `sourceUrl`.
- **The outline (fixed; the writer chooses the words):**

  1. **`hero`** (1 beat). Station `browser`; shot overview; focus: station names only.
  2. **`before`**, "Stop 0 · Before WordPress" (5 beats):

     | Beat       | Station | Shot     | What it says                                                                                                                                                                              |
     | ---------- | ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
     | `address`  | browser | station  | You type an address. The browser turns it into a request; the pill shows `GET /hello-world/` from data                                                                                    |
     | `server`   | server  | station  | The request travels the internet to a web server: an always-on computer running software like nginx or Apache. `/hello-world/` isn't a file there; a rewrite rule sends it to `index.php` |
     | `php`      | php     | station  | PHP runs the code. WordPress builds the page fresh on every visit (unless a cache answers first)                                                                                          |
     | `database` | php     | depot    | Posts, settings and users live in a database, the depot                                                                                                                                   |
     | `response` | php     | overview | The finished HTML goes back and your browser draws it. "The part in the middle is WordPress. Let's ride it."                                                                              |

  3. **`boot`**, "Boarding · index.php to wp-settings.php" (4 beats):

     | Beat       | Station  | Shot    | Board         | What it says                                                                                                                                                         |
     | ---------- | -------- | ------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
     | `index`    | index    | station |               | `index.php` is tiny: it sets `WP_USE_THEMES` and loads `wp-blog-header.php`                                                                                          |
     | `config`   | config   | station |               | `wp-blog-header.php` loads `wp-load.php`, which finds `wp-config.php` (its own folder or one up): database credentials and settings                                  |
     | `settings` | settings | station |               | `wp-settings.php` loads the hook system first (`plugin.php`, `class-wp-hook.php`), then the drop-ins                                                                 |
     | `feeders`  | settings | feeders | announcements | mu-plugins, then `muplugins_loaded`; plugins, then `plugins_loaded`; `setup_theme`; the theme's `functions.php` (child first, then parent), then `after_setup_theme` |

  4. **`init`**, "The announcement · init" (4 beats):

     | Beat       | Station | Shot     | Board | Pill | What it says                                                                                                                            |
     | ---------- | ------- | -------- | ----- | ---- | --------------------------------------------------------------------------------------------------------------------------------------- |
     | `arrive`   | init    | platform |       |      | `$wp->init()` has set up the current user, so plugins and the theme are loaded and WordPress knows who's visiting                       |
     | `announce` | init    | platform | init  | init | "Think of a town-hall bell": `do_action( 'init' )` calls everyone who signed up with `add_action`                                       |
     | `tickets`  | init    | platform | init  |      | Each ticket number is the priority. Lowest goes first, and with the same number the first in line goes first. Actions hand nothing back |
     | `loaded`   | init    | platform |       |      | `wp_loaded`: everything is loaded                                                                                                       |

  5. **`next`** (1 beat). Station `init`; shot overview. "Next stop: finding your post", a teaser for `WP::main()`, the depot, the junction and the filter workshop (Phase 5b).

- [ ] **Step 1: Write the failing test** (`chapter.test.ts`):
  - `validateChapter(CHAPTER_1, hookExists)` returns `[]`, with `hookExists` built from the real 7.1 catalog.
  - Every beat id has copy.
  - Every name a card can show has an explainer: stations, `StoryData.tickets.shown`, `bootAnnouncements` and every `<Hook>` in the copy, found by rendering the copy to a string and collecting `data-card`.
  - Every `sources` entry used in "Under the hood" resolves.
- [ ] **Step 2:** Run `pnpm vitest run src/content`. Expected: FAIL.
- [ ] **Step 3:** Write the spec, the copy and the explainers (concise summaries, 1–2 sentences, for beginners).
- [ ] **Step 4:** Run `pnpm vitest run src/content`. Expected: PASS.
- [ ] **Step 5:** Run `/verify`, then commit `feat(content): write Chapter 1, from your browser to init`.

### Task 13: Fallbacks, accessibility and E2E

**Files:**

- Create: `tests/e2e/story.spec.ts`, `tests/e2e/fallbacks.spec.ts`
- Modify: `tests/e2e/smoke.spec.ts` if the hero assertions move, and `StageMount.tsx` (the copy-only layout when WebGL is missing or the context is lost)

**Interfaces:**

- Consumes: `data-beat` and `data-train` on the stage container; `#<act>` anchors.

- [ ] **Step 1: Write the tests.**
  - **`one copy block at a time`:** at 1440×900 and 390×844, sample every 2% of the page height and expect at most one visible `[data-beat]` copy block.
  - **`keys reach the last beat`:** from the top, press ArrowDown once per beat. Expect `data-beat` to be `next/0` and the rail's last item to be current.
  - **`space on a focused summary toggles it`:** focus an act's "Under the hood" summary and press Space. Expect it open and the beat unchanged.
  - **`keeps the beat across a resize`:** go to `init/2`, resize 390×844 → 844×390, and expect `init/2`.
  - **`restores the beat after reload`:** go to `boot/1`, reload, and expect `boot/1`, with `data-train="arrived"` within 500ms.
  - **`deep link starts at the act`:** open `/#init` and expect `init/0`.
  - **`reduced motion jumps`:** emulate `reducedMotion: "reduce"`, step one beat, and expect `data-train="arrived"` within 100ms.
  - **`no WebGL`:** launch Chromium with `--disable-webgl --disable-3d-apis`. Expect no `canvas`, readable copy and no console errors.
  - **`axe`:** no violations at the top or at `init/2`.
  - **`screenshots`:** capture every act at 390×844, 820×1180, 1180×820, 1440×900 and 1920×1080 into `test-results/` (not asserted).
- [ ] **Step 2:** Run `pnpm test:e2e`. Expected: PASS. Fix the app, not the test, unless the test is wrong.
- [ ] **Step 3:** Commit `test(e2e): cover the story, its fallbacks and accessibility`.

### Task 14: Accuracy review, visual review, budgets and the PR

**Files:**

- Create: `docs/story-engine.md`
- Modify: `README.md` (doc link), `CONTRIBUTING.md` ("add an act or beat")

- [ ] **Step 1: Accuracy review.** Dispatch a fresh reviewer agent with:
  - the rendered chapter text (from `pnpm build && pnpm start`, or Playwright `innerText` per beat);
  - the WordPress 7.1.5 core files the claims touch (`index.php`, `wp-blog-header.php`, `wp-load.php`, `wp-settings.php`, `wp-includes/class-wp.php`), fetched and md5-checked like `tools/hook-engine/generate.ts` does.

  Do **not** give it the author's reasoning. Fix or cut every disputed claim.

- [ ] **Step 2: Visual review.** In Chrome at 390×844 and 1440×900, compare against `explorations/design-round-5/screenshots/` and check the design-system rules (backdrops, focus mode, contrast).
- [ ] **Step 3: Budgets.** Run `pnpm build`, then record the gzip sizes of the `/` route JS and the 3D chunk against 180 KB and 350 KB. Run Lighthouse in mobile mode on `pnpm start`; record LCP (≤ 2.0s), CLS (≤ 0.05) and confirm the LCP element is the hero `<h1>`.
- [ ] **Step 4:** Write `docs/story-engine.md`: the data flow (spec → controller → store → scene/boards), how to add an act or beat, and the debugging tips (`?snap=off`).
- [ ] **Step 5:** Run `/verify`, commit `docs(story): explain the story engine`, push with `-u`, and open the PR with the summary, the budget numbers and a test plan.
