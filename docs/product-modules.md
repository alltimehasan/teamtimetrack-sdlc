# Product Modules

Twenty-two functional modules, grouped into five layers. Module codes are the same codes used by `REQ-*` and `BR-*` identifiers, so every requirement traces to exactly one module.

```text
┌──────────────────────────────────────────────────────────────┐
│  L5  PLATFORM        NOTIF · BILL · AUDIT · DATA · ADMIN     │
├──────────────────────────────────────────────────────────────┤
│  L4  BUSINESS        TS · PAY · REPORT                       │
├──────────────────────────────────────────────────────────────┤
│  L3  WORKFORCE       SCHED · ATT · LEAVE                     │
├──────────────────────────────────────────────────────────────┤
│  L2  CAPTURE         DEV · TIME · SYNC · MON · REC           │
├──────────────────────────────────────────────────────────────┤
│  L1  FOUNDATION      AUTH · ORG · USER · RBAC · TEAM · PROJ  │
└──────────────────────────────────────────────────────────────┘
                    each layer depends only downward
```

The layering is a dependency rule, not a diagram convention: **no module may depend on a module in a higher layer.** A capture module that needed to know about payroll would be a design defect.

---

## Layer 1 — Foundation

### AUTH · Authentication & Identity {MVP} {P0}

| | |
|---|---|
| **Purpose** | Establish who a person is, globally, independent of any organization |
| **Primary users** | All |
| **Core functionality** | Registration; email verification; login and logout; password reset and change; session management; desktop device tokens; token revocation; account deactivation; rate limiting on credential endpoints |
| **Depends on** | Nothing |
| **Depended on by** | Every module |
| **Business value** | Precondition for everything. Also the primary attack surface |
| **Evidence** | {Derived} — absent from the feature matrix, correctly identified as a gap in `resources-1.md` §6 |

:::note Two client types, two authentication shapes
The web application uses secure, HttpOnly, SameSite cookies; the desktop tracker uses a device-scoped token held in OS credential storage. Browsers must never hold long-lived tokens in local storage. `{Derived}` `resources-2.md` §5.
:::

### ORG · Organization Management {MVP} {P0}

| | |
|---|---|
| **Purpose** | Define the tenant and its operating configuration |
| **Primary users** | Owner, Administrator |
| **Core functionality** | Organization creation; identity settings (name, slug, logo); locale settings (timezone, country, currency, date/time format, week start); working-day defaults; monitoring settings (screenshot interval, idle threshold, tracking mode); organization status lifecycle; organization switching |
| **Depends on** | AUTH |
| **Depended on by** | Every tenant-scoped module |
| **Business value** | The tenant boundary. Every isolation guarantee in the product is anchored here |
| **Evidence** | {Derived} |

### USER · Membership & User Management {MVP} {P0}

| | |
|---|---|
| **Purpose** | Connect global Users to Organizations and manage their lifecycle inside one |
| **Primary users** | Administrator, Owner |
| **Core functionality** | Invitation issue, resend, revoke, accept and expiry; membership creation; activation, suspension and removal; profile within an organization; manager assignment; membership status lifecycle |
| **Depends on** | AUTH, ORG |
| **Depended on by** | RBAC, TEAM, PROJ, DEV, TIME, all workforce and business modules |
| **Business value** | Membership is the authorization context for the entire product |
| **Evidence** | {Derived} — invitation-based provisioning is the MVP mechanism because automatic provisioning is future release {Confirmed} |

### RBAC · Roles & Permissions {MVP} {P0}

| | |
|---|---|
| **Purpose** | Decide what a Member may do inside one Organization |
| **Primary users** | Administrator, Owner |
| **Core functionality** | System roles (Owner, Administrator, Manager, Employee); permission catalogue; role-to-permission mapping; membership-to-role assignment; manager scope resolution; permission evaluation |
| **Depends on** | USER, ORG |
| **Depended on by** | Every module that exposes an action |
| **Business value** | Correct authorization is the difference between a multi-tenant product and a data breach |
| **Evidence** | {Derived} |

:::warning Permission is not entitlement
RBAC answers "may this person do this?". BILL answers "has this organization bought this?". Both must pass. Conflating them is the single most likely source of an entitlement bypass. [`BR-BILL-001`](#/business-rules)
:::

### TEAM · Teams {MVP} {P0}

| | |
|---|---|
| **Purpose** | Group Members for management scope and reporting |
| **Primary users** | Administrator, Manager |
| **Core functionality** | Create, rename, archive; assign and remove members; assign a managing Member; team-scoped reporting |
| **Depends on** | USER |
| **Depended on by** | REPORT, TS, ATT, RBAC (manager scope) |
| **Business value** | Makes management scope explicit rather than implicit |
| **Evidence** | {Confirmed} — "Groups / teams", available in all plans |

:::note Team is not a role
A Member's Team says *who they work with*; their Role says *what they can do*. A person can be a Manager without a team, and be in a team without managing it. `resources-1.md` §9 makes this point explicitly and it is preserved here.
:::

### PROJ · Projects & Tasks {MVP} {P0}

| | |
|---|---|
| **Purpose** | Provide the targets that tracked time is attributed to |
| **Primary users** | Administrator, Manager, Employee |
| **Core functionality** | Project create, edit, archive, status; explicit project membership; task create, edit, assign, complete, priority, due date; project and task selection from the tracker |
| **Depends on** | ORG, USER |
| **Depended on by** | TIME, MON, REC, REPORT |
| **Business value** | Without attribution, tracked hours cannot be costed, billed or analysed |
| **Evidence** | {Confirmed} — "Projects and tasks report", all plans |

---

## Layer 2 — Capture

### DEV · Devices & Desktop Tracker {MVP} {P0}

| | |
|---|---|
| **Purpose** | The installed application that captures work, and the registry of installations |
| **Primary users** | Employee (uses), Administrator (oversees) |
| **Core functionality** | Device registration and naming; platform and version reporting; last-seen tracking; device revocation; tracker authentication; timer and tray presentation; project/task selection; connection and sync status display; local capture store; auto-update |
| **Depends on** | AUTH, USER |
| **Depended on by** | TIME, SYNC, MON, REC |
| **Business value** | The primary capture surface. Product quality is perceived here before anywhere else |
| **Evidence** | {Confirmed} platforms; {Derived} that desktop precedes mobile — see `CONF-04` |

:::warning Highest-uncertainty module in the product
Idle detection, screen capture, screen recording, application and window focus detection, and durable local storage all behave differently on Windows, macOS and Linux — and several require OS permission grants that a user can refuse. This is [`RISK-001`](#/risks) and the strongest candidate for an early technical spike.
:::

### TIME · Time Tracking Engine {MVP} {P0}

| | |
|---|---|
| **Purpose** | Turn capture into correct, correctable work intervals |
| **Primary users** | Employee (produces), Manager (reviews) |
| **Core functionality** | Session start, pause, resume, stop; tracking event recording; project and task switching mid-session; idle detection and idle-period resolution; **server-side derivation of time entries from events**; manual time entry with reason and attribution; time entry correction; automatic tracking mode |
| **Depends on** | DEV, PROJ, USER |
| **Depended on by** | SYNC, ATT, TS, PAY, REPORT |
| **Business value** | The product's core. Every number downstream originates here |
| **Evidence** | {Confirmed} — "User controlled or automatic tracking", "Online / offline tracking", "Hours tracked", all plans |

:::note Events and entries are different things
Tracking Events are immutable facts from a device. Time Entries are the server's derived interpretation of them, and may be corrected by a person. Keeping them separate is what allows time to be corrected without destroying evidence, and evidence to be re-derived without losing corrections. `{Derived}` `resources-3.md` §58.
:::

### SYNC · Offline Synchronisation {MVP} {P0}

| | |
|---|---|
| **Purpose** | Guarantee that work captured without a network arrives exactly once |
| **Primary users** | Employee (invisible), Platform Operations (monitors) |
| **Core functionality** | Local durable queue; batch submission; **idempotency via client-generated event identifiers**; retry with backoff; conflict resolution; sync status reporting to the member; sync health metrics per device and organization |
| **Depends on** | DEV, TIME |
| **Depended on by** | TIME, MON, REC |
| **Business value** | A time tracker that loses time is not sellable. This module is the difference |
| **Evidence** | {Confirmed} — "Online / offline tracking", all plans |

### MON · Activity Monitoring {MVP} {P0}/{P1}

| | |
|---|---|
| **Purpose** | Capture evidence of how tracked time was spent |
| **Primary users** | Employee (subject), Manager (reviewer) |
| **Core functionality** | Screenshot capture, upload and viewing {P0}; activity events with keyboard/mouse counts and activity percentage {P0}; application usage {P0}; website usage by domain {P0}; organization-configured productivity rules {P0}; inactivity alerts {P1}; **member self-visibility over all of the above** {P0}; deletion requests {P1} |
| **Depends on** | DEV, TIME, ORG |
| **Depended on by** | REPORT, DATA |
| **Business value** | The evidence layer that makes tracked time defensible — and the product's largest privacy surface |
| **Evidence** | Screenshots {Confirmed} all plans; activity, web/app usage, productivity ratings, inactivity alerts {Confirmed} Standard+; self-visibility {Proposed} `GAP-07` |

### REC · Video Screen Recording {MVP-build} {P1} {Premium}

| | |
|---|---|
| **Purpose** | Capture screen video for organizations that require it |
| **Primary users** | Employee (subject), Manager (reviewer) |
| **Core functionality** | Chunked segment recording; direct segment upload to object storage; recording assembly and status lifecycle; playback with authorization; separate enablement and separate permission from screenshots; visible recording indication |
| **Depends on** | DEV, TIME, BILL |
| **Depended on by** | REPORT, DATA |
| **Business value** | The only Premium capture capability; a meaningful tier differentiator |
| **Evidence** | {Confirmed} — Premium only |

:::note Chunking is a correctness requirement, not an optimisation
A two-hour recording assembled in memory is lost entirely if the machine crashes at minute 90. Segmented recording means a crash costs one segment. `{Derived}` `resources-2.md` §9.
:::

---

## Layer 3 — Workforce

### SCHED · Schedules {MVP} {P0} {Standard}

| | |
|---|---|
| **Purpose** | Define what work *should* have happened |
| **Primary users** | Administrator |
| **Core functionality** | Named schedules with their own timezone; per-day shifts including **overnight shifts crossing midnight**; expected break duration and minimum work time; dated schedule assignment per member; organization holiday calendar {P1} {Proposed} |
| **Depends on** | ORG, USER |
| **Depended on by** | ATT, REPORT |
| **Business value** | Without an expectation, attendance has nothing to compare against |
| **Evidence** | {Confirmed} — Standard+ |

### ATT · Attendance & Breaks {MVP} {P0} {Standard}

| | |
|---|---|
| **Purpose** | Reconcile expected work against actual work, per member per day |
| **Primary users** | Manager, Administrator |
| **Core functionality** | Daily attendance derivation; first and last activity; worked vs scheduled seconds; lateness and early departure; attendance status; break start, end, type and history; leave and holiday incorporation |
| **Depends on** | SCHED, TIME, LEAVE |
| **Depended on by** | REPORT, PAY |
| **Business value** | "Worked as agreed" is a different and more valuable question than "hours worked" |
| **Evidence** | {Confirmed} — Attendance and Break tracking, Standard+ |

:::note Attendance is derived, never entered
An attendance record is recomputable from schedule + tracking + leave. If it disagrees with its inputs, the inputs win and the record is regenerated. `{Derived}` `resources-11.md` §31.
:::

### LEAVE · Leave Management {MVP} {P0} {Standard}

| | |
|---|---|
| **Purpose** | Record and approve planned absence |
| **Primary users** | Employee (requests), Manager (approves) |
| **Core functionality** | Organization-defined leave types with paid and approval-required flags; request submission; approval, rejection, cancellation; leave calendar; leave history; attendance integration |
| **Depends on** | USER, ORG |
| **Depended on by** | ATT, REPORT |
| **Business value** | Prevents approved absence being recorded as absenteeism |
| **Evidence** | {Confirmed} — Standard+ |
| **Known limitation** | **No leave balances or accrual at MVP.** `CONF-09`, [`OQ-011`](#/open-questions) |

---

## Layer 4 — Business

### TS · Timesheets & Approvals {MVP} {P0} {Standard}

| | |
|---|---|
| **Purpose** | Turn tracked time into approved time |
| **Primary users** | Employee (submits), Manager (decides) |
| **Core functionality** | Timesheet generation per configured period; inclusion of time entries with **duration snapshots**; draft/submitted/approved/rejected state machine; approval, rejection and changes-requested with mandatory comment on non-approval; append-only approval history; controlled reopening of approved timesheets |
| **Depends on** | TIME, USER, RBAC |
| **Depended on by** | PAY, REPORT |
| **Business value** | The governance gate between observation and payment |
| **Evidence** | {Confirmed} — "Time approvals", Standard+ |

### PAY · Payroll Preparation {MVP} {P0} {Standard}

| | |
|---|---|
| **Purpose** | Convert approved time into payable amounts and export them |
| **Primary users** | Owner, Administrator (finance-facing) |
| **Core functionality** | Effective-dated pay rates with per-member currency; payroll period lifecycle; calculation **exclusively from approved timesheet time**; rate snapshotting onto each entry; single-amount adjustments; CSV export |
| **Depends on** | TS, USER |
| **Depended on by** | REPORT |
| **Business value** | The commercial payoff of the whole evidence chain |
| **Evidence** | {Confirmed} — Standard+ |
| **Deliberate exclusions** | No disbursement, no tax, no overtime calculation, no itemised adjustments at MVP. `CONF-10`, `GAP-20` |

:::warning Naming matters here
The matrix calls this "Payroll". What is built is **payroll preparation and export**. A finance buyer who expects tax handling and disbursement will treat the difference as a defect. See [Product Analysis](#/product-analysis) §6.
:::

### REPORT · Reporting & Dashboards {MVP} {P0}

| | |
|---|---|
| **Purpose** | Answer questions across every other module |
| **Primary users** | All |
| **Core functionality** | Eleven reports — hours, timeline, project, task, member, team, attendance, activity, screenshot, timesheet, payroll; a common filter model (date range, member, team, project, task); search, sort, pagination, CSV export; individual, team and organization dashboards; Premium Office vs Remote and Internet connectivity reports; Premium executive dashboard {Undefined} |
| **Depends on** | Every capture, workforce and business module |
| **Depended on by** | Nothing |
| **Business value** | The surface where the product's value becomes visible to a buyer |
| **Evidence** | {Confirmed} — hours, timeline, projects/tasks, dashboards all plans; attendance/activity Standard+; Office vs Remote, connectivity, executive dashboard Premium |

:::note Reports are queries, not entities
No report is stored as a domain object. Pre-computed aggregate tables are a deliberate {V1.1} decision, introduced only on demonstrated performance need. `{Derived}` `resources-6.md` §6.
:::

---

## Layer 5 — Platform

### NOTIF · Notifications {MVP} {P0}/{P1}

| | |
|---|---|
| **Purpose** | Tell people that something requires their attention |
| **Primary users** | All |
| **Core functionality** | In-app notification store and read state; email delivery; per-membership, per-type preferences; queued asynchronous delivery; real-time push {P1} {Standard} |
| **Depends on** | USER, ORG |
| **Depended on by** | TS, LEAVE, MON, BILL |
| **Business value** | Approvals and alerts have no value if nobody sees them |
| **Evidence** | {Confirmed} — "Real-time notifications", Standard+; the rest {Derived}. Transport undecided, `GAP-05` |

### BILL · Plans, Subscriptions & Entitlements {MVP} {P0}

| | |
|---|---|
| **Purpose** | Decide, in one place, what an Organization has bought |
| **Primary users** | Owner (subscribes), every module (asks) |
| **Core functionality** | Plan and feature catalogue; plan-to-feature mapping with typed limits; trial; subscription lifecycle; payment method and invoice history; **a single entitlement resolution service**; API-side feature gating; seat counting and limits {P1} |
| **Depends on** | ORG |
| **Depended on by** | MON, REC, ATT, SCHED, LEAVE, TS, PAY, REPORT, NOTIF, DATA |
| **Business value** | Turns the plan matrix from a sales document into an enforced product boundary |
| **Evidence** | {Confirmed} — three plans with differentiated features; {Derived} for lifecycle and trial |

:::warning One resolution path, no exceptions
Every entitlement question resolves through the entitlement service. A single `if (plan === 'premium')` anywhere in the codebase is the beginning of a maintenance failure that `resources-13.md` §53 describes precisely. [`BR-BILL-002`](#/business-rules)
:::

### AUDIT · Audit Logging {MVP} {P0}

| | |
|---|---|
| **Purpose** | Record who changed what, when, and from what to what |
| **Primary users** | Administrator, Owner (read); every module (writes) |
| **Core functionality** | Append-only event capture; actor, action, entity, before and after values, IP and user agent; **nullable actor for system-initiated actions**; organization-scoped audit browsing and filtering |
| **Depends on** | ORG, USER |
| **Depended on by** | Nothing — deliberately, so audit can never be circumvented by a dependency |
| **Business value** | Payroll disputes, employment disputes and security incidents are all unanswerable without it |
| **Evidence** | {Derived} — absent from the matrix; `resources-1.md` §28 recommends it as mandatory and this documentation agrees |

### DATA · Data Retention & Deletion {MVP} {P0}

| | |
|---|---|
| **Purpose** | Ensure data is kept exactly as long as it should be, and no longer |
| **Primary users** | Administrator (configures), the system (executes) |
| **Core functionality** | Per-data-type retention policy bounded by the plan entitlement; scheduled expiry identification; **object-storage deletion before metadata deletion**; deletion audit records; organization data export {P1}; member data export and erasure request handling {P1} |
| **Depends on** | BILL, MON, REC, TIME, AUDIT |
| **Depended on by** | Nothing |
| **Business value** | A commercial commitment (3/6/24 months), a cost control, and a privacy obligation simultaneously |
| **Evidence** | {Confirmed} — retention periods per plan; {Derived} for mechanism; {Proposed} for subject-rights workflows `GAP-08` |

### ADMIN · Platform Administration {MVP} {P1}

| | |
|---|---|
| **Purpose** | Let the vendor operate the platform |
| **Primary users** | Platform Administrator |
| **Core functionality** | Organization listing, suspension, reinstatement, closure; subscription administration; plan and feature catalogue management; platform-wide health — sync failure rate, queue depth, failed jobs, upload failures; **audited, time-bounded support elevation** |
| **Depends on** | ORG, BILL, AUDIT |
| **Depended on by** | Nothing |
| **Business value** | Without it the platform cannot be operated; with it done badly, the vendor becomes the privacy risk |
| **Evidence** | {Derived} from `resources-1.md` §4; elevation model {Proposed}. `GAP-15` |

---

## Dependency summary

Read as: **row depends on column**.

| Module | L1 | DEV | TIME | SYNC | MON | SCHED | ATT | LEAVE | TS | BILL | AUDIT |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DEV | ✔ | | | | | | | | | | ✔ |
| TIME | ✔ | ✔ | | | | | | | | | ✔ |
| SYNC | ✔ | ✔ | ✔ | | | | | | | | |
| MON | ✔ | ✔ | ✔ | ✔ | | | | | | ✔ | ✔ |
| REC | ✔ | ✔ | ✔ | ✔ | | | | | | ✔ | ✔ |
| SCHED | ✔ | | | | | | | | | ✔ | ✔ |
| ATT | ✔ | | ✔ | | | ✔ | | ✔ | | ✔ | ✔ |
| LEAVE | ✔ | | | | | | | | | ✔ | ✔ |
| TS | ✔ | | ✔ | | | | | | | ✔ | ✔ |
| PAY | ✔ | | | | | | ✔ | | ✔ | ✔ | ✔ |
| REPORT | ✔ | ✔ | ✔ | | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | |
| NOTIF | ✔ | | | | | | | | | ✔ | |
| BILL | ✔ | | | | | | | | | | ✔ |
| DATA | ✔ | | ✔ | | ✔ | | | | | ✔ | ✔ |
| ADMIN | ✔ | | | | | | | | | ✔ | ✔ |

### Critical path

```text
AUTH → ORG → USER → RBAC → PROJ → DEV → TIME → SYNC
                                            ↓
                            SCHED → ATT → TS → PAY
                                            ↓
                                         REPORT
```

Everything on this path is `{P0}`. A slip in `DEV`, `TIME` or `SYNC` delays every module downstream of it, which is why they are sequenced first in [Project Planning](#/project-planning).

### Modules that can be built in parallel

`TEAM` · `LEAVE` · `NOTIF` · `AUDIT` · `BILL` · `ADMIN` — none blocks the critical path, and `AUDIT` and `BILL` should nevertheless be built early because retrofitting them into completed modules is significantly more expensive than building alongside.

---

## MVP classification summary

| Classification | Modules |
|---|---|
| **{MVP} {P0}** — launch blockers | AUTH, ORG, USER, RBAC, TEAM, PROJ, DEV, TIME, SYNC, MON (core), SCHED, ATT, LEAVE, TS, PAY, REPORT (core), NOTIF (core), BILL, AUDIT, DATA |
| **{MVP} {P1}** — targeted, descopeable | REC, ADMIN, MON (inactivity alerts, deletion requests), NOTIF (real-time), REPORT (Premium reports), BILL (seat limits) |
| **{V1.1} {P2}** | Office vs Remote, Internet connectivity, leave balances, overtime, itemised payroll adjustments, aggregate reporting tables, mobile client |
| **{Future} {P3}** | Executive dashboard, work-life balance metrics, and every feature the matrix marks future release |
