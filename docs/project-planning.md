# Project Planning

---

## 1. Project overview

| Field | Value |
|---|---|
| **Project name** | Team Time Track — see [`OQ-001`](#/open-questions) for the naming discrepancy |
| **Product type** | Multi-tenant SaaS workforce time-tracking and activity-monitoring platform |
| **Initial release** | MVP / V1 |
| **Current SDLC phase** | Project Planning + Requirements Analysis |
| **Next phase** | System Design |
| **Clients delivered at MVP** | Web application; desktop tracker (Windows, macOS, Linux) |
| **Commercial model** | Self-serve subscription across three plans: Basic, Standard, Premium |
| **Baseline status** | **Not baselined** — 28 open questions outstanding |

### Mission

> Build a platform that records how an organization's time is actually spent, converts it into approved and payable time through an auditable chain, and does so without losing time and without hiding anything from the people being measured.

### Objectives

| ID | Objective | Type |
|---|---|---|
| `O-01` | Deliver a commercially sellable MVP covering the full Basic and Standard tiers | Product |
| `O-02` | Build the complete capture engine once, and gate features commercially rather than building tiered capture paths | Technical |
| `O-03` | Make organization data isolation provable, not assumed | Technical |
| `O-04` | Deliver offline-capable capture with exactly-once synchronisation | Technical |
| `O-05` | Enforce that payroll can only consume approved time | Product |
| `O-06` | Ship employee transparency in the same release as monitoring, not after it | Product |
| `O-07` | Establish a single entitlement resolution path so plans can be repackaged without code changes | Technical |
| `O-08` | Operate on a single-VPS deployment without container orchestration through early growth | Operational |

`O-08` is `{Derived}` from `resources-2.md` §17, which explicitly rejects Docker, Kubernetes and microservices for the initial architecture. Recorded here so the constraint survives into System Design as a decision rather than an omission.

---

## 2. Expected outcomes

| Outcome | Description |
|---|---|
| **A working product** | An organization can complete the whole chain — register, subscribe, configure, invite, track, monitor, schedule, approve and pay — without vendor assistance |
| **An enforced commercial model** | Basic, Standard and Premium behave differently at the API, not only in the UI |
| **A defensible evidence chain** | Any figure in any report can be traced back to its source events or to an attributed manual entry |
| **An operable platform** | Sync failure rate, queue depth and job failures are observable per organization before customers report problems |
| **A documented baseline** | This document set, signed off, as the input to System Design |

---

## 3. Success criteria

Measurable and testable. A criterion without a threshold is not a criterion.

### Launch gates — all must pass

| ID | Criterion | Threshold | Verified by |
|---|---|---|---|
| `SC-01` | No cross-organization data access | Zero findings across automated tenant-isolation tests covering every tenant-scoped endpoint | Automated test suite + security review |
| `SC-02` | Offline capture is lossless | 8-hour offline session followed by reconnection produces time entries matching local capture to the second, with zero duplicates across three retry cycles | Integration test |
| `SC-03` | Synchronisation is idempotent | Replaying an identical event batch 10 times creates exactly one set of records | Automated test |
| `SC-04` | Payroll excludes unapproved time | Attempting payroll calculation over a period containing unapproved timesheets excludes that time and reports it explicitly | Automated test |
| `SC-05` | Entitlements are enforced server-side | Every Standard and Premium endpoint refuses a Basic organization when called directly, bypassing the UI | Automated test per gated endpoint |
| `SC-06` | Retention actually deletes | Data past its retention period is removed from both object storage and the database within 24 hours of expiry | Scheduled job test |
| `SC-07` | Employee self-visibility is complete | For every category of data captured about a member, that member can view their own | Manual verification checklist |
| `SC-08` | Audit coverage is complete | Every permission-relevant and policy-changing action produces an audit record with actor, before and after | Coverage checklist |
| `SC-09` | Approval history is immutable | No API path modifies or deletes an approval record | Code review + automated test |
| `SC-10` | Performance targets met under load | See [`NFR-PERF-001`](#/non-functional-requirements) to [`NFR-PERF-006`](#/non-functional-requirements) | Load test |

### Post-launch health indicators

Not gates; monitored from day one.

| ID | Indicator | Target | Why |
|---|---|---|---|
| `SC-11` | Desktop tracker sync failure rate | < 0.1% of batches unresolved after retry | The single most important operational metric — `resources-2.md` §18 |
| `SC-12` | Median time from timesheet submission to decision | < 48 hours | Slow approval blocks payroll |
| `SC-13` | Payroll periods reopened after processing | < 2% | Reopening indicates the chain failed upstream |
| `SC-14` | Trial-to-paid conversion | Baseline in first quarter, no target set | No commercial targets exist — [`OQ-007`](#/open-questions) |
| `SC-15` | Screenshot upload failure rate | < 0.5% | Evidence gaps undermine dispute resolution |

---

## 4. Release plan

Vertical slices, each ending in something demonstrable. `{Derived}` from `resources-2.md` §20, resequenced so that audit, entitlements and privacy controls are built alongside features rather than retrofitted.

### R0 — Foundation

**Delivers:** authentication, organizations, memberships, roles, permissions, invitations, organization settings, audit logging skeleton.

**Demonstrable:** a person registers, creates an organization, invites a colleague, who accepts and appears with a role. Every action appears in the audit log.

**Exit criteria:** tenant isolation tests pass on every endpoint built so far; audit writes are automatic, not per-endpoint.

:::note Audit and entitlements start in R0
Both are cross-cutting. `resources-2.md` §20 places billing in phase 10 and does not schedule audit at all. Retrofitting either into twenty completed modules costs several times what building alongside costs, and retrofitting audit reliably is close to impossible. This is a deliberate departure from the source sequencing.
:::

### R1 — Work management

**Delivers:** teams, projects, project membership, tasks, task assignment.

**Demonstrable:** an administrator builds the structure that time will later be attributed to.

**Exit criteria:** all assignment rules enforced server-side; no cross-organization assignment possible.

### R2 — Capture core {Highest risk}

**Delivers:** device registration, desktop tracker for one platform, session and event capture, local durable store, batch sync with idempotency, server-side time entry derivation, idle detection, manual time entry.

**Demonstrable:** a member tracks a session, disconnects for an hour, reconnects, and the hour is present exactly once.

**Exit criteria:** `SC-02` and `SC-03` pass.

:::warning Do a technical spike before R2 is planned in detail
Idle detection, window focus detection, screen capture and durable local storage behave differently on each OS and several need user-granted permissions. Spike all four on all three platforms before committing to an R2 schedule. [`RISK-001`](#/risks)
:::

### R3 — Monitoring

**Delivers:** screenshot capture and viewing, activity events, application usage, website usage, productivity rules, **member self-visibility**, retention enforcement.

**Demonstrable:** a manager reviews a member's session with evidence attached; the member sees exactly the same evidence about themselves; data past retention is gone.

**Exit criteria:** `SC-06` and `SC-07` pass.

### R4 — Workforce

**Delivers:** schedules with overnight shifts, dated assignment, attendance derivation, breaks, leave types and requests, holiday calendar.

**Demonstrable:** an overnight-shift member's attendance is correct; approved leave produces `on_leave`, never `absent`.

**Exit criteria:** attendance is fully recomputable from inputs; timezone handling verified across at least three timezones.

### R5 — Approval and pay

**Delivers:** timesheets, submission, approval, rejection, approval history, reopening, pay rates, payroll periods, calculation, export.

**Demonstrable:** the full chain, tracked session through to an exported payroll line, with an audit trail at every step.

**Exit criteria:** `SC-04`, `SC-09` pass; rate change mid-period applies correctly.

### R6 — Reporting

**Delivers:** all eleven reports, common filter model, export, individual/team/organization dashboards.

**Demonstrable:** every persona's primary question answered from a report.

**Exit criteria:** `SC-10` performance targets met with a realistic data volume — see [`NFR-SCALE-002`](#/non-functional-requirements).

### R7 — Commercialisation

**Delivers:** plans, features, entitlement service, feature gating on every gated endpoint, trial, subscription lifecycle, payment, invoices, seat counting, notification preferences, real-time notifications.

**Demonstrable:** a trial organization upgrades, gains Standard features immediately, and a Basic organization is refused a Standard endpoint called directly.

**Exit criteria:** `SC-05` passes for every gated endpoint.

### R8 — Premium

**Delivers:** video screen recording (chunked, resumable), Office vs Remote, internet connectivity reporting.

**Demonstrable:** a Premium organization records, uploads and plays back; a crash mid-recording loses at most one segment.

**Exit criteria:** recording survives forced termination with at most one segment lost.

### R9 — Hardening

**Delivers:** security review, load testing, backup and restore rehearsal, monitoring and alerting, error handling review, accessibility review, disaster-recovery documentation.

**Exit criteria:** all launch gates `SC-01` to `SC-10` pass; a restore has actually been performed, not merely configured.

:::warning Durations are not estimated here
No team size, composition, availability or velocity data exists in `resources/`. Publishing invented dates would be worse than publishing none. Sequencing and dependencies are given; scheduling is [`OQ-021`](#/open-questions).
:::

---

## 5. Milestones

| ID | Milestone | Gate |
|---|---|---|
| `M-01` | Requirements baseline signed off | All 28 open questions resolved or explicitly deferred with an owner |
| `M-02` | System Design approved | Architecture, data model, API contracts and the tenant-isolation strategy reviewed |
| `M-03` | Tracker technical spike complete | Idle, focus, capture and local storage proven on all three target platforms |
| `M-04` | Foundation complete | R0 + R1 exit criteria met |
| `M-05` | **Capture proven** | R2 exit criteria met — the highest-risk milestone in the project |
| `M-06` | Evidence chain complete | R3 + R4 + R5 exit criteria met |
| `M-07` | Feature complete for Basic + Standard | R6 + R7 exit criteria met |
| `M-08` | Premium complete | R8 exit criteria met |
| `M-09` | Launch readiness | R9; all launch gates pass; legal review complete |

`M-05` is the project's genuine go/no-go point. If capture is not lossless and idempotent by then, no downstream module has value.

---

## 6. Dependencies

### Internal

| Dependency | Blocks | Note |
|---|---|---|
| Requirements sign-off | System Design | 28 open questions |
| System Design sign-off | All implementation | Includes the physical schema already largely drafted in `resources-8` to `resources-14` |
| Tracker spike | R2 planning | Do not schedule R2 in detail before this completes |
| Entitlement service | Every gated feature | Build in R0/R7 but design in System Design |
| Audit infrastructure | Every module | Must be automatic, not per-endpoint |

### External

| Dependency | Status | Risk |
|---|---|---|
| Billing provider selection | **Not chosen** — abstracted only | [`RISK-008`](#/risks), [`OQ-009`](#/open-questions) |
| Transactional email provider | **Not chosen** | [`OQ-010`](#/open-questions) |
| Object storage for media | Cloudflare R2 indicated in `resources-2.md` §9 | Single-provider dependency for all evidence |
| Code signing certificates (Windows, macOS) | **Not procured** | Blocks desktop distribution; lead time is often weeks — [`RISK-009`](#/risks) |
| macOS notarisation | Not started | Blocks macOS distribution |
| Legal review of monitoring lawfulness | **Not started** | [`RISK-005`](#/risks) — treated as a launch blocker |
| Hosting (VPS) | Indicated in `resources-2.md` | Single point of failure at MVP — [`RISK-010`](#/risks) |

:::warning Two external dependencies are commonly underestimated
Code signing and macOS notarisation are procurement and identity-verification processes with real lead times, and nothing ships to customer machines without them. Start both before R2 completes.
:::

---

## 7. Constraints

| Constraint | Source | Implication |
|---|---|---|
| Single-VPS deployment, no containers or orchestration initially | `resources-2.md` §17 {Derived} | Vertical scaling only; no automatic failover; backup and restore must be rehearsed manually |
| Modular monolith, not microservices | `resources-2.md` §1 {Derived} | Module boundaries must be enforced by discipline and code review |
| PostgreSQL as the single source of truth | `resources-8.md` §1 {Derived} | Redis is cache and queue only, never authoritative |
| Media in object storage, never in the database | `resources-14.md` Rule 5 {Derived} | Deletion is a two-system operation and can partially fail |
| No pre-computed aggregates at MVP | `resources-6.md` §6 {Derived} | Report performance depends entirely on indexing |
| No table partitioning at MVP | `resources-10.md` §32 {Derived} | High-volume tables must be partition-*ready*, and monitored |
| English-only interface | {Proposed}, `ASM-012` | Multi-timezone and multi-currency are supported; multi-language is not |

---

## 8. Governance

### Decision rights

| Decision type | Owner | Consulted |
|---|---|---|
| Scope and plan composition | Product owner | Engineering lead, commercial |
| Commercial matrix changes | Product owner | Engineering lead |
| Architecture and data model | Engineering lead | Architect |
| Monitoring, privacy and retention defaults | Product owner | Legal, security |
| Requirement priority | Product owner | Engineering lead |
| Release go/no-go | Product owner + engineering lead | Security, operations |

### Change control

Once `M-01` is passed, changes to a `{P0}` requirement require: a written rationale, an impact assessment across [Traceability](#/traceability), and product owner approval. Changes to `{P1}` and below require an impact note only.

### Review cadence

| Review | Frequency | Purpose |
|---|---|---|
| Open questions review | Weekly until `M-01` | Drive open questions to zero |
| Risk review | Fortnightly | Reassess likelihood and mitigation status |
| Requirements/traceability review | At each release gate | Catch drift between built and specified |
| Security & privacy review | At `M-02`, `M-06`, `M-09` | Design, evidence chain, and pre-launch |

---

## 9. Quality strategy

| Layer | Approach |
|---|---|
| **Tenant isolation** | Automated test per tenant-scoped endpoint, executed on every build. This is the one test category that must never be skipped |
| **Idempotency** | Property-based replay testing on the sync endpoint |
| **Time correctness** | Test matrix across timezones, DST transitions, and overnight shifts |
| **Financial correctness** | Golden-dataset tests for payroll: known input, known output, checked to the cent |
| **Entitlements** | Automated matrix test — every gated endpoint × every plan |
| **Desktop tracker** | Manual test matrix across OS versions; automated tests for the local store and sync queue |
| **Performance** | Load testing against realistic volumes before `M-07` |
| **Accessibility** | Keyboard and screen-reader review of the web application before `M-09` |
| **Security** | Threat model at `M-02`; review at `M-06`; penetration test before `M-09` |

---

## 10. What planning cannot yet answer

Recorded honestly rather than filled with placeholders.

| Unknown | Registered as |
|---|---|
| Team size, composition and availability | [`OQ-021`](#/open-questions) |
| Target launch date | [`OQ-021`](#/open-questions) |
| Budget | Not in scope of this document set |
| Pricing and revenue targets | [`OQ-007`](#/open-questions) |
| Target launch jurisdictions — which determines the legal review's scope | [`OQ-014`](#/open-questions) |
| Whether Premium ships at launch | [`OQ-013`](#/open-questions) |
