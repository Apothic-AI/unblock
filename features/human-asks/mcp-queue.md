---
id: mcp-queue
product: human-asks
owner: unblock-lead
status: live
covers: ["tool:unblock_cancel", "tool:unblock_check", "tool:unblock_file", "tool:unblock_keep", "tool:unblock_park", "tool:unblock_peek", "tool:unblock_update"]
paths: ["src/mcp.js"]
proofs: []
---
# MCP queue tools

## Sub-features

File, park, check, peek, update, cancel and keep asks.

## How to get to it

`node bin/unblock.js mcp` launches the stdio MCP server.

## Driving it

Discover the server tool schemas and call them against an isolated test daemon.

## Gotchas

Tool calls can create or change asks. No end-to-end proof with outbound containment is registered.
