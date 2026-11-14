# Ideas

Unordered. Seeded from the [2026-10-20 platform discussion](../discussions/2026-10-20-platform-questions.md); edit freely.

## Identity and auth
- **Vespra login** — own auth provider extension (OIDC/PKCE, possibly Auth0); remove GitHub/Microsoft sign-in prompts.
- **Remove Copilot dependency** — drop `defaultChatAgent`, stop registering `CopilotAgent`, Claude native + BYOK.

## Design system
- **Vespra theme** — default color theme, product icon theme, UI font.
- **Component restyle** — pass over `src/vs/base/browser/ui/*` CSS.

## Extensions and marketplace
- **Marketplace** — Open VSX (public or self-hosted) vs own gallery; relax the `hygiene.ts` check.
- **Curated built-ins** — vendor selected VSIXes as non-removable built-ins.
- **Plugin marketplace** — Vespra `marketplace.json` of skills/agents/MCP bundles.

## Agents
- **Vespra harness** — fourth `IAgent` implementation (own model routing, or Grok/other SDK).
- **Default skills and instructions** — shipped `.agents/` content for every workspace.
- **Own remote compute** — provision our VMs/containers and run the server-side Agent Host there.

## Project management
- **Vespra Projects** — Linear-like tracker built on our own stack using Plane's data model and tenancy scheme as the blueprint; see the [Plane review](../discussions/2026-10-20-plane-review.md), section 12 for the MVP cut.
- **Projects-as-code CLI** — YAML schema (states, labels, workflows, types) with push/pull against the tracker API, modeled on `plane-compose`.
- **Work item to agent loop** — launch an AHP agent run from a work item, land a PR, write status back; Plane Commercial's Cursor/Claude integration is the prior art.

## Partnerships (evaluate)
- **Kong** — gateway for any hosted backend (model proxy, gallery, hosted Agent Hosts).
- **Vercel** — deploy/logs extension or MCP server; not a hosting target for the app.
- **Harness.io** — CI/CD partnership; agents in pipelines via AHP.
- **Auth0/Okta** — identity provider for Vespra login.
