# User Personas

:::warning Evidence class
`resources/` contains **no user research** — no interviews, surveys, support tickets or usage data. These personas are `{Proposed}` working models constructed from the capability set and the workflows it implies. They are useful for prioritisation and design conversations. They are **not validated** and must not be cited as evidence of user need. Validating them is [`OQ-020`](#/open-questions).
:::

Six personas: one per organization role, plus the vendor operator. Each maps to stakeholder definitions in [Stakeholders](#/stakeholders).

---

## P1 — Amara · Agency Owner

**Owner** · 34-person digital agency · uses the product 15 minutes a week

### Goals
- Know whether projects are profitable before the invoice, not after
- Keep the subscription cost proportionate to the value it returns
- Never be surprised by a payroll number

### Responsibilities
- Owns the commercial relationship and the payment method
- Sets organization policy, including how intrusive monitoring is
- Signs off payroll

### Pain points
- Project overruns are discovered when the invoice does not cover the cost
- Time data arrives as a spreadsheet assembled by someone from memory
- Cannot answer "what did this client actually cost us" without a day of reconstruction

### Needs
- One organization dashboard that answers hours, cost and utilisation
- Payroll figures that reconcile to approved time without manual adjustment
- Confidence that monitoring will not cause a staff problem

### Key workflows
[`JRN-01`](#/user-journeys) Register and create organization · [`JRN-02`](#/user-journeys) Select plan and start trial · [`JRN-15`](#/user-journeys) Run payroll · [`JRN-16`](#/user-journeys) Manage subscription

### System capabilities that matter most
Organization dashboard · project and hours reports · payroll summary and export · subscription and seat management · monitoring policy settings

### Design implication
Amara opens the product rarely and needs an answer in under a minute. Her dashboard must lead with **exceptions and totals**, not with a feature tour.

---

## P2 — Daniel · Operations Administrator

**Administrator** · 120-person outsourcing firm · uses the product daily

### Goals
- An organization configured so data is correct without daily intervention
- Onboard a new starter in under ten minutes
- Handle exceptions rather than chase them

### Responsibilities
- Members, teams, projects, schedules, leave types, productivity rules
- Monitoring and retention settings
- First-line internal support for tracker problems

### Pain points
- Onboarding means touching five systems, and a missed step surfaces two weeks later as missing time
- Shift patterns across multiple timezones are configured by hand and drift
- When someone disputes their hours, reconstructing what happened is slow and inconclusive

### Needs
- Bulk invitation and role assignment
- Schedules that handle overnight shifts and per-team timezones without workarounds
- An audit log that answers "who changed this setting and when"
- Clear indication of members whose tracker has stopped syncing

### Key workflows
[`JRN-03`](#/user-journeys) Configure organization · [`JRN-04`](#/user-journeys) Invite members · [`JRN-06`](#/user-journeys) Create project and assign · [`JRN-11`](#/user-journeys) Configure schedules · [`JRN-17`](#/user-journeys) Configure monitoring and retention

### System capabilities that matter most
Member management · invitations · teams · schedules with overnight support · organization settings · audit log · device and sync status

### Design implication
Daniel is the product's power user and its main configuration surface. Configuration errors here damage every downstream number, so **destructive and policy-changing actions need confirmation, preview and audit**.

---

## P3 — Priya · Delivery Manager

**Manager** · 9 direct reports across two timezones · uses the product daily

### Goals
- Know by Monday morning what the team did last week
- Approve timesheets without either rubber-stamping or spending a day on it
- Catch problems while they are small

### Responsibilities
- Reviewing tracked time, activity and evidence for her team
- Approving or rejecting timesheets and leave
- Explaining anomalies upward

### Pain points
- Approval means reading nine timesheets with no signal about which one needs attention
- To investigate a suspicious entry she opens four screens and correlates by hand
- Late or absent team members surface days after the fact

### Needs
- A pending-approvals queue **ranked by what looks wrong**, not alphabetically
- A single timeline view that puts time, activity, applications, websites and screenshots on one axis
- Attendance exceptions surfaced automatically
- The ability to reject with a reason that reaches the person and is recorded

### Key workflows
[`JRN-12`](#/user-journeys) Review team activity · [`JRN-13`](#/user-journeys) Investigate an anomaly · [`JRN-14`](#/user-journeys) Approve or reject a timesheet · [`JRN-10`](#/user-journeys) Approve leave

### System capabilities that matter most
Team dashboard · approvals queue · timeline report · screenshots in context · attendance exceptions · inactivity alerts · rejection with comment

### Design implication
Priya is the persona the **timeline report** exists for. If time, activity and evidence cannot be read together on one screen, her investigation workflow fails and approvals become ceremonial.

---

## P4 — Marcus · Hourly Developer

**Employee** · contract, paid hourly · has the tracker running 6–9 hours a day

### Goals
- Get paid for every hour actually worked
- Spend as close to zero time on the tracker as possible
- Fix a mistake without an argument

### Responsibilities
- Tracking against the right project and task
- Declaring breaks
- Submitting his timesheet each period

### Pain points
- Forgets to start the tracker, or forgets to stop it after finishing — either way the number is wrong
- Goes idle in a long call and loses time he genuinely worked
- Internet drops and he does not know whether his hours survived
- Has no idea what his manager can see about him, which he finds worse than the monitoring itself

### Needs
- Timer state visible without opening a window
- Honest, visible sync status — "12 minutes not yet synced" beats a green tick that lies
- Idle prompts that let him say what the idle time actually was
- A correction path that is normal and not an accusation
- His own view of his tracked time, activity, screenshots and recordings

### Key workflows
[`JRN-05`](#/user-journeys) Accept invitation and install tracker · [`JRN-07`](#/user-journeys) Track a session · [`JRN-08`](#/user-journeys) Work offline and resync · [`JRN-09`](#/user-journeys) Correct time · [`JRN-14`](#/user-journeys) Submit timesheet · [`JRN-18`](#/user-journeys) Review own record

### System capabilities that matter most
Desktop tracker · offline capture and sync indication · idle handling · manual time entry with reason · personal dashboard · self-visibility over captured evidence

### Design implication
Marcus is the **highest-frequency user of the entire product** and the only one who cannot choose not to use it. Tracker friction is felt hundreds of times per person per week. This persona is the reason [`REQ-MON-010`](#/functional-requirements) — employee self-visibility — is `{P0}` despite being unsold.

---

## P5 — Sofia · Finance Lead

**Administrator** (payroll-focused) · processes pay for 120 people · uses the product twice a month

### Goals
- Payroll that reconciles first time
- Every figure explainable when challenged
- No unapproved time reaching a payment

### Responsibilities
- Running payroll periods, applying adjustments, exporting to the payroll system

### Pain points
- Hours arrive in inconsistent formats from multiple sources
- Rate changes mid-period are handled manually and get missed
- A disputed payment cannot be traced back to who approved what

### Needs
- Payroll driven exclusively by approved time, with unapproved time visible and excluded
- Effective-dated pay rates applied automatically to the correct period
- A rate snapshot on every payroll entry so history stays correct after a raise
- CSV export matching her downstream payroll system
- An audit trail from payment back to approval back to the tracked session

### Key workflows
[`JRN-15`](#/user-journeys) Run payroll · [`JRN-14`](#/user-journeys) Chase outstanding approvals

### System capabilities that matter most
Payroll periods · approved-time calculation · effective-dated pay rates · rate snapshotting · payroll export · audit log

### Design implication
Sofia is the reason for `resources-12.md` §46 — payroll never reads raw tracking. She is also the reason the payroll module must be labelled **payroll preparation**: she has an actual payroll system, and this is not it. See `CONF-10`.

---

## P6 — Kenji · Platform Operations Engineer

**Platform Administrator** (vendor-side) · uses the platform surface daily

### Goals
- Know that every organization's data is arriving and being processed
- Diagnose a customer problem without reading their screenshots
- Never be the cause of a privacy incident

### Responsibilities
- Organization and subscription administration
- Platform health: queues, sync failures, upload failures, job failures
- Incident response

### Pain points
- Customers report lost time before monitoring detects it
- Diagnosing a sync failure usually means looking at customer data
- Suspending a non-paying organization risks destroying data that is still owed to them

### Needs
- Sync failure rate per organization and per device as a first-class metric
- Diagnostics built from **metadata** — event counts, batch outcomes, timestamps — not content
- Time-bounded, reason-recorded, audited elevation when content access is genuinely necessary
- Suspension that blocks access without deleting data

### Key workflows
Organization suspension and reinstatement · subscription administration · sync and queue health monitoring · audited support elevation

### System capabilities that matter most
Platform administration surface · organization lifecycle · per-organization sync and job health · audited elevation · retention job monitoring

### Design implication
Kenji is why diagnostics must be **metadata-first**. If routine debugging requires viewing customer screenshots, the vendor has built a privacy problem into its own operations.

---

## Persona → priority mapping

| Persona | Frequency | Volume | Priority influence |
|---|---|---|---|
| P4 Marcus (Employee) | Continuous | Highest | Dominates tracker and sync requirements |
| P3 Priya (Manager) | Daily | High | Dominates reporting, timeline and approval requirements |
| P2 Daniel (Administrator) | Daily | Medium | Dominates configuration, roles and audit requirements |
| P6 Kenji (Platform Ops) | Daily | Low (vendor) | Dominates observability and support-access requirements |
| P5 Sofia (Finance) | Twice monthly | Low | Dominates payroll correctness requirements |
| P1 Amara (Owner) | Weekly | Lowest | Dominates dashboard, billing and policy requirements |

:::note Frequency is not importance
Amara opens the product least and decides whether it gets paid for. Marcus opens it most and cannot decide anything. A product that optimises only for the buyer produces a tool the workforce resents; one that optimises only for the workforce does not get renewed. Both are represented in the requirement set.
:::

---

## Anti-persona

Recorded to prevent scope drift toward a customer this product should not serve.

### The covert monitor

An organization that wants tracking its workforce **does not know about**: hidden capture, no visible tracker, no employee access to their own data.

**Not served.** The desktop tracker must be visibly running and its capture disclosed to the member being tracked ([`BR-MON-008`](#/business-rules)). This closes a market segment deliberately: covert monitoring is unlawful in many jurisdictions, and serving it would make the product's largest risk — a public trust failure — substantially more likely.
