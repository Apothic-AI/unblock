---
id: receipt
product: human-asks
owner: unblock-lead
status: live
covers: ["cli:receipt"]
paths: ["bin/unblock.js"]
proofs: []
---
# Unblock receipt

## Sub-features

The `receipt` top-level command and its option dispatch.

## How to get to it

`node bin/unblock.js help` lists the supported invocation.

## Driving it

Invoke `node bin/unblock.js receipt` with the arguments shown in help. Read-only help is safe without a daemon.

## Gotchas

Most commands access the configured daemon or local state. Mutations require isolated seeded state; never drive a real ask as a proof. No isolated end-to-end proof is claimed here.
