---
id: mcp-approvals
product: scope-docs
owner: unblock-lead
status: live
covers: ["tool:unblock_scope_approve", "tool:unblock_scope_unapprove"]
paths: ["src/mcp.js"]
proofs: []
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
