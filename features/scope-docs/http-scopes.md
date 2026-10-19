---
id: http-scopes
product: scope-docs
owner: unblock-lead
status: live
covers: ["route:/api/scope"]
paths: ["src/scope*", "src/doc-kinds.*", "src/explainer-answerer.js", "web/src/scope/**", "web/scope.html"]
proofs: []
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
