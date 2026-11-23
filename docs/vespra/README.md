# Vespra docs

Everything specific to the Vespra Code fork lives here. Upstream Code OSS documentation and coding guidelines stay in `.github/` and are still authoritative for code style.

| Start here | Purpose |
|---|---|
| [AGENT_ONBOARDING.md](AGENT_ONBOARDING.md) | Read first. What the fork is, how to build and run it, fork rules, workflow, past mistakes, current state |
| [ARCHITECTURE_BLUEPRINT.md](ARCHITECTURE_BLUEPRINT.md) | Full architecture reference across all processes and subsystems. Section 18 lists every intentional difference from upstream |
| [discussions/](discussions/README.md) | Dated working notes, Q&A, research. Indexed in its README |
| [features/](features/README.md) | Roadmap tracker: `ideas.md` -> `planned.md` -> `implemented.md` |

Conventions in one paragraph: one dated file per discussion topic with a `Status:` line; move feature entries forward between the three lists instead of duplicating them; when something in the fork delta changes, update the blueprint table and `features/implemented.md` in the same PR; never commit generated folders, secrets, or installed tools.
