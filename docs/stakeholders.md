# Stakeholders

Stakeholders fall into three classes. Confusing them is the most common source of authorization defects in multi-tenant products.

| Class | Who | Data boundary |
|---|---|---|
| **Platform-side** | The vendor operating Team Time Track | Operates the platform. No default access to tenant business data |
| **Organization-side** | People inside a customer organization | Access scoped to their organization, further scoped by role |
| **External** | Parties outside both | No access at MVP |

---

## 1. Platform-side stakeholders

### Platform Administrator {Derived}

The vendor's internal operator. Appears in `resources-1.md` §4 with real responsibilities but has no data model, permissions or requirements anywhere else in the research — recorded as `GAP-15`.

| | |
|---|---|
| **Goals** | Keep the platform healthy; onboard and support customer organizations; manage plans and subscriptions; respond to incidents |
| **Responsibilities** | Organization lifecycle (create, suspend, reinstate, close); subscription administration; plan and feature catalogue; platform-wide health monitoring; handling lawful data requests |
| **Permissions** | Full control over organization *records*, subscriptions and the plan catalogue. **No default read access to tenant business data** — time entries, screenshots, recordings, reports |
| **Interactions** | A separate platform administration surface, isolated from the organization application |
| **Key constraint** | Any access to tenant business data must be an explicit, time-bounded, audited elevation with a recorded reason. `{Proposed}` — [`REQ-ADMIN-005`](#/functional-requirements) |

:::warning A "super admin who can see everything" is not acceptable in this product
This platform stores screenshots and screen recordings of people at work. An unaudited vendor-side view of that data is a serious privacy exposure and a serious contractual one. Support access must be requested, justified, time-limited and logged. See [`RISK-011`](#/risks).
:::

### Vendor Support {Future}

All support channels are marked future release in the feature matrix `{Confirmed}` — including email, which is almost certainly a source-document defect (`CONF-12`, [`OQ-003`](#/open-questions)). No support tooling is scoped for MVP beyond the Platform Administrator surface.

### Vendor Engineering & Operations

| | |
|---|---|
| **Goals** | Deploy and operate reliably; diagnose sync, queue and upload failures before customers report them |
| **Responsibilities** | Deployment, monitoring, backup and restore, incident response, capacity |
| **Permissions** | Infrastructure access. Production data access follows the same audited-elevation rule as Platform Administrators |
| **Key metric** | Desktop tracker → API synchronisation failure rate. `resources-2.md` §18 calls this the critical monitored metric, because a time-tracking product that silently loses time is failing at its purpose |

---

## 2. Organization-side stakeholders

All four are Memberships inside one Organization. The same person may hold different roles in different organizations.

### Owner {Derived}

The person who created the Organization.

| | |
|---|---|
| **Goals** | Confidence that time and cost data is accurate; control of spend; no operational surprises |
| **Responsibilities** | Commercial relationship; plan selection; payment; ultimate accountability for organization policy, including monitoring policy |
| **Permissions** | Everything an Administrator has, **plus** subscription and billing management, plus ownership transfer and organization closure |
| **Interactions** | Web application. Rarely uses the desktop tracker unless they also do billable work |
| **Constraints** | Exactly one Owner per Organization at any time. Ownership is transferable, never deletable while the organization is active. [`BR-ORG-004`](#/business-rules) |
| **Cares most about** | Organization dashboard, payroll summary, subscription status, seat count |

### Administrator {Derived}

Day-to-day operator of the Organization.

| | |
|---|---|
| **Goals** | A correctly configured organization that produces accurate data without constant intervention |
| **Responsibilities** | People and memberships; teams; projects and tasks; schedules; leave types; productivity rules; monitoring settings; retention configuration; role assignment |
| **Permissions** | Full organization management **except** subscription, billing, ownership transfer and organization closure |
| **Interactions** | Web application, heavily. Configuration and exception handling |
| **Constraints** | Changes to monitoring settings, retention and roles are always audit-logged. [`BR-AUDIT-002`](#/business-rules) |
| **Cares most about** | Member management, settings, audit log, exception reports |

### Manager {Derived}

Responsible for a defined set of Members, usually via one or more Teams.

| | |
|---|---|
| **Goals** | Know what the team worked on; resolve anomalies quickly; approve time with confidence and without spending a day on it |
| **Responsibilities** | Reviewing tracked time, activity and evidence for their scope; approving or rejecting timesheets; approving leave; responding to inactivity alerts |
| **Permissions** | Read access to tracking, monitoring and reporting **for members in scope only**; timesheet approval; leave approval; manual time entry on behalf of members where the organization permits it |
| **Interactions** | Web application: team dashboard, timeline, screenshots, timesheets, reports |
| **Constraints** | Scope is bounded by team or explicit member assignment — a Manager is not an Administrator with a different label. [`BR-RBAC-004`](#/business-rules). A Manager may not approve their own timesheet. [`BR-TS-005`](#/business-rules) |
| **Cares most about** | Team dashboard, pending approvals, attendance exceptions, timeline |

### Employee {Derived}

The person whose work is tracked. **The highest-frequency user of the product and the one with the least power in it.**

| | |
|---|---|
| **Goals** | Track time without friction; be paid correctly; correct genuine mistakes; understand what is recorded about them |
| **Responsibilities** | Running the tracker during work; selecting project and task; declaring breaks; submitting timesheets; requesting leave |
| **Permissions** | Full read access to **their own** tracking, activity, screenshots, recordings, attendance, timesheets and pay rate. No access to other members' data |
| **Interactions** | Desktop tracker constantly; web application periodically for timesheets, leave and their own reports |
| **Constraints** | Cannot approve their own timesheet; cannot delete their own audit records; can request but not unilaterally perform deletion of captured evidence. [`REQ-MON-011`](#/functional-requirements) |
| **Cares most about** | Timer state, sync status, today's tracked time, their own timesheet |

:::note Contractors
`resources/` does not distinguish contractors from employees anywhere. This documentation treats a contractor as a Membership with the Employee role and an hourly Pay Rate — no separate role, no separate model. If contractors need different leave, schedule or approval behaviour, that is a product decision: [`OQ-018`](#/open-questions). `{Proposed}`
:::

---

## 3. Organization-side stakeholders without a system role

Real stakeholders who influence requirements but hold no login at MVP.

### Finance / Payroll {Derived}

| | |
|---|---|
| **Goals** | Payroll figures that are correct, reproducible and explainable when challenged |
| **Responsibilities** | Running payroll periods; applying adjustments; exporting to the actual payroll system |
| **Permissions** | At MVP this is an Administrator or Owner performing payroll actions. A dedicated `payroll_manager` role is anticipated in `resources-3.md` §6 but is not built at MVP |
| **Constraints** | Payroll may only consume approved time. [`BR-PAY-001`](#/business-rules) |
| **Open item** | Whether a separate Finance role is needed for MVP: [`OQ-019`](#/open-questions) |

### HR / People Operations {Derived}

| | |
|---|---|
| **Goals** | Attendance accuracy; leave records; defensible documentation in an employment dispute |
| **Permissions** | Administrator role at MVP |
| **Influence** | Drives requirements for attendance status vocabulary, leave types and the holiday calendar |

### Works councils, employee representatives, unions {Proposed}

| | |
|---|---|
| **Goals** | Ensure monitoring is proportionate, disclosed and lawful |
| **Influence** | In several jurisdictions, deploying monitoring software requires consultation or agreement. The product cannot resolve this, but it must make disclosure and proportionality **possible** — which is why granular monitoring settings and employee visibility are in scope |
| **Requirement impact** | [`REQ-MON-010`](#/functional-requirements), [`REQ-ORG-007`](#/functional-requirements), [Security & Privacy](#/security-privacy) |

---

## 4. External stakeholders

### Client {Future}

An external customer of an Organization, for whom projects are delivered.

| | |
|---|---|
| **Goals** | See time billed against their projects |
| **Status** | Client login access is marked future release in the matrix `{Confirmed}`. **No client-facing access exists at MVP** |
| **Why it is deferred** | Introduces external access to tenant data — a distinct authorization surface, a distinct privacy surface, and a real risk of exposing employee-level monitoring data to a third party |
| **Design constraint now** | The domain model already treats Client as a future role (`resources-3.md` §6). Any client-facing capability must expose **aggregated project time only**, never member-level activity, screenshots or recordings. `{Proposed}` |

### Billing provider {Derived}

| | |
|---|---|
| **Role** | Processes subscription payments |
| **Status** | Abstracted behind a provider interface; **no provider chosen**. `GAP-19`, [`OQ-009`](#/open-questions) |

### Legal and compliance advisors {Proposed}

| | |
|---|---|
| **Role** | Assess lawfulness of monitoring per target jurisdiction; review data processing terms; advise on retention and subject rights |
| **Status** | Not engaged. This is a **launch blocker for a monitoring product**, recorded as [`RISK-005`](#/risks) and [`OQ-014`](#/open-questions) |

---

## 5. Permission summary

Indicative only — the normative source is [Functional Requirements](#/functional-requirements) and [Business Rules](#/business-rules).

| Capability | Platform Admin | Owner | Administrator | Manager | Employee |
|---|---|---|---|---|---|
| Manage organizations platform-wide | ✔ | — | — | — | — |
| Manage plan & feature catalogue | ✔ | — | — | — | — |
| Manage subscription & payment | — | ✔ | — | — | — |
| Transfer ownership / close organization | — | ✔ | — | — | — |
| Manage organization settings | — | ✔ | ✔ | — | — |
| Manage monitoring & retention settings | — | ✔ | ✔ | — | — |
| Invite, suspend, remove members | — | ✔ | ✔ | — | — |
| Assign roles | — | ✔ | ✔ | — | — |
| Manage teams, projects, tasks | — | ✔ | ✔ | scope¹ | — |
| Manage schedules & leave types | — | ✔ | ✔ | — | — |
| View any member's tracking data | — | ✔ | ✔ | scope¹ | — |
| View own tracking data | — | ✔ | ✔ | ✔ | ✔ |
| View any member's screenshots / recordings | — | ✔² | ✔² | scope¹ ² | — |
| View own screenshots / recordings | — | ✔ | ✔ | ✔ | ✔ |
| Track time | — | ✔ | ✔ | ✔ | ✔ |
| Create manual time entry for self | — | ✔ | ✔ | ✔ | ✔³ |
| Create manual time entry for others | — | ✔ | ✔ | scope¹ | — |
| Submit own timesheet | — | ✔ | ✔ | ✔ | ✔ |
| Approve / reject timesheets | — | ✔ | ✔ | scope¹ | — |
| Approve / reject leave | — | ✔ | ✔ | scope¹ | — |
| Manage pay rates | — | ✔ | ✔ | — | — |
| View own pay rate | — | ✔ | ✔ | ✔ | ✔ |
| Run payroll | — | ✔ | ✔ | — | — |
| View organization-wide reports | — | ✔ | ✔ | scope¹ | — |
| View audit log | — | ✔ | ✔ | — | — |
| Access tenant business data as vendor | elevation⁴ | — | — | — | — |

¹ Restricted to members within the Manager's assigned scope.
² Subject to the organization's `screenshots` / `video_recording` entitlement **and** the viewer's permission.
³ Subject to organization policy and the manual-entry window — [`BR-TIME-005`](#/business-rules).
⁴ Explicit, time-bounded, reason-recorded, audited elevation only — [`REQ-ADMIN-005`](#/functional-requirements).

---

## 6. Stakeholder influence on requirements

| Stakeholder | Requirements most shaped by them | Tension they create |
|---|---|---|
| Owner | Billing, entitlements, organization dashboard | Wants maximum visibility; visibility has privacy cost |
| Administrator | Settings, roles, retention, audit | Wants configurability; configurability multiplies test surface |
| Manager | Approvals, team reporting, timeline, alerts | Wants fast approval; fast approval risks unreviewed approval |
| Employee | Tracker UX, corrections, self-visibility | Wants low friction and privacy; the product's purpose is observation |
| Platform Administrator | Organization lifecycle, health, support access | Wants support access; support access is the largest vendor-side privacy risk |
| Legal / works councils | Consent, disclosure, retention, subject rights | Wants minimisation; the feature matrix sells capture |

:::note The central tension
Owner/Manager pressure is toward *more* capture and *more* visibility. Employee and legal pressure is toward *less*. The product resolves this by making capture **configurable by the organization, visible to the employee, and bounded by retention** — rather than by choosing a side. Every monitoring requirement in this documentation reflects that resolution.
:::
