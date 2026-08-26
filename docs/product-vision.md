# Product Vision

---

## 1. What Team Time Track is

Team Time Track is a **multi-tenant SaaS platform that turns observed work into trustworthy, approvable time records.**

An organization installs a desktop tracker on its team's machines. The tracker captures when people work, what they work on, and evidence of that work. The platform turns that raw capture into time entries, attendance records, timesheets, approvals and payroll-ready figures, and gives managers reporting over the whole chain.

The product is not a stopwatch and it is not a spreadsheet. Its defining characteristic is the **evidence chain**:

```text
Tracking Events        raw, immutable, client-generated, idempotent
      ↓
Tracking Sessions      a continuous period of work on a device
      ↓
Time Entries           derived, correctable work intervals
      ↓
Timesheets             a person's submitted period
      ↓
Approvals              a manager's reviewed decision
      ↓
Payroll                money, calculated only from approved time
```

Every stage is separately stored, separately auditable, and never skipped. `{Derived}` — this is the central architectural principle argued across `resources-3.md` §58, `resources-12.md` §46 and `resources-14.md` Rule 4.

---

## 2. The problem it solves

Organizations that pay for time — agencies, outsourcing firms, distributed teams, hourly and contract workforces — face four failures at once:

| Problem | What actually goes wrong |
|---|---|
| **Time data is unreliable** | Hours are self-reported from memory at the end of a week. Nobody can reconstruct what happened, and nobody can dispute it either |
| **Work is invisible across distance** | A manager with a remote or distributed team has no shared reference for what was worked on, only status updates |
| **Approval is unstructured** | Time is approved in chat messages and spreadsheets. There is no record of who approved what, when, or why it was rejected |
| **Payroll inherits every earlier error** | Pay is calculated from numbers that were never verified. Disputes arrive after payment, when they are most expensive to resolve |

The connective failure is that these four are usually solved by four disconnected tools. Time Track's value is in **one chain, one audit trail, one source of truth**.

:::warning A problem the product also creates
Continuous activity capture, screenshots and screen recording are intrusive. A product in this category can improve fairness — an employee with an evidence trail can defend their hours — or it can damage trust badly. This documentation treats employee transparency as a **first-class requirement**, not an afterthought. See [Security & Privacy](#/security-privacy) and [`REQ-MON-010`](#/functional-requirements).
:::

---

## 3. Target organizations

`{Derived}` from the capability set. No customer research exists in `resources/`; these profiles are inferred from what the feature matrix is built to serve and are marked accordingly.

| Segment | Why the product fits | Size band |
|---|---|---|
| **Digital and creative agencies** | Bill clients by tracked hours per project; need project/task reporting and defensible time records | 5–100 |
| **Outsourcing and BPO firms** | Contractual delivery obligations; need attendance, schedules, screenshots and shift management | 20–500 |
| **Distributed / remote-first teams** | No physical presence signal; need attendance and activity as a coordination substitute | 10–200 |
| **Hourly and contract workforces** | Pay is a direct function of hours; need approval and payroll preparation | 10–300 |

**Not targeted at MVP:** enterprises requiring SSO, SCIM provisioning, HRIS integration or data-warehouse export. The feature matrix places all of these in future releases `{Confirmed}`, so the product cannot serve that segment at launch and should not be sold into it.

---

## 4. Target users

| User | What they need from the product |
|---|---|
| **Owner** | To set up an organization, control the subscription, and know the operation is being measured accurately |
| **Administrator** | To run the organization day to day: people, teams, projects, policies, settings |
| **Manager** | To see what their team worked on, resolve anomalies, and approve time before it becomes pay |
| **Employee** | To track time with minimal friction, correct genuine mistakes, and see exactly what is recorded about them |
| **Platform Administrator** | To operate the platform: organizations, subscriptions, health `{Derived}` |
| **Client** | To see the time billed against their projects — **`{Future}`**, marked future release in the matrix `{Confirmed}` |

Full detail in [Stakeholders](#/stakeholders) and [Personas](#/personas).

---

## 5. Core value proposition

> **For organizations that pay for time, Team Time Track makes every hour traceable from the moment it was worked to the moment it was paid — with the evidence attached, the approval recorded, and the employee able to see it too.**

The three claims that must hold for this to be true:

1. **Nothing is lost.** Work tracked offline, through a crash, or across a network failure still arrives, exactly once. `{Derived}` — offline capture with idempotent synchronisation is treated as a launch requirement, not an enhancement (`resources-1.md` §13).
2. **Nothing is invented.** No number in a report exists without a derivable path back to captured events or an attributed manual entry with a stated reason.
3. **Nothing is hidden from the person being measured.** An employee can see their own tracked time, activity, screenshots and recordings.

Claim 3 is a `{Proposed}` product position. It is not required by any source document, and it constrains the product — but a monitoring product that fails it is one incident away from becoming unsellable.

---

## 6. What makes this product defensible

`{Proposed}` — differentiators, not claims about competitors.

| Position | Why it is defensible |
|---|---|
| **Approval-gated payroll by construction** | Payroll can only read approved timesheet time. This is enforced in the domain, not by convention, so "we accidentally paid unapproved hours" cannot happen |
| **Loss-resistant capture** | Event-sourced tracking with client-generated identifiers means the worst network in the customer's portfolio still produces correct hours |
| **Entitlements as data, not code** | Plan capability is resolved through a single entitlement service. Plans can be repackaged commercially without touching feature code |
| **Symmetric visibility** | The employee sees what the manager sees about them. Cheap to build early, effectively impossible to retrofit into a product that shipped without it |
| **Correction with a paper trail** | Time can be corrected — every correction carries an actor, a reason and an audit record. Rigid systems get worked around; unaudited ones get disputed |

---

## 7. Product goals

| ID | Goal | Measured by |
|---|---|---|
| `G-01` | Capture time accurately and losslessly, including offline | Sync success rate; zero duplicate time entries under retry |
| `G-02` | Make a manager's review of a week take minutes, not hours | Median time from timesheet submission to decision |
| `G-03` | Produce payroll figures that survive a dispute | Proportion of payroll periods reopened after processing |
| `G-04` | Keep monitoring proportionate and visible to the monitored | Employee-visible parity; no data category invisible to its subject |
| `G-05` | Make organization data isolation absolute | Zero cross-organization data access in testing and production |
| `G-06` | Support commercial packaging without code change | Plan changes deliverable by configuration only |

Success criteria and thresholds are in [Project Planning](#/project-planning) §4.

---

## 8. Business objectives

`{Proposed}` — no commercial targets exist in `resources/`.

| ID | Objective | Notes |
|---|---|---|
| `B-01` | Launch a commercially sellable MVP covering the Basic and Standard tiers in full | Premium can follow if `video_recording`, `office_remote` and `internet_connectivity` slip — see [Scope](#/scope) |
| `B-02` | Convert self-serve trials into paying organizations without sales involvement | Requires trial, plan selection, payment and self-serve onboarding at launch |
| `B-03` | Operate on a single VPS deployment through early growth | Explicit decision to avoid container orchestration and microservices initially (`resources-2.md` §17) `{Derived}` |
| `B-04` | Keep per-organization storage cost predictable as monitoring data accumulates | Retention enforcement is a cost control, not only a privacy control |
| `B-05` | Establish the enterprise path without building it | SSO, provisioning, HRIS, API and BigQuery are architected for, not implemented `{Confirmed}` as future release |

:::note Revenue targets are absent
No pricing, ARR target, conversion assumption or customer-count goal exists in any source. Objectives above are directional only. See [`OQ-007`](#/open-questions).
:::

---

## 9. Explicit non-goals

Stating these prevents scope drift, and each one is a decision someone will otherwise try to reverse mid-build.

| Non-goal | Reasoning |
|---|---|
| **Team Time Track is not a payment processor** | It calculates and exports payroll figures. It does not move money. `{Derived}` `resources-1.md` §24 |
| **Not a project management tool** | Projects and tasks exist so time can be attributed to them. No boards, dependencies, sprints or Gantt charts |
| **Not an HR system of record** | It records leave requests and approvals. It is not the employee master record, and does not own contracts, reviews or benefits |
| **Not an AI analytics product at MVP** | Benchmarks AI, unusual-activity detection and meeting insights are future release `{Confirmed}`. Productivity classification is rule-based and organization-configured |
| **Not a keylogger** | Activity is stored as aggregated counts and percentages over intervals. Keystroke content is never captured. `{Derived}` `resources-3.md` §23 |
| **Not a compliance certification** | The platform provides controls that support compliance. It does not assert GDPR, CCPA or any other compliance status. See [Security & Privacy](#/security-privacy) |
| **Not a productivity judgement of individuals** | The system classifies applications and domains, which an organization configures. It does not rank people |

---

## 10. Product principles

Design and requirement decisions that follow are expected to be consistent with these.

1. **Derived data is never authoritative.** Attendance, time entries and reports are recomputable from their inputs. If a derived value and its source disagree, the source wins.
2. **Financial records are immutable once approved.** Reopening an approved timesheet or payroll period is a distinct, audited, permissioned action — never an edit.
3. **The backend is the only authority.** The web application and desktop tracker may hide unavailable functionality; they may never be the thing that enforces it. `{Derived}` `resources-13.md` §54.
4. **Capture degrades, it does not fail.** Losing the network, the server or the screen must reduce fidelity, never lose time.
5. **Every automated action has an actor.** Including "the system" — retention deletion is attributable in the audit log with a null human actor and a named action. `{Derived}` `resources-14.md` §52.
6. **Collect the minimum that makes the feature work.** Domain rather than full URL; aggregated activity rather than raw input; configurable capture rather than maximal capture.
