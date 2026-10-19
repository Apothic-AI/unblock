---
id: hermes-unblock-check
product: integrations
owner: unblock-lead
status: live
covers: ["tool:hermes.unblock_check"]
paths: ["hermes.py", "__init__.py", "plugin.yaml"]
proofs:
  - {"id": "hermes-consume-answer", "kind": "journey", "cmd": "scripts/test-identity/hermes --json --journey hermes-consume-answer", "timeout_s": 120, "side_effects": ["writes-test-data"], "floor": false}
---
# hermes.unblock_check

## Sub-features

Native tool or plugin action forwarding into the Unblock service.

## How to get to it

Load the Hermes plugin or the Herdr manifest, as appropriate.

## Driving it

Use a test daemon and test agent context before triggering the registered action.

## Gotchas

Plugin actions can open UI or mutate ask state. Never invoke them against a personal session as a proof.


## Priority journeys

### hermes-consume-answer

Answer a seeded ticket, consume it through hermes.unblock_check and assert a second check does not redeliver it.

Requires the `hermes` test-identity backend and enforced identity cleanup, outbound containment and a dedicated proof host. The current backend returns unavailable (exit 3) before creating state; this is a blocked journey, not a behavioral pass. The command is an availability gate, not an implemented driver. Replace it with the real driver only when isolation and the service backend are available.
