# Decision Log

The authoritative register of product decisions. Each entry closes an open question, states the decision in one place, and names where it is implemented.

**Source records:** [Decision Record — Round 1](#/answers-decisions) and [Round 2](#/answers-decisions-verify) hold the full reasoning. This log is the index; where the two disagree, this log is what the design was built against.

| | Count |
|---|---|
| Decisions recorded | 33 |
| Open questions closed | 24 of 28 |
| Still open | 5 — [`OQ-007`](#/open-questions), [`OQ-010`](#/open-questions), [`OQ-014`](#/open-questions), [`OQ-021`](#/open-questions), [`OQ-029`](#/open-questions) |

:::warning Requirements documents lag these decisions
[Functional Requirements](#/functional-requirements) and its neighbours were written before these decisions were made and still carry pre-decision text in places — most visibly `REQ-PAY-002`, which grants pay-rate access to Administrators and is reversed by `DEC-027`. The [System Design](#/sd-overview) set is built on the decided position. Where the two disagree, **the decisions are authoritative** and the requirements set needs a reconciliation pass.
:::

---

## Product and commercial

### DEC-001 — Product name {Decided}
Closes [`OQ-001`](#/open-questions) · resolves [`CONF-01`](#/source-audit)

**Team Time Track.** Used consistently in the database, applications, API, installer, email, domains and branding. "Time Time Track" is not carried forward.

### DEC-002 — MVP client surfaces {Decided}
Closes [`OQ-002`](#/open-questions) · resolves [`CONF-04`](#/source-audit)

MVP ships the **web application and the Electron desktop tracker for Windows, macOS and Linux**. Mobile and Chrome clients are future surfaces and **must not be promised until implemented** — the commercial matrix needs re-issuing. The API stays platform-neutral so later clients need no backend redesign.

→ [`NFR-COMPAT-002`](#/non-functional-requirements) · [Clients](#/sd-clients)

### DEC-003 — Support at launch {Decided}
Closes [`OQ-003`](#/open-questions) · resolves [`CONF-12`](#/source-audit)

**Email support exists at launch.** A ticket portal, live chat and callback follow later. A paying customer must have somewhere to go.

→ [Operations](#/sd-operations) §12

### DEC-011 — Premium ships at launch {Decided}
Closes [`OQ-013`](#/open-questions)

All four Premium capabilities ship: video recording, Office vs Remote, internet connectivity, executive dashboard. Not a single-feature Premium tier.

**Consequence:** the four requirements previously parked as schedule buffer become committed MVP scope, and the descope lever in [`RISK-006`](#/risks) is gone. It also puts organization-wide aggregation in launch scope, which is why `ADR-017` brings rollup tables forward.

### DEC-014 — Tier positioning {Decided}
Closes [`OQ-017`](#/open-questions)

Three tiers, unchanged, with explicit positioning: **Basic — core time tracking and visibility · Standard — workforce management and productivity · Premium — advanced monitoring and company insights.** Features are not quietly moved between tiers.

### DEC-013 — Competitive research {Decided}
Closes [`OQ-016`](#/open-questions)

Commission it before final pricing and positioning; not a blocker for design. Time Doctor as primary benchmark, alongside Hubstaff, ActivTrak, Teramind, Toggl Track and Clockify. Requirements are not changed merely because a competitor has a feature.

### DEC-017 — Persona validation {Decided}
Closes [`OQ-020`](#/open-questions)

Validate before UX is finalised: 5–8 interviews across Manager, Employee and Administrator. Questions about current behaviour, never "would you use this".

---

## Capture and monitoring

### DEC-019 — Multi-display capture {Decided}
Closes [`OQ-023`](#/open-questions)

**Every connected display is captured simultaneously, one independent stream per physical display.** No compositing. Screenshots also per display. Streams share a common recording timeline for synchronised playback. Display identity is physical, never an index.

→ `ADR-010` `ADR-011` · [Capture & Media](#/sd-capture) §2 · [Data Model](#/sd-data-model) §7, §9

### DEC-025 — Display cap and screenshot resolution {Decided}
Round 2 §1

**Maximum 4 displays.** Screenshots at **native physical resolution**, no downscaling at MVP. Displays beyond the cap are excluded and the condition surfaced to the member and the administrator.

**Consequence:** native resolution is the dominant screenshot cost — roughly 140 MB per member per day across two displays rather than 30 MB. Accepted for evidential fidelity, monitored through `storage_usage_daily`.

### DEC-026 — Recording parameters and retention {Decided}
Round 2 §2

Recording capped at **1920×1080 per display at 10 fps**. Recordings stay on the shared `retention_months` entitlement; **storage consumption is accounted separately per media type**.

**Consequence:** the caps cut cost by roughly an order of magnitude against native 4K/30 fps. The residual — about 1.1 TB retained per member at two displays on Premium — remains the largest single cost line in the system. [`RISK-018`](#/risks).

→ [Capture & Media](#/sd-capture) §4 · `REQ-DATA-006`

### DEC-031 — Recording format {Decided}
Round 2, resolves [`CONF-07`](#/source-audit)

**WebM** (VP8/VP9) as the source format, which is what Electron's `MediaRecorder` reliably produces. Container, codec and MIME type are **stored**, never assumed. MP4 becomes a derived representation if export requires it.

→ `ADR-013`

### DEC-032 — Physical display entity {Decided}
Round 2, database consequence

A dedicated **`device_displays`** table gives stable physical-display identity, rather than storing display information on `recordings`.

→ `ADR-010` · [Data Model](#/sd-data-model) §7

### DEC-024 — Screenshot interval {Decided}
Closes [`OQ-028`](#/open-questions)

**Default 10 minutes, minimum 5 minutes, randomised within the interval** so the capture schedule is not predictable.

### DEC-012 — Screenshot privacy controls {Decided}
Closes [`OQ-015`](#/open-questions)

MVP ships **member-controlled capture pause**, organization capture policy, and the architecture for **sensitive application and domain exclusions** (P1). Blur-by-default is not mandatory at MVP but the architecture must support it later.

### DEC-028 — Capture pause semantics {Decided}
Round 2 §4

**Pausing capture does not pause time tracking.** `Tracking ON / Capture OFF` is a valid state. Every pause is a record carrying member, device, interval, reason and source. **Maximum 30 minutes per pause**, then automatic resume. Manager-visible with the reason category only. Reports record `tracking_duration`, `capture_duration` and `capture_gap_duration` separately.

→ `ADR-012` · [Tracking](#/sd-tracking) §9 · [Data Model](#/sd-data-model) §9

### DEC-020 — Monitoring policy re-acknowledgement {Decided}
Closes [`OQ-024`](#/open-questions)

Configuration changes are **material** or **non-material**. Any increase in monitoring intensity is material and requires re-acknowledgement; a material policy does not take effect for a member until acknowledged. Stored as member + policy version + `acknowledged_at` + configuration hash, never a boolean.

→ `ADR-019` · [Tenancy & Security](#/sd-tenancy-security) §6

### DEC-006 — Automatic tracking {Decided}
Closes [`OQ-006`](#/open-questions) · fills `GAP-04`

| Question | Decision |
|---|---|
| Start at sign-in? | No |
| Start on activity? | Yes, within an eligible scheduled period |
| Start outside the schedule? | No |
| Can the employee stop it? | Yes |
| Visible indicator? | Yes |
| Available without the schedules entitlement? | No |

### DEC-030 — Automatic tracking restart {Decided}
Round 2 §6

**Once a member manually stops automatic tracking during a shift, it does not restart until the next scheduled shift.** No timed cooldown. Manual start remains available at any time.

Chosen because a timer produces exactly the behaviour the decision set out to avoid — silently re-tracking someone who stopped for a reason.

---

## Workforce, approval and pay

### DEC-016 — Finance role {Decided}
Closes [`OQ-019`](#/open-questions)

Add a dedicated **Finance** role to the MVP authorization model: pay rates, payroll and payroll reports, without organization administration.

### DEC-027 — Finance boundary {Decided}
Round 2 §3

**Administrator does not automatically have pay-rate or payroll access.** Owner retains everything. Five system roles: Owner, Administrator, Manager, Finance, Employee.

**Reverses** [`REQ-PAY-002`](#/functional-requirements) as originally written.

→ [Tenancy & Security](#/sd-tenancy-security) §4

### DEC-010 — Payroll rounding {Decided}
Closes [`OQ-012`](#/open-questions) · fills `GAP-14`

**Exact to the second internally.** Rounding is configurable and applied only at payroll calculation. Default: **nearest 1 minute, at payroll-period scope**. The rule applied is recorded with the output.

Period scope rather than per entry because rounding each entry independently produces a different total from rounding the period.

### DEC-022 — Single-member approval {Decided}
Closes [`OQ-026`](#/open-questions)

An **Owner who is the sole active member may approve their own timesheet**, recorded explicitly as `self_approved` in the approval history and the audit trail. Better than making payroll impossible for solo organizations.

### DEC-009 — Leave scope {Decided}
Closes [`OQ-011`](#/open-questions) · [`CONF-09`](#/source-audit)

MVP is **leave requests and approval only**. No entitlement, accrual, carry-over or proration. The model must remain extensible for `leave_balances` and `leave_accruals` in V1.1.

### DEC-015 — Contractors {Decided}
Closes [`OQ-018`](#/open-questions)

Contractors are normal Memberships with the Employee role and a pay rate. An `employment_type` column exists for later use; no separate entity, no separate behaviour at MVP.

---

## Platform, billing and operations

### DEC-008 — Billing provider {Decided}
Closes [`OQ-009`](#/open-questions)

**Stripe.** Handles payment, recurring subscriptions, **30-day trials on every plan**, invoices, dunning and proration. Laravel remains the application source of truth for subscription state, plans and entitlements, synchronised through **signature-verified, idempotent webhooks**. Stripe logic stays behind a billing adapter.

The browser returning from Checkout never activates a subscription; the webhook does.

→ `ADR-018` · [Jobs, Reporting & Billing](#/sd-platform) §8

### DEC-029 — Trial guard rails {Decided, with an open number}
Round 2 §5

Trials are **entitlement-identical to the paid plan** — no feature restrictions. **Resource abuse limits are required but the values are a commercial decision** → [`OQ-029`](#/open-questions).

The enforcement point is built; the limits are configuration.

### DEC-018 — Downgrade grace {Decided}
Closes [`OQ-022`](#/open-questions)

**30-day grace period** on any downgrade that shortens retention, with a preview of the data volume affected, an export offer, data labelled "Scheduled for deletion", and warnings at grace start and 7 days before expiry. Nothing is deleted because a subscription changed.

→ `ADR-020` · [Capture & Media](#/sd-capture) §8

### DEC-021 — Vendor support access {Decided}
Closes [`OQ-025`](#/open-questions)

Organizations may **opt out of vendor support access entirely**. Default is allow, with the existing audit, time-limit and notification protections. When disabled, elevation is refused and the customer must enable it explicitly.

→ [Tenancy & Security](#/sd-tenancy-security) §7

### DEC-023 — Multi-factor authentication {Decided}
Closes [`OQ-027`](#/open-questions)

**TOTP at MVP.** Required for Owner and Administrator — and by extension Finance. Supported for Manager and Employee, escalable by organization policy. Passkeys and SSO later; SSO must not become an MVP dependency.

→ `ADR-023`

### DEC-007 — Capacity targets {Decided}
Closes [`OQ-008`](#/open-questions)

99.5% monthly availability, 500 organizations, 10,000 memberships, 2,000 concurrent trackers — as **engineering capacity targets, not SLA guarantees**. Load-tested before launch. Concurrent trackers are not concurrent requests: the tracker batches.

**The application must not become architecturally dependent on a single server**, even while it runs on one.

→ `ADR-021` · [Operations](#/sd-operations) §3

### DEC-004 — Work-life balance metrics {Decided}
Closes [`OQ-004`](#/open-questions) · fills `GAP-01`

Six **objective metrics**, presented as facts: work outside scheduled hours, weekend work, average daily tracked hours, long work sessions, break patterns, scheduled versus tracked.

**No composite wellbeing score.** A single number would be misleading and potentially harmful.

→ [`REQ-REPORT-014`](#/functional-requirements), now specifiable · [Jobs, Reporting & Billing](#/sd-platform) §5

### DEC-005 — Executive dashboard {Decided}
Closes [`OQ-005`](#/open-questions) · fills `GAP-03`

An **organization-level business overview**, not another surveillance screen. Nine panels — tracked hours, active members, team utilisation, scheduled versus tracked, productivity trends, attendance trends, project distribution, remote versus office, connectivity — across today / 7 days / 30 days / custom.

Aggregation introduced only where performance requires it — which, given this scope, is at MVP (`ADR-017`).

→ [`REQ-REPORT-013`](#/functional-requirements), now specifiable

### DEC-033 — Documentation navigation {Decided}
Round 2

Decision records are first-class documents in the portal, with this log as the authoritative index.

---

## Decisions that changed the requirements baseline

The eight that a reconciliation pass must apply:

| Decision | Requirement affected | Change |
|---|---|---|
| `DEC-027` | [`REQ-PAY-002`](#/functional-requirements) | Administrator loses pay-rate access; Finance gains it |
| `DEC-016` | [`REQ-RBAC-002`](#/functional-requirements) | Four system roles become five |
| `DEC-011` | [`REQ-REPORT-011`](#/functional-requirements), [`-012`](#/functional-requirements) | `{P2} {V1.1}` → `{P1} {MVP}` |
| `DEC-005` | [`REQ-REPORT-013`](#/functional-requirements) | `{Open}` and blocked → specifiable, `{P1} {MVP}` |
| `DEC-004` | [`REQ-REPORT-014`](#/functional-requirements) | `{Open}` and blocked → specifiable, `{P1} {MVP}` |
| `DEC-030` | [`REQ-TIME-004`](#/functional-requirements) | Cooldown becomes "no restart until the next shift" |
| `DEC-025`, `DEC-019` | [`REQ-MON-001`](#/functional-requirements) | Per-display capture, native resolution, 4-display cap |
| `DEC-028` | [`REQ-MON-006`](#/functional-requirements) | Four evidence-gap states become five |

Nine requirements are also **new**: MFA, vendor support access opt-out, display enumeration, capture pause, sensitive exclusions, synchronised playback, rounding policy, Stripe webhooks and storage accounting. All nine are already specified in the [System Design](#/sd-overview).

---

## Still open

| Question | Blocks | Owner |
|---|---|---|
| [`OQ-007`](#/open-questions) Pricing | Plan seed data | Commercial |
| [`OQ-010`](#/open-questions) Email provider | Nothing — the interface exists | Operations |
| [`OQ-014`](#/open-questions) Jurisdictions and legal review | **Launch** | Product / Legal |
| [`OQ-021`](#/open-questions) Team and schedule | All scheduling | Project management |
| [`OQ-029`](#/open-questions) Trial resource limits | Nothing — the enforcement point exists | Commercial |

Only `OQ-014` blocks launch, and it is the one no amount of engineering resolves. [`RISK-005`](#/risks).
