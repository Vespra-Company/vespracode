# VS Code Agents Instructions

This file provides instructions for AI coding agents working with the VS Code codebase.

For detailed project overview, architecture, coding guidelines, and validation steps, see the [Copilot Instructions](.github/copilot-instructions.md).

This repository is Vespra Code, a fork of Code OSS. For everything fork-specific (how it differs from upstream, build and run, fork rules, workflow, decisions and roadmap), read [docs/vespra/AGENT_ONBOARDING.md](docs/vespra/AGENT_ONBOARDING.md) before starting work.

## Cloud Agent

Agent shells put `/exec-daemon/node` (Node 22) ahead of the Node version pinned in `.nvmrc` (currently **24.22.1**). Prefer the nvm-managed Node from `.nvmrc`, or put `/usr/local/bin` on `PATH` and verify with `node -v` before package-manager commands.

This repo installs with **pnpm** (`packageManager` in `package.json`). Use `pnpm install` / `pnpm run compile` — not npm or yarn.

`pnpm run compile` reserves an 8GB heap. Environment install creates a 16G `/swapfile` and boot enables it. Launch the dev build with `./scripts/code.sh`, or the Agents launcher under `.claude/skills/launch/scripts/launch.sh`.

On headless Linux (no OS keyring), pass `--password-store=basic` so secret storage does not block startup with the keyring dialog. Fresh Linux installs also write that default into `argv.json`.
