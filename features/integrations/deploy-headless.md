---
id: deploy-headless
product: integrations
owner: unblock-lead
status: live
covers: ["cli:deploy-headless"]
paths: ["bin/deploy-headless.sh"]
proofs: []
---
# deploy-headless

## Sub-features

The shipped deploy-headless helper executable.

## How to get to it

Invoke `bin/deploy-headless.sh` only after reading its supported arguments.

## Driving it

Inspect the helper before use; installation, restart and deployment helpers are not safe smoke checks.

## Gotchas

Some helpers install host configuration or contact services. This map does not authorize running them.
