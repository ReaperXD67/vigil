# Vigil web

React + TypeScript + Vite interface for the Vigil Python API. Includes the cinematic landing page, isolated demo entry, sign-in/registration, service checks, incident timelines and Markdown postmortems, task board, activity, JSON export, command search (`Ctrl/Cmd+K`), and public status pages.

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

## Interaction and accessibility

Dialogs use Radix focus management; task movement uses a keyboard-accessible status selector. The layout adapts to phones, and reduced-motion preferences disable continuous visual motion and smooth scrolling. Geist fonts are self-hosted. Operational sample data is labeled explicitly. The constellation is original decorative geometry, not live telemetry.

Design sources and implementation decisions are recorded in [DESIGN.md](../DESIGN.md). No paid template assets are included.
