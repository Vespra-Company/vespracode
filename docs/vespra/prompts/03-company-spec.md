# Prompt: Vespra company spec

Use this in a fresh chat to produce one company-level document that maps every part of Vespra, how the parts fit together and in what order they get built. The Phase 1 spec covers the first slice of infrastructure; this covers the whole company.

## How to use it

1. Attach `docs/vespra/PHASE_1_SPEC.md` if the chat accepts files. The prompt carries a summary, so it works without it.
2. Paste everything below the line.
3. Answer the questions it asks. Several things about the business were never written down, and the prompt says so instead of guessing.
4. Save the result as `docs/vespra/COMPANY_SPEC.md` and add it to the Claude Project knowledge.

---

I'm Austin, the founder of Vespra. I want to write the Vespra company spec: one document that says what Vespra is, lists every part I'm trying to build, shows how the parts depend on each other, and puts them in a build order. Product specs for each part will hang off it later, so it needs to be a map, not an encyclopedia.

I'm building alone for now and plan to bring in senior engineers before anything is released publicly. I'm technical but not a full-time engineer. Write for someone smart who is new to the project: plain language, short sections, one clear statement per idea.

Below is everything that has been decided or discussed so far. Some of it is firm, some is an idea, and some important things about the business were never decided. I've marked which is which. Please don't fill the gaps with plausible guesses; ask me.

## Vespra in one paragraph

Vespra is a private developer platform where software is built by people and AI agents working in the same place. A developer writes code in the Vespra editor, stores it in Vespra's Git, has agents review and extend it, reaches every AI model and tool through one gateway, and deploys the result to Vespra's cloud, all under one login, one organization and one bill. I use it first to build Vespra itself, then a small team, then outside organizations.

## The parts

The names are working names. Suggest better ones if you see them.

### 1. Vespra Code (the editor). Exists today.

- A fork of Code OSS (the open-source base of VS Code), kept current by merging upstream releases.
- Has an Agents window and an Agent Host: a separate process that runs coding agents (Copilot SDK, Claude Agent SDK, Codex) behind one protocol, so several agent runtimes work side by side and another can be added.
- Microsoft telemetry is removed. Extensions come from Open VSX. Branded as Vespra Code.
- Runs as a desktop app; the same code can run as a web app with a server-side agent host.
- Ideas, not built: sign in with a Vespra account instead of GitHub; remove the dependency on Copilot; a Vespra theme and design system; a Vespra agent runtime with its own model routing; default skills and instructions shipped with the editor; running agents on Vespra's own remote compute.

### 2. Vespra Gateway (AI models and agent tools). Phase 1 builds the core.

- One endpoint for every model provider and every agent tool. A key decides which models and tools are allowed and how much can be spent. Provider keys never reach a laptop or an agent.
- Phase 1: the open-source gateway Bifrost, with per-key budgets, fallback between providers, and curated bundles of approved tools.
- Later, as a product: users connect their own accounts (GitHub, Google, Slack, Linear and so on) once and every agent can use them without seeing credentials; hosted tool sessions for any agent client; triggers that start agents from outside events; an agent profile (skills, instructions, knowledge) that follows the user into any editor or agent.
- The idea is that configuration stops living inside each agent tool. Cursor, Claude Code, Codex and Vespra Code each get one URL and one key.

### 3. Vespra Git (source hosting and CI). Phase 1 builds it for internal use.

- Self-hosted GitLab with a separate CI runner and backups.
- Agents are attached to it: every merge request is reviewed by a code review agent and a security review agent.
- Not decided: whether Git hosting is offered to customers as a product, or stays internal while customers connect their own repositories.

### 4. Vespra Agents (the agent platform). Phase 1 builds the engine and two agents.

- One engine runs agents for the internal team and, later, for customers. Organizations are kept apart by an organization identifier on all data and by the tool bundle each is given.
- An agent is a definition: instructions, a model, a set of tools and a trigger. A run is one execution in a disposable sandbox.
- First agents: merge request code review and security review. Discussed for later: coding agents, bug-fixing agents, and agents customers define themselves.
- The program that drives the model inside a run is swappable, so different agent runtimes and my own models can be used.

### 5. Vespra Cloud (deploying apps, databases and models). Later.

- The intent is something like Vercel for Vespra users: deploy an app from a repository, get a database, run it on infrastructure they don't have to manage, possibly on their own cloud account.
- Discussed: managed PostgreSQL including vector search for AI features; hosting open-weight and custom AI models on GPUs; letting customers bring their own cloud.
- For now there is only an internal PaaS (Coolify) for my own tools. The customer version will be built on Vespra's own control plane, not on that tool.
- Not decided: what the first customer-facing cloud feature is.

### 6. Vespra Identity (login and organizations). Phase 1 builds it.

- One login for every part, using the open-source identity provider Logto. Organizations with roles (owner, admin, member). Machine identities for services and agents.
- An individual and a company are the same shape: a person gets a personal organization.

### 7. Control plane and consoles. Phase 1 builds the core API.

- Vespra's own API that records organizations, members, keys, budgets, policy, agents, usage and audit, and directs the other parts.
- Two front ends on the same API: an internal admin console for the Vespra team and a customer console with a subset of pages.

### 8. Vespra Projects (issue tracking). Idea.

- A Linear-like tracker built on Vespra's own stack, modelled on the open-source tracker Plane.
- The point is the loop: a work item starts an agent run, the run opens a merge request, and status is written back to the work item.

### 9. Marketplace. Idea.

- Two different things: a catalogue of editor extensions, and a catalogue of agent capabilities (bundles of skills, agents and tools).

### 10. Vespra Models. Idea.

- Serving my own or open-weight models, including generative models, on GPUs, registered in the gateway like any other provider.
- Deferred until usage makes hosting cheaper than paying per token.

### 11. Documentation.

- A documentation site at `docs.vespra.cloud`. The editor already links to it.

## What is shared by every part

- **Organizations.** Everything is owned by an organization. The Vespra team is just an organization with broader permissions.
- **Keys and budgets.** One key covers models and tools and carries a spending limit.
- **Audit and usage.** Every change and every model or tool call is recorded per organization, so billing can be added without changing how usage is captured.
- **Isolation.** The database itself refuses to return another organization's rows.

## Principles already agreed

In priority order when they conflict:

1. Security and privacy first. Customer code and credentials live here.
2. Low fixed cost while there are no customers.
3. Simple enough for one person to run.
4. Multi-tenant from the first schema, so adding customers is not a rewrite.
5. Open source and self-hosted where that protects privacy, with no licence fees beyond infrastructure. Managed services where self-hosting adds work without adding control.
6. Every part replaceable behind Vespra's own API.

## Infrastructure decisions already made (Phase 1)

These are settled in the Phase 1 spec. Refer to them; don't redesign them.

- Home cloud: Google Cloud, one region. Edge: Cloudflare. Everything defined in OpenTofu.
- Git: self-hosted GitLab. AI and tool gateway: Bifrost. Identity: Logto. Internal PaaS: Coolify on a separate server.
- Data: PostgreSQL with vector search on Cloud SQL. Secrets: Google Secret Manager. Compute: Cloud Run, with Cloud Run Jobs as agent sandboxes. Queues: Cloud Tasks. Logs and alerts: Google Cloud's own.
- Considered and rejected: Kong Konnect, Gravitee Enterprise, LiteLLM, Clerk, Auth0, Keycloak (kept as a fallback), Vault-style secret managers, Kubernetes.
- Domains: `vespra.io` for brand and product, `vespra.cloud` for infrastructure.

## The build order so far

- **Phase 1, internal platform** (specified, not built): foundation, AI gateway, Git and CI, identity, internal PaaS, control plane core, two review agents.
- **Phase 2, product for others**: customer sign-up and console, connected accounts, hosted tool sessions, triggers, billing, the editor signing in to the platform, more agents.
- **Phase 3, Vespra Cloud for customers**: deploying apps, databases and models; other clouds; GPUs.
- **Phase 4, enterprise readiness**: compliance audit, single sign-on for customers, high availability, a second region.

Phases are defined by what works at the end of each, not by dates.

## What was never decided

I don't have answers written down for these, and the company spec needs them. Please interview me on them before writing: one question at a time, most important first, and tell me the answer you would lean towards and why before I reply. Stop when you have enough to write a useful first version; mark anything still open as an open question in the document.

- Who the first outside customer is: individual developers, startups, agencies, or larger companies with privacy requirements.
- What Vespra is in one sentence to that customer, and what it is compared against (an AI editor, a Git host, a deployment platform, a tool gateway, or the combination).
- Which parts are products people pay for, which are features of another part, and which stay internal.
- The business model: subscription per seat, usage-based, or both; and which usage is metered.
- Whether any of Vespra's own code is open source.
- What "private" promises concretely: where data is stored, who can see it, whether customers can self-host or bring their own cloud.
- Which part I should be able to show someone first.
- The team I expect to need and in what order.
- Company basics: legal entity, funding, and anything that constrains spending.

## What I want back

One Markdown document I can save as `docs/vespra/COMPANY_SPEC.md`, with these sections:

1. **Vespra in brief.** What it is, who it is for, and why it is different, in under 150 words.
2. **Principles.** The priorities above, adjusted by anything you learn in the interview.
3. **Product map.** A Mermaid diagram of the parts and their dependencies, and a table with one row per part: what it is, who uses it, status (exists, Phase 1, later, idea), and what it depends on.
4. **One page per part.** The problem it solves, who it is for, what is in scope now and later, what is explicitly not in scope, what it depends on, which phase it belongs to, and its open questions. Keep each to a page.
5. **Shared platform.** The capabilities every part relies on, stated once.
6. **Glossary.** One agreed meaning for each term that shows up across parts, such as organization, agent, run, key, tool bundle and control plane. Flag any word being used for two different things.
7. **Roadmap.** The phases, what each delivers, and the test that shows it is done. No dates.
8. **Decided and undecided.** Two lists. For each undecided item, say who decides and what it blocks.
9. **Risks.** The handful that could sink the company or a phase, with what reduces each.

Two things I'd value beyond the document. First, tell me where the scope is too wide for a solo founder and what you would cut or postpone, with your reasoning. Second, tell me where two parts overlap or where a part is really a feature of another.

Keep the whole document readable in one sitting. Where a part is only an idea, a short honest entry is better than an invented plan.
