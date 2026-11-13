# GitLab CE vs EE (self-managed)

**Date:** 2026-11-13  
**Method:** GitLab first-party pages only.  
**Verdict for Vespra:** install the **Enterprise Edition package on the Free tier** (no licence). Do not install Community Edition unless a policy requires an MIT-only tree.

## Short answer

| | Community Edition (CE) | Enterprise Edition (EE) on Free |
|---|---|---|
| Cost | $0 | $0 |
| Free features | Same | Same |
| Upgrade to Premium/Ultimate later | Convert the package first, then activate | Activate a licence in place |
| Registration Features program | Not available | Optional |
| Licence of Free code | MIT | Free features are the open-source set; paid feature code is present but inactive without a licence |

**Pick EE Free.** GitLab's own guidance for new self-managed installs is to choose EE even when you plan to stay on Free, unless you are required to run CE for licence-policy reasons.

## What "CE" and "EE" actually mean

They are **distributions** (packages), not **tiers**.

- **Tiers:** Free, Premium, Ultimate (what features you can use).
- **Distributions:** CE package vs EE package (what you install).

EE without a subscription runs Free features only. You are not "on Enterprise" in the paid sense until you activate a licence.

Sources: [GitLab Community Edition page](https://about.gitlab.com/gitlab-community-edition/), [Handbook: tiers](https://handbook.gitlab.com/handbook/marketing/product-and-technical-marketing/product-and-solution-marketing/tiers/), [Handbook: partner implementation](https://handbook.gitlab.com/handbook/resellers/partner-enablement/partner-implementation-services/).

## Why not CE for Vespra

1. Same Free feature set as EE Free.
2. If Vespra ever buys Premium or Ultimate, CE requires a package conversion and migration; EE only needs an activation code.
3. No Vespra policy currently requires MIT-only tree.
4. Phase 1 already locked "GitLab Free (Enterprise Edition package, no licence)" in `docs/phases/PHASE_1_SPEC.md`.

## Install note

Use the Omnibus / Linux package for EE. Install a separate GitLab Runner on a different machine. See [Install GitLab using the Linux package](https://docs.gitlab.com/install/package/) and [installation requirements](https://docs.gitlab.com/install/requirements/).
