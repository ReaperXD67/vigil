# Vigil web

React + TypeScript + Vite interface for the Vigil Python API. Includes the cinematic landing page, isolated demo entry, sign-in/registration, service checks, a dependency map with potential blast radius analysis, incident timelines and Markdown postmortems, task board, activity, JSON export, command search (`Ctrl/Cmd+K`), and public status pages with copyable README status badges.

On a public status page, **Copy badge** provides linked Markdown for a repository or documentation. A selectable text field works when clipboard access is unavailable. Badges aggregate only opted-in services and label sample or stale data explicitly; image proxies may delay refreshes.

## Run

Start the API on `127.0.0.1:8000` following [backend instructions](../backend/README.md), then:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` to the backend. Cookie authentication requires same-origin requests; do not point the browser directly at a separate API domain.

```sh
npm test
npm run build
```

The production image builds static assets, serves them as non-root Nginx on port 8080, and proxies `/api` to `backend:8000`. The Helm chart supplies its Kubernetes service configuration.

If an open browser encounters a missing route asset after an update, or a route fails while rendering, an accessible recovery screen offers **Reload page** and **Back home**. Both load a fresh document so a failed lazy import can recover. Recovery is manual, avoids reload loops, and never displays error internals. Unsaved edits on the failed page may need to be re-entered. This boundary requires the initial app bundle to load; it cannot recover a failed initial HTML or JavaScript download.

## Dependency map

Open **Dependencies** in the workspace (`/app/topology`). Add an upstream service and the service that depends on it; arrows run in the direction of potential impact. Select a service to highlight direct and indirect dependents, their current health, and active incident severity. The map counts each reachable service once and uses the shortest dependency path for hop labels.

Connections are private, persist through the API, and appear in workspace JSON exports. Add/remove dialogs handle server validation, including cycle rejection. Removing a service removes its connections. New demos include a labeled sample chain; existing workspaces begin with no declared connections. This is dependency analysis, not automatic discovery, measured failure propagation, or root-cause attribution.

The map uses native keyboard-focusable buttons, an accessible connection list, and a scrollable diagram that stays within narrow screens. Pure graph tests cover directionality, diamonds, duplicate paths, malformed cycles, disconnected services, and stable layout. API-client tests verify session cookies, authentication/validation/gateway errors, and create/edit/delete request handling.

## Interaction and accessibility

The original particle sculpture uses raw WebGL with 10,400 desktop points, 7,200 on mobile, and a smaller compact variant. A Canvas2D fallback preserves the interaction when WebGL is unavailable. Click the sculpture or use Spiral/Cube/Tree/Orbit controls to morph; drag to rotate, or focus the canvas and use Enter/Space and arrow keys. Pause stops continuous motion. Geometry tests cover shape generation and camera fitting across rotation, aspect ratio, and morph overshoot.

The landing page's **incident rehearsal** includes database, authentication, and queue scenarios. Playback and the time slider explore simulated impact; node selection exposes details. Copy link preserves the scenario and time in the URL, and Markdown export includes events reached so far. These are local educational scenarios, not live monitoring or automatic diagnoses.

Dialogs use Radix focus management; task movement uses a keyboard-accessible status selector. The layout adapts to phones, and reduced-motion preferences disable continuous visual motion and smooth scrolling. Animation and rehearsal clocks suspend when hidden or offscreen. Geist fonts are self-hosted. Operational sample data is labeled explicitly. The sculpture is original decorative geometry, not live telemetry. Lenis and GSAP provide the landing page's scroll behavior; the particle effect adds no rendering-library dependency.

Design sources and implementation decisions are recorded in [DESIGN.md](../DESIGN.md). No paid template assets are included.
