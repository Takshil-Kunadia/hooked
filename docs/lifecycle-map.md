# The lifecycle map (`/map`)

The map shows every hook one recorded request fired as a stop on one metro line, in the order each hook first fired. The story on `/` explains a request in words; the map shows all of it at once.

## Data flow

```
content/versions/<x.y>/traces/<request>.json      the recorded request (tools/wp-data)
content/versions/<x.y>/catalog.json               every documented hook
        │
        ▼
src/lib/lifecycle/data.ts        reads the latest version (server only, cached)
src/lib/lifecycle/model.ts       buildLifecycle(): stops, stages, docs, layout
        │                         ├─ stages.ts        where each stage starts
        │                         ├─ catalog-match.ts option_siteurl → option_{$option}
        │                         └─ layout.ts        the snaking line
        ▼
src/app/map/page.tsx             /map (the single blog post)
src/app/map/[request]/page.tsx   /map/<request>, one per recorded request
        │
        ▼
src/components/lifecycle/MapPage.tsx       title, request picker, timetable (plain HTML)
src/components/lifecycle/LifecycleApp.tsx  the 3D stage and the HTML laid over it
```

Nothing about a hook is typed by hand. Its name, type, call site, call count and listeners come from the trace. Its description and docs link come from the catalog.

## Stages

A stage starts where a marker hook first fires, or just after it. For example, `init` starts with `init`, and `WP::main()` starts just after `wp_loaded`. Every request shares the first two stages and `shutdown`. What happens after `wp_loaded` depends on the entry point, which `entryKind()` reads from the request's path:

| Entry point    | Stages after `wp_loaded`                                     |
| -------------- | ------------------------------------------------------------ |
| front end      | `WP::main()`, choosing the template, rendering the page      |
| REST API       | `WP::main()`, the REST API (from `rest_api_init`)            |
| admin          | admin.php, drawing the screen (from `admin_head`)            |
| admin-ajax.php | admin-ajax.php, the AJAX action (from the first `wp_ajax_*`) |
| wp-cron.php    | wp-cron.php                                                  |

A stage whose marker never fired is left out. Each stage carries a mood, so the lighting follows the journey: 0 is day, 0.25 mist, 0.5 dusk, 1 the dark core.

To add a request, add a scenario to `src/lib/wp-data/scenarios.ts` and regenerate the data. Its map page appears without code changes. To change the stages for an entry point, edit `AFTER_LOADING` in `stages.ts`; the tests in `lifecycle.test.ts` check every recorded request.

## The 3D stage

- **Stops** are three instanced meshes: filter portals, and action markers as a rim and a face. Each is one draw call, and colours are repainted straight from the store.
- **Names** are a pool of HTML labels over the canvas (`LabelLayer`). They show once the rows are far enough apart on screen to fit one, and longer names are shortened to fit.
- **The camera** uses three's `MapControls`. Flights (`flyTo`) and the ride's follow mode steer it, and dragging the map stops the follow.
- **Portrait screens** get the same request relaid in narrow rows (`relayout`).

## Debugging

- The store is `lifecycleStore` in `src/lib/lifecycle/store.ts`. `select(i)` picks stop `i`, and `toggleRide(n)` starts the train.
- If a page in `next dev` throws "X is not a function" after you add exports to a `"use cache"` module, restart the dev server.
