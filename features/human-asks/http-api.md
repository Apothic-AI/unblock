---
id: http-api
product: human-asks
owner: unblock-lead
status: live
covers: ["route:/api/answer", "route:/api/asks", "route:/api/asks/ticket", "route:/api/asks/ticket/answer", "route:/api/asks/ticket/aside", "route:/api/asks/ticket/cancel", "route:/api/asks/ticket/collect", "route:/api/asks/ticket/draft", "route:/api/asks/ticket/events", "route:/api/asks/ticket/keep", "route:/api/asks/ticket/pay-claim", "route:/api/asks/ticket/receipt", "route:/api/asks/ticket/receipt/image.png", "route:/api/asks/ticket/restore", "route:/api/asks/ticket/update", "route:/api/client-log", "route:/api/draft", "route:/api/events", "route:/api/health", "route:/api/links", "route:/api/pending", "route:/api/queue", "route:/api/voice/end", "route:/api/voice/issue", "route:/api/voice/live/connect", "route:/api/voice/providers", "route:/api/voice/session"]
paths: ["src/daemon.js", "src/config.js", "src/store.js", "src/schema.js", "src/focus-gate.js", "src/lane-state.js", "src/live-items.js", "src/pane-notice.js", "src/secrets.js", "src/origin-process.js", "src/rails-*.js", "src/queue-model.*", "src/voice*", "src/demo-host.*", "headless/**"]
proofs: []
---
# Queue HTTP API

## Sub-features

Queue CRUD, receipts, links, event streams, voice sessions, authentication and daemon lifecycle.

## How to get to it

Start the daemon with `node bin/unblock.js daemon` in an isolated environment.

## Driving it

Use `/api/health` to diagnose a test daemon, then exercise queue endpoints only with a fresh test identity.

## Gotchas

Voice calls can use paid providers; links grant access. Never use live credentials or a real-person ask for regression evidence.
