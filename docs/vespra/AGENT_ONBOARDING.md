# Agent onboarding: working on Vespra Code

Read this first if you are an AI coding agent (or a new human contributor) picking up work in this repository. It tells you what the project is, how it differs from upstream, how to build and run it, what not to touch, and where decisions and plans live.

## 1. What this repository is

Vespra Code is Vespra Company's fork of Code OSS (the open-source core of VS Code), including upstream's Agent Host work (AHP protocol, Agents Window, Claude/Codex/BYOK backends). The goal is an agent-first editor that Vespra fully owns: its own identity, no Microsoft telemetry, its own documentation and marketplace decisions, and eventually its own agent harness and login.

Upstream remains the source of truth for the editor platform. Vespra changes are deliberately small, listed, and kept in known places so upstream merges stay cheap.

## 2. Read in this order

| Step | File | Why |
|---|---|---|
| 1 | `AGENTS.md` (repo root) | Entry point; Cloud Agent environment notes |
| 2 | `.github/copilot-instructions.md` | Upstream's project overview, coding guidelines, validation commands. Still authoritative for code style |
| 3 | `.github/instructions/*.instructions.md` | Topic guides (committing, CSS, observables, disposables, agent host testing, design tokens, ...). Read the ones relevant to your task |
| 4 | This file | Vespra-specific rules and workflow |
| 5 | `docs/vespra/ARCHITECTURE_BLUEPRINT.md` | Full architecture reference. Section 18 is the fork delta table |
| 6 | `docs/vespra/discussions/` and `docs/vespra/features/` | Decisions, open questions, roadmap |

Skills for executable workflows live in `.claude/skills/` and `.agents/skills/` (for example `launch`, which starts the dev build with debug ports for UI automation). Use them; do not add new ones to the repo unless asked (see section 7).

## 3. Repository map

Only the parts that matter for orientation. The blueprint has the complete version.

| Path | What lives there |
|---|---|
| `src/vs/base` | Platform-agnostic utilities and UI primitives (`base/browser/ui/*` is the widget library) |
| `src/vs/platform` | Services shared by all processes (configuration, storage, telemetry, agentHost, ...) |
| `src/vs/editor` | Monaco text editor |
| `src/vs/workbench` | The application shell: `browser/parts/*` (titlebar, sidebar, panel, statusbar, editor area), `contrib/*` (features), `services/*` |
| `src/vs/code` | Electron main process entry |
| `src/vs/server` | Remote server |
| `src/vs/platform/agentHost` | Agent Host: `IAgent` interface, Copilot/Claude/Codex backends, protocol; `test/node/mockAgent.ts` is the reference implementation for a custom harness |
| `extensions/` | Built-in extensions (language features, themes, `copilot/`) |
| `build/` | Gulp build, packaging, hygiene checks |
| `cli/` | Rust CLI |
| `product.json` | Product identity, URLs, telemetry switches, default chat agent. Most fork changes land here |
| `docs/vespra/` | Everything Vespra-specific (this folder) |

## 4. Environment, build, run

**Toolchain.** Node version is pinned in `.nvmrc` (24.x). Use it; mismatched Node is the most common cause of a broken `npm install` or native module error. On the Cloud Agent VM the shell may put a different Node first; run `export PATH="/usr/local/bin:$PATH"` and check `node -v` before any `npm` command (see `AGENTS.md`).

**Install.** `npm install` at the repo root. It also installs every `extensions/*` package. Expect several GB and many minutes the first time.

**Compile.**

```bash
npm run compile            # compile-client (gulp -> out/) and compile-copilot in parallel
npm run compile-copilot    # run these two sequentially instead on machines with <= 16 GB RAM
npm run compile-client
npm run watch              # incremental; keep running in its own terminal while editing
```

`compile` reserves an 8 GB heap. On the Cloud Agent VM a 16 GB swapfile is enabled for this.

**Run.**

```bash
./scripts/code.sh          # macOS / Linux
scripts\code.bat           # Windows
```

Both launch from `out/`. Pass a folder path to open it. The app shows as "Vespra Code" and stores data in `.vespra`, separate from any installed VS Code or Cursor.

**Validate.** Follow the "Validating TypeScript changes" section of `.github/copilot-instructions.md`; it is deliberate about not running heavy builds as a ritual. Short version: prefer the diagnostics from an already-running `watch` task; use `npm run build-fast -- --client-only` when tests need fresh client output; run `npm run typecheck-client` only for broad or risky changes; lint changed files with `npm run eslint -- <files>`; unit tests via `scripts/test.sh` (`scripts\test.bat`) with `--grep`, integration tests via `scripts/test-integration.sh`; `npm run valid-layers-check` only when module layering may be affected. Agent Host has its own guide in `.github/instructions/agentHostTesting.instructions.md`.

**Generated folders you will see in the checkout.** All of these are in `.gitignore` and must never be committed: `node_modules/` (root and under each `extensions/*`), `out/`, `.build/`, `extensions/**/dist/`, `extensions/**/out/`, `cli/target/`, `*.tsbuildinfo`, `.eslintcache`, `test-results/`. They are large (about 5 GB total on a full dev machine). Deleting `out/` and `.build/` and recompiling is a safe reset; deleting `node_modules/` forces a full reinstall. If `git status` shows any of them, the ignore rules are broken; fix that before committing.

## 5. Fork rules: what is different and must stay different

These are the current intentional divergences from upstream. Do not undo them during a merge or refactor. Keep the table in `ARCHITECTURE_BLUEPRINT.md` section 18 in sync when you add one.

| Area | Rule |
|---|---|
| Identity | `product.json` says `Vespra` / `Vespra Code` / `vespra` / `.vespra` / `vespra://` / `com.vespra.code`. User-visible strings, window titles, protocol handlers and bundle ids must not revert to "Code - OSS" or Microsoft names |
| Telemetry | `enableTelemetry: false`, telemetry levels off, `removeTelemetryMachineId: true`, no `aiConfig`. Do not reintroduce phone-home endpoints, experimentation services, or crash reporting to Microsoft |
| Links | Documentation, issues and license URLs point at `docs.vespra.cloud` and `github.com/vespra-company/vespracode`, not `code.visualstudio.com` or `aka.ms` |
| Marketplace | None configured. Decision pending (Open VSX vs own gallery); see discussions. Do not point `extensionsGallery` at the Microsoft marketplace |
| Default chat agent | Still the upstream GitHub Copilot ids for now. Removing the Copilot dependency is a listed idea, not done |
| Secrets | Never commit API keys, PATs, machine ids or `.env` files. Use environment variables and reference them from shell variables only |

## 6. How work is organized

**Branches and PRs.** Work on a branch, open a pull request against `main`, one logical change per commit. Follow `.github/instructions/committing.instructions.md` for commit messages. The PR template is `.github/pull_request_template.md`. Documentation-only PRs are normal and welcome.

**Docs are part of the change.** If you change something listed in section 5, update the blueprint delta table and `features/implemented.md` in the same PR.

**Discussions** (`docs/vespra/discussions/`): one dated file per topic, `YYYY-MM-DD-short-topic.md`, with a `Status:` line (open, answered, decided, superseded) and a `## Notes and follow-ups` section at the bottom. Add the file to the index table in `discussions/README.md`. Use these for questions, research, and design notes. When a discussion reaches a decision, move the decision into the blueprint (ADR section) or into `features/`.

**Features** (`docs/vespra/features/`): three lists, `ideas.md` -> `planned.md` -> `implemented.md`. Move entries forward; never duplicate. Format: `- **Name** — one-line summary. (owner / branch / PR)`.

## 7. Things that have gone wrong before

Learn from them so they do not repeat.

- **Installing tools into the repo.** A skill installer was once run inside the checkout and left `.agents/skills/<name>/` and a `skills-lock.json` behind. The owner wanted the skill used, not installed. Rule: install third-party skills, CLIs, SDKs and reference clones under `/tmp` (or outside the repo), and check `git status` before committing.
- **Answering around the question.** When asked a list of concrete questions, answer each one directly in the order asked, in plain language, before adding detail. Put long research in a discussion file and give a short summary in chat.
- **Memory on a 16 GB machine.** Running `compile-client` and `compile-copilot` in parallel plus an IDE can exhaust RAM. Run them sequentially.
- **Node version drift.** Shells on the Cloud Agent VM may expose Node 22 ahead of the pinned Node 24. Check `node -v` first.
- **Hidden network problems on the VM.** Container-to-container and container-to-internet traffic was once blocked by stale `iptables-legacy` rules while Docker wrote to nftables. Symptom: connections time out rather than refuse. If you run Docker services for research, test connectivity from inside a container before debugging the application.

## 8. Current state and where things are heading

**Merged so far** (see `features/implemented.md` for links): Cloud Agent environment notes (#1), Microsoft telemetry and phone-home disabled (#2), product identity rebranded to Vespra Code (#3), architecture blueprint (#5).

**In flight:** help-menu documentation links to `docs.vespra.cloud` (#4); the discussions and features folders and the Plane review (#6).

**Open decisions** (details and reasoning in `discussions/2026-10-20-platform-questions.md`):
- Vespra login: own OIDC/PKCE provider (Auth0 or similar), replacing GitHub/Microsoft sign-in prompts.
- Marketplace: Open VSX versus a Vespra gallery; curated built-ins as VSIX.
- Agent harness: a fourth `IAgent` implementation (start from `mockAgent.ts`), own model routing, own remote compute.
- Design system: Vespra theme, product icon theme, fonts, then targeted `base/browser/ui` CSS. Do not reskin wholesale.
- Partnerships to evaluate: Kong (gateway), Vercel (deploy integration), Harness (CI/CD), Auth0/Okta (identity).

**Adjacent product research:** `discussions/2026-10-20-plane-review.md` reviews Plane as the blueprint for a Linear-like Vespra project tracker and recommends building on our own stack (Vite + React + Tailwind 4 + shadcn/ui, TypeScript backend on Postgres) rather than forking. The work-item-to-agent loop is the differentiator to design for.

## 9. Checklist before you finish a task

1. `git status` shows only files you meant to change; no generated folders, no secrets, no tool installs.
2. Code changes are validated per section 4 (watch diagnostics or a targeted build, targeted tests, lint on changed files).
3. Fork rules in section 5 still hold; the blueprint delta table and `features/` are updated if they should be.
4. Discussion or feature docs are updated if the task produced a decision, a question, or research.
5. Commit messages follow `.github/instructions/committing.instructions.md`; the PR describes what and why, with evidence (test output, screenshots) for anything user-visible.
6. Anything left running or half-done is written down in the PR or the relevant discussion's notes section, so the next agent can pick it up.
