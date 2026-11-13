# Vespra stack alternatives (primary sources)

**Audience:** solo founder, private multi-tenant developer agent factory (Git + AI + agents + MCP), budget + privacy first.  
**Method:** official docs, GitHub LICENSE/README, first-party pricing only.  
**Verdict key:** **KEEP** stay with plan · **SWITCH** change now · **WATCH** viable later / monitor.

---

## 1. Git — planned: GitLab FOSS Omnibus (dedicated VM)

| Option | License | Tradeoff (primary) | Sources |
| --- | --- | --- | --- |
| **GitLab CE / FOSS** | MIT Expat (app); Omnibus package sources Apache-2.0 | Full self-managed DevSecOps; you own ops + DB; FOSS = proprietary-stripped mirror | [gitlab-foss](https://gitlab.com/gitlab-org/gitlab-foss), [licensing](https://docs.gitlab.com/development/licensing/), [package licensing](https://docs.gitlab.com/administration/package_information/licensing/), [install](https://about.gitlab.com/install/) |
| **GitLab Free (EE package, Free tier)** | Free features MIT-path; EE bits proprietary | Same Free feature set as CE; in-place path to paid tiers — GitLab partners recommend EE Free over CE unless license mandate | [handbook CE vs EE](https://handbook.gitlab.com/handbook/resellers/partner-enablement/partner-implementation-services/) |
| **Gitea** | MIT | Much lighter Git+CI; far less built-in MR security / enterprise CI surface than GitLab | [go-gitea/gitea LICENSE](https://github.com/go-gitea/gitea/blob/main/LICENSE), [README](https://github.com/go-gitea/gitea) |
| **Forgejo** *(plan: NOT)* | Open-source forge (Gitea fork) | Lighter politics/community fork; still not GitLab-class CI/security product depth | [forgejo.org](https://forgejo.org/) |

**Rec: KEEP** GitLab self-managed for MR review agents + CI. Prefer **GitLab Free EE package** over pure FOSS unless policy requires MIT-only tree. Do **not** switch to Forgejo/Gitea unless GitLab VM cost/ops becomes the bottleneck.

---

## 2. Internal PaaS — planned: Coolify

| Option | License | Tradeoff | Sources |
| --- | --- | --- | --- |
| **Coolify** | Apache-2.0; self-host = all features free | SSH-driven multi-server PaaS; you patch/upgrade the control plane | [LICENSE](https://raw.githubusercontent.com/coollabsio/coolify/HEAD/LICENSE), [self-hosted](https://coolify.io/self-hosted), [GitHub](https://github.com/coollabsio/coolify) |
| **Dokploy** | Apache-2.0 core; `/proprietary` source-available | Similar PaaS; SSO/advanced RBAC may sit behind paid proprietary dirs | [LICENSE.MD](https://github.com/Dokploy/dokploy/blob/main/LICENSE.MD), [license blog](https://dokploy.com/blog/we-are-updating-dokploys-open-source-license) |
| **CapRover** | Apache-2.0 (repo) | Simpler Docker+nginx PaaS; fewer “one-click” modern DX features than Coolify | [caprover/caprover](https://github.com/caprover/caprover) |
| **Coolify Cloud** | Managed (paid) | Same product, less ops — costs money vs free self-host | [Coolify README cloud table](https://github.com/coollabsio/coolify) |

**Rec: KEEP** Coolify on GCE for stateful/internal apps. Skip Dokploy unless you need their roadmap; avoid paying Coolify Cloud early.

---

## 3. API gateway — planned: Apache APISIX

| Option | License | Tradeoff | Sources |
| --- | --- | --- | --- |
| **Apache APISIX** | Apache-2.0 | High-perf dynamic gateway + **built-in AI/LLM plugins**; etcd ops cost | [apisix.apache.org](https://apisix.apache.org/), [apache/apisix](https://github.com/apache/apisix) |
| **Kong Gateway (OSS)** *(not Konnect)* | Apache-2.0 | Mature plugin ecosystem; Konnect is the paid SaaS plane you already rejected | [Kong LICENSE](https://raw.githubusercontent.com/Kong/kong/master/LICENSE), [Kong/kong](https://github.com/Kong/kong) |
| **Gravitee APIM CE** *(EE NOT)* | Apache-2.0 CE | Full APIM+AM; MCP/agent modules are **Enterprise** | [gravitee research notes](./gravitee.md), [pricing](https://www.gravitee.io/pricing) |
| **Cloud Run + Cloudflare** (defer gateway) | Managed | Zero gateway VM until you need multi-service policy; less L7 control | [Cloud Run](https://cloud.google.com/run), [Cloudflare](https://developers.cloudflare.com/) |

**Rec: WATCH / soft KEEP.** APISIX is sound, but a solo founder may **defer** it until you have many public APIs. Prefer Cloudflare + Cloud Run + Bifrost first; add APISIX when you need unified non-AI API policy. Still avoid Kong Konnect / Gravitee EE.

---

## 4. AI / MCP gateway — planned: Bifrost (Maxim)

| Option | License | Tradeoff | Sources |
| --- | --- | --- | --- |
| **Bifrost** | Apache-2.0 OSS; Enterprise extras (guardrails, clustering, IdP…) | LLM + **MCP gateway** + virtual keys/budgets in one binary | [maximhq/bifrost](https://github.com/maximhq/bifrost), [LICENSE](https://github.com/maximhq/bifrost/blob/main/LICENSE), [docs](https://docs.getbifrost.ai/overview), [MCP page](https://www.getmaxim.ai/mcp-gateway) |
| **LiteLLM** | MIT (excl. `enterprise/`) | Fastest path to multi-provider proxy; Python; enterprise dir commercial | [LICENSE](https://raw.githubusercontent.com/BerriAI/litellm/main/LICENSE), [BerriAI/litellm](https://github.com/BerriAI/litellm) |
| **Portkey Gateway** | MIT | Self-host routing/fallbacks/guardrails; broader Portkey platform is commercial | [Portkey-AI/gateway LICENSE](https://raw.githubusercontent.com/Portkey-AI/gateway/main/LICENSE) |
| **agentgateway** | Apache-2.0 (LF) | MCP/A2A-native proxy; newer; strong fit if MCP traffic dominates | [agentgateway/agentgateway](https://github.com/agentgateway/agentgateway), [LICENSE](https://github.com/agentgateway/agentgateway/blob/main/LICENSE) |
| **Agent Router** (ex-Envoy AI Gateway) | Apache-2.0 | Envoy-based AI control plane; heavier if you’re not already on Envoy/K8s | [theagentrouter/agent-router](https://github.com/theagentrouter/agent-router), [LICENSE](https://github.com/envoyproxy/ai-gateway/blob/main/LICENSE) |

**Rec: KEEP** Bifrost as the AI/MCP control plane. **WATCH** LiteLLM if you need a thinner proxy tomorrow; **WATCH** agentgateway for MCP-heavy evolution. Don’t run Bifrost *and* Cloudflare AI Gateway *and* APISIX AI plugins in Phase 1.

---

## 5. Edge — planned: Cloudflare (DNS / WAF / AI Gateway)

| Option | License / model | Tradeoff | Sources |
| --- | --- | --- | --- |
| **Cloudflare DNS + WAF** | Managed | Best cheap edge shield; DNS already assumed | [Cloudflare docs](https://developers.cloudflare.com/) |
| **Cloudflare AI Gateway** | Managed (all plans) | Analytics, cache, fallbacks — **third hop** if Bifrost already does this | [AI Gateway](https://developers.cloudflare.com/ai-gateway/) |
| **GCP Cloud Armor + Cloud DNS** | Managed | Keeps traffic in GCP; usually more expensive/complex than CF for a solo founder | [Cloud Armor](https://cloud.google.com/armor), [Cloud DNS](https://cloud.google.com/dns) |
| **Skip AI Gateway feature** | — | Use CF only for DNS/WAF/CDN; terminate AI at Bifrost | same |

**Rec: KEEP** Cloudflare for DNS/WAF. **SWITCH** Phase-1 AI path: do **not** enable CF AI Gateway until Bifrost proves insufficient (avoids double proxy + split observability).

---

## 6. Auth — undecided: Clerk vs Logto (also Keycloak)

| Option | License / pricing | Tradeoff | Sources |
| --- | --- | --- | --- |
| **Clerk** | Managed SaaS | Fastest DX; Hobby free → Pro **$25/mo**; user data leaves your VPC; MRU billing | [clerk.com/pricing](https://clerk.com/pricing) |
| **Logto Cloud** | Managed; Free / Pro from **$24/mo** + tokens/add-ons | Orgs/MFA/SSO as add-ons; still a vendor | [logto.io/pricing](https://logto.io/pricing) |
| **Logto OSS** | MPL-2.0 (`packages/cloud` Elastic-2.0) | Self-host OIDC + orgs/RBAC; console multi-admin limited vs Cloud | [LICENSE](https://github.com/logto-io/logto/blob/master/LICENSE), [OSS docs](https://docs.logto.io/logto-oss), [GitHub](https://github.com/logto-io/logto) |
| **Keycloak** | Apache-2.0 | Battle-tested IdP; heavier ops/UI for a solo founder | [keycloak.org](https://www.keycloak.org/), [LICENSE](https://raw.githubusercontent.com/keycloak/keycloak/main/LICENSE.txt) |
| **authentik** | MIT (+ enterprise dir) | Modern IdP UX; open-core enterprise path | [LICENSE](https://raw.githubusercontent.com/goauthentik/authentik/main/LICENSE) |

**Rec: SWITCH → Logto OSS** for privacy + multi-tenant orgs on your infra. Use **Clerk** only if auth must ship in days and privacy of IdP data is acceptable. Keycloak = WATCH if you outgrow Logto federation needs.

---

## 7. DB — planned: Cloud SQL Postgres + pgvector; Redis/Valkey; GitLab own DB

| Option | License / model | Tradeoff | Sources |
| --- | --- | --- | --- |
| **Cloud SQL Postgres + pgvector** | Managed | Supported extension on Cloud SQL; ops shared with GCP | [Cloud SQL extensions (pgvector)](https://cloud.google.com/sql/docs/postgres/extensions), [pgvector](https://github.com/pgvector/pgvector) |
| **Neon** | Managed Postgres | Scale-to-zero + DB-per-tenant economics; Free tier; data outside your VPC | [neon.tech/pricing](https://neon.tech/pricing) |
| **Valkey** | BSD (Linux Foundation) | Redis-compatible without Redis Source Available License drama | [valkey.io](https://valkey.io/) |
| **Memorystore for Valkey** | Managed GCP | Less Redis ops; GCP-native | [valkey.io participants (GCP)](https://valkey.io/) |
| **GitLab bundled Postgres** | Part of Omnibus | Keep **separate** from app Cloud SQL (GitLab docs pattern) | [GitLab Omnibus](https://about.gitlab.com/install/) |

**Rec: KEEP** Cloud SQL + pgvector for the control plane. Prefer **Valkey** (Memorystore or self-host) over Redis Stack licensing. **WATCH** Neon for per-tenant/agent DBs later. Keep GitLab’s DB isolated on the GitLab VM.

---

## 8. Compute — planned: GCP primary; Cloud Run APIs; GCE for Coolify/GitLab

| Option | Model | Tradeoff | Sources |
| --- | --- | --- | --- |
| **GCP + Cloud Run + GCE** | Managed / VM | Good default for privacy regions + IAM; Coolify/GitLab need VMs | [Cloud Run](https://cloud.google.com/run), [Compute Engine](https://cloud.google.com/compute) |
| **Fly.io Machines** | Managed | Great for edge sandboxes; another cloud bill/account | [fly.io](https://fly.io/) |
| **All-in on Cloud Run** (no Coolify) | Managed | Fewer VMs; worse for arbitrary Docker Compose / long-lived sidecars | Cloud Run docs |
| **E2B Embed / BYOC** | Apache embed / Enterprise BYOC | Sandboxes on your cloud later | [e2b.dev](https://www.e2b.dev/) |

**Rec: KEEP.** Don’t multi-cloud in Phase 1.

---

## 9. IaC — planned: OpenTofu / Terraform

| Option | License | Tradeoff | Sources |
| --- | --- | --- | --- |
| **OpenTofu** | MPL-2.0 | Drop-in Terraform workflows under OSI license; LF stewardship | [opentofu.org](https://opentofu.org/), [LICENSE](https://raw.githubusercontent.com/opentofu/opentofu/main/LICENSE) |
| **Terraform** | BSL (HashiCorp) | Familiar; BSL restricts competitive embedding/use cases | [opentofu FAQ on BUSL](https://opentofu.org/) |
| **Pulumi** | Apache-2.0 engine (product tiers) | Real languages; another mental model | [pulumi.com](https://www.pulumi.com/) |

**Rec: KEEP OpenTofu.** Avoid new Terraform BSL risk for a product company.

---

## 10. Agents — planned: custom control plane + OpenSandbox / E2B-class; Git MR agents

| Option | License / pricing | Tradeoff | Sources |
| --- | --- | --- | --- |
| **Custom control plane** | Your IP | Required for multi-tenant product differentiation | — |
| **E2B Cloud** | Managed; Hobby $0 + credits; Pro **$150/mo** + usage | Fastest microVM sandboxes; SOC2; data on E2B unless BYOC | [e2b.dev](https://www.e2b.dev/), [pricing](https://www.e2b.dev/pricing) |
| **E2B Embed** | Apache-2.0 single-node package | Self-host Firecracker path; ops heavy | [e2b.dev](https://www.e2b.dev/) |
| **OpenSandbox** | Apache-2.0 | Self-host agent sandbox runtime; newer/maturing | [alibaba/OpenSandbox LICENSE](https://github.com/alibaba/OpenSandbox/blob/main/LICENSE), [repo](https://github.com/alibaba/OpenSandbox) |
| **GitLab CI runners** (for MR bots) | MIT/CE | Native to Git choice; not full interactive agent VMs | GitLab docs |

**Rec: KEEP** custom plane. **Phase 1: E2B Hobby/Pro** for speed; **WATCH/parallel** OpenSandbox or E2B Embed when privacy demands in-VPC isolation. Wire MR review agents to GitLab first.

---

## 11. Models — planned: Vertex + Bedrock/Anthropic; Together/Fireworks OSS; Baseten later

| Layer | Role | Tradeoff | Sources |
| --- | --- | --- | --- |
| **Vertex AI** | GCP-native Gemini/etc. | Same cloud IAM/billing as compute | [Vertex AI](https://cloud.google.com/vertex-ai) |
| **Bedrock / Anthropic** | Claude + AWS catalog | Best quality mix; second cloud account/keys | Provider first-party consoles |
| **Together / Fireworks** | Hosted OSS models | Cheaper bulk inference | Provider pricing pages |
| **Baseten** | Later model hosting | Defer until you need custom deployments | baseten.co |
| **Via Bifrost** | One OpenAI-compatible front | Failover/budgets without app rewrites | [Bifrost providers](https://docs.getbifrost.ai/overview) |

**Rec: KEEP** multi-provider behind Bifrost. Don’t add Baseten until utilization justifies it.

---

## 12. Secrets — planned: headless vault (GCP SM / OpenBao)

| Option | License / pricing | Tradeoff | Sources |
| --- | --- | --- | --- |
| **GCP Secret Manager** | Managed; free tier (6 versions, 10k accesses) then low $ | Enough for Phase 1; IAM-native; no extra binary | [overview](https://docs.cloud.google.com/secret-manager/docs/overview), [pricing](https://cloud.google.com/secret-manager/pricing) |
| **OpenBao** | MPL-2.0 (LF OpenSSF Vault fork) | Dynamic secrets/leases when you outgrow SM | [openbao.org](https://openbao.org/), [LICENSE](https://raw.githubusercontent.com/openbao/openbao/main/LICENSE) |
| **HashiCorp Vault** | BSL (modern) | Feature-rich; license friction vs OpenBao | OpenBao FAQ framing on Vault fork |

**Rec: SWITCH (simplify) → GCP Secret Manager only in Phase 1.** Add OpenBao when you need dynamic DB creds / broad lease revocation.

---

## Explicit non-choices (confirm)

| Avoided | Why (primary) | Sources |
| --- | --- | --- |
| Kong Konnect | Paid control plane; OSS Kong alone is enough if needed | Kong product split |
| Gravitee EE | MCP/agent features paid; from **$2,500/mo** class | [gravitee pricing](https://www.gravitee.io/pricing), [./gravitee.md](./gravitee.md) |
| Forgejo | Lighter forge; weaker fit vs GitLab for agentic MR/CI | forgejo.org |
| Dify as product core | App builder, not your control plane | — |

**Rec: KEEP avoiding these.**

---

## Phase 1 missing tools (only if truly needed)

| Need | Lean pick | Why Phase 1 | Source |
| --- | --- | --- | --- |
| Object storage | **GCS** | Artifacts, sandbox uploads, backups | [Cloud Storage](https://cloud.google.com/storage) |
| Async jobs / queue | **Cloud Tasks** or **Pub/Sub** | Agent runs, webhooks, MR bot fan-out | [Cloud Tasks](https://cloud.google.com/tasks), [Pub/Sub](https://cloud.google.com/pubsub) |
| Observability | **Cloud Logging + Monitoring** (+ optional Grafana OSS later) | Don’t stand up full LGTM day one | [Cloud Operations](https://cloud.google.com/products/operations) |
| Transactional email | **Amazon SES** or **Resend**/SMTP via Logto connectors | Auth magic links, invites | Logto connector docs; SES/Resend first-party |
| Backups | GCS + Cloud SQL backups + GitLab backup cron | Privacy product without restore = liability | Cloud SQL / GitLab admin docs |

Skip for Phase 1: dedicated Kafka, full APM SaaS, second PaaS, second AI gateway.

---

## Blunt close

**Bones are sound** (GCP + GitLab + Coolify + Bifrost + OpenTofu + Valkey). **Too many control planes for one founder.**

**Make these 1–3 swaps:**

1. **Auth → Logto OSS** (not Clerk) for privacy + orgs.  
2. **Secrets → GCP SM only**; defer OpenBao.  
3. **Defer APISIX and Cloudflare AI Gateway**; ship Cloudflare DNS/WAF + Cloud Run + **one** AI/MCP gateway (Bifrost).

Optional fourth: install **GitLab Free EE package** instead of FOSS-only for an easier upgrade path.
