# API Design

One versioned REST API serves the web application, the desktop tracker and, eventually, third parties. Every client uses the same surface; none has a privileged path.

---

## 1. Conventions

| Aspect | Convention |
|---|---|
| Base path | `/api/v1` — versioned from the first release, [`NFR-MAINT-008`](#/non-functional-requirements) |
| Transport | HTTPS only; TLS 1.2+; HSTS |
| Format | JSON request and response; `application/json` |
| Errors | `application/problem+json` |
| Naming | Plural, kebab-free resource nouns: `/time-entries`, `/tracking/batches` |
| Identifiers | UUID in paths; never sequential integers |
| Timestamps | ISO 8601 with explicit offset, always `Z` — `2026-08-27T09:14:00.000Z` |
| Durations | Integer seconds, in a field named `*_seconds` |
| Money | Integer minor units plus an ISO 4217 currency, e.g. `{"amount": 178417, "currency": "USD"}` |
| Casing | `snake_case` in payloads, matching the domain vocabulary |
| Nulls | Present and `null`, never omitted |

### Why versioning matters more here than usual

Desktop trackers live on machines the vendor does not control. A member on holiday returns to a two-week-old build. Version skew is a permanent condition, not a migration window — so `/api/v1` never receives a breaking change, and the tracker declares its version on every request.

---

## 2. Authentication

| Client | Mechanism |
|---|---|
| Web application | Sanctum stateful session cookie — `HttpOnly`, `Secure`, `SameSite=Lax`, same origin |
| Desktop tracker | `Authorization: Bearer ttt_dev_<id>.<secret>` |
| Stripe webhooks | Signature verification, no session |

Both carry an implicit organization. A device token addresses exactly one Membership; a web session carries the active Membership resolved from `X-Organization-Id` where the User belongs to several.

```http
X-Organization-Id: 018f8a…      web only, required when the user has >1 membership
X-Client:          ttt-desktop/1.4.2 (windows 11)
X-Request-Id:      018f9e…      echoed in responses and logs
```

---

## 3. Error model

```json
{
  "type":   "https://docs.teamtimetrack.com/errors/entitlement-required",
  "title":  "Your plan does not include this feature",
  "status": 402,
  "code":   "entitlement_required",
  "detail": "Screen recording is available on the Premium plan.",
  "request_id": "018f9e…",
  "meta": { "feature": "video_recording", "required_plan": "premium" }
}
```

Validation failures add a field map:

```json
{
  "code": "validation_failed",
  "status": 422,
  "errors": {
    "starts_at": ["must be before ends_at"],
    "reason":    ["is required for manual entries"]
  }
}
```

The full status and code table is in [Application Architecture](#/sd-architecture) §8. The rule that matters most: **a resource in another organization returns 404, never 403.**

---

## 4. Pagination

Two strategies, chosen by data shape.

### Cursor — high-volume, time-ordered

Used for time entries, events, screenshots, activity, audit logs, notifications.

```http
GET /api/v1/screenshots?membership_id=…&from=2026-08-01&limit=50&cursor=eyJ…
```

```json
{
  "data": [ … ],
  "meta": { "next_cursor": "eyJjIjoi…", "has_more": true, "limit": 50 }
}
```

The cursor encodes the last `(timestamp, id)` pair. Stable under concurrent inserts, and it does not degrade at depth the way `OFFSET` does.

### Page — bounded administrative lists

Used for members, teams, projects, tasks, plans, invitations.

```json
{ "data": [ … ], "meta": { "page": 2, "per_page": 25, "total": 143, "last_page": 6 } }
```

**Every collection endpoint is paginated with an enforced maximum.** [`NFR-SCALE-004`](#/non-functional-requirements). `limit` above the cap is clamped, not rejected.

---

## 5. Filtering, sorting, sparse responses

```http
GET /api/v1/reports/hours
      ?from=2026-08-01&to=2026-08-31
      &team_id=018f…&project_id=018f…&membership_id=018f…
      &group_by=member,project
      &sort=-tracked_seconds
      &include=member,project
```

| Parameter | Behaviour |
|---|---|
| `from` / `to` | Inclusive dates in the organization's timezone |
| `sort` | Comma-separated; `-` prefixes descending; allowlisted per endpoint |
| `include` | Related resources to embed; allowlisted, depth 1 |
| `fields[resource]` | Sparse fieldsets on large collections |

**Scope is applied before filters.** A filter can never widen what a viewer may see. [`BR-REPORT-001`](#/business-rules).

---

## 6. Rate limiting

Per the classes in [Tenancy & Security](#/sd-tenancy-security) §9. Every response carries:

```http
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 118
X-RateLimit-Reset: 1756288500
Retry-After: 30          (429 only)
```

---

## 7. Idempotency

Three mechanisms, each for a different problem.

| Mechanism | Scope | Key |
|---|---|---|
| `Idempotency-Key` header | Any mutating client request | Caller-generated UUID, 24-hour window |
| Event and batch identifiers | Tracking ingestion | `client_event_id`, `client_batch_id` — database constraints |
| `stripe_events` | Webhooks | Stripe event id, unique |

```http
POST /api/v1/time-entries
Idempotency-Key: 018f9e2c-…
```

A repeat with the same key and the same body replays the stored response. The same key with a **different** body returns `409 idempotency_conflict` — that is a client bug and silently accepting it would create a duplicate.

---

## 8. Endpoint surface

### Authentication and account

```text
POST   /auth/register                       create user + verification email
POST   /auth/verify-email                   consume verification token
POST   /auth/login                          → session, or 401 mfa_required
POST   /auth/mfa/verify                     TOTP or recovery code
POST   /auth/logout
POST   /auth/logout-all                     all sessions + device tokens
POST   /auth/password/forgot                always 202
POST   /auth/password/reset
PUT    /auth/password                       requires current password
GET    /auth/me                             user + memberships + active org
POST   /auth/device/login                   → device token
POST   /auth/device/refresh                 rotates the token
POST   /auth/device/logout

GET    /auth/mfa                            enrolment status
POST   /auth/mfa/enroll                     → secret + otpauth URI
POST   /auth/mfa/confirm                    → recovery codes
DELETE /auth/mfa                            requires password + current code
POST   /auth/mfa/recovery-codes             regenerate
GET    /auth/sessions                       active sessions and devices
DELETE /auth/sessions/{id}
```

### Organization

```text
POST   /organizations                       create; caller becomes Owner
GET    /organizations/current
PATCH  /organizations/current
GET    /organizations/current/settings
PATCH  /organizations/current/settings
POST   /organizations/current/transfer-ownership
POST   /organizations/current/close
GET    /organizations/current/audit-logs
```

### Members, roles, invitations

```text
GET    /members                             filter: role, team, status, tracking state
GET    /members/{id}
PATCH  /members/{id}                        manager assignment, employment type
POST   /members/{id}/suspend | /reactivate
DELETE /members/{id}                        removal — never deletes history
PUT    /members/{id}/roles

GET    /invitations
POST   /invitations                         bulk; per-address results
POST   /invitations/{id}/resend
DELETE /invitations/{id}
POST   /invitations/accept                  public, token in body

GET    /roles
GET    /permissions
```

### Work

```text
GET    /teams · POST /teams · PATCH /teams/{id} · DELETE /teams/{id}
PUT    /teams/{id}/members · PUT /teams/{id}/managers

GET    /projects · POST /projects · PATCH /projects/{id} · DELETE /projects/{id}
PUT    /projects/{id}/members

GET    /tasks · POST /tasks · PATCH /tasks/{id} · DELETE /tasks/{id}
PUT    /tasks/{id}/assignees
POST   /tasks/{id}/complete | /reopen
```

### Devices and displays

```text
GET    /devices                             inventory + sync backlog
GET    /devices/{id}
PATCH  /devices/{id}                        rename
DELETE /devices/{id}                        revoke
GET    /devices/{id}/displays
POST   /devices/{id}/heartbeat              capabilities, version, backlog
```

### Tracking — the tracker's hot path

```text
GET    /tracking/bootstrap                  policy version, projects, tasks, schedule,
                                            settings, entitlements — one call at start-up
POST   /tracking/batches                    the ingestion endpoint, §3 of Tracking & Sync
GET    /tracking/sessions                   filter by member, date range
GET    /tracking/sessions/{id}
GET    /tracking/sessions/{id}/timeline     events, entries, evidence on one axis

GET    /time-entries
POST   /time-entries                        manual; reason required
PATCH  /time-entries/{id}                   edit; reason required
DELETE /time-entries/{id}                   discard; reason required
GET    /idle-periods · POST /idle-periods/{id}/resolve
GET    /breaks · POST /breaks · PATCH /breaks/{id}
```

`/tracking/bootstrap` exists so the tracker makes one call rather than seven on launch, and so the acknowledged monitoring policy arrives atomically with the configuration it describes.

### Monitoring and media

```text
POST   /media/upload-intents                → presigned PUT + storage key
GET    /screenshots                         cursor-paginated, grouped by capture instant
GET    /screenshots/{id}/url                → 15-minute signed URL
POST   /screenshots/{id}/deletion-requests
GET    /deletion-requests · POST /deletion-requests/{id}/decide

GET    /recordings · GET /recordings/{id}
GET    /recordings/{id}/streams
GET    /recordings/{id}/streams/{streamId}/segments
GET    /recording-segments/{id}/url         → per-segment signed URL

GET    /activity · GET /application-usage · GET /website-usage
GET    /productivity-rules · POST · PATCH · DELETE

GET    /capture-pauses
POST   /capture-pauses                      reason required
POST   /capture-pauses/{id}/resume

GET    /monitoring-policies                 version history
GET    /monitoring-policies/current         effective for the caller, with materiality
POST   /monitoring-policies                 publish a new version
POST   /monitoring-policies/{id}/acknowledge
```

### Workforce

```text
GET    /schedules · POST · PATCH · DELETE
PUT    /schedules/{id}/shifts
GET    /schedule-assignments · POST · PATCH
GET    /holidays · POST · DELETE

GET    /attendance                          filter: member, team, date range, status
GET    /attendance/exceptions
POST   /attendance/recompute                admin-triggered, queued

GET    /leave-types · POST · PATCH · DELETE
GET    /leave-requests · POST
POST   /leave-requests/{id}/decide
POST   /leave-requests/{id}/cancel
GET    /leave-calendar
```

### Timesheets and payroll

```text
GET    /timesheets                          filter: member, period, status
GET    /timesheets/{id}                     entries + approval history
POST   /timesheets/{id}/submit
POST   /timesheets/{id}/approve
POST   /timesheets/{id}/reject              comment required
POST   /timesheets/{id}/request-changes
POST   /timesheets/{id}/reopen              reason required
GET    /timesheets/pending-approval         anomaly-ranked queue

GET    /pay-rates · POST · PATCH            finance scope only
GET    /payroll-periods · POST
POST   /payroll-periods/{id}/calculate
GET    /payroll-periods/{id}/entries
PATCH  /payroll-entries/{id}                adjustment + note
POST   /payroll-periods/{id}/approve
POST   /payroll-periods/{id}/process
POST   /payroll-periods/{id}/reopen
POST   /payroll-periods/{id}/exports        → async export job
```

### Reporting

```text
GET    /reports/hours · /timeline · /projects · /tasks · /members · /teams
GET    /reports/attendance · /activity · /screenshots · /timesheets · /payroll
GET    /reports/office-remote               Premium
GET    /reports/connectivity                Premium
GET    /reports/work-life-balance           Standard — DEC-004
GET    /dashboards/me · /dashboards/team · /dashboards/organization
GET    /dashboards/executive                Premium — DEC-005
POST   /exports                             any report → async job
GET    /exports/{id}                        status + download URL
```

### Billing

```text
GET    /billing/plans                       public plan + feature matrix
GET    /billing/subscription
POST   /billing/checkout-sessions           → Stripe Checkout URL
POST   /billing/portal-sessions             → Stripe Billing Portal URL
POST   /billing/subscription/change         upgrade / downgrade with consequences
POST   /billing/subscription/cancel
GET    /billing/invoices
GET    /billing/entitlements                resolved entitlements for this organization
GET    /billing/seats                       usage against limit
POST   /webhooks/stripe                     signature-verified, unauthenticated
```

### Retention and platform administration

```text
GET    /retention-policies · PUT /retention-policies
GET    /retention/preview                   what a change would make eligible
POST   /data-exports/organization           Owner
POST   /data-exports/me                     any member — REQ-DATA-005
POST   /erasure-requests · POST /erasure-requests/{id}/decide

# platform surface, separate authentication
GET    /platform/organizations · GET /platform/organizations/{id}
POST   /platform/organizations/{id}/suspend | /reinstate
GET    /platform/subscriptions · PATCH /platform/subscriptions/{id}
POST   /platform/elevations                 reason + duration required
DELETE /platform/elevations/{id}
GET    /platform/health                     sync rate, queues, jobs, retention, backups
GET    /platform/plans · POST · PATCH       plan and feature catalogue
```

---

## 9. Change-affecting responses

Endpoints whose effects the caller must understand *before* confirming return a preview rather than acting.

```http
POST /api/v1/billing/subscription/change
{ "plan_slug": "basic", "preview": true }
```

```json
{
  "preview": true,
  "entitlements_lost": ["video_recording", "office_remote", "internet_connectivity",
                        "executive_dashboard"],
  "retention_change": { "from_months": 24, "to_months": 3 },
  "data_affected": {
    "screenshots": 412_880,
    "recordings_seconds": 4_182_000,
    "bytes": 1_240_000_000_000
  },
  "grace_period_days": 30,
  "deletion_eligible_at": "2026-09-26T00:00:00.000Z",
  "seats_over_limit": 0
}
```

The same shape covers retention reduction and organization closure. `DEC-018` requires the customer to see the volume affected before confirming, and this is where that happens.

---

## 10. Webhooks

### Inbound — Stripe

```text
POST /api/v1/webhooks/stripe
  1  verify Stripe-Signature against the signing secret     → 400 on failure
  2  INSERT INTO stripe_events (stripe_event_id) …          → duplicate: 200, ignored
  3  respond 200 immediately
  4  process asynchronously; out-of-order guarded by provider_created_at
```

Handled: `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`, `customer.updated`.

Responding before processing is deliberate — Stripe's retry policy punishes slow endpoints, and the event is already durably recorded.

### Outbound

None at MVP. Open API access is future release, and outbound webhooks would be part of it.

---

## 11. Deprecation policy

| Change | Treatment |
|---|---|
| Adding a field or endpoint | Non-breaking; ships any time |
| Adding an optional parameter | Non-breaking |
| Removing or renaming a field | Breaking → `/api/v2` |
| Changing a type or an enum's meaning | Breaking → `/api/v2` |
| Adding an enum value | Non-breaking; clients must tolerate unknown values |
| Tightening validation | Breaking in effect; treated as breaking |

When `/api/v2` arrives, `/api/v1` is supported for **at least 12 months** — the desktop tracker's realistic upgrade tail.

---

## 12. Documentation and contract testing

| Artefact | Source |
|---|---|
| OpenAPI 3.1 specification | Generated from route definitions, form requests and API resources |
| Contract tests | Every endpoint's response validated against the schema in CI |
| Postman / Bruno collection | Generated from the specification |
| Error catalogue | Every `code` resolvable at its `type` URL |

The specification is generated rather than written, so it cannot drift from the implementation.
