# Vespra Projects (Relay Contexts)

A Project is the durable pack an agent session joins: name, workspace, instructions, knowledge files, and MCP enablement. It is stored in the user profile and, when the workspace is local, copied to `.vespra/project.json` so the same pack can later become a gateway agent profile.

This is the Agents-window shape of the profile described in [the gateway plan](2026-10-25-vespra-gateway-plan.md). The gateway `/profile` endpoint is the sync target; this note does not build that service.

## What Phase 1 stores

| Pack field | Where it lives |
| --- | --- |
| Name, id, session membership | Profile storage (`sessions.projects.relayContexts`) |
| Workspace root | Profile, and `workspaceUris` is the folder a new chat opens in |
| Instructions | `.vespra/INSTRUCTIONS.md`, falling back to `AGENTS.md` when that file exists |
| Knowledge | Files under `.vespra/knowledge/` (at most 8 attached per send) |
| MCP servers | Ids enabled for the workspace when a project chat is sent |

A sidebar group named Projects is migrated once into real projects. Other session groups stay folders.

## Gateway mapping (later)

| Relay Context | Gateway `/profile` |
| --- | --- |
| Instructions + skills + custom agents | Profile instructions and skills |
| Knowledge files | Profile knowledge, local now and cloud when `/profile` exists |
| `mcpServerIds` | Connector pack from `/mcp` |
| Session membership | Runs that joined that profile |

`vespra agent sync` should write this same pack into the Cursor and Claude Code locations those tools already read.

## Integrations to build on top

1. Gateway MCP connector packs — GitHub, Linear, Slack, and Vercel or GCP as one signed-in tool surface.
2. Project knowledge — the local corpus above, then the same files on `/profile`.
3. Agent profile sync — one Relay Context across Vespra Code, Cursor, and Claude Code.
4. Project automations — webhook and schedule triggers tied to a project.
5. Multi-agent lanes — planner, builder, and reviewer profiles pinned on a project.
6. Policy and budgets — spend and tool allow-lists per project once LiteLLM keys exist.
7. Brand theme as a product default — separate from Projects; theme kits are not part of this pack.
