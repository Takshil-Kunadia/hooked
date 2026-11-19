# WordPress data pipeline

Hooked never hand-copies facts about WordPress. Everything that can change between releases is generated per version into `content/versions/<x.y>/`. Story text refers to hooks by name and reads the rest from that data.

```bash
pnpm wp-data 7.1        # trace WordPress 7.1 and write content/versions/7.1
pnpm wp-data --changes  # only recompute index.json and every changes.json
```

One run takes a few minutes and needs network access the first time. Nothing has to be installed locally: Playground runs PHP and WordPress itself.

## Two sources, two kinds of fact

| Question                                                                                                             | Source                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Which hooks exist, their parameters, `@since`, descriptions, deprecations                                            | **Catalog:** [`@wp-hooks/wordpress-core`](https://github.com/wp-hooks/wordpress-core-hooks), generated from core's docblocks           |
| The order hooks fire in for a real request, which ones fire at all, how often, who is listening and at what priority | **Trace:** real WordPress running in [WordPress Playground](https://wordpress.github.io/wordpress-playground/), with a tracer attached |

Documentation can't answer the second row: the order depends on runtime control flow (includes, branches, redirects, theme type). Block themes, for example, render the post before `wp_head`, and only running WordPress shows it.

## How a run works (`tools/wp-data/generate.ts`)

1. **Catalog.** The run looks up the `@wp-hooks/wordpress-core` releases on the npm registry and picks the newest one whose readme says "Last updated for WordPress x.y". It checks the tarball against the registry's sha512, validates the JSON with zod and normalises it to `catalog.json`.
2. **Sites.** It starts three throwaway Playground sites (pinned CLI and PHP versions in `tools/wp-data/config.ts`). Their blueprints are built in `tools/wp-data/blueprints.ts`:
   - `block`: the default theme WordPress ships (Twenty Twenty-Five in 7.1).
   - `classic`: a child theme of Twenty Twenty-One 2.9. The parent is downloaded once, checked against a pinned SHA-256 (`tools/wp-data/theme-source.ts`) and mounted, so the site needs no network.
   - `admin`: the block site, with an administrator's auth cookies. WordPress's own `wp_generate_auth_cookie()` mints them inside the throwaway site, so the trace includes the real cookie check.

   Every site also runs small demo fixtures (`tools/wp-data/fixtures/`), so each loading stage is real: a must-use plugin, a plugin with an AJAX action and a cron job, a do-nothing `advanced-cache.php` drop-in and the child theme. Fixture names start with `hooked_` and are labelled "made up for this demo" wherever they appear.

3. **Tracer.** `tools/wp-data/tracer/hooked-tracer.php` is preloaded before WordPress. It pre-seeds `$wp_filter['all']`, so it sees every hook from the very first one. For a request carrying `X-Hooked-Trace: <scenario>` it records:
   - every hook call in order, with action or filter and the file:line that fired it;
   - the listeners on each hook the first time it fired.
4. **Scenarios.** For each request in `src/lib/wp-data/scenarios.ts` the run sends a warm-up request (first visits build caches), then the traced one. A trace is only accepted when two things hold: the response has the scenario's `expectedStatus`, and its `mustFire` hooks fired (proof that the request reached the part of WordPress it is about). Otherwise the run retries twice and then stops, naming the scenario and the redirect target. The run also checks the theme each site actually served.
5. **Output.** Each dump is validated, Playground's own tooling is filtered out (below), and the result is compacted into `traces/<scenario>.json`. Then `meta.json`, `index.json` and every `changes.json` are written.

## Output (`content/versions/`)

```
index.json                  { latest, versions[] } newest first
<x.y>/meta.json             exact WordPress/PHP/Playground/catalog versions used
<x.y>/catalog.json          every core hook: type, file, since, description, params, args, dynamic, deprecated
<x.y>/traces/<id>.json      hooks (first-fired order, count, call site), listeners, full call sequence
<x.y>/changes.json          compared with the previous kept version (absent for the oldest)
```

Files are written one hook per line so a data PR's diff reads like a changelog. The schemas in `src/lib/wp-data/schema.ts` describe each file exactly; `src/lib/wp-data/files.ts` reads and validates them.

## Where Playground differs from a normal site

| Difference                                                                          | How we handle it                                                                                                                                                      |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Playground adds its own must-use plugins and preload files (auto-login, helpers)    | Their listeners are dropped (files outside the WordPress root). Hooks fired only by their code are dropped too.                                                       |
| The database is SQLite through a drop-in driver, not MySQL                          | Core hooks the driver fires (such as `query`) are kept, but with no call site. Their counts can differ from MySQL. A cross-check against a MySQL site is still to do. |
| `WP_HTTP_BLOCK_EXTERNAL`, `DISABLE_WP_CRON` and `AUTOMATIC_UPDATER_DISABLED` are on | Keeps runs repeatable: no update checks or cron spawns. HTTP-related hooks still fire; the requests are just refused.                                                 |
| Pretty permalinks are `/%postname%/`                                                | Gives stable URLs. Dates in URLs would change every run.                                                                                                              |

## Playground surprises (and what the runner does about them)

These cost real debugging time, so they're written down:

- **With a blueprint, `--wp` is ignored.** Playground boots the blueprint's `preferredVersions` (default: latest) and only prints the `--wp` value. Asking for 7.0 silently ran 7.1.5. The blueprint now carries the exact release, which the runner looks up on api.wordpress.org, and every dump must report that same version.
- **It answers HTTP before its blueprint has finished.** Early requests saw the wrong theme, plain permalinks and no admin cookies. The runner waits for Playground's own `Ready! WordPress is running on …` log line.
- **Its very first request after boot is a redirect to the same URL** (it resets its auto-login state). The runner spends that on a throwaway request.
- **`--login` doesn't help a plain HTTP client.** It keeps the session cookies inside Playground's server-side store. The admin site uses WordPress's own minted auth cookies instead.
- **It listens on every network interface,** and there is no option to change that. A run lasts about a minute. The blueprint replaces the well-known admin password with a random one, and the tracer and fixtures are mounted from temporary copies, so nothing on the network can log in or write into this repository.
- **It defaults to six workers.** The runner uses one (`--workers=1`). Requests are sequential anyway, and one PHP runtime keeps runs repeatable.
- **`npx` would float Playground's dependencies.** The runner uses `pnpm dlx` with an exact version, so the project's one-day `minimumReleaseAge` applies to them. Playground's own packages pin each other exactly.

## The integrity tests (`tests/data/versions.test.ts`)

They run with the unit tests and fail when:

- a version is incomplete;
- a hook fired from a core file isn't in the catalog. Dynamic names like `pre_option_blogname` only count when fired from the file the catalog lists for the pattern, because patterns such as `{$option}` would otherwise match anything;
- a lifecycle claim the story makes stops being true. Examples: the front-end order, block vs classic rendering order, child theme before parent, REST leaving before the template loader, `admin_menu` before `admin_init`.

A failing claim names the scenario and the hook. That tells you which story text needs an edit for the new version.

## Adding a WordPress version

1. `pnpm wp-data <x.y>`. If the catalog package doesn't cover that version yet (release candidates, trunk), the run stops and says so. Generating the catalog with [wp-hooks-generator](https://github.com/wp-hooks/generator) for those is a planned follow-up.
2. `pnpm test`. Fix the story text the integrity tests point at, or update a claim if WordPress genuinely changed.
3. Commit the data on a `data/wp-<x.y>` branch and open a PR.

Bumping the Playground CLI or PHP version in `tools/wp-data/config.ts` can shift the traces, so regenerate every kept version after a bump.
