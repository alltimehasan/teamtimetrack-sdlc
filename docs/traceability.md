# Requirements Traceability

Traceability answers two questions that a requirements document must be able to answer at any time:

> **Forward:** what did this piece of source material become?
> **Backward:** why does this requirement exist, and who decided it?

The chain used throughout:

```text
SOURCE            Features_Per_Plan.pdf  ·  resources-1..14.md  ·  no source
   ↓
PRODUCT GOAL      G-01 … G-06
   ↓
FEATURE           the capability being delivered
   ↓
REQUIREMENT       REQ-* and the rules BR-* it depends on
   ↓
VERIFICATION      acceptance criteria, and the launch gate SC-* that tests it
```

A requirement with no traceable source is **not a defect** — it is a product decision made in this documentation, and it is marked `{Proposed}` so it can be reviewed as one. §5 lists all of them.

---

## 1. Feature matrix → requirements

Every row of `Features_Per_Plan.pdf`, and what it became. This is the forward-traceability record for all `{Confirmed}` requirements.

### Team Insights

| Matrix feature | Plans | Goal | Requirements | Verified by |
|---|---|---|---|---|
| Screenshots | B·S·P | `G-01` `G-04` | [`REQ-MON-001`](#/functional-requirements), [`REQ-MON-002`](#/functional-requirements), [`REQ-REPORT-008`](#/functional-requirements) | `SC-07`, acceptance criteria on each |
| Projects and tasks report | B·S·P | `G-02` | [`REQ-PROJ-001`](#/functional-requirements)–[`REQ-PROJ-004`](#/functional-requirements), [`REQ-REPORT-004`](#/functional-requirements) | Report reconciliation criteria |
| Hours tracked | B·S·P | `G-01` | [`REQ-TIME-007`](#/functional-requirements), [`REQ-REPORT-002`](#/functional-requirements) | `SC-02` |
| Timeline report | B·S·P | `G-02` | [`REQ-REPORT-003`](#/functional-requirements) | Layer and gap-state criteria |
| Groups / teams | B·S·P | `G-02` | [`REQ-TEAM-001`](#/functional-requirements)–[`REQ-TEAM-004`](#/functional-requirements) | Scope criteria |
| Activity summary | S·P | `G-02` | [`REQ-MON-003`](#/functional-requirements), [`REQ-REPORT-007`](#/functional-requirements) | `SC-05` for the entitlement gate |
| Inactivity alerts | S·P | `G-02` `G-04` | [`REQ-MON-007`](#/functional-requirements) | Alert-boundary criteria |
| Web and app usage | S·P | `G-02` | [`REQ-MON-004`](#/functional-requirements), [`REQ-MON-005`](#/functional-requirements) | `BR-MON-004` domain-only criteria |
| Configurable productivity ratings | S·P | `G-02` | [`REQ-MON-008`](#/functional-requirements) | Classification criteria |

### Management Insights

| Matrix feature | Plans | Goal | Requirements | Verified by |
|---|---|---|---|---|
| Attendance | S·P | `G-02` | [`REQ-ATT-001`](#/functional-requirements)–[`REQ-ATT-003`](#/functional-requirements), [`REQ-REPORT-006`](#/functional-requirements) | Derivation idempotence criteria |
| Break tracking | S·P | `G-01` `G-04` | [`REQ-ATT-004`](#/functional-requirements), [`REQ-ATT-005`](#/functional-requirements) | Break-without-session criterion |
| Leave tracking | S·P | `G-02` | [`REQ-LEAVE-001`](#/functional-requirements)–[`REQ-LEAVE-006`](#/functional-requirements) | `BR-ATT-004` never-absent criterion |
| Payroll | S·P | `G-03` | [`REQ-PAY-001`](#/functional-requirements)–[`REQ-PAY-008`](#/functional-requirements) | `SC-04` |
| Schedules | S·P | `G-02` | [`REQ-SCHED-001`](#/functional-requirements)–[`REQ-SCHED-005`](#/functional-requirements) | Overnight and DST criteria |
| Work-life balance metrics | S·P | — | [`REQ-REPORT-014`](#/functional-requirements) **blocked** | **None — see `GAP-01`, [`OQ-004`](#/open-questions)** |
| Time approvals | S·P | `G-02` `G-03` | [`REQ-TS-001`](#/functional-requirements)–[`REQ-TS-008`](#/functional-requirements) | `SC-09` |
| Meeting insights | Future | — | Out of scope | — |

### Advanced Reporting

| Matrix feature | Plans | Goal | Requirements | Verified by |
|---|---|---|---|---|
| Software cost insights | Future | — | Out of scope | — |
| Benchmarks AI | Future | — | Out of scope | — |
| Office vs. Remote report | P | `G-02` | [`REQ-REPORT-011`](#/functional-requirements) | `BR-REPORT-002` derived-not-stored criterion |
| Unusual activity report | Future | — | Out of scope | — |
| Internet connectivity | P | `G-01` | [`REQ-REPORT-012`](#/functional-requirements) | Metadata-only criterion |
| Open API access | Future | — | Out of scope — **granted by no plan**, `BR-BILL-005` | — |
| Video screen recording | P | `G-01` `G-04` | [`REQ-REC-001`](#/functional-requirements)–[`REQ-REC-004`](#/functional-requirements) | Segment-loss criterion |

### Company Insights

| Matrix feature | Plans | Goal | Requirements | Verified by |
|---|---|---|---|---|
| Executive dashboard and reporting | P | — | [`REQ-REPORT-013`](#/functional-requirements) **blocked** | **None — see `GAP-03`, [`OQ-005`](#/open-questions)** |

### Platform Features

| Matrix feature | Plans | Goal | Requirements | Verified by |
|---|---|---|---|---|
| Windows, Mac, Linux, Chrome and mobile apps | B·S·P | `G-01` | [`NFR-COMPAT-002`](#/non-functional-requirements) — **partial**, desktop and web only | **Conflict — `CONF-04`, [`OQ-002`](#/open-questions)** |
| Online / offline tracking | B·S·P | `G-01` | [`REQ-SYNC-001`](#/functional-requirements)–[`REQ-SYNC-007`](#/functional-requirements), [`NFR-REL-002`](#/non-functional-requirements) | `SC-02`, `SC-03` |
| User controlled or automatic tracking | B·S·P | `G-01` | [`REQ-TIME-001`](#/functional-requirements)–[`REQ-TIME-003`](#/functional-requirements) controlled; [`REQ-TIME-004`](#/functional-requirements) automatic | Automatic behaviour is `{Proposed}` — `GAP-04` |
| Individual and team dashboards | B·S·P | `G-02` | [`REQ-REPORT-009`](#/functional-requirements) | Per-audience content criteria |
| Real-time notifications | S·P | `G-02` | [`REQ-NOTIF-004`](#/functional-requirements) | Degradation criterion |
| 60+ integrations via Chrome and Firefox | Future | — | Out of scope | — |
| Client login access | Future | — | Out of scope — granted by no plan | — |
| Single Sign-On | Future | — | Out of scope — granted by no plan | — |
| Automatic user provisioning | Future | — | Out of scope — granted by no plan. MVP provisioning is invitation-based, [`REQ-USER-002`](#/functional-requirements) | — |
| BigQuery access | Future | — | Out of scope | — |
| HRIS integration | Future | — | Out of scope | — |
| Historical tracking data (3 / 6 / 24 months) | B·S·P | `G-04` | [`REQ-DATA-001`](#/functional-requirements)–[`REQ-DATA-003`](#/functional-requirements) | `SC-06` |

### Support

| Matrix feature | Plans | Requirements |
|---|---|---|
| Ticket portal, Knowledge base, Live chat, **Email**, Callback, Dedicated account manager | All marked future release | Out of scope — but see `CONF-12` and [`OQ-003`](#/open-questions); a product with no support channel at launch is almost certainly a document defect |

---

## 2. Product goal → requirements

Backward traceability from each product goal in [Product Vision](#/product-vision) §7.

### G-01 — Capture time accurately and losslessly, including offline

| Requirements | Rules | Launch gate |
|---|---|---|
| [`REQ-TIME-001`](#/functional-requirements)–[`REQ-TIME-007`](#/functional-requirements), [`REQ-SYNC-001`](#/functional-requirements)–[`REQ-SYNC-007`](#/functional-requirements), [`REQ-DEV-004`](#/functional-requirements), [`REQ-DEV-005`](#/functional-requirements), [`REQ-DEV-006`](#/functional-requirements) | `BR-TIME-001`, `BR-TIME-004`, `BR-TIME-008`, `BR-SYNC-001`–`BR-SYNC-005` | `SC-02`, `SC-03`, `SC-11` |

### G-02 — Make a manager's review of a week take minutes

| Requirements | Rules | Launch gate |
|---|---|---|
| [`REQ-REPORT-003`](#/functional-requirements), [`REQ-REPORT-009`](#/functional-requirements), [`REQ-TS-008`](#/functional-requirements), [`REQ-ATT-006`](#/functional-requirements), [`REQ-MON-006`](#/functional-requirements) | `BR-REPORT-001`, `BR-REPORT-003` | `SC-12`, [`NFR-PERF-002`](#/non-functional-requirements) |

### G-03 — Produce payroll figures that survive a dispute

| Requirements | Rules | Launch gate |
|---|---|---|
| [`REQ-TS-003`](#/functional-requirements)–[`REQ-TS-006`](#/functional-requirements), [`REQ-PAY-002`](#/functional-requirements)–[`REQ-PAY-008`](#/functional-requirements), [`REQ-AUDIT-001`](#/functional-requirements)–[`REQ-AUDIT-004`](#/functional-requirements) | `BR-PAY-001`–`BR-PAY-008`, `BR-TS-003`–`BR-TS-007`, `BR-AUDIT-001` | `SC-04`, `SC-08`, `SC-09`, `SC-13` |

### G-04 — Keep monitoring proportionate and visible to the monitored

| Requirements | Rules | Launch gate |
|---|---|---|
| [`REQ-MON-009`](#/functional-requirements)–[`REQ-MON-011`](#/functional-requirements), [`REQ-ORG-007`](#/functional-requirements), [`REQ-DATA-001`](#/functional-requirements)–[`REQ-DATA-005`](#/functional-requirements), [`REQ-ADMIN-005`](#/functional-requirements) | `BR-MON-001`–`BR-MON-009`, `BR-DATA-001`–`BR-DATA-005`, `BR-ADMIN-001` | `SC-06`, `SC-07` |

### G-05 — Make organization data isolation absolute

| Requirements | Rules | Launch gate |
|---|---|---|
| [`REQ-USER-001`](#/functional-requirements), [`REQ-PROJ-005`](#/functional-requirements), [`REQ-RBAC-004`](#/functional-requirements), [`REQ-ORG-006`](#/functional-requirements) | `BR-ORG-001`–`BR-ORG-003`, `BR-RBAC-004`, `BR-RBAC-005` | `SC-01`, [`NFR-SEC-001`](#/non-functional-requirements) |

### G-06 — Support commercial packaging without code change

| Requirements | Rules | Launch gate |
|---|---|---|
| [`REQ-BILL-001`](#/functional-requirements)–[`REQ-BILL-003`](#/functional-requirements), [`REQ-ADMIN-006`](#/functional-requirements) | `BR-BILL-001`–`BR-BILL-005` | `SC-05`, [`NFR-MAINT-009`](#/non-functional-requirements) |

---

## 3. Journey → requirements

| Journey | Requirements |
|---|---|
| `JRN-01` Organization registration | `REQ-AUTH-001`, `REQ-AUTH-002`, `REQ-ORG-001`, `REQ-USER-001`, `REQ-RBAC-002` |
| `JRN-02` Plan selection and trial | `REQ-BILL-001`, `REQ-BILL-002`, `REQ-BILL-004`, `REQ-BILL-005`, `REQ-BILL-007`, `REQ-DATA-002` |
| `JRN-03` Organization configuration | `REQ-ORG-002`–`REQ-ORG-005`, `REQ-ORG-007`, `REQ-DATA-001`, `REQ-AUDIT-001` |
| `JRN-04` Member invitation | `REQ-USER-002`, `REQ-USER-003`, `REQ-BILL-006`, `REQ-NOTIF-002` |
| `JRN-05` Member onboarding | `REQ-USER-004`, `REQ-AUTH-006`, `REQ-DEV-001`, `REQ-MON-009` |
| `JRN-06` Project and task setup | `REQ-PROJ-001`–`REQ-PROJ-005` |
| `JRN-07` Tracking a session | `REQ-TIME-001`–`REQ-TIME-007`, `REQ-MON-001`–`REQ-MON-005`, `REQ-DEV-004` |
| `JRN-08` Offline and resync | `REQ-SYNC-001`–`REQ-SYNC-006`, `REQ-DEV-005` |
| `JRN-09` Correcting time | `REQ-TIME-008`–`REQ-TIME-011`, `REQ-AUDIT-001` |
| `JRN-10` Leave request and approval | `REQ-LEAVE-001`–`REQ-LEAVE-006`, `REQ-NOTIF-001` |
| `JRN-11` Schedule configuration | `REQ-SCHED-001`–`REQ-SCHED-006` |
| `JRN-12` Reviewing team activity | `REQ-REPORT-001`, `REQ-REPORT-005`, `REQ-REPORT-009`, `REQ-ATT-006` |
| `JRN-13` Investigating an anomaly | `REQ-REPORT-003`, `REQ-MON-006`, `REQ-TIME-009` |
| `JRN-14` Timesheet submission and approval | `REQ-TS-001`–`REQ-TS-008` |
| `JRN-15` Payroll preparation | `REQ-PAY-001`–`REQ-PAY-008` |
| `JRN-16` Subscription management | `REQ-BILL-005`–`REQ-BILL-009` |
| `JRN-17` Monitoring and retention configuration | `REQ-ORG-007`, `REQ-MON-009`, `REQ-DATA-001`–`REQ-DATA-003` |
| `JRN-18` Reviewing your own record | `REQ-MON-010`, `REQ-MON-011`, `REQ-DATA-005` |

**Coverage check:** every `{P0}` requirement appears in at least one journey, except the cross-cutting infrastructure requirements (`REQ-AUDIT-*`, `REQ-BILL-002`, `REQ-BILL-003`, `REQ-SYNC-007`, `REQ-ADMIN-*`), which are exercised by every journey rather than belonging to one.

---

## 4. Research file → what it produced

Backward traceability from each source document. Where a source produced design-phase material rather than requirements, that is stated.

| Source | Produced |
|---|---|
| `Features_Per_Plan.pdf` | All `{Confirmed}` requirements; the plan composition in [Scope](#/scope) §4; retention entitlements; `BR-BILL-005`; `BR-DATA-001` |
| `resources-1.md` | The MVP definition; module decomposition; role model; `REQ-AUTH-*`, `REQ-ORG-*`, `REQ-USER-*` foundations; the audit-logging recommendation → `AUDIT` module; the "build the engine, gate commercially" principle → [Scope](#/scope) §1; the Platform Administrator role → `ADMIN` module |
| `resources-2.md` | System Design input: architecture, multi-tenancy strategy, queue architecture, deployment, monitoring, backup. Produced `NFR-SEC-004`, `NFR-SEC-005`, `NFR-PERF-004`, `NFR-MAINT-004`, `NFR-MAINT-008`, `NFR-REL-003`; the tracking-events-not-start-stop decision → `BR-TIME-001`; the idempotency requirement → `REQ-SYNC-003` |
| `resources-3.md` | The membership model → `BR-ORG-002`; `client_event_id` idempotency → `BR-SYNC-001`; the events → sessions → entries → timesheets → payroll chain → `BR-PAY-001`; the URL sensitivity warning → `BR-MON-004`; office/remote derivation → `BR-REPORT-002`; the `sync_batches` proposal → `REQ-SYNC-005` |
| `resources-4.md` | Confirmation of the membership model. No independent requirement |
| `resources-5.md` | Process guidance on ERD construction. No requirement |
| `resources-6.md` | Database Design input. Produced the "reports are queries, not entities" position → [Product Modules](#/product-modules) `REPORT`; the deferral of aggregate tables → `NFR-SCALE-003`, `RISK-013` |
| `resources-7.md` | Database Design input. No independent requirement beyond `resources-6` |
| `resources-8.md` | `NFR-REL-006` integer seconds and fixed-precision money; `BR-PAY-007`, `BR-PAY-008`; `BR-ORG-005` UTC storage; `NFR-SCALE-005` tenant-leading indexes; `BR-USER-003` restrictive deletes |
| `resources-9.md` | Database Design input. Produced `ASM-021` (the five-minute idle default, the only concrete capture number in any source); `CONF-14` system-role uniqueness defect |
| `resources-10.md` | `BR-MON-003` media outside the database; `BR-DATA-004` deletion ordering; `NFR-SCALE-003` partition readiness; `RISK-013` |
| `resources-11.md` | `BR-SCHED-001` overnight shifts; `BR-SCHED-005` DST; `BR-TIME-006` idle ≠ break; `BR-ATT-004` leave never absent; `BR-LEAVE-003` decider is a Membership; `BR-ATT-002` attendance is derived; `CONF-05`, `CONF-06` |
| `resources-12.md` | `BR-PAY-001` payroll from approved time only; `BR-TS-004` snapshots; `BR-TS-005` no self-approval; `BR-TS-007` append-only history; `BR-PAY-002` effective-dated rates; `BR-PAY-006` adjustments; `CONF-08`, `GAP-20` |
| `resources-13.md` | `BR-BILL-001` permission ≠ entitlement; `BR-BILL-002` single resolution path; `BR-BILL-003` API authority; `BR-BILL-006` one active subscription; `CONF-03` the incorrect Premium seed |
| `resources-14.md` | `BR-AUDIT-001` append-only; `BR-AUDIT-003` system actor; `BR-DATA-002` policy ≤ entitlement; `BR-REPORT-002`; the ten architectural rules → distributed across [Business Rules](#/business-rules) |

---

## 5. Requirements with no source

The `{Proposed}` set — **49 requirements** (21 functional, 28 non-functional) made in this documentation with no supporting evidence in `resources/`. These are the ones most in need of stakeholder review, because nobody with authority has agreed to them. The table groups them; ranges such as `NFR-PERF-001`–`NFR-PERF-003` cover several requirements per row.

| Requirement | What it proposes | Why | Review priority |
|---|---|---|---|
| [`REQ-MON-009`](#/functional-requirements) | Monitoring disclosure before first capture, with recorded acknowledgement | `GAP-07` — no source addresses employee transparency | **Highest** |
| [`REQ-MON-010`](#/functional-requirements) | Member can view every category captured about them | `GAP-07` | **Highest** |
| [`REQ-MON-011`](#/functional-requirements) | Evidence deletion requests with audited decision | `GAP-17` | High |
| [`REQ-MON-006`](#/functional-requirements) | Evidence gaps classified into four distinct states | Prevents silent absence being read as absence of work | High |
| [`REQ-ADMIN-005`](#/functional-requirements) | Audited, time-bounded vendor support elevation | `GAP-15` — no source addresses vendor access | **Highest** |
| [`REQ-TIME-004`](#/functional-requirements) | Automatic tracking bounded by schedule and opt-in | `GAP-04` — behaviour undefined in source | **Highest** |
| [`REQ-TIME-008`](#/functional-requirements) | Manual entry requires a reason and an actor | `GAP-06` — governance undefined | High |
| [`REQ-TIME-011`](#/functional-requirements) | Correction window | `GAP-06` | Medium |
| [`REQ-MON-007`](#/functional-requirements) | Inactivity alerts notify the Member as well as the Manager | `GAP-02` — thresholds and recipients undefined | High |
| [`REQ-SCHED-006`](#/functional-requirements) | Holiday calendar | `GAP-13` — `holiday` status unreachable without it | Medium |
| [`REQ-DEV-006`](#/functional-requirements) | Capture permission degradation is reported, not silent | Prevents the tracker appearing to capture when it is not | High |
| [`REQ-SYNC-006`](#/functional-requirements) | Sync backlog visible to Member and Organization | Makes silent time loss impossible | High |
| [`REQ-BILL-006`](#/functional-requirements) | Seat counting and limit enforcement | `GAP-09` | Medium |
| [`REQ-BILL-009`](#/functional-requirements) | Downgrade guardrails and consequence statement | Prevents surprise data deletion | Medium |
| [`REQ-DATA-004`](#/functional-requirements) | Organization data export | `GAP-08` | Medium |
| [`REQ-DATA-005`](#/functional-requirements) | Member data export and erasure request | `GAP-08` | High |
| [`REQ-TS-002`](#/functional-requirements) partial, [`REQ-TS-007`](#/functional-requirements) | Timesheet periodicity constraint; submission escalation | `CONF-08` double-payment risk | High |
| [`REQ-AUTH-010`](#/functional-requirements) | Session and device inventory | Standard security hygiene, absent from source | Low |
| [`REQ-RBAC-006`](#/functional-requirements) | Custom roles | Anticipated in source as future | Low |
| [`NFR-USE-001`](#/non-functional-requirements) | WCAG 2.1 AA | `GAP-16` | Medium |
| [`NFR-USE-002`](#/non-functional-requirements)–[`NFR-USE-005`](#/non-functional-requirements) | Tracker legibility, destructive-action confirmation, error messages, time presentation | Absent from source | Medium |
| [`NFR-PERF-001`](#/non-functional-requirements)–[`NFR-PERF-003`](#/non-functional-requirements), [`NFR-PERF-005`](#/non-functional-requirements)–[`NFR-PERF-007`](#/non-functional-requirements) | All performance targets | No source contains any figure | **High** — [`OQ-008`](#/open-questions) |
| [`NFR-SCALE-001`](#/non-functional-requirements), [`NFR-SCALE-002`](#/non-functional-requirements) | Concurrency and volume targets | No source contains any figure | **High** — [`OQ-008`](#/open-questions) |
| [`NFR-REL-001`](#/non-functional-requirements), [`NFR-REL-004`](#/non-functional-requirements) | Availability, RPO, RTO | `GAP-12`, `GAP-18` | **High** |
| [`NFR-PRIV-001`](#/non-functional-requirements)–[`NFR-PRIV-004`](#/non-functional-requirements), [`NFR-PRIV-006`](#/non-functional-requirements), [`NFR-PRIV-007`](#/non-functional-requirements), [`NFR-PRIV-009`](#/non-functional-requirements) | The whole privacy control set | No source addresses privacy | **Highest** |
| [`NFR-SEC-011`](#/non-functional-requirements), [`NFR-SEC-012`](#/non-functional-requirements) | Security review, code signing | Absent from source | High |

:::warning Where the proposals cluster
Fourteen of the twenty-seven proposed requirements concern **privacy, transparency and vendor access** — the areas a sales-oriented feature matrix never covers and a database-design conversation never reaches. That clustering is the clearest signal of what the source material was and was not for.
:::

---

## 6. Conflict and gap → resolution

Forward traceability from every problem found in [Source & Research Audit](#/source-audit).

| ID | Problem | Resolved by | Status |
|---|---|---|---|
| `CONF-01` | Product name | [`OQ-001`](#/open-questions) | Decision required |
| `CONF-02` | Tenant attachment of users | `BR-ORG-002` | Resolved |
| `CONF-03` | Unreleased features seeded as Premium | `BR-BILL-005` | Resolved |
| `CONF-04` | Platform coverage | [`NFR-COMPAT-002`](#/non-functional-requirements), [`OQ-002`](#/open-questions) | Decision required |
| `CONF-05` | Attendance vocabulary | `BR-ATT-003` | Resolved |
| `CONF-06` | Break requires a session | `BR-ATT-006`, [`REQ-ATT-004`](#/functional-requirements) | Resolved |
| `CONF-07` | Recording format | [`NFR-COMPAT-005`](#/non-functional-requirements) | Deferred to design |
| `CONF-08` | Timesheet periodicity | `BR-TS-002`, `BR-TS-003` | Resolved |
| `CONF-09` | Leave balances | [`OQ-011`](#/open-questions) | Decision required |
| `CONF-10` | Overtime in payroll | [`REQ-PAY-001`](#/functional-requirements) | Resolved by exclusion |
| `CONF-11` | Sync ledger dropped | [`REQ-SYNC-005`](#/functional-requirements) | Restored |
| `CONF-12` | No launch support channel | [`OQ-003`](#/open-questions) | Decision required |
| `CONF-13` | Retention entitlement vs policy | `BR-DATA-002` | Resolved in source |
| `CONF-14` | System role uniqueness | Design input | Flagged to design |
| `CONF-15` | Imprecise matrix claims | [Source & Research Audit](#/source-audit) §3 | Corrected |
| `GAP-01` | Work-life balance undefined | [`REQ-REPORT-014`](#/functional-requirements) **blocked**, [`OQ-004`](#/open-questions) | **Unresolved** |
| `GAP-02` | Inactivity alerts undefined | [`REQ-MON-007`](#/functional-requirements) `{Proposed}` | Proposed |
| `GAP-03` | Executive dashboard undefined | [`REQ-REPORT-013`](#/functional-requirements) **blocked**, [`OQ-005`](#/open-questions) | **Unresolved** |
| `GAP-04` | Automatic tracking undefined | [`REQ-TIME-004`](#/functional-requirements) `{Proposed}`, [`OQ-006`](#/open-questions) | Proposed |
| `GAP-05` | Real-time transport | [`REQ-NOTIF-004`](#/functional-requirements) | Deferred to design |
| `GAP-06` | Manual entry governance | [`REQ-TIME-008`](#/functional-requirements), `BR-TIME-005` | Proposed |
| `GAP-07` | Employee transparency | [`REQ-MON-009`](#/functional-requirements), [`REQ-MON-010`](#/functional-requirements), `BR-MON-009` | Proposed |
| `GAP-08` | Subject access and erasure | [`REQ-DATA-004`](#/functional-requirements), [`REQ-DATA-005`](#/functional-requirements), [`OQ-014`](#/open-questions) | Proposed |
| `GAP-09` | Seat limits | [`REQ-BILL-006`](#/functional-requirements) | Proposed |
| `GAP-10` | Pricing | [`OQ-007`](#/open-questions) | Decision required |
| `GAP-11` | Localisation | [`NFR-USE-006`](#/non-functional-requirements), `ASM-012` | Assumed |
| `GAP-12` | Availability target | [`NFR-REL-001`](#/non-functional-requirements), [`OQ-008`](#/open-questions) | Proposed |
| `GAP-13` | Holiday calendar | [`REQ-SCHED-006`](#/functional-requirements) | Proposed |
| `GAP-14` | Rounding rules | `BR-PAY-004`, [`OQ-012`](#/open-questions) | Decision required |
| `GAP-15` | Platform Administrator | `ADMIN` module, [`REQ-ADMIN-005`](#/functional-requirements) | Proposed |
| `GAP-16` | Accessibility | [`NFR-USE-001`](#/non-functional-requirements) | Proposed |
| `GAP-17` | Screenshot redaction | [`OQ-015`](#/open-questions) | Deferred |
| `GAP-18` | RPO / RTO | [`NFR-REL-004`](#/non-functional-requirements) | Proposed |
| `GAP-19` | Providers unselected | [`OQ-009`](#/open-questions), [`OQ-010`](#/open-questions) | Decision required |
| `GAP-20` | Payroll adjustment detail | `BR-PAY-006` | Accepted limitation |

---

## 7. Risk → mitigating requirements

| Risk | Mitigated by |
|---|---|
| `RISK-001` Tracker unknowns | [`REQ-DEV-006`](#/functional-requirements), milestone `M-03`, `M-05` |
| `RISK-002` Platform promises | [`NFR-COMPAT-002`](#/non-functional-requirements), [`OQ-002`](#/open-questions) |
| `RISK-003` Unspecifiable features | [`OQ-004`](#/open-questions), [`OQ-005`](#/open-questions) |
| `RISK-004` Premium last | Scope §2 priority assignment, [`OQ-013`](#/open-questions) |
| `RISK-005` Legal review | [Security & Privacy](#/security-privacy) §6, [`OQ-014`](#/open-questions) |
| `RISK-006` Scope size | Descope order in [Scope](#/scope) §2, release plan |
| `RISK-007` Tenant isolation | `BR-ORG-001`, [`NFR-SEC-001`](#/non-functional-requirements), `SC-01` |
| `RISK-008` No billing provider | [`REQ-BILL-008`](#/functional-requirements), [`OQ-009`](#/open-questions) |
| `RISK-009` Code signing | [`NFR-SEC-012`](#/non-functional-requirements) |
| `RISK-010` Single VPS | [`NFR-REL-001`](#/non-functional-requirements), [`NFR-REL-002`](#/non-functional-requirements), [`NFR-REL-004`](#/non-functional-requirements) |
| `RISK-011` Vendor access | [`REQ-ADMIN-005`](#/functional-requirements), `BR-ADMIN-001`, `BR-ADMIN-002` |
| `RISK-012` Sync correctness | [`REQ-SYNC-003`](#/functional-requirements), `BR-SYNC-002`, `SC-03` |
| `RISK-013` Report performance | [`NFR-PERF-002`](#/non-functional-requirements), [`NFR-SCALE-003`](#/non-functional-requirements), [`NFR-SCALE-005`](#/non-functional-requirements) |
| `RISK-014` Timezone defects | `BR-SCHED-001`, `BR-SCHED-005`, [`NFR-COMPAT-007`](#/non-functional-requirements) |
| `RISK-015` Trust failure | `BR-MON-008`, `BR-MON-009`, [`REQ-MON-009`](#/functional-requirements)–[`REQ-MON-011`](#/functional-requirements) |
| `RISK-016` Retention stops | [`REQ-ADMIN-004`](#/functional-requirements), [`NFR-MAINT-005`](#/non-functional-requirements), `SC-06` |
| `RISK-017` Basic churn | [`OQ-017`](#/open-questions) |
| `RISK-018` Storage cost | [`NFR-SCALE-006`](#/non-functional-requirements), `BR-MON-002`, `BR-DATA-001` |
| `RISK-019` Tracker friction | [`REQ-TIME-006`](#/functional-requirements), [`REQ-DEV-004`](#/functional-requirements), [`NFR-PERF-005`](#/non-functional-requirements) |
| `RISK-020` Rubber-stamping | [`REQ-TS-008`](#/functional-requirements), [`REQ-REPORT-003`](#/functional-requirements), `SC-12` |
| `RISK-021` Derivation hot path | [`NFR-PERF-004`](#/non-functional-requirements), [`NFR-REL-005`](#/non-functional-requirements) |
| `RISK-022` No support channel | [`OQ-003`](#/open-questions) |
| `RISK-023` Storage provider | `BR-MON-003`, [`NFR-REL-008`](#/non-functional-requirements) |
| `RISK-024` Email deliverability | [`REQ-USER-002`](#/functional-requirements) A2, [`NFR-MAINT-004`](#/non-functional-requirements) |

---

## 8. Traceability health

| Check | Result |
|---|---|
| Matrix features traced to a requirement or an explicit exclusion | **43 / 43** |
| Matrix features that cannot be specified | **2** — `work_life_balance`, `executive_dashboard` |
| Requirements with at least one acceptance criterion | **159 / 161** — the two exceptions are the blocked ones above |
| Requirements traceable to a source or marked `{Proposed}` | **161 / 161** |
| Product goals with mapped requirements | **6 / 6** |
| Journeys with mapped requirements | **18 / 18** |
| Modules with at least one requirement | **22 / 22** |
| `{P0}` requirements appearing in a journey or identified as cross-cutting | **113 / 113** |
| Requirement identifiers referenced but never defined | **0** — verified across all 19 documents |
| Duplicate or skipped requirement numbers | **none** |
| Conflicts with a recorded resolution or open question | **15 / 15** |
| Gaps with a recorded handling | **20 / 20** |
| Risks with at least one mitigating requirement or open question | **24 / 24** |
| Business rules referenced by at least one requirement | **all** |

### Known traceability weaknesses

1. **Two features have no requirement.** `REQ-REPORT-013` and `REQ-REPORT-014` are commercially committed and unspecifiable. This is recorded rather than papered over.
2. **The `{Proposed}` set has no stakeholder authority behind it.** 49 requirements — 21 functional and 28 non-functional — trace to this documentation's judgement rather than to a decision. `ASM-024`.
3. **No requirement traces to user research**, because none exists. Personas are constructed. [`OQ-020`](#/open-questions).
4. **No requirement traces to competitive evidence**, because none exists. [`OQ-016`](#/open-questions).
5. **Verification is specified, not performed.** Acceptance criteria are written to be testable; no test exists yet.
