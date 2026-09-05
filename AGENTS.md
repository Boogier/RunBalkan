# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this is

This is **Run-Balkan** (https://run-balkan.com), a web map of running events in the Balkans. It is a customized fork of the open-source **nakarte** map application (the npm `name` in package.json is still `nakarte`). The bulk of the codebase is upstream nakarte; the Balkan-specific behavior is a thin layer on top — keep that distinction in mind when changing code, since most files mirror upstream.

The core custom feature: tracks are not loaded from local files but fetched from a backend by **map viewport bounds** with a level-of-detail **tolerance**, and re-fetched as the user pans/zooms. See "Balkan track loading" below.

## Commands

```cmd
npm install                       # install deps (CI uses `yarnpkg` to install, then npm for scripts)
cp src/secrets.js.template src/secrets.js   # required once before any build/run
npm start                         # dev server at localhost:8080 (NODE_ENV=development)
npm run build                     # production build to build/ (build.cmd just sets NODE_ENV=production first)
npm run lint                      # lint:code (eslint) + lint:style (stylelint) — must pass; CI runs these
npm test                          # Karma + Mocha + Chai, single run in ChromeHeadless
npm run testdev                   # Karma in watch mode (ChromeHeadless)
```

Run a single test file by narrowing Karma's glob:

```cmd
npx cross-env NODE_ENV=testing karma start --single-run --browsers ChromeHeadless test/karma.conf.js --glob ./test/test_track_load.js
```

`secrets.js` is git-ignored and **must exist** (even as the dummy template copy) or builds fail — `src/config.js` imports it directly.

## Architecture

### Entry flow
`src/index.js` (reads `uid` cookie, sets up preconnects, logs `RELEASE_VER`) → `App.setUp()` in `src/App.js`. `setUp()` is the single wiring point: it instantiates the map and every Leaflet control, binds hash-state, and starts Balkan track loading. To add or remove a control, edit `App.js`.

### Leaflet extension pattern (do not break this)
Everything is built as Leaflet extensions, **never ES6 classes** for Leaflet objects. Use `L.Control.extend({...})` / mixins and `includes: L.Mixin.Events`. Modules live in `src/lib/` as self-contained directories named `leaflet.control.*` / `leaflet.layer.*` etc., each with an `index.js` entry point. Plain helper libs (binary-stream, cache, CORSProxy…) also live under `src/lib/`.

### Import alias
Import from `src/` via the `~/` alias (configured in `webpack/webpack.config.js` → `resolve.alias`), e.g. `import config from '~/config'`. ESLint's import resolver is webpack-aware.

### State: two systems
1. **URL hash state** (`src/lib/leaflet.hashState/`) — components implement `L.Mixin.HashState` with `serializeState()`, `unserializeState()`, `validateState()`, `stateChangeEvents`, then call `.enableHashState('<key>')`. Each control owns a short key (`m`=map view, `l`=layers, `nf`=track name filter, `p`=print, `j`=jnx, etc.). `validateState()` must reject bad input (`{valid: false}`) to avoid corrupting the hash. `src/queryToHash.js` migrates legacy `?query` params into the hash on load.
2. **Knockout observables** — UI reactivity inside controls (`ko.observable`, `ko.observableArray`, `.subscribe(...)`).

### Layers
Declared in `src/layers.js` as objects: `{title, description, isDefault, layer: L.tileLayer(url, {code, shortName, print, jnx, scaleDependent, isOverlay, ...})}`. `code` is the keyboard hotkey; `print`/`jnx` opt the layer into print and JNX export.

### Configuration & secrets
`src/config.js` holds all backend URLs and merges in `secrets.js`. Many endpoints still point at upstream nakarte infrastructure (`*.nakarte.me`); the Balkan backend is `balkanServerUrl` — `https://iorient.ru/runbalkan/` in production, `/runbalkan/` in dev (the dev server proxies `/runbalkan` to a local IIS Express on `:55971`, configured in `webpack.config.js` → `devServer.proxy`).

### Balkan track loading (the main custom feature)
Lives in `src/lib/leaflet.control.track-list/track-list.js` (methods `reloadBalkanTracks`, `loadBalkanTracks`, `updateBalkanTrack`, `loadBalkanPhotos`). `App.js` calls it on startup and on every `moveend`/`zoomend` (debounced 500ms), guarded by an incrementing `balkanTracksLoadId` so only the latest load completes (`needToComplete()` callback). Behavior:
- Fetches `config.balkanTracksUrl` (`GetTracks.aspx?wkt=1`) with `rect` (current bounds bbox), `tolerance` (LOD, from `getTolerance()`), `colors`, and `exclude` (ids of already-loaded tracks at ≤ current tolerance). Skips the fetch when the current view is already contained in `currentBounds` at adequate tolerance.
- Existing tracks are refined in place via `updateTrackSegments` (replaces polylines, keeps the track) when a finer tolerance arrives; new tracks are added via `addTrackFromBalkanData`.
- Photos load asynchronously and batched: new track ids are queued in `photosToLoad` and flushed through `loadBalkanPhotosPromise` to `config.balkanPhotosUrl` (`GetPhotos.aspx?trackIds=...`).
- Backend track JSON uses PascalCase fields (`Id`, `Photos`, `TrackId`); internal nakarte track objects use the `{name, tracks, points, color, ...}` shape.

The track **name filter** (`nameFilter` observable, hash key `nf`) and `showTooltipForFilteredTrack()` are also Balkan additions in this file.

### Build script
`scripts/build.js` (run by `npm run build`) computes `RELEASE_VER` from git (`<date>-<branch>-<commit>[-dirty]`), injects it via webpack `DefinePlugin`, runs webpack, and prints gzipped asset sizes with diffs vs. the previous build. `NODE_ENV` must be one of `production|development|testing` or webpack aborts. `public/` is copied verbatim into `build/` (static pages: about.html, donate.html, robots.txt, web.config).

## Conventions

- **Commits**: reference a single GitHub issue as `#123` in the first line (upstream nakarte convention; this fork is less strict but keep commits focused).
- **ESLint** is modular under `eslint_rules/`: `base.js` + `imports.js` are the baseline; `relax_*.js` and `imports_relax_*.js` loosen rules for legacy, vendored, protobuf, and test files; `legacy_files_list.js` lists files exempt from prettier/strict rules. New `src/` code is held to the full prettier + import ruleset — don't add files to the legacy list to dodge lint.
- **Encoding/coords**: geodata is UTF-8 (`utf8.encode()` before embedding in XML). For features crossing the 180° meridian use the wrap helpers in `~/lib/leaflet.fixes`.
- **Vendored code** lives under `src/vendored/` and is intentionally exempt from most lint rules — don't reformat it.
