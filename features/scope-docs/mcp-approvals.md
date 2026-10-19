---
id: mcp-approvals
product: scope-docs
owner: unblock-lead
status: live
covers: ["tool:unblock_scope_approve", "tool:unblock_scope_unapprove"]
paths: ["src/mcp.js"]
proofs:
  - {"id": "scope-approval-roundtrip", "kind": "journey", "cmd": "scripts/test-identity/unblock --json --journey scope-approval-roundtrip", "timeout_s": 120, "side_effects": ["writes-test-data"], "floor": false}
---
# MCP scope approvals

## Sub-features

Approve and unapprove scope gates.

## How to get to it

Connect to `node bin/unblock.js mcp`.

## Driving it

Inspect the approval tool input schemas before calling them on a seeded scope.

## Gotchas

Approvals affect workflow state; never interpret a test approval as authority for real work.


## Priority journeys

### scope-approval-roundtrip

Approve and unapprove a synthetic scope via MCP; assert both reads reflect the new state and no real workflow is authorized.

Requires the `unblock` test-identity backend and enforced identity cleanup, outbound containment and a dedicated proof host. The current backend returns unavailable (exit 3) before creating state; this is a blocked journey, not a behavioral pass. The command is an availability gate, not an implemented driver. Replace it with the real driver only when isolation and the service backend are available.
