# Product & Capability Analysis

---

## 1. What this analysis can and cannot say

The brief describes Team Time Track as *"inspired by Time Doctor"*. The source material supports a capability analysis but **not** a competitive analysis.

| Available in `resources/` | Not available in `resources/` |
|---|---|
| A complete feature matrix across three commercial tiers, with future-release markers and retention periods | Any factual description of Time Doctor's behaviour, workflows, UI, pricing or market position |
| Fourteen design transcripts reasoning about how such a product should be built | Any other competitor's documentation |
| Explicit plan boundaries per feature | Any user research, win/loss data, review analysis or pricing benchmark |

:::warning No competitor claims are made
This document makes **no factual assertions about Time Doctor or any other product**. Doing so from the available material would mean inventing them. Where a comparison would normally sit, this analysis instead evaluates the **capability set itself** — what it implies, what is worth adopting, what should be changed, and what should be left out. A genuine competitive analysis requires primary research that does not exist yet; it is registered as [`OQ-016`](#/open-questions).
:::

The matrix's structure and vocabulary — Team Insights, Management Insights, Advanced Reporting, Company Insights, Platform Features, Support — is the strongest signal available about the intended product shape, and is analysed as such.

---

## 2. What the capability set reveals

### 2.1 The product is organised around who is asking

The six matrix sections are not feature categories; they are **audiences**.

| Section | Audience | Question being answered |
|---|---|---|
| Team Insights | Team lead / manager | What is my team doing? |
| Management Insights | Manager / HR / finance | Is my team working as agreed, and what do we owe them? |
| Advanced Reporting | Analyst / senior manager | What patterns exist that I cannot see day to day? |
| Company Insights | Executive | How is the organization performing overall? |
| Platform Features | Everyone, mostly the employee | How does it capture, and where does it run? |
| Support | Buyer | What happens when it breaks? |

**Implication for Team Time Track:** navigation, permissions and dashboards should follow the same audience split. A single undifferentiated "Reports" section would fight the product's own structure. Reflected in [Product Modules](#/product-modules) and [Personas](#/personas).

### 2.2 The tier boundary is drawn at management, not at tracking

Basic includes screenshots, hours, timeline, projects/tasks, teams and dashboards. Standard adds activity, web/app usage, productivity ratings, attendance, breaks, leave, payroll, schedules and approvals.

The line is: **Basic observes, Standard manages.**

**Implication:** the tracking engine must be complete in Basic. There is no reduced-fidelity capture tier. Every architectural cost of capture — offline sync, idempotency, screenshot storage — is incurred at the cheapest tier. This is confirmed by the matrix and is the strongest argument for `resources-1.md` §32's position that the build MVP should not equal the Basic plan.

### 2.3 Premium is analytical, not operational

Premium adds four things: Office vs Remote, Internet connectivity, Video screen recording and Executive dashboard. None of them changes how work is tracked. Three of the four are **reports about the tracking**, and the fourth is higher-fidelity capture of the same activity.

**Implication:** Premium can be built after Standard is complete and correct, and shipped as an increment. It does not require re-architecture. This directly supports the release sequencing in [Project Planning](#/project-planning).

### 2.4 Everything enterprise is deferred

SSO, automatic provisioning, HRIS, BigQuery and Open API are all future release. The matrix therefore describes a product aimed at **self-serve small and mid-sized organizations**, not enterprise procurement.

**Implication:** self-serve trial, self-serve payment and self-serve onboarding are launch-critical, because there is no sales-assisted path. This raises the priority of the trial and billing flows above where a feature list alone would place them.

### 2.5 Retention is a commercial lever, not just a policy

3 / 6 / 24 months is the only *quantified* difference between the tiers.

**Implication:** retention must be an entitlement resolved through the same mechanism as every other feature, and enforced by a job that actually deletes. If retention silently over-retains, the tiering has no substance and storage cost grows unbounded. Recorded as [`BR-DATA-001`](#/business-rules) and [`BR-DATA-002`](#/business-rules).

---

## 3. Core functionality implied by the matrix

The eight capability groups the product must have, and what each minimally means.

| Group | Minimum meaning | Plan floor |
|---|---|---|
| **Capture** | Continuous, resumable, offline-capable time capture attributable to a project and task | Basic |
| **Evidence** | Screenshots at Basic; activity, applications and websites at Standard; screen video at Premium | Basic |
| **Attribution** | Time belongs to a member, a project and optionally a task, inside exactly one organization | Basic |
| **Expectation** | Schedules and shifts defining what *should* have happened | Standard |
| **Reconciliation** | Attendance comparing expected against actual, incorporating leave and breaks | Standard |
| **Governance** | Timesheet submission, review, approval and rejection with history | Standard |
| **Compensation** | Pay rates, payroll periods, calculation from approved time, export | Standard |
| **Insight** | Reporting across all of the above, per person, team, project and organization | Basic |

---

## 4. Primary user workflows implied

| Workflow | Actor | Frequency | Notes |
|---|---|---|---|
| Track a working session | Employee | Many times daily | The highest-frequency interaction in the product by orders of magnitude |
| Correct a mistake in tracked time | Employee | Weekly | Underspecified in the matrix; the most common source of dissatisfaction in this product category |
| Review a team's week | Manager | Weekly | Must be fast, or approvals become rubber-stamping |
| Approve or reject a timesheet | Manager | Per period | The governance gate |
| Investigate an anomaly | Manager | Occasional | Timeline + screenshots + activity together, or not at all |
| Run payroll | Finance / Owner | Per period | Must be reproducible and explainable |
| Configure policy | Administrator | Rare, high impact | Every change here is audit-relevant |
| Check what is recorded about me | Employee | Occasional | Not in the matrix; see §6 |

Full journeys in [User Journeys](#/user-journeys).

---

## 5. Capabilities worth adopting as specified

| Capability | Why adopt unchanged |
|---|---|
| Screenshots at every tier | Removes the temptation to build two capture paths. One pipeline, gated only by retention |
| Online/offline tracking at every tier | Forces offline correctness into the foundation rather than bolting it on |
| Configurable productivity ratings | Correctly places the judgement with the organization. What is unproductive at a bank is a core tool at an agency |
| Time approvals as a distinct feature | Recognises approval as a governance step, not a status field |
| Plan-differentiated retention | Aligns the commercial model with the dominant marginal cost |
| Separate individual and team dashboards | An employee's dashboard and a manager's dashboard answer different questions and should not be the same screen with filters |
| Attendance as a first-class module | Distinguishes "hours worked" from "worked as agreed" — the second is what management actually buys |

---

## 6. Capabilities that should be modified

| Capability | Issue | Recommended modification |
|---|---|---|
| **Screenshots in Basic with no configuration floor** | The matrix grants screenshots without specifying frequency, blur, or whether an employee can request deletion | Ship with a configurable interval, randomisation within the interval, and an organization setting to disable. Default to a moderate interval rather than a maximal one. [`REQ-MON-001`](#/functional-requirements) |
| **"User controlled or automatic tracking"** | "Automatic" is undefined and is the single most privacy-sensitive undefined term in the matrix | Define automatic tracking narrowly: starts only within scheduled hours, requires explicit organization opt-in, and is always visible to the member. `GAP-04`, [`REQ-TIME-004`](#/functional-requirements) |
| **"Inactivity alerts"** | No threshold, recipient or channel defined; naive implementation notifies a manager every time someone reads a document | Alert on sustained inactivity during scheduled hours only, with an organization-configured threshold, and notify the member as well as the manager. `GAP-02`, [`REQ-MON-007`](#/functional-requirements) |
| **"Web and app usage"** | Full URL capture is a data-protection liability — URLs carry tokens, identifiers and medical or financial context | Store domain by default; capture path only where explicitly enabled. `resources-3.md` §25 already raises this. [`BR-MON-004`](#/business-rules) |
| **"Payroll"** | Sold as "Payroll" but the design supports calculation and export only — no overtime, no tax, no disbursement | Position and label as **payroll preparation**. Mislabelling here produces refund requests. `CONF-10` |
| **"Leave tracking"** | Requests and approvals only; no balances, which is what employees actually ask about | Either add balances or state the limitation in the plan description. `CONF-09`, [`OQ-011`](#/open-questions) |
| **Video screen recording** | Highest-intrusion, highest-cost feature in the product | Require explicit per-organization enablement, in-tracker visible indication while recording, and separate permission from screenshots. [`REQ-REC-001`](#/functional-requirements) |
| **Executive dashboard** | Undefined | Define by decision, not by guess. `GAP-03` |

---

## 7. Capabilities that should not be included

| Capability | Why not, at MVP |
|---|---|
| **Benchmarks AI, unusual activity detection, meeting insights** | Marked future release `{Confirmed}`. All three require analytical maturity and volumes of data a new product does not have. Anomaly detection on a thin dataset produces false accusations about real people |
| **Software cost insights** | Future release `{Confirmed}`, and requires procurement data the product does not hold |
| **60+ browser integrations** | Future release `{Confirmed}`. Integration surface of this size is a sustained maintenance commitment, not a feature |
| **SSO, SCIM, HRIS, BigQuery, Open API** | Future release `{Confirmed}`. All are enterprise-segment requirements, and the matrix has already positioned the product away from that segment at launch |
| **Client login access** | Future release `{Confirmed}`. Introduces a fourth actor class with external access to tenant data — a significant new authorization and privacy surface |
| **Keystroke content capture** | Not in the matrix, occasionally expected in this category. Excluded permanently as a product position |
| **Individual productivity scoring** | Not in the matrix. Productivity Rules classify applications, not people, and should stay that way |

---

## 8. Structural advantages and disadvantages

### Advantages of the capability set as scoped

| Advantage | Consequence |
|---|---|
| Coherent tier story: observe → manage → analyse | Upgrade path is obvious to a buyer, and each tier is independently complete |
| No feature requires machine learning | Behaviour is explainable, testable and defensible in a dispute |
| Complete capture at every tier | One capture pipeline to build, test and support |
| Premium is additive reporting | Can ship as an increment without re-architecture |
| Enterprise deliberately deferred | Avoids a procurement-length sales cycle before product-market fit |

### Disadvantages and how they are handled

| Disadvantage | Consequence | Handling |
|---|---|---|
| Complete capture at every tier | The cheapest customer costs nearly as much to serve as the most expensive | Retention tiering is the primary cost control; monitor storage per organization |
| Basic has no management features | Basic risks reading as "a screenshot tool" and churning | Commercial positioning question, [`OQ-017`](#/open-questions) |
| Two Standard/Premium features are undefined | Two entitlements cannot be built | `GAP-01`, `GAP-03` |
| Matrix sells five client platforms | MVP ships one desktop client and a web app | `CONF-04`, [`OQ-002`](#/open-questions) |
| No support channel is committed at launch | A paying customer with a problem has nowhere to go | `CONF-12`, [`OQ-003`](#/open-questions) |
| Intrusion is high by category default | Trust failure is an existential risk, not a feature complaint | Employee transparency treated as launch-critical, [Security & Privacy](#/security-privacy) |

---

## 9. What the matrix omits entirely

Absent from all six sections, and required for the product to function commercially or ethically. Each is scoped in this documentation with the evidence class shown.

| Omitted | Why it is nevertheless required | Class |
|---|---|---|
| Authentication and account lifecycle | Nothing works without it | {Derived} |
| Organization creation and settings | The tenant must exist before anything is tracked | {Derived} |
| Invitations and user management | People must get into the organization somehow | {Derived} |
| Roles and permissions | Every feature is permission-relevant | {Derived} |
| Subscription, trial, payment and invoices | Self-serve is the only sales motion available | {Derived} |
| Audit logging | Approvals, payroll and policy changes are disputable | {Derived} |
| Employee data transparency | Category-defining trust requirement | {Proposed} |
| Data export and erasure workflows | Likely legally required; see [Security & Privacy](#/security-privacy) | {Proposed} |
| Platform administration | Someone has to operate the platform | {Derived} |

This omission set is expected: a feature matrix is a **sales artefact**, and sales artefacts do not list foundations. It is the single largest reason `resources-1.md` §6 is right that the matrix "is not our complete product specification".
