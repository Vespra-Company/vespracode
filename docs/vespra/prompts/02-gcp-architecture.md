# Prompt: Google Cloud architecture and naming for Vespra

Use this in a fresh chat to get the Google Cloud layout for Phase 1: folders, projects, names, IAM, network and a priced bill of materials.

## How to use it

1. Run the read-only commands under "Current state" in Cloud Shell and paste their output where the prompt says to. The design is much better when it starts from what actually exists. If you skip this, the chat will work from the notes below, which may be out of date.
2. Attach `docs/vespra/PHASE_1_SPEC.md` if the chat accepts files. The prompt works without it.
3. Paste everything below the line.
4. Save the result as `docs/vespra/GCP_ARCHITECTURE.md` and add it to the Claude Project knowledge.

---

I'm Austin, a solo founder building a developer platform called Vespra. I need you to design my Google Cloud setup: the folder and project structure, a naming convention, access control, the network, and what it will cost. I want it to follow Google's recommended practices, scaled down to what one person can run, with names that someone new could read and understand without a legend.

I'm technical but not a full-time cloud engineer, so explain a term in plain language the first time you use it, and give me one recommended design instead of a menu. Where a choice is close, show the runner-up in a sentence.

## What I'm building

Vespra is a private developer platform: an editor, Git hosting, an AI gateway, an agent platform and, later, a cloud for customers to deploy to. Phase 1 is an internal platform that only I use, built so that a small team and then outside customers can be added without a rewrite. There are no customers yet. Everything is multi-tenant in its data model from the start: every tenant-owned row carries an organization identifier and the database enforces it.

## What runs on Google Cloud in Phase 1

These are decided. Please design around them and don't reopen them unless one of them cannot work on Google Cloud as described, in which case say so first.

| Workload | What it is | How it runs | Needs |
|---|---|---|---|
| AI gateway | Bifrost, an open-source gateway for model and tool calls | Cloud Run, exactly one instance | Private database, provider keys from Secret Manager, public HTTPS |
| Identity | Logto, an open-source identity provider | Cloud Run, two services from one image (sign-in and admin console) | Private database, public HTTPS for sign-in, admin console behind a login wall |
| Control plane API | Vespra's own TypeScript service | Cloud Run | Private database, Cloud Tasks, Secret Manager, public HTTPS |
| Agent runs | Short-lived containers that review merge requests | Cloud Run Jobs, started by Cloud Tasks | Outbound only to the gateway, GitLab and the control plane. No database access |
| Git server | GitLab, installed with the Omnibus package, with its own bundled database on the VM | One Compute Engine VM, 2 vCPU and 8 GB to start, growing to 4 vCPU and 16 GB | Persistent disk, nightly backups to Cloud Storage, no public IP |
| CI runner | GitLab Runner with the Docker executor | A second Compute Engine VM in the same network | Push to Artifact Registry, no inbound access |
| Database | Cloud SQL for PostgreSQL with pgvector | One instance, three databases (control plane, Logto, Bifrost) | Private IP only, point-in-time recovery |
| Secrets | Secret Manager | Managed | Platform secrets and, later, per-tenant secrets named by organization |
| Images | Artifact Registry | Managed | Pushed by CI, pulled by Cloud Run |
| Storage | Cloud Storage | Managed | GitLab backups, OpenTofu state |
| Operations | Cloud Logging and Monitoring, uptime checks, billing budgets | Managed | Alerts to email |

Other decisions that shape the design:

- Region is `us-east1`. Single region.
- Cloudflare is in front of everything: DNS, WAF and Tunnel. Virtual machines have no public IP and are reached only through Cloudflare Tunnel. Admin surfaces sit behind Cloudflare Access.
- Cloud Run services must not be reachable on their default Google addresses. The working assumption is one external HTTPS load balancer in front of them that accepts traffic only from Cloudflare. I'd like you to confirm that or propose something cheaper that keeps the same guarantee.
- Infrastructure is managed with OpenTofu, with state in Cloud Storage.
- No Kubernetes.
- An internal PaaS (Coolify) runs on a Hetzner server outside Google Cloud and must not need access to the private database.
- Hostnames: `gateway.vespra.cloud`, `api.vespra.cloud`, `auth.vespra.cloud`, `git.vespra.cloud`, `admin.vespra.cloud`, `auth-admin.vespra.cloud`.

## What will come later

Design so these are additions, not restructuring:

- A few team members with different levels of access.
- A staging copy of the platform.
- Customer workloads: deploying customer apps and databases, possibly in a project per customer or per group of customers.
- A second region and, eventually, other clouds.
- A compliance audit (SOC 2).

## Current state

From my notes. Treat it as possibly out of date.

- A Google Cloud organization exists for the domain `vespra.cloud`. I'm the only person in it, signed in as `austin@vespra.cloud`.
- Three folders exist: Production, Shared Services and Nonproduction.
- Three Vespra projects exist. One is an infrastructure project named `vespra-infrastructure`, which holds an OpenTofu state bucket, one secret, a LiteLLM proxy with its database (to be retired), a long list of enabled APIs, and a user-managed key on the default Compute Engine service account (to be removed). Another is referred to as Platform Production and has Google group bindings such as `cloud-admins@vespra.cloud`.
- Project creation and billing account creation are restricted to my account at the organization level.
- One project in my list belongs to a different organization and can't be changed from my account. Ignore it.
- I have about 300 dollars of Google Cloud credit.

Output of the read-only commands (paste below, or write "not provided"). The first command prints the organization ID to use in place of `<ORG_ID>` in the others:

```bash
gcloud organizations list
gcloud resource-manager folders list --organization=<ORG_ID>
gcloud projects list --format="table(projectId,name,parent.type,parent.id,lifecycleState)"
gcloud billing accounts list
gcloud org-policies list --organization=<ORG_ID>
gcloud organizations get-iam-policy <ORG_ID> --flatten="bindings[].members" --format="table(bindings.role,bindings.members)"
```

```text
<paste output here>
```

## What I want from you

Before you design anything, ask me up to five questions if the answers would change the design. If nothing would, state your assumptions and go ahead.

Then give me one document with these sections, in this order.

**1. Resource hierarchy.** The folders and projects I should have, as a tree, and a table saying what lives in each project and why it is separate. Show the smallest structure that is still correct for Phase 1, and then how it grows for a team, a staging environment and customer workloads. Tell me whether to keep, rename or replace my three existing folders, and whether I need a non-production environment now or can add it later.

**2. Naming convention.** One rule per resource type, each with two or three examples: folders, project IDs and display names, service accounts, networks and subnets, firewall rules, virtual machines, Cloud Run services and jobs, Cloud SQL instances and databases, buckets, secrets (including per-tenant secrets), Artifact Registry repositories, and labels. The test of a good convention here is that a newcomer could guess the name of a resource they have never seen. Favour short, plain words over codes. Call out the rules Google enforces that I can't change later, such as project IDs being permanent and globally unique.

**3. Access control.** Which Google groups to create and what each can do at which level. One service account per workload, with the roles each needs. How CI runs OpenTofu without a downloadable key. An emergency access procedure for an organization with one human in it.

**4. Organization policies.** A short baseline worth turning on now, in order of value, with what each prevents. Flag any that would break something in the Phase 1 table above, for example a sharing restriction that conflicts with public Cloud Run services, and say how to reconcile it.

**5. Network.** The VPC, subnets and address ranges, outbound access for VMs, private access from Cloud Run to the database, firewall rules, and administrative access without public IPs. Settle how Cloudflare reaches Cloud Run: compare the load balancer approach with the realistic alternatives on cost and on how well each stops traffic that bypasses Cloudflare, and pick one. Include a Mermaid diagram.

**6. Logs, monitoring and audit.** Where logs go, which audit logs to turn on, how long to keep them, and where alerts are defined.

**7. Cost control.** Billing budgets and alert thresholds, labels for attributing cost, and how to make the credit last.

**8. OpenTofu layout.** How to organize the code and state: what is bootstrapped by hand once, what is one stack versus several, and the order to apply them. Include how to bring existing resources under management instead of recreating them.

**9. Migration from the current state.** Numbered steps from what exists to the target, starting with the changes that are safe and reversible. Say what gets moved, what gets created, what gets shut down, and what can't be renamed and so must be replaced or lived with.

**10. Bill of materials.** A table of every billable resource in Phase 1 with its size, monthly price in `us-east1`, and a total. Check prices against Google's current pricing pages and link them. Where a smaller size would do for one user, show both.

**11. What you left out.** Google's enterprise foundation guidance assumes a platform team. List the parts of it you deliberately skipped for a solo founder and the event that should trigger adding each one.

## Ground rules

- Security and privacy come first, then low fixed cost, then simplicity for one operator. If a recommendation adds a fixed monthly charge, say what it buys.
- Check facts about Google Cloud products, limits and prices against current Google documentation and cite it. If you can't verify something, say so and mark it.
- Give me the result as a single Markdown document I can save as `docs/vespra/GCP_ARCHITECTURE.md`, with the diagrams in Mermaid.
