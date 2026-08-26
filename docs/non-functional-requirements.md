# Non-Functional Requirements

Quality attributes the system must exhibit. Every requirement here is measurable — a target without a number and a way to verify it is not a requirement.

:::warning Where these numbers come from
`resources/` contains **no** performance targets, load figures, availability commitments or recovery objectives. Every threshold below is `{Proposed}` unless badged otherwise, chosen to be defensible for a product of this shape and size. They are starting points for a stakeholder decision, not measurements. See [`OQ-008`](#/open-questions).
:::

**Categories:** `PERF` performance · `SCALE` scalability · `SEC` security · `PRIV` privacy · `REL` reliability · `MAINT` maintainability · `COMPAT` compatibility · `USE` usability & accessibility

---

# PERF · Performance

## NFR-PERF-001 — Interactive response time
{P0} {Proposed}

**The system shall** serve interactive web application requests within **500 ms at the 95th percentile** and **1500 ms at the 99th percentile**, measured server-side excluding network transit, under the load defined in `NFR-SCALE-001`.

**Verification:** load test against a dataset matching `NFR-SCALE-002`, measured per endpoint class.
**Applies to:** dashboards, list views, entity reads and writes. Not to report generation or export.

## NFR-PERF-002 — Report response time
{P0} {Proposed}

**The system shall** return a report over a **one-month period for up to 100 Members** within **3 seconds at the 95th percentile**, paginated.

Reports exceeding this bound shall be generated asynchronously and delivered per [`REQ-REPORT-010`](#/functional-requirements) rather than blocking.

**Verification:** load test at the volumes in `NFR-SCALE-002`.
**Rationale:** MVP has no pre-computed aggregates by deliberate decision (`resources-6.md` §6), so this target is entirely a function of indexing. If it cannot be met, aggregate tables move from {V1.1} into MVP — that is the trigger, not a preference.

## NFR-PERF-003 — Tracking event ingestion
{P0} {Proposed}

**The system shall** acknowledge a synchronisation batch of up to **500 events within 2 seconds at the 95th percentile**, and shall perform time entry derivation asynchronously rather than inside the acknowledgement.

**Verification:** ingestion load test with concurrent devices at the `NFR-SCALE-001` level.
**Rationale:** a tracker blocked on ingestion accumulates backlog, and backlog is how time gets lost.

## NFR-PERF-004 — Asynchronous processing
{P0} {Derived}

**The system shall** perform the following outside the request cycle: screenshot and recording processing, email and notification delivery, report and export generation, payroll calculation, attendance derivation and retention cleanup.

**Verification:** no request handler for these operations performs the work synchronously; asserted by code review and by response-time tests.
**Source:** `resources-2.md` §10.

## NFR-PERF-005 — Capture overhead on the member's machine
{P0} {Proposed}

**The desktop tracker shall** consume **under 3% CPU averaged over a tracking session** and **under 250 MB resident memory** while tracking with screenshots and activity capture enabled, excluding screen recording.

With screen recording enabled, the tracker shall consume **under 15% CPU** and shall degrade recording quality before degrading time capture.

**Verification:** measured on the minimum supported hardware specification for each platform.
**Rationale:** the tracker runs continuously on someone else's machine. A tracker that makes a laptop slow gets uninstalled, and then no time is captured at all.

## NFR-PERF-006 — Media upload
{P0} {Proposed}

**The system shall** issue an upload authorisation within **300 ms at the 95th percentile**, and media shall upload directly to object storage without transiting the application server.

**Verification:** measured under concurrent upload load; network capture confirms no media passes through the application tier.

## NFR-PERF-007 — Report data currency
{P1} {Proposed}

**The system shall** reflect a synchronised tracking event in reports and dashboards within **60 seconds** of its acknowledgement.

**Verification:** end-to-end timing test from batch acknowledgement to report visibility.

---

# SCALE · Scalability

## NFR-SCALE-001 — Concurrency
{P0} {Proposed}

**The system shall** support, on the launch deployment:

| Dimension | Target |
|---|---|
| Organizations | 500 |
| Total Memberships | 10,000 |
| Concurrently tracking Devices | 2,000 |
| Concurrent web application sessions | 1,000 |
| Ingested tracking events per second, sustained | 200 |

**Verification:** load test at these figures before `M-07`.

## NFR-SCALE-002 — Data volume
{P0} {Proposed}

**The system shall** maintain the performance targets in `PERF` at the following stored volumes:

| Data | Volume |
|---|---|
| Time entries | 25 million |
| Tracking events | 500 million |
| Activity events | 500 million |
| Application and website usage records | 300 million |
| Screenshots (metadata) | 50 million |
| Attendance records | 5 million |
| Audit records | 100 million |

**Derivation of these figures:** 10,000 Members × 8 tracked hours/day × 220 working days is approximately 17.6 million tracked hours per year. At one activity event per minute that is roughly 1 billion activity events per year — which retention at 3 to 24 months bounds. Screenshot volume at a 10-minute interval is roughly 105 million per year. The figures above assume retention is enforced; **without enforced retention these numbers are unbounded**, which is why [`REQ-DATA-003`](#/functional-requirements) is a launch gate rather than a feature.

## NFR-SCALE-003 — Growth path without redesign
{P0} {Derived}

**The system shall** be structured so the following can be introduced without changing the domain model or the application's data access:

| Capability | Trigger |
|---|---|
| Time-based partitioning of high-volume tables | When a table's query latency degrades beyond the `PERF` targets |
| Pre-computed daily aggregate tables | When `NFR-PERF-002` cannot be met by indexing alone |
| Read replicas for reporting | When reporting load affects write latency |
| Separate queue workers per job class | When one job class starves another |

**Verification:** design review at `M-02` confirms each is reachable without a schema redesign.
**Source:** `resources-10.md` §32, `resources-6.md` §6 — both argue explicitly against doing these prematurely.

## NFR-SCALE-004 — Bounded result sets
{P0} {Derived}

**The system shall** paginate every list and report endpoint with an enforced maximum page size, and shall never return an unbounded result set.

**Verification:** automated test asserts a maximum page size on every collection endpoint.

## NFR-SCALE-005 — Tenant-scoped index strategy
{P0} {Derived}

**The system shall** index tenant-scoped tables with the Organization as the leading column of composite indexes serving tenant-scoped queries.

**Verification:** query plan review for every report query at `M-02` and before `M-07`.
**Source:** `resources-8.md` §29.

## NFR-SCALE-006 — Storage cost containment
{P1} {Proposed}

**The system shall** report stored media volume per Organization, and shall alert platform operations when an Organization's growth deviates materially from its seat count.

**Rationale:** media is the dominant marginal cost and the primary way a single customer can become unprofitable unnoticed.

---

# SEC · Security

## NFR-SEC-001 — Tenant isolation is verified, not assumed
{P0} {Derived}

**The system shall** be covered by an automated test suite asserting that every tenant-scoped endpoint refuses access to another Organization's data, executed on every build.

**Verification:** coverage report showing every tenant-scoped endpoint is exercised. A new tenant-scoped endpoint without a corresponding isolation test fails the build.
**Rationale:** this is the highest-severity failure mode in the product. Testing it by sampling is not sufficient.

## NFR-SEC-002 — Transport security
{P0} {Derived}

**The system shall** serve all traffic over TLS 1.2 or higher, reject plaintext connections, and set HSTS.

## NFR-SEC-003 — Credential storage
{P0} {Derived}

**The system shall** store passwords using a memory-hard adaptive hashing function with per-credential salt, and shall store invitation, reset and device tokens hashed.

**Verification:** code review; no reversible credential storage exists.

## NFR-SEC-004 — Session security
{P0} {Derived}

**The system shall** use HttpOnly, Secure, SameSite cookies for web sessions, and shall never place a long-lived authentication token in browser-accessible storage.

**Source:** `resources-2.md` §5.

## NFR-SEC-005 — Media access control
{P0} {Derived}

**The system shall** keep all media in private object storage, serve it only through signed URLs valid for **no more than 15 minutes**, and authorise every URL issuance.

**Verification:** no permanent public URL exists for any screenshot, recording segment or export; confirmed by storage configuration review and by test.
**Source:** `resources-2.md` §16.

## NFR-SEC-006 — Rate limiting
{P0} {Derived}

**The system shall** rate-limit authentication, registration, password reset, invitation acceptance, media upload authorisation and synchronisation endpoints, by source and by account.

## NFR-SEC-007 — Input validation and injection resistance
{P0} {Derived}

**The system shall** validate and constrain every input at the API boundary, use parameterised database access exclusively, and validate uploaded file type, size and content.

## NFR-SEC-008 — Audit completeness
{P0} {Derived}

**The system shall** produce an audit record for every action listed in [`REQ-AUDIT-002`](#/functional-requirements), written in the same transaction as the change.

**Verification:** coverage checklist verified before every release gate.

## NFR-SEC-009 — Secrets management
{P0} {Derived}

**The system shall** hold no credential, key or provider secret in source control, and shall support rotation of every secret without a code change.

## NFR-SEC-010 — Dependency and vulnerability management
{P1} {Proposed}

**The system shall** be scanned for known vulnerable dependencies on every build, with critical findings blocking release.

## NFR-SEC-011 — Security review before launch
{P0} {Proposed}

**The system shall** undergo a threat model at `M-02`, a design and evidence-chain review at `M-06`, and an independent penetration test before `M-09`, with critical and high findings resolved before launch.

## NFR-SEC-012 — Desktop tracker integrity
{P0} {Proposed}

**The desktop tracker shall** be code-signed for each platform and notarised where the platform requires it, and shall verify update authenticity before applying an update.

**Rationale:** an unsigned application that captures screens and holds a credential is an attractive target for substitution. This also has a procurement lead time — see [Project Planning](#/project-planning) §6.

---

# PRIV · Privacy

:::warning This section states engineering requirements, not legal conclusions
Team Time Track processes employee activity data, screen images and screen video. Whether a particular deployment is lawful depends on jurisdiction, employment relationship, the organization's own notices and, in some countries, consultation with employee representatives. **This documentation makes no claim that the product is compliant with any specific law.** It specifies controls that make lawful operation possible. Determining what the law requires is [`OQ-014`](#/open-questions) and requires qualified legal advice.
:::

## NFR-PRIV-001 — Data minimisation by default
{P0} {Proposed}

**The system shall** collect the minimum data each feature requires:

| Collected | Not collected |
|---|---|
| Aggregated activity counts and percentages | Keystroke content, key sequences, clipboard contents |
| Foreground application name | Enumerated background processes, window titles |
| Foreground browser domain | Full URL paths by default, query strings, fragments — ever |
| Screenshots at a bounded interval | Continuous screen capture outside the recording feature |
| Device network information sufficient to classify office or remote | Geolocation |

**Verification:** data inventory review confirming no field outside the left column is captured.

## NFR-PRIV-002 — Capture only during tracking
{P0} {Derived}

**The system shall** capture no monitoring data while tracking is stopped, paused, or during a declared break.

**Verification:** automated test per capture type.
**Rationale:** the boundary between working time and personal time is exactly the boundary of the product's legitimate interest.

## NFR-PRIV-003 — Transparency to the data subject
{P0} {Proposed}

**The system shall** ensure that for every category of data captured about a Member, that Member can view their own instance of it, and shall disclose the active monitoring configuration to each Member before capture begins.

**Verification:** category-by-category checklist verified at `M-06`; no category may fail.

## NFR-PRIV-004 — Notification of increased monitoring
{P0} {Proposed}

**The system shall** notify affected Members before a configuration change takes effect that enables a capture type or shortens a capture interval.

## NFR-PRIV-005 — Retention enforcement
{P0} {Confirmed}

**The system shall** delete data past its effective retention period from both object storage and the database within **24 hours** of expiry, and shall record each deletion.

**Verification:** scheduled job test with seeded expired data across every data type.

## NFR-PRIV-006 — Access is authorised and recorded
{P0} {Proposed}

**The system shall** authorise every access to a Member's monitoring data against scope, permission and entitlement, and shall record vendor-side access under [`REQ-ADMIN-005`](#/functional-requirements) in the Organization's own audit log.

## NFR-PRIV-007 — Subject access and erasure mechanisms
{P1} {Proposed}

**The system shall** provide a Member with an export of all data held about them within an Organization, and a mechanism to raise an erasure request that is decided and recorded.

**Note:** the mechanism is a requirement. Whether erasure must be granted in a given case is a legal determination.

## NFR-PRIV-008 — Data residency
{P2} {Open}

**The system shall** document where data is stored and processed.

Whether multi-region residency is required depends on target jurisdictions, which are undetermined — [`OQ-014`](#/open-questions). The launch architecture is single-region; this constrains which markets can be sold into.

## NFR-PRIV-009 — Processing documentation
{P1} {Proposed}

**The system shall** maintain a data inventory listing every category of personal data processed, its purpose, its retention period, its storage location and who can access it — generated from the actual configuration rather than maintained as separate prose that can drift.

---

# REL · Reliability

## NFR-REL-001 — Availability
{P0} {Proposed}

**The system shall** target **99.5% monthly availability** for the API and web application, measured against successful responses to synthetic health checks.

**Note:** 99.5% permits roughly 3.6 hours of downtime per month. This is honest for a single-VPS deployment with no failover (`resources-2.md` §17). A higher commitment requires a different infrastructure decision, and should not be published without one. See [`RISK-010`](#/risks).

## NFR-REL-002 — Capture survives platform unavailability
{P0} {Confirmed}

**The desktop tracker shall** continue capturing time and evidence while the API is unreachable, for at least **72 hours** of continuous tracking, subject to local storage capacity.

**Verification:** extended offline test with the API unreachable throughout.
**Rationale:** this is what makes `NFR-REL-001` acceptable. Platform downtime must degrade reporting, never capture.

## NFR-REL-003 — Backup
{P0} {Derived}

**The system shall** perform automated daily full database backups plus continuous transaction log capture, stored outside the production host, with backup success monitored and failure alerting.

**Source:** `resources-2.md` §19.

## NFR-REL-004 — Recovery objectives
{P0} {Proposed}

| Objective | Target |
|---|---|
| Recovery Point Objective (RPO) | **15 minutes** of committed database transactions |
| Recovery Time Objective (RTO) | **4 hours** to restore service on replacement infrastructure |

**Verification:** a full restore onto clean infrastructure is **performed**, not merely documented, before `M-09` and at least annually thereafter.
**Rationale:** `resources-2.md` §19 documents a recovery procedure without objectives. A procedure that has never been executed is a hypothesis.

## NFR-REL-005 — Idempotency of all retryable operations
{P0} {Derived}

**The system shall** make every operation that a client may retry idempotent: event ingestion, media upload registration, notification delivery and payroll calculation.

**Verification:** replay test per operation.

## NFR-REL-006 — Numerical integrity
{P0} {Derived}

**The system shall** store and calculate durations as integer seconds and monetary values with fixed precision, with no floating-point type used at any point in a financial or duration calculation.

**Verification:** golden-dataset payroll test checked to the minor unit; type review of all duration and money fields.
**Source:** `resources-8.md` §4, §5.

## NFR-REL-007 — Queue durability and failure handling
{P0} {Derived}

**The system shall** retry failed background jobs with backoff, retain permanently failed jobs for inspection rather than discarding them, and expose failure counts to operations.

## NFR-REL-008 — Partial failure containment
{P0} {Derived}

**The system shall** ensure that failure of object storage, the email provider, the billing provider or the real-time channel degrades only the affected capability and never blocks time capture or ingestion.

**Verification:** fault injection per dependency.

## NFR-REL-009 — Data integrity under concurrency
{P0} {Derived}

**The system shall** prevent concurrent operations from producing overlapping time entries, duplicate attendance records, duplicate timesheet inclusion or duplicate payroll entries, using database-level constraints rather than application-level checks alone.

---

# MAINT · Maintainability

## NFR-MAINT-001 — Module boundaries
{P0} {Derived}

**The system shall** be organised into the modules defined in [Product Modules](#/product-modules), with no module depending on a module in a higher layer.

**Verification:** dependency analysis in the build; a violation fails the build.
**Rationale:** a modular monolith without enforced boundaries becomes an unmodular one within a year. `resources-2.md` §3 proposes the structure; enforcement is what makes it hold.

## NFR-MAINT-002 — Single source of truth per concern
{P0} {Derived}

**The system shall** resolve entitlements through exactly one service, tenant scope through exactly one mechanism, and audit writes through exactly one path.

**Verification:** automated check that no plan-name comparison and no unscoped tenant query exists in request-handling code.

## NFR-MAINT-003 — Structured logging
{P0} {Derived}

**The system shall** emit structured logs carrying a correlation identifier, the Organization, the acting Membership where applicable, and the operation — and shall never log credentials, tokens, signed URLs or captured content.

## NFR-MAINT-004 — Observability
{P0} {Derived}

**The system shall** expose: API latency and error rate by endpoint class, queue depth and job failure rate by job class, **synchronisation failure rate by Organization and Device**, media upload failure rate, email delivery failure rate, retention job outcomes, and database connection and query health.

**Source:** `resources-2.md` §18, which identifies tracker synchronisation failure as the critical metric.

## NFR-MAINT-005 — Alerting
{P0} {Proposed}

**The system shall** alert operations on: sustained API error rate, queue depth beyond threshold, synchronisation failure rate beyond threshold, retention job failure, backup failure and billing reconciliation divergence.

## NFR-MAINT-006 — Reproducible deployment
{P0} {Derived}

**The system shall** be deployable to clean infrastructure from documented, version-controlled steps, without manual configuration that exists only on the current host.

**Verification:** demonstrated by the `NFR-REL-004` restore rehearsal.
**Rationale:** the explicit decision to run without containers (`resources-2.md` §17) makes this harder and therefore more important, not less.

## NFR-MAINT-007 — Database migration discipline
{P0} {Derived}

**The system shall** apply schema changes through ordered, version-controlled migrations that are forward-only in production and tested against a production-shaped dataset.

## NFR-MAINT-008 — API versioning
{P0} {Derived}

**The system shall** version its API from the first release, and shall not introduce a breaking change within a version.

**Rationale:** desktop trackers on customer machines cannot be forced to update in step with the server. Version skew is permanent, not transitional.
**Source:** `resources-2.md` §12.

## NFR-MAINT-009 — Configuration over code for commercial packaging
{P0} {Derived}

**The system shall** allow plan composition, feature mapping and limits to change without a code deployment.

---

# COMPAT · Compatibility

## NFR-COMPAT-001 — Web application browsers
{P0} {Proposed}

**The web application shall** support the current and immediately previous major versions of Chrome, Edge, Firefox and Safari on desktop, and Chrome and Safari on mobile.

**Verification:** cross-browser test matrix before `M-09`.

## NFR-COMPAT-002 — Desktop tracker platforms
{P0} {Confirmed} platforms / {Derived} versions

**The desktop tracker shall** support:

| Platform | Versions |
|---|---|
| Windows | 10 and 11, 64-bit |
| macOS | The current and two previous major releases, Apple silicon and Intel |
| Linux | Ubuntu LTS current and previous; a portable package for other distributions |

:::warning The matrix sells more than this
The feature matrix grants "Windows, Mac, Linux, Chrome and mobile apps" to **all plans including Basic** `{Confirmed}`. MVP ships desktop and web only. This is [`CONF-04`](#/source-audit) and requires a commercial decision — [`OQ-002`](#/open-questions).
:::

## NFR-COMPAT-003 — Responsive web application
{P0} {Proposed}

**The web application shall** be usable at viewport widths from **320 px upward**, with no horizontal page scrolling, and with all approval, review and reporting workflows completable on a tablet.

**Note:** a Manager approving timesheets on a tablet is a realistic scenario. An Administrator configuring schedules on a phone is not, and is not a target.

## NFR-COMPAT-004 — Screen capture across display configurations
{P1} {Open}

**The desktop tracker shall** define and document its behaviour with multiple displays, high-DPI displays and virtual desktops.

Behaviour is undetermined — [`OQ-023`](#/open-questions).

## NFR-COMPAT-005 — Recording playback format
{P1} {Derived}

**The system shall** store recordings in a format playable in all browsers supported by `NFR-COMPAT-001` without a server-side transcoding stage at MVP.

**Note:** `resources-2.md` §9 indicates WebM initially; `resources-10.md` §24 illustrates MP4 segments — [`CONF-07`](#/source-audit). The requirement constrains the outcome; System Design chooses the format.

## NFR-COMPAT-006 — Export format
{P0} {Derived}

**The system shall** produce CSV exports with UTF-8 encoding, a documented delimiter and quoting convention, and ISO 8601 timestamps with explicit offsets.

**Rationale:** payroll exports are read by other systems and by spreadsheets in unknown locales. Ambiguous timestamps and locale-dependent number formats are a common and avoidable source of payroll error.

## NFR-COMPAT-007 — Timezone and DST correctness
{P0} {Derived}

**The system shall** use a maintained timezone database, handle daylight-saving transitions correctly in schedule, attendance and report calculations, and update the timezone database as part of routine maintenance.

**Verification:** test matrix covering at least three timezones with differing DST rules, plus a shift spanning a transition in both directions.

---

# USE · Usability & Accessibility

## NFR-USE-001 — Accessibility
{P1} {Proposed}

**The web application shall** conform to WCAG 2.1 Level AA: keyboard operability throughout, visible focus indication, sufficient contrast, correct semantic structure and labelling, and no reliance on colour alone to convey state.

**Verification:** automated scan plus manual keyboard and screen-reader review before `M-09`.
**Rationale:** absent from all sources (`GAP-16`). It is `{P1}` rather than `{P0}` only because it can be verified and corrected late; it should not be dropped.

## NFR-USE-002 — Tracker state legibility
{P0} {Proposed}

**The desktop tracker shall** make its tracking state and its synchronisation state distinguishable at a glance without opening the main window, and shall not convey either by colour alone.

## NFR-USE-003 — Destructive and policy actions
{P0} {Proposed}

**The system shall** require explicit confirmation, stating the consequence and the volume affected, for: reducing retention, downgrading a plan, removing a Member, reopening an approved Timesheet or Payroll Period, and enabling a more intrusive capture type.

## NFR-USE-004 — Error messages
{P0} {Proposed}

**The system shall** produce error messages that state what failed, why, and what the person can do — and shall not expose internal identifiers, stack traces or query detail to an end user.

## NFR-USE-005 — Time and duration presentation
{P0} {Derived}

**The system shall** present all times in the viewer's Organization timezone with the timezone indicated, and durations in a consistent documented format throughout.

**Rationale:** a distributed team reading times without an indicated timezone will misread them, and the misreading will surface as a payroll dispute.

## NFR-USE-006 — Localisation readiness
{P2} {Proposed}

**The system shall** externalise user-facing text so additional languages can be added without code changes, while shipping English only at MVP.

**Note:** `ASM-012`. Multi-timezone and multi-currency are supported at MVP; multi-language is not — `GAP-11`.

---

## Summary of quantified targets

Every number in this document, in one place, for review.

| Target | Value | Requirement |
|---|---|---|
| Interactive response, p95 | 500 ms | `NFR-PERF-001` |
| Interactive response, p99 | 1500 ms | `NFR-PERF-001` |
| Report response, p95 | 3 s | `NFR-PERF-002` |
| Sync batch acknowledgement, p95 | 2 s / 500 events | `NFR-PERF-003` |
| Tracker CPU, tracking only | < 3% | `NFR-PERF-005` |
| Tracker memory | < 250 MB | `NFR-PERF-005` |
| Tracker CPU, with recording | < 15% | `NFR-PERF-005` |
| Upload authorisation, p95 | 300 ms | `NFR-PERF-006` |
| Report data currency | 60 s | `NFR-PERF-007` |
| Organizations | 500 | `NFR-SCALE-001` |
| Memberships | 10,000 | `NFR-SCALE-001` |
| Concurrent tracking devices | 2,000 | `NFR-SCALE-001` |
| Sustained event ingestion | 200/s | `NFR-SCALE-001` |
| Signed URL lifetime | ≤ 15 min | `NFR-SEC-005` |
| Retention deletion latency | ≤ 24 h | `NFR-PRIV-005` |
| Availability | 99.5%/month | `NFR-REL-001` |
| Offline capture endurance | 72 h | `NFR-REL-002` |
| RPO | 15 min | `NFR-REL-004` |
| RTO | 4 h | `NFR-REL-004` |
| Minimum viewport | 320 px | `NFR-COMPAT-003` |
| Accessibility | WCAG 2.1 AA | `NFR-USE-001` |

:::warning Every figure above needs a decision, not a nod
None of these is measured or agreed. They are defensible starting points. The two most consequential — `NFR-REL-001` availability and `NFR-SCALE-001` concurrency — determine infrastructure cost and should be settled before System Design, not after. [`OQ-008`](#/open-questions)
:::
