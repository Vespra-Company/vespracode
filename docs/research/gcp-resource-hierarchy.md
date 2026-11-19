# Google Cloud resource hierarchy for Vespra — research notes

**Date:** 2026-11-13  
**Method:** Google Cloud documentation only, fetched on this date. Every fact in sections 1 to 3 links to the page it came from. Sections 4 to 6 are recommendations built on those facts and are labelled as such.  
**Feeds:** section 1 (resource hierarchy) of the architecture session in [`prompts/02-gcp-architecture.md`](../vespra/prompts/02-gcp-architecture.md), and milestone M0 in [`PHASE_1_SPEC.md`](../vespra/PHASE_1_SPEC.md). It touches naming and organization policies only where they depend on the hierarchy.  
**Not checked:** the live Google Cloud organization. Everything said here about what exists today comes from the notes in the prompt and the spec, which describe themselves as possibly out of date. Section 7 lists what to confirm.

---

## 1. How the hierarchy works

| Level | What it is | Facts that shape the design | Source |
|---|---|---|---|
| Organization | The root. One per Cloud Identity or Google Workspace account | Projects belong to the organization, not to the person who made them. Roles and organization policies set here are inherited by everything below | [About resource hierarchy](https://cloud.google.com/resource-manager/docs/cloud-platform-resource-hierarchy) |
| Folder | Optional grouping between the organization and projects | A place to attach roles and policies that a group of projects should share. Up to 10 levels deep, up to 300 direct child folders per parent, display name 3 to 30 characters and unique among siblings | [Create folders](https://cloud.google.com/resource-manager/docs/creating-managing-folders) |
| Project | Where services are enabled and resources live | Google calls it the trust boundary (resources in one project cannot reach another by default), the billing unit, and the most common place to grant day-to-day roles | [Create projects](https://cloud.google.com/resource-manager/docs/creating-managing-projects) |

Rules that cannot be undone or worked around later:

- **Project IDs are permanent.** 6 to 30 characters, lowercase letters, digits and hyphens, starting with a letter, globally unique, and never reusable, even after the project is deleted. The display name (4 to 30 characters) can be changed at any time. ([Create projects](https://cloud.google.com/resource-manager/docs/creating-managing-projects))
- **A deleted project counts against quota for 30 days** before it is fully removed. ([Create projects](https://cloud.google.com/resource-manager/docs/creating-managing-projects))
- **Moving a project between folders is a metadata change.** Roles and policies set directly on the project move with it. Roles and policies it inherited from the old folder are lost and replaced by the new folder's. Google's own example is a service account that loses access and causes an outage. The mover needs the Project Mover role on both the source and the destination. ([Move a project](https://cloud.google.com/resource-manager/docs/moving-projects-folders))
- **Billing is not part of the hierarchy.** It is linked per project, and a move does not change the billing account. ([Decide a resource hierarchy](https://cloud.google.com/architecture/landing-zones/decide-resource-hierarchy), [Migrate projects](https://docs.cloud.google.com/resource-manager/docs/project-migration))

How inheritance behaves:

- Allow policies (who can do what) add up as you go down the tree. A deny policy overrides them. Organization policies (what configurations are permitted at all) are inherited but can be replaced at a lower folder or project, which is how narrow exceptions are made. ([Decide a resource hierarchy](https://cloud.google.com/architecture/landing-zones/decide-resource-hierarchy))
- Tags are inherited by everything under the resource they are bound to. Labels are not inherited. Tags can be used in conditions on roles and organization policies. Labels cannot. ([Tags overview](https://cloud.google.com/resource-manager/docs/tags/tags-overview))
- A tag key named `environment` with a value such as `Production` or `Staging` puts a badge on the project in the console's project picker. Bound to a folder, every project in it gets the badge. ([Create projects](https://cloud.google.com/resource-manager/docs/creating-managing-projects))
- Log sinks can be created on a folder or the organization to collect logs from every project below. Up to 200 sinks per folder or organization. ([Aggregated sinks](https://docs.cloud.google.com/logging/docs/export/aggregated_sinks))
- A billing budget can be scoped to folders or the organization and then covers projects added to them later. An alerts-only budget does not cap spending. ([Budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets))

---

## 2. What Google recommends

**Pick the structure by where policy differs.** Google's landing zone guide offers three shapes and says not to mirror the company org chart. The one that fits Vespra is "based on application environments": use it when environments need different policies and access, and there is one central owner of security. The other two (by region or subsidiary, by product team with its own policies) need independent groups that Vespra does not have. ([Decide a resource hierarchy](https://cloud.google.com/architecture/landing-zones/decide-resource-hierarchy))

**Best practices that apply to any shape**, from the same guide:

- Use one organization.
- Use one naming convention.
- Keep the resources that bootstrap the environment with infrastructure as code, and the services shared across environments, in folders of their own, directly under the organization.

**The enterprise foundations blueprint** is the full-size reference. It has six folders and a fixed set of projects. ([Organization structure](https://cloud.google.com/architecture/blueprints/security-foundations/organization-structure))

| Blueprint folder | Holds | Vespra's existing folder |
|---|---|---|
| `bootstrap` | A seed project (OpenTofu state and the service accounts the pipeline runs as) and a pipeline project | Shared Services |
| `common` | Central logging, billing export, organization-wide secrets and keys, security monitoring | Shared Services |
| `production` | Production workload projects, plus per-environment secrets and keys projects | Production |
| `nonproduction` | A copy of production for testing before release | Nonproduction |
| `development` | Developer environments | None. Not needed |
| `networking` | Shared VPC host projects, one per environment | None. See section 5 |

The blueprint itself says its choices can be changed, and names these as acceptable: a single project for secrets instead of one per environment, organization policies set lower than the organization where needs differ, and a single infrastructure pipeline run by one team. ([Deploy the blueprint](https://cloud.google.com/architecture/blueprints/security-foundations/summary))

**Google Cloud Setup**, the guided flow in the console, creates a much smaller foundation: one folder, a management project for access, billing and observability, and a standard project for workloads. It confirms that a two-project start is a shape Google supports. ([Google Cloud Setup](https://docs.cloud.google.com/docs/enterprise/cloud-setup))

---

## 3. Facts that constrain Vespra's Phase 1 choices

**Public Cloud Run services and the sharing restriction.** Organizations created on or after 3 May 2024 have a baseline of organization policies turned on automatically. One of them, `iam.allowedPolicyMemberDomains`, allows roles to be granted only to identities in the organization's own domain. ([Security baseline constraints](https://docs.cloud.google.com/resource-manager/docs/secure-by-default-organizations)) The older way of making a Cloud Run service public, granting the invoker role to `allUsers`, is blocked by it. The blueprint notes this conflict. ([Preventative controls](https://docs.cloud.google.com/architecture/blueprints/security-foundations/preventative-controls)) Cloud Run now has a recommended alternative that works with the restriction left on: turn off the invoker check on the service (`--no-invoker-iam-check`, or `invoker_iam_disabled = true` in the Terraform provider). ([Allowing public access](https://cloud.google.com/run/docs/authenticating/public)) So no exception to the sharing restriction is needed for `gateway`, `api` or `auth`.

**Keyless CI and the sharing restriction.** The restriction allows workload identity pools in any project in the organization, whether it is set by the organization's principal set or by the Workspace customer ID. CI can authenticate to Google Cloud without a downloadable key and without an exception. ([Domain-restricted sharing](https://docs.cloud.google.com/organization-policy/domain-restricted-sharing))

**Service agents and the sharing restriction.** A service agent is the Google-managed identity a service such as Cloud Run acts as. The same page says two things about them: that they are not considered part of the organization, so granting one a role means turning the restriction off and on again, and that service agents associated with the organization's resources are allowed. Which applies decides whether a grant from one project to another project's service agent goes through. It is listed in section 8.

**New groups and the sharing restriction.** A newly created Google group can take up to 24 hours before roles can be granted to it. Create the groups a day before the roles are applied. ([Domain-restricted sharing](https://docs.cloud.google.com/organization-policy/domain-restricted-sharing))

**The rest of the baseline** disables service account key creation and upload, stops default service accounts from receiving the Editor role, restricts Essential Contacts to the domain, enforces uniform bucket-level access, and limits protocol forwarding to internal addresses. ([Security baseline constraints](https://docs.cloud.google.com/resource-manager/docs/secure-by-default-organizations)) The blueprint adds, among others, no external IP on VMs, no public IP on Cloud SQL, no default network in new projects, and no public buckets. ([Preventative controls](https://docs.cloud.google.com/architecture/blueprints/security-foundations/preventative-controls)) These match the Phase 1 workload table, which already requires private VMs, a private database and no public buckets. The one not checked is the protocol forwarding limit against the external load balancer in front of Cloud Run. It is listed in section 8.

**Shared VPC is hard to adopt after the fact.** Shared VPC lets several projects use one network that lives in a "host" project. All the projects must be in the same organization, a project cannot be both a host and a user of another host, and existing VMs cannot be switched onto a shared network: they have to be recreated. ([Shared VPC](https://docs.cloud.google.com/vpc/docs/shared-vpc)) This is the main reason the number of production projects is worth deciding before the VMs are built.

**Project creation can be automated, within a quota.** A service account can create projects if it names the parent folder. The organization has a project quota that is raised by request, and the blueprint warns that a self-service billing account needs that increase before many projects are created. ([Create projects](https://cloud.google.com/resource-manager/docs/creating-managing-projects), [Deploy the blueprint](https://cloud.google.com/architecture/blueprints/security-foundations/summary)) This matters for a project per customer.

**Default grants on a new organization.** A new organization grants Project Creator and Billing Account Creator to the whole domain. ([About resource hierarchy](https://cloud.google.com/resource-manager/docs/cloud-platform-resource-hierarchy)) The notes say this has already been narrowed to one account.

**The super administrator account.** Google recommends that the Cloud Identity super administrator is a separate login from the account used for daily Google Cloud administration, protected by a hardware security key, and that the Organization Administrator role is held by a group that the super administrator is not in. ([Super administrator best practices](https://cloud.google.com/resource-manager/docs/super-admin-best-practices))

**A separate staging organization.** Google recommends a second organization, on a second Cloud Identity account, for testing changes to the hierarchy and to organization-wide policy. It is explicit that this is not where test environments for applications go. ([Best practices for planning accounts and organizations](https://docs.cloud.google.com/architecture/identity/best-practices-for-planning))

---

## 4. Recommended hierarchy (recommendation, not fact)

### Phase 1: three folders, two projects

```text
vespra.cloud                          organization
├── Shared Services                   folder, exists
│   └── vespra-infrastructure         project, exists
├── Production                        folder, exists
│   └── Platform Production           project, exists (ID not recorded in the notes)
└── Nonproduction                     folder, exists, stays empty
```

| Project | Holds | Why it is separate |
|---|---|---|
| `vespra-infrastructure` | OpenTofu state bucket. The identity CI uses to apply changes. Artifact Registry (see decision 3 in section 5). Later: the central audit log bucket and the billing export | It can change every other project, so access to it is the narrowest. Images are built once and used by every environment, so the registry does not belong to one environment |
| Platform Production | The VPC. Cloud Run services and jobs. Cloud SQL. The GitLab and runner VMs. Cloud Tasks. Secrets. The backup bucket | Everything that serves traffic or holds production data. One project keeps one network and one set of firewall rules, which is what the spec asks for |

Why not more projects now. A project is a boundary for access, billing and blast radius. With one operator there are no differing access needs to separate, and cost can be split by label. Inside one project, isolation between workloads comes from one service account per workload and from firewall rules, both already in the spec. Each extra production project that needs the private database would bring Shared VPC with it.

Why not fewer. Putting state and the CI identity in the production project would mean anything able to administer production could also rewrite the state for the whole organization.

**Close call: GitLab and the runner in their own project.** The runner executes whatever a pipeline tells it to, in the same network as the database. In Phase 1 the only author is Austin, and a firewall rule that denies the runner any route to Cloud SQL covers the risk. The runner moves to its own project when it first runs code from someone outside the team.

### The three existing folders: keep all three

They already match the blueprint's `production`, `nonproduction` and `common` plus `bootstrap`. Nothing needs replacing. Renaming would only be cosmetic.

**Nonproduction is not needed yet, but keep the empty folder.** It costs nothing, and it gives staging a place with its own policies and access on the day it is created.

### How it grows

| Event | Change | What stays the same |
|---|---|---|
| A few team members | Roles go to Google groups at the folder level: broad in Nonproduction, narrow in Production, narrowest in Shared Services. Austin's daily account stops being the super administrator | Folders and projects |
| Staging | One new project in Nonproduction with its own network and database, built from the same OpenTofu code with different variables | Production is untouched. Images come from the same registry |
| Customer workloads | A new top-level folder, `Customers`, with a project per customer or per group of customers created by the control plane's service account. Request a project quota increase first | The platform's folders. Customer projects get their own policies because tenants' code runs there and the platform's rules (for example, nothing public) will not all fit |
| Second region | No hierarchy change. Regions are a property of resources, not a level in the tree, unless policy differs by region | Everything |
| SOC 2 | A dedicated logging project in Shared Services fed by an organization-level sink, with access separate from the people who run production. Possibly a staging organization | Workload projects |
| Other clouds | Nothing in Google Cloud | Everything |

Runner-up for customers: put them under Production. Rejected because the Production folder's policies and group access would then be inherited by every customer project, and each exception would have to be carved out.

---

## 5. Decisions the architecture session still has to make

1. **Is the existing Platform Production project reused or replaced?** Its ID is permanent. If the ID is readable and the project is in the Production folder, reuse it. If the ID is poor, replace it now, while it is empty, because it will appear in every service account email and image path.
2. **Standalone VPC or Shared VPC from the start.** A standalone VPC in the production project is the smallest correct answer and is what section 4 assumes. The cost of being wrong is recreating two VMs and rewiring Cloud Run and Cloud SQL the day a second production project needs private access to the database. A host project now avoids that at the price of a third project and more roles to manage.
3. **Artifact Registry in the shared project or the production project.** Section 4 puts it in the shared project so that staging later pulls the same images. That needs a grant from the shared project to the production project's Cloud Run service agent, and the documentation is inconsistent on whether the sharing restriction permits it (section 3). If it does not, the registry starts in the production project and the question returns when staging is added.
4. **Where the leftovers in `vespra-infrastructure` go.** The LiteLLM proxy and its database are a workload in a project that should hold none. The spec already retires them. The user-managed key on the default Compute Engine service account must be deleted by hand: organization policy constraints are not retroactive, so the constraint that prevents new keys leaves existing ones in place. ([Domain-restricted sharing](https://docs.cloud.google.com/organization-policy/domain-restricted-sharing))
5. **Naming.** The blueprint's convention is `prj-{environment code}-{description}-{random}`, for example `prj-c-logging-a1b2`. ([Deploy the blueprint](https://cloud.google.com/architecture/blueprints/security-foundations/summary)) The prompt asks for plain words instead of codes. A pattern such as `vespra-platform-prod` and `vespra-platform-staging` fits the 30-character limit and is guessable. Because IDs are globally unique, a chosen ID may already be taken, and a short suffix is the fallback.

---

## 6. What was skipped from Google's guidance, and when to add it

| Skipped | Add it when |
|---|---|
| Separate `bootstrap` and `common` folders | A second person runs the pipeline and should not see the shared services, or the reverse |
| Projects per function in `common` (logging, billing export, secrets, keys, security monitoring) | An auditor needs logs that the operators of production cannot alter |
| A `development` folder | Developers need cloud sandboxes with looser rules than staging |
| A `networking` folder and Shared VPC | A second project needs the private network |
| Per-environment secrets and keys projects | Staging exists and its secrets must be kept from people with production access, or the reverse |
| A separate staging organization | A change to organization-wide policy is risky enough to rehearse |
| Separate super administrator login | Not skipped. Do it in M0. It is free and is the account recovery path |

---

## 7. Confirm against the live organization

Run the read-only commands in the prompt. The answers decide the migration steps.

- The parent folder of each of the three Vespra projects, and the ID of the Platform Production project.
- What the third Vespra project is. The notes name only two.
- When the organization was created, and which organization policies are in force. If it predates May 2024 the baseline may be missing and has to be set explicitly.
- Whether Project Creator and Billing Account Creator are still granted to the whole domain.
- Whether `austin@vespra.cloud` is both the super administrator and the Organization Administrator.
- The billing account type and the current project quota.

## 8. Not verified in this pass

- Whether the sharing restriction blocks a role grant to a service agent from another project in the same organization. The page states both that service agents are outside the organization and that they are allowed.
- Whether the baseline limit on protocol forwarding affects an external HTTPS load balancer. The constraint is described as covering protocol forwarding to target instances, which is a different feature, but this was not confirmed.
- How to rename a folder. The folder pages describe the name as a display name, but the page with the update command did not load.
- Whether Shared VPC itself has a charge. The page fetched says only that resources are billed to the project they are in.
- The exact name of the organization policy that restricts resource locations. The blueprint refers to it without giving the identifier.
- Which Phase 1 resources can be moved between projects. This note assumes none can, so a resource created in the wrong project is recreated.
- The default size of the organization's project quota.
- Google Cloud Setup's "production foundation" page, which would show its default folder layout. The link returned an error.
