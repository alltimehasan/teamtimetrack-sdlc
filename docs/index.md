# Team Time Track — Product Documentation

**SDLC phase:** Project Planning + Requirements Analysis
**Document set version:** 1.0
**Status:** Baseline candidate — pending sign-off on the 28 items in [Open Questions](#/open-questions)
**Last updated:** 2026-08-26

---

## What this documentation is

This is the **refined product baseline** for Team Time Track: a multi-tenant SaaS platform for workforce time tracking, activity monitoring, attendance, timesheet approval and payroll preparation.

It converts the raw material in `resources/` into a specification that product managers, business analysts, architects, designers, QA and developers can all work from during System Design and the phases that follow.

It covers **two SDLC phases only**:

1. Project Planning
2. Requirements Analysis

System Design, Database Design, UI/UX Design, Development, Testing and Deployment are **deliberately out of scope** for this document set. Where the source research already contains design-level decisions (schema, table definitions, Laravel migrations), those are recorded here as *inputs to design*, not as requirements — see [Source & Research Audit](#/source-audit).

:::warning Read this before treating any statement as fact
Every material statement in this documentation carries an evidence badge. `{Confirmed}` statements are traceable to the source feature matrix. `{Derived}` statements are conclusions drawn in the research. `{Proposed}` statements are decisions made *by this document* and have never been reviewed by a stakeholder. Do not treat a `{Proposed}` item as an agreed requirement.
:::

---

## Document map

| Document | Contains | Primary audience |
|---|---|---|
| [Overview](#/index) | This page — conventions, legend, document control | Everyone |
| [Glossary](#/glossary) | Canonical terminology and the concepts they name | Everyone |
| [Product Vision](#/product-vision) | Problem, users, value proposition, goals, business objectives, non-goals | Product, business |
| [Scope](#/scope) | MVP / in scope / out of scope / deferred, plan-tier scope, the authoritative feature matrix | Product, engineering |
| [Product Analysis](#/product-analysis) | Capability baseline analysis, what to adopt / modify / exclude, evidence limits | Product |
| [Product Modules](#/product-modules) | The 22 functional modules, their purpose, users, dependencies and MVP classification | Architecture, product |
| [Project Planning](#/project-planning) | Objectives, success criteria, release plan, phases, milestones, dependencies, governance | Project management |
| [Stakeholders](#/stakeholders) | Stakeholder types, goals, responsibilities, permissions, interactions | Product, business |
| [Personas](#/personas) | Six working personas with goals, pain points and key workflows | Product, UX |
| [User Journeys](#/user-journeys) | 18 end-to-end workflows across the whole product | Product, UX, QA |
| [Functional Requirements](#/functional-requirements) | `REQ-*` — the system shall statements, flows and acceptance criteria | Engineering, QA |
| [Non-Functional Requirements](#/non-functional-requirements) | `NFR-*` — performance, scalability, security, privacy, reliability, maintainability, compatibility | Engineering, ops |
| [Business Rules](#/business-rules) | `BR-*` — invariants and policies that requirements depend on | Engineering, QA |
| [Security & Privacy](#/security-privacy) | Threat surface, monitoring-specific privacy analysis, controls, areas requiring legal review | Security, legal, product |
| [Risks](#/risks) | `RISK-*` — impact, likelihood, mitigation, owner | Project management |
| [Traceability](#/traceability) | Source → goal → feature → requirement → acceptance criteria | BA, QA, audit |
| [Source & Research Audit](#/source-audit) | Inventory of `resources/`, transcribed feature matrix, `CONF-*` conflicts, `GAP-*` gaps | BA, product |
| [Assumptions](#/assumptions) | `ASM-*` — everything taken as true without evidence | Everyone |
| [Open Questions](#/open-questions) | `OQ-*` — 28 decisions required before or during System Design | Product, leadership |

---

## Requirement identifier scheme

All identifiers are stable. Once published, an ID is never reused or renumbered; a withdrawn requirement is marked `Withdrawn` and kept.

```text
REQ-<MODULE>-<NNN>     Functional requirement
NFR-<CATEGORY>-<NNN>   Non-functional requirement
BR-<MODULE>-<NNN>      Business rule
RISK-<NNN>             Risk
ASM-<NNN>              Assumption
OQ-<NNN>               Open question / decision required
CONF-<NN>              Conflict found in source research
GAP-<NN>               Gap found in source research
JRN-<NN>               User journey
```

Module codes used by `REQ-*` and `BR-*`:

| Code | Module | Code | Module |
|---|---|---|---|
| `AUTH` | Authentication & identity | `SCHED` | Schedules |
| `ORG` | Organization & settings | `ATT` | Attendance & breaks |
| `USER` | Membership & user management | `LEAVE` | Leave management |
| `RBAC` | Roles & permissions | `TS` | Timesheets & approvals |
| `TEAM` | Teams | `PAY` | Payroll |
| `PROJ` | Projects & tasks | `REPORT` | Reports & dashboards |
| `DEV` | Devices & desktop tracker | `NOTIF` | Notifications |
| `TIME` | Time tracking engine | `BILL` | Plans, subscriptions & entitlements |
| `SYNC` | Offline synchronisation | `AUDIT` | Audit logging |
| `MON` | Activity monitoring | `DATA` | Data retention & deletion |
| `REC` | Video screen recording | `ADMIN` | Platform administration |

---

## Badge legend

### Evidence class

Every requirement, rule and scope statement carries exactly one.

| Badge | Meaning |
|---|---|
| `{Confirmed}` | Directly supported by `resources/Features_Per_Plan.pdf`, the only primary source document |
| `{Derived}` | A conclusion argued in the research notes (`resources/resources-*.md`), consistent with the feature matrix |
| `{Proposed}` | A product decision made in *this* document set with no supporting evidence in `resources/` |
| `{Open}` | Cannot be settled without a stakeholder decision — see [Open Questions](#/open-questions) |

### Priority (MoSCoW)

| Badge | Meaning |
|---|---|
| `{P0}` | Must — MVP cannot launch without it |
| `{P1}` | Should — targeted for MVP; descopeable under schedule pressure |
| `{P2}` | Could — post-MVP, planned for V1.1 |
| `{P3}` | Won't (this release) — recorded so it is not lost |

### Release

`{MVP}` · `{V1.1}` · `{V2}` · `{Future}`

### Commercial plan

`{Basic}` · `{Standard}` · `{Premium}`

### Risk / severity

`{High}` · `{Medium}` · `{Low}`

---

## Source material

All source material lives in `resources/` and is **never modified**. It consists of:

| Source | Type | Weight |
|---|---|---|
| `Features_Per_Plan.pdf` | Commercial feature matrix across Basic / Standard / Premium, with future-release markers and data-retention periods | **Primary.** The only document that constrains what the product must commercially deliver |
| `resources-1.md` … `resources-14.md` | Fourteen sequential design-conversation transcripts covering product planning, system architecture, domain model, logical ERD, physical PostgreSQL design and Laravel migration planning | **Secondary.** Reasoned design work, internally inconsistent in places, and substantially ahead of the current SDLC phase |

The full inventory, the transcribed matrix and every conflict found between these sources are in [Source & Research Audit](#/source-audit).

:::note Naming
The brief that commissioned this documentation refers to the product as *"Time Time Track"*. All fourteen research files, and the repository itself (`teamtimetrack-sdlc`), use **"Team Time Track"**. This documentation uses **Team Time Track** throughout and raises the discrepancy as [`OQ-001`](#/open-questions). See [`CONF-01`](#/source-audit).
:::

---

## Document control

| Field | Value |
|---|---|
| Owner | Product Management |
| Contributors | Business Analysis, Architecture, Security |
| Review cycle | On every scope change; mandatory review before System Design sign-off |
| Approval required from | Product owner, engineering lead, security/privacy reviewer |
| Baseline status | **Not baselined.** 28 open questions block sign-off |

### Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-08-26 | Initial consolidation of `resources/` into a planning + requirements baseline |
