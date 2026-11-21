# The story engine

How the scroll story works, and how to add to it. It covers Chapter 1 today, but nothing in `src/lib/story/` or `src/components/story/` is specific to it: a chapter is a spec, its copy, and the data it quotes.

## Data flow

```
src/content/chapter-1/spec.ts    acts and beats: station, camera shot, focus, board, pill, cue, hooks
src/content/chapter-1/copy.tsx   the words, by beat id
content/versions/<latest>/       generated WordPress data (docs/data-pipeline.md)
content/explainers.json          hover-card notes for every name the story shows
        |
        v   src/app/page.tsx  (server)
  getStoryData()  ->  <Story spec copy data explainers>
        |
        |  renders the pinned acts as plain HTML, then mounts these client islands:
        v
  StoryController   measures the pins, maps scroll to (act, beat), snaps, handles keys
        |
        v   storyStore.goTo(actId, beat, globalIndex, now)
  storyStore (zustand: src/lib/story/store.ts)
        |
        +--> 3D scene (src/components/three/): Train, CameraRig, the init platform
        +--> DOM: ProgressRail, DepartureBoard, TrainPill, HookCard
```

**Facts come from the data, never from copy.** `getStoryData()` (`src/lib/story/data.ts`, server-only, cached) reads the latest version in `content/versions/` and returns the request, the status, the listeners on `init` (the tickets), the boot announcements in the order they fired, and the file and line where core fires each hook. Copy is a function of that data (`BeatCopy` in `src/lib/story/beat-copy.ts`), so the request path or a status code is interpolated, not typed. `chapter.test.ts` fails if copy contains numbers or listener names.

**The spec is plain data.** `ChapterSpec` (`src/lib/story/chapter.ts`) is a list of `ActSpec`s, each a list of `BeatSpec`s. The first act (`hero`) is the page's hero: `page.tsx` renders it around the `<h1>` so it paints first, and `Story` renders every act after it.

**The controller owns scroll.** Each act is a pinned section, `actHeightVh(beats)` tall (100 + 70 per beat), followed by a 40vh breather where the scene plays without copy. `StoryController` measures the pins with `measureStory`, then `positionAt` (`src/lib/story/scroll.ts`) turns `scrollY` into an act, a beat and an `inBreather` flag. It writes copy visibility (`--vis`) and the active beat straight to the DOM, and reports the position to the store. `src/lib/story/pins.ts` holds the pure logic for snapping, key steps and `#act` links; the controller only reads the DOM and calls it.

**The store is the single source of story state:** `actId`, `beat`, `globalIndex`, `fromLater` (the last move went backwards), `enteredAt`, `layout`, `reducedMotion`, and the hovered and pinned card names. Pointer hovers, from the copy, the boards and the 3D map, go through `pointerHover` (`src/lib/story/hover-intent.ts`): a card stays open while the pointer is on its anchor or on the card, waits out a grace period that grows with the gap between them, and Esc dismisses it. Whichever card is open (`linkedCard` in `linked.ts`), its prop on the map, its board row and every copy word showing it highlight together: rows and words carry `data-linked`. The train's own screen position, arrival time and whether it is on the map (`ready`) are in a second store, `trainScreen` (`src/lib/story/train-screen.ts`), written by `Train.tsx`.

**The scene reads the store, not the DOM.** `MetroStage` renders on demand and requests a frame on any store change. `Train` travels to the current beat's station (`motion.ts`), `CameraRig` moves to the beat's `shot` (`camera.ts`), and the init platform reads `cues.ts` to know when the announcement rings and when the tickets take their turns. The departure board reads the same functions, so the 3D scene and the DOM cannot disagree.

## Add a beat

Add a `beat({...})` entry to an act's `beats` in `src/content/chapter-1/spec.ts`. The helper defaults `focus` to the beat's own station and `hooks` to none.

| Field     | What it does                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------------- |
| `id`      | Unique within the act. Also the key into the copy map.                                                |
| `rail`    | Label on the progress rail. At most 24 characters (tested).                                           |
| `station` | Where the train stops (`StationId`, from `src/lib/metro/route.ts`).                                   |
| `shot`    | Camera framing: `overview`, `station`, `web` (all of Stop 0), `depot`, `feeders` or `platform`.       |
| `focus`   | Map labels shown in focus mode: station ids, plus `feeders` and `depot`.                              |
| `board`   | Shows a departure board in the act: `announcements` or `init`.                                        |
| `pill`    | Text on the train's pill: `request`, `init` or `response`, built from the data (`pill.ts`).           |
| `cue`     | `announce` rings the station announcement; `cascade` is where the tickets take turns. One of each.    |
| `hooks`   | Hooks this beat talks about. Each must exist in the catalog, and each gets a row in "Under the hood". |

Then:

1. **Write the copy.** Add `CHAPTER_1_COPY[<beat id>]` in `copy.tsx`: a bold lead-in, then short sentences, at most 230 characters of text. Use `<Hook name="..." />` for any real WordPress name. If it quotes a fact, take it from the `StoryData` argument.
2. **Add an explainer for every card name.** Each `<Hook name>` in copy, each station's `card`, each ticket callback, each boot announcement and each hook in "Under the hood" needs an entry in `content/explainers.json` (`name`, `kind`, a one- or two-sentence `summary`, optionally `example`; `demo: true` for anything made up for this demo; `docs: false` where developer.wordpress.org has no page). `loadExplainers` validates the file with zod and throws on a duplicate name.
3. **Update the outline** in `chapter.test.ts` ("follows the outline"), which pins every beat's act, station, shot, board, pill and cue.

What catches mistakes:

- `validateChapter` (run by `chapter.test.ts` against the real hook catalog): duplicate act or beat ids, an empty act, a hook that isn't in the catalog, and a train that moves back along the line (stations must not go in reverse order).
- `chapter.test.ts`: copy for every beat and none for anything else, a bold lead-in, no typed numbers or listener names, the request and status taken from the data, beats under the length limit, hook words that are real hooks and listed on their beat, a source for every hook, and explainers that cover every card name _and_ are all used (an orphan explainer fails).
- `hoodRows` throws at build time if an act names a hook with no source in the data.

## Add an act

Add an `ActSpec` to `CHAPTER_1.acts` with a unique `id`, a `kicker` (the small line above the title), a `title` and at least one beat. Order matters: stations must not go backwards across the whole chapter, not just within the act.

You do not register the act anywhere else. `Story` renders `<section id={act.id}>` for it, so `#<act id>` works as a deep link, and the controller measures it by id. Add its beats' copy and explainers as above. An act that names hooks gets an "Under the hood" list automatically. An act with a `board` beat gets a departure board.

A new station or camera shot is a bigger change: stations live in `src/lib/metro/route.ts` (and need a `card` explainer), shots in `src/lib/story/camera.ts` plus `ShotId` in `chapter.ts`. Build new scenery from the existing prop vocabulary in `docs/design-system.md`.

## Reduced motion, and no WebGL

**Reduced motion.** `syncReducedMotion` (`src/lib/story/reduced-motion.ts`) copies `prefers-reduced-motion` into the store as soon as the controller mounts, before the 3D stage loads. With it set, snapping is off, key and rail scrolling jump instead of gliding, and the train and camera cut to their targets.

**No WebGL.** `StageMount` checks `isWebGLAvailable()`. If it fails, if the stage throws (`StageErrorBoundary`), or if the context is lost, it renders `CopyOnly` instead of the canvas. Until the browser has been asked (on the server and during hydration) it renders neither (`stageMode` in `src/lib/webgl/support.ts`), so `CopyOnly` never marks the train arrived on a page that has a real one. The story still scrolls, snaps and steps; the DOM boards still play, because `followBeatArrival` (`copy-only.ts`) treats the train as arriving the moment each beat is entered.

## Scroll behaviour

These are covered by `tests/e2e/story.spec.ts`.

- **Reload and deep link.** A reload or back/forward visit keeps the browser's restored scroll position. A fresh visit to `#init` jumps to that act's first beat. Either way the right beat is set before the 3D stage loads.
- **Resize.** The controller re-measures when the width changes (any resize on a fine pointer; on touch only a width change, so the mobile URL bar doesn't trigger it), then scrolls back to the same beat.
- **Fast scroll.** The train retargets to wherever the store says it should be, and snapping waits 160 ms after the last scroll event. A smooth scroll of our own is dropped when the reader uses the wheel or touches the screen, and snapping never fires while a finger or the scrollbar is held.
- **Backwards.** Scrolling up sets `fromLater`; the init platform and board use it to show the later state at once instead of replaying the cue.
- **Focus and screen readers.** Every act's copy stays in the accessibility tree and in Tab order. Copy that isn't on screen (another act, or a beat a stacked sheet hides) is clipped out of sight with `sr-only`, never `display: none` or `visibility: hidden`. When focus lands in it, the controller scrolls to that beat (`focusTarget` in `pins.ts`; instantly under reduced motion), and a focused word's card opens once its beat is on screen.
- **Keyboard.** Down, Up, Space, PageUp and PageDown step one beat, and quick presses keep stepping mid-scroll. Space is left to a focused button, link or `<summary>` (so it still toggles one), and every key to text entry (`focusOwnsKey` in `keys.ts`); the arrows and page keys step from anywhere else, a focused rail button included.

## Debugging

- **`?snap=off`** turns off scroll snapping, so you can sit between beats and inspect the copy fade and the camera.
- **`data-beat` and `data-train`** are written on the fixed stage container (`StageMount`, `[data-stage]`) straight from the stores, once the 3D train is on the map (`stageData` in `train-screen.ts`): `data-beat="<act>/<beat>"` (for example `init/2`) and `data-train="travelling" | "arrived"`. Inspect them to see what the engine thinks, or wait on them in a test: a test that waits on them always sees the real train.
- **`pnpm build && pnpm test:e2e`** runs the Playwright suite against a production build: the story at several viewports, keys, resize, reload, deep link, reduced motion, accessibility, and the no-WebGL and lost-context fallbacks (`tests/e2e/fallbacks.spec.ts`).
- **Unit tests first.** Most of the engine is pure and tested next to its module in `src/lib/story/`. A scroll or camera bug usually reproduces there with plain numbers.
