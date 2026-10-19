---
id: file
product: human-asks
owner: unblock-lead
status: live
covers: ["cli:file"]
paths: ["bin/unblock.js"]
proofs:
  - {"id": "file-isolated-ask", "kind": "journey", "cmd": "scripts/test-identity/unblock --json --journey file-isolated-ask", "timeout_s": 120, "side_effects": ["writes-test-data"], "floor": false}
---
# Unblock file

## Sub-features

The `file` top-level command and its option dispatch.

## How to get to it

`node bin/unblock.js help` lists the supported invocation.

## Driving it

Invoke `node bin/unblock.js file` with the arguments shown in help. Read-only help is safe without a daemon.

## Gotchas

Most commands access the configured daemon or local state. Mutations require isolated seeded state; never drive a real ask as a proof. No isolated end-to-end proof is claimed here.


## Priority journeys

### file-isolated-ask

File a product decision with a synthetic agent and lane; assert the returned ticket, pending state and stored text match the request.

Requires the `unblock` test-identity backend and enforced identity cleanup, outbound containment and a dedicated proof host. The current backend returns unavailable (exit 3) before creating state; this is a blocked journey, not a behavioral pass. The command is an availability gate, not an implemented driver. Replace it with the real driver only when isolation and the service backend are available.
