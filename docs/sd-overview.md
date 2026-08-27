# System Design Overview

**Phase:** System Design · **Version:** 1.0 · **Status:** Design baseline candidate
**Built on:** the requirements baseline plus the 33 product decisions recorded in [Decision Record — Round 1](#/answers-decisions) and [Round 2](#/answers-decisions-verify)

---

## 1. What this design covers

This is the engineering specification for Team Time Track: how the product described in [Functional Requirements](#/functional-requirements) is actually built, deployed and operated.

| Document | Answers |
|---|---|
| **Design Overview** (this page) | What the system is made of, what drives its shape, which technologies were chosen and why |
| [Application Architecture](#/sd-architecture) | How the Laravel backend is structured internally, and how a request flows through it |
| [Tenancy, Identity & Security](#/sd-tenancy-security) | How one organization's data is kept from another's, who may do what, and how it is protected |
| [Domain & Database Design](#/sd-data-model) | Every table, key, index, constraint and state machine |
| [Tracking, Sync & Derivation](#/sd-tracking) | The event protocol, offline synchronisation, and how raw events become payable time |
| [Capture & Media](#/sd-capture) | Multi-display screenshots and recording, upload, retention and deletion |
| [API Design](#/sd-api) | Conventions, authentication, errors, and the full endpoint surface |
| [Web & Desktop Clients](#/sd-clients) | Next.js application and Electron tracker internals |
| [Jobs, Reporting & Billing](#/sd-platform) | Queues, the job catalogue, reporting strategy, Stripe integration |
| [Deployment & Operations](#/sd-operations) | Environments, CI/CD, monitoring, backup, disaster recovery, runbooks |
| [Decision Records](#/sd-adr) | 24 ADRs — the reasoning behind every consequential choice |

:::warning Requirements documents lag these decisions
The 33 product decisions were made *after* the requirements baseline was written. This System Design is built on the decided position; [Functional Requirements](#/functional-requirements) and its neighbours still carry pre-decision text in places — for example `REQ-PAY-002` grants pay-rate access to Administrators, which decision `DEC-027` reverses. A reconciliation pass over the requirements set is outstanding, and where the two disagree **the decisions are authoritative**.
:::

---

## 2. Architecture drivers

Six forces shape every decision that follows. They are ordered — where two conflict, the higher one wins.

| # | Driver | Where it comes from | What it forces |
|---|---|---|---|
| 1 | **Tenant isolation must be provable** | `SC-01`, [`BR-ORG-001`](#/business-rules) | Tenant scoping in the query layer *and* row-level security in PostgreSQL; an isolation test per tenant-scoped endpoint |
| 2 | **Captured time must never be lost** | `SC-02`, `SC-03`, [`NFR-REL-002`](#/non-functional-requirements) | Client-generated identifiers, durable local queue, idempotent ingestion enforced by a database constraint |
| 3 | **Money may only come from approved time** | [`BR-PAY-001`](#/business-rules) | Payroll reads a single materialised source; no code path from tracking data to a payroll figure |
| 4 | **Monitoring must be visible and bounded** | `DEC-020`, `DEC-028`, [`BR-MON-008`](#/business-rules) | Versioned monitoring policy with acknowledgement gating; capture pauses as first-class records; retention that actually deletes |
| 5 | **Media volume is the dominant cost** | `DEC-019`, `DEC-025`, `DEC-026` | Direct-to-object-storage uploads, per-media storage accounting, partition-based retention |
| 6 | **One server today, not forever** | `DEC-007` | Every dependency addressed by configuration; no component may assume co-location |

---

## 3. System context

```text
                          ┌──────────────────────────┐
                          │        Cloudflare        │
                          │   DNS · CDN · WAF · TLS  │
                          └────────────┬─────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        ▼                              ▼                              ▼
┌───────────────┐            ┌───────────────────┐           ┌────────────────┐
│  Employee     │            │  Manager / Admin  │           │  Owner         │
│  Desktop      │            │  Finance          │           │                │
│  Tracker      │            │  Web Application  │           │  Billing       │
└───────┬───────┘            └─────────┬─────────┘           └───────┬────────┘
        │  HTTPS                       │  HTTPS                      │
        │  device token                │  session cookie             │
        └──────────────┬───────────────┴─────────────────────────────┘
                       ▼
             ┌───────────────────┐
             │   Team Time Track │
             │   Laravel API     │
             └─────────┬─────────┘
                       │
   ┌───────────────────┼────────────────────┬──────────────────┐
   ▼                   ▼                    ▼                  ▼
PostgreSQL          Redis            Cloudflare R2          Stripe
source of truth   cache · queue     screenshots           subscriptions
                  rate limit        recordings            invoices
                                    exports               webhooks
                       │
                       ▼
              Transactional email
              (provider undecided — OQ-010)
```

**Direct-to-storage principle.** Screenshot and recording bytes never traverse the API. The client requests a short-lived upload authorisation, uploads to R2, then submits metadata. `ADR-009`.

---

## 4. Container view

```text
┌────────────────────────────────────────────────────────────────────────┐
│                            Hostinger VPS · Ubuntu                      │
│                                                                        │
│   ┌──────────┐                                                         │
│   │  Nginx   │  TLS termination · static · reverse proxy               │
│   └────┬─────┘                                                         │
│        ├──────────────────────┬─────────────────────────────┐          │
│        ▼                      ▼                             ▼          │
│  ┌───────────┐        ┌──────────────┐             ┌────────────────┐  │
│  │ Next.js   │        │  PHP-FPM     │             │  Supervisor    │  │
│  │ standalone│        │  Laravel API │             │  ┌───────────┐ │  │
│  │ :3000     │        │  :9000       │             │  │ sync      │ │  │
│  └───────────┘        └──────┬───────┘             │  │ media     │ │  │
│                              │                     │  │ reports   │ │  │
│                              │                     │  │ notify    │ │  │
│                              │                     │  │ billing   │ │  │
│                              │                     │  │ retention │ │  │
│                              │                     │  │ scheduler │ │  │
│                              │                     │  └───────────┘ │  │
│                              │                     └────────┬───────┘  │
│                              └──────────┬───────────────────┘          │
│                                         ▼                              │
│                      ┌──────────────┐        ┌──────────┐              │
│                      │  PostgreSQL  │        │  Redis   │              │
│                      │  16          │        │  7       │              │
│                      └──────────────┘        └──────────┘              │
└────────────────────────────────────────────────────────────────────────┘
```

Every arrow crossing a container boundary is configured by environment variable and resolved by hostname. Moving PostgreSQL, Redis or the workers to separate hosts is a configuration change, never a code change — `DEC-007`, `ADR-021`.

---

## 5. Technology decisions

| Layer | Choice | Rationale | ADR |
|---|---|---|---|
| API | **Laravel 11 (PHP 8.3)** modular monolith | Single deployable, strong ecosystem for queues, scheduling, policies; module boundaries enforced in CI rather than by network calls | `ADR-001` |
| Web client | **Next.js 15** (App Router), standalone output | Server-rendered shell, client interactivity where needed; same-origin with the API so cookie auth needs no token handling | `ADR-014` |
| Desktop client | **Electron** | Only realistic route to one capture codebase across Windows, macOS and Linux with screen, input-idle and display APIs | `ADR-015` |
| Database | **PostgreSQL 16** | Declarative partitioning, `TIMESTAMPTZ`, `JSONB`, row-level security, generated columns — all four are load-bearing here | `ADR-003` |
| Cache / queue | **Redis 7** | Queue backend, entitlement and policy cache, rate limiting, presence. Never a source of truth | `ADR-004` |
| Object storage | **Cloudflare R2** | S3-compatible, no egress fees — material when serving screenshot galleries and recording playback | `ADR-009` |
| Billing | **Stripe** | `DEC-008`. Checkout, subscriptions, 30-day trials, invoices, dunning | `ADR-018` |
| Recording format | **WebM (VP8/VP9 + Opus)** | `DEC-031`. What Electron's `MediaRecorder` reliably produces; MP4 becomes a derived representation if export demands it | `ADR-013` |
| Web server | **Nginx** | TLS, static assets, reverse proxy to PHP-FPM and Next.js | — |
| Process supervision | **Supervisor** | Queue workers and the scheduler, one program group per queue class | `ADR-016` |
| Containers | **None at launch** | `resources-2.md` §17; revisited when the system leaves one host | `ADR-021` |

### Deliberately not used at launch

Kubernetes · microservices · Kafka · Elasticsearch · BigQuery · a transcoding cluster · a separate reporting database. Each has a defined introduction trigger in [Deployment & Operations](#/sd-operations) §9 rather than an open-ended "later".

---

## 6. Capacity basis

From `DEC-007` — **engineering capacity targets, not an SLA**.

| Dimension | Launch target |
|---|---|
| Organizations | 500 |
| Memberships | 10,000 |
| Concurrently tracking devices | 2,000 |
| Availability | 99.5% monthly |

### Derived load

The tracker batches, so concurrent devices do not translate into concurrent requests.

| Flow | Cadence per device | Requests/s at 2,000 devices |
|---|---|---|
| Event batch submission | every 30 s | ~67 |
| Screenshot upload authorisation | 6/hour × up to 4 displays | ~13 |
| Recording segment registration | 1 per 60 s per display | ~33 (Premium only) |
| Policy / heartbeat poll | every 5 min | ~7 |
| **Total sustained write path** | | **~120 req/s** |

Web application traffic is additive but small by comparison. The design target is **250 req/s sustained with headroom to 500**, which a single well-tuned PHP-FPM pool handles comfortably.

### Derived storage

The dominant term, using `DEC-025` and `DEC-026` (4 displays max, native screenshots, 1080p/10 fps video):

| Media | Per member per 8h day | Notes |
|---|---|---|
| Screenshots, 2 displays native | ~70 MB | 48 captures/display/day, mixed 1080p–4K JPEG |
| Screenshots, 4 displays native | ~140 MB | |
| Recording, 2 displays @1080p/10fps | ~2.6 GB | ~0.75 Mbps/stream VP9 |
| Recording, 4 displays @1080p/10fps | ~5.2 GB | |

:::warning Recording retention is the open cost exposure
`DEC-026` keeps recordings on the shared `retention_months` entitlement, so Premium video is held for 24 months. At two displays that is roughly **550 GB per member per year retained for two years**. The 1080p/10 fps caps cut this by an order of magnitude against native 4K/30 fps, which was the right call — but the residual is still the single largest cost line in the system. [`REQ-DATA-006`](#/functional-requirements) storage accounting is the early-warning mechanism; see [`RISK-018`](#/risks).
:::

---

## 7. Design principles

Applied throughout, and each one is testable.

1. **The database enforces what correctness depends on.** Idempotency, tenancy, non-overlap and uniqueness are constraints, not conventions. Application checks are for good error messages.
2. **Derived data is recomputable and never authoritative.** Time entries, attendance and rollups can be rebuilt from their inputs at any time and must produce identical output.
3. **Everything that can be retried is idempotent.** Ingestion, uploads, webhooks, derivation, notifications, payroll calculation.
4. **Bytes and metadata travel separately.** Media goes client → R2 directly; the API handles authorisation and metadata only.
5. **Nothing large happens in a request.** Derivation, aggregation, exports, payroll, retention and notification all run on queues.
6. **Every capability boundary resolves in one place.** Permissions through the policy layer, entitlements through the entitlement service. No plan-name comparisons anywhere else.
7. **Degrade, never fail silently.** A denied OS permission, an unreachable API or a failed upload produces a visible, recorded, classified gap.

---

## 8. Cross-cutting mechanisms

| Concern | Mechanism | Detail |
|---|---|---|
| Tenancy | Request-scoped tenant context + global query scope + PostgreSQL RLS | [Tenancy & Security](#/sd-tenancy-security) §2 |
| Authorization | Laravel policies keyed on Membership, plus scope resolution for Managers | §4 there |
| Entitlements | `EntitlementService`, Redis-cached, invalidated on subscription change | [Jobs, Reporting & Billing](#/sd-platform) §6 |
| Auditing | Domain events → audit writer in the same transaction as the change | [Application Architecture](#/sd-architecture) §6 |
| Idempotency | `client_event_id` for tracking, `Idempotency-Key` for mutating client calls, `stripe_events` for webhooks | [Tracking](#/sd-tracking) §3, [API](#/sd-api) §7 |
| Time | `TIMESTAMPTZ` everywhere, UTC storage, schedule-timezone calendar maths | [Data Model](#/sd-data-model) §3 |
| Media access | Private buckets, per-request signed URLs ≤ 15 minutes | [Capture & Media](#/sd-capture) §7 |
| Observability | Structured logs with correlation and tenant ids, metrics endpoint, alert rules | [Operations](#/sd-operations) §6 |

---

## 9. ADR index

Full records in [Decision Records](#/sd-adr).

| ADR | Decision |
|---|---|
| `ADR-001` | Modular monolith over microservices |
| `ADR-002` | Shared schema multi-tenancy with `organization_id` |
| `ADR-003` | PostgreSQL 16 as the single source of truth |
| `ADR-004` | Redis for cache, queue and rate limiting only |
| `ADR-005` | **Row-level security as a second isolation layer at MVP** |
| `ADR-006` | UUIDv7 primary keys, client-generated where offline creation is needed |
| `ADR-007` | **Monthly range partitioning of high-volume tables from day one** |
| `ADR-008` | Event-sourced tracking with server-side derivation |
| `ADR-009` | Direct-to-R2 media transfer with presigned authorisation |
| `ADR-010` | `device_displays` as a first-class entity |
| `ADR-011` | `recording_streams` between recordings and segments |
| `ADR-012` | Capture pause as a record, not a state flag |
| `ADR-013` | WebM as the source recording format |
| `ADR-014` | Next.js on the same origin with Sanctum cookie sessions |
| `ADR-015` | Electron with a hidden capture renderer per display |
| `ADR-016` | Dedicated queue workers per job class |
| `ADR-017` | **Daily rollup tables at MVP for the executive dashboard** |
| `ADR-018` | Stripe behind a billing adapter |
| `ADR-019` | Versioned monitoring policy with acknowledgement gating |
| `ADR-020` | Retention grace via `deletion_eligible_at` |
| `ADR-021` | Single host, zero co-location assumptions |
| `ADR-022` | Atomic release deployment with symlink switch |
| `ADR-023` | TOTP multi-factor authentication at MVP |
| `ADR-024` | SQLite with WAL as the tracker's local store |

Three of these depart from the source research and are argued explicitly: `ADR-005`, `ADR-007` and `ADR-017`.

---

## 10. What this design does not decide

| Open | Owner | Blocks |
|---|---|---|
| Commercial pricing (`OQ-007`) | Commercial | Plan seed data only |
| Transactional email provider (`OQ-010`) | Operations | An interface is defined; the provider is swappable |
| Target jurisdictions and legal review (`OQ-014`) | Product / Legal | Data residency, and whether recording is sellable in a given market |
| Team and schedule (`OQ-021`) | Project management | Sequencing exists; dates do not |
| Trial resource limits (`OQ-029`) | Commercial | The enforcement point is designed; the numbers are not set |

The design accommodates each without rework: providers sit behind interfaces, residency is a deployment variable, and trial limits are an entitlement row.
