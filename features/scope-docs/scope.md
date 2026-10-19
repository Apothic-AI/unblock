---
id: scope
product: scope-docs
owner: unblock-lead
status: live
covers: ["cli:scope"]
paths: ["bin/unblock.js"]
proofs:
  - {"id": "publish-isolated-scope", "kind": "journey", "cmd": "scripts/test-identity/plan --json --journey publish-isolated-scope", "timeout_s": 120, "side_effects": ["writes-test-data"], "floor": false}
---
# Unblock scope

## Sub-features

The `scope` top-level command and its option dispatch.

## How to get to it

`node bin/unblock.js help` lists the supported invocation.

## Driving it

Invoke `node bin/unblock.js scope` with the arguments shown in help. Read-only help is safe without a daemon.

## Gotchas

Most commands access the configured daemon or local state. Mutations require isolated seeded state; never drive a real ask as a proof. No isolated end-to-end proof is claimed here.


## Priority journeys

### publish-isolated-scope

Publish a synthetic scope with one section and attachment; assert document rendering and content hashes survive a reload without a personal Plan session.

Requires the `plan` test-identity backend and enforced identity cleanup, outbound containment and a dedicated proof host. The current backend returns unavailable (exit 3) before creating state; this is a blocked journey, not a behavioral pass. The command is an availability gate, not an implemented driver. Replace it with the real driver only when isolation and the service backend are available.
