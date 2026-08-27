# Architecture Decision Records

Twenty-four decisions, each with the context that forced it, what was chosen, what was rejected, and what it costs. An ADR is never edited once accepted — it is superseded by a later one.

**Status vocabulary:** `{Decided}` accepted and in force · `{Proposed}` awaiting review · `{Superseded}` replaced by a later record.

Three records depart from the source research and say so explicitly: `ADR-005`, `ADR-007`, `ADR-017`.

---

## ADR-001 — Modular monolith over microservices
{Decided}

**Context.** Twenty-two functional modules, ~70 tables, three client surfaces, one team of unknown size, and an availability target of 99.5% on a single host.

**Decision.** One deployable Laravel application, internally divided into bounded domain modules with dependency rules enforced in CI.

**Why not services.** Three properties make distribution actively harmful here. Audit records must commit in the same transaction as the change they describe ([`BR-AUDIT-004`](#/business-rules)) — splitting that turns an invariant into an eventual-consistency problem. Every module scopes to the same `organization_id`, so there is no seam that does not cut across the tenant boundary. And service boundaries cost coordination the team cannot yet repay.

**Consequences.** Module boundaries depend on discipline, so they are enforced by static analysis rather than by network calls. Scaling is vertical until the triggers in [Operations](#/sd-operations) §9. Extraction later is refactoring, because modules already communicate through published contracts and domain events.

---

## ADR-002 — Shared schema multi-tenancy with `organization_id`
{Decided}

**Context.** 500 organizations at launch, most of them small. Schema-per-tenant would mean 500 schemas and 500× the migration surface; database-per-tenant is untenable on one host.

**Decision.** One schema. Every tenant-owned table carries `organization_id`, leading every composite index.

**Rejected.** Schema-per-tenant (migration cost, connection overhead); database-per-tenant (impossible at this scale on this infrastructure).

**Consequences.** Isolation becomes a correctness property of the application rather than a property of the infrastructure — which is why `ADR-005` exists. Cross-tenant reporting for platform operations is trivial. Restoring a single tenant is not, and needs a documented extract-and-import procedure rather than a database restore.

---

## ADR-003 — PostgreSQL 16 as the single source of truth
{Decided}

**Context.** Hundreds of millions of event rows, monetary calculation, timezone-heavy scheduling, and a hard requirement that tenant isolation be provable.

**Decision.** PostgreSQL 16. Redis is never authoritative; R2 holds bytes, not facts.

**Why 16 specifically.** Four features are load-bearing: declarative partitioning (`ADR-007`), row-level security (`ADR-005`), `TIMESTAMPTZ` with a maintained timezone database, and exclusion constraints via `btree_gist` — which is what makes overlapping time entries structurally impossible rather than merely discouraged.

**Consequences.** The version floor is real, not aspirational. Operational competence in PostgreSQL becomes a requirement for the team.

---

## ADR-004 — Redis for cache, queue and rate limiting only
{Decided}

**Decision.** Redis backs queues, entitlement and policy caches, rate limiters and presence. It never holds a fact that cannot be rebuilt.

**Consequences.** Redis loss costs queued jobs and cache warmth, never data. Configured `noeviction` on the queue database — evicting a queued job would silently lose work — and `volatile-lru` on a separate cache database, where eviction is correct.

---

## ADR-005 — Row-level security as a second isolation layer, at MVP
{Decided} · **departs from the source research**

**Context.** Cross-tenant access is the only failure that could end the product in one incident. `SC-01` makes provable isolation a launch gate. `resources-2.md` §2 places row-level security in a later phase.

**Decision.** Enable RLS with `FORCE` on every tenant-owned table from the first migration. The application connects as a role without `BYPASSRLS`; middleware sets `app.organization_id` per request transaction.

**Why now rather than later.** The cost today is one migration and a connection-role change. The cost later is auditing every query written in the meantime and hoping none was missed. A single forgotten `WHERE` clause returns nothing instead of another tenant's screenshots.

**Rejected.** Application scoping alone — one mechanism, and the mechanism most likely to be bypassed by a query written in a hurry.

**Consequences.** Background jobs that legitimately span tenants need the separate `ttt_maintenance` role, and their use of it is logged. Migrations run under an elevated role. A small per-query overhead from the policy predicate, measured and accepted. Connection poolers must preserve transaction affinity — noted for the day pgbouncer appears.

---

## ADR-006 — UUIDv7 primary keys, client-generated where offline creation is required
{Decided}

**Context.** The tracker creates sessions and events with no network. Sequential integers expose tenant volume through the API.

**Decision.** UUIDv7 everywhere. Join tables use composite keys of their two foreign keys. The **client generates `session_id`, `client_event_id` and `client_batch_id`**.

**Why v7 rather than v4.** Time-ordered prefixes give index locality close to a sequence, without the write amplification random UUIDs cause in B-trees at these volumes.

**Consequences.** Client-generated session ids are what let a session start offline and be materialised by whichever of its events arrives first — including when `session_started` is the delayed one. 16 bytes rather than 8 per key, accepted.

---

## ADR-007 — Monthly range partitioning of high-volume tables from day one
{Decided} · **departs from the source research**

**Context.** Retention is a commercial commitment (3/6/24 months) and a launch gate. `resources-10.md` §32 recommends plain tables at MVP, partitioning later.

**Decision.** Eight tables — `tracking_events`, `activity_events`, `application_usage`, `website_usage`, `screenshots`, `recording_segments`, `connectivity_events`, `audit_logs` — are range-partitioned by month from the first migration.

**Why the research position was wrong here.** It optimises for schema simplicity and ignores what retention actually costs. Deleting hundreds of millions of expired rows with `DELETE` produces long transactions, table and index bloat, and sustained autovacuum pressure — on a single host with no read replica. `DROP TABLE tracking_events_2026_08` is instant and returns the space immediately. Adding partitioning to a populated 500-million-row table later is a migration nobody wants to run.

**Consequences.** Unique indexes must include the partition key, so tracking idempotency becomes `UNIQUE (organization_id, client_event_id, occurred_at)`. This is equally strong in practice — both values are generated together on the device and are immutable in the local store — and the residual case is detected by a nightly reconciliation query. Partition maintenance is a scheduled job, never a deployment step. Queries must carry a date range for pruning, which every report already does.

---

## ADR-008 — Event-sourced tracking with server-side derivation
{Decided}

**Context.** Time must survive offline periods, crashes, project switches, idle resolution and later correction — and must remain defensible in a pay dispute.

**Decision.** Devices emit immutable events. The server derives Time Entries as a pure, idempotent function of a session's events. Corrections change entries; events are never modified.

**Rejected.** Client-submitted start/end pairs — no evidence trail, no crash recovery, no way to re-derive after a bug fix.

**Consequences.** Derivation must be genuinely idempotent, verified by property tests over shuffled and duplicated event sequences. Late-arriving events are safe by construction — except against approved timesheets, where the snapshot is protected and the discrepancy is surfaced instead ([`BR-TS-004`](#/business-rules)). Event volume is the largest table in the system, which is why `ADR-007` exists.

---

## ADR-009 — Direct-to-R2 media transfer with presigned authorisation
{Decided}

**Context.** Up to 5.2 GB of recording per member per day, plus native-resolution screenshots across four displays.

**Decision.** Clients request a short-lived, single-object upload authorisation, upload directly to R2, then submit metadata in the next event batch. Bytes never pass through the API.

**Consequences.** The API stays small and stateless. Object keys are derived server-side and deterministically, so a client cannot choose where it writes. Uploaded-but-unregistered objects are possible, and a 48-hour orphan sweep exists for exactly that. R2's zero egress is what makes screenshot galleries and recording playback affordable.

---

## ADR-010 — `device_displays` as a first-class entity
{Decided} · implements `DEC-032`

**Context.** `DEC-019` requires simultaneous per-display capture. Display index is unusable as identity — unplugging one monitor renumbers the rest.

**Decision.** A `device_displays` table keyed on `(device_id, display_key)`, where `display_key` derives from EDID identifiers where available, a persistent OS identifier next, and a synthetic geometry hash as fallback. Screenshots and recording streams reference it.

**Consequences.** A member docking and undocking daily produces stable display identity. Geometry, scale factor and rotation are tracked as mutable attributes. The four-display cap (`DEC-025`) is enforced here, with the excluded display surfaced rather than silently dropped.

---

## ADR-011 — `recording_streams` between recordings and segments
{Decided}

**Context.** `DEC-019` requires one independent recording stream per display, sharing a common timeline for synchronised playback. The original two-level model cannot express that.

**Decision.** Three levels: `recordings` (one per session) → `recording_streams` (one per display) → `recording_segments`. Segments carry both absolute `started_at` and `offset_ms` from the recording origin.

**Consequences.** Streams fail and finalise independently — a disconnected monitor ends its stream without affecting the others, and the recording completes as `partial`. Container and codec are stored per stream, which is what `ADR-013` needs to keep MP4 available as a derived representation.

---

## ADR-012 — Capture pause as a record, not a state flag
{Decided} · implements `DEC-028`

**Context.** `DEC-028` requires that members can pause capture while tracking continues, bounded at 30 minutes, reason-coded and manager-visible.

**Decision.** A `capture_pauses` table with member, device, session, interval, reason, source and `auto_resumed`. Attendance carries `capture_gap_seconds` derived from it.

**Why a record.** A flag answers "is capture paused now". A record answers "why was there no screenshot at 09:35 last Tuesday" — which is the question that actually gets asked, months later, in a dispute. It also makes `paused_by_member` a distinct evidence-gap state rather than an unexplained absence.

**Consequences.** The 30-minute bound is enforced three times: tracker timer, server rejection of a late resume, and a `CHECK` constraint. Reports can state *tracked 8h 10m, captured 7h 40m, paused 30m*, which a single worked-seconds figure cannot.

---

## ADR-013 — WebM as the source recording format
{Decided} · resolves [`CONF-07`](#/source-audit)

**Context.** `resources-2.md` §9 targets WebM; `resources-10.md` §24 illustrates `.mp4` segments. Electron's `MediaRecorder` reliably produces WebM; MP4 support is inconsistent across builds.

**Decision.** WebM (VP9, VP8 fallback) as the source format. Container, codec and MIME type are **stored per stream**, never assumed. MP4 becomes a derived representation if export or playback demands it.

**Consequences.** No transcoding at MVP — WebM plays in every browser [`NFR-COMPAT-001`](#/non-functional-requirements) targets. If an export format is required later, transcoding is a queue job producing a derived object, and the schema already accommodates it.

---

## ADR-014 — Next.js on the same origin with Sanctum cookie sessions
{Decided}

**Context.** A browser client needs authentication that is safe against XSS and simple to operate.

**Decision.** Next.js and the Laravel API share one origin, `/` and `/api/v1` behind the same Nginx. Sessions are `HttpOnly`, `Secure`, `SameSite=Lax` cookies. Next.js renders; it does not proxy the API.

**Rejected.** A separate frontend origin with bearer tokens — token storage in the browser, refresh rotation, CORS preflight on every call, and a second authorization surface, all for no gain here.

**Consequences.** No token in JavaScript. One authorization implementation, in Laravel. Both must be deployed together, which they are. A future third-party API is a separate concern and belongs with `api_access`, which no plan grants.

---

## ADR-015 — Electron with a hidden capture renderer per display
{Decided}

**Context.** One capture codebase across Windows, macOS and Linux, capturing up to four displays simultaneously. `MediaRecorder` is a renderer API and does not exist in the main process.

**Decision.** Electron. Main process owns tracking state, scheduling, the local store, sync and uploads. One hidden `BrowserWindow` per captured display holds a `desktopCapturer` stream and encodes. Screenshots are captured in the main process so the still path does not depend on a renderer.

**Rejected.** Native applications per platform (three codebases, three teams' worth of work); a browser extension (cannot capture the screen continuously or detect input idle).

**Consequences.** Memory footprint is higher than native — hence the explicit budget in [`NFR-PERF-005`](#/non-functional-requirements), which must be re-derived for four 1080p10 streams during the `M-03` spike. OS permission handling is per-platform and user-revocable, so it is probed continuously and degrades visibly. Wayland cannot support continuous unattended capture reliably; X11 is the supported Linux target and Wayland is detected and reported as degraded.

---

## ADR-016 — Dedicated queue workers per job class
{Decided}

**Context.** A retention sweep over ten million rows and a timesheet-approval email have nothing in common except a queue.

**Decision.** Eight queues with independently supervised worker pools, distinct concurrency, timeouts and retry policies. `sync` is highest priority; `retention` and `maintenance` are deliberately throttled.

**Consequences.** A slow job class cannot starve a fast one. `retention` and `maintenance` run under the `BYPASSRLS` maintenance role and are the only code permitted to cross tenants. More Supervisor programs to operate, and per-queue metrics to watch — both worth it.

---

## ADR-017 — Daily rollup tables at MVP for the executive dashboard
{Decided} · **departs from the source research**

**Context.** `resources-6.md` §6 argues against pre-computed aggregates until a performance need is demonstrated. That was written before `DEC-011` put the Premium executive dashboard in launch scope and `DEC-005` defined it as nine organization-wide metrics across up to 30 days.

**Decision.** Ship `daily_member_stats`, `daily_project_stats`, `daily_team_stats` and `storage_usage_daily` at MVP. Aggregate views read rollups; detail reports continue to query live tables.

**Why the research position no longer holds.** The demonstrated need arrived with the scope decision. Aggregating every member over 30 days with productivity classification applied cannot meet [`NFR-PERF-002`](#/non-functional-requirements)'s 3-second budget from raw partitions at target volumes. Building it live and discovering that at `M-07` would force a redesign under schedule pressure.

**Consequences.** Rollups must be rebuildable and disposable — where a rollup and its source disagree, the source wins. Classification honours `productivity_rules.effective_from`, so a rule change tomorrow does not restate last month ([`BR-MON-006`](#/business-rules)). One nightly job plus incremental refresh on late derivation.

---

## ADR-018 — Stripe behind a billing adapter
{Decided} · implements `DEC-008`

**Decision.** Stripe for payments, subscriptions, 30-day trials, invoices and dunning, reached only through `Domain\Billing\Contracts\BillingProvider`. No Stripe type appears outside `Domain\Billing\Providers`, enforced by the module rule. Laravel remains the source of truth for subscription state and entitlements; Stripe is the source of truth for money.

**Consequences.** Webhooks are authoritative, never the browser returning from Checkout. Idempotency is a unique constraint on the Stripe event id, because retries are guaranteed rather than exceptional. Reconciliation runs every six hours — lost webhooks are a normal operating condition. A provider change is contained rather than archaeological.

---

## ADR-019 — Versioned monitoring policy with acknowledgement gating
{Decided} · implements `DEC-020`

**Context.** `DEC-020` requires re-acknowledgement when monitoring intensity increases, and that the new policy not take effect for a member until acknowledged.

**Decision.** `monitoring_policies` are immutable, versioned, hashed, and classified `material` or `non_material` by comparing an ordered intensity vector against the previous version. `monitoring_acknowledgements` record membership, policy version, timestamp and origin.

**Consequences.** Storing `config_hash` is what proves *what* a member agreed to, not merely that they agreed. Disclosure text is generated from the stored configuration so it cannot drift from behaviour. Gating withholds only the newly-intensified capture — tracking continues, so a member is never locked out of working by an administrator's policy change.

---

## ADR-020 — Retention grace via `deletion_eligible_at`
{Decided} · implements `DEC-018`

**Context.** Premium → Basic takes retention from 24 months to 3, making 21 months of data immediately expired. `DEC-018` requires a 30-day grace with warning and export.

**Decision.** `subscriptions.retention_grace_until` plus `deletion_eligible_at` on media rows. During grace, effective retention is the **greater** of old and new. Affected data stays fully readable, labelled "Scheduled for deletion". The Owner is warned at grace start and seven days before expiry.

**Consequences.** Deletion is caused by retention expiry, never by a subscription change. The preview endpoint states the volume affected before the customer confirms. One extra column on media tables and one on subscriptions.

---

## ADR-021 — Single host, zero co-location assumptions
{Decided} · implements `DEC-007`

**Decision.** Launch on one VPS. Every dependency is addressed by hostname and port from configuration. No code reads a local path, assumes a shared filesystem, or requires components to be co-located.

**Consequences.** Moving PostgreSQL, Redis or the workers to their own hosts is a configuration change and a firewall rule. Availability is honestly stated at 99.5% with no failover ([`NFR-REL-001`](#/non-functional-requirements)) — tolerable only because the tracker's 72-hour offline endurance means an outage degrades reporting rather than losing capture. Scaling triggers are defined in advance rather than improvised.

---

## ADR-022 — Atomic release deployment with symlink switch
{Decided}

**Decision.** Versioned release directories, shared configuration and storage, an atomic `current` symlink switch, graceful FPM reload, and `queue:restart` so workers drain rather than being killed. Rollback is a symlink move.

**Consequences.** Rollback in under 30 seconds without a rebuild. Migrations must be expand-and-contract, because the previous release is briefly live against the new schema. Five releases retained.

---

## ADR-023 — TOTP multi-factor authentication at MVP
{Decided} · implements `DEC-023`

**Context.** The system holds screen recordings of named individuals. An account takeover on an Administrator exposes video of real people.

**Decision.** TOTP (RFC 6238), required for Owner, Administrator and Finance; supported for Manager and Employee; escalable to everyone by organization policy. Ten hashed single-use recovery codes. Passkeys and SSO later — SSO is future release in the matrix and must not become an MVP dependency.

**Consequences.** Enrolment, verification, recovery-code use and reset are all audited. Adding factors later would have meant a migration for every existing account, which is the main reason this is not deferred. Recovery-code handling needs a careful support process, since it is the account-recovery path.

---

## ADR-024 — SQLite with WAL as the tracker's local store
{Decided}

**Context.** Seventy-two hours of continuous capture must survive application restart, power loss and tracker updates, on machines the vendor does not control.

**Decision.** SQLite in WAL mode in the Electron user-data directory, encrypted with a key from the OS keystore. Events, batches, a media queue and metadata.

**Rejected.** Flat-file JSON queues (no atomicity, corrupts on power loss); IndexedDB in a renderer (tied to a window's lifecycle, which is exactly the process that dies).

**Consequences.** WAL gives crash-safe writes and concurrent read during upload. `integrity_check` runs at start-up, and corruption is reported to the member **with the affected period stated** — silent loss is not acceptable. Under disk pressure the drop order is fixed: warn, then oldest media, never events ([`BR-SYNC-003`](#/business-rules)). A lost screenshot is an evidence gap; a lost event is unpaid work.

---

## Superseded and rejected alternatives

| Considered | Why not |
|---|---|
| Microservices | `ADR-001` — transactional coupling and a single tenant boundary |
| Schema-per-tenant | `ADR-002` — migration surface at 500 tenants |
| Kubernetes at launch | No second host to orchestrate; `ADR-021` |
| Kafka for event ingestion | Batch HTTP plus a database constraint gives the same guarantee for a fraction of the operational cost |
| Elasticsearch for reporting | Indexed partitions plus rollups meet the targets; a second datastore is a second consistency problem |
| BigQuery | Future release in the matrix; nothing at this scale needs it |
| Transcoding cluster | `ADR-013` — WebM plays natively in every supported browser |
| MP4 as the source format | `ADR-013` — not reliably produced by `MediaRecorder` |
| Client-computed time totals | `ADR-008` — the client cannot be authoritative about what it is paid for |
| Compositing displays into one video | `DEC-019` — destroys per-display fidelity and the synchronised timeline |
| Screenshot downscaling at MVP | `DEC-025` chose evidential fidelity; monitored via `storage_usage_daily` |
| Bearer tokens in the browser | `ADR-014` — cookies on one origin are safer and simpler |
| A timed cooldown for automatic tracking restart | `DEC-030` — a timer silently re-tracks someone who stopped for a reason |

---

## Decisions still open

| Question | Blocks | Owner |
|---|---|---|
| [`OQ-007`](#/open-questions) Pricing | Plan seed data only | Commercial |
| [`OQ-010`](#/open-questions) Email provider | An interface exists; the provider is swappable | Operations |
| [`OQ-014`](#/open-questions) Jurisdictions and legal review | Data residency; whether recording is sellable per market | Product / Legal |
| [`OQ-021`](#/open-questions) Team and schedule | Sequencing exists; dates do not | Project management |
| [`OQ-029`](#/open-questions) Trial resource limits | Enforcement point built; numbers unset | Commercial |

None blocks System Design. `OQ-014` blocks launch.
