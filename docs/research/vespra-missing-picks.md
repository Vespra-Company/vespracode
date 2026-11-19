# Vespra — missing Phase-1 picks (definitive)

**Date:** 2026-11-13  
**Method:** primary vendor docs / pricing only.  
**Locked:** CF DNS+WAF (AI Gateway deferred); GitLab FOSS/Free EE Omnibus + separate Runner; Coolify internal; Bifrost KEEP (APISIX soft-defer); GCP + Cloud Run + Cloud SQL/pgvector + OpenTofu + GCS; custom agents; no Kong Konnect / Gravitee EE; no customers yet; budget + privacy; self-host preference strong.

Approx $/mo = software + typical Phase-1 infra; excludes already-locked GitLab/Coolify/Cloud SQL bills unless incremental.

---

## Definitive picks

| # | Need | **Winner** | Why (1 line) | ≈ $/mo | Scale note | Primary |
|---|---|---|---|---|---|---|
| 1 | **Auth** | **Logto OSS** | Self-host + data in your VPC; product orgs/RBAC without SaaS IdP; Clerk has no self-host | **~$5–15** (Coolify slot + Postgres; software $0) | Stay OSS until console multi-admin/SAML>3 force Self-hosted Pro (~$199–249) or Keycloak | [Logto OSS](https://docs.logto.io/logto-oss), [self-hosted plans](https://logto.io/self-hosted-plans), [Clerk pricing](https://clerk.com/pricing) (Hobby free but managed-only), [Keycloak](https://www.keycloak.org/) |
| 2 | **Secrets** | **GCP Secret Manager** | IAM-native to Cloud Run/GCE; no extra control plane; free tier covers early secrets | **~$0–2** (6 versions + 10k accesses free; then ~$0.06/version + $0.03/10k) | Add OpenBao only when you need dynamic leases / broad revocation | [SM pricing](https://cloud.google.com/secret-manager/pricing), [SM overview](https://docs.cloud.google.com/secret-manager/docs/overview), [OpenBao](https://openbao.org/), [Phase self-host](https://docs.phase.dev/self-hosting), [Infisical pricing](https://infisical.com/pricing) |
| 3 | **Email** | **Resend Free → SMTP into Logto** | Auth+ops transactional at $0 (3k/mo, 100/day); Logto OSS has no built-in mail — SMTP connector | **$0** (Pro **$20** when daily cap bites) | At volume, Logto’s native [AWS SES connector](https://docs.logto.io/integrations/aws-ses) (~$0.10/1k à-la-carte) | [Resend pricing](https://resend.com/pricing), [Logto SMTP](https://docs.logto.io/integrations/smtp), [Resend SMTP](https://resend.com/docs/send-with-smtp), [SES pricing](https://aws.amazon.com/ses/pricing/) |
| 4 | **Observability** | **Cloud Logging + Monitoring** (+ uptime checks) | Already on GCP; 50 GiB logs/project free; platform metrics free | **~$0–15** if you stay under free allotments | Defer Grafana Cloud / Datadog / full LGTM until multi-service noise | [Observability pricing](https://cloud.google.com/products/observability/pricing) |
| 5 | **Queue / async** | **Cloud Tasks** | Explicit HTTP target + schedule + rate limits + dedupe for agent jobs & webhooks | **~$0** (1M billable ops/mo free) | Add Pub/Sub when you need fan-out / many subscribers | [Tasks pricing](https://cloud.google.com/tasks/pricing), [Tasks vs Pub/Sub](https://docs.cloud.google.com/pubsub/docs/choosing-pubsub-or-cloud-tasks), [Pub/Sub pricing](https://cloud.google.com/pubsub/pricing) |
| 6 | **GitLab Runner host** | **Separate GCE VM, same VPC** (Docker executor) | GitLab requires Runner off the Omnibus host (security + perf) | **~$15–35** (e2-small/medium class; size to concurrency) | Scale with second Runner or larger machine; never co-locate with Omnibus | [Install Runner](https://docs.gitlab.com/runner/install/), [Register](https://docs.gitlab.com/runner/register/), [GCE pricing](https://cloud.google.com/compute/all-pricing) |
| 7 | **Valkey / Redis** | **Valkey on Coolify** (shared internal VM) | Redis-compatible, no Redis license drama; $0 incremental vs Memorystore | **~$0** incremental (Memorystore pico ≈ **$22**/mo if you flip later) | Move to Memorystore for Valkey when HA/SLA matters | [valkey.io](https://valkey.io/), [Memorystore Valkey pricing](https://cloud.google.com/memorystore/valkey/pricing) |
| 8 | **Extra Phase-1 critical** | **Artifact Registry (GAR)** + **private Cloud SQL** + **GitLab backup cron→GCS** | Gap review: images need a home; DB must not be public; Omnibus DR is not Cloud SQL PITR | **~$0–5** GAR early (0.5 GiB free ≈ $0.10/GiB after); backups = GCS | Don’t buy status-page / Vanta / second registry yet | [GAR pricing](https://cloud.google.com/artifact-registry/pricing), [Cloud SQL PITR](https://docs.cloud.google.com/sql/docs/postgres/backup-recovery/pitr), [gap review](./vespra-plan-gap-review.md) |

---

## Do not buy yet

- Clerk / Logto Cloud / Keycloak cluster  
- Phase / Infisical / OpenBao / HashiCorp Vault  
- Postmark, SES Pro plans, dedicated email IPs  
- Datadog, Grafana Cloud, Honeycomb, full OpenTelemetry SaaS  
- Pub/Sub Lite, Kafka, Redis Cloud, Memorystore (until Coolify Valkey hurts)  
- Cloudflare AI Gateway, APISIX (soft-defer), Kong Konnect, Gravitee EE  
- Coolify Cloud, E2B Pro ($150), Vanta, public status page  

---

## Final Phase-1 stack (recommended)

| Layer | Pick |
|---|---|
| Edge | Cloudflare DNS + WAF |
| Auth | **Logto OSS** (+ Resend SMTP) |
| Secrets | **GCP Secret Manager** |
| Email | **Resend Free** |
| Observability | **Cloud Logging + Monitoring** |
| Async | **Cloud Tasks** |
| Git | GitLab Free EE/FOSS Omnibus VM + **separate Runner GCE** |
| Internal PaaS | Coolify (internal only) |
| AI/MCP | **Bifrost** (APISIX deferred) |
| API compute | Cloud Run |
| DB | Cloud SQL Postgres + pgvector (`org_id`) |
| Cache | **Valkey on Coolify** |
| Objects / images | GCS + **Artifact Registry** |
| IaC | OpenTofu |
| Agents | Custom plane; review + security first; Bifrost VKs |

**Blunt:** prefer infra-bill line items over new SaaS control planes; self-host Logto + Valkey on Coolify; keep secrets/queue/obs on GCP managed.
