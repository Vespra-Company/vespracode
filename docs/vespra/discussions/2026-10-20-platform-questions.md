# Platform questions, 20 Oct 2026

Status: answered. Plain-language answers to Austin's eight question groups, with pointers into the code. Add notes or follow-ups under each heading.

---

## 1. UI

### 1.1 Can I edit layout / components / icons / fonts in settings and have it written out as code (e.g. via Chrome DevTools)?

Only colors. Everything else is manual.

- Colors: change `workbench.colorCustomizations` in settings, then run the command **Developer: Generate Color Theme From Current Settings**. It writes a theme JSON file you can ship as a theme. That is the only "settings to code" exporter.
- Layout, components, fonts: **Developer: Toggle Developer Tools** opens Chrome DevTools on the window. You can poke at CSS live to find what to change, but nothing is saved. You then edit the real `.css` file and reload the window (**Developer: Reload Window**, Ctrl+R).
- There is no "custom CSS" user setting in this build.

### 1.2 How would we replace the whole design system with our own?

The UI is plain TypeScript and CSS. No React, no component framework. Change it in this order (cheapest and safest first):

1. Colors: ship our own default theme in `extensions/theme-defaults` and make it the default. Every color becomes a `--vscode-*` CSS variable automatically.
2. Icons: ship a *product icon theme* extension that maps every icon id to our glyphs (built-in icon font is `src/vs/base/browser/ui/codicons/`). File icons are a separate *file icon theme* (see `extensions/theme-modern-icons`).
3. Fonts: the UI font is hardcoded per OS in `src/vs/workbench/browser/media/style.css`. Edit it and bundle a webfont. Editor font stays the `editor.fontFamily` setting.
4. Components: shared widgets live in `src/vs/base/browser/ui/*` (button, input, list, tree, dropdown, toolbar, hover, dialog). Restyle their CSS. Rewriting them breaks upstream merges, so avoid.
5. Layout: each workbench part has its own CSS in `src/vs/workbench/browser/parts/*/media/`. Agents Window layout is specified in `src/vs/sessions/LAYOUT.md`.

---

## 2. Extensions and features

### 2.1 Besides Open VSX, what marketplace options do we have?

Right now there is **no** marketplace: `product.json` has no `extensionsGallery`, and `build/hygiene.ts` fails the build if one is added (upstream rule, we can relax it). Microsoft's marketplace is off-limits to forks by its terms.

Options:

- Public Open VSX (open-vsx.org).
- Self-hosted Open VSX server (same software, our domain, our curation).
- Our own gallery server. The client speaks Microsoft's gallery API, so we would need to implement `POST /extensionquery`, `GET /vscode/{publisher}/{name}/latest`, and VSIX download URLs, or serve a single manifest JSON at the `extensions.gallery.serviceUrl` setting.

### 2.2 Do extensions share context with the Agents Window? What if we made our own extension library and marketplace?

- The Agents Window is a separate window with its own extension host, but `product.json#sessionsWindowAllowedExtensions` is `[]`, so **no extensions run there** unless we allow-list them by id.
- Agents do not get tools from extensions. Agent tools, MCP servers, skills and instructions come from files (`.github/`, `.agents/`, `.claude/`, `mcp.json`) and from **plugins** (bundles of skills, agents, MCP servers, hooks). The only things that cross from the IDE into agents are BYOK models and the client tool set.
- So a "Vespra extension library" is really two products: a VSIX gallery for IDE extensions (section 2.1) and a **plugin marketplace** for agent capabilities (a `marketplace.json` repo; the UI already supports custom marketplaces behind `chat.customizations.marketplace.enabled`).

### 2.3 Can we take Open VSX extensions and bake them in as code so users cannot remove or edit them?

Yes.

- Put the extension source under `extensions/` and it compiles into the product, or
- List it in `product.json#builtInExtensions` with a local `vsix` path, `sha256` and `metadata`; `build/lib/builtInExtensions.ts` packages it.

Built-ins can be disabled by users but never uninstalled. To block installing anything else, use the `extensions.allowed` policy. Check each extension's own license before redistributing.

---

## 3. Framework

### 3.1 What is the full framework for frontend, backend, AI, agents? Is the web version the same?

| Part | What it is |
|---|---|
| Frontend | TypeScript + hand-written DOM/CSS in an Electron window. No React. |
| Desktop backend | Electron main process, a shared process, a Node extension host. |
| Server (remote / web) | Node 24 server (`src/vs/server/node`) serving the web UI and remote extension host. |
| AI / agents | A separate "Agent Host" process (`src/vs/platform/agentHost/node`) that runs Copilot SDK, Claude Agent SDK and Codex. UI talks to it over a JSON-RPC protocol called AHP. |
| Storage | SQLite files (`state.vscdb`, `agent-host.db`, `session.db`). |

Web version: same code, different entry point. Extensions run in a Web Worker. The Agent Host cannot run inside a browser, so web needs a server-side host.

### 3.2 What does "the API" do, and is there anything we could use Kong for?

There are three APIs:

1. `vscode.*` extension API: how extensions talk to the IDE.
2. AHP: how the UI (and any external program) talks to the Agent Host. Exposed on a local socket (`src/vs/platform/agentHost/LOCAL_ENDPOINT.md`) and over WebSocket for remote hosts. This is our automation surface.
3. MCP: how agents talk to tools.

Kong: not useful on the desktop (AHP is local WebSocket). Useful if we **host** anything: hosted Agent Hosts, a Vespra model proxy, an extension gallery, or a plugin marketplace. Kong would do auth, rate limiting, per-customer quotas, and its AI Gateway can route/meter LLM calls. Worth the call once we decide whether we run a backend.

---

## 4. Agents and AI

### 4.1 How do skills, rules, instructions, MCP and plugins work in the IDE and Agents Window, and how can we customize them?

- File types: skills (`SKILL.md`), instructions (`*.instructions.md`, `AGENTS.md`, `CLAUDE.md`), prompts (`*.prompt.md`), agents (`*.agent.md`), hooks, MCP (`mcp.json`, `.mcp.json`), plugins (`plugin.json`).
- Where they are found: `.github/`, `.agents/`, `.claude/` in the repo, user folders `~/.copilot`, `~/.claude`, `~/.agents`. Full list: `src/vs/workbench/contrib/chat/common/promptSyntax/config/promptFileLocations.ts`. `.cursor/rules` is not read; `.cursor/mcp.json` can be (setting `chat.mcp.discovery.enabled`, off by default).
- A "harness" is which runtime consumes them (Copilot, Claude, Codex, Local). Each harness has a descriptor that decides which types it shows. Spec: `src/vs/sessions/AI_CUSTOMIZATIONS.md`.
- Plugins are bundles of the above, installed through the agent runtime, not through the Extensions view.

To customize: ship Vespra default skills/instructions, add a Vespra harness descriptor, point the marketplace sources at our own catalog, and optionally lock users to plugin-only customizations with `chat.customizations.strictPluginOnlyCustomization`.

### 4.2 Can we swap the harness for our own, or add one like Codex or Grok, and can we run several?

Several already run side by side (Copilot, Claude, Codex). A harness is a class implementing `IAgent` (`src/vs/platform/agentHost/common/agent.ts`), registered in `src/vs/platform/agentHost/node/agentHostMain.ts` and `agentHostServerMain.ts`. The orchestrator is written to never special-case a provider, so a fourth one is supported by design.

To add a Vespra or Grok harness: new folder `node/<name>/` implementing `IAgent`, an enable setting, `registerExternalHarness` in `agentHostChatContribution.ts`, a session-type entry in the Agents Window picker. `node/codex/codexAgent.ts` is the thinnest one to copy.

### 4.3 Does it use the Copilot SDK?

Yes. `@github/copilot-sdk` drives the Copilot harness, which is always registered. The Claude harness can also route through a local proxy that calls the **Copilot API with the user's GitHub token** (`claudeProxyService.ts`); its other mode uses `ANTHROPIC_API_KEY` directly. Codex uses OpenAI/ChatGPT auth. Copilot is removable: stop registering `CopilotAgent`, run Claude in native mode, add BYOK or our own harness.

### 4.4 Remote sessions and sandboxes: can we use our own system?

- Remote connection kinds already supported: `websocket`, `ssh`, `wsl`, `tunnel`, `CloudSandbox` (GitHub-hosted, via Azure Web PubSub relay), `DevContainer`.
- "Sandbox" locally means terminal-command sandboxing with bubblewrap on Linux (`src/vs/platform/sandbox/`); Windows unsupported.
- To use our own compute: provision a VM/container, run the server-side Agent Host (`src/vs/server/node/serverAgentHostManager.ts`) on it, connect over WebSocket AHP. The protocol and the remote provider abstraction exist; only the GitHub-specific provisioning/inventory would be replaced.

---

## 5. Source control

### 5.1 What git system is used in the IDE and by agents?

Plain `git` from the PATH in both places. The IDE uses the built-in `extensions/git` extension. The Agent Host has its own git layer (`node/agentHostGitService.ts`) that shells out to `git` for worktrees per session, checkpoints (`refs/agents/...`), diffs and PR tracking. Nothing proprietary.

### 5.2 Should we revisit Harness (harness.io)?

Different thing from the "harness" in the code. Harness.io is CI/CD and feature flags. A partnership would be: run Vespra agents inside their pipelines (via AHP) or use their CI for our release builds. Not something to embed in the product.

---

## 6. Auth

### 6.1 It asked me to sign in to GitHub on launch. Can we use our own login and drop GitHub / Copilot / Microsoft?

Yes. The prompt comes from the Copilot setup flow, which switches off entirely when `product.json#defaultChatAgent` is absent (`chatEntitlementService.ts` returns early).

1. Delete `defaultChatAgent` from `product.json` and the Copilot entries under `trustedExtensionAuthAccess`.
2. Stop registering `CopilotAgent`; use Claude native, Codex, BYOK, or our harness. Claude and Codex both mark GitHub as `required: false`.
3. Drop `extensions/github-authentication` and `microsoft-authentication` from the build (keep GitHub auth only if we want the GitHub PR extension).
4. Add a Vespra auth provider: a small extension calling `vscode.authentication.registerAuthenticationProvider`. Tokens go into the OS keychain automatically.

`chat.disableAIFeatures` only hides the UI; it does not remove the dependency.

### 6.3 Auth0 / Okta?

Good fit for step 4 above (OIDC + PKCE from an Electron app is standard) and for any hosted backend later. It is one extension plus whatever server we protect; it does not touch the IDE core.

---

## 7. Vercel

Integration (a Vercel extension or MCP server for deploys, logs, env vars): cheap, fits well. Hosting Vespra *on* Vercel: no. The web build needs a long-running Node server with WebSockets and a filesystem, which is not Vercel's model. Static web client on Vercel with our server elsewhere is possible. Take the integration conversation; be cautious about the hosting pitch.

---

## 8. Build and sync

### 8.1 How do I push so our code matches and my build files do not sync to GitHub?

Already handled by `.gitignore` (`/out*/`, `.build/`, `node_modules`, `extensions/**/dist/`, `*.tsbuildinfo`, `.vscode-test`). GitHub Desktop respects it. If build files show as changes, they were force-added once; fix with `git rm --cached <path>`. Normal pull/push from GitHub Desktop keeps your clone in sync with `main`.

### 8.2 Going forward, what is the change-and-rebuild loop? Can I see changes live?

- One time: `npm ci`, then `npm run compile-copilot` followed by `npm run compile-client` (sequentially on your machine to avoid the out-of-memory crash).
- Daily: `npm run watch` in one terminal (incremental), `scripts\code.bat` to launch. After an edit, Ctrl+R (Reload Window) picks up UI and CSS changes in seconds. Main-process or Agent Host changes need a relaunch.
- Fast cold rebuild without a watcher: `npm run build-fast -- --client-only`.
- Before pushing: `npm run eslint`, `npm run valid-layers-check`, `npm run hygiene`.
- Installer only when you want to ship: `npm run gulp vscode-win32-x64` produces `..\VSCode-win32-x64`.

---

## Notes and follow-ups

_Add here._
