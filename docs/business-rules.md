# Business Rules

Business rules are the invariants and policies that requirements depend on. A requirement says *what the system does*; a business rule says *what must always be true, regardless of which requirement is executing*.

**A rule violated anywhere is a defect everywhere.** Where a rule and a requirement appear to conflict, the rule wins and the requirement is wrong.

Each rule carries an evidence badge and an enforcement point. `{Invariant}` rules must be enforced structurally — by a database constraint or a domain-layer guard — not merely by validation in a request handler.

---

## ORG · Tenancy and organization

### BR-ORG-001 — Every tenant-owned record belongs to exactly one Organization {Invariant} {Derived}

Every record that is not global reference data carries an Organization, and every read and write resolves within exactly one Organization.

**Enforcement:** database column plus query-layer scoping on every tenant-owned entity.
**Consequence of violation:** cross-tenant data exposure — the single most severe failure this product can have.
**Source:** `resources-1.md` §3, `resources-8.md` §28.

### BR-ORG-002 — A person's Organization context is their Membership, never their User {Invariant} {Derived}

Roles, permissions, teams, projects, schedules, pay rates and notification preferences resolve from the Membership. The global User carries identity and credentials only.

**Enforcement:** domain layer; no permission check accepts a User without a Membership context.
**Resolves:** [`CONF-02`](#/source-audit).
**Source:** `resources-3.md` §2, reaffirmed in `resources-4`, `-6`, `-7`, `-8`, `-9`, `-14`.

### BR-ORG-003 — A User holds at most one Membership per Organization {Invariant} {Derived}

**Enforcement:** unique constraint on (Organization, User).

### BR-ORG-004 — An active Organization has exactly one Owner at all times {Invariant} {Derived}

The Owner Membership cannot be removed, suspended or demoted while it holds ownership. Ownership moves only by transfer, which is atomic.

**Enforcement:** domain layer; transfer is a single transactional operation.

### BR-ORG-005 — All instants are stored in UTC; locale settings affect presentation only {Invariant} {Derived}

Changing an Organization's timezone never alters a stored instant. It changes how instants are rendered and where calendar-day boundaries fall.

**Enforcement:** timezone-aware timestamp columns throughout; conversion at the presentation boundary only.
**Source:** `resources-8.md` §3, `resources-14.md` Rule 10.

### BR-ORG-006 — Organization suspension blocks access, never data {Derived}

A suspended Organization retains every record. Suspension is reversible without loss.

---

## AUTH · Identity

### BR-AUTH-001 — Email addresses are globally unique across the platform {Invariant} {Derived}

One email address identifies one User, who may hold Memberships in many Organizations.

**Enforcement:** unique constraint.
**Source:** `resources-3.md` §3.

### BR-AUTH-002 — Credentials and tokens are never stored recoverably {Invariant} {Derived}

Passwords are stored as one-way hashes. Invitation tokens, reset tokens and device tokens are stored hashed. No credential appears in logs, crash reports or error payloads.

**Enforcement:** storage layer and logging filters.

### BR-AUTH-003 — Authentication failure messages never disclose account existence {Derived}

Login, password reset and registration produce responses that do not distinguish a known address from an unknown one.

---

## USER · Membership lifecycle

### BR-USER-001 — Invitations are single-use and expire {Invariant} {Derived}

An accepted, revoked or expired Invitation can never be accepted.

### BR-USER-002 — Seat capacity is checked at invitation and again at acceptance {Derived}

Capacity can be consumed between the two events; checking only at invitation permits the limit to be exceeded.

### BR-USER-003 — Removing a Membership never deletes historical business records {Invariant} {Derived}

Time entries, timesheets, approvals, attendance and payroll entries survive the removal of the Membership that produced them.

**Enforcement:** restrictive delete behaviour on historical relations; removal is a status change, not a deletion.
**Source:** `resources-8.md` §27.

### BR-USER-004 — Suspension immediately stops capture {Derived}

Suspending a Membership stops any active tracking session and rejects its device tokens.

---

## RBAC · Authorization

### BR-RBAC-001 — Every operation is authorized server-side {Invariant} {Derived}

No client-side check constitutes authorization. Client behaviour is presentation.

**Source:** `resources-13.md` §54.

### BR-RBAC-002 — A Membership always holds at least one role {Invariant} {Derived}

### BR-RBAC-003 — A Member cannot change their own role {Derived}

Prevents self-escalation.

### BR-RBAC-004 — Manager access is bounded by scope {Invariant} {Derived}

A Manager may read and act on Memberships in Teams they manage, plus Members explicitly assigned to them, and nothing else. Scope is evaluated per request.

### BR-RBAC-005 — Employee permissions grant access to own data only {Invariant} {Derived}

An Employee role can never read another Member's tracking, monitoring, attendance, timesheet or pay data.

---

## PROJ · Work management

### BR-PROJ-001 — Project and Task must share an Organization with the time they record {Invariant} {Derived}

A time entry's Organization, its Project's Organization and its Task's Organization are always identical, and the Task always belongs to the referenced Project.

**Enforcement:** domain-layer invariant, checked on write.
**Source:** `resources-3.md` §43, which identifies exactly this consistency risk.

### BR-PROJ-002 — Unattributed time is permitted only where the Organization allows it {Derived}

Where disallowed, a time entry without a Project is refused. Where allowed, unattributed time is reported as its own category and never silently assigned to a Project.

### BR-PROJ-003 — Archiving preserves history {Invariant} {Derived}

Archiving a Project, Task or Team removes it from selection. It never alters records already attributed to it.

---

## TIME · Tracking

### BR-TIME-001 — Time Entries are derived and re-derivable {Invariant} {Derived}

A Time Entry with `source = tracked` is a function of its session's Tracking Events. Re-deriving from unchanged events yields an identical result.

**Consequence:** Tracking Events are immutable. Corrections create or modify Time Entries; they never rewrite events.
**Source:** `resources-3.md` §58, `resources-14.md` Rule 4.

### BR-TIME-002 — A Membership has at most one active tracking session {Invariant} {Derived}

Starting a session on a second Device closes the first, and the Member is told.

### BR-TIME-003 — The idle threshold is bounded {Derived}

A minimum and maximum threshold are enforced platform-wide. A near-zero threshold makes normal work look like absence; an unbounded one makes idle detection meaningless.

### BR-TIME-004 — Time Entries for one Membership never overlap {Invariant} {Derived}

No second of a Member's day is claimed twice, whether by tracking or by manual entry.

**Enforcement:** domain-layer check on every entry creation and edit.
**Consequence:** prevents double-counting in reports and double-payment in payroll.

### BR-TIME-005 — Every manual entry and every edit carries an actor and a reason {Invariant} {Proposed}

No time is created, changed or discarded by a person without an attributed actor and a stated reason, both retained in the audit record.

**Fills:** `GAP-06`.

### BR-TIME-006 — Idle Periods and Breaks are distinct and never interchangeable {Invariant} {Derived}

An Idle Period is observed by the system. A Break is declared by the Member. Reclassifying idle time as a break creates a Break; it does not convert the Idle Period.

**Source:** `resources-11.md` §34.
**Why it matters:** in a dispute, "the system saw no input" and "the employee said they were on a break" are different claims with different weight.

### BR-TIME-007 — Sessions are bounded by a maximum duration {Derived}

A session exceeding the Organization's maximum is stopped automatically and flagged for confirmation, preventing a forgotten tracker producing an implausible day.

### BR-TIME-008 — Both event time and receipt time are recorded {Invariant} {Derived}

`occurred_at` comes from the client and is authoritative for derivation. `received_at` comes from the server. Implausible divergence is flagged, never silently corrected.

**Why:** the client is the only source that knows when work happened offline. The server is the only trustworthy clock. Both are needed.

### BR-TIME-009 — Automatic tracking is bounded by schedule and by consent {Invariant} {Proposed}

Automatic tracking starts only within the Member's scheduled hours, only where the Organization has explicitly enabled it, and never restarts within the cooldown after a Member stops it.

**Fills:** `GAP-04`. Requires confirmation — [`OQ-006`](#/open-questions).

---

## SYNC · Synchronisation

### BR-SYNC-001 — Event identity is client-generated and globally unique within an Organization {Invariant} {Derived}

**Enforcement:** unique constraint on (Organization, client event identifier).
**Source:** `resources-3.md` §14, `resources-9.md` §21.

### BR-SYNC-002 — Ingestion is idempotent {Invariant} {Derived}

Submitting the same event any number of times produces exactly one stored event and one derived result.

**Enforcement:** database constraint, not application logic alone.

### BR-SYNC-003 — Captured events are never discarded to save space {Invariant} {Proposed}

When local storage is constrained, media may be dropped after warning the Member. Time and session events never are.

**Rationale:** a lost screenshot is an evidence gap; a lost event is unpaid work.

### BR-SYNC-004 — Device revocation does not destroy unsynchronised work {Derived}

Events captured before revocation are accepted for a defined grace period after it.

### BR-SYNC-005 — The tracker never reports a state better than reality {Invariant} {Proposed}

A synchronised indication while a backlog exists, or an active-capture indication while capture is failing, is a defect.

---

## MON · Monitoring

### BR-MON-001 — Capture occurs only during an active tracking session {Invariant} {Derived}

No screenshot, activity sample, application record, website record or recording is captured while tracking is stopped, paused, or during a declared break.

### BR-MON-002 — The screenshot interval has an enforced minimum {Proposed}

A platform-wide floor prevents an interval that amounts to continuous capture by another name.

### BR-MON-003 — Media binaries never pass through or rest on the application server {Invariant} {Derived}

Screenshots and recordings upload directly to object storage. The database holds metadata and a storage key, never a binary and never a permanent public URL.

**Source:** `resources-10.md` §25, `resources-14.md` Rule 5.

### BR-MON-004 — Website capture stores the domain by default {Invariant} {Proposed}

Full paths are captured only under an explicit Organization setting that is disclosed to Members. Query strings and fragments are never stored.

**Source:** risk identified in `resources-3.md` §25; made a rule here.

### BR-MON-005 — Window titles and input content are never captured {Invariant} {Proposed}

Application capture records the application, not what is inside it. Activity capture records counts, not keystrokes.

### BR-MON-006 — Productivity classification applies from its effective date {Derived}

Changing a classification does not silently restate historical reports. A report states the classification basis it used.

### BR-MON-007 — Productivity classifies applications and domains, never people {Invariant} {Proposed}

The system produces no aggregate score representing a person's performance.

### BR-MON-008 — Capture is always visible to the person being captured {Invariant} {Proposed}

The tracker visibly indicates that it is running and which capture types are active. Covert operation is not a supported mode.

**Consequence:** closes a market segment deliberately. See [Personas](#/personas) — anti-persona.

### BR-MON-009 — For every category captured about a Member, that Member can view their own {Invariant} {Proposed}

No capture type exists that its subject cannot see.

**Fills:** `GAP-07`.

---

## REC · Recording

### BR-REC-001 — Recordings are segmented, and a failure costs at most one segment {Invariant} {Derived}

**Source:** `resources-2.md` §9.

### BR-REC-002 — Recording viewing is permissioned separately from screenshot viewing {Proposed}

An upgrade to Premium must not silently convert every screenshot reviewer into a continuous-video reviewer.

---

## SCHED · Schedules

### BR-SCHED-001 — A shift end earlier than its start means the shift crosses midnight {Invariant} {Derived}

No calculation may assume `end > start`.

**Source:** `resources-11.md` §28.

### BR-SCHED-002 — An overnight shift is attributed to its start date {Derived}

Worked time on both calendar dates that falls inside the shift window counts to the shift's start date.

### BR-SCHED-003 — Schedule assignments for one Membership never overlap {Invariant} {Derived}

**Enforcement:** domain check on assignment.

### BR-SCHED-004 — Historical expectation uses the Schedule effective at that time {Invariant} {Derived}

Changing a Member's schedule never rewrites what was expected of them in the past.

### BR-SCHED-005 — Expected duration is computed in the Schedule's own timezone {Invariant} {Derived}

A day containing a daylight-saving transition has 23 or 25 hours, and expected duration reflects actual elapsed time.

---

## ATT · Attendance and breaks

### BR-ATT-001 — Exactly one Attendance Record exists per Membership per date {Invariant} {Derived}

**Enforcement:** unique constraint on (Organization, Membership, date).
**Source:** `resources-11.md` §30.

### BR-ATT-002 — Attendance is derived, never entered {Invariant} {Derived}

An Attendance Record is a function of schedule, time entries, leave and holidays. Where it disagrees with its inputs, the inputs win and the record is regenerated.

**Source:** `resources-11.md` §31.

### BR-ATT-003 — Attendance status precedence is fixed {Invariant} {Derived}

Evaluated in order, first match wins:

```text
1. holiday        the date is a defined non-working holiday
2. rest_day       the Schedule defines no shift for that day
3. on_leave       approved leave covers the date
4. absent         expected time exists and no work was recorded
5. half_day       worked time is materially below expected
6. late           work began after the shift start beyond tolerance
7. present        expectation met
```

**Resolves:** [`CONF-05`](#/source-audit) — adopts the `resources-11.md` §32 vocabulary.

### BR-ATT-004 — Approved leave never produces absence {Invariant} {Derived}

**Source:** `resources-11.md` §39.

### BR-ATT-005 — Break time is excluded from worked time {Invariant} {Derived}

Whether break time is *payable* depends on the Break Type's paid flag, and is a separate question from whether it is *worked*.

### BR-ATT-006 — A Break may exist without a tracking session {Invariant} {Proposed}

Breaks are anchored to a Membership and a date. Session association is optional.

**Resolves:** [`CONF-06`](#/source-audit) — a break taken with the tracker stopped must still be recordable.

---

## LEAVE · Leave

### BR-LEAVE-001 — Leave requests for one Membership never overlap {Invariant} {Derived}

### BR-LEAVE-002 — A Member cannot decide their own leave request {Invariant} {Derived}

### BR-LEAVE-003 — The decider is recorded as a Membership {Invariant} {Derived}

Because the same person may be an Employee in one Organization and an approver in another, authorization and attribution are both Membership-scoped.

**Source:** `resources-11.md` §37.

### BR-LEAVE-004 — Time tracked during approved leave is flagged, not discarded {Derived}

The system records both facts and surfaces the inconsistency for a human decision. It does not silently prefer one.

---

## TS · Timesheets and approvals

### BR-TS-001 — Only approved Timesheet time is Approved Time {Invariant} {Derived}

### BR-TS-002 — An Organization has exactly one Timesheet periodicity in effect {Invariant} {Proposed}

**Resolves:** [`CONF-08`](#/source-audit) — concurrent daily, weekly and monthly timesheets permit the same time to be approved twice.

### BR-TS-003 — A Time Entry belongs to at most one Timesheet {Invariant} {Proposed}

**Enforcement:** unique constraint on the Time Entry within timesheet entries.
**Consequence:** the structural guarantee against double payment.

### BR-TS-004 — Submitted Timesheets snapshot durations {Invariant} {Derived}

Editing an underlying Time Entry after submission never changes a submitted or approved total. The discrepancy is surfaced instead.

**Source:** `resources-12.md` §36.

### BR-TS-005 — No Member approves their own Timesheet {Invariant} {Derived}

Applies to Owners and Administrators equally. If an Organization has exactly one person, their time cannot be self-approved and payroll must proceed with that stated — [`OQ-026`](#/open-questions).

**Source:** `resources-12.md` §39.

### BR-TS-006 — Approved Timesheets are immutable except by an audited reopen {Invariant} {Derived}

Reopening is a distinct permissioned action requiring a reason. It is never an edit.

**Source:** `resources-12.md` §34.

### BR-TS-007 — Approval history is append-only {Invariant} {Derived}

No decision overwrites a previous one. The current status says where a Timesheet is; the history says how it got there.

**Source:** `resources-12.md` §38.

---

## PAY · Payroll

### BR-PAY-001 — Payroll reads Approved Time and nothing else {Invariant} {Derived}

No payroll calculation reads tracking events, tracking sessions, or unapproved time entries under any circumstance.

**Source:** `resources-12.md` §46, `resources-14.md` Rule 4.
**Why it is the most important rule in the product:** it is the only structural guarantee that unreviewed observation cannot become money.

### BR-PAY-002 — Pay Rates are effective-dated and never overwritten {Invariant} {Derived}

A rate change creates a new record. Historical payroll stays correct.

**Source:** `resources-12.md` §41.

### BR-PAY-003 — Currency belongs to the Pay Rate, and no conversion is performed {Invariant} {Derived}

An Organization's default currency does not determine a Member's compensation currency. The system never converts between currencies.

**Source:** `resources-12.md` §42.

### BR-PAY-004 — Every rounding rule applied is recorded with the output {Proposed}

Where seconds are converted to payable hours, the rule used is stated in the payroll entry and in the export.

**Fills:** `GAP-14`. The rule itself is [`OQ-012`](#/open-questions).

### BR-PAY-005 — Processed payroll is immutable except by an audited reopen, and reopening cascades {Invariant} {Derived}

A Timesheet inside a processed Payroll Period cannot be reopened until the Payroll Period is reopened first. The dependency is explicit, never silent.

### BR-PAY-006 — Adjustments carry a description {Derived}

An unexplained monetary adjustment is not acceptable even at MVP.

**Mitigates:** `GAP-20`; itemised adjustments remain {V1.1}.

### BR-PAY-007 — Monetary values use fixed-precision arithmetic {Invariant} {Derived}

No floating-point type is used for any monetary value at any point in calculation, storage or export.

**Source:** `resources-8.md` §5.

### BR-PAY-008 — Durations are stored and calculated as integer seconds {Invariant} {Derived}

**Source:** `resources-8.md` §4.

---

## REPORT · Reporting

### BR-REPORT-001 — Scope is applied before filters {Invariant} {Derived}

A report resolves the viewer's permitted scope first, then applies requested filters within it. A filter can never widen scope.

### BR-REPORT-002 — Office/remote classification is derived per session, never stored as a person's attribute {Invariant} {Derived}

**Source:** `resources-3.md` §33 — an employee may work from an office on Monday and remotely on Tuesday.

### BR-REPORT-003 — Evidence gaps are always classified {Invariant} {Proposed}

Not configured, unavailable, failed and expired are four different facts and are never rendered as one absence.

### BR-REPORT-004 — Every report totals reconcile to their underlying records exactly {Invariant} {Derived}

A rounded display is permitted; a rounded total that does not reconcile to the sum of its parts is a defect.

---

## NOTIF · Notifications

### BR-NOTIF-001 — Notifications address a Membership {Invariant} {Derived}

A person's notifications in one Organization are invisible in another.

### BR-NOTIF-002 — Some notifications cannot be disabled {Proposed}

Security events, monitoring policy changes, and decisions affecting a Member's pay are always delivered, regardless of preference.

**Rationale:** a monitoring change a Member can silently opt out of hearing about defeats the disclosure requirement.

---

## BILL · Commerce and entitlements

### BR-BILL-001 — Permission and entitlement are independent, and both must pass {Invariant} {Derived}

Neither can satisfy the other.

**Source:** `resources-13.md` §56.

### BR-BILL-002 — All entitlement decisions resolve through the entitlement service {Invariant} {Derived}

No plan-name comparison exists in request-handling code.

**Source:** `resources-13.md` §51–53.

### BR-BILL-003 — The API is the only authority on entitlement {Invariant} {Derived}

Client-side hiding is presentation. The API refuses regardless.

**Source:** `resources-13.md` §54.

### BR-BILL-004 — Seats count active Memberships {Derived}

Suspended and removed Memberships do not consume seats.

### BR-BILL-005 — Features marked future release are granted by no plan {Invariant} {Confirmed}

Open API access, SSO, client login access, automatic user provisioning, BigQuery access, HRIS integration, browser integrations, meeting insights, software cost insights, benchmarks AI and unusual activity report are entitlements of **no** plan.

**Resolves:** [`CONF-03`](#/source-audit) — `resources-13.md` §46 grants four of these to Premium in an example seed. Following it would advertise capabilities that do not exist.

### BR-BILL-006 — An Organization has at most one active Subscription {Invariant} {Derived}

Superseded Subscriptions are retained with dates, forming plan history.

**Source:** `resources-13.md` §50, §61.

### BR-BILL-007 — Payment instrument details are never stored by the platform {Invariant} {Derived}

Only an opaque provider reference is retained.

### BR-BILL-008 — Losing an entitlement never deletes data captured while it was held {Derived}

Data becomes inaccessible under the new plan and remains subject to retention. It is not destroyed by the downgrade itself.

---

## AUDIT · Auditability

### BR-AUDIT-001 — Audit records are append-only {Invariant} {Derived}

No application code path updates or deletes an audit record. Only the retention process removes them, and that removal is itself recorded.

**Source:** `resources-14.md` §54.

### BR-AUDIT-002 — Every permission-, policy- and money-relevant change is audited {Invariant} {Derived}

### BR-AUDIT-003 — Every action has an actor, including the system {Invariant} {Derived}

System-initiated actions record a null human actor and a named system action. No change is unattributed.

**Source:** `resources-14.md` §52.

### BR-AUDIT-004 — The audit record is written in the same transaction as the change {Invariant} {Proposed}

If the audit write fails, the change does not commit. An audited system with best-effort auditing is an unaudited system.

---

## DATA · Retention and deletion

### BR-DATA-001 — Data past its effective retention is deleted {Invariant} {Confirmed}

Retention is a commercial commitment (3 / 6 / 24 months by plan), a privacy obligation and a cost control simultaneously. Over-retention is a defect, not a convenience.

### BR-DATA-002 — Effective retention is the lower of entitlement and policy {Invariant} {Derived}

An Organization may configure less retention than it bought. It can never configure more.

**Source:** `resources-14.md` §62 — resolves [`CONF-13`](#/source-audit).

### BR-DATA-003 — Retention applies per data type {Derived}

Screenshots, recordings, tracking events, activity, usage and audit logs each carry their own period.

### BR-DATA-004 — Media is deleted from storage before its metadata {Invariant} {Derived}

Deleting metadata first can leave a private file that nothing references and nobody can find to delete.

**Source:** `resources-10.md` §30.

### BR-DATA-005 — Erasure never silently breaks financial integrity {Invariant} {Proposed}

Records required for payroll or approval integrity are removed only under an explicit, recorded decision that states what is being removed and why.

---

## ADMIN · Platform operations

### BR-ADMIN-001 — Vendor access to tenant business data requires audited elevation {Invariant} {Proposed}

Platform Administrators have no default access to time entries, screenshots, recordings or reports. Access requires a time-bounded, reason-recorded elevation, is logged in the Organization's own audit log, and notifies the Owner.

**Fills:** `GAP-15`.

### BR-ADMIN-002 — Platform diagnostics use metadata, not content {Invariant} {Proposed}

Sync health, queue health and failure diagnostics are built from counts, timestamps and outcomes. Routine operation never requires reading customer screen content.

---

## Rule conflicts and precedence

Where two rules could both apply, this order settles it:

```text
1. Tenancy            BR-ORG-001, BR-ORG-002
2. Auditability       BR-AUDIT-001, BR-AUDIT-003, BR-AUDIT-004
3. Financial integrity BR-PAY-001, BR-TS-003, BR-TS-006, BR-PAY-005
4. Privacy            BR-MON-008, BR-MON-009, BR-ADMIN-001
5. Data correctness   BR-TIME-001, BR-TIME-004, BR-ATT-002
6. Commercial         BR-BILL-001 to BR-BILL-008
7. Convenience        everything else
```

**Worked example.** An Administrator wants to delete an embarrassing screenshot from an approved period. Privacy (4) supports deletion; financial integrity (3) and auditability (2) rank higher. Resolution: the deletion is permitted, but the deletion event is audit-logged, the evidence gap is classified as deleted rather than expired, and the approved time is unaffected. Nothing is silently removed.

---

## Rules that are enforced structurally

These must not rely on application-layer validation alone. If any of them can be violated by a direct database write or by a code path that skips the domain layer, the enforcement is incomplete.

| Rule | Structural enforcement |
|---|---|
| `BR-ORG-001` | Organization column plus mandatory query scoping |
| `BR-ORG-003` | Unique (Organization, User) |
| `BR-AUTH-001` | Unique email |
| `BR-SYNC-001` | Unique (Organization, client event identifier) |
| `BR-ATT-001` | Unique (Organization, Membership, date) |
| `BR-TS-003` | Unique Time Entry within timesheet entries |
| `BR-PAY-007` | Fixed-precision column types |
| `BR-PAY-008` | Integer second columns |
| `BR-AUDIT-001` | No update or delete path in application code |
| `BR-USER-003` | Restrictive delete behaviour on historical relations |
