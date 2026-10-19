# unblock

A queue for requests that need a human decision.
Used by agents and the Rails workspace.

rules: agent-plugin-kit@8cf0344

## Read first
1. This file.
2. `README.md`.
3. `docs/scope-blocks.md` for scope workflow.

## Check
`./check` runs the whole fast loop. `./check --staged` is the pre-commit hook.

## Land
Fast-forward push to `origin/main`.
The commit body carries a `check:` line: one bare shell command the gate runs.

## Worktrees
The main checkout `/Volumes/StudioExt/repos/unblock` stays on `main`.
Other branches: `git worktree add ../unblock-wt/<topic> -b <branch> origin/main`.

## Topics
Scope workflow: `docs/scope-blocks.md`.

## Repo facts
Node.js 22 or newer; run tests with `npm test`.
