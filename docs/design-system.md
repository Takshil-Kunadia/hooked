# Hooked design system

Locked from design round 5 (`explorations/design-round-5/`). This file is the source of truth: change a value here first, then in `src/styles/tokens.css` and the 3D scene constants.

## 1. The world: a metro line

WordPress is a metro line, and one page visit is one train journey. Every chapter uses this world. **One prop per idea, used everywhere.** If an idea has no prop yet, add it here (and to the concept board) before building it. Never add a one-off prop for a single scene.

| WordPress idea                          | Prop                                                         | Notes                                                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| the request                             | **the train**                                                | Two sleek porcelain cars with a continuous glass band, slim window pillars, a dark windscreen and twin headlights. Its cargo shows in a pill above it. |
| core files and stages                   | **stations**                                                 | White pill markers with an ink outline. The current hook's station is outlined in blue.                                                                |
| station names                           | **typography printed on the map**                            | Tilted 0.6 rad toward the camera. No signposts.                                                                                                        |
| action hook                             | **a station announcement**                                   | Copy analogy: "a town-hall bell". The announcement row appears on the departure board, with ripples on the map.                                        |
| callbacks on an action                  | **ticket passes on the platform**                            | Dark while waiting. On its turn a pass lifts, flips to its origin colour and gains a ✓ badge.                                                          |
| priority                                | **the ticket number**                                        | Big and high-contrast. Lowest goes first; with the same number, the first in line goes first.                                                          |
| filter hook                             | **a workshop of portals**                                    | One porcelain arch per callback, with a glowing inner rim in its origin colour. The cargo changes as the train passes through.                         |
| logs                                    | **departure board** (actions) / **cargo manifest** (filters) | Dark transit boards in both tiles.                                                                                                                     |
| plugins / theme / mu-plugins / drop-ins | **feeder lines** joining at wp-settings                      | Coloured by origin.                                                                                                                                    |
| database                                | **the depot**                                                | A porcelain data vault with blue light slits, on a spur off WP_Query.                                                                                  |
| template hierarchy                      | **a junction**                                               | Signals send the train to the first platform (template file) that exists.                                                                              |
| entry points                            | **other lines** merging into the trunk                       | Front-end, admin, REST, AJAX, cron.                                                                                                                    |
| blocks                                  | **carriages**                                                | Nested blocks are carriages coupled inside carriages.                                                                                                  |
| the response                            | **arriving back at "your browser"**                          | `200 OK`.                                                                                                                                              |

## 2. Colour

| Token                        | Porcelain Day                     | Dusk Core | Use                                                                      |
| ---------------------------- | --------------------------------- | --------- | ------------------------------------------------------------------------ |
| `--bg`                       | `#F5F5F7`                         | `#0E1117` | page and 3D background (the canvas is tone-compensated to match exactly) |
| `--text`                     | `#1D1D1F`                         | `#F5F5F7` | headlines, active copy                                                   |
| `--text-2`                   | `#3A3A3C`                         | `#C9CCD3` | active body copy                                                         |
| `--muted`                    | `#6E6E73`                         | `#8F949D` | inactive steps, captions (≥ 4.5:1 on `--bg`)                             |
| `--accent`                   | `#3858E9`                         | `#8AA4FF` | WP blue: main line, links, active step badge                             |
| `--core`                     | `#8FA8FF`                         | same      | origin: core                                                             |
| `--plugin`                   | `#B79CF2`                         | same      | origin: plugin                                                           |
| `--theme`                    | `#7FD8B9`                         | same      | origin: theme                                                            |
| `--mu`                       | `#F0CF6A`                         | same      | origin: mu-plugin                                                        |
| `--dropin`                   | `#F29A88`                         | same      | origin: drop-in                                                          |
| `--board` / `--led` / `--ok` | `#121419` / `#FFD36B` / `#7FD8A0` | same      | transit boards                                                           |

Rules:

- Never show meaning by colour alone. Origins always carry a text chip, and actions and filters carry an icon or label.
- Never put text over the 3D without a backdrop. On desktop the copy column sits on an opaque scrim; on phones it sits on a frosted sheet.
- Inactive copy uses `--muted` with no opacity tricks.

## 3. Typography

| Role         | Face                                  | Notes                                                               |
| ------------ | ------------------------------------- | ------------------------------------------------------------------- |
| Display / UI | **Inter** (optical size axis)         | Headlines `clamp(38px, 6.2vw, 98px)`, weight 700, tracking −0.038em |
| Accent       | **Instrument Serif italic**           | One emphasis word per headline, filled with the accent gradient     |
| Code         | **JetBrains Mono**                    | Inline code chips, boards, the train pill                           |
| HUD          | **Departure Mono** (self-hosted, MIT) | Kickers, board headings, map sub-labels                             |
| Margin notes | **Caveat**                            | "Senior-dev notes", one per step at most                            |

Body copy is never under 17px. Copy follows Apple's pattern: a **bold lead-in**, then the rest in the body colour.

## 4. 3D art direction

- An extruded transit map on a seamless background. Shadows only, no visible floor.
- **Lines:** a rounded-top bar profile swept along the path, with lathe-turned end caps (`src/lib/geometry/transit.ts`).
- **Materials:** porcelain `#F1EFEA` (Day) and `#D7DCE5` (Dusk), physical with clearcoat. Signs and labels are unlit and not tone-mapped, so text stays exact.
- **Quality:** MSAA ×4 on the post-processing target, because post-processing drops the browser's anti-aliasing. Text textures are 2× resolution. Coplanar surfaces never overlap.
- **Focus mode:** the hero shows station names only. Each stop shows only its own labels, and every other label is hidden, not just dimmed.
- **Bloom:** Dusk only, with a threshold of about 0.93 so white signs never glow.

## 5. Motion and story

- **Pinned acts with beats.** Copy fades only while pinned and never scrolls half off-screen. At most one copy block is visible at a time; an automated test checks this.
- **Anchored beats.** Every beat has a resting pose. Arriving at a beat tweens the train there (ease-in-out-cubic, 0.9–3s depending on distance), then the beat's event plays: an announcement, then each ticket's turn about 0.5s apart.
- **Snap:** scrolling settles on the nearest beat after 160ms idle. ↓/↑/Space/PageUp/PageDown step through beats, and the rail is clickable.
- **Camera:** each beat frames its subject. The subject sits about 36% right of centre on desktop and in the top half on stacked layouts. A safety lift keeps map labels clear of floating boards.
- `prefers-reduced-motion`: no tweens or smoothing; poses jump and the camera cuts.

## 6. Layout modes

| Mode    | Query                         | Layout                                                                             |
| ------- | ----------------------------- | ---------------------------------------------------------------------------------- |
| stacked | ≤ 760px, or portrait ≤ 1180px | Scene on top; copy and board in a frosted bottom sheet; only the active beat shows |
| tablet  | landscape 761–1180px          | Copy at 42vw; rail without labels                                                  |
| desktop | 1181–1799px                   | Copy left on a scrim; scene right; board bottom-right                              |
| wide    | ≥ 1800px                      | Copy capped at 580px                                                               |

The canvas uses `100lvh` and ignores height-only resizes on touch devices, so URL-bar collapse causes no jank.

## 7. HUD and cards

- **Hover/tap cards** for every map object, board row and code word: name, kind, origin chip, ticket, the hook it's on, a plain-English summary, an example and an "Official docs ↗" link (`developer.wordpress.org/reference/{hooks|functions}/{name}/`).
- **No HUD element may cover:** the copy, a board, the header or a visible map label. Pills step around labels; announcements live on boards.

## 8. Voice

- Written for someone touching WordPress or web development for the first time. Real WordPress names stay visible on every sign for developers.
- Analogies are labelled as analogies ("Think of a town-hall bell"). Every factual claim is checked against core source before publishing.
