# Vespra Phase-1 plan — gap review

**Style:** short challenge + defaults, not a second architecture doc.  
**Plan source:** locked Phase-1 decisions in the query (API+AI gateway + GitLab same sprint; Coolify internal; GitLab FOSS Omnibus on dedicated VM; APISIX + Bifrost + Cloudflare AI Gateway; Cloud SQL + `org_id`; agents = one platform, review+security first).  
**Product facts:** cited to vendor docs below.

---

## 1. Undecided → defaults

| # | Question | Default | 1-line why |
|---|---|---|---|
| 1 | Clerk Hobby vs Logto OSS | **Clerk Hobby** | Free, 50k MRU/app, zero IdP ops while founder+future team only; Logto OSS adds Postgres+deploy+console limits ([Clerk pricing](https://clerk.com/pricing), [Logto OSS](https://docs.logto.io/logto-oss)). Swap to dedicated IdP later as plan already allows. |
| 2 | Coolify on GCP vs Hetzner | **Hetzner** | Coolify docs recommend Hetzner and can **provision** Hetzner (not GCP); keep Coolify off GCP so GCP stays Cloud SQL / later Cloud Run ([Coolify self-host](https://coolify.io/docs/start-with-self-hosted), [provision cloud server](https://coolify.io/docs/core/infrastructure/servers/provision-cloud-server)). |
| 3 | Agent roadmap beyond review+security | **Freeze:** Git review + security agents only through Phase 1 | Plan already scopes “review+security first”; extra agents are product surface without customers. |
| 4 | Day-one model provider keys | **Anthropic + OpenAI only**, keyed in Secret Manager, routed via Bifrost → Cloudflare AI Gateway | Bifrost unifies providers ([Bifrost](https://docs.getbifrost.ai/overview)); CF AI Gateway adds cache/rate-limit/logs on all plans ([CF AI Gateway](https://developers.cloudflare.com/ai-gateway/)). Add Bedrock/Vertex when a real workload needs them. |
| 5 | DNS: `vespra.io` vs `vespra.cloud` | **Brand + user on `vespra.io`**; **infra on `*.vespra.cloud`** | Matches prior gateway sketch (`gateway.vespra.cloud`); keep `io` clean for product/marketing ([gateway plan](../vespra/discussions/2026-10-25-vespra-gateway-plan.md)). |
| 6 | Phase 2 Zeabur / vCluster | **No Phase-1 interest** | Customer compute is deferred to control plane → Cloud Run/OpenTofu; Zeabur/vCluster are parallel PaaS/K8s-tenancy bets ([Zeabur pricing](https://zeabur.com/pricing), [vCluster OSS vs Free](https://www.vcluster.com/docs/vcluster/introduction/oss-vs-free)). |

---

## 2. Missing-aspects checklist (Phase 1)

| Aspect | Status | Note |
|---|---|---|
| API + AI edge (APISIX / Bifrost / CF AI Gateway) | **Covered** | Locked stack; Kong explicitly not primary. |
| GitLab FOSS Omnibus (dedicated VM) | **Partial** | Omnibus = GitLab app; **runners are separate** and should not share the Omnibus host ([GitLab Runner install / FOSS guidance](https://docs.gitlab.com/runner/), [FOSS requirements](https://gitlab.com/gitlab-org/gitlab-foss/-/blob/master/doc/install/requirements.md)). |
| Coolify as internal PaaS only | **Covered** | Customer compute deferred. |
| Cloud SQL + `org_id` shared cell | **Partial** | Schema tenancy named; RLS/row filters, private IP, IAM DB auth not specified. |
| IdP (Clerk default) | **Partial** | Product auth covered; M2M / service accounts for agents+gateways not locked. |
| Multi-tenant isolation | **Partial** | Shared cell + `org_id`; no network/cell isolation until dedicated cells. |
| Secrets storage | **Partial** | Implied (providers/IdP); **rotation + break-glass** missing. |
| Cost caps / AI budgets | **Partial** | Bifrost virtual keys + CF rate limits exist as products; **org-level hard caps in control plane** not specified ([Bifrost](https://docs.getbifrost.ai/overview), [CF AI Gateway](https://developers.cloudflare.com/ai-gateway/)). |
| Backup / DR | **Partial** | Cloud SQL can do automated backups + PITR if enabled ([Cloud SQL PITR](https://docs.cloud.google.com/sql/docs/postgres/backup-recovery/pitr)); GitLab Omnibus + Coolify volumes + runner caches have **no** restore RTO/RPO. |
| Networking / private paths | **Missing** | VPC, private Cloud SQL, CF ↔ origin auth, GitLab public exposure model unspecified. |
| Observability | **Missing** | No metrics/logs/traces/alerts owner across APISIX, Bifrost, Coolify, GitLab, agents. |
| CI runners | **Missing** | Not in locked plan; required for GitLab CI ([Runner docs](https://docs.gitlab.com/runner/)). |
| Secrets rotation | **Missing** | Provider keys, GitLab tokens, Coolify SSH, DB creds. |
| Compliance (Vanta etc.) | **Missing** | Explicitly later — fine; don’t pretend Phase 1 is audit-ready. |
| MCP supply chain | **Missing** | Allowlist, signing, egress policy for MCP tools/servers. |
| Email / notifications | **Missing** | Auth email via Clerk; ops alerts (page/Slack) unset. |
| Artifact registry | **Missing** | Where agent/images/binaries land (GHCR vs GAR vs GitLab registry). |
| Status page | **Missing** | Skip for no-customers Phase 1, but note gap. |
| DX (local/dev bootstrap) | **Missing** | One-command env, seed org, fake keys. |
| Security hardening baseline | **Partial** | FOSS GitLab + gateways named; WAF, SSO for admin UIs, audit log sink unset. |

---

## 3. Top 10 gaps before build (ranked)

1. **Threat model + trust boundaries** — who can hit GitLab, Coolify, APISIX admin, Bifrost, Cloud SQL; public vs private.
2. **GitLab Runner VM(s)** — separate from Omnibus; docker executor; no shell-on-Omnibus ([FOSS/Runner guidance](https://docs.gitlab.com/runner/)).
3. **Network sketch** — VPC, private IP Cloud SQL, Cloudflare → origin auth, firewall ports for Coolify/GitLab.
4. **Secret store + rotation runbook** — GCP Secret Manager (or equivalent) for provider keys, IdP secrets, DB; 90-day rotation owner.
5. **`org_id` enforcement contract** — every API/DB path filters by org; internal agents = special org; integration test that proves no cross-tenant reads.
6. **AI spend hard caps** — Bifrost budgets + CF rate limits wired to org; kill switch when over budget ([Bifrost](https://docs.getbifrost.ai/overview), [CF AI Gateway](https://developers.cloudflare.com/ai-gateway/)).
7. **Backup/restore drill for Omnibus + Coolify volumes** — Cloud SQL PITR alone is not DR; define RPO for GitLab.
8. **Observability minimum** — structured logs + one metrics stack + alert on 5xx/token burn/GitLab down.
9. **MCP allowlist policy** — only named servers/tools; no arbitrary remote MCP in Phase 1.
10. **Hostname map committed** — `app|api|auth.vespra.io` vs `gateway|gitlab|coolify|status?.vespra.cloud` in DNS + cert plan.

---

## 4. What NOT to add yet

- Customer Cloud Run / OpenTofu control plane  
- Dedicated cells / BYO cloud / Vanta  
- Kong (or Gravitee EE) as primary gateway ([Gravitee research](./gravitee.md))  
- Zeabur, vCluster, multi-cloud Coolify  
- Broad agent catalog past review + security  
- Extra model providers beyond Anthropic + OpenAI  
- Public status page, marketing multi-region, compliance theater  

---

## Sources (primary)

| Claim | Source |
|---|---|
| Clerk Hobby free / 50k MRU | https://clerk.com/pricing |
| Logto OSS self-host + feature limits | https://docs.logto.io/logto-oss |
| Coolify recommends Hetzner; provisions Hetzner/DO/Vultr/Hostinger | https://coolify.io/docs/start-with-self-hosted , https://coolify.io/docs/core/infrastructure/servers/provision-cloud-server |
| APISIX AI gateway | https://apisix.apache.org/ai-gateway/ |
| Bifrost unified AI gateway | https://docs.getbifrost.ai/overview |
| Cloudflare AI Gateway features | https://developers.cloudflare.com/ai-gateway/ |
| GitLab Runner separate from GitLab app | https://docs.gitlab.com/runner/ |
| Cloud SQL backups / PITR | https://docs.cloud.google.com/sql/docs/postgres/backup-recovery/pitr |
| Zeabur / vCluster (defer) | https://zeabur.com/pricing , https://www.vcluster.com/docs/vcluster/introduction/oss-vs-free |
