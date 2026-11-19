> Project design record, approved 2026-11-18 and updated through design round 5. The locked visual system lives in docs/design-system.md.

# Plan: "Hooked", an interactive 3D explainer for WordPress core internals, set in a metro-line world

## Context

WordPress internals (the request lifecycle, hooks and filters) are hard to learn. The official developer docs have the information, but they are flat reference pages. The user was inspired by Apple product pages, igloo.inc, estheet, maxveilleux, Netlify's 5M-devs site and codeofsagar. They want an educational site that explains WordPress core with scroll-driven 3D storytelling, click-to-expand detail, hover reveals, gamification and developer easter eggs. It must also load fast and score near-perfect on SEO and Core Web Vitals.

The audience is beginners and working developers. The user has no design experience and wants help with planning, design and implementation. At the start, the project folder was empty and not yet a git repository, Node was v20.10.0 and Blender was not installed.

## Decisions made with the user

| Topic               | Decision                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Experience          | Apple-style **scroll story** plus a hands-on **Hook Lab**. A NASA-Eyes-style explorable map is v2.                                                                                                     |
| v1 scope            | Front-end request; Hooks deep dive **including authoring custom hooks and filters**; other entry points (admin, REST, AJAX, cron); block rendering                                                     |
| World               | **Metro line** (chosen in the concept round). The request is a train and hooks are stations. Rendered as a sleek porcelain tabletop transit map, Apple-clean. It replaced the earlier marble-run idea. |
| Audience baseline   | **Complete beginners first** ("touching WP/web-dev for the first time"), with real WordPress names on every sign and code in the developer layer                                                       |
| Chapter 0           | **Stop 0: Before WordPress** covers browser, URL, request, server, PHP, database and response, before any WordPress                                                                                    |
| Stack               | **Next.js + React Three Fiber + GSAP**. The user chose this over my Astro recommendation; the performance mitigations are below.                                                                       |
| Next design step    | **Browser mockups** (throwaway) to lock the design before building                                                                                                                                     |
| Blender             | Decided with evidence in the mockup round (procedural vs baked prop, side by side)                                                                                                                     |
| Version flexibility | New WP releases should need **zero or minimal code changes**. Facts are generated per version; prose is written (see the version-data section).                                                        |
| 3D vs versions      | **Hybrid**: hand-crafted set pieces, plus a data-driven track kit inside them                                                                                                                          |
| Theme path          | **Switchable** at the render stage: Block path (default) or Classic path, both traced                                                                                                                  |
| Writing             | **Claude writes everything and verifies it.** An independent reviewer agent checks every claim against core source; the user spot-checks.                                                              |
| Project type        | **Open source, GPL-2.0-or-later**: public GitHub repo, deployed on Vercel Hobby (non-commercial)                                                                                                       |

**Calls I made (for the user to check):**

- **`/reference` scope:** every featured hook (roughly 150–250) gets its own page for the latest version. All ~2,500 core hooks for every kept version go in a lazy-loaded search index that links to developer.wordpress.org. This avoids thousands of thin duplicate pages.
- **RC data:** release-candidate data is generated but kept behind a preview flag until the release is stable.
- **Tooling:** pnpm, ESLint + Prettier, zustand.

## Approaches considered

**Site framework:**

- **Next.js (chosen by the user)**. Benefits: one React world and a persistent 3D canvas across routes. Cost: it ships the React runtime on every page, mitigated by server-rendered text, a lazy 3D chunk and strict budgets.
- Astro + React islands. Leanest pages, but two component models.
- Astro + vanilla Three.js. Smallest bundles, but slow design iteration.

**3D assets:**

- **Procedural geometry in code (default)**. Rounded boxes, tubes along curves, lathe-turned bells and instanced spheres. Fast iteration and zero asset weight.
- **Blender-baked hero props (if they win the comparison)**. Ambient occlusion and soft light baked into textures give the Apple studio look and make runtime cheaper.

Rejected:

- Apple's actual technique (pre-rendered image sequences): no interactivity and heavy assets.
- Spline: a heavy runtime that is hard to drive from data.

## Design system: "Porcelain Machine"

> Values below are **starting proposals**. The mockup round finalizes them into `docs/design-system.md`.

**Art direction (design round 4, the approved reference):** an extruded transit map on a seamless background.

- The line is an extruded flat-topped ribbon with rounded ends.
- The hero shows only station-name typography. Each stop shows only its own labels; the rest hide (focus mode).
- No signposts, no stock primitives (capsule people, torus rings, tube lines).
- The train is sleek: a continuous glass band, a light strip and headlights.

**Prop vocabulary (Metro line).** Exactly one prop per concept, used in every chapter. No one-off props. Anything new is proposed as part of the system and shown on the concept board first.

| WordPress concept                                          | Prop                                                                                                                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The request                                                | **a train**. A pill above it shows its current cargo: `GET /hello-world/`, then values, then `200 OK`                                                                           |
| Core files and stages (index.php, wp-config, wp-settings…) | **stations**: white pill markers with an ink outline (the current hook's station is outlined in blue). Names are **printed on the map** as tilted typography, with no signposts |
| Action hook                                                | **a station announcement** (copy analogy: a town-hall bell, "init is happening now!") with speaker waves                                                                        |
| Callbacks on an action                                     | **ticket passes queued on the platform**. Dark while waiting; on its turn a pass lifts and flips to its origin colour with a check badge                                        |
| Priority                                                   | **the number printed on each ticket pass**, big and high-contrast; queue order runs left to right. Same number? First in line goes first                                        |
| Filter hook                                                | **a workshop of portals**: porcelain arches with a glowing inner rim in the callback's origin colour, one per callback. The cargo changes as the train passes through           |
| Run log / value log                                        | **the departure board** (listeners: ticket, name, from, status) and **the cargo manifest** (value after each station, with the change highlighted)                              |
| Database                                                   | **the depot**: a porcelain data vault with light slits, on a spur off WP_Query                                                                                                  |
| Template hierarchy                                         | **a junction**: signals send the train to the first platform (template file) that exists                                                                                        |
| Entry points                                               | **other lines** (front-end, admin, REST, AJAX, cron) merging into the shared trunk wp-load → wp-settings                                                                        |
| Plugins / theme / mu-plugins / drop-ins                    | **feeder lines** that join at wp-settings, colored by origin                                                                                                                    |
| Blocks                                                     | **the train's carriages**; nested blocks are carriages coupled inside carriages                                                                                                 |
| The response                                               | **the train arriving back at "your browser"** (`200 OK`); `shutdown` is the depot lights going off                                                                              |
| Origin colors                                              | core = periwinkle `#8FA8FF`, plugin = lilac, theme = mint, mu-plugin = butter, drop-in = coral. The main line is WP blue                                                        |

**Lighting narrative**: the story starts in daylight on Apple's light gray (the browser and the visitor). It goes into a misty dusk (wp-settings) and then a dark core (the DB vault and query). It comes back to light when HTML is delivered and `shutdown` fires. This takes codeofsagar's day/night idea and turns it into the story's progress.

**Typography** (all free and self-hosted with `next/font`, no layout shift):

| Role         | Font                                                                                                      | Reference   |
| ------------ | --------------------------------------------------------------------------------------------------------- | ----------- |
| Display/UI   | Inter Display or Geist (the mockups decide), with huge, tight headlines                                   | Apple       |
| Accent       | Instrument Serif _italic_ for emphasis words                                                              | estheet     |
| Code         | JetBrains Mono                                                                                            |             |
| HUD labels   | Departure Mono (pixel monospace), used for callouts like `HOOK init · ACTION · P10 · wp-settings.php:807` | igloo       |
| Margin notes | Caveat (handwritten), for "senior-dev margin notes" with hand-drawn arrows                                | codeofsagar |

**Color tokens (proposal)**:

- Light: bg `#F5F5F7`, text `#1D1D1F`, muted `#6E6E73`.
- Dark: bg `#0A0A0C`, text `#F5F5F7`, muted `#86868B`.
- Accent: WordPress blue `#3858E9`.
- Groove pastels: lilac `#C9B3F5`, mint `#9FE0C8`, butter `#F3DC8C`, coral `#F4A99A`.
- Gradient headline text (peach → lilac → blue) used sparingly, like the MacBook Pro page.

**Layout and interaction catalog** (validated in design round 2, `hooked/explorations/design-round-2/`):

- **Pinned acts with beats** (user feedback: "scroll should be sticky/anchored").
  - Each act is a tall section with a `position: sticky` 100svh pin.
  - Copy fades in and out _while pinned_, so it never scrolls half off-screen. Two copy blocks are never visible together; this is verified by an automated sample at every 2% of the scroll.
  - Each act is split into **beats**: numbered steps where the active one is highlighted and the others are dimmed. On phones, only the active beat shows.
  - The marble timeline is piecewise per act, keyed to beats. Between acts there is a short scene-only "breather".
  - Scrolling settles on the nearest beat after an idle period (it can be toggled off). Arrow keys, PageUp/PageDown and Space step through beats. The rail lists every beat and is clickable.
- **The camera frames each act's subject** (bell, tubes…), not the marble. Shots are blended by timeline weights and the marble enters the frame. Never follow the marble blindly ("bell where?").
- **Run log and value log**: a terminal-style panel that makes each scene legible.
  - Actions show `✓ P0 create_initial_post_types` ticking off in priority order.
  - Filters show each callback's output, with the changed characters highlighted.
  - The logs float bottom-right on desktop and sit inside the copy sheet on phones.
- **Callback state uses color**: grey while waiting, origin color once run (scroll-driven, so it reverses when scrolling back). Core is **periwinkle `#8FA8FF`**, not white, because white-on-white was invisible in Porcelain Day.
- **Hover/tap cards** on every 3D object, log row, code word in the copy (`data-hook`) and HUD callout.
  - Each card has: name, kind, origin chip, priority, the hook it's on, a plain-English "what it does", an example (`isn't → isn’t`), and an **"Official docs ↗" link to developer.wordpress.org**. Demo items say "Made up for this demo. Not in core".
  - Click or tap pins a card so the link can be clicked; Esc closes it.
  - Cards, callouts and tags are kept inside the viewport and hidden when they would cover the copy, the logs or the header.
- Copy follows Apple's pattern: a bold lead-in, then a muted continuation.
- Apple and igloo leader-line callouts from 3D parts to HUD labels (positioned with drei `Html`).
- "Under the hood" expanders: code, the hooks fired in order, and core source permalinks.
- Global **Beginner / Developer** depth toggle.
- Two-way hover linking between hook names in the text and props in 3D.
- estheet-style tick-mark progress rail labelled with stage names.
- maxveilleux-style hero: a giant glossy inflated 3D title that reacts to the cursor.
- Pill buttons like Apple's and maxveilleux's.
- Optional subtle sound (marble click, bell chime, glass whoosh). **Off by default** and lazy-loaded.

**Developer easter eggs** (each one tied to what the site teaches):

- The site's own UI runs on **`@wordpress/hooks`** (the real WP JS hooks package, ~3 KB). It is exposed as `window.wp.hooks`, so `wp.hooks.addFilter('hooked.heroTitle', 'me', t => t.toUpperCase())` in the console changes the headline live. The console greets devs with ASCII art explaining this.
- A footer like a WordPress theme's: `<n> hooks fired · 0 queries · 0.21s`, using honest counts from the site's own hooks.
- The Konami code turns on **`WP_DEBUG` mode**, a Query-Monitor-style overlay listing every hook the site fires as you scroll.
- The 404 page shows the template-hierarchy cascade that ended in `404.php`.
- The theme toggle "fires" `switch_theme` with a toast.
- `/` opens hook search and `?` shows shortcuts.
- An ASCII comment in view-source.

**Working name (proposal)**: "Hooked: how WordPress really works". Don't put "WordPress" in the domain (Foundation trademark policy) and don't use the WP logo as a centerpiece.

## Content, accuracy and version flexibility

**The rule: facts are generated and stories are written.** Everything that changes between WordPress versions is **generated data**: hook names, signatures, docs, `@since`, file and line numbers, firing order, and default callbacks with their priorities. Written prose never hardcodes those facts; it references hooks by name and gets the details from the data for the selected version. A new WP release should therefore need **zero code changes**. It produces a data-only PR, and prose is edited only where automated tests flag drift.

**Generated per version** (`content/versions/<x.y>/`), by `tools/wp-data/` (one command: `pnpm wp-data <version>`):

1. **Static hook catalog**: `actions.json`, `filters.json` with docs, params, `@since` and deprecations.
   - Source: the existing, maintained **`@wp-hooks/wordpress-core`** npm package (currently covers 7.1).
   - For releases it doesn't cover yet (RCs, trunk), run its generator **`wp-hooks-generator`** ourselves against `roots/wordpress-full:<version>`. This reuses a proven tool instead of writing our own PHP parser.
2. **Runtime truth** from the **WordPress Playground CLI** with `--wp=<version>` (no local PHP or MySQL).
   - A tracer mu-plugin hooks `all` and records, for each request type (front-end, admin, REST, AJAX, cron), the **firing order**, **action vs filter** and the **file:line** of each call (from the backtrace).
   - At `shutdown` it dumps `$wp_filter` for the hooks we feature, giving **default callbacks and priorities**. Nothing is read by hand from default-filters.php.
   - Output: `trace-<request>.json` and `defaults.json`.
3. **Source anchors**: stories point at code by a text anchor, e.g. `<Src file="wp-settings.php" anchor="do_action( 'init' )" />`, not by line number. The tool resolves each anchor to a line at that version's tag, which gives stable GitHub permalinks that survive line shifts.
4. **Diff**: `changes.json` compares this version with the previous one: new, removed or deprecated hooks, signature changes, order changes and default-priority changes. This powers an auto-generated **"What changed in hooks in x.y"** page, which is also good SEO content.

**Trace scenarios** (they define what counts as "true", so they live as Playground blueprints in `tools/wp-data/scenarios/`):

- **Base install:** WP x.y with pretty permalinks and the front page set to latest posts. It includes a small demo **mu-plugin**, a demo **plugin** and a no-op **advanced-cache.php** drop-in with `WP_CACHE` enabled, so the mu-plugin, plugin and drop-in stages actually appear in the trace.
- **`block`:** Twenty Twenty-Five, the default story path.
- **`classic`:** Twenty Twenty-One as the parent theme with a demo child theme, so the "child first, then parent" step is real.
- **Requests traced in both themes:** `/hello-world/` (single post, the main story), `/`, a page, a category, `?s=` search and a 404. These feed the interactive coin sorter.
- **Requests traced once:** `/wp-admin/`, `/wp-json/wp/v2/posts`, an `admin-ajax.php` action and `wp-cron.php`.

**Version manifest**: `content/versions/index.json` lists the generated versions, which one is latest stable, and which ones are kept. Default: the latest stable plus the 4 previous majors.

- **Story chapters**: always render for the latest stable version. Steps that only exist in some versions carry `since`/`until` in their frontmatter. For example, `handle_random()` gets one new stage file with `since: 7.2`, and the story shows or hides it automatically.
- **Reference and changelog pages**: one per kept version, statically generated at `/reference/[version]` and `/changes/[version]`. Latest is canonical; older versions are indexed with a canonical-to-self tag and a visible version switcher.
- **Lab engine**: semantics that differ by version sit in a small behaviour map keyed by version (e.g. closure id strategy, which uses `spl_object_id` since 7.1). The UI is the same for every version.

**Who writes and how it's verified**:

- Claude writes all copy: the story, margin notes, Lab levels and chapter intros.
- Each **factual claim** in the prose is tied to evidence, either a `<Src anchor>` or a trace or data reference.
- Every chapter phase ends with an **independent accuracy-review agent**. It gets the chapter text and the pinned core source, _not_ the author's reasoning, and checks each claim. Disputed claims are fixed or cut before merge, and the user spot-checks.
- **Beginner/Developer layering is not two full rewrites.** The base text is written for beginners. Developer mode adds generated blocks (signatures, hook lists in order, default callbacks, source links) plus short hand-written notes.

**Authored content**: MDX and YAML validated by zod (Content Collections or Velite; pick at setup).

- Stages: `id, order, chapter, title, hooks[] (names only), anchors[], since?, until?, beginner, developer`, plus an MDX body.
- MDX components (`<Hook name>`, `<Src>`, `<SinceBadge>`) pull everything else from the version data.
- **Explainer catalog** (`content/explainers/*.yaml`), which powers the hover cards:
  - Fields: `name, kind (hook|callback), summary (plain English, written by Claude and accuracy-reviewed), example?, demo?`.
  - **`docsUrl` is derived automatically** as `developer.wordpress.org/reference/{hooks|functions}/{lowercased-name}/`.
  - The official docblock one-liner comes from the generated `@wp-hooks/wordpress-core` data and is shown under the summary as "Core docs say: …".
  - A content test fails if a featured hook or callback has no summary, or if a derived docs URL returns 404 (checked in CI weekly, not on every build).

**Automation** (GitHub Actions):

- A **weekly cron** checks `api.wordpress.org/core/version-check/1.7/`. When there is a new release (or RC), it runs `pnpm wp-data <version>`, commits the generated data on a branch, and **opens a PR** with the diff summary.
- CI on that PR runs the **content-integrity tests**:
  - Every hook a stage references exists in that version.
  - Stage order matches trace order.
  - Every anchor resolves.
  - Removed or deprecated hooks used in the prose are flagged with the exact stage file to update.
- **Green CI means merge and Vercel redeploys with no code touched. Red CI lists exactly which prose needs an edit.**

### Lifecycle outline (verified against core source; stable = 7.1.4, trunk = 7.2-RC1)

Note for later: 7.2 adds `handle_random()` in `WP::main()` and a 503 header in `wp_maintenance()`.

**Front-end request (`/`)**

1. `index.php` defines `WP_USE_THEMES` → `wp-blog-header.php` (guarded by `$wp_did_header`) → `wp-load.php` (sets ABSPATH and finds `wp-config.php` in its own folder or one level up, otherwise runs setup-config) → `wp-config.php` → `wp-settings.php`.
2. Inside `wp-settings.php`, in order:
   - **plugin.php** loads, along with **class-wp-hook.php**.
   - Drop-ins: fatal-error-handler and maintenance, then `enable_loading_advanced_cache_dropin` → **advanced-cache.php**, then **db.php**, then `enable_loading_object_cache_dropin` → **object-cache.php**.
   - **default-filters.php**.
   - Multisite only: sunrise.php and `ms_loaded`.
   - The shutdown function is registered, then the **SHORTINIT exit**.
   - Must-use plugins load (`mu_plugin_loaded` fires for each one), then **`muplugins_loaded`**.
   - Initial post types and taxonomies are registered.
   - Active plugins load (`plugin_loaded` fires for each one), then **pluggable.php**, then **`plugins_loaded`**.
   - **`sanitize_comment_cookies`**.
   - Global objects are created: WP_Query, WP_Rewrite, WP, the widget factory and Roles.
   - **`setup_theme`**, then the locale.
   - Theme functions.php files load, **child first, then parent**, then **`after_setup_theme`**.
   - `$wp->init()` sets up the current user, then **`init`**, then **`wp_loaded`**.
3. `WP::main()`:
   1. `init()`.
   2. `parse_request()`: `do_parse_request` → `query_vars` → `request` → the `parse_request` action. REST requests branch off here.
   3. `query_posts()` runs `WP_Query::get_posts()`: `pre_get_posts` → `posts_search` → `posts_where`/`posts_join` → the clause filters → `posts_clauses` → `posts_request` → `posts_pre_query` → `posts_results` → `the_posts` → `found_posts`.
   4. `handle_404()` (`pre_handle_404`).
   5. `register_globals()`.
   6. **`send_headers()`, after the query**: `wp_headers` → `send_headers`.
   7. The **`wp`** action.
4. `template-loader.php`:
   - **`template_redirect`**.
   - `exit_on_http_head`.
   - The robots, favicon, feed and trackback branches.
   - The template cascade: embed → 404 → search → front_page → home → privacy_policy → post_type_archive → tax → attachment → single → page → singular → category → tag → author → date → archive → index. Each step runs `{$type}_template_hierarchy` → `locate_template` → `locate_block_template` → `{$type}_template`.
   - **`template_include`** → `wp_before_include_template` → the template is included.
5. Rendering:
   - `wp_head`: `wp_enqueue_scripts` at P1, styles print at P8, scripts at P9.
   - The Loop. `the_content` runs autoembed (P8), `do_blocks` (P9), `wptexturize`/`wpautop`/`shortcode_unautop`/`prepend_attachment` (P10), `capital_P_dangit`/`do_shortcode` (P11), `wp_filter_content_tags` (P12) and `convert_smilies` (P20).
   - `wp_footer`: footer scripts at P20, admin bar at P1000.
6. `shutdown` (`wp_ob_end_flush_all` at P1), then `wp_cache_close`.

**Hooks internals (`/hooks` chapter and the Lab engine spec)**

- `$wp_filter[hook]` is a `WP_Hook` object. Its `callbacks` are stored as `[priority][id] = {function, accepted_args}`.
- `add_action` is literally `add_filter`.
- Priorities are sorted with numeric `ksort`, and only when a new priority is added. Callbacks at the same priority run in insertion order. Adding the same id at the same priority again overwrites it.
- `accepted_args`: `0` means no arguments; a smaller number passes a slice of the arguments; for filters, `args[0]` is replaced with the running value.
- Callback ids:
  - A string is its own id.
  - A closure or invokable object uses `spl_object_id` (since 7.1).
  - `[obj, m]` is the object's id plus the method name.
  - `['C', 'm']` becomes `C::m`.
- `remove_filter` needs the same priority, and for closures the same instance.
- The `all` hook runs before every hook, even empty ones.
- `did_action` and `did_filter` count every call. `current_filter` is the top of the stack. `doing_filter` checks the stack.
- Nesting uses `nesting_level` and `iterations[level]`. `resort_active_iterations` runs when callbacks are added or removed while the hook is running.
- JS has its own hooks (`@wordpress/hooks`), which use a namespace-based API. This is a bonus section.

**Entry points (`/entry-points`)**

- Admin: `admin.php` → `auth_redirect` → **`admin_menu` before `admin_init`** → `current_screen` → `load-{page}` → `admin_action_{action}`.
- REST: `init` registers the `rest_route` query var → the `parse_request` action runs `rest_api_loaded` → `rest_api_init` → `serve_request` → `die`. The template loader is never reached.
- AJAX: `admin_init` → `wp_ajax_{action}` or `wp_ajax_nopriv_{action}` → `wp_die('0')`.
- Cron: `DOING_CRON` + the `doing_cron` transient lock → `do_action_ref_array($hook, $args)` for each due event.

**Blocks (`/blocks`)**

- `locate_block_template` → `resolve_block_template` → `template-canvas.php`.
- `get_the_block_template_html()` runs **before `wp_head`**, so blocks enqueue their assets first.
- `do_blocks` removes `wpautop` temporarily.

## Hook Lab (`/lab`): a marble-run builder

- **Engine**: `lib/hook-engine/` is a faithful TypeScript port of the PHP `WP_Hook` semantics above. It is built TDD, with cases mirrored from core's `tests/phpunit/tests/hooks/*`.
- **Build the run**: drag callback "tube" or "bell module" cartridges into priority slots on a hook's track. Cartridges include `ucwords`, `strtoupper`, append text, wrap in `<em>`, "forgot to return" and more. Press **Drop the marble** to watch the value change after each callback. The equivalent PHP (`add_filter( 'the_title', 'ucwords', 20 );`) is generated live.
- **Gamified levels** (Netlify-style), with progress kept per viewer in localStorage:
  1. Uppercase the title.
  2. Run before the theme's callback.
  3. Fix the filter that returns nothing.
  4. Remove the theme's callback (the wrong-priority trap).
  5. accepted_args puzzle.
  6. **Be the plugin author**: add `apply_filters( 'myplugin_price', … )` and let another plugin extend it.
- Only predefined callbacks run, never user code. **v2 stretch**: "verify on real WordPress" via an embedded WordPress Playground.

## Architecture (Next.js)

- **Next.js (current major, 16+), App Router, TypeScript strict, Turbopack.** Every page is statically generated (SSG). Deploy to Vercel.
- **Text renders on the server** (React Server Components), so the copy is in the HTML for SEO and paints first. Client components are limited to the 3D stage, the Lab, the toggles and expanders.
- **Persistent canvas**: a single `<Canvas>` lives in the root layout, loaded with `next/dynamic` and `ssr: false` after the LCP. Pages supply their scenes through drei `<View>`/tunnel. The WebGL context survives route changes, which gives seamless chapter transitions. The pattern is borrowed from `pmndrs/react-three-next`, but that repo was last updated in 2024, so I'll use it only as a reference, not as a base.
- **Hybrid 3D, so versions drive the machine**:
  - **Set pieces** (`components/three/setpieces/`) are hand-crafted, choreographed scenes for each act: Shells, the Settings Tower, the Query Elevator and DB vault, the Coin Sorter, the Render Press and the Shutdown chute.
  - **Track kit** (`components/three/kit/`): inside each set piece, a `<HookTrack>` reads the version data (trace order, default callbacks and priorities, origin) and lays out the pieces automatically. The pieces are a `Bell` for each action, `Tube` segments for each filter callback, `Module`s coloured by origin, and `PrioritySlot` labels.
  - A new or reordered hook in a release shows up in 3D with no code changes, as a standard kit piece. A bespoke prop can replace it later.
  - The camera path for each set piece is defined relative to the track's length, so it stretches when a release adds hooks.
- **State**: zustand, shared by the DOM and the 3D: `activeStage`, `stageProgress`, `hoveredHook`, `depthMode`, `debugMode`.
- **Motion**:
  - GSAP + ScrollTrigger (with `@gsap/react` `useGSAP`) for choreography tied to the 3D.
  - Lenis (`lenis/react`) for smooth scrolling.
  - CSS scroll-driven animations for simple text reveals, which need zero JS.
- **3D**: `three`, `@react-three/fiber` v9, `@react-three/drei`, `@react-three/postprocessing` (selective bloom and grain), soft shadows. A real-time `AccumulativeShadows`/ContactShadows setup tuned for the porcelain look.
- **Code highlighting**: Shiki through rehype-pretty-code at build time.
- **Hook search**: a JSON index generated at build time and lazy-loaded.

```
app/  layout.tsx (fonts, Lenis, persistent Canvas, nav, depth toggle)
      page.tsx (/)  hooks/  lab/  entry-points/  blocks/  reference/  not-found.tsx
      sitemap.ts  robots.ts  opengraph-image.tsx
components/ ui/ (StageCard, ExpandPanel, HudCallout, MarginNote, ProgressRail, CodeBlock)
            three/ (Stage, setpieces/{Shells,SettingsTower,QueryElevator,CoinSorter,RenderPress,Inlets,BlockTree,Shutdown},
                    kit/{HookTrack,Bell,Tube,Module,PrioritySlot,Marble}, camera/, materials/porcelain.ts, effects/, quality/)
            lab/ (HookLab, Cartridge, PriorityTrack, ValueTrace, Levels)
lib/  hook-engine/ (+tests)  scroll/ (+tests)  php-snippet/ (+tests)  store/  site-hooks/ (@wordpress/hooks wiring + easter eggs)
content/  stages/**.mdx  versions/index.json  versions/<x.y>/{actions,filters,defaults,changes,anchors,trace-*}.json
tools/wp-data/  (catalog import or wp-hooks-generator run, Playground tracer mu-plugin + blueprint, anchor resolver, differ)
.github/workflows/  ci.yml  wp-release-watch.yml (weekly cron → data PR)
tools/blender/ (only if baked props win: headless Python scripts → GLB)
docs/  design-system.md  design.md
tests/e2e/
```

## Responsive design (first-class, prototyped in design round 1)

**Layout modes.** The CSS media queries and the JS `layoutMode()` share one definition, so 3D framing and layout never disagree.

| Mode        | Query                         | Layout                                                                                                            |
| ----------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **stacked** | ≤ 760px, or portrait ≤ 1180px | Scene in the top half; copy as a frosted bottom sheet; rail, legend and scrim hidden; the HUD sits under the copy |
| **tablet**  | landscape 761–1180px          | Text column at 44vw; rail without labels; camera shifted less                                                     |
| **desktop** | 1181–1799px                   | Sticky copy on the left with a scrim; machine on the right                                                        |
| **wide**    | ≥ 1800px                      | Capped line length; the machine gets more room                                                                    |

**Camera framing per mode.** Each mode has its own hero position and its own follow distance, look offset and shift (see `CAMERA` in the mockup). Fog distance scales with camera distance, so far framings aren't washed out.

**Typography.** Every size is fluid (`clamp()`). Headlines have a minimum of 38px on phones, and body text never drops below 17px.

**Touch.**

- Anything revealed on hover is revealed on tap; the tooltip stays for about 2.5s.
- Hints switch between "Click/hover" and "Tap" using `(hover: none)`.
- Touch targets are ≥ 44px.
- In the Hook Lab, drag and drop becomes tap-to-select then tap-a-slot.

**Mobile browser chrome.**

- The canvas is sized to `100lvh` and ignores height-only resizes on coarse pointers, so the URL bar showing or hiding doesn't resize the canvas or cause jank.
- Sections use `svh`.
- Safe-area insets are respected.

**HUD.** Labels are hidden whenever they would overlap the active copy block. They flip sides near the viewport edge.

**Performance tier by device.**

- Phones start with AO, bloom and shadows off and DPR ≤ 1.5. PerformanceMonitor can raise quality from there.
- `prefers-reduced-motion` applies on every device.

**Verification.** Playwright visual snapshots of every chapter at **390×844, 820×1180, 1180×820, 1440×900 and 1920×1080**, plus a touch-emulated tap test (tap the bell, then a module tooltip).

## Project location

All work lives in this repository. "hooked" is a working name, easy to rename later. Throwaway design work goes in `hooked/explorations/`, which is excluded from the production build.

## Performance, SEO and Core Web Vitals budgets (enforced in CI)

- **LCP ≤ 2.0s.** The hero text is the LCP element, never the canvas.
- **CLS ≤ 0.05.** The canvas is fixed-position and fonts load with `next/font` size-adjust.
- **INP ≤ 150ms.**
- **Lighthouse:** performance ≥ 90 on mobile and ≥ 95 on desktop; 100 for SEO, accessibility and best practices.
- **JS:** route JS ≤ 180 KB gzip, excluding the 3D chunk. The 3D chunk (three + scene) is ≤ 350 KB gzip and loads after LCP.
- **3D assets** (if any) ≤ 1.5 MB per chapter, compressed with gltf-transform (Meshopt + KTX2).
- **Runtime:** 60fps on desktop and ≥ 30fps on mid-range phones. drei `PerformanceMonitor` drives quality tiers that turn off bloom and shadows and lower the DPR. Rendering pauses when idle or offscreen.
- **SEO:** Metadata API, canonical URLs, `sitemap.ts`/`robots.ts`, OG images from `next/og`, and JSON-LD (`TechArticle`, `BreadcrumbList`). Semantic headings.
- **Accessibility:**
  - The canvas is `aria-hidden` and all meaning lives in the HTML.
  - `prefers-reduced-motion` turns off Lenis and scrubbing and shows static poses.
  - Without WebGL, static posters are shown.
  - The Lab is fully keyboard-operable (dnd-kit keyboard sensor).
  - Contrast meets WCAG AA. Hook type is never shown by color alone: a bell icon marks actions and a tube icon marks filters.

## Code-quality tooling

- **TypeScript:** strict, with `noUncheckedIndexedAccess`.
- **Lint and format:** ESLint flat config (Next, typescript-eslint, react-hooks, jsx-a11y) + Prettier.
- **Tests:**
  - Vitest + Testing Library + coverage-v8: ≥ 80% globally and ≥ 95% for `hook-engine`. 3D scenes are verified visually instead.
  - Playwright for E2E, visual snapshots, and `@axe-core/playwright` accessibility checks.
- **Git hooks and commits:** lefthook (lint and typecheck on commit, tests on push) + commitlint (conventional commits).
- **Budgets and cleanup:** knip for dead code, size-limit for bundle budgets, Lighthouse CI with budgets.
- **CI:** GitHub Actions runs lint → typecheck → unit tests → build → E2E → LHCI.
- **Dev only:** Leva (a live tweak panel, so the user can adjust colors and lighting and send the values back) and r3f-perf.

## Claude-side tools to add (each one confirmed with the user before installing)

- From `freshtechbro/claudedesignskills` (MIT, ~1.4k stars, last updated Nov 2025): **only** the individual `react-three-fiber`, `threejs-webgl` and `gsap-scrolltrigger` plugins. Read their files before installing. Skip the bundles, which add about 30 commands and agents for unrelated engines.
- Anthropic's official **`frontend-design`** plugin.
- **Context7 MCP**, for current docs on Next, R3F, drei, GSAP and Lenis (third-party skills can lag behind the latest APIs).
- **Chrome DevTools MCP**, for performance traces and CWV insights. claude-in-chrome stays in use for visual checks.
- Blender: only if baked props win. Install the current Blender LTS (`brew install --cask blender`) and drive it with headless Python scripts in `tools/blender/` (reproducible and reviewable). Blender MCP is optional.

## Phases (each ends with a demo, code review and passing checks)

0. **Tooling**:
   - The Claude-side tools above (with the user's OK).
   - Node LTS through nvm/fnm (`.nvmrc`).
   - `git init`, then the public GitHub repo with `LICENSE` (GPL-2.0-or-later) and `CONTRIBUTING.md` (how to add a stage, a set piece or a WP version).
1. **Design round (throwaway mockups in the browser)**: two style tiles. **Tile A, Porcelain Day**, uses the Apple gray and pastel props. **Tile B, Dusk Core**, uses misty igloo blue-gray for the dark core. Each has the hero type pairing options, a HUD callout, a margin note and a mini R3F scene in which the marble strikes a bell and then passes through a filter tube. Also a **procedural vs Blender-baked bell, side by side**. Output: locked tokens in `docs/design-system.md`, a Blender yes/no decision, and the design doc copied into `docs/design.md`. An optional beginner Blender walkthrough for the user (modeling the bell) is a side quest, not a dependency.
2. **Project setup**: create-next-app (TS, App Router, Tailwind v4), the 3D and motion libraries, all quality tooling, CI, and the persistent-canvas skeleton.
3. **Version data pipeline**: `tools/wp-data` (catalog, Playground trace, defaults, anchors, diff) for 7.1 plus one older version to prove the diff works; schemas; front-end stage content; integrity tests; the release-watch workflow.
4. **Hook engine (TDD)**.
5. **Flagship `/`**:
   - Set pieces, track kit and choreography: shells → marble → wp-settings floors → bells and tubes → elevator to the DB → coin sorter → **block/classic track switch** → render → shutdown.
   - Expanders, depth toggle, hover linking, progress rail, fallbacks.
   - Copy written, then accuracy-reviewed by an independent agent.
   - Chapters 6–9 each follow the same pattern: build, write, accuracy review, demo.
6. **`/hooks`**: internals and custom hooks.
7. **`/lab`**: marble-run builder and levels.
8. **`/entry-points`**.
9. **`/blocks`**.
10. **`/reference`, easter eggs, optional sound, SEO/OG, performance and accessibility audit, deploy.**

## Verification

- `pnpm test`: hook-engine, scroll mapping, php-snippet, content schemas and integrity, with coverage gates.
- `pnpm test:e2e`:
  - Each chapter loads with no console errors, and scrolling reaches the last stage.
  - The expanders and depth toggle work.
  - In the Lab, adding `ucwords` at P20 changes the output and the generated PHP.
  - Level 4 fails with the wrong priority.
  - The reduced-motion and no-WebGL fallbacks render.
  - axe reports no violations.
- `pnpm lhci` on the production build meets the budgets above. Chrome DevTools MCP traces check LCP, CLS and INP on a throttled mobile profile.
- A visual review in Chrome (claude-in-chrome) at desktop and phone widths after each phase, with screenshots or GIFs shared with the user.
- Version flexibility check:
  - Run `pnpm wp-data 7.0` and `pnpm wp-data 7.1`. Both must build with no code changes, and `/changes/7.1` must list the real 7.0 → 7.1 differences.
  - Run the pipeline against the 7.2 RC. The integrity tests should pass or flag only the `handle_random` story gap.
  - Adding that one `since: 7.2` stage file makes them green.
