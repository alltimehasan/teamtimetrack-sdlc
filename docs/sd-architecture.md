# Application Architecture

How the Laravel backend is organised internally, how a request flows through it, and how the module boundaries are kept honest.

---

## 1. Shape

A **modular monolith**: one deployable artefact, internally divided into bounded domain modules with enforced dependency rules. `ADR-001`.

The reasoning is not sentiment about simplicity. This system has three properties that make distributed services actively harmful at this stage:

- **Transactional coupling.** An audit record must commit in the same transaction as the change it describes ([`BR-AUDIT-004`](#/business-rules)). A timesheet approval, its approval record and its audit entry are one atomic act. Splitting these across services turns invariants into eventual-consistency problems for no benefit.
- **One tenant boundary.** Every module scopes to the same `organization_id`. There is no natural service seam that does not cut across it.
- **A single team.** Service boundaries cost coordination that a team of this size cannot yet repay.

What is preserved is the *option*: modules communicate through published interfaces and domain events, so extracting one later is refactoring, not archaeology.

---

## 2. Directory layout

```text
app/
├── Domain/                     business logic — no HTTP, no framework routing
│   ├── Identity/               users, credentials, MFA, sessions, devices
│   ├── Organizations/          organizations, settings, memberships, invitations
│   ├── Access/                 roles, permissions, scope resolution
│   ├── Work/                   teams, projects, tasks
│   ├── Tracking/               sessions, events, time entries, idle, derivation
│   ├── Sync/                   batch ingestion, ledger, quarantine
│   ├── Monitoring/             screenshots, activity, app/web usage, pauses, policy
│   ├── Recording/              recordings, streams, segments
│   ├── Workforce/              schedules, shifts, attendance, breaks, leave, holidays
│   ├── Timesheets/             timesheets, approvals
│   ├── Payroll/                pay rates, periods, entries, rounding
│   ├── Reporting/              report queries, rollups, dashboards
│   ├── Billing/                plans, features, entitlements, subscriptions, Stripe
│   ├── Notifications/          catalogue, dispatch, preferences
│   ├── Retention/              policies, grace, expiry, deletion
│   ├── Audit/                  audit writer, queries
│   └── Platform/               platform admin, support elevation, health
│
├── Http/
│   ├── Controllers/Api/V1/     thin — validate, delegate, present
│   ├── Middleware/             tenant context, entitlement gate, idempotency, RLS
│   ├── Requests/               form requests, one per action
│   └── Resources/              API resource transformers
│
├── Jobs/                       queued work, one per unit, thin wrappers over services
├── Console/                    scheduled commands
├── Policies/                   authorization, one per aggregate
├── Events/ · Listeners/        domain events and their subscribers
├── Providers/
└── Support/                    shared primitives: Duration, Money, TenantContext
```

Each `Domain/<Module>` follows the same internal shape:

```text
Domain/Tracking/
├── Models/                     Eloquent models
├── Services/                   orchestration, transaction boundaries
├── Actions/                    single-purpose use cases
├── Queries/                    read models and report queries
├── Events/                     domain events this module publishes
├── Enums/                      PHP backed enums mirroring DB check constraints
├── Exceptions/
└── Contracts/                  interfaces other modules may depend on
```

---

## 3. Dependency rules

Modules sit in the layers defined in [Product Modules](#/product-modules). **A module may depend only on modules in a lower layer, and only through `Contracts/`.**

```text
L5  Platform    Notifications · Billing · Audit · Retention · Platform
L4  Business    Timesheets · Payroll · Reporting
L3  Workforce   Workforce
L2  Capture     Tracking · Sync · Monitoring · Recording
L1  Foundation  Identity · Organizations · Access · Work
```

### Enforcement

A static analysis rule runs in CI and fails the build on violation:

| Rule | Check |
|---|---|
| No upward dependency | `Domain/Tracking` may not reference `Domain/Payroll` |
| No sideways internals | A module may reference another module's `Contracts/`, `Models/` and `Enums/`, never its `Services/` or `Actions/` |
| No framework in domain | `Domain/**` may not reference `Illuminate\Http` |
| No plan-name comparison | No string literal `'premium'`, `'standard'`, `'basic'` outside `Domain/Billing` — [`BR-BILL-002`](#/business-rules) |
| No unscoped tenant query | Tenant-scoped models may not be queried with `withoutGlobalScopes()` outside an allowlist |

The last two exist because they are the two failure modes that are cheap to introduce and expensive to find.

### Where cross-layer needs are resolved

Payroll needs approved time; Tracking must not know Payroll exists. The dependency points downward: `Payroll` depends on `Timesheets\Contracts\ApprovedTimeReader`. Where a lower layer must trigger higher-layer behaviour it publishes a domain event and does not care who listens.

```text
Tracking  ──publishes──▶  TimeEntriesDerived
                                │
                    ┌───────────┴────────────┐
                    ▼                        ▼
              Workforce                  Reporting
        (recompute attendance)      (invalidate rollups)
```

---

## 4. Request lifecycle

Every authenticated API request passes the same pipeline, in this order. The order is significant.

```text
 1  TrustProxies                  real client IP behind Cloudflare
 2  HandleCors
 3  RateLimit:<class>             per route class, by IP and by identity
 4  Authenticate                  session cookie (web) or device token (desktop)
 5  EnsureMfaSatisfied            if the role or org policy requires it
 6  ResolveTenantContext          organization from membership; binds TenantContext
 7  SetDatabaseTenantGuc          SET LOCAL app.organization_id — drives RLS
 8  EnsureOrganizationActive      rejects suspended / closed organizations
 9  EnsureSubscriptionUsable      rejects expired beyond grace
10  EnsureFeature:<code>          entitlement gate, route-declared
11  Idempotency                   replays stored response for a repeated key
12  Authorize                     policy check on the target resource
13  Controller                    validate → action/service → resource
14  AuditFlush                    domain events → audit records, same transaction
```

**6 and 7 together are the tenant boundary.** 6 makes application scoping possible; 7 makes it enforceable even when application scoping is forgotten. Neither alone is sufficient — see [Tenancy & Security](#/sd-tenancy-security) §2.

**10 before 12** is deliberate: entitlement failures must not leak whether a resource exists. An unentitled organization gets "your plan does not include this", never "not found for that id".

---

## 5. Transaction boundaries

The transaction boundary is the **Action**, not the controller and not the model.

```php
final class ApproveTimesheet
{
    public function execute(Timesheet $timesheet, Membership $reviewer, ?string $comment): Timesheet
    {
        return DB::transaction(function () use ($timesheet, $reviewer, $comment) {
            $timesheet->transitionTo(TimesheetStatus::Approved);

            $approval = TimesheetApproval::record(
                timesheet:  $timesheet,
                reviewer:   $reviewer,
                action:     ApprovalAction::Approved,
                comment:    $comment,
                selfApproved: $reviewer->is($timesheet->membership),
            );

            AuditLog::write($reviewer, 'timesheet.approved', $timesheet, $before, $after);

            event(new TimesheetApproved($timesheet, $approval));

            return $timesheet;
        });
    }
}
```

Three rules govern this:

1. **No queued job is dispatched inside an open transaction** unless dispatched `afterCommit`. A worker that starts before commit reads stale state.
2. **No external call inside a transaction.** Stripe, R2 and email are all outside. Where an external effect must accompany a state change, the state change commits first and the effect is queued.
3. **Audit writes participate in the transaction.** If the audit write fails, the change does not commit — [`BR-AUDIT-004`](#/business-rules).

---

## 6. Auditing

Auditing is a subscriber, not a scattered concern.

```text
Action ──▶ DomainEvent ──▶ AuditSubscriber ──▶ audit_logs
                                                 (same transaction)
```

`AuditSubscriber` maps each auditable domain event to an action string, entity reference, and before/after value sets. The event carries the values; the subscriber does not re-query.

**System-initiated actions** (retention deletion, billing reconciliation, scheduled derivation) write with `actor_membership_id = NULL` and a namespaced action such as `retention.screenshots.deleted` — [`BR-AUDIT-003`](#/business-rules).

Coverage is verified, not assumed: a test asserts that every action listed in [`REQ-AUDIT-002`](#/functional-requirements) produces exactly one audit record.

---

## 7. State machines

Statuses are never assigned directly. Each aggregate with a lifecycle exposes `transitionTo()`, which validates the transition against an explicit map and throws otherwise. The database carries a matching `CHECK` constraint on the value set, and a PHP backed enum mirrors it.

```text
PHP enum  ──▶  domain transition map  ──▶  DB check constraint
   type            legal moves               legal values
```

Three layers, three different failure modes caught. The transition maps themselves are in [Domain & Database Design](#/sd-data-model) §9.

---

## 8. Error model

A single problem-shaped response, produced by one exception handler. Domain exceptions carry a stable machine code; the handler maps them to status codes.

```json
{
  "type":   "https://docs.teamtimetrack.com/errors/entitlement-required",
  "title":  "Your plan does not include this feature",
  "status": 402,
  "code":   "entitlement_required",
  "detail": "Screen recording is available on the Premium plan.",
  "meta":   { "feature": "video_recording", "required_plan": "premium" }
}
```

| Condition | Status | Code |
|---|---|---|
| Unauthenticated | 401 | `unauthenticated` |
| MFA required but not satisfied | 401 | `mfa_required` |
| Permission denied | 403 | `forbidden` |
| Entitlement missing | 402 | `entitlement_required` |
| Wrong tenant, or absent | 404 | `not_found` |
| Validation failure | 422 | `validation_failed` |
| Invalid state transition | 409 | `invalid_transition` |
| Idempotency key reused with a different body | 409 | `idempotency_conflict` |
| Rate limited | 429 | `rate_limited` |
| Seat or plan limit reached | 409 | `limit_reached` |

**Wrong tenant returns 404, never 403** — a 403 confirms the resource exists. [`BR-ORG-001`](#/business-rules).

---

## 9. Configuration and secrets

| Item | Where |
|---|---|
| Environment configuration | `.env` on the host, not in the repository |
| Application key, database, Redis, R2, Stripe, mail credentials | `.env`, readable only by the deploy user and `www-data` |
| Stripe webhook signing secret | `.env`, verified on every webhook |
| Feature and plan composition | **Database**, not configuration — changeable without deployment ([`NFR-MAINT-009`](#/non-functional-requirements)) |
| Retention defaults, screenshot interval floor, pause limit | Configuration with database override per organization |

Every secret is rotatable without a code change. Nothing referencing a host, port or bucket is hard-coded — `ADR-021`.

---

## 10. Testing architecture

| Layer | Scope | Gate |
|---|---|---|
| **Tenant isolation** | Every tenant-scoped endpoint, called with a foreign organization's identifiers | Blocks the build. A new tenant-scoped route without a matching test fails CI |
| **Entitlement matrix** | Every gated endpoint × Basic / Standard / Premium | Blocks the build |
| Domain unit | Actions and services with a fake repository | — |
| Derivation property tests | Random event sequences replayed in shuffled order and duplicated; asserts identical output | Blocks the build |
| Payroll golden dataset | Fixed inputs → expected output checked to the minor unit, including a mid-period rate change | Blocks the build |
| Time and calendar matrix | Three timezones × DST both directions × overnight shift | Blocks the build |
| API contract | Response shape per endpoint against the published schema | — |
| Retention | Seeded expired data across every data type, plus a grace period | Blocks the build |

The five gating suites correspond exactly to the launch criteria `SC-01` to `SC-06` and `SC-09` in [Project Planning](#/project-planning).

---

## 11. Module inventory

| Module | Primary aggregates | Publishes | Consumes |
|---|---|---|---|
| Identity | User, Credential, MfaFactor, DeviceToken | `UserAuthenticated`, `MfaEnrolled` | — |
| Organizations | Organization, OrganizationSettings, Membership, Invitation | `MembershipCreated`, `SettingsChanged` | Identity |
| Access | Role, Permission, MembershipRole | `RolesChanged` | Organizations |
| Work | Team, Project, Task | `ProjectArchived` | Organizations, Access |
| Tracking | TrackingSession, TrackingEvent, TimeEntry, IdlePeriod | `TimeEntriesDerived`, `SessionClosed` | Work, Organizations |
| Sync | SyncBatch, QuarantinedBatch | `BatchIngested` | Tracking |
| Monitoring | Screenshot, ActivityEvent, ApplicationUsage, WebsiteUsage, CapturePause, MonitoringPolicy | `PolicyPublished`, `CapturePaused` | Tracking, Billing |
| Recording | Recording, RecordingStream, RecordingSegment | `RecordingReady` | Tracking, Billing |
| Workforce | Schedule, Shift, ScheduleAssignment, AttendanceRecord, Break, LeaveRequest, Holiday | `AttendanceRecomputed`, `LeaveDecided` | Tracking |
| Timesheets | Timesheet, TimesheetEntry, TimesheetApproval | `TimesheetApproved`, `TimesheetReopened` | Tracking, Access |
| Payroll | PayRate, PayrollPeriod, PayrollEntry | `PayrollProcessed` | Timesheets |
| Reporting | rollup tables, report queries | — | everything below L4 |
| Billing | Plan, Feature, Subscription, StripeEvent | `SubscriptionChanged`, `EntitlementsChanged` | Organizations |
| Notifications | Notification, NotificationPreference | — | all |
| Retention | RetentionPolicy, deletion pipeline | `DataDeleted` | Billing, Monitoring, Recording, Tracking |
| Audit | AuditLog | — | all (as subscriber) |
| Platform | SupportElevation, health readers | `ElevationGranted` | Organizations, Billing, Audit |
