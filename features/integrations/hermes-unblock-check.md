---
id: hermes-unblock-check
product: integrations
owner: unblock-lead
status: live
covers: ["tool:hermes.unblock_check"]
paths: ["hermes.py", "__init__.py", "plugin.yaml"]
proofs: []
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
