# Deployment & Operations

How the system is built, released, observed, backed up and recovered — on one host, without assuming it stays that way.

---

## 1. Environments

| Environment | Purpose | Data |
|---|---|---|
| **Local** | Development | Seeded fixtures; Stripe test mode; MinIO or an R2 dev bucket; Mailpit |
| **CI** | Automated verification | Ephemeral PostgreSQL and Redis per run |
| **Staging** | Release candidate validation, load testing, restore rehearsal | Anonymised or synthetic data. **Never production media** |
| **Production** | Live | — |

Staging mirrors production topology at reduced size. It is the only place a restore rehearsal counts, and the only place load testing is meaningful.

:::warning Staging never holds production media
Copying real screenshots or recordings into a lower environment would place employee screen content outside the controls that protect it. Staging uses synthetic media generated at production dimensions so performance characteristics hold without the exposure.
:::

---

## 2. Production topology

```text
                        Cloudflare
                 DNS · TLS · WAF · CDN · rate limiting
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Hostinger VPS · Ubuntu 24.04 LTS                               │
│                                                                 │
│  Nginx :443                                                     │
│    ├─ /            → Next.js  127.0.0.1:3000  (systemd)         │
│    ├─ /api/        → PHP-FPM  unix socket                       │
│    └─ /_health     → static readiness endpoint                  │
│                                                                 │
│  PHP-FPM 8.3        pm=dynamic, opcache + JIT, preload          │
│  PostgreSQL 16      local socket, tuned for the workload        │
│  Redis 7            maxmemory-policy noeviction for queues      │
│  Supervisor         one program group per queue class           │
│  systemd timer      artisan schedule:run, every minute          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                      Cloudflare R2 · Stripe · email provider
```

### Launch sizing

| Resource | Allocation | Basis |
|---|---|---|
| vCPU | 8 | ~120 req/s sustained write path plus 13 queue workers |
| RAM | 32 GB | PostgreSQL 8 GB shared buffers, Redis 4 GB, PHP-FPM ~6 GB, Next.js 1 GB, headroom |
| Storage | 400 GB NVMe | Database and WAL only — media lives in R2 |
| Network | 1 Gbps | Media bypasses the host entirely |

An estimate to be validated by load test before `M-07`, not a measurement.

### Key configuration

```text
PostgreSQL   shared_buffers 8GB · effective_cache_size 24GB · work_mem 32MB
             max_connections 200 · wal_level replica · archive_mode on
             max_parallel_workers_per_gather 4 · random_page_cost 1.1 (NVMe)

Redis        maxmemory 4gb · maxmemory-policy noeviction · appendonly yes
             Queues must never be evicted. A separate logical DB for cache,
             where volatile-lru is correct.

PHP-FPM      pm.max_children 40 · opcache.memory 256M
             opcache.jit_buffer_size 128M · preload enabled

Nginx        client_max_body_size 4M   (media never passes through)
             gzip + brotli · HSTS · TLS 1.2+
```

---

## 3. No co-location assumptions `ADR-021` `DEC-007`

Every dependency is addressed by hostname and port from configuration:

```env
DB_HOST=127.0.0.1          REDIS_HOST=127.0.0.1
QUEUE_CONNECTION=redis     CACHE_STORE=redis
FILESYSTEM_DISK=r2         R2_ENDPOINT=…
```

Moving PostgreSQL, Redis or the workers to their own hosts is a `.env` change and a firewall rule. Nothing in the code reads a local path, assumes a shared filesystem, or requires a component to be on the same machine. `DEC-007` requires exactly this, and it is the difference between "we run on one server" and "we can only run on one server".

Migration order when growth demands it:

```text
1  workers to a second host        (queues are already network-addressed)
2  PostgreSQL to a managed instance or dedicated host
3  Redis to its own host
4  a second application host behind a load balancer
     ⤷ requires: sticky-free sessions (already Redis), and shared nothing on disk (already true)
```

---

## 4. CI/CD

### Pipeline

```text
push / pull request
  ├─ static analysis         PHPStan L8 · ESLint · TypeScript
  ├─ module boundary rules   layer violations, plan-name literals, unscoped queries
  ├─ unit + feature tests    PostgreSQL + Redis services
  ├─ GATING SUITES
  │    tenant isolation · RLS verification · entitlement matrix
  │    permission coverage · derivation property tests
  │    payroll golden dataset · timezone matrix · retention
  ├─ security                dependency audit · secret scan
  ├─ build                   Laravel (composer --no-dev, config/route/view cache)
  │                          Next.js (standalone)
  └─ artefact                versioned tarball
```

A failure in any gating suite blocks the merge. Those seven suites are the executable form of launch criteria `SC-01` to `SC-06` and `SC-09`.

### Release `ADR-022`

Atomic symlink switch — rollback is a symlink move, not a rebuild.

```text
/var/www/ttt/
├── releases/
│   ├── 2026-08-27-141233/
│   └── 2026-08-26-093011/
├── shared/       .env · storage/ · node_modules cache
└── current -> releases/2026-08-27-141233
```

```text
1  upload artefact to releases/<timestamp>
2  link shared paths
3  php artisan migrate --force          ← expand only; see §5
4  php artisan config:cache route:cache view:cache event:cache
5  warm the OPcache preload
6  switch the `current` symlink                   ← atomic
7  systemctl reload php8.3-fpm · nginx
8  php artisan queue:restart                      ← workers finish, then exit
9  systemctl restart ttt-next
10 health check: /_health/ready
11 fail → switch the symlink back, reload         ← under 30 seconds
12 keep the last 5 releases
```

Deployment is zero-downtime for reads. In-flight requests complete against the old release; workers drain rather than being killed mid-job.

### Desktop tracker releases

A separate pipeline: build for three platforms, sign, notarise macOS, staple, publish to the update feed, then bump the API's minimum supported version only after adoption has been observed.

---

## 5. Database migrations

**Expand and contract**, always. A migration must be safe against the *previous* release, because the symlink switch is not instantaneous across processes.

```text
Release N     add nullable column · add index CONCURRENTLY · backfill in batches
              application writes both old and new
Release N+1   application reads new only
Release N+2   drop the old column
```

| Rule | Reason |
|---|---|
| Never `ALTER TABLE … SET NOT NULL` on a large table in one statement | Full table rewrite under an exclusive lock |
| Always `CREATE INDEX CONCURRENTLY` on populated tables | Avoids blocking writes |
| Never rename in place | Add, migrate, drop |
| Backfills are batched jobs | Not migrations |
| `lock_timeout = 5s` on every migration connection | A blocked migration fails fast rather than queueing the site |
| Forward-only in production | [`NFR-MAINT-007`](#/non-functional-requirements) |
| Tested against a production-shaped dataset | On staging, before release |

Partition maintenance runs as a scheduled job, never as a deployment step — a release must never depend on creating a partition.

---

## 6. Observability

### Logs

Structured JSON to stdout, collected by systemd, shipped to a retained store.

```json
{
  "ts": "2026-08-27T09:14:02.118Z",
  "level": "info",
  "request_id": "018f9e…",
  "organization_id": "018f8a…",
  "membership_id": "018f8b…",
  "route": "POST /api/v1/tracking/batches",
  "duration_ms": 84,
  "events_accepted": 160,
  "events_duplicate": 3
}
```

**Never logged:** credentials, tokens, signed URLs, captured content, TOTP secrets, Stripe payloads containing payment details. Enforced by a log processor that redacts known-sensitive keys, plus a test asserting the redaction. [`NFR-MAINT-003`](#/non-functional-requirements).

### Metrics

Exposed on an internal-only endpoint and scraped.

| Group | Metrics |
|---|---|
| HTTP | Request rate, p50/p95/p99 latency, error rate — by route class |
| **Sync** | **Batch accept rate, failure rate, quarantine count, backlog by device and organization** |
| Queues | Depth, wait time, throughput, failure rate — per queue |
| Jobs | Duration and outcome for derivation, rollups, retention, reconciliation |
| Database | Connections, slow queries, cache hit ratio, replication lag, table and index bloat |
| Media | Upload authorisation rate, upload failures, orphan sweep counts, bytes by organization |
| Business | Active tracking sessions, timesheets pending, payroll periods open, trials expiring |
| Infrastructure | CPU, memory, disk, IO wait, network |

Sync failure rate is the headline metric. `resources-2.md` §18 identifies it correctly: a time-tracking product that silently loses time has failed at its only job, and this number is how that failure becomes visible before a customer reports it.

### Alerts

| Alert | Condition | Severity |
|---|---|---|
| Sync failure rate | > 0.5% over 15 min | **Critical** |
| Sync backlog | Any device > 4 h unsynchronised | **Critical** |
| API 5xx rate | > 1% over 5 min | **Critical** |
| Queue depth | `sync` > 5,000, or any queue > 20,000 | **Critical** |
| Retention job | Failed, or skipped a night | **Critical** |
| Backup | Failed, or WAL archiving stalled | **Critical** |
| Disk | > 80% used | **Critical** |
| API p95 latency | > 1 s over 10 min | Warning |
| Job failure rate | > 2% over 30 min | Warning |
| Media upload failures | > 1% over 15 min | Warning |
| Stripe reconciliation | Divergence detected | Warning |
| Storage growth | Organization > 3× seat-count expectation | Warning |
| Certificate expiry | < 21 days | Warning |

### Health endpoints

```text
/_health/live    process is up
/_health/ready   PostgreSQL, Redis, R2 reachable; migrations current
/_health/deep    internal only — queue depth, worker liveness, last scheduler run
```

---

## 7. Backup and recovery

### Strategy

| Component | Method | Frequency | Destination |
|---|---|---|---|
| PostgreSQL | `pgBackRest` full | Nightly | R2, separate bucket, separate credentials |
| PostgreSQL | Differential | Every 6 h | R2 |
| PostgreSQL | WAL archiving | Continuous | R2 |
| Media | Already in R2 | — | R2 versioning + lifecycle |
| Configuration | `.env` and Nginx, encrypted | On change | Secret store + offline copy |
| Application code | Git | — | Origin |

Backups are **encrypted before leaving the host** and stored under credentials that the application role cannot use — so a compromise of the application cannot destroy the backups.

### Objectives

| Objective | Target | Basis |
|---|---|---|
| **RPO** | 15 minutes | WAL archived continuously; worst case is the unarchived segment |
| **RTO** | 4 hours | Provision, restore, verify, cut over |

[`NFR-REL-004`](#/non-functional-requirements). The tracker's 72-hour offline endurance is what makes a 4-hour RTO tolerable: an outage degrades reporting and approval, it does not stop capture.

### Verification

| Check | Frequency |
|---|---|
| Backup completion and checksum | Every run, alerted |
| `pgbackrest verify` | Nightly |
| **Full restore to staging** | **Monthly** |
| Full DR rehearsal from bare infrastructure, timed | Quarterly, and before `M-09` |

:::warning A restore that has never been performed is a hypothesis
`NFR-REL-004` requires a real restore onto clean infrastructure before launch — not a documented procedure. The quarterly rehearsal is what keeps the runbook true as the system changes.
:::

---

## 8. Runbooks

### Total host loss

```text
 1  declare; post status
 2  provision a replacement VPS (Ubuntu 24.04, same size)
 3  run the provisioning playbook            ~25 min
 4  restore configuration from the secret store
 5  pgbackrest restore --delta                ~60–90 min at target volumes
 6  replay WAL to the latest archived point
 7  verify: row counts, latest event timestamp, migration state
 8  deploy the current release artefact
 9  start PHP-FPM, Next.js, Supervisor, scheduler
10  /_health/ready must pass
11  repoint Cloudflare DNS
12  watch sync backlog drain — trackers reconnect and flush automatically
13  post-incident: reconcile derivation for the outage window
```

Step 12 is why the offline design matters. Trackers held everything locally; the backlog drains on its own.

### Database corruption

Restore to the last known-good point rather than repairing in place. Compare the latest `tracking_events.occurred_at` against device-reported `device_seq` to size the gap; trackers still hold anything the database lost, within the 72-hour window.

### Runaway storage growth

```text
1  storage_usage_daily → identify the organization and media type
2  confirm against seat count and recording configuration
3  if a trial → apply trial limits (OQ-029) if set, otherwise contact
4  if legitimate → review pricing exposure; consider a recording-specific
   retention default (RISK-018)
5  verify the retention sweep is running and not backlogged
```

### Sync failure spike

```text
1  sync_batches → is it one device, one organization, or global?
2  one device      → tracker version, OS, quarantined batches, contact the member
3  one organization→ network or firewall; check connectivity_events
4  global          → API errors, database contention, rate limiting
5  never resolved by discarding batches — quarantined batches are inspected
```

### Stripe divergence

```text
1  ReconcileSubscriptions log → which organizations
2  compare local subscription against Stripe
3  Stripe is authoritative for money; Laravel for entitlements
4  apply the correction; audit it; notify the Owner if entitlements changed
5  if webhooks stopped: verify the endpoint, signing secret, and Stripe's delivery log
```

---

## 9. Scaling triggers

Each addition has a defined trigger rather than a vague "later".

| Change | Trigger |
|---|---|
| Workers to a second host | Queue wait time p95 > 60 s sustained, or CPU > 70% sustained |
| PostgreSQL to a dedicated host | Database CPU > 60% sustained, or IO wait > 15% |
| Read replica for reporting | Report queries measurably affecting write latency |
| More aggressive rollups | [`NFR-PERF-002`](#/non-functional-requirements) breached after index tuning |
| Second application host + load balancer | Sustained > 400 req/s, or availability requirement rises |
| Partition retention window shortened | Database volume growth outpacing the plan |
| Containerisation | The day a second application host exists |
| CDN in front of media | Media egress or latency becomes a complaint |

---

## 10. Security operations

| Practice | Cadence |
|---|---|
| OS and package updates | Weekly; security patches within 48 h |
| Dependency audit | Every build; criticals block release |
| TLS certificates | Cloudflare-managed, auto-renewed, expiry alerted |
| Secret rotation | Annually, and immediately on suspicion |
| Access review — who can reach production | Quarterly |
| Penetration test | Before `M-09`, then annually |
| Support elevation review | Monthly — who elevated, into what, why |
| Log review for isolation-test failures | Continuous, alerted |

### Production access

| Rule | |
|---|---|
| SSH | Key-only, no passwords, no root login, bastion or IP allowlist |
| Database | No shared credentials; the application role holds no `BYPASSRLS` |
| Break-glass | Named individual, reason recorded, session logged, reviewed after |
| Customer data | Only through audited support elevation — [Tenancy & Security](#/sd-tenancy-security) §7 |

---

## 11. Cost model

| Line | Driver | Control |
|---|---|---|
| VPS | Fixed | Vertical scaling until the triggers in §9 |
| **R2 storage** | **Media volume × retention** | Retention enforcement, capture configuration, storage accounting |
| R2 operations | Upload and read counts | Segment length, gallery pagination |
| R2 egress | Zero | Why R2 rather than S3 |
| Stripe | Percentage of revenue | — |
| Email | Volume | Digest instead of per-event where appropriate |
| Backup storage | Database size × retention | Backup retention policy |

Media dominates. `storage_usage_daily` gives per-organization attribution from day one, which is what turns [`RISK-018`](#/risks) from a surprise into a monitored trend.

---

## 12. Operational readiness for launch

Checked at `M-09`, and none of it is optional.

```text
☐  Load test at NFR-SCALE-001 volumes, passing NFR-PERF targets
☐  Full restore performed on clean infrastructure and timed against RTO
☐  All alerts firing correctly, verified by deliberate fault injection
☐  Runbooks executed at least once, not merely written
☐  Penetration test complete, criticals and highs closed
☐  Secret rotation rehearsed
☐  Retention sweep verified end-to-end across every data type
☐  Tracker signed and notarised on all three platforms
☐  Rollback rehearsed under 30 seconds
☐  Status page and incident communication path in place
☐  Support email live — DEC-003, and a paying customer must have somewhere to go
☐  Legal review of monitoring lawfulness complete for every launch market — OQ-014
```

The last item is not an engineering task and cannot be closed by engineering. It remains [`RISK-005`](#/risks), and it is the only launch blocker on this list that no amount of building resolves.
