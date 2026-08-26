# Security & Privacy

:::warning Scope of this document
This document analyses the security and privacy characteristics of the product and specifies engineering controls. It **does not** assert that the product complies with any law, and it does not constitute legal advice. Whether a given deployment of Team Time Track is lawful depends on jurisdiction, the employment relationship, the organization's own notices and, in several countries, prior consultation with employee representatives. Determining that is [`OQ-014`](#/open-questions) and requires qualified counsel.
:::

---

## 1. Why this product needs a dedicated privacy analysis

Most SaaS products hold data *about* a business. Team Time Track holds data *about people, produced continuously, without their moment-to-moment participation*, and makes it available to those people's employer.

The specific characteristics that raise the stakes:

| Characteristic | Consequence |
|---|---|
| **Continuous capture** | The data subject is not consciously choosing to disclose at the moment of each capture |
| **Screen images and video** | Capture is indiscriminate — it records whatever is on screen, including things nobody intended to collect |
| **Power asymmetry** | The subject is an employee; consent given under employment is not freely given in the same sense as consumer consent |
| **The vendor holds it too** | Every privacy obligation of the customer becomes an operational obligation of the vendor |
| **Volume and persistence** | Retained for months, searchable, exportable, and attributable to a named individual |

A defect that would be a moderate incident in most products — an authorization gap, an over-broad support tool, a retention job that silently stopped — is a serious incident here.

---

## 2. The indiscriminate-capture problem

This is the single hardest problem in the product category, and it deserves stating plainly.

A screenshot taken at a fixed interval captures **whatever is on screen at that moment**. That will sometimes include:

- A personal message, a banking page, a medical portal opened during a break that was not declared
- A colleague's data the Member is legitimately working on but the reviewer is not entitled to see
- A third party's confidential information under NDA
- Credentials, tokens or keys visible in a terminal or password manager

Screen recording makes every one of these more likely, because it captures continuously rather than sampling.

### How the product addresses it

| Control | Requirement |
|---|---|
| Capture only while tracking is active, never during a declared break | [`BR-MON-001`](#/business-rules), [`NFR-PRIV-002`](#/non-functional-requirements) |
| Capture is visible to the Member at all times, so they know when to pause | [`BR-MON-008`](#/business-rules), [`REQ-DEV-004`](#/functional-requirements) |
| The Member can see every capture made of them | [`REQ-MON-010`](#/functional-requirements) |
| The Member can request deletion of a specific capture, with an audited decision | [`REQ-MON-011`](#/functional-requirements) |
| Enforced minimum capture interval | [`BR-MON-002`](#/business-rules) |
| Recording is separately enabled, separately permissioned and separately indicated | [`REQ-REC-001`](#/functional-requirements), [`BR-REC-002`](#/business-rules) |
| Retention bounds how long any single unfortunate capture persists | [`BR-DATA-001`](#/business-rules) |

### What it does not address

Screenshot blurring, sensitive-application exclusion lists and automatic redaction are **not in MVP** (`GAP-17`). Blur-by-default and per-application exclusion are the strongest available mitigations and should be considered for V1.1 — [`OQ-015`](#/open-questions).

---

## 3. Data classification

Every category the product stores, with its handling requirement.

| Category | Sensitivity | Handling |
|---|---|---|
| **Screen recordings** | Critical | Private storage, signed URLs ≤ 15 min, separate permission, separate enablement, retention-bounded, subject-visible |
| **Screenshots** | Critical | Private storage, signed URLs ≤ 15 min, retention-bounded, subject-visible, deletion-requestable |
| **Credentials and tokens** | Critical | Hashed, never logged, never in error payloads, rotatable |
| **Website usage** | High | Domain only by default; paths only under explicit disclosed configuration; never query strings |
| **Application usage** | High | Application name only; no window titles, no process enumeration |
| **Activity events** | High | Aggregated counts and percentages only; never keystroke content |
| **Pay rates and payroll entries** | High | Permission-gated; visible to the Member for their own rate; audited on change |
| **Time entries and attendance** | Medium | Permission-gated by scope; subject-visible |
| **Audit records** | Medium | Append-only; permission-gated; retention-bounded |
| **Member identity and contact** | Medium | Permission-gated |
| **Organization configuration** | Low | Permission-gated |
| **Platform health metrics** | Low | Metadata only — counts, timings, outcomes; never content |

**Rule:** a diagnostic, log line, error payload, metric or support tool that would need a Critical or High category to function is a design defect. See [`BR-ADMIN-002`](#/business-rules).

---

## 4. Threat surface

Ranked by severity of outcome, not by likelihood.

### T1 — Cross-tenant data access {High}

One Organization reads another's time data, screenshots or payroll.

**Why it is first:** it is the only failure that could end the product commercially in a single incident.

**Controls:** [`BR-ORG-001`](#/business-rules) tenant column on every tenant-owned record and mandatory query scoping · [`NFR-SEC-001`](#/non-functional-requirements) automated isolation test on every tenant-scoped endpoint, on every build · not-found rather than forbidden responses so existence is not confirmed · [`REQ-PROJ-005`](#/functional-requirements) cross-organization association rejected and recorded.

**Residual risk:** application-level isolation is a single layer. Database row-level security as a second layer is {V1.1} (`resources-2.md` §2). Until then, the automated test suite *is* the control — which is why a new endpoint without an isolation test must fail the build rather than merely warn.

### T2 — Vendor-side access to customer monitoring data {High}

A Platform Administrator or engineer views customer screenshots or recordings without cause.

**Why it matters:** the vendor is the most privileged actor in the system and the one the customer's employees never agreed to.

**Controls:** [`BR-ADMIN-001`](#/business-rules) no default access · [`REQ-ADMIN-005`](#/functional-requirements) time-bounded, reason-recorded elevation, logged in the customer's own audit log, with the Owner notified · [`BR-ADMIN-002`](#/business-rules) metadata-only diagnostics.

**Residual risk:** infrastructure-level database access bypasses the application. Production database access must be separately controlled, logged and rare — a System Design and operations requirement.

### T3 — Signed URL leakage {High}

A signed media URL escapes into a log, a referrer header, a screenshot of the application, or a shared browser session.

**Controls:** [`NFR-SEC-005`](#/non-functional-requirements) short expiry · [`NFR-MAINT-003`](#/non-functional-requirements) URLs never logged · authorization evaluated at issuance, per request.

**Residual risk:** within the validity window a leaked URL grants access without authentication. Fifteen minutes is a deliberate trade-off between usability and exposure.

### T4 — Authorization scope escalation {High}

A Manager reads data for Members outside their scope; a Member reads another Member's data.

**Controls:** [`BR-RBAC-004`](#/business-rules) per-request scope evaluation · [`BR-RBAC-005`](#/business-rules) Employee sees own data only · [`BR-RBAC-003`](#/business-rules) no self-role-change · out-of-scope attempts recorded.

### T5 — Credential compromise on a member's machine {Medium}

Device token theft from an employee's laptop.

**Controls:** OS credential storage · device-scoped tokens that authorise one Membership only · [`REQ-DEV-003`](#/functional-requirements) immediate revocation · [`REQ-AUTH-010`](#/functional-requirements) session and device inventory · [`NFR-SEC-012`](#/non-functional-requirements) code signing and verified updates.

### T6 — Tracker substitution or tampering {Medium}

A malicious build of the tracker distributed to employees, or capture suppressed to falsify hours.

**Controls:** code signing and notarisation · authenticated update verification · server-side derivation so the client cannot assert arbitrary totals · [`BR-TIME-008`](#/business-rules) clock-skew flagging · sync gaps visible rather than silent.

**Residual risk:** a determined Member with local administrative rights can prevent capture. The product's answer is that gaps are **visible**, not that they are preventable — [`REQ-MON-006`](#/functional-requirements).

### T7 — Retention failure {Medium}

The retention job silently stops; data accumulates past its committed period.

**Why it is a security issue, not only a cost one:** over-retained monitoring data is both a broken commercial commitment and an expanded breach blast radius.

**Controls:** [`NFR-PRIV-005`](#/non-functional-requirements) 24-hour deletion latency · [`NFR-MAINT-005`](#/non-functional-requirements) retention job failure alerting · [`REQ-ADMIN-004`](#/functional-requirements) retention outcomes in platform health.

### T8 — Payroll manipulation {Medium}

Time approved or altered to produce an incorrect payment.

**Controls:** [`BR-PAY-001`](#/business-rules) payroll reads approved time only · [`BR-TS-005`](#/business-rules) no self-approval · [`BR-TS-004`](#/business-rules) duration snapshots · [`BR-TS-007`](#/business-rules) append-only approval history · [`BR-PAY-002`](#/business-rules) effective-dated rates with snapshotting · full audit trail from payment back to session.

### T9 — Denial of capture {Medium}

Ingestion becomes unavailable or unacceptably slow; trackers accumulate backlog; time is eventually lost.

**Controls:** [`NFR-REL-002`](#/non-functional-requirements) 72-hour offline endurance · [`NFR-PERF-003`](#/non-functional-requirements) ingestion latency target · [`BR-SYNC-003`](#/business-rules) events never dropped to save space · [`REQ-SYNC-006`](#/functional-requirements) backlog visible to the Member and the Organization.

### T10 — Account takeover {Medium}

Standard credential attacks against a product holding highly sensitive data.

**Controls:** [`NFR-SEC-003`](#/non-functional-requirements) adaptive hashing · [`NFR-SEC-006`](#/non-functional-requirements) rate limiting by source and account · [`BR-AUTH-003`](#/business-rules) non-disclosing failures · reset invalidates all sessions and device tokens · notification on password change.

**Gap:** multi-factor authentication is **not specified anywhere in `resources/` and is not in MVP scope**. For a product holding screen recordings of employees, its absence is difficult to defend to a security-conscious buyer — [`OQ-027`](#/open-questions).

---

## 5. Privacy principles applied

### 5.1 Minimisation

Applied concretely, not as a slogan. See [`NFR-PRIV-001`](#/non-functional-requirements) for the collected/not-collected table. The four decisions that matter most:

1. **Domain, not URL.** URLs carry tokens, record identifiers, search terms and medical or financial context. `resources-3.md` §25 raises this risk; [`BR-MON-004`](#/business-rules) makes domain-only the default rather than an option.
2. **Counts, not keystrokes.** Activity is stored as aggregate counts and percentages. Keystroke content is never captured, in any mode, at any tier.
3. **Application, not window title.** Window titles routinely contain document names, client names and message subjects.
4. **Sampled, not continuous.** Screenshots at a bounded interval, with recording as an explicit, separately-enabled, separately-permissioned Premium capability.

### 5.2 Purpose limitation

Every capture type exists to serve a stated feature:

| Capture | Purpose |
|---|---|
| Time and session events | Establish hours worked |
| Screenshots | Evidence that time was worked, for review and dispute |
| Activity events | Distinguish active from idle time within tracked hours |
| Application and website usage | Attribute time to work categories via organization-defined rules |
| Recordings | Higher-fidelity evidence where an organization requires it |
| Connectivity | Explain synchronisation gaps and classify office versus remote |

**Nothing is captured "in case it is useful later."** A proposed capture type without a named feature and a named question it answers should be refused.

### 5.3 Transparency

The product's position, stated as a requirement rather than a value:

> **For every category of data captured about a Member, that Member can see their own instance of it.**

[`BR-MON-009`](#/business-rules), [`REQ-MON-010`](#/functional-requirements), [`JRN-18`](#/user-journeys).

Supported by: disclosure before first capture with recorded acknowledgement ([`REQ-MON-009`](#/functional-requirements)); notification before monitoring increases ([`NFR-PRIV-004`](#/non-functional-requirements)); visible tracker state ([`REQ-DEV-004`](#/functional-requirements)); the disclosure generated from the live configuration so it cannot drift from reality.

:::warning None of this is required by any source
No source document mentions employee transparency (`GAP-07`). It is `{Proposed}` and rated `{P0}`. The reasoning: retrofitting subject visibility across every capture path after launch is several times the cost of building it in, and a monitoring product that fails this test is one public incident away from being unsellable. This is the single most consequential recommendation in this documentation, and it needs explicit acceptance rather than silent adoption.
:::

### 5.4 Proportionality — an organization decision the product must support

The product does not decide how intrusive an organization's monitoring should be. It must make each level **possible, visible and bounded**:

| Level | Configuration |
|---|---|
| Time only | All capture types disabled; time and project attribution only |
| Time with evidence | Screenshots at a long interval |
| Time with activity context | Screenshots plus activity, application and website capture |
| Full capture | The above plus continuous screen recording |

Every level is available; every level is disclosed to the Member; every level is retention-bounded.

### 5.5 Retention

Retention is simultaneously a commercial commitment (3 / 6 / 24 months `{Confirmed}`), a cost control, and a privacy control. [`BR-DATA-001`](#/business-rules) to [`BR-DATA-004`](#/business-rules).

The ordering rule matters: **media is deleted from object storage before its metadata** ([`BR-DATA-004`](#/business-rules)). Deleting metadata first can leave a private image that nothing references and nobody can locate to delete — a permanent, invisible retention violation.

---

## 6. Areas requiring legal and compliance review

Recorded as questions for counsel, with no answer asserted.

| # | Question | Why it affects the product |
|---|---|---|
| L1 | In which jurisdictions will the product be sold and operated? | Determines every other question here; currently undetermined |
| L2 | What lawful basis does an employer rely on for continuous activity monitoring in each target jurisdiction, and is employee consent a valid basis given the power asymmetry? | Determines whether the disclosure-and-acknowledgement model is sufficient or whether more is needed |
| L3 | Does deployment require prior consultation with works councils, unions or employee representatives in any target market? | Affects onboarding flow and sales process, not only documentation |
| L4 | Is screen recording lawful in each target market, and under what conditions? | Recording is a Premium feature; if it is unlawful in a target market, Premium cannot be sold there |
| L5 | What is the vendor's role — processor, controller, or both, and for which categories? | Determines contractual terms and who answers a subject request |
| L6 | What must a data processing agreement contain for each market? | Blocks enterprise-adjacent sales |
| L7 | Must subject access and erasure be supported, and what may lawfully be retained despite an erasure request? | [`REQ-DATA-005`](#/functional-requirements) provides the mechanism; the policy is a legal determination |
| L8 | Are there data-residency requirements in target markets? | The launch architecture is single-region — [`NFR-PRIV-008`](#/non-functional-requirements) |
| L9 | Are there sector-specific restrictions (healthcare, legal, financial) on capturing screens where third-party confidential data is visible? | May require sensitive-application exclusion, currently `GAP-17` |
| L10 | What breach notification obligations apply, to whom, and within what period? | Determines incident response design |
| L11 | Is the payroll output subject to any record-keeping obligation that constrains retention or deletion? | Interacts with [`BR-DATA-005`](#/business-rules) |
| L12 | Can the platform's own retention deletion conflict with a customer's legal-hold obligation? | Requires a hold mechanism — noted in [`REQ-DATA-003`](#/functional-requirements) |

:::warning Treat legal review as a launch blocker
A monitoring product launched without answers to L1–L4 is exposed to a category of risk that no engineering control mitigates. Registered as [`RISK-005`](#/risks) with `{High}` impact and `{High}` likelihood, because review has not started.
:::

---

## 7. Controls by lifecycle stage

| Stage | Controls |
|---|---|
| **Design** | Threat model at `M-02`; data inventory; module boundaries enforced; tenancy strategy reviewed |
| **Build** | Isolation tests on every build; dependency scanning; no plan-name or unscoped-query checks; secrets outside source control |
| **Test** | Entitlement matrix per endpoint; idempotency replay; golden-dataset payroll; timezone and DST matrix; retention job with seeded expired data |
| **Release** | Penetration test before `M-09`; audit coverage checklist; accessibility review; restore rehearsal actually performed |
| **Operate** | Structured logs without content; sync, queue, retention and backup alerting; audited support elevation; rotation of secrets |
| **Respond** | Incident procedure; breach notification path per L10; ability to revoke all sessions and device tokens platform-wide |

---

## 8. Security and privacy debt accepted at MVP

Stated explicitly so it is a decision rather than an oversight.

| Accepted | Consequence | Planned |
|---|---|---|
| No multi-factor authentication | Account takeover risk on accounts that can view screen recordings | [`OQ-027`](#/open-questions) — should be reconsidered before launch, not after |
| Application-level tenant isolation only | Single-layer defence for the highest-severity failure | Row-level security {V1.1} |
| No screenshot blurring or application exclusion | Indiscriminate capture is only mitigated, not reduced | {V1.1}, [`OQ-015`](#/open-questions) |
| Single-region deployment | Constrains which markets can be sold into | Determined by L8 |
| No legal-hold mechanism | Retention deletion could conflict with a customer's obligation | {V1.1}, L12 |
| Single-VPS deployment, no failover | 99.5% availability with capture continuing offline | [`RISK-010`](#/risks) |
| Support elevation is the only vendor-access control | Infrastructure-level database access is out of the application's reach | Operational control required at `M-02` |

---

## 9. What good looks like at launch

The security and privacy launch gate, in one list. Each maps to a criterion in [Project Planning](#/project-planning) §3.

1. No test can read another Organization's data through any endpoint — `SC-01`
2. Every gated endpoint refuses an unentitled Organization when called directly — `SC-05`
3. Retention deletes from both storage systems within 24 hours — `SC-06`
4. Every capture category is visible to its subject — `SC-07`
5. Every permission-, policy- and money-relevant action is audited — `SC-08`
6. No approval record can be modified or deleted — `SC-09`
7. No vendor-side access to tenant business data occurs without an audited elevation
8. No credential, token, signed URL or captured content appears in any log
9. A restore has been performed on clean infrastructure, not merely documented
10. Legal review of L1–L4 is complete for every launch market
