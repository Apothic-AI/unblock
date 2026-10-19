---
id: scope
product: scope-docs
owner: unblock-lead
status: live
covers: ["cli:scope"]
paths: ["bin/unblock.js"]
proofs: []
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
