# Handoff: Vespra Projects in a Cursor Project

Use this when continuing Projects / Relay Contexts work **inside a Cursor Cloud Project** (Cloud Agent environment + Agents window), not as a bare `git clone` of `vespracode`.

Product background: [Vespra Projects (Relay Contexts)](../discussions/2026-11-13-vespra-projects.md).

## Why a Cursor Project

| Bare repo | Cursor Project |
| --- | --- |
| Clone + editor only | Cloud Agent VM with `environment.json`, swap, Node toolchain, display |
| Manual Electron launch | Agents window via `./scripts/code.sh --agents` + CDP |
| Theme / Projects often on different checkouts | Stacked PRs + one environment that can switch branches |
| No durable agent memory | This handoff + `AGENTS.md` + discussion notes travel with the project |

Open or attach a Cursor Project whose repo is `Vespra-Company/vespracode` and whose Cloud environment already builds this tree (see `AGENTS.md` → Cloud Agent). Prefer continuing from the latest Projects polish branch rather than `main` alone.

## Branch and PR stack

Work is split across stacked branches. Do not squash them into `main` out of order.

| Layer | Branch | PR | Role |
| --- | --- | --- | --- |
| Base merge | `cursor/merge-upstream-1.146.0-cab8` | — | Upstream 1.146 merge line |
| Feature | `cursor/vespra-projects-relay-cab8` | [#18](https://github.com/Vespra-Company/vespracode/pull/18) | Projects = Relay Contexts (sidebar + home + storage + knowledge) |
| Layout polish | `cursor/vespra-projects-polish-cab8` | [#20](https://github.com/Vespra-Company/vespracode/pull/20) | Home cards, primary/secondary actions, sidebar density (stacked on #18) |
| Theme (parallel) | `cursor/vespra-relay-theme-cab8` | [#19](https://github.com/Vespra-Company/vespracode/pull/19) | Built-in Vespra Relay themes + product defaults |

**Default checkout for UI work:** `cursor/vespra-projects-polish-cab8`.

**Relay Dark as product default** lives on #19 and is *not* merged into the Projects branches yet. For screenshots that need Relay while on a Projects branch, either:

1. Temporarily install `extensions/theme-vespra-relay` from the theme branch into the Agents profile `extensions/` dir and set `"workbench.colorTheme": "Vespra Relay Dark"`, or
2. Rebase/merge #19 into the Projects polish branch once both are ready.

New feature branches: `cursor/<name>-cab8` off the preferred base for that run (`main` or the Projects head you are stacking on).

## Cursor Project setup checklist

1. **Environment** — Use the existing Vespra Cloud Agent environment for this repo (16G swap for the 8GB compile heap). Use the Node version pinned in `.nvmrc` and pnpm only (never npm or yarn); `package.json` pins the pnpm version through corepack. `/usr/local/bin` may hold an older Node than `.nvmrc`, so prefer nvm:
   ```bash
   export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm install "$(cat .nvmrc)"
   export COREPACK_ENABLE_DOWNLOAD_PROMPT=0; corepack enable
   node -v; pnpm -v   # must match .nvmrc and package.json "packageManager"
   ```
   Run `pnpm install` when `node_modules` is missing, was installed by npm (no `node_modules/.modules.yaml`), or the lockfile changed.
2. **Branch** — Fetch and check out the polish tip:
   ```bash
   git fetch origin cursor/vespra-projects-polish-cab8
   git checkout cursor/vespra-projects-polish-cab8
   ```
3. **Build** — Full client compile (8GB heap):
   ```bash
   NODE_OPTIONS='--max-old-space-size=8192' pnpm run compile-client
   ```
4. **Launch Agents** — Isolated profile + CDP (do not reuse a stale profile from another branch without recompiling):
   ```bash
   VSCODE_SKIP_PRELAUNCH=1 ./scripts/code.sh . \
     --disable-extension=vscode.vscode-api-tests \
     --agents \
     --user-data-dir=/tmp/vespra-projects-dev-profile \
     --extensions-dir=/tmp/vespra-projects-dev-profile/extensions \
     --disable-workspace-trust \
     --remote-debugging-port=47901 \
     --password-store=basic
   ```
5. **Drive UI** — Playwright over CDP (`http://127.0.0.1:47901`) or the tracked launch skill under `.agents/skills/launch/` for throwaway profiles (`.claude/skills/launch` is only a symlink that `pnpm install` creates). Skip that skill's GitHub sign-in step; the Agents window opens without sign-in.

Leave Agents running after verification so a human or follow-up agent can continue from the same window. Kill only by concrete PID, never `pkill -f`.

## Where the code lives

| Concern | Path |
| --- | --- |
| Model + storage contract | `src/vs/workbench/contrib/sessions/common/projects.ts` |
| Service (profile + `.vespra/`) | `src/vs/workbench/contrib/sessions/browser/projectsService.ts` |
| Sidebar widget | `src/vs/workbench/contrib/sessions/browser/projectsSidebarWidget.ts` |
| Project home editor | `src/vs/workbench/contrib/sessions/browser/projectHomeEditor.ts` |
| Layout CSS (sidebar + home) | `src/vs/workbench/contrib/sessions/browser/media/projectsSidebar.css` |
| Commands | `src/vs/workbench/contrib/sessions/browser/projectCommands.ts` |
| Contribution / actions | `src/vs/sessions/contrib/sessions/browser/projects.contribution.ts` |
| Mount in Agents sidebar | `src/vs/workbench/contrib/sessions/browser/views/sessionsView.ts` (`.agent-sessions-projects`) |
| Unit tests | `src/vs/workbench/contrib/sessions/test/browser/projects.test.ts` |

Profile storage key: `sessions.projects.relayContexts` (`StorageScope.PROFILE`).

Agents windows often persist that key under:

`…/User/profiles/builtin/agents/globalStorage/state.vscdb`

Shared storage may also hold a copy (`~/.vespra-shared/sharedStorage/state.vscdb`). When seeding fixtures for screenshots, write the key **while Agents is stopped**, or seed the agents-profile DB Agents actually reads. A live window can overwrite seeds on shutdown.

Workspace companion files (when a folder is linked):

- `.vespra/project.json`
- `.vespra/INSTRUCTIONS.md`
- `.vespra/knowledge/*`

## What is already polished

- Create / rename / delete project from home; New from sidebar
- Knowledge listed as **files** (not folder path); Remove deletes the file under a tracked folder
- Home: title + Rename/Delete meta, primary New chat, secondary Customizations, section cards
- Sidebar: quieter New, folder icon, session count badge, active selection, empty CTA
- Home Sessions: live session titles and last-updated time from `ISessionsManagementService`, newest first, with Open; ids no loaded session claims collapse into one "not available" line
- Tests: `./scripts/test.sh --runGlob '**/projects.test.js'`

## Good next work in this Cursor Project

Prioritize product gaps over more CSS:

1. **Re-link workspace** — Creating without a folder leaves Workspace empty; add “Choose Folder” on the home card.
2. **Merge Relay theme** — Land #19 (or rebase) so Projects polish and Relay defaults ship together in one Agents profile.
3. **Context menu on sidebar rows** — Rename / Delete / Open without opening home first.
4. **Gateway sync path** — Still future; see discussion doc “Integrations to build on top”.

## Verification recipe (Cloud Agent)

```bash
nvm use "$(cat .nvmrc)"
NODE_OPTIONS='--max-old-space-size=8192' pnpm run compile-client
./scripts/test.sh --runGlob '**/projects.test.js'
# Launch Agents (see above), create or seed a project with /tmp/vespra-project-demo
# Screenshot sidebar + home; save under /opt/cursor/artifacts/
```

Seed example (Agents **stopped**):

```json
{
  "projects": [{
    "id": "demo-project",
    "name": "Relay Demo",
    "createdAt": 1731500000000,
    "workspaceUris": ["file:///tmp/vespra-project-demo"],
    "knowledgeUris": ["file:///tmp/vespra-project-demo/.vespra/knowledge"],
    "instructionsUri": "file:///tmp/vespra-project-demo/.vespra/INSTRUCTIONS.md",
    "mcpServerIds": []
  }],
  "membership": {},
  "activeProjectId": "demo-project"
}
```

Store as `sessions.projects.relayContexts` in the agents profile `state.vscdb`.

## Agent operating notes

- Follow `AGENTS.md` Cloud Agent section (PATH, compile heap, `./scripts/code.sh`).
- PRs: ManagePullRequest / forge tools — do not `gh pr create` for agent-owned PRs when the ManagePullRequest path is required.
- Stack children on #18’s head; if #18 moves, restack #20 before merging.
- Do not edit the gateway plan as part of UI polish unless the task is explicitly sync/API work.
- Display: Cloud VMs need a working `DISPLAY` (TigerVNC / Xvfb). If Electron exits with “Missing X server”, restore the display before relaunching Agents.

## Artifact pointers from the layout polish pass

These were produced on the Cloud Agent that shipped #20 (may expire with the run):

- `projects-layout-polish-home-rich.png`
- `projects-layout-polish-sidebar-closeup.png`
- `projects-layout-polish-full.png`

Re-generate locally in the Cursor Project rather than depending on those paths long-term.
