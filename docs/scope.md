# Product Scope

Scope is defined against two axes that must not be confused:

| Axis | Question it answers |
|---|---|
| **Delivery scope** | What gets *built* for the MVP release |
| **Commercial scope** | What each *Plan* is entitled to once built |

These are different. The MVP builds the complete core engine, then plans expose subsets of it — `{Derived}` from `resources-1.md` §32, which argues explicitly against making the development MVP identical to the Basic plan.

---

## 1. MVP definition

> **An organization can register, start a trial, configure its workspace, invite people, organize them into teams, create projects and tasks, have members track time through a desktop application both online and offline, capture screenshots and activity, manage schedules, attendance, breaks and leave, submit and approve timesheets, prepare payroll, and generate management reports — with tenant isolation, entitlement enforcement, audit logging and retention in place.**

`{Derived}` — adapted from `resources-1.md` §38, extended with the audit, retention and entitlement controls that section omits.

### The MVP is not done until all of these are true

| Gate | Why it is a gate and not a nice-to-have |
|---|---|
| Offline tracking survives a network outage and syncs exactly once | The product's core promise. A time tracker that loses time is not sellable |
| No request can read another organization's data under any code path | A single leak ends the product commercially |
| Payroll figures cannot include unapproved time | Financial correctness |
| An employee can see everything captured about them | Privacy position and dispute defence |
| Retention deletes expired data, in object storage **and** the database | Both a commercial commitment `{Confirmed}` and a cost control |
| Every permission-relevant change is in the audit log | Dispute resolution and accountability |

---

## 2. In scope for MVP

Grouped by module. Full requirements in [Functional Requirements](#/functional-requirements); module detail in [Product Modules](#/product-modules).

### Foundation

| Capability | Priority | Evidence |
|---|---|---|
| Registration, email verification, login, logout, password reset and change | {P0} | {Derived} |
| Session and device-token management, token revocation | {P0} | {Derived} |
| Organization creation, settings (timezone, country, currency, formats, week start) | {P0} | {Derived} |
| Membership model: one User across many Organizations | {P0} | {Derived} |
| Invitation, acceptance, resend, revoke | {P0} | {Derived} |
| Roles and permissions, four system roles | {P0} | {Derived} |
| Organization switching | {P1} | {Derived} |
| Platform administration: organizations, subscriptions, suspension | {P1} | {Derived} |

### Work management

| Capability | Priority | Evidence |
|---|---|---|
| Teams: create, rename, archive, assign members, assign manager | {P0} | {Confirmed} — "Groups / teams", all plans |
| Projects: create, edit, archive, assign members | {P0} | {Confirmed} — "Projects and tasks report", all plans |
| Tasks: create, edit, assign, complete | {P0} | {Confirmed} |

### Tracking

| Capability | Priority | Evidence |
|---|---|---|
| Desktop tracker for Windows and macOS | {P0} | {Confirmed} platforms; {Derived} MVP subset — see `CONF-04` |
| Desktop tracker for Linux | {P1} | {Confirmed} |
| Start / pause / resume / stop, project and task selection | {P0} | {Confirmed} — "User controlled ... tracking" |
| Automatic tracking mode | {P1} | {Confirmed} feature, {Proposed} behaviour — `GAP-04` |
| Idle detection with a configurable threshold | {P0} | {Derived} |
| Offline capture and idempotent synchronisation | {P0} | {Confirmed} — "Online / offline tracking", all plans |
| Server-side derivation of time entries from events | {P0} | {Derived} |
| Manual time entry with reason and attribution | {P0} | {Derived} + `GAP-06` |
| Device registration and revocation | {P0} | {Derived} |

### Monitoring

| Capability | Priority | Evidence |
|---|---|---|
| Screenshot capture, upload, viewing, deletion | {P0} | {Confirmed} — all plans |
| Activity events: keyboard/mouse counts, activity percentage | {P0} | {Confirmed} — Standard+ |
| Application usage | {P0} | {Confirmed} — Standard+ |
| Website usage by domain | {P0} | {Confirmed} — Standard+ |
| Productivity rules, organization-configured | {P0} | {Confirmed} — Standard+ |
| Inactivity alerts | {P1} | {Confirmed} feature, {Proposed} thresholds — `GAP-02` |
| Employee self-visibility over own monitoring data | {P0} | {Proposed} — `GAP-07` |

### Workforce

| Capability | Priority | Evidence |
|---|---|---|
| Schedules and shifts, including overnight shifts | {P0} | {Confirmed} — Standard+ |
| Dated schedule assignment per member | {P0} | {Derived} |
| Attendance derivation, comparing worked against expected | {P0} | {Confirmed} — Standard+ |
| Breaks: start, end, history, type | {P0} | {Confirmed} — Standard+ |
| Leave types, requests, approval, calendar | {P0} | {Confirmed} — Standard+ |
| Organization holiday calendar | {P1} | {Proposed} — `GAP-13` |

### Approval and pay

| Capability | Priority | Evidence |
|---|---|---|
| Timesheets: generation, review, submission | {P0} | {Confirmed} — "Time approvals", Standard+ |
| Approval, rejection, changes requested, with history | {P0} | {Confirmed} |
| Pay rates with effective dates and per-member currency | {P0} | {Derived} |
| Payroll periods, calculation from approved time only | {P0} | {Confirmed} — "Payroll", Standard+ |
| Payroll adjustments as a single amount | {P1} | {Derived}, with the limitation in `GAP-20` |
| Payroll CSV export | {P0} | {Derived} |

### Reporting

| Capability | Priority | Evidence |
|---|---|---|
| Hours, timeline, project, task, member, team reports | {P0} | {Confirmed} — all plans |
| Attendance, activity, screenshot, timesheet, payroll reports | {P0} | {Confirmed} — Standard+ |
| Individual and team dashboards | {P0} | {Confirmed} — all plans |
| Filtering, sorting, pagination, CSV export on every report | {P0} | {Derived} |

### Platform

| Capability | Priority | Evidence |
|---|---|---|
| In-app and email notifications with per-membership preferences | {P0} | {Derived} |
| Real-time notification delivery | {P1} | {Confirmed} — Standard+, transport undecided `GAP-05` |
| Append-only audit logging | {P0} | {Derived} — `resources-1.md` §28 |
| Retention policy configuration and scheduled enforcement | {P0} | {Confirmed} — retention periods per plan |
| Plans, features, entitlement resolution and enforcement | {P0} | {Confirmed} — three plans |
| Trial, subscription lifecycle, payment method, invoices | {P0} | {Derived} |
| Seat counting and limit enforcement | {P1} | {Proposed} — `GAP-09` |

### Premium capabilities (built in MVP, sold as Premium)

| Capability | Priority | Evidence |
|---|---|---|
| Video screen recording, chunked, resumable | {P1} | {Confirmed} — Premium only |
| Office vs Remote classification from network observation | {P2} | {Confirmed} — Premium only |
| Internet connectivity reporting | {P2} | {Confirmed} — Premium only |
| Executive dashboard | {P3} | {Confirmed} feature, **undefined content** — `GAP-03` |

:::warning Premium is the descope candidate
If schedule pressure forces a cut, the Premium capabilities above are the correct thing to defer — they are the only `{Confirmed}` features not required for a Basic or Standard customer to get complete value. Deferring them means **Premium cannot be sold at launch**, which is a commercial decision, not an engineering one. See [`OQ-013`](#/open-questions).
:::

---

## 3. Out of scope

### Out of scope permanently

| Excluded | Reason |
|---|---|
| Payment disbursement / payroll filing | The product prepares and exports figures; it does not pay people. See [Product Vision](#/product-vision) §9 |
| Project management (boards, dependencies, sprints, resourcing) | Projects exist as time attribution targets only |
| HR system of record (contracts, reviews, benefits, org charts) | Leave requests are recorded; employment is not managed |
| Keystroke or screen-content capture beyond screenshots and screen video | Explicit privacy boundary — `{Proposed}`, see [Security & Privacy](#/security-privacy) |
| Individual performance scoring or ranking | Productivity Rules classify applications, not people |
| Covert or hidden monitoring | The tracker must be visibly running and its capture disclosed to the tracked member `{Proposed}` |

### Out of scope for MVP — deferred with a home

Everything marked *"This feature will be added in the future release"* in the matrix `{Confirmed}`, plus items the research places beyond MVP.

| Deferred | Target | Source |
|---|---|---|
| Meeting insights | {Future} | {Confirmed} future release |
| Software cost insights | {Future} | {Confirmed} future release |
| Benchmarks AI | {Future} | {Confirmed} future release |
| Unusual activity report | {Future} | {Confirmed} future release |
| Open API access | {V2} | {Confirmed} future release |
| 60+ browser integrations (Chrome, Firefox) | {V2} | {Confirmed} future release |
| Client login access | {V2} | {Confirmed} future release |
| Single Sign-On | {V2} | {Confirmed} future release |
| Automatic user provisioning (SCIM) | {Future} | {Confirmed} future release |
| BigQuery access | {Future} | {Confirmed} future release |
| HRIS integration | {Future} | {Confirmed} future release |
| Support: ticket portal, knowledge base, live chat, callback, dedicated account manager | {Future} | {Confirmed} future release — but see `CONF-12` |
| Mobile applications (iOS, Android) | {V1.1} | {Derived} — conflicts with the matrix, see `CONF-04` |
| Chrome application / browser tracking client | {V1.1} | {Derived} — same conflict |
| Leave balances and accrual | {V1.1} | `CONF-09` |
| Overtime rules and calculation | {V1.1} | `CONF-10` |
| Itemised payroll adjustments with audit trail | {V1.1} | `GAP-20` |
| Aggregate reporting tables and pre-computed statistics | {V1.1} | {Derived} — introduce on demonstrated need, `resources-6.md` §6 |
| PostgreSQL table partitioning | {V1.1} | {Derived} — `resources-10.md` §32, explicitly not at MVP |
| Row-level security as a second isolation layer | {V1.1} | {Derived} — `resources-2.md` §2 |
| Multiple concurrent subscriptions, add-ons, usage-based billing | {V2} | {Derived} — `resources-13.md` §50 |
| Video transcoding pipeline | {V2} | {Derived} — only if playback compatibility demands it |

---

## 4. Commercial scope by plan

Derived **only** from the verified feature matrix. Anything the matrix marks as future release is absent from every plan — see `CONF-03`.

| Feature code | Capability | Basic | Standard | Premium |
|---|---|---|---|---|
| `time_tracking` | Time tracking, online and offline, manual or automatic | ✓ | ✓ | ✓ |
| `screenshots` | Screenshot capture and viewing | ✓ | ✓ | ✓ |
| `projects_tasks_report` | Projects and tasks report | ✓ | ✓ | ✓ |
| `hours_report` | Hours tracked | ✓ | ✓ | ✓ |
| `timeline_report` | Timeline report | ✓ | ✓ | ✓ |
| `teams` | Groups / teams | ✓ | ✓ | ✓ |
| `dashboards` | Individual and team dashboards | ✓ | ✓ | ✓ |
| `activity_summary` | Activity summary | — | ✓ | ✓ |
| `inactivity_alerts` | Inactivity alerts | — | ✓ | ✓ |
| `web_app_usage` | Web and app usage | — | ✓ | ✓ |
| `productivity_ratings` | Configurable productivity ratings | — | ✓ | ✓ |
| `attendance` | Attendance | — | ✓ | ✓ |
| `breaks` | Break tracking | — | ✓ | ✓ |
| `leave` | Leave tracking | — | ✓ | ✓ |
| `payroll` | Payroll preparation | — | ✓ | ✓ |
| `schedules` | Schedules | — | ✓ | ✓ |
| `work_life_balance` | Work-life balance metrics | — | ✓ | ✓ |
| `time_approvals` | Time approvals | — | ✓ | ✓ |
| `realtime_notifications` | Real-time notifications | — | ✓ | ✓ |
| `office_remote` | Office vs Remote report | — | — | ✓ |
| `internet_connectivity` | Internet connectivity | — | — | ✓ |
| `video_recording` | Video screen recording | — | — | ✓ |
| `executive_dashboard` | Executive dashboard and reporting | — | — | ✓ |
| `retention_months` | Historical tracking data | **3** | **6** | **24** |

:::warning Two entitlements cannot be specified
`work_life_balance` and `executive_dashboard` are sold in the matrix but have **no defined behaviour anywhere in the source material** (`GAP-01`, `GAP-03`). They are listed here because they are commercially committed, and they are the two features that cannot be built from this documentation. See [`OQ-004`](#/open-questions) and [`OQ-005`](#/open-questions).
:::

### Entitlements deliberately absent from every plan

`api_access` · `sso` · `client_access` · `automatic_user_provisioning` · `bigquery_access` · `hris_integration` · `browser_integrations` · `meeting_insights` · `software_cost_insights` · `benchmarks_ai` · `unusual_activity_report`

These must not be seeded as Premium entitlements. `resources-13.md` §46 shows an example that does exactly that; following it would advertise four capabilities that do not exist. See `CONF-03`.

---

## 5. Scope boundaries that will be tested

Predictable pressure points, recorded so the answer is decided once rather than argued repeatedly.

| Pressure | Answer | Rule |
|---|---|---|
| "Can Basic customers get attendance? They keep asking" | No. Attendance is Standard+ in the matrix. Change the matrix, not the code | [`BR-BILL-001`](#/business-rules) |
| "Can we just check the plan name in this one place?" | No. All entitlement decisions go through the entitlement service | [`BR-BILL-002`](#/business-rules) |
| "The frontend already hides it, do we need the API check?" | Yes. The API is the only authority | [`BR-BILL-003`](#/business-rules) |
| "Can payroll read time entries directly? It's faster" | No. Approved timesheet time only | [`BR-PAY-001`](#/business-rules) |
| "Can we let managers edit approved timesheets?" | Not as an edit. Only via an audited reopen | [`BR-TS-006`](#/business-rules) |
| "Can we store the full URL? It's more useful for reports" | Domain by default; path only where a requirement justifies it | [`BR-MON-004`](#/business-rules) |
| "Can we keep data past retention for support purposes?" | No. Retention is a commercial commitment and a cost control | [`BR-DATA-001`](#/business-rules) |
| "Can the tracker run hidden so employees don't disable it?" | No | [`BR-MON-008`](#/business-rules) |

---

## 6. Scope risks

| Risk | Detail | Registered as |
|---|---|---|
| Matrix promises platforms MVP will not ship | Mobile and Chrome apps sold in Basic | [`RISK-002`](#/risks) |
| Two sold features cannot be specified | `work_life_balance`, `executive_dashboard` | [`RISK-003`](#/risks) |
| Premium is three features deep and last to be built | Slippage means Premium cannot be sold | [`RISK-004`](#/risks) |
| Desktop tracker is the largest single unknown | Idle detection, screen capture, recording and offline storage across three OSes | [`RISK-001`](#/risks) |
| MVP as defined is large | 22 modules, ~50 entities, three clients | [`RISK-006`](#/risks) |
