---
id: list
product: human-asks
owner: unblock-lead
status: live
covers: ["cli:list"]
paths: ["bin/unblock.js"]
proofs:
  - {"id": "list-own-pending-asks", "kind": "journey", "cmd": "scripts/test-identity/unblock --json --journey list-own-pending-asks", "timeout_s": 120, "side_effects": ["writes-test-data"], "floor": false}
---
# Unblock list

## Sub-features

The `list` top-level command and its option dispatch.

## How to get to it

`node bin/unblock.js help` lists the supported invocation.

## Driving it

Invoke `node bin/unblock.js list` with the arguments shown in help. Read-only help is safe without a daemon.

## Gotchas

Most commands access the configured daemon or local state. Mutations require isolated seeded state; never drive a real ask as a proof. No isolated end-to-end proof is claimed here.


## Priority journeys

### list-own-pending-asks

Seed two synthetic lanes; assert list and peek return only the requested lane and exclude closed tickets.

Requires the `unblock` test-identity backend and enforced identity cleanup, outbound containment and a dedicated proof host. The current backend returns unavailable (exit 3) before creating state; this is a blocked journey, not a behavioral pass. The command is an availability gate, not an implemented driver. Replace it with the real driver only when isolation and the service backend are available.
