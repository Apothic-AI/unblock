---
id: http-scopes
product: scope-docs
owner: unblock-lead
status: live
covers: ["route:/api/scope"]
paths: ["src/scope*", "src/doc-kinds.*", "src/explainer-answerer.js", "web/src/scope/**", "web/scope.html"]
proofs:
  - {"id": "scope-thread-roundtrip", "kind": "journey", "cmd": "scripts/test-identity/plan --json --journey scope-thread-roundtrip", "timeout_s": 120, "side_effects": ["writes-test-data"], "floor": false}
---
# Scope HTTP routes

## Sub-features

Scope publishing, document assets, anchors, decisions, approvals, threads, build and voice support.

## How to get to it

The daemon delegates `/api/scope` and `/s` requests to `src/scope.js`.

## Driving it

Use the scope CLI help for document and thread operations; drive only a seeded scope through its share URL.

## Gotchas

Stale section hashes reject edits. Share links are capabilities. Plan synchronization and publishing must not use personal sessions.


## Priority journeys

### scope-thread-roundtrip

Create a pinned question on a seeded section, answer and resolve it through HTTP, then assert the thread persists and a stale section hash rejects an edit.

Requires the `plan` test-identity backend and enforced identity cleanup, outbound containment and a dedicated proof host. The current backend returns unavailable (exit 3) before creating state; this is a blocked journey, not a behavioral pass. The command is an availability gate, not an implemented driver. Replace it with the real driver only when isolation and the service backend are available.
