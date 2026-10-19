---
id: ui
product: human-asks
owner: unblock-lead
status: live
covers: ["cli:ui"]
paths: ["bin/unblock.js"]
proofs: []
---
# Unblock ui

## Sub-features

The `ui` top-level command and its option dispatch.

## How to get to it

`node bin/unblock.js help` lists the supported invocation.

## Driving it

Invoke `node bin/unblock.js ui` with the arguments shown in help. Read-only help is safe without a daemon.

## Gotchas

Most commands access the configured daemon or local state. Mutations require isolated seeded state; never drive a real ask as a proof. No isolated end-to-end proof is claimed here.
