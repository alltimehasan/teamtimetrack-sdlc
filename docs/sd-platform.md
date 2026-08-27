# Jobs, Reporting & Billing

Everything that happens outside a request: the queue topology, the job catalogue, how reports stay fast without a warehouse, and how Stripe drives entitlements.

---

# Part 1 — Background processing

## 1. Queue topology `ADR-016`

Redis-backed Laravel queues with **one worker pool per job class**, supervised independently. A single shared pool means a retention sweep over ten million rows starves timesheet notifications; separating them is cheap and removes the failure mode entirely.

| Queue | Workers | Timeout | Tries | Priority |
|---|---|---|---|---|
| `sync` | 4 | 60 s | 5 | Highest — derivation blocks everything downstream |
| `media` | 3 | 120 s | 5 | High |
| `notifications` | 2 | 30 s | 3 | High |
| `billing` | 1 | 60 s | 8 | High — webhooks must not be dropped |
| `reports` | 2 | 600 s | 2 | Normal |
| `rollups` | 2 | 900 s | 2 | Normal |
| `retention` | 1 | 900 s | 3 | Low — deliberately throttled |
| `maintenance` | 1 | 1800 s | 1 | Lowest |

Backoff is exponential with jitter: `10s → 30s → 2m → 10m → 30m`. Permanently failed jobs land in `failed_jobs` and are **retained for inspection, never discarded** — [`NFR-REL-007`](#/non-functional-requirements).

`retention` and `maintenance` run under the `ttt_maintenance` database role, which holds `BYPASSRLS` and is the only code permitted to cross tenants. Every use is logged. [Tenancy & Security](#/sd-tenancy-security) §2.

---

## 2. Job catalogue

### Tracking

| Job | Trigger | Notes |
|---|---|---|
| `DeriveSession` | After batch commit, debounced 10 s per session | Advisory-locked; idempotent |
| `RecomputeAttendance` | `TimeEntriesDerived`, `LeaveDecided`, schedule or holiday change | Keyed on member + date; idempotent |
| `CloseStaleSessions` | Every 15 min | Sessions past `max_session_seconds` — [`BR-TIME-007`](#/business-rules) |
| `ReconcileDerivation` | Nightly | Re-derives sessions touched in 48 h; alerts on any difference |
| `DetectSyncBacklog` | Every 15 min | Devices past the backlog threshold → notify member and organization |

### Media

| Job | Trigger | Notes |
|---|---|---|
| `FinaliseRecording` | Session stop, or all segments accounted for | Rolls up stream and recording totals; sets `ready` or `partial` |
| `SweepOrphanedObjects` | Daily | Objects with no metadata after 48 h |
| `RecalculateStorageUsage` | Daily | Rebuilds `storage_usage_daily` from metadata |

### Workforce, timesheets, payroll

| Job | Trigger | Notes |
|---|---|---|
| `GenerateTimesheets` | Period boundary, per organization periodicity | Idempotent per member + period |
| `EscalateUnsubmittedTimesheets` | Daily | [`REQ-TS-007`](#/functional-requirements) |
| `CalculatePayroll` | Operator action | Chunked by member; advisory-locked per period; fully idempotent |
| `GeneratePayrollExport` | Operator action | Writes CSV to R2, time-limited link |

### Billing

| Job | Trigger | Notes |
|---|---|---|
| `ProcessStripeEvent` | Webhook receipt | Ordered by `provider_created_at`; idempotent on event id |
| `ReconcileSubscriptions` | Every 6 h | Compares local state with Stripe; corrects drift — [`REQ-BILL-008`](#/functional-requirements) |
| `NotifyTrialEnding` | Daily | 7, 3 and 1 day before expiry |
| `ApplyRetentionGrace` | On downgrade | Sets `deletion_eligible_at` across affected media |

### Retention and platform

| Job | Trigger | Notes |
|---|---|---|
| `SweepRetention` | Nightly, 02:00 organization time | Partition drops and media batches — [Capture & Media](#/sd-capture) §8 |
| `DeleteMediaObjects` | From the sweep, 500 per batch | **R2 first, metadata second** |
| `MaintainPartitions` | Weekly | Creates 3 months ahead; drops fully-expired partitions |
| `ExpireSupportElevations` | Every 5 min | Hard expiry backstop |
| `PruneIdempotencyKeys` | Daily | 24-hour window |
| `ExpireExports` | Daily | Removes expired export objects |

### Scheduler

```text
*/5   ExpireSupportElevations
*/15  CloseStaleSessions · DetectSyncBacklog
0 *   RefreshEntitlementCache (drift guard)
0 2   SweepRetention · ReconcileDerivation · RecalculateStorageUsage
0 3   BuildDailyRollups
0 4   SweepOrphanedObjects · PruneIdempotencyKeys · ExpireExports
0 6   NotifyTrialEnding · EscalateUnsubmittedTimesheets
0 */6 ReconcileSubscriptions
0 5 * * 0  MaintainPartitions
```

Organization-scoped jobs run against **each organization's own timezone**, so "nightly" means night for that customer.

---

# Part 2 — Reporting

## 3. Two-tier strategy

| Tier | Serves | Source |
|---|---|---|
| **Live queries** | Detail: timeline, time entries, screenshots, attendance detail, timesheets | Partitioned tables with tenant-leading composite indexes |
| **Daily rollups** | Aggregate: organization dashboards, executive dashboard, trends, work-life balance | `daily_member_stats`, `daily_project_stats`, `daily_team_stats` |

## 4. Rollups at MVP `ADR-017`

`resources-6.md` §6 argues against pre-computed aggregates until a performance need is demonstrated. That advice was written before `DEC-011` put the **Premium executive dashboard in the launch scope** and `DEC-005` defined it as organization-wide metrics across 30 days.

That query — every member, every day, a month at a time, with productivity classification applied — is not servable from raw partitions inside [`NFR-PERF-002`](#/non-functional-requirements)'s 3-second budget at the target volumes. The need is demonstrated by the scope decision, so the rollups ship with it.

```text
BuildDailyRollups            nightly, per organization, for D-1
  ├─ aggregate time_entries        → tracked, payable, by project, by task
  ├─ aggregate breaks, idle, capture_pauses
  ├─ aggregate activity_events     → mean activity percentage
  ├─ classify application/website  → productive / unproductive / neutral
  │                                  using the rule set effective on that date
  ├─ join attendance_records       → scheduled, status
  ├─ count screenshots, sum recording seconds
  ├─ derive office / remote from connectivity_events   (Premium)
  └─ UPSERT the three rollup tables

IncrementalRollupRefresh     on TimeEntriesDerived for a date < today
  └─ recompute that (member, date) only
```

Rollups are **derived and disposable** — a full rebuild is a supported operation and runs in the `rollups` queue. If a rollup and its source disagree, the source wins.

Classification uses `productivity_rules.effective_from` so changing a rule tomorrow does not silently restate last month. [`BR-MON-006`](#/business-rules).

## 5. Report definitions

| Report | Source | Grouping |
|---|---|---|
| Hours | Live | member · team · project · task · day |
| Timeline | Live | one member, one day, all layers |
| Projects / Tasks | Rollup + live drill-down | project · task · member |
| Members / Teams | Rollup | member · team · period |
| Attendance | Live | member · date · status |
| Activity & usage | Rollup + live | member · application · domain · classification |
| Screenshots | Live, cursor-paginated | member · capture group |
| Timesheets | Live | member · period · status |
| Payroll | Live | period · member |
| Office vs Remote {Premium} | Rollup | member · team · period |
| Connectivity {Premium} | Live | device · period |
| **Work-life balance** {Standard} | Rollup | member · period |
| **Executive dashboard** {Premium} | Rollup | organization |

### Work-life balance `DEC-004`

Six objective metrics. **No composite score.** `DEC-004` is explicit that a single "wellbeing score" would be misleading and potentially harmful, and the design honours that.

```text
Work outside scheduled hours        seconds tracked beyond the shift window
Weekend work                        seconds on non-working days
Average daily tracked hours         mean over working days in the period
Long work sessions                  count of sessions exceeding a threshold
Break patterns                      break frequency and mean duration against expectation
Scheduled vs tracked                ratio, with the absolute variance
```

Each is a fact with a definition attached, presented per member to that member and to their manager.

### Executive dashboard `DEC-005`

Organization-level, Premium, with `today / 7d / 30d / custom` ranges:

```text
Total tracked hours · Active members · Team utilisation
Scheduled vs tracked · Productivity trends · Attendance trends
Project time distribution · Remote vs office · Connectivity overview
```

Nine panels, all from rollups. It is a **business overview, not another surveillance screen** — `DEC-005` states this and no panel drills to an individual's screen content.

## 6. Query performance rules

1. Every report query begins its index with `organization_id` — [`NFR-SCALE-005`](#/non-functional-requirements).
2. Every query carries a bounded date range; an unbounded range is rejected.
3. Partition pruning is verified in the plan for every report touching a partitioned table.
4. `EXPLAIN` output for all thirteen reports is reviewed at `M-02` and again before `M-07`.
5. Exports never run inline — always the `reports` queue with a time-limited link.

---

# Part 3 — Billing & entitlements

## 7. Entitlement resolution

The single place any capability question is answered. [`BR-BILL-002`](#/business-rules).

```text
Organization → active Subscription → Plan → plan_features → Feature
                                                    ↓
                                        EntitlementSet (typed)
```

```php
$entitlements = app(EntitlementService::class)->for($organization);

$entitlements->allows('video_recording');          // bool
$entitlements->limit('retention_months');          // int|null
$entitlements->value('report_level');              // string|null
$entitlements->seatLimit();                        // int|null
```

| Subscription status | Entitlements |
|---|---|
| `trialing` | Full entitlements of the selected plan — `DEC-029` |
| `active` | Full |
| `past_due` | Full during the grace window, then read-and-export only |
| `canceled` | Full until `current_period_end`, then read-and-export only |
| `expired` | Read and export only; no capture, no creation |

### Caching

Redis, keyed `entitlements:{organization_id}:{subscription_updated_at}`, one-hour TTL. The key contains the subscription's version, so a plan or subscription change invalidates by construction rather than by remembering to flush. A `RefreshEntitlementCache` job runs hourly as a drift guard.

### The gate

Routes declare the feature they need; the middleware resolves and enforces it:

```php
Route::post('/recordings', …)->middleware('feature:video_recording');
```

Permission and entitlement are checked independently, and both must pass. [`BR-BILL-001`](#/business-rules). The entitlement check runs **before** the resource policy so an unentitled organization is told which plan provides the feature rather than being told the resource does not exist.

### Features granted by no plan

`api_access` · `sso` · `client_access` · `automatic_user_provisioning` · `bigquery_access` · `hris_integration` · `browser_integrations` · `meeting_insights` · `software_cost_insights` · `benchmarks_ai` · `unusual_activity_report`

These exist as `features` rows with no `plan_features` mapping, so `allows()` returns false everywhere and the plan comparison UI shows them as unavailable. [`BR-BILL-005`](#/business-rules) — this is what prevents the [`CONF-03`](#/source-audit) error from reaching a customer.

---

## 8. Stripe integration `ADR-018` `DEC-008`

### Division of responsibility

| Stripe owns | Laravel owns |
|---|---|
| Payment methods and processing | Organizations, plans, features |
| Recurring subscription billing | Subscription **state as the application sees it** |
| 30-day trials | Entitlement resolution |
| Invoices, receipts, dunning | Seats, retention, grace periods |
| Proration on plan change | Everything the product does with any of it |

Laravel is the source of truth for the application; Stripe is the source of truth for money. They are reconciled, never assumed identical.

### Adapter boundary

```text
Domain\Billing\Contracts\BillingProvider
        ▲
        │ implements
Domain\Billing\Providers\StripeBillingProvider
```

No Stripe type appears outside `Domain\Billing\Providers`. Enforced by the module rule in [Application Architecture](#/sd-architecture) §3, so a provider change is contained rather than archaeological. `DEC-008` requires exactly this.

### Checkout

```text
POST /billing/checkout-sessions
  ├─ ensure a Stripe customer exists for the organization
  ├─ create a Checkout Session: price, 30-day trial, success/cancel URLs
  ├─ metadata: organization_id, plan_id            ← how the webhook finds us
  └─ return the URL
        ↓ customer completes payment at Stripe
        ↓ checkout.session.completed webhook
        ↓ subscription created or updated locally
        ↓ entitlements refresh; Owner notified
```

The browser returning from Stripe is **never** what activates a subscription — `DEC-008` is explicit. The webhook is authoritative; the return page merely polls until local state catches up.

### Webhooks

```text
POST /api/v1/webhooks/stripe
  1  verify Stripe-Signature                → 400 on failure
  2  INSERT stripe_events (stripe_event_id) → unique violation means duplicate: 200, ignored
  3  respond 200 immediately
  4  ProcessStripeEvent on the billing queue
       ├─ skip if provider_created_at is older than the current state  (out-of-order guard)
       ├─ map to a subscription transition
       ├─ apply retention grace if retention shortened   (DEC-018)
       ├─ refresh entitlements
       └─ notify + audit
```

Handled events: `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`, `customer.updated`.

Idempotency is a **unique constraint on the Stripe event id**, not a memory of what was seen. Stripe retries; duplicates are guaranteed, not exceptional.

### Reconciliation

Every six hours `ReconcileSubscriptions` compares local subscriptions with Stripe and corrects divergence — lost webhooks are a normal operating condition, not an incident. Every correction is audit-logged. [`REQ-BILL-008`](#/functional-requirements).

---

## 9. Trials `DEC-008` `DEC-029`

| Property | Value |
|---|---|
| Length | **30 days**, every plan |
| Entitlements | **Identical to the paid plan** — no feature restrictions |
| Payment method | Not required to start |
| Notifications | 7, 3 and 1 day before expiry |
| On expiry without payment | `expired` — data retained, read and export available, capture stops |
| Plan change during trial | Entitlements change immediately; the trial end date does not move |

### Resource guard rails `OQ-029`

A 30-day Premium trial grants multi-display screen recording. At the figures in [Capture & Media](#/sd-capture) §4 an unconstrained trial can generate terabytes at no cost to the trialist.

`DEC-029` separates **feature entitlement** from **resource limits** and defers the numbers to a commercial decision. The mechanism is built and the limits are configuration:

```text
plan_features rows, type = integer, applied only while status = 'trialing'
  trial_max_storage_bytes
  trial_max_recording_hours
  trial_max_seats
```

Enforcement sits in the upload-intent endpoint, reading `storage_usage_daily`. On breach, recording stops with a clear message and time tracking continues unaffected. Until `OQ-029` sets values the limits are absent, and the exposure is monitored rather than capped — which is a knowingly accepted position, not an oversight.

---

## 10. Seats

```text
seat_count = COUNT(memberships WHERE status = 'active')
```

Checked at **invitation** and again at **acceptance** — capacity can be consumed between the two. [`BR-USER-002`](#/business-rules). A downgrade below the current seat count is refused, naming how many memberships must be removed first.

---

## 11. Downgrade `DEC-018`

```text
POST /billing/subscription/change { plan_slug, preview: true }
        ↓ returns entitlements lost, retention change, data volume affected,
          grace expiry, seats over limit                      (API §9)
        ↓ customer confirms
        ↓ Stripe subscription updated
        ↓ webhook → local subscription updated
        ↓ retention_grace_until = now + 30 days
        ↓ ApplyRetentionGrace sets deletion_eligible_at on affected media
        ↓ data stays readable, labelled "Scheduled for deletion"
        ↓ Owner warned at grace start and 7 days before expiry; export offered
        ↓ grace expires → normal retention applies
```

Nothing is deleted because a subscription changed. Deletion happens because retention expired, after a grace period, with warnings and an export path.

---

## 12. Notifications

| Property | Behaviour |
|---|---|
| Addressing | To a **Membership**, never a global user — [`BR-NOTIF-001`](#/business-rules) |
| Channels | In-app always; email per preference; real-time push where entitled |
| Delivery | Queued; never inside a request |
| Real-time | WebSocket where `realtime_notifications` is entitled; **30-second polling fallback** otherwise so nothing is lost |
| Non-optional | Security events, monitoring policy changes, and anything affecting pay are always delivered regardless of preference — [`BR-NOTIF-002`](#/business-rules) |

The catalogue is fixed and each type declares its recipient rule, default channels and mandatory flag. [`REQ-NOTIF-005`](#/functional-requirements).

---

## 13. Idempotency summary

Everything retryable, and how it stays safe.

| Operation | Mechanism |
|---|---|
| Event ingestion | `UNIQUE (organization_id, client_event_id, occurred_at)` |
| Batch submission | `UNIQUE (device_id, client_batch_id)` → acknowledgement replay |
| Client mutations | `Idempotency-Key` with a stored response, 24-hour window |
| Stripe webhooks | `UNIQUE (stripe_event_id)` |
| Session derivation | Advisory lock + full reconciliation of the derived set |
| Attendance recomputation | `UPSERT` on `(organization, membership, date)` |
| Payroll calculation | Advisory lock per period; entries replaced wholesale, prior versions superseded |
| Media upload | Deterministic server-derived key; re-request returns the same key |
| Retention deletion | Status transition then object delete; a repeat is a no-op |
| Rollup builds | `UPSERT` on the natural key |
