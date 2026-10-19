---
id: unblock-restart
product: integrations
owner: unblock-lead
status: live
covers: ["cli:unblock-restart"]
paths: ["bin/unblock-restart.sh"]
proofs: []
---
# unblock-restart

## Sub-features

The shipped unblock-restart helper executable.

## How to get to it

Invoke `bin/unblock-restart.sh` only after reading its supported arguments.

## Driving it

Inspect the helper before use; installation, restart and deployment helpers are not safe smoke checks.

## Gotchas

Some helpers install host configuration or contact services. This map does not authorize running them.
