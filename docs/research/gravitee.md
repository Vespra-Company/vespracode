# Gravitee — research notes

**Official site:** https://www.gravitee.io/  
**Docs:** https://documentation.gravitee.io/  
**GitHub org:** https://github.com/gravitee-io  

## What it is

Gravitee markets itself as an **AI Agent Management Platform** that also manages APIs and event streams under one control plane (identity, policy, portals, observability). Source: [gravitee.io](https://www.gravitee.io/).

Historically and in product docs, the core is **Gravitee API Management (APIM)** — an open-source gateway + lifecycle platform for sync/async APIs — plus **Access Management (AM)** for OAuth2/OIDC/SAML IAM. Sources: [APIM intro](https://documentation.gravitee.io/apim/), [AM intro](https://documentation.gravitee.io/am/), [GitHub org](https://github.com/gravitee-io).

## Main products

| Product | Role | Primary source |
| --- | --- | --- |
| **APIM** | API gateway, lifecycle, portal, policies for REST/etc. | [docs](https://documentation.gravitee.io/apim/), [repo](https://github.com/gravitee-io/gravitee-api-management) |
| **AM** | Identity broker / IAM (OAuth2, OIDC, SAML) | [docs](https://documentation.gravitee.io/am/), [repo](https://github.com/gravitee-io/gravitee-access-management) |
| **Event Management** | Kafka/MQTT/etc. mediation; message APIs (EE) | [EE feature list](https://documentation.gravitee.io/apim/readme/enterprise-edition) |
| **AI Agent Management** | MCP Tool Server, A2A/LLM proxies, agent catalog (EE / paid module) | [AI Agent Management](https://documentation.gravitee.io/apim/ai-agent-management), [pricing modules](https://www.gravitee.io/pricing) |
| **Alert Engine** | Proactive alerts (EE plugin pack) | [EE docs](https://documentation.gravitee.io/apim/readme/enterprise-edition) |

## OSS vs commercial / license traps

- **OSS CE:** APIM and AM Community Edition are **Apache License 2.0**. Sources: [APIM LICENSE.txt](https://raw.githubusercontent.com/gravitee-io/gravitee-api-management/master/LICENSE.txt), [AM LICENSE.txt](https://raw.githubusercontent.com/gravitee-io/gravitee-access-management/master/LICENSE.txt).
- **CE vs EE (product-level):** CE = OSS APIM/AM, self-hosted only, limited Cloud/API Designer; EE = paid license, adds EE features and SaaS/hybrid hosting. Source: [CE vs EE table (4.11 docs)](https://documentation.gravitee.io/apim/4.11/readme/enterprise-edition).
- **License trap:** EE needs a `license.key` (env var or file); without it EE nodes don’t run. Source: [EE licensing](https://documentation.gravitee.io/apim/readme/enterprise-edition/enterprise-edition-licensing).
- **AI/MCP is EE:** MCP Tool Server is explicitly **Enterprise only**. Message/event API entrypoints are EE since 4.3. Source: [v4 entrypoints](https://documentation.gravitee.io/apim/create-and-configure-apis/configure-v4-apis/entrypoints).
- **Commercial pricing:** Paid tiers start at **$2,500/month** (Planet); Agent Management / Event Management are **add-on modules**. Source: [pricing](https://www.gravitee.io/pricing).

## vs APISIX / Kong (one line)

For a pure API gateway pick: **APISIX** and **Kong** are high-performance open-source gateways (Apache 2.0 / OSS + enterprise); **Gravitee** is a fuller APIM + IAM platform whose MCP/agent/event story is largely **paid EE**, not a lightweight OSS gateway substitute. Sources: [APISIX](https://apisix.apache.org/), [Kong Gateway](https://konghq.com/products/kong-gateway), [Gravitee EE](https://documentation.gravitee.io/apim/readme/enterprise-edition).

## Useful for Vespra (API + AI/MCP agents)?

**Maybe — only if budget/ops for Gravitee EE.** Feature fit for MCP/agent governance is strong on paper (MCP Tool Server, agent catalog, LLM/A2A proxies). For an OSS-first VS Code fork / self-hosted stack, CE alone does **not** unlock the MCP/agent pieces; Kong/APISIX (or native MCP) may fit better unless buying Gravitee Agent Management. Sources: [MCP EE warning](https://documentation.gravitee.io/apim/create-and-configure-apis/configure-v4-apis/entrypoints), [AI Agent Management](https://documentation.gravitee.io/apim/ai-agent-management), [pricing](https://www.gravitee.io/pricing).
