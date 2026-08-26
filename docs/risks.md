# Project Risks

Twenty-four risks across nine categories. Each carries a description, impact, likelihood, mitigation, an early-warning signal and a responsible area.

**Scoring:** impact is the consequence if it occurs; likelihood is the probability it occurs given current mitigations. Exposure is the combination — the ordering used below.

| Category | Risks |
|---|---|
| Technical | `RISK-001`, `RISK-006`, `RISK-012`, `RISK-013`, `RISK-014` |
| Product | `RISK-002`, `RISK-003`, `RISK-004`, `RISK-017` |
| Security | `RISK-007`, `RISK-011` |
| Privacy | `RISK-005`, `RISK-015` |
| Compliance | `RISK-005`, `RISK-016` |
| Scalability | `RISK-013`, `RISK-018` |
| UX | `RISK-019`, `RISK-020` |
| Operational | `RISK-009`, `RISK-010`, `RISK-021`, `RISK-022` |
| Third-party | `RISK-008`, `RISK-023`, `RISK-024` |

---

## Critical exposure

### RISK-001 — The desktop tracker is the largest technical unknown
**Technical** · Impact {High} · Likelihood {High} · Owner: Engineering

Idle detection, screen capture, screen recording, application and window focus detection, and durable local storage all behave differently on Windows, macOS and Linux. Several require OS permission grants a user can refuse, and macOS in particular restricts screen and input access behind explicit consent. None of this is proven anywhere in `resources/`.

**If it occurs:** the critical path stops. Every module downstream of `TIME` depends on capture working.

**Mitigation**
- Technical spike on all four capabilities across all three platforms **before** R2 is scheduled in detail — milestone `M-03`
- Ship Windows and macOS first; Linux as `{P1}`
- Design for graceful degradation from the start — [`REQ-DEV-006`](#/functional-requirements) makes a denied permission a reported state rather than a failure
- Treat `M-05` (capture proven) as the project's genuine go/no-go point

**Early warning:** the spike takes longer than planned, or any one capability proves unreliable on any platform.

---

### RISK-005 — Legal review of monitoring lawfulness has not started
**Privacy · Compliance** · Impact {High} · Likelihood {High} · Owner: Product / Legal

The product captures screen images and screen video of employees. Lawfulness, the valid basis for processing, and whether prior consultation with employee representatives is required all vary by jurisdiction. Target jurisdictions are undetermined, and no review has begun.

**If it occurs:** the product cannot be sold in an intended market, or is sold and then challenged. Discovering this after launch is far more expensive than discovering it now.

**Mitigation**
- Determine target launch markets — [`OQ-014`](#/open-questions)
- Engage counsel on L1–L4 in [Security & Privacy](#/security-privacy) §6
- Treat completion as a launch gate, not a parallel activity
- The transparency controls already specified ([`REQ-MON-009`](#/functional-requirements), [`REQ-MON-010`](#/functional-requirements)) reduce exposure whatever the answer, and are worth building before the answer arrives

**Early warning:** `M-09` approaches with L1–L4 unanswered.

---

### RISK-002 — The feature matrix sells platforms that MVP will not ship
**Product** · Impact {High} · Likelihood {High} · Owner: Product

"Windows, Mac, Linux, Chrome and mobile apps" is granted to **all three plans including Basic** `{Confirmed}`. MVP ships a desktop tracker and a web application. A Basic customer would be entitled to mobile and Chrome clients that do not exist. See [`CONF-04`](#/source-audit).

**If it occurs:** misrepresentation in the commercial matrix, refund requests, and a churn driver in the cheapest tier.

**Mitigation**
- Decide before launch: restrict the published matrix, or extend scope — [`OQ-002`](#/open-questions)
- If restricting, re-issue the matrix rather than relying on caveats in a sales conversation
- If extending, accept the schedule and cost impact explicitly rather than absorbing it

**Early warning:** the matrix goes to a customer unchanged while mobile remains {V1.1}.

---

## High exposure

### RISK-003 — Two sold features cannot be specified
**Product** · Impact {High} · Likelihood {High} · Owner: Product

"Work-life balance metrics" (Standard, Premium) and "Executive dashboard and reporting" (Premium) are `{Confirmed}` commercial commitments with **no definition anywhere in the source material** — `GAP-01`, `GAP-03`. [`REQ-REPORT-013`](#/functional-requirements) and [`REQ-REPORT-014`](#/functional-requirements) are blocked.

**If it occurs:** two entitlements are advertised and either not delivered, or delivered as something invented late, badly, and under schedule pressure.

**Mitigation**
- Define both, or remove both from the matrix — [`OQ-004`](#/open-questions), [`OQ-005`](#/open-questions)
- For work-life balance, note that the underlying data is already captured; the gap is purely definitional and therefore cheap to close once a decision is made
- Do not let either be defined by an engineer at implementation time

**Early warning:** either appears in a release plan without a written definition.

---

### RISK-007 — A tenant isolation defect
**Security** · Impact {High} · Likelihood {Low} · Owner: Engineering

One Organization reads another's time data, screenshots, recordings or payroll.

**If it occurs:** likely fatal commercially. This product's customers are trusting the vendor with images of their staff at work, frequently including their own clients' confidential material.

**Mitigation**
- Tenant column on every tenant-owned record plus mandatory query scoping — [`BR-ORG-001`](#/business-rules)
- Automated isolation test for **every** tenant-scoped endpoint, executed on every build; a new endpoint without a test fails the build — [`NFR-SEC-001`](#/non-functional-requirements)
- Not-found rather than forbidden responses, so existence is never confirmed
- Database row-level security as a second layer in V1.1
- Penetration test focused on tenancy before `M-09`

**Early warning:** isolation test coverage falls below 100% of tenant-scoped endpoints.

---

### RISK-006 — MVP scope is large for a first release
**Technical · Product** · Impact {High} · Likelihood {High} · Owner: Product / Engineering

22 modules, roughly 50 entities, 161 functional and 65 non-functional requirements, three client surfaces, and the whole chain from capture to payroll — with no team size, velocity or date established.

**If it occurs:** the release slips repeatedly, or scope is cut late and arbitrarily under pressure, which typically removes the cross-cutting concerns (audit, entitlements, transparency) that are hardest to retrofit.

**Mitigation**
- The descope order is decided **now**, not under pressure: Premium capabilities first ([`OQ-013`](#/open-questions)), then `{P1}` items, and **never** the cross-cutting `{P0}` items
- Release plan is vertical slices, each demonstrable — [Project Planning](#/project-planning) §4
- Audit, entitlements and transparency are built from R0 rather than deferred to R7
- Establish team and dates before committing to a launch — [`OQ-021`](#/open-questions)

**Early warning:** two consecutive release gates miss their exit criteria.

---

### RISK-011 — Vendor-side access becomes the privacy incident
**Security · Privacy** · Impact {High} · Likelihood {Medium} · Owner: Engineering / Operations

The vendor holds screenshots and screen recordings of every customer's employees. Routine support and debugging create pressure toward broad internal access.

**If it occurs:** a privacy incident the customer's employees never consented to and the customer cannot explain to them.

**Mitigation**
- No default vendor access to tenant business data — [`BR-ADMIN-001`](#/business-rules)
- Time-bounded, reason-recorded elevation, logged in the **customer's** audit log, with the Owner notified — [`REQ-ADMIN-005`](#/functional-requirements)
- Metadata-only diagnostics so routine debugging never needs content — [`BR-ADMIN-002`](#/business-rules)
- Production database access separately controlled, logged and rare

**Early warning:** a support process is documented that requires viewing customer screenshots.

---

### RISK-004 — Premium is last built and first cut
**Product** · Impact {Medium} · Likelihood {High} · Owner: Product

Premium consists of exactly three deliverable features — video recording, Office vs Remote, internet connectivity — plus one that cannot be specified. All are scheduled late (R8).

**If it occurs:** Premium cannot be sold at launch, removing the top of the pricing ladder.

**Mitigation**
- Decide explicitly whether Premium ships at launch — [`OQ-013`](#/open-questions)
- If not, publish a two-tier matrix at launch rather than a Premium tier with unavailable features
- Recording is `{P1}` rather than `{P0}` precisely because this trade-off is anticipated

**Early warning:** R8 has not started when R7 completes.

---

### RISK-015 — A public trust failure over monitoring
**Privacy** · Impact {High} · Likelihood {Medium} · Owner: Product

An incident — covert capture at a customer, an inappropriate screenshot surfacing, or a manager misusing recordings — becomes public and attaches to the product rather than to the customer.

**If it occurs:** reputational damage that no feature fixes, in a category already viewed with suspicion.

**Mitigation**
- Capture always visible to the person captured — [`BR-MON-008`](#/business-rules)
- Every capture category visible to its subject — [`BR-MON-009`](#/business-rules)
- Notification before monitoring increases — [`NFR-PRIV-004`](#/non-functional-requirements)
- Covert operation not supported at all — the anti-persona in [Personas](#/personas)
- Minimisation defaults: domain not URL, counts not keystrokes, application not window title

**Early warning:** a prospect asks whether the tracker can be hidden from employees.

---

## Medium exposure

### RISK-008 — No billing provider selected
**Third-party** · Impact {Medium} · Likelihood {High} · Owner: Product / Engineering

The subscription model is abstracted behind a provider interface, and no provider is chosen — `GAP-19`.

**Mitigation:** select before R7 — [`OQ-009`](#/open-questions). Keep the abstraction so a later change is contained. Reconciliation ([`REQ-BILL-008`](#/functional-requirements)) protects against lost webhooks whichever provider is chosen.

**Early warning:** R7 planning begins without a provider.

---

### RISK-009 — Code signing and notarisation lead time
**Operational · Third-party** · Impact {Medium} · Likelihood {Medium} · Owner: Operations

Windows code signing and macOS notarisation are procurement and identity-verification processes with real lead times. Nothing ships to a customer machine without them.

**If it occurs:** the tracker is built and cannot be distributed.

**Mitigation:** start both before R2 completes; treat as an external dependency with its own tracking, not an engineering task.

**Early warning:** R3 approaches without certificates in hand.

---

### RISK-010 — Single-VPS deployment with no failover
**Operational** · Impact {High} · Likelihood {Low} · Owner: Operations

The launch architecture is a single host with no automatic failover, by explicit decision (`resources-2.md` §17).

**If it occurs:** total service outage until manual recovery. RTO is 4 hours.

**Mitigation**
- Availability committed honestly at 99.5%, not aspirationally — [`NFR-REL-001`](#/non-functional-requirements)
- Offline capture means an outage degrades reporting, **not** capture — [`NFR-REL-002`](#/non-functional-requirements). This is what makes the risk tolerable
- Backups stored off-host, restore rehearsed rather than documented — [`NFR-REL-004`](#/non-functional-requirements)
- Reproducible deployment from version control — [`NFR-MAINT-006`](#/non-functional-requirements)

**Early warning:** the restore rehearsal is deferred past `M-09`.

---

### RISK-012 — Offline synchronisation correctness
**Technical** · Impact {High} · Likelihood {Medium} · Owner: Engineering

Idempotent ingestion, ordering, conflict handling and local durability across crashes and updates are genuinely difficult, and a defect here loses or duplicates people's paid time.

**Mitigation**
- Idempotency enforced by a database constraint, not application logic — [`BR-SYNC-002`](#/business-rules)
- Property-based replay testing on the sync endpoint
- `SC-02` and `SC-03` are launch gates
- Sync ledger restored so failures are diagnosable — [`REQ-SYNC-005`](#/functional-requirements)
- Backlog visible to the Member so silent loss is impossible — [`REQ-SYNC-006`](#/functional-requirements)

**Early warning:** duplicate or missing entries appear in any replay test.

---

### RISK-013 — Report performance without pre-computed aggregates
**Technical · Scalability** · Impact {Medium} · Likelihood {Medium} · Owner: Engineering

MVP deliberately has no aggregate tables (`resources-6.md` §6). Report performance therefore rests entirely on indexing over tables holding hundreds of millions of rows.

**Mitigation**
- Tenant-leading composite indexes — [`NFR-SCALE-005`](#/non-functional-requirements)
- Load test at `NFR-SCALE-002` volumes **before** `M-07`, not after launch
- Aggregate tables are pre-designed as a {V1.1} option with an explicit trigger: failure to meet [`NFR-PERF-002`](#/non-functional-requirements) is the trigger, not a preference
- Everything paginated; large reports asynchronous

**Early warning:** report latency degrades in staging as seeded data grows.

---

### RISK-014 — Timezone, DST and overnight-shift defects
**Technical** · Impact {Medium} · Likelihood {High} · Owner: Engineering

Overnight shifts, DST transitions, multi-timezone teams and calendar-day boundaries interact in ways that are easy to get subtly wrong and hard to notice — until attendance and pay are wrong.

**Mitigation**
- UTC storage with presentation-layer conversion — [`BR-ORG-005`](#/business-rules)
- Schedules carry their own timezone — [`BR-SCHED-005`](#/business-rules)
- No calculation assumes end after start — [`BR-SCHED-001`](#/business-rules)
- Test matrix across at least three timezones plus DST transitions in both directions — [`NFR-COMPAT-007`](#/non-functional-requirements)

**Early warning:** any attendance defect traced to a day boundary.

---

### RISK-016 — Retention silently stops working
**Compliance · Operational** · Impact {Medium} · Likelihood {Medium} · Owner: Engineering / Operations

A background job that stops running is the classic silent failure. Here it breaks a commercial commitment, expands breach exposure and grows storage cost simultaneously.

**Mitigation:** retention outcomes in platform health — [`REQ-ADMIN-004`](#/functional-requirements); failure alerting — [`NFR-MAINT-005`](#/non-functional-requirements); `SC-06` as a launch gate; per-organization storage growth monitoring — [`NFR-SCALE-006`](#/non-functional-requirements).

**Early warning:** stored volume grows faster than seat count.

---

### RISK-017 — Basic tier churn
**Product** · Impact {Medium} · Likelihood {Medium} · Owner: Product

Basic has no management features at all — no attendance, schedules, approvals, payroll or activity data. It is screenshots, hours and reports. It risks reading as a surveillance tool with no management value, while costing nearly as much to serve as Standard.

**Mitigation:** commercial positioning question — [`OQ-017`](#/open-questions). Options include repositioning Basic as an entry tier with a clear upgrade path, or moving one management feature down. Monitor Basic-tier churn and support cost from launch.

**Early warning:** Basic conversions do not upgrade.

---

### RISK-018 — Storage cost growth outpaces revenue
**Scalability · Operational** · Impact {Medium} · Likelihood {Medium} · Owner: Product / Operations

Screenshots at every tier, plus recordings at Premium, make media the dominant marginal cost. A Basic customer generates nearly the same capture volume as a Premium one at a fraction of the price.

**Mitigation:** retention tiering is the primary control and must actually delete; per-organization storage reporting — [`NFR-SCALE-006`](#/non-functional-requirements); screenshot interval floor and organization-configurable interval; unit-economics review once real usage exists.

**Early warning:** median storage per seat exceeds the modelled figure.

---

### RISK-019 — Tracker friction drives avoidance
**UX** · Impact {High} · Likelihood {Medium} · Owner: Product / UX

The Employee persona uses the tracker constantly and cannot opt out. If starting, switching, correcting or resolving idle time is painful, people work around it — and worked-around tracking produces worse data than no tracking, because it looks authoritative.

**Mitigation**
- Correction designed as routine and attributed, not exceptional — [`JRN-09`](#/user-journeys)
- Idle resolution offers a real choice rather than a punitive default — [`REQ-TIME-006`](#/functional-requirements)
- Tracker state visible without opening a window — [`REQ-DEV-004`](#/functional-requirements)
- Strict resource budget so the tracker does not slow the machine — [`NFR-PERF-005`](#/non-functional-requirements)
- Employee self-visibility reduces the sense of being measured invisibly — [`REQ-MON-010`](#/functional-requirements)

**Early warning:** manual entry rate rises relative to tracked time.

---

### RISK-020 — Approval becomes rubber-stamping
**UX · Product** · Impact {Medium} · Likelihood {High} · Owner: Product / UX

If reviewing a week takes a Manager an hour per person, they approve everything unread — and the governance gate that justifies the whole evidence chain becomes ceremonial.

**Mitigation:** approval queue ordered by anomaly signal — [`REQ-TS-008`](#/functional-requirements); a single timeline putting time, activity and evidence on one axis — [`REQ-REPORT-003`](#/functional-requirements); attendance exceptions surfaced automatically; approval decision-time monitored as `SC-12`.

**Early warning:** median time from submission to approval falls implausibly low.

---

### RISK-021 — Deriving attendance and time entries becomes a hot path
**Operational · Technical** · Impact {Medium} · Likelihood {Medium} · Owner: Engineering

Every synchronised batch triggers derivation, and every schedule, leave or holiday change triggers recomputation across many members and dates.

**Mitigation:** derivation asynchronous and idempotent — [`NFR-PERF-004`](#/non-functional-requirements), [`NFR-REL-005`](#/non-functional-requirements); recomputation batched and bounded; queue depth by job class monitored; separate workers per job class available as a scaling step — [`NFR-SCALE-003`](#/non-functional-requirements).

**Early warning:** queue depth grows during peak synchronisation periods.

---

### RISK-022 — No support channel at launch
**Operational** · Impact {Medium} · Likelihood {Medium} · Owner: Product

The feature matrix marks **every** support row — including email — as future release. Read literally, a paying customer has nowhere to go. See [`CONF-12`](#/source-audit).

**Mitigation:** confirm whether this is a document defect — [`OQ-003`](#/open-questions); establish at minimum an email support channel before launch regardless of what the matrix says.

**Early warning:** launch approaches with no support address published.

---

## Lower exposure

### RISK-023 — Object storage provider dependency
**Third-party** · Impact {Medium} · Likelihood {Low} · Owner: Engineering

All screenshots and recordings sit with one object storage provider. An outage makes evidence unviewable; a pricing change alters unit economics.

**Mitigation:** store a storage key rather than a provider URL, so the provider can change without rewriting records (`resources-10.md` §25); storage failure degrades evidence viewing only, never capture or ingestion — [`NFR-REL-008`](#/non-functional-requirements).

---

### RISK-024 — Email deliverability
**Third-party** · Impact {Medium} · Likelihood {Medium} · Owner: Operations

Invitations, verification, password resets and approval notifications all depend on email arriving. No provider is selected — `GAP-19`.

**Mitigation:** select a transactional provider with authentication configured — [`OQ-010`](#/open-questions); delivery failure surfaced to the sender with a copyable invitation link as a fallback — [`REQ-USER-002`](#/functional-requirements); delivery failure rate in platform health.

---

## Risk register summary

| ID | Risk | Impact | Likelihood | Category | Owner |
|---|---|---|---|---|---|
| `RISK-001` | Desktop tracker technical unknowns | {High} | {High} | Technical | Engineering |
| `RISK-005` | Legal review not started | {High} | {High} | Privacy/Compliance | Product/Legal |
| `RISK-002` | Matrix sells unshipped platforms | {High} | {High} | Product | Product |
| `RISK-003` | Two sold features unspecifiable | {High} | {High} | Product | Product |
| `RISK-006` | MVP scope size | {High} | {High} | Technical/Product | Product/Engineering |
| `RISK-007` | Tenant isolation defect | {High} | {Low} | Security | Engineering |
| `RISK-011` | Vendor-side access incident | {High} | {Medium} | Security/Privacy | Engineering/Ops |
| `RISK-015` | Public trust failure | {High} | {Medium} | Privacy | Product |
| `RISK-019` | Tracker friction | {High} | {Medium} | UX | Product/UX |
| `RISK-004` | Premium last built, first cut | {Medium} | {High} | Product | Product |
| `RISK-012` | Sync correctness | {High} | {Medium} | Technical | Engineering |
| `RISK-014` | Timezone and DST defects | {Medium} | {High} | Technical | Engineering |
| `RISK-020` | Approval rubber-stamping | {Medium} | {High} | UX/Product | Product/UX |
| `RISK-008` | No billing provider | {Medium} | {High} | Third-party | Product/Engineering |
| `RISK-010` | Single-VPS, no failover | {High} | {Low} | Operational | Operations |
| `RISK-013` | Report performance | {Medium} | {Medium} | Technical/Scalability | Engineering |
| `RISK-016` | Retention silently stops | {Medium} | {Medium} | Compliance/Ops | Engineering/Ops |
| `RISK-018` | Storage cost growth | {Medium} | {Medium} | Scalability/Ops | Product/Ops |
| `RISK-021` | Derivation hot path | {Medium} | {Medium} | Operational/Technical | Engineering |
| `RISK-009` | Code signing lead time | {Medium} | {Medium} | Operational/Third-party | Operations |
| `RISK-017` | Basic tier churn | {Medium} | {Medium} | Product | Product |
| `RISK-022` | No launch support channel | {Medium} | {Medium} | Operational | Product |
| `RISK-024` | Email deliverability | {Medium} | {Medium} | Third-party | Operations |
| `RISK-023` | Object storage dependency | {Medium} | {Low} | Third-party | Engineering |

---

## The four to watch

If attention is limited, these are the ones that change the project's outcome:

1. **`RISK-001`** — resolve with a spike before committing to any schedule. Everything is downstream of it.
2. **`RISK-005`** — the only risk that no engineering control can mitigate. Start it now; it has a lead time measured in weeks.
3. **`RISK-002` and `RISK-003`** — both are commercial decisions that cost nothing to make today and become expensive the moment the matrix reaches a customer.
4. **`RISK-006`** — the descope order must be agreed while nobody is under pressure. Under pressure, teams cut audit, entitlements and transparency, which are precisely the three things that cannot be retrofitted.
