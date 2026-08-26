# Assumptions

Everything this documentation takes as true without evidence in `resources/`. Each assumption states what was assumed, why, what depends on it, and what happens if it turns out to be wrong.

**An assumption is not a decision.** Anything here can be overturned by a stakeholder at no cost to the documentation — but not at no cost to the plan. The "if wrong" column is the impact of overturning it late.

:::warning How to use this list
Read it before reading anything else that surprises you. Most apparent gaps in the requirements are explained by an assumption here. If you disagree with one, say so now rather than during implementation.
:::

---

## Product and commercial

### ASM-001 — The feature matrix describes Team Time Track, not a competitor
{High impact}

**Assumed:** `Features_Per_Plan.pdf` defines what *this* product must commercially deliver, rather than documenting a competitor's offering for reference.

**Basis:** the research treats it as the product's commercial baseline throughout (`resources-1.md` §2 calls it "our commercial feature matrix"). The file itself does not state its provenance.

**Depends on it:** the entire [Scope](#/scope) document; every `{Confirmed}` badge; the plan composition in [Product Analysis](#/product-analysis).

**If wrong:** the product has no defined commercial scope at all, and Requirements Analysis must restart from a new source.

---

### ASM-002 — Pricing is per-seat, billed monthly or annually
{Medium impact}

**Assumed:** the commercial model is per-active-Membership subscription pricing with a choice of billing interval.

**Basis:** `resources-1.md` §7 lists monthly and annual billing and seat limits as required capabilities. No price, currency or seat band appears anywhere.

**Depends on it:** [`REQ-BILL-006`](#/functional-requirements) seat counting; downgrade guardrails; the trial model.

**If wrong:** usage-based or flat-rate pricing would change seat handling and the entitlement limit model. The `plan_features` typed-limit design absorbs most of the change; seat enforcement would need rework. [`OQ-007`](#/open-questions)

---

### ASM-003 — Trial is self-serve, time-limited, and grants the selected plan in full
{Low impact}

**Assumed:** a prospective customer selects a plan and trials it with complete entitlements for a fixed period, without sales involvement.

**Basis:** every enterprise sales enabler — SSO, provisioning, HRIS, API — is future release `{Confirmed}`, which means self-serve is the only sales motion available at launch.

**If wrong:** a feature-limited or sales-assisted trial changes onboarding but not the entitlement model.

---

### ASM-004 — MVP ships desktop and web clients only
{High impact}

**Assumed:** the desktop tracker (Windows, macOS, Linux) and the web application are the launch clients. Mobile and Chrome clients are {V1.1}.

**Basis:** `resources-1.md` §12 prioritises desktop before mobile. **This contradicts the feature matrix**, which grants all five platforms to all plans — [`CONF-04`](#/source-audit).

**Depends on it:** the release plan; [`NFR-COMPAT-002`](#/non-functional-requirements); the scope of `RISK-001`.

**If wrong:** adding a mobile client to MVP is a substantial addition — a fourth client surface, a new capture model, and app store distribution. [`OQ-002`](#/open-questions)

---

### ASM-005 — The product serves small and mid-sized organizations
{Medium impact}

**Assumed:** target organizations are roughly 5 to 500 people, buying self-serve.

**Basis:** inferred from the deferral of every enterprise capability, and from the absence of any procurement-oriented feature in the matrix.

**Depends on it:** the concurrency and volume figures in [`NFR-SCALE-001`](#/non-functional-requirements) and [`NFR-SCALE-002`](#/non-functional-requirements); the single-VPS deployment decision.

**If wrong:** a larger target changes infrastructure, the isolation strategy and the priority of SSO and provisioning.

---

### ASM-006 — Premium ships at launch
{Medium impact}

**Assumed:** video recording, Office vs Remote and internet connectivity are delivered in MVP, making three sellable tiers at launch.

**Basis:** all three are `{Confirmed}` Premium features; `resources-2.md` §20 schedules recording as a development phase rather than a future item.

**If wrong:** launching with Basic and Standard only is a legitimate choice. It requires publishing a two-tier matrix rather than a Premium tier with unavailable features. [`OQ-013`](#/open-questions), [`RISK-004`](#/risks)

---

## Users and organization

### ASM-007 — Contractors are Memberships with the Employee role
{Medium impact}

**Assumed:** no separate contractor concept. A contractor is a Membership with the Employee role and an hourly Pay Rate.

**Basis:** `resources/` never distinguishes them. The brief mentions contractors as a stakeholder type.

**If wrong:** if contractors need different leave, schedule, approval or invoicing behaviour, that is a new role and new rules in `LEAVE`, `SCHED` and `TS`. [`OQ-018`](#/open-questions)

---

### ASM-008 — Finance is an Administrator, not a separate role
{Low impact}

**Assumed:** payroll actions are performed by an Owner or Administrator. A dedicated Finance role is {V1.1}.

**Basis:** `resources-3.md` §6 anticipates a `payroll_manager` role as future.

**If wrong:** separating it means an Administrator who cannot see pay rates, and a Finance role that cannot change organization settings — a permission split, not a structural change. [`OQ-019`](#/open-questions)

---

### ASM-009 — One Manager scope model suffices
{Medium impact}

**Assumed:** a Manager's scope is the Members of Teams they manage, plus explicitly assigned Members. No hierarchy, no delegation, no acting-manager cover.

**Basis:** `resources/` describes Teams and Managers without any hierarchy.

**Depends on it:** [`BR-RBAC-004`](#/business-rules); the approval flow.

**If wrong:** approval delegation during absence is a common real requirement. Without it, approvals stall when a Manager takes leave — which is the moment they are most likely to be needed. Worth raising early.

---

### ASM-010 — Approval is single-level
{Medium impact}

**Assumed:** one approver decides a Timesheet. No multi-stage or sequential approval.

**Basis:** `resources-12.md` §37–39 describes a single reviewer.

**If wrong:** multi-stage approval changes the Timesheet state machine and the approval history model. Additive rather than structural, but not trivial.

---

### ASM-011 — Every tracked person is a Member of the Organization
{Low impact}

**Assumed:** there is no concept of tracking someone who is not a Membership.

**Basis:** the entire model is Membership-anchored.

---

## Technical and operational

### ASM-012 — English-only interface at MVP
{Low impact}

**Assumed:** the product ships in English. Multi-timezone and multi-currency are supported; multi-language is not.

**Basis:** no source mentions localisation — `GAP-11`. The design's multi-timezone and multi-currency support implies international customers, which makes the assumption worth flagging rather than burying.

**If wrong:** localisation is far cheaper if text is externalised from the start, which [`NFR-USE-006`](#/non-functional-requirements) requires even at MVP.

---

### ASM-013 — Single-region deployment
{Medium impact}

**Assumed:** all data is stored and processed in one region.

**Basis:** `resources-2.md` §17 describes a single VPS.

**Depends on it:** [`NFR-PRIV-008`](#/non-functional-requirements); which markets can be sold into.

**If wrong:** data residency requirements in a target market would force a multi-region architecture, which changes deployment, backup and the tenancy model. Determined by legal question L8 in [Security & Privacy](#/security-privacy).

---

### ASM-014 — The performance and scale figures are the right order of magnitude
{Medium impact}

**Assumed:** 500 organizations, 10,000 memberships, 2,000 concurrent trackers, 200 events/second at launch scale.

**Basis:** none. Derived from `ASM-005`.

**Depends on it:** infrastructure sizing; whether aggregate tables are needed at MVP; [`RISK-013`](#/risks).

**If wrong:** an order of magnitude higher would require aggregate tables, read replicas and partitioning at MVP rather than V1.1. [`OQ-008`](#/open-questions)

---

### ASM-015 — 99.5% availability is acceptable
{Medium impact}

**Assumed:** roughly 3.6 hours of monthly downtime is acceptable, because offline capture means an outage degrades reporting rather than losing time.

**Basis:** the single-VPS decision makes anything higher undeliverable without an infrastructure change.

**If wrong:** a customer requiring higher availability requires redundancy, which contradicts the current deployment decision. [`RISK-010`](#/risks)

---

### ASM-016 — Retention deletion is permanent and unconditional
{Medium impact}

**Assumed:** expired data is deleted with no legal-hold exception and no recovery path.

**Basis:** the retention periods are stated as commercial commitments `{Confirmed}`; no source mentions holds.

**If wrong:** a legal-hold mechanism must exist before a customer needs one, because by then the data is gone. Noted in [`REQ-DATA-003`](#/functional-requirements); legal question L12.

---

### ASM-017 — Backups outside production are sufficient
{Low impact}

**Assumed:** daily full backups plus transaction log capture, stored off-host, meet the recovery objectives.

**Basis:** `resources-2.md` §19.

**If wrong:** a tighter RPO requires continuous replication.

---

## Monitoring and privacy

### ASM-018 — Organizations are responsible for lawful monitoring notice
{High impact}

**Assumed:** the customer organization, as employer, is responsible for notifying its workforce and establishing a lawful basis. The vendor provides the mechanisms.

**Basis:** none. This is a `{Proposed}` position and it is a legal question, not a product one.

**Depends on it:** the disclosure model in [`REQ-MON-009`](#/functional-requirements); the whole risk posture.

**If wrong:** if the vendor bears direct obligations to the monitored individuals in some jurisdictions, that changes contractual terms, the onboarding flow and possibly the product's saleability there. Legal questions L2–L5. [`RISK-005`](#/risks)

---

### ASM-019 — Employee transparency is acceptable to customers
{High impact}

**Assumed:** organizations will accept — and most will prefer — that their employees can see everything captured about them.

**Basis:** none. It is a `{Proposed}` product position.

**Depends on it:** [`REQ-MON-010`](#/functional-requirements), [`BR-MON-009`](#/business-rules), and the differentiation argued in [Product Vision](#/product-vision) §6.

**If wrong:** some prospects will ask for transparency to be disabled. **This documentation's position is that the answer should be no**, and that losing those prospects is preferable to the risk in [`RISK-015`](#/risks) — but that is a decision for the product owner, not for a document. Raise it before it arrives as a sales escalation.

---

### ASM-020 — Screenshot capture defaults are moderate, not maximal
{Medium impact}

**Assumed:** a moderate default interval with randomisation, an enforced minimum, and organization configurability — rather than a maximally intrusive default.

**Basis:** none. The matrix specifies no interval. `resources/` mentions a 15-minute and a 10-minute interval only as illustrative examples (`resources-3.md` §37).

**If wrong:** the specific default is a product decision with real privacy weight, and should be made deliberately. [`OQ-028`](#/open-questions)

---

### ASM-021 — The idle threshold default is five minutes
{Low impact}

**Assumed:** 300 seconds, configurable within bounds.

**Basis:** `resources-9.md` §13 gives `idle_timeout_seconds: 300` in a settings example — the only concrete number of its kind anywhere in the sources.

---

## Process

### ASM-022 — The database design work is a design input, not a requirement
{Medium impact}

**Assumed:** `resources-3.md` through `resources-14.md` — ERDs, physical schema, migration plans, the 51-table design — belong to System Design and Database Design, not to Requirements Analysis. This documentation records their *conclusions* where they constitute business rules, and leaves their *structure* to the next phase.

**Basis:** the SDLC phase boundary stated in the brief.

**If wrong:** if the schema is considered frozen, several items raised here as design inputs — the missing sync ledger (`CONF-11`), the non-nullable break session (`CONF-06`), the system-role uniqueness defect (`CONF-14`) — would need to be reopened as change requests instead.

---

### ASM-023 — The 51-table design is substantially correct
{Medium impact}

**Assumed:** the schema in `resources-14.md` §58 is a sound basis for System Design, subject to the conflicts and gaps recorded in [Source & Research Audit](#/source-audit).

**Basis:** it is internally consistent, follows sound principles (UUID keys, UTC timestamps, integer seconds, fixed-precision money, restrictive deletes on historical records), and was developed iteratively across seven documents.

**If wrong:** System Design revisits it. The business rules in this documentation are stated independently of the schema, so they survive a schema change.

---

### ASM-024 — Nothing in this documentation has been reviewed by a stakeholder
{High impact}

**Assumed, and true:** every `{Proposed}` item — 21 of 161 functional requirements and 28 of 65 non-functional ones — represents a decision made during documentation, not one made by a person with authority to make it.

**Consequence:** this document set is a **baseline candidate**, not a baseline. Milestone `M-01` in [Project Planning](#/project-planning) is the point at which that changes.

---

## Assumption summary

| ID | Assumption | Impact if wrong |
|---|---|---|
| `ASM-001` | The matrix describes this product | {High} |
| `ASM-004` | MVP is desktop and web only | {High} |
| `ASM-018` | Organizations own monitoring lawfulness | {High} |
| `ASM-019` | Employee transparency is acceptable to customers | {High} |
| `ASM-024` | Nothing here is stakeholder-reviewed | {High} |
| `ASM-002` | Per-seat pricing | {Medium} |
| `ASM-005` | SMB target segment | {Medium} |
| `ASM-006` | Premium ships at launch | {Medium} |
| `ASM-007` | Contractors are Employees | {Medium} |
| `ASM-009` | Flat manager scope, no delegation | {Medium} |
| `ASM-010` | Single-level approval | {Medium} |
| `ASM-013` | Single-region deployment | {Medium} |
| `ASM-014` | Scale figures are the right magnitude | {Medium} |
| `ASM-015` | 99.5% availability is acceptable | {Medium} |
| `ASM-016` | Retention deletion is unconditional | {Medium} |
| `ASM-020` | Moderate capture defaults | {Medium} |
| `ASM-022` | Schema work is a design input | {Medium} |
| `ASM-023` | The 51-table design is sound | {Medium} |
| `ASM-003` | Self-serve full-entitlement trial | {Low} |
| `ASM-008` | Finance is an Administrator | {Low} |
| `ASM-011` | All tracked people are Members | {Low} |
| `ASM-012` | English-only at MVP | {Low} |
| `ASM-017` | Off-host backups suffice | {Low} |
| `ASM-021` | Five-minute idle default | {Low} |
