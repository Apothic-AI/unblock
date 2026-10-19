---
id: index
product: web-panel
owner: unblock-lead
status: live
covers: ["page:index.html"]
paths: ["web/src/**", "web/index.html", "web/package.json", "web/vite.config.ts"]
proofs:
  - {"id": "queue-answer-in-browser", "kind": "journey", "cmd": "scripts/test-identity/unblock --json --journey queue-answer-in-browser", "timeout_s": 120, "side_effects": ["writes-test-data"], "floor": false}
  - {"id": "queue-lane-filter", "kind": "journey", "cmd": "scripts/test-identity/unblock --json --journey queue-lane-filter", "timeout_s": 120, "side_effects": ["writes-test-data"], "floor": false}
---
# Web index

## Sub-features

Queue and document rendering, interactive controls and client state.

## How to get to it

Open the daemon-served web page for an isolated test instance.

## Driving it

Use the configured test origin and seed data; scope.html renders scope documents.

## Gotchas

No screenshot or browser journey has been run by this seed slice. Shared web modules serve both entry pages.


## Priority journeys

### queue-answer-in-browser

Open the isolated queue, answer one seeded ask and reload; assert the answer persists and the pending row disappears.

Requires the `unblock` test-identity backend and enforced identity cleanup, outbound containment and a dedicated proof host. The current backend returns unavailable (exit 3) before creating state; this is a blocked journey, not a behavioral pass. The command is an availability gate, not an implemented driver. Replace it with the real driver only when isolation and the service backend are available.

### queue-lane-filter

Seed asks in two synthetic lanes, change the queue filter and assert only matching pending rows remain without modifying either ask.

Requires the `unblock` test-identity backend and enforced identity cleanup, outbound containment and a dedicated proof host. The current backend returns unavailable (exit 3) before creating state; this is a blocked journey, not a behavioral pass. The command is an availability gate, not an implemented driver. Replace it with the real driver only when isolation and the service backend are available.
