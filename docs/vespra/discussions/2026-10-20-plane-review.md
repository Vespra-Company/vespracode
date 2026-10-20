# Plane review: stack, architecture, features, and how Vespra could build a Linear-like app

Status: answered

Scope: full review of [Plane](https://plane.so) (`makeplane/plane`) as a reference for a Vespra project-management product similar to Linear. Covers the exact tech stack, codebase map, UI design system, data model, auth and multi-tenancy, feature and integration map, the Community vs Commercial edition boundary, Plane Compose, and a build-on vs recreate recommendation.

## Sources and method

| Source | What it is | How it was examined |
|---|---|---|
| `github.com/makeplane/plane` @ `6c16585` (v1.4.2) | **Community Edition (CE)**, AGPL-3.0 | Cloned, mapped with the `codebase-map` skill, read directly |
| `@makeplane/propel` 0.7.3 (npm) | Plane's primitive UI kit, AGPL-3.0-only | Tarball unpacked and read |
| [Self-hosted architecture doc](https://developers.plane.so/self-hosting/plane-architecture) | Describes the **Commercial Edition** | Fetched and reconciled against code |
| Plane Commercial v3.3.3 via `prime-cli` | The full edition the docs describe (free tier, 12 seats) | Installed on the dev VM, compose bundle and 17 images inspected, 427 migrations applied, UI reached |
| `plane-compose` 0.5.2 (PyPI) | "Projects-as-code" CLI | Wheel unpacked and read |
| Plane Cloud public API | `https://api.plane.so/api/v1/` | Probed with a dev PAT on a throwaway account (token not stored in this repo) |

Important framing: **the GitHub repo is the Community Edition. The architecture docs describe the Commercial Edition.** They differ a lot (13 services vs 31). Both are covered below and the boundary is called out explicitly.

## TL;DR

- Plane is a **Django + React monorepo**: Python 3.12 / Django 5.2 / DRF REST API, Postgres 15, Valkey (Redis), RabbitMQ + Celery, MinIO/S3; three React 19 frontends built with **Vite 8 + React Router 8** (not Next.js), state in **MobX**, data via **SWR + axios**.
- UI is a two-layer design system: `@makeplane/propel` (primitives on **Base UI** headless + Tailwind 4 + CVA) and `@plane/blocks` (composites). Rich text is **TipTap/ProseMirror + Yjs**, with realtime via a **Hocuspocus** sidecar (`apps/live`).
- Multi-tenancy is **shared schema, row-level**: every row carries a `workspace` FK; URLs are `/<workspaceSlug>/...`; roles are Admin 20 / Member 15 / Guest 5. Auth is **cookie sessions in Postgres** for the app and **`X-API-Key`** for the public API; CE ships email+password, magic code, Google, GitHub, GitLab, Gitea. OIDC/SAML/LDAP are commercial.
- CE is a complete Linear-class tracker (work items, cycles, modules, views, pages, intake, analytics, webhooks, public API). Everything "platform-y" is **closed source**: integrations engine (Silo), AI (Pi), automations runtime, email intake, importers, GraphQL, OIDC/SAML, Teamspaces, Initiatives, Milestones, Customers, templates, custom properties, dashboards, Argus, licensing.
- Recommendation: **do not fork Plane wholesale.** Borrow its data model, URL/tenancy scheme, and editor stack; build Vespra's own product on our own stack. Details in the recommendation section.

## 1. Edition map: what is open vs closed

Verified by diffing the CE `docker-compose.yml` against the Commercial compose bundle `prime-cli` downloaded to `/opt/plane/docker-compose.yml`.

| Service | CE (GitHub) | Commercial (v3.3.3) | Role |
|---|---|---|---|
| `web`, `space`, `admin` | yes | yes (`*-commercial` images) | React frontends |
| `api`, `worker`, `beat-worker`, `migrator` | yes | yes (`backend-commercial`, entrypoint `docker-entrypoint-api-ee.sh`) | Django API + Celery |
| `live` | yes | yes + `live-exporter` | Hocuspocus realtime for Pages |
| `proxy` (Caddy) | yes | yes (adds `/silo`, `/pi`, `/argus`, `/graphql`, `/dav`, `/marketplace`, `/bridge`, SMTP L4 ports) | Edge |
| `plane-db` Postgres 15.7, `plane-redis` Valkey 7.2, `plane-mq` RabbitMQ 3.13, `plane-minio` | yes | yes | Infra |
| `importer-worker` | no | yes | Celery queue for imports |
| `automation-consumer`, `webhook-consumer`, `outbox-poller` | no | yes | Event-stream (transactional outbox over RabbitMQ) |
| `silo` | no | yes (Node/Express, "integrations engine") | GitHub/GitLab/Slack/Jira/Linear/Asana/ClickUp/HubSpot/Sentry/Teams/Pylon + Cursor and Claude agents |
| `pi-api`, `pi-worker`, `pi-agent-worker`, `pi-beat`, `pi-migrator`, `pi-db-init` | no | yes (opt-in, FastAPI + LangChain) | AI assistant, embeddings, PQL, native agents |
| `argus`, `argus-migrator` | no | yes (opt-in, Go) | Sensitive-data scanner |
| `runner` (`node-runner`) | no | yes | Sandboxed JS/TS script host for automations |
| `email` | no | yes (opt-in, SMTP listener on 25/465/587) | Email-to-work-item intake |
| `iframely` | no | yes | Link unfurling / embeds |
| `monitor` | no | yes (Go) | Feature flags + payments + license + health reporting |
| OpenSearch | no | optional (`OPENSEARCH_ENABLED`) | Search index |

Commercial backend also adds whole Django packages not in CE: `plane/ee` (models for `automation`, `collection`, `customer`, `cycle`, `dashboard`, `initiative`, `issue_properties`, `job`, `milestones`, `recurring`, `teamspace`, `template`, `workflow`, `workflow_governance`), `agents`, `api_v2`, `audit`, `automations`, `dbos`, `event_stream`, `graphql`, `marketplace`, `oauth_bridge`, `payment`, `silo`, `webhook`, `widgets`. Commercial instance config exposes `is_oidc_enabled`, `is_saml_enabled`, `is_ldap_enabled`, `posthog_*`, `drawio_embed_url`, `is_opensearch_enabled`, `is_otel_enabled`, `workspace_governance_allowed`.

CE has **no `ee/` directory**; the seam is empty `extended*` stubs (`apps/web/app/routes/extended.ts` exports `[]`, `hooks/oauth/extended.tsx`, `auth-ee.ts` = `never`) plus upgrade CTAs that link to `app.plane.so/upgrade`. The `license` Django app in CE is instance setup/config/telemetry, not license enforcement; `edition` only has `PLANE_COMMUNITY`.

Two places the official doc oversimplifies relative to code: it calls Redis the "session store" (CE stores sessions in a Postgres `sessions` table; Redis is cache + Live state), and it says Live handles "cursor positions, presence" generally (true only inside the Pages editor; work items are plain REST + SWR with no WebSocket).

## 2. Codebase map (Community Edition)

Monorepo: **pnpm 11 workspaces + Turborepo 2.10**, Node 22.22, TypeScript 5.8.3. `apps/api` and `apps/proxy` are excluded from the pnpm workspace.

```
plane/
├── apps/
│   ├── web/      main app, Vite + React Router SPA (ssr:false), port 3000       172k LOC ts/tsx
│   ├── admin/    "God mode" instance admin SPA, basename /god-mode, port 3001     7k LOC
│   ├── space/    public publish boards, React Router SSR (ssr:true), port 3002   12k LOC
│   ├── live/     Hocuspocus + Yjs + Express realtime server, port 3000 (3100 dev) 6k LOC
│   ├── api/      Django 5.2 + DRF + Celery, port 8000                           115k LOC py (716 files)
│   └── proxy/    Caddy (xcaddy build with Cloudflare/DO DNS + layer4)
├── packages/     14 TS packages                                                   81k LOC
│   ├── blocks/        composite UI on propel (~30k LOC)
│   ├── editor/        TipTap + Yjs editor (~21k LOC)
│   ├── utils/, types/, constants/, hooks/, services/ (axios clients), shared-state/ (MobX)
│   ├── i18n/          i18next, 22 locales
│   ├── tailwind-config/, typescript-config/, logger/, decorators/, codemods/
├── deployments/  aio/, cli/ (compose installer), swarm/, kubernetes/ (README -> external Helm chart)
├── docker-compose*.yml, setup.sh, turbo.json, pnpm-workspace.yaml
```

Tooling: **oxlint 1.51 + oxfmt 0.35** (not ESLint/Prettier), **ruff** for Python, **vitest 4** (blocks, live, codemods, services), **pytest 9** via `docker-compose-test.yml` (112 test files), Husky + lint-staged, GitHub Actions (build, CodeQL, copyright header check, i18n sync, migration check).

## 3. Exact tech stack

| Layer | Technology | Version (pinned in repo) |
|---|---|---|
| Language (API) | Python | >=3.12,<3.13 (uv 0.12) |
| Web framework | Django / Django REST Framework | 5.2.17 / 3.17.2 |
| API docs | drf-spectacular (behind `ENABLE_DRF_SPECTACULAR`) | |
| Async | Celery + django_celery_beat; broker RabbitMQ (AMQP), not Redis | 5.5.3 / RabbitMQ 3.13.6 |
| Database | PostgreSQL (`psycopg` 3) | 15.7 |
| Cache | Valkey via django-redis | 7.2.11 |
| Object storage | S3 / MinIO via django-storages + boto3, presigned URLs | |
| Server | gunicorn (prod), uvicorn, Channels present | 23.0 / 0.29 |
| Frontend | React / React DOM | 19.2.8 |
| Bundler / router | Vite / React Router (framework mode, `@react-router/dev`) | 8.0.16 / 8.3.0 |
| State | MobX (+ `mobx-react`) | 6.12 |
| Data fetching | SWR + axios | 2.4.2 / 1.20 |
| Styling | Tailwind CSS (`@tailwindcss/postcss`) | 4.1.17 |
| Theme switching | next-themes (used standalone, no Next.js) | 0.4.6 |
| UI primitives | `@makeplane/propel` on `@base-ui/react` | 0.7.3 / 1.6.0 |
| Variants | class-variance-authority | |
| Icons | lucide-react, Material Symbols Rounded, propel icons | 0.469 |
| Fonts | Inter Variable, IBM Plex Mono (fontsource) | |
| Floating UI | `@floating-ui/react` | 0.27 |
| Command palette | cmdk | 1.1 |
| Drag and drop | Atlassian pragmatic-drag-and-drop | 1.7 |
| Tables / virtual | TanStack Table / TanStack Virtual | 8.21 / 3.13 |
| Charts | recharts | 2.15 |
| Forms | react-hook-form | 7.84 |
| Editor | TipTap (`@tiptap/*`) on ProseMirror | 2.27 / 2.22 |
| Collaboration | Yjs, y-prosemirror, y-indexeddb, Hocuspocus provider + server | 13.6 / 2.15.2 |
| Code highlight | lowlight / highlight.js | |
| Markdown | tiptap-markdown | |
| Emoji | emoji-picker-react, frimousse | |
| i18n | i18next + react-i18next + ICU | 25.10 / 16.6 |
| Realtime server | Express 4 + express-ws + Hocuspocus, Redis extension, Effect | |
| Edge | Caddy with auto-TLS, layer4 | |

Absent (worth knowing when comparing to other stacks): Next.js, react-query, Radix (except scroll-area), Headless UI, framer-motion, sonner, react-beautiful-dnd, Prisma/ORM in JS, GraphQL (CE), Elastic/pgvector/Postgres FTS (CE search is `icontains`).

## 4. Frontend architecture

**Routing.** `apps/web/app/routes.ts` merges `coreRoutes` with (empty) `extendedRoutes`. Filesystem mirrors Next-style groups (`(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/issues/...`) but is wired through React Router params `:workspaceSlug`, `:projectId`. Canonical URL shape: `/:workspaceSlug/projects/:projectId/issues/:issueId`, `/:workspaceSlug/browse/:workItemKey` (e.g. `PROJ-123`), `/:workspaceSlug/settings/...`, `/:workspaceSlug/notifications`.

**Auth guards.** `AuthenticationWrapper` (user session via SWR + MobX) wraps `WorkspaceAuthWrapper` (membership check by slug) which wraps `ProjectAuthWrapper` (project membership). Layouts compose them.

**State.** One `RootStore` (`apps/web/store/root.store.ts`) holding domain stores: `user`, `instance`, `workspaceRoot`, `projectRoot`, `memberRoot`, `cycle`, `module`, `projectView`, `globalView`, `issue` (an `IssueRootStore` with per-context sub-stores: project / cycle / module / view / archived / draft / profile / workspace issues, plus `issueKanBanView`, `issueCalendarView`), `state`, `label`, `projectPages`, `projectInbox`, `projectEstimate`, `workspaceNotification`, `favorite`, `stickyStore`, `timelineStore`, `commandPalette`, `powerK`, `theme`, `router`, `multipleSelect`, and `workItemFilters` from `@plane/shared-state`. Pattern: observable maps keyed by UUID, computed getters for filtered/grouped lists, actions call `@plane/services` classes and optimistically mutate.

**Data fetching.** Service classes (`APIService` on axios with `withCredentials`) per domain. SWR is used for "fetch on mount, revalidate" in wrappers and pages; MobX stores hold the normalized data. No websocket for work items; Pages use Hocuspocus over `/live/collaboration`. Local persistence: localStorage for prefs, `y-indexeddb` for editor docs; an `IndexedDBService` exists but the local-first user cache is commented out.

**Layouts.** Five issue layouts (`list`, `kanban`, `calendar`, `spreadsheet`, `gantt`) under `components/issues/issue-layouts/`, driven by a shared filter/display-properties model (group by, sub-group by, order by, display properties, show sub-issues, etc.).

**UX surface.** Power-K command palette (Cmd/Ctrl+K, cmdk), keyboard shortcuts provider, peek overview + full-page issue, bulk operations, sidebar with favorites/recents/stickies/drafts, notifications inbox with mentions tab, profile pages, onboarding/create-workspace/invitations flows, home widgets, themes incl. custom palette, 22 locales, PWA manifest (no service worker).

## 5. UI design system

Two packages, no `@plane/ui`:

- **`@makeplane/propel`** (external npm, AGPL-3.0-only, peer deps `react`, `react-dom`, `tailwindcss`). Primitives built on Base UI: `alert-dialog`, `avatar(-group)`, `badge`, `banner`, `breadcrumb`, `button`, `icon-button`, `anchor-button`, `calendar` (react-day-picker), `checkbox(-field)`, `circular-progress`, `linear-progress`, `collapsible`, `combobox`, `context-menu`, `dialog`, `field`, `input(-field)`, `text-area(-field)`, `menu`, `pill`, `popover`, `preview-card`, `scroll-area`, `select`, `switch`, `table`, `tabs`, `toast`, `toolbar`, `tooltip`, plus `elements/*` and an icon set. Variants via CVA.
- **`@plane/blocks`** (in repo). Composites: `auth`, `breadcrumb`, `card`, `charts` (area/bar/line/pie/radar/tree-map on recharts), `color-picker`, `context-menu`, `dialog`, `emoji-icon-picker`, `emoji-reaction`, `empty-state`, `layout`, `pill-button`, `portal`, `property-select` (date, date-range), `select`, `skeleton`, `spinner`, `toast`, `virtual-list`.

**Tokens and theming.** `packages/tailwind-config/index.css` imports Tailwind 4 and `@makeplane/propel/styles`; legacy `custom-background-*` variables are superseded by semantic classes (`bg-canvas`, `bg-surface-*`, `text-primary`, `border-subtle`). Themes: `light`, `dark`, `light-contrast`, `dark-contrast`, `custom`, `system`; dark keyed off `[data-theme*="dark"]`. Custom theme applies user `primary` / `background` via `applyCustomTheme` in `packages/utils/src/theme/`.

**Editor.** `packages/editor`: TipTap StarterKit + task lists, code blocks (lowlight), tables with drag handles, mentions, callouts, images (custom uploader with presigned S3), slash commands (document and rich-text registries), work-item embeds, side menu, UniqueID, character count, markdown, collaboration via `HocuspocusProvider` and `IndexeddbPersistence`. Document is persisted as `description_binary` (Yjs update), `description_html`, and `description_json` on the model; `apps/live` loads/saves via the API's `/pages/:id/description/` endpoints, authenticates the WebSocket by forwarding the user's session cookie, and fans out across replicas through a Redis extension.

## 6. Backend architecture

Django project `plane` with these apps: `db` (models, mixins, migrations), `app` (internal web API at `/api/`), `api` (public REST at `/api/v1/`), `space` (public boards at `/api/public/`), `authentication` (`/auth/`), `license` (instance at `/api/instances/`), `bgtasks` (Celery), `utils` (filters, cursor pagination, cache decorators), `middleware`, `settings`, `analytics`, `throttles`, `web`, `seeds`, `tests`.

**Model base classes** (`plane/db/models/base.py`, `mixins.py`):

| Mixin | Fields / behavior |
|---|---|
| `TimeAuditModel` | `created_at`, `updated_at` |
| `UserAuditModel` | `created_by`, `updated_by` (auto-set via `crum`) |
| `SoftDeleteModel` | `deleted_at`; default manager hides deleted; `all_objects` sees all; soft delete cascades through a Celery task; daily hard-delete after `HARD_DELETE_AFTER_DAYS` |
| `BaseModel` | all of the above + UUID primary key |
| `ProjectBaseModel` | `project` FK + `workspace` FK (copied from project on save) |
| `WorkspaceBaseModel` | `workspace` FK + optional `project` FK |

**Core entities.** `Instance` / `InstanceAdmin` / `InstanceConfiguration` (encrypted secrets via Fernet derived from `SECRET_KEY`); `User` (UUID, `AbstractBaseUser`), `Profile`, `Account` (OAuth tokens); `Workspace` (unique `slug`, `owner`), `WorkspaceMember(role)`, `WorkspaceMemberInvite`; `Project` (`identifier`, `network` Secret/Public, feature flags `cycle_view`/`module_view`/`issue_views_view`/`page_view`/`intake_view`, `archive_in`, `close_in`, `default_assignee`, `project_lead`), `ProjectMember(role)`, `ProjectUserProperty` (per-user layout/filters); `Issue` (parent self-FK, `state`, `estimate_point`, `type`, `priority`, `sequence_id` allocated under `pg_advisory_xact_lock`, `sort_order`, `start_date`, `target_date`, `archived_at`, `is_draft`, `description_*`), `IssueAssignee`, `IssueLabel`, `IssueLink`, `IssueComment`, `IssueActivity`, `IssueSubscriber`, `IssueReaction`, `CommentReaction`, `IssueRelation`, `IssueVote`, `IssueMention`, `IssueVersion`, `IssueDescriptionVersion`; `IssueType`; `State(group)`; `Label`; `Cycle`, `CycleIssue`, `CycleUserProperties`; `Module`, `ModuleIssue`, `ModuleMember`, `ModuleLink`; `IssueView`; `Page`, `ProjectPage`, `PageLabel`, `PageVersion`, `PageLog`; `Estimate`, `EstimatePoint`; `Intake`, `IntakeIssue(status, snoozed_till, source)`; `Notification`, `UserNotificationPreference`, `EmailNotificationLog`; `APIToken`, `APIActivityLog`; `Webhook`, `WebhookLog`; `FileAsset` (entity-typed attachments); `DeployBoard` (public `anchor`); `AnalyticView`; `Sticky`; `DraftIssue`; `UserFavorite`; `ExporterHistory`; `Session`; `Device`; `UserRecentVisit`.

Postgres features used: `JSONField` (descriptions, filters, metadata), `ArrayField`, advisory locks for sequence allocation. Not used in CE: full-text search, trigram, GIN, pgvector.

**API layers.**

| Mount | Auth | Purpose |
|---|---|---|
| `/api/` | Session cookie (`BaseSessionAuthentication` with Origin allowlist instead of CSRF token for the SPA) | Internal web app |
| `/api/v1/` | `X-API-Key` (`APIToken`, prefix `plane_api_`), `ApiKeyRateThrottle` default `60/minute`, every call logged to `APIActivityLog` | Public REST (projects, work items, comments, links, attachments, relations, cycles, modules, intake, labels, states, estimates, members, invites, stickies, assets, `users/me`) |
| `/api/public/` | Mostly `AllowAny` keyed by `DeployBoard.anchor` | Published boards (Space) |
| `/api/instances/` | Instance admin | Setup and configuration |
| `/auth/` | mixed | Sign in/up, OAuth callbacks, magic code, password reset, CSRF token |

Pagination is a custom cursor paginator; filtering via `django-filter` plus a large issue filter DSL (`utils/issue_filters.py`). Webhooks POST `{event, action, webhook_id, workspace_*, data, activity}` signed **HMAC-SHA256** in `X-Plane-Signature`, with SSRF-safe pinned fetch and retries.

**Async and infra.** Celery over RabbitMQ with `django_celery_beat` DatabaseScheduler. Scheduled jobs: email notification digests (5 min), intake unsnooze, auto-archive/close, hard-delete, export cleanup, orphaned asset cleanup, log table pruning, telemetry metrics (OTLP). Task modules: activity recording, notifications, email, webhooks, exports, file assets, magic link, invitations, version snapshots. Cache via `django-redis` with `cache_response` / `invalidate_cache` decorators. Storage via presigned S3 upload/download. Middleware: CORS, WhiteNoise, GZip, request body size limit, API token logger, request logger with `duration_ms`.

## 7. Multi-tenancy

**Shared database, shared schema, row-level isolation.** No `django-tenants`, no schema-per-tenant.

- Tenant = `Workspace`, identified in URLs by `slug`; the frontend stores `workspaceSlug` in the router store and every service call includes it.
- Every tenant-scoped row has `workspace_id` (directly or through `ProjectBaseModel` which copies it from the project). Queries are always filtered by `workspace__slug=slug` resolved from URL kwargs in the view bases (`app/views/base.py`).
- Authorization is membership-based: `WorkspaceMember(role, is_active)` and `ProjectMember(role, is_active)`; permission classes `WorkSpaceAdminPermission`, `WorkspaceEntityPermission`, `WorkspaceViewerPermission` (any active member), `ProjectAdminPermission`, `ProjectMemberPermission`, `ProjectEntityPermission`, `ProjectLitePermission`, and a `@allow_permission(roles, level)` decorator. Workspace Admins who are also project members act as project Admins.
- Roles: `20 Admin`, `15 Member`, `5 Guest`. Guests on projects with `guest_view_all_features=False` see only their own issues. Projects have `network`: Secret (0) or Public (2, visible to all workspace members).
- Public surfaces (Space) do not use membership; they are keyed by `DeployBoard.anchor` and gated by per-board toggles (`is_comments_enabled`, `is_votes_enabled`, `is_reactions_enabled`).
- Instance level sits above workspaces: `Instance`, `InstanceAdmin`, `InstanceConfiguration` (`ENABLE_SIGNUP`, `DISABLE_WORKSPACE_CREATION`, OAuth client IDs/secrets, SMTP, LLM keys). Commercial adds workspace governance and per-workspace feature flags served by `monitor`.
- Soft delete everywhere, UUID PKs everywhere, `created_by`/`updated_by` audit on every row. Hard delete is a scheduled sweep.

Trade-off summary: simple, fast to build, cheap to operate, good enough for a SaaS of Plane's size. The costs are that every query must remember the tenant filter (handled by view bases), noisy-neighbor isolation is at the DB level only, and per-tenant export/erasure is a filtered dump rather than a schema drop.

## 8. Authentication (CE) and commercial extras

- **App login** is a Django session. Custom session engine writes to a Postgres `sessions` table; cookie `session-id`, 7-day default, admin cookie `admin-session-id`. CSRF is enforced by an Origin allowlist (`WEB_URL`, `ADMIN_BASE_URL`, `SPACE_BASE_URL`, `LIVE_BASE_URL`) so the SPA does not juggle tokens; `GET /auth/get-csrf-token/` exists for forms.
- **Providers (CE):** email + password (zxcvbn score >= 3), magic code, Google, GitHub, GitLab, Gitea OAuth. Implemented as `Adapter` -> `CredentialAdapter` / `OauthAdapter` in `plane/authentication/`, with parallel `views/app` and `views/space` trees. Email verification flag on `User`; OAuth marks verified.
- **Throttles:** auth `10/min` per IP, email verification `3/hour`, anon `30/min`, API key configurable.
- **Public API:** `APIToken` with `X-API-Key`; tokens can be workspace-scoped; bot users flagged via `User.is_bot` / `APIToken.user_type`.
- **Live server:** trusts the forwarded browser session cookie and validates it against the API (`apps/live/src/lib/auth.ts`); `LIVE_SERVER_SECRET_KEY` for server-to-server.
- **Commercial adds:** OIDC, SAML, LDAP (`is_oidc_enabled`, `is_saml_enabled`, `is_ldap_enabled` in instance config), an `oauth_bridge` Django app (Plane as an OAuth provider for the marketplace/integrations), `PLANE_OAUTH_REDIRECT_URI`, workspace governance, PostHog telemetry, and access-token disablement per instance.

## 9. Feature map

Status: **CE** = in open-source code, **Commercial** = only in the closed edition (verified against commercial images/env), **stub** = models or UI shells exist in CE but endpoints/logic are commercial.

| Area | Feature | Status |
|---|---|---|
| Workspace | Create, settings, members, roles, email invites, slug | CE |
| Workspace | Billing / plans / seats | Commercial (CE shows plan grid + upgrade links) |
| Project | Identifier, Secret/Public network, lead, default assignee, cover, archive, per-project feature toggles | CE |
| Work items | Key `PROJ-123`, priority, state groups, labels, assignees, parent/sub-items, relations (blocks/duplicate/relates), links, attachments, comments + reactions, activity log, subscribers, start/due dates, drafts, archive, bulk ops | CE |
| Work items | Issue types / custom properties | stub (models) -> Commercial |
| Work items | Templates (work item, project, page) | Commercial (`plane/ee/models/template.py`) |
| Work items | Time tracking / worklogs | Commercial |
| Work items | Epics | stub (`IssueType.is_epic`) -> Commercial |
| Work items | Recurring work items | Commercial (`recurring.py`) |
| Planning | Cycles (progress, burndown, transfer), active cycles | CE (Pro analytics stubbed) |
| Planning | Modules (lead, members, links, status) | CE |
| Planning | Milestones, Initiatives, Teamspaces, Customers | Commercial (`milestones.py`, `initiative.py`, `teamspace.py`, `customer.py`) |
| Planning | Workflows (state transitions, approvals), workflow governance | Commercial (`workflow.py`, `workflow_governance.py`; exposed to `plane-compose`) |
| Views | Saved filters/display props, private/public, workspace views | CE |
| Layouts | List, Kanban, Calendar, Spreadsheet, Gantt/Timeline | CE |
| Pages | Project pages, nested, lock/archive, access, versions, realtime collab | CE |
| Pages | Workspace wiki | Commercial |
| Intake | In-app triage queue (accept/decline/snooze/duplicate), public form via Space | CE |
| Intake | Email intake | Commercial (`email` service, `INTAKE_EMAIL_DOMAIN`) |
| Publish | Public boards with comments/votes/reactions (`apps/space`) | CE |
| Analytics | Charts, saved analytic views, CSV export | CE |
| Dashboards | Custom dashboards / widgets | Commercial (`dashboard.py`, `widgets` app; CE dropped its old dashboard tables) |
| Home | Quick links, recents, stickies | CE |
| Notifications | In-app inbox, mentions, snooze/archive, batched email | CE |
| Search | Global search (`icontains`), Power-K | CE; OpenSearch optional in Commercial |
| Automations | Auto-archive / auto-close | CE |
| Automations | Rule engine (triggers/conditions/actions), event stream, scripted actions via `runner` | Commercial (`automations`, `event_stream`, `node-runner`) |
| Exports | CSV / XLSX / JSON async | CE |
| Importers | Jira, Linear, Asana, ClickUp, Confluence, CSV/flatfile, zip, Plane-to-Plane | Commercial (`silo` `packages/etl`) |
| API | Public REST `/api/v1/`, API tokens, OpenAPI (flag) | CE |
| API | GraphQL `/graphql/`, `api_v2`, WebDAV `/dav/` | Commercial |
| AI | Ask-AI assistant via instance LLM key (OpenAI SDK; Anthropic/Gemini config) | CE (basic) |
| AI | "Pi" service: chat, retrieval over embeddings, PQL (query language), duplicate detection, page/description edits, transcription, MCP, native agents, usage budgets; providers OpenAI/Claude/Groq/Cohere/Bedrock/custom | Commercial |
| Security | Argus sensitive-data scanner, audit log app | Commercial |
| Admin | God mode: general, workspaces, email, auth providers, AI, image sources | CE |
| Clients | Web, PWA manifest | CE; mobile/desktop apps referenced by `min_desktop_version` / `desktop_link_handoff_available` (Commercial) |
| i18n | 22 locales | CE |

## 10. Integration map

| Integration | CE | Commercial | Notes |
|---|---|---|---|
| Google / GitHub / GitLab / Gitea OAuth login | yes | yes | |
| OIDC / SAML / LDAP | no | yes | |
| GitHub App (two-way issue/PR sync) | models + UI only, no endpoints | yes (Silo `/api/github`, `/api/github-enterprise`) | |
| GitLab sync | no | yes (`/api/gitlab`, `/api/gitlab-enterprise`) | |
| Bitbucket / Bitbucket DC | no | yes | |
| Slack | models + UI only | yes (`@slack/bolt`) | |
| Microsoft Teams | no | yes (`botbuilder`, `/api/teams`) | |
| Jira Cloud / Jira Server importers | no | yes (`jira.js`) | |
| Linear importer | no | yes (`@linear/sdk`) | |
| Asana, ClickUp, Confluence importers | no | yes | |
| Flatfile CSV import, zip import | no | yes | |
| HubSpot, Sentry, Pylon | no | yes | |
| Cursor Cloud Agents | no | yes (`/api/agents/cursor`, `CURSOR_WEBHOOK_SECRET`; launches agents, sends follow-ups, verifies `X-Webhook-Signature`) | Directly relevant to Vespra |
| Claude agents | no | yes (`/api/agents/claude`, migration `silo.0020_create_claude_agent_app`) | |
| Webhooks (outbound, HMAC) | yes | yes (+ `webhook-consumer`) | |
| Zapier / Make | no | marketing only | |
| Email (SMTP out) | yes | yes | |
| Email intake (SMTP in) | no | yes | |
| Unsplash covers | yes | yes | |
| Link unfurl / embeds (iframely), draw.io embeds | no | yes | |
| Datadog (`dd-trace`), Sentry SDK, PostHog | no | yes | |
| Marketplace of apps (`/marketplace/`, `oauth_bridge`) | no | yes | |
| SDKs | none in repo | `@makeplane/plane-node-sdk`, `plane-sdk` (Python) on registries | |

## 11. Public API, SDKs, and Plane Compose

- Public API verified live against Plane Cloud with a dev token: `GET https://api.plane.so/api/v1/users/me/` with `X-API-Key` returns the user; the same routes exist in CE under `plane/api/urls/`. Rate limit `60/minute` by default. Resource routes are `workspaces/<slug>/projects/<project_id>/...`.
- **`plane-compose`** (PyPI, AGPL-3.0-or-later, 0.5.2, ~38k LOC Python): Typer CLI, depends on `plane-sdk` + httpx + pydantic. Commands: `plane init`, `plane schema pull|push|import|diff|validate`, `plane push|pull` (work items), `plane clone`, `plane ws ...` (workspace-level templates/state), `plane auth login|connect-workspace`, `plane state`, `plane rate`. Scaffolds `plane.yaml`, `schema/{states,labels,workflows,types,members,features,workitem_templates,page_templates}.yaml`, `work/{workitems,cycles,modules,milestones,pages}.yaml`. Note that several schema targets (workflows with state transitions, work item types with custom properties, templates, milestones) call commercial-only endpoints, so Compose is most useful against Cloud/Commercial.
- Takeaway for Vespra: "projects-as-code" is a strong idea that fits a developer-tool company. A YAML schema + CLI that round-trips against our API is cheap to build once the API is stable.

## 12. Build on Plane vs recreate

### Option A: fork Plane CE and ship it as Vespra Projects

Pros: working product on day one; mature data model; public API, webhooks, publish boards, intake, analytics, editor all exist.

Cons:
- **License.** CE and `@makeplane/propel` are AGPL-3.0. Hosting a modified AGPL service means publishing our modifications. That is incompatible with keeping a differentiated product closed, and it conflicts with the direction already taken in this repo (removing upstream telemetry/branding to own the product).
- **Trademark/brand.** "Plane" branding is pervasive (`Powered by Plane Publish`, logos, changelog URLs, upgrade CTAs to `app.plane.so`). Rebranding is a large, ongoing merge burden.
- **The valuable half is closed.** Integrations, AI, automations, importers, OIDC/SAML, dashboards, templates, custom fields are all in commercial images under a proprietary EULA. We would be rebuilding them anyway.
- **Stack mismatch.** Django/Celery/RabbitMQ is a second backend stack next to our TypeScript/Electron world. Hiring and tooling split.
- **Upstream churn.** 1.4.x is mid-migration (Next -> React Router, old UI -> propel). Tracking upstream while diverging is expensive.

### Option B: use Plane Commercial as an internal tool only

Fine for our own planning (free tier is 12 seats; it runs on one 4 GB VM). Not a product path.

### Option C (recommended): recreate on our own stack, borrowing Plane's design

Use Plane as a **validated blueprint**, not as code:

1. **Data model.** Copy the entity set and relationships from section 6 nearly one-to-one: Workspace / Member / Project / Member / Issue (+ assignee, label, link, attachment, comment, reaction, activity, subscriber, relation, version) / State(group) / Label / Cycle / Module / View / Page / Estimate / Intake / Notification / APIToken / Webhook / DeployBoard / FileAsset. Keep UUID PKs, soft delete, audit columns, `sequence_id` per project under an advisory lock, `sort_order` floats for drag ordering.
2. **Tenancy.** Shared schema, `workspace_id` on every row, slug in the URL, roles 20/15/5 plus per-project membership. Add Postgres row-level security policies keyed on a session variable as a belt-and-braces measure Plane lacks.
3. **Auth.** Session cookies for the web app, API keys for the public API, OIDC from day one (Vespra login via our own IdP as already planned in `2026-10-20-platform-questions.md`). Skip the six-provider matrix; support Vespra login + GitHub.
4. **Frontend.** React 19 + Vite + React Router (same as Plane), but reuse Vespra's design tokens rather than propel (avoid the AGPL dependency). Candidates for primitives: Base UI (MIT) directly, or Radix. Keep Plane's layout model (five layouts over one filter/display-properties object), Power-K palette (cmdk), pragmatic-drag-and-drop, TanStack table/virtual, recharts.
5. **Editor.** TipTap + Yjs + Hocuspocus is the right call and all MIT. Store `description_binary` + HTML + JSON like Plane; run Hocuspocus as a sidecar that validates the app session cookie.
6. **Backend.** TypeScript (NestJS or Hono + Drizzle/Prisma on Postgres) to stay single-language with the rest of Vespra, or keep Django if we want Plane-parity speed. Either way: Postgres 15+, Redis for cache, a job queue (BullMQ on Redis is enough initially; Plane's RabbitMQ is an operational cost we do not need yet), S3-compatible storage with presigned URLs, outbound webhooks with HMAC.
7. **Public API and projects-as-code.** Design the REST API first (OpenAPI), generate a TS SDK, and ship a `vespra projects` CLI with YAML schema push/pull, mirroring `plane-compose`.
8. **Agents.** This is where Vespra can lead. Plane Commercial already integrates Cursor Cloud Agents and Claude through Silo (launch agent from a work item, receive webhook, post results back). Vespra Code owns the agent harness (AHP), so "work item -> agent run -> PR -> status back on the work item" can be first-party and bidirectional, not a bolt-on.
9. **Deliberately defer** (Plane keeps these commercial for a reason, they are large): importers, email intake, custom property engine, automations rule engine, AI retrieval service, SAML/LDAP, dashboards.

Suggested MVP cut for a Linear-like tracker: workspace + members + roles, projects with identifiers, work items with the full property set, states/labels/priority, list + kanban + spreadsheet layouts with saved views, cycles, comments/activity/mentions/notifications, Pages with collaborative editor, public REST API + API keys + webhooks, Power-K, dark/light theme, Vespra login. Everything else goes in `../features/ideas.md`.

## 13. Lab notes: reproducing the local Commercial install

Run on the Cloud Agent VM (Ubuntu 24.04, Docker 29, 16 GB RAM). Not committed anywhere; recorded here so it can be repeated.

1. `curl -fsSL https://prime.plane.so/install/` downloads a Go `prime-cli` (Cobra + Bubble Tea) after sending `/etc/machine-id` as `x-machine-signature`, extracts it to `/bin`, and runs `prime-cli setup`. We ran the binary from `/tmp` instead.
2. `sudo prime-cli setup --silent --domain=<VM IP>` fetches `/opt/plane/{docker-compose.yml,plane.env,Caddyfile}` from `prime.plane.so` and pulls 17 images (`makeplane/*-commercial:v3.3.3`, `postgres:15.7-alpine`, `valkey/valkey:7.2.11-alpine`, `rabbitmq:3.13.6-management-alpine`, `pgsty/minio`, `makeplane/iframely:v2.5.4`). `localhost` is rejected as a domain.
3. Two environment fixes were needed: install the Docker Compose v2 plugin (the CLI assumes `docker compose`), and add `iptables-legacy` FORWARD ACCEPT rules for the `plane_default` bridge because the VM had a stale legacy `FORWARD DROP` policy while Docker writes to nftables (symptoms: `wait_for_db` passes but `migrate` times out; `manage.py startup commercial` hangs calling `prime.plane.so`).
4. Migrations: 427 applied (CE has ~140), including `silo.00xx_create_{hubspot,claude_agent,teams,pylon}_app`. Postgres ends with 319 public tables.
5. Result: `GET /api/instances/` returns `edition: PLANE_COMMERCIAL, current_version: v3.3.3`; `/god-mode/` serves the instance setup wizard; `/spaces/` serves Plane Publish; `/live/health` OK; `/graphql/` answers 401 (exists, needs auth).
6. Default replicas in `plane.env`: Pi, Argus, and Email are `0` (opt-in); Silo, iframely, runner, monitor, consumers are `1`.

## Notes and follow-ups

- Decide whether the first Vespra tracker is a standalone web app, a view inside Vespra Code (webview + extension API), or both sharing one API. Plane's three-frontend split (app / publish / admin) is a reasonable template either way.
- Confirm backend language choice (TypeScript vs Python) before schema work starts; the data model in section 6 is language-neutral.
- Design the agent loop (work item -> AHP run -> PR -> status) as a first-class feature; Plane Commercial's Cursor/Claude integration is the closest prior art.
- The local Commercial instance on the dev VM is left running for exploration; it has no admin account yet (setup wizard pending) and the free tier is capped at 12 seats.
