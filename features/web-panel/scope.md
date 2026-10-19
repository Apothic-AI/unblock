---
id: scope
product: web-panel
owner: unblock-lead
status: live
covers: ["page:scope.html"]
paths: ["web/src/**", "web/scope.html", "web/package.json", "web/vite.config.ts"]
proofs:
  - {"id": "scope-pinned-thread-in-browser", "kind": "journey", "cmd": "scripts/test-identity/plan --json --journey scope-pinned-thread-in-browser", "timeout_s": 120, "side_effects": ["writes-test-data"], "floor": false}
---
# Web scope

## Sub-features

Queue and document rendering, interactive controls and client state.

## How to get to it

Open the daemon-served web page for an isolated test instance.

## Driving it

Use the configured test origin and seed data; scope.html renders scope documents.

## Gotchas

No screenshot or browser journey has been run by this seed slice. Shared web modules serve both entry pages.


## Priority journeys

### scope-pinned-thread-in-browser

Open a seeded scope, create and resolve an anchored question, then reload and assert its anchor and resolved state persist without a sidebar.

Requires the `plan` test-identity backend and enforced identity cleanup, outbound containment and a dedicated proof host. The current backend returns unavailable (exit 3) before creating state; this is a blocked journey, not a behavioral pass. The command is an availability gate, not an implemented driver. Replace it with the real driver only when isolation and the service backend are available.
