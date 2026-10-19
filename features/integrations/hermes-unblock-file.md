---
id: hermes-unblock-file
product: integrations
owner: unblock-lead
status: live
covers: ["tool:hermes.unblock_file"]
paths: ["hermes.py", "__init__.py", "plugin.yaml"]
proofs:
  - {"id": "hermes-file-ask", "kind": "journey", "cmd": "scripts/test-identity/hermes --json --journey hermes-file-ask", "timeout_s": 120, "side_effects": ["writes-test-data"], "floor": false}
---
# hermes.unblock_file

## Sub-features

Native tool or plugin action forwarding into the Unblock service.

## How to get to it

Load the Hermes plugin or the Herdr manifest, as appropriate.

## Driving it

Use a test daemon and test agent context before triggering the registered action.

## Gotchas

Plugin actions can open UI or mutate ask state. Never invoke them against a personal session as a proof.


## Priority journeys

### hermes-file-ask

Load the plugin in an isolated Hermes session, file a synthetic ask and assert its ticket and origin match the tool response.

Requires the `hermes` test-identity backend and enforced identity cleanup, outbound containment and a dedicated proof host. The current backend returns unavailable (exit 3) before creating state; this is a blocked journey, not a behavioral pass. The command is an availability gate, not an implemented driver. Replace it with the real driver only when isolation and the service backend are available.
