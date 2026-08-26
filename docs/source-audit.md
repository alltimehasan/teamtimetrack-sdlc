# Source & Research Audit

This document records what the source material in `resources/` actually establishes, where it disagrees with itself, and where it is silent. It is the evidence layer beneath every other document in this set.

**Nothing in `resources/` has been modified.** All extraction was read-only.

---

## 1. Source inventory

| File | Subject | Phase it belongs to | Assessment |
|---|---|---|---|
| `Features_Per_Plan.pdf` | Commercial feature matrix: 43 feature rows across Team Insights, Management Insights, Advanced Reporting, Company Insights, Platform Features and Support; plan availability; data-retention periods | Requirements | **Primary source.** Authoritative for *what must be sold*. Silent on price, seats, behaviour and acceptance criteria |
| `resources-1.md` | Product planning baseline: vision, tenancy model, roles, SaaS foundation, 38 numbered capability areas, MVP definition, release roadmap | Planning + Requirements | Highest-value narrative source. Largely sound; several claims about the PDF are imprecise (see `CONF-15`) |
| `resources-2.md` | System Design Specification v1.0: architecture, multi-tenancy, Laravel/Next.js/Electron/PostgreSQL/Redis/R2 stack, deployment, monitoring, backup, 11-phase dev roadmap | **System Design** | Ahead of current phase. Treated here as a design *input*, not a requirement |
| `resources-3.md` | Domain model & logical database design; 59 sections; the `users → memberships → organizations` decision | System / Database Design | Ahead of current phase. Contains the tenancy decision that supersedes `resources-2` |
| `resources-4.md` | Confirmation of the membership model as a core architectural decision (13 lines) | System Design | Fragment; adds no new requirement |
| `resources-5.md` | Argument for a single authoritative ERD and how to build it | Database Design | Process note; no requirements |
| `resources-6.md` | Full application ERD in Mermaid, ~45 entities with relationships | Database Design | Ahead of current phase |
| `resources-7.md` | Complete ERD specification, table by table, with crow's-foot cardinalities | Database Design | Ahead of current phase |
| `resources-8.md` | Physical PostgreSQL design: UUIDv7, `TIMESTAMPTZ`, `BIGINT` seconds, `NUMERIC(12,2)` money, FK delete strategy, indexing philosophy | Database Design | Ahead of current phase. Source of several non-functional data-integrity requirements |
| `resources-9.md` | Laravel migration plan, migrations 01–18, dependency order | Database Design | Ahead of current phase |
| `resources-10.md` | Migrations 19–25: monitoring and media layer, R2 key structure, retention workflow | Database Design | Ahead of current phase |
| `resources-11.md` | Migrations 26–32: schedules, shifts, attendance, breaks, leave; overnight-shift handling; idle-vs-break distinction | Database Design | Ahead of current phase. Source of several genuine business rules |
| `resources-12.md` | Migrations 33–40: timesheets, approvals, pay rates, payroll; the "payroll never reads raw tracking" principle | Database Design | Ahead of current phase. Source of the approval→payroll chain rule |
| `resources-13.md` | Migrations 41–44: plans, features, plan features, subscriptions; entitlement vs permission distinction | Database Design | Ahead of current phase. Contains the plan-assignment error `CONF-03` |
| `resources-14.md` | Migrations 45–51: office/remote, connectivity, notifications, audit, retention; final 51-table schema; 10 architectural rules | Database Design | Ahead of current phase |

### What the corpus is, and is not

**It is:** a single continuous design conversation that moved from product planning to a near-complete PostgreSQL schema.

**It is not:** market research, competitor analysis, user research, pricing analysis, or a validated requirements set. There are **no interviews, no usage data, no competitor documentation, and no pricing** anywhere in `resources/`.

:::warning Evidence limit
The brief describes this product as "inspired by Time Doctor". `resources/` contains **no factual material about Time Doctor** other than a feature matrix whose provenance is not stated in the file itself. Consequently this documentation makes **no claims about Time Doctor's actual behaviour, market position, pricing or implementation**. See [Product Analysis](#/product-analysis).
:::

---

## 2. The feature matrix — authoritative transcription

Extracted from `Features_Per_Plan.pdf` using layout-preserving text extraction and cross-checked in table mode. This transcription is authoritative for all `{Confirmed}` badges in this documentation.

:::note Extraction integrity
A naive text extraction of this PDF misaligns feature labels against plan values by one row in the Team Insights and Support sections. Every value below was verified against a second, table-aware extraction pass. If the matrix is ever revised, re-verify — do not trust a single extraction.
:::

### Team Insights

| Feature | Basic | Standard | Premium |
|---|---|---|---|
| Screenshots | YES | YES | YES |
| Projects and tasks report | YES | YES | YES |
| Hours tracked | YES | YES | YES |
| Timeline report | YES | YES | YES |
| Groups / teams | YES | YES | YES |
| Activity summary | NO | YES | YES |
| Inactivity alerts | NO | YES | YES |
| Web and app usage | NO | YES | YES |
| Configurable productivity ratings | NO | YES | YES |

### Management Insights

| Feature | Basic | Standard | Premium |
|---|---|---|---|
| Attendance | NO | YES | YES |
| Break tracking | NO | YES | YES |
| Leave tracking | NO | YES | YES |
| Payroll | NO | YES | YES |
| Schedules | NO | YES | YES |
| Work-life balance metrics | NO | YES | YES |
| Time approvals | NO | YES | YES |
| Meeting insights | — future release — |||

### Advanced Reporting

| Feature | Basic | Standard | Premium |
|---|---|---|---|
| Software cost insights | — future release — |||
| Benchmarks AI | — future release — |||
| Office vs. Remote report | NO | NO | YES |
| Unusual activity report | — future release — |||
| Internet connectivity | NO | NO | YES |
| Open API access | — future release — |||
| Video screen recording | NO | NO | YES |

### Company Insights

| Feature | Basic | Standard | Premium |
|---|---|---|---|
| Executive dashboard and reporting | NO | NO | YES |

### Platform Features

| Feature | Basic | Standard | Premium |
|---|---|---|---|
| Windows, Mac, Linux, Chrome and mobile apps | YES | YES | YES |
| Online / offline tracking | YES | YES | YES |
| User controlled or automatic tracking | YES | YES | YES |
| Individual and team dashboards | YES | YES | YES |
| Real-time notifications | NO | YES | YES |
| 60+ integrations via Chrome and Firefox | — future release — |||
| Client login access | — future release — |||
| Single Sign-On (SSO) | — future release — |||
| Automatic user provisioning | — future release — |||
| BigQuery Access | — future release — |||
| HRIS integration | — future release — |||
| **Historical tracking data** | **3 months** | **6 months** | **2 years** |

### Support

| Feature | Basic | Standard | Premium |
|---|---|---|---|
| Ticket portal | — future release — |||
| Knowledge base | — future release — |||
| Live chat | — future release — |||
| Email | — future release — |||
| Callback | — future release — |||
| Dedicated account manager (50+ users) | — future release — |||

### What the matrix does **not** say

- No prices, currencies or billing intervals
- No seat counts, seat limits or per-seat behaviour
- No trial terms
- No screenshot frequency, activity sampling rate or idle threshold
- No behaviour, acceptance criteria, error handling or permissions
- No definition of "work-life balance metrics", "executive dashboard", "inactivity alerts" or "automatic tracking"
- No data-processing, consent or employee-transparency commitments

Everything in the list above had to be either derived, proposed, or raised as an open question.

---

## 3. Conflicts found

Each conflict is stated, sourced, and given a recommended resolution. Conflicts marked `{Decision Required}` are also carried into [Open Questions](#/open-questions).

### CONF-01 — Product name {High}

| | |
|---|---|
| **Conflict** | The commissioning brief names the product *"Time Time Track"*. All 14 research files and the repository directory (`teamtimetrack-sdlc`) name it **"Team Time Track"** |
| **Impact** | Naming appears in the UI, desktop application, domains, email templates, contracts and the trademark position |
| **Recommendation** | Adopt **Team Time Track**: 15 of 16 sources agree, and it is semantically meaningful (teams + time tracking) where "Time Time" reads as a typographic error |
| **Status** | `{Decision Required}` → [`OQ-001`](#/open-questions) |

### CONF-02 — Tenant attachment of users {High}

| | |
|---|---|
| **Conflict** | `resources-2.md` §2 illustrates multi-tenancy with `users.organization_id`, placing the user directly inside one organization. `resources-3.md` §2 explicitly rejects this and introduces `users → organization_memberships → organizations`; `resources-4/6/7/8/9/14` all reaffirm the membership model |
| **Impact** | Foundational. Determines whether one person can work for two organizations, whether roles are per-organization, and whether the desktop tracker can switch organizations |
| **Recommendation** | Adopt the **membership model**. It is the later decision, is reaffirmed six times, and is required by the desktop tracker's organization-switching behaviour. `resources-2.md` §2 should be read as a simplified illustration, not a decision |
| **Status** | `{Resolved}` — recorded as [`BR-ORG-002`](#/business-rules) |

### CONF-03 — Plan assignment of unreleased enterprise features {High}

| | |
|---|---|
| **Conflict** | `resources-13.md` §46 shows an example Premium seed granting `api_access ✓`, `sso ✓`, `client_access ✓`, `automatic_provisioning ✓`. The PDF marks **Open API access, Single Sign-On, Client login access and Automatic user provisioning all as future release**, with no plan availability |
| **Impact** | Commercial and legal. Seeding these as Premium entitlements would advertise four capabilities that do not exist |
| **Recommendation** | Follow the PDF. These four features are `{Future}`, are not entitlements of any plan at launch, and must not appear in plan comparison UI as included. `resources-13.md` itself warns that the matrix "should be seeded from the product document rather than inferred where the document is silent" — that warning applies to its own example |
| **Status** | `{Resolved}` — see [Scope](#/scope) |

### CONF-04 — Platform coverage promised vs planned {High}

| | |
|---|---|
| **Conflict** | The PDF grants *"Windows, Mac, Linux, Chrome and mobile apps"* to **all three plans including Basic**. `resources-1.md` §12 and §35 prioritise a desktop Electron tracker for MVP and place mobile applications and browser extensions in V1.1/V2 |
| **Impact** | Direct mismatch between what the commercial matrix sells and what MVP delivers. A Basic customer would be entitled to mobile and Chrome apps that do not exist |
| **Recommendation** | Two options, and this is a **commercial decision, not an engineering one**: (a) restrict the launch matrix to the platforms actually shipped and re-issue it, or (b) extend MVP scope to include a mobile and Chrome client, which materially changes cost and schedule. This documentation assumes (a) and scopes MVP as desktop + web |
| **Status** | `{Decision Required}` → [`OQ-002`](#/open-questions) |

### CONF-05 — Attendance status vocabulary {Medium}

| | |
|---|---|
| **Conflict** | `resources-3.md` §19: `present, late, absent, partial, leave, holiday`. `resources-11.md` §32: `present, late, absent, half_day, on_leave, holiday, rest_day` |
| **Impact** | Attendance reporting, payroll eligibility and the leave→attendance interaction all key off these values |
| **Recommendation** | Adopt the `resources-11.md` vocabulary — it is later, distinguishes a scheduled non-working day (`rest_day`) from a public holiday, and names `on_leave` unambiguously |
| **Status** | `{Resolved}` — recorded as [`BR-ATT-003`](#/business-rules) |

### CONF-06 — Break records require a tracking session {Medium}

| | |
|---|---|
| **Conflict** | `resources-11.md` §33 defines `breaks.tracking_session_id` as a non-nullable foreign key, while §34 defines a break as the case where *"the employee explicitly stops working"*. If stopping work ends the tracking session, the break has no session to attach to |
| **Impact** | Break tracking is a Standard/Premium feature `{Confirmed}`. If the model cannot represent a break taken with the tracker stopped, break duration will be under-reported |
| **Recommendation** | Make the session association optional and anchor breaks to the membership and date. A break is a workforce event, not a tracking artefact |
| **Status** | `{Resolved}` — recorded as [`BR-ATT-006`](#/business-rules); flagged to System Design |

### CONF-07 — Recording media format {Low}

| | |
|---|---|
| **Conflict** | `resources-2.md` §9 targets WebM (VP8/VP9, Opus) initially. `resources-10.md` §24 illustrates the R2 key layout with `.mp4` segments |
| **Impact** | Playback compatibility and whether a transcoding stage is needed |
| **Recommendation** | Defer to System Design; the requirement is only that recordings play back in supported browsers without a transcoding cluster at launch |
| **Status** | `{Resolved as a design decision}` — [`NFR-COMPAT-005`](#/non-functional-requirements) |

### CONF-08 — Timesheet periodicity vs uniqueness constraint {Medium}

| | |
|---|---|
| **Conflict** | `resources-1.md` §19 offers employees daily, weekly **and** monthly timesheets. `resources-12.md` §33 places `UNIQUE(organization_id, membership_id, period_start, period_end)` on timesheets, which permits overlapping periods of different lengths — meaning the same time entry could be submitted in a daily *and* a weekly timesheet and counted twice in payroll |
| **Impact** | Double-payment risk. This is a financial correctness defect, not a cosmetic one |
| **Recommendation** | One timesheet periodicity per organization, configured once, with a hard rule that a time entry belongs to at most one timesheet |
| **Status** | `{Resolved}` — recorded as [`BR-TS-002`](#/business-rules) and [`BR-TS-003`](#/business-rules) |

### CONF-09 — Leave balances promised but not modelled {Medium}

| | |
|---|---|
| **Conflict** | `resources-1.md` §23 lists *"Leave balance"* as an MVP leave capability. No entity anywhere in `resources-3/6/7/11/14` stores an entitlement, accrual or balance — only `leave_types` and `leave_requests` |
| **Impact** | Leave tracking is `{Confirmed}` for Standard/Premium. Without balances, the system can record requests but cannot answer "how much leave do I have left?", which is the question employees actually ask |
| **Recommendation** | Either accept request-only leave for MVP and state it plainly, or add accrual to scope. This documentation scopes MVP as **request and approval only, without balances**, and records the omission |
| **Status** | `{Decision Required}` → [`OQ-011`](#/open-questions) |

### CONF-10 — Overtime in payroll scope {Medium}

| | |
|---|---|
| **Conflict** | `resources-1.md` §24 lists *"Overtime rules where applicable"* in MVP payroll. The payroll model in `resources-12.md` §45 has only `approved_seconds`, `hourly_rate`, `gross_amount`, `adjustments`, `net_amount` — no overtime threshold, multiplier or separate overtime hours |
| **Impact** | Overtime is jurisdiction-specific and legally sensitive. Silently omitting it while advertising "Payroll" invites incorrect pay calculations |
| **Recommendation** | Exclude overtime calculation from MVP explicitly, and label the payroll module a **payroll preparation and export** tool rather than a payroll engine |
| **Status** | `{Resolved}` — see [Scope](#/scope); positioning recorded in [`REQ-PAY-001`](#/functional-requirements) |

### CONF-11 — Offline sync batch ledger dropped {Low}

| | |
|---|---|
| **Conflict** | `resources-3.md` §29 proposes a `sync_batches` ledger for batch-level idempotency. It does not appear in the final 51-table schema in `resources-14.md` §58 |
| **Impact** | Event-level idempotency via `client_event_id` survives, so correctness is preserved; batch-level acknowledgement and retry diagnostics are lost |
| **Recommendation** | Restore a batch ledger during System Design. Sync failure rate is called out in `resources-2.md` §18 as a critical monitored metric, and it cannot be diagnosed without batch records |
| **Status** | `{Resolved as a design input}` — [`REQ-SYNC-005`](#/functional-requirements) |

### CONF-12 — Support tiers show no launch support channel {Medium}

| | |
|---|---|
| **Conflict** | Every row of the PDF's Support section — including **Email** — is marked *"This feature will be added in the future release"*. Read literally, a paying customer has no support channel at launch |
| **Impact** | Commercially implausible; almost certainly a defect in the source document rather than a product decision |
| **Recommendation** | Do not silently correct it. Confirm with the document author whether email support is available at launch, and re-issue the matrix |
| **Status** | `{Decision Required}` → [`OQ-003`](#/open-questions) |

### CONF-13 — Entitlement vs organisation retention policy {Low}

| | |
|---|---|
| **Conflict** | `resources-3.md` §41 models retention as an organisation-level policy table; `resources-13.md` §57 models it as a plan entitlement (`retention_months`) |
| **Impact** | Determines whether an organisation can configure its own retention, and whether it could exceed what it bought |
| **Recommendation** | `resources-14.md` §62 already reconciles these: the plan entitlement is the **ceiling**, the organisation policy is the **applied value**, and policy ≤ entitlement always |
| **Status** | `{Resolved in source}` — recorded as [`BR-DATA-002`](#/business-rules) |

### CONF-14 — System role uniqueness {Low}

| | |
|---|---|
| **Conflict** | `resources-9.md` §9 makes `roles.organization_id` nullable for system roles and adds `UNIQUE(organization_id, slug)`. In PostgreSQL, `NULL` values are distinct in a unique index, so this constraint does **not** prevent multiple global roles sharing a slug |
| **Impact** | Duplicate system roles could be created, producing inconsistent authorization |
| **Recommendation** | System Design should use a partial unique index for the global case. Noted here so it is not lost between phases |
| **Status** | `{Resolved as a design input}` |

### CONF-15 — Research claims about the matrix that need correction {Medium}

Several statements in `resources-1.md` describe the matrix loosely. The verified matrix says:

| Research claim | Verified position |
|---|---|
| "Screenshots, projects/tasks reports, hours tracked, timeline reports and groups/teams available across all three plans" (`resources-1.md` §2) | **Correct** |
| "Activity Summary and Inactivity Alerts in Standard/Premium" (§15) | **Correct** |
| "Real-time notifications in Standard/Premium" (§27) | **Correct** |
| "Windows, Mac and Linux alongside Chrome/mobile applications" (§12) | Correct, but the matrix grants them to **all plans**, which §12 does not mention — this is the substance of `CONF-04` |
| "Client Login Access marked as a future feature" (§5) | **Correct** |
| "Office vs Remote, Internet connectivity, Video screen recording, Executive dashboard as Premium" (§32) | **Correct** — all four are `NO / NO / YES` |
| Premium includes API access and SSO (`resources-13.md` §46) | **Incorrect** — both are future release; see `CONF-03` |

---

## 4. Gaps found

Capabilities the matrix sells, or the product plainly needs, which the research does not specify.

| ID | Gap | Sold in | Severity | Handling |
|---|---|---|---|---|
| `GAP-01` | **"Work-life balance metrics"** is never defined anywhere in `resources/` — no metric definition, no data model, no threshold | Standard, Premium `{Confirmed}` | {High} | Cannot be specified. [`OQ-004`](#/open-questions) |
| `GAP-02` | **"Inactivity alerts"** has no alert rule, threshold, recipient or delivery channel defined | Standard, Premium `{Confirmed}` | {High} | Specified as `{Proposed}` in [`REQ-MON-007`](#/functional-requirements); thresholds need confirmation |
| `GAP-03` | **"Executive dashboard and reporting"** has no defined content and no supporting aggregate model | Premium `{Confirmed}` | {High} | Cannot be specified. [`OQ-005`](#/open-questions) |
| `GAP-04` | **"Automatic tracking"** behaviour is never defined — does the tracker start on login, on activity, on schedule? | All plans `{Confirmed}` | {High} | Privacy-critical. Specified as `{Proposed}` in [`REQ-TIME-004`](#/functional-requirements); [`OQ-006`](#/open-questions) |
| `GAP-05` | **Real-time notification transport** is never chosen. Redis is present for queues and cache; no WebSocket/SSE/polling decision | Standard, Premium `{Confirmed}` | {Medium} | Requirement stated behaviourally in [`REQ-NOTIF-004`](#/functional-requirements); transport deferred to System Design |
| `GAP-06` | **Manual time entry governance** — `time_entries.source = manual` and `reason` exist, but no rule states who may add manual time, within what window, or whether it needs approval | Implied by all plans | {High} | Specified in [`REQ-TIME-008`](#/functional-requirements) and [`BR-TIME-005`](#/business-rules) as `{Proposed}` |
| `GAP-07` | **Employee transparency surface** — nothing in `resources/` describes what a monitored employee can see about their own monitoring | Not sold; required | {High} | Specified as `{Proposed}` in [`REQ-MON-010`](#/functional-requirements). See [Security & Privacy](#/security-privacy) |
| `GAP-08` | **Data subject access, export and erasure** workflows are absent | Not sold; likely legally required | {High} | [`REQ-DATA-005`](#/functional-requirements), [`OQ-014`](#/open-questions) |
| `GAP-09` | **Seat limits** — `resources-1.md` §7 lists seat limits as a required capability, but no rule defines what happens at the limit | Not in matrix | {Medium} | [`REQ-BILL-006`](#/functional-requirements) `{Proposed}` |
| `GAP-10` | **Pricing** is entirely absent from all sources | — | {Medium} | [`OQ-007`](#/open-questions) |
| `GAP-11` | **Localisation** — the design is multi-timezone and multi-currency, but no language/locale requirement exists | — | {Low} | English-only MVP assumed, [`ASM-012`](#/assumptions) |
| `GAP-12` | **Availability target / SLA** is never stated | — | {Medium} | [`NFR-REL-001`](#/non-functional-requirements) `{Proposed}`; [`OQ-008`](#/open-questions) |
| `GAP-13` | **Public holiday calendar** — attendance status includes `holiday`, but no entity holds holidays | Implied by Attendance | {Medium} | [`REQ-SCHED-006`](#/functional-requirements) `{Proposed}` |
| `GAP-14` | **Time rounding rules** are referenced in `organization_settings` but never specified | Implied by Payroll | {Medium} | [`BR-PAY-004`](#/business-rules), [`OQ-012`](#/open-questions) |
| `GAP-15` | **Platform Administrator** appears in `resources-1.md` §4 with real responsibilities but has no data model, no permissions and no requirements anywhere else | Not in matrix | {Medium} | Specified in the [`ADMIN`](#/functional-requirements) module as `{Derived}`/`{Proposed}` |
| `GAP-16` | **Accessibility** requirements are absent | — | {Medium} | [`NFR-USE-001`](#/non-functional-requirements) `{Proposed}` |
| `GAP-17` | **Screenshot redaction / blurring** and employee-initiated deletion requests are not addressed | Not in matrix | {Medium} | [`REQ-MON-011`](#/functional-requirements) `{Proposed}`, [`OQ-015`](#/open-questions) |
| `GAP-18` | **Recovery objectives (RPO/RTO)** are not quantified despite a documented recovery procedure | — | {Medium} | [`NFR-REL-004`](#/non-functional-requirements) `{Proposed}` |
| `GAP-19` | **Billing provider** is abstracted but never chosen; **email provider** likewise | — | {Low} | [`OQ-009`](#/open-questions), [`OQ-010`](#/open-questions) |
| `GAP-20` | **Payroll adjustment detail** — `resources-12.md` §48 flags that a single `adjustments` amount has no audit trail and recommends a richer model, then defers it | Standard, Premium | {Medium} | Accepted as an MVP limitation, [`BR-PAY-006`](#/business-rules) |

---

## 5. What the research got right

Recorded because these decisions should survive into System Design unchanged:

| Decision | Source | Why it matters |
|---|---|---|
| `users → organization_memberships → organizations`, with the **membership** carrying roles, teams and settings | `resources-3.md` §2 | Correct SaaS identity foundation; makes organization switching and per-organization roles natural |
| Tracking events → sessions → **derived** time entries, rather than a single start/end record | `resources-2.md` §6, `resources-3.md` §58 | Survives crashes, offline periods, idle handling and project switching |
| Client-generated `client_event_id` with a server-side uniqueness constraint for **idempotent** sync | `resources-3.md` §14 | The single most important correctness control for offline tracking |
| **Payroll never reads raw tracking data**; the chain is tracking → time entries → timesheet → approval → payroll | `resources-12.md` §46 | Prevents unapproved or disputed time reaching pay |
| Timesheet entries **snapshot** duration rather than referencing live values | `resources-12.md` §36 | Stops later edits silently changing an approved financial record |
| Pay rates carry effective dates; payroll entries snapshot the rate applied | `resources-12.md` §41, §47 | Historical payroll stays correct after a raise |
| **Permission ≠ entitlement**; both must pass | `resources-13.md` §56 | Prevents plan checks being scattered through the codebase |
| Media binaries in object storage, metadata in PostgreSQL, access via short-lived signed URLs | `resources-2.md` §16, `resources-10.md` §25 | Correct for both cost and confidentiality |
| Durations as integer seconds; money as fixed-precision decimals | `resources-8.md` §4, §5 | Removes a whole class of financial rounding defects |
| Idle periods and breaks are **different concepts** and are stored separately | `resources-11.md` §34 | Idle is observed; a break is declared. Conflating them misstates both |
| Overnight shifts must not assume `end_time > start_time` | `resources-11.md` §28 | Correct handling of night shifts |
| Approved leave produces `on_leave` attendance, never `absent` | `resources-11.md` §39 | Prevents a punitive and wrong attendance record |
| Delete media from object storage **before** removing metadata | `resources-10.md` §30 | Avoids orphaned, unreferenced private files |
