---
id: answer
product: human-asks
owner: unblock-lead
status: live
covers: ["cli:answer"]
paths: ["bin/unblock.js"]
proofs:
  - {"id": "answer-and-close-ask", "kind": "journey", "cmd": "scripts/test-identity/unblock --json --journey answer-and-close-ask", "timeout_s": 120, "side_effects": ["writes-test-data"], "floor": false}
---
# Unblock answer

## Sub-features

The `answer` top-level command and its option dispatch.

## How to get to it

`node bin/unblock.js help` lists the supported invocation.

## Driving it

Invoke `node bin/unblock.js answer` with the arguments shown in help. Read-only help is safe without a daemon.

## Gotchas

Most commands access the configured daemon or local state. Mutations require isolated seeded state; never drive a real ask as a proof. No isolated end-to-end proof is claimed here.


## Priority journeys

### answer-and-close-ask

Answer a synthetic ticket, assert the agent can consume the answer once, then close it and assert it leaves the pending queue. Capture notifications in a local sink.

Requires the `unblock` test-identity backend and enforced identity cleanup, outbound containment and a dedicated proof host. The current backend returns unavailable (exit 3) before creating state; this is a blocked journey, not a behavioral pass. The command is an availability gate, not an implemented driver. Replace it with the real driver only when isolation and the service backend are available.
