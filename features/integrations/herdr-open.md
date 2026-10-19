---
id: herdr-open
product: integrations
owner: unblock-lead
status: live
covers: ["tool:herdr.open"]
paths: ["herdr-plugin.toml", "plugin/**"]
proofs:
  - {"id": "herdr-open-test-panel", "kind": "journey", "cmd": "scripts/test-identity/herdr --json --journey herdr-open-test-panel", "timeout_s": 120, "side_effects": ["writes-test-data"], "floor": false}
---
# herdr.open

## Sub-features

Native tool or plugin action forwarding into the Unblock service.

## How to get to it

Load the Hermes plugin or the Herdr manifest, as appropriate.

## Driving it

Use a test daemon and test agent context before triggering the registered action.

## Gotchas

Plugin actions can open UI or mutate ask state. Never invoke them against a personal session as a proof.


## Priority journeys

### herdr-open-test-panel

Open the Unblock panel in an isolated Herdr profile, assert it targets the seeded daemon and close only the panel created by this journey.

Requires the `herdr` test-identity backend and enforced identity cleanup, outbound containment and a dedicated proof host. The current backend returns unavailable (exit 3) before creating state; this is a blocked journey, not a behavioral pass. The command is an availability gate, not an implemented driver. Replace it with the real driver only when isolation and the service backend are available.
