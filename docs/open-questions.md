# Open Questions & Decisions Required

Questions this documentation deliberately did not answer, because guessing would either (a) commit the product to something a stakeholder has authority over, or (b) produce a requirement worse than no requirement.

:::note 24 of these are now closed
Answers were given in [Decision Record — Round 1](#/answers-decisions) and [Round 2](#/answers-decisions-verify), and are indexed in the [Decision Log](#/decision-log). The entries below are retained as the record of what was asked and why; **the decisions are authoritative for anything they cover**. One new question, `OQ-029`, arose from those answers.
:::

| Status | Count | Questions |
|---|---|---|
| **Closed** | 24 | `OQ-001` to `OQ-006`, `OQ-008`, `OQ-009`, `OQ-011` to `OQ-013`, `OQ-015` to `OQ-020`, `OQ-022` to `OQ-028` |
| **Open** | 5 | `OQ-007` · `OQ-010` · `OQ-014` · `OQ-021` · `OQ-029` |
| **Blocks launch** | 1 | `OQ-014` — legal review, the only one no engineering resolves |

**Milestone `M-01` — the requirements baseline sign-off — requires every question here to be resolved or explicitly deferred with a named owner and a date.**

---

## Blocks System Design

### OQ-001 — Is the product called "Team Time Track" or "Time Time Track"?
**Owner:** Product · **Blocks:** everything downstream · **Source:** [`CONF-01`](#/source-audit)

The commissioning brief says *"Time Time Track"*. All fourteen research files and the repository directory say **"Team Time Track"**.

**Recommendation:** Team Time Track. Fifteen of sixteen sources agree, and it is semantically meaningful where "Time Time" reads as a typographic error.

**Cost of delay:** low now, high once it is in a domain name, an installer, email templates and a trademark filing.

---

### OQ-002 — Does MVP ship mobile and Chrome clients, or does the matrix change?
**Owner:** Product · **Blocks:** scope, schedule, `RISK-002` · **Source:** [`CONF-04`](#/source-audit)

The matrix grants "Windows, Mac, Linux, Chrome and mobile apps" to **all plans including Basic** `{Confirmed}`. MVP as scoped ships a desktop tracker and a web application.

| Option | Consequence |
|---|---|
| **A — Restrict the matrix** | Re-issue with the platforms actually shipped. No schedule impact. Weaker Basic proposition |
| **B — Extend scope** | A fourth client surface, a new capture model, app store distribution. Substantial cost and schedule impact |
| **C — Ship a limited mobile client** | Time entry and viewing only, no capture. Middle path; needs its own scoping |

**Recommendation:** A, with C as a V1.1 target. This documentation assumes A — see [`ASM-004`](#/assumptions).

**Cost of delay:** high. Every week the matrix circulates unchanged increases the misrepresentation exposure.

---

### OQ-006 — What exactly does "automatic tracking" do?
**Owner:** Product, with Legal input · **Blocks:** `TIME` module, privacy posture · **Source:** `GAP-04`

The matrix sells "User controlled or automatic tracking" for all plans `{Confirmed}` and never defines automatic. This is the most privacy-consequential undefined term in the source material.

**Proposed in [`REQ-TIME-004`](#/functional-requirements):** starts only within scheduled hours, only where the Organization has explicitly opted in, only on detected activity, always visibly indicated, with a cooldown after a Member stops it.

**Questions requiring an answer:**
1. Does it start on sign-in, on activity, or at the scheduled shift start?
2. Can it start outside scheduled hours? *(Proposed: no)*
3. Can a Member stop it, and for how long? *(Proposed: yes, with a cooldown)*
4. Can an Organization enable it without the `schedules` entitlement, and therefore without a defined boundary? *(Proposed: no)*

**Cost of delay:** high. A permissive answer changes the product's legal posture in several jurisdictions.

---

### OQ-008 — Are the performance, scale and availability targets correct?
**Owner:** Product / Engineering · **Blocks:** infrastructure sizing, whether aggregates are MVP · **Source:** `GAP-12`, [`ASM-014`](#/assumptions)

Every number in [Non-Functional Requirements](#/non-functional-requirements) is proposed, none measured. The two that drive cost:

| Target | Proposed | Consequence if higher |
|---|---|---|
| Availability | 99.5%/month | Requires redundancy, contradicting the single-VPS decision |
| Concurrency | 500 organizations, 10,000 memberships, 2,000 concurrent trackers | An order of magnitude more requires aggregate tables, read replicas and partitioning at MVP |

**Cost of delay:** high. These determine the infrastructure decision, which is hard to reverse.

---

### OQ-011 — Does MVP include leave balances?
**Owner:** Product · **Blocks:** `LEAVE` module scope · **Source:** [`CONF-09`](#/source-audit)

`resources-1.md` §23 lists leave balance as an MVP capability. No entity anywhere holds entitlement, accrual or balance.

**Consequence of the current scope:** a Member can request leave; nobody can answer "how much leave do I have left?", which is the question employees actually ask.

| Option | Consequence |
|---|---|
| **A — Request and approval only** | Ship as scoped; state the limitation in the plan description |
| **B — Add balances** | New entities for entitlement, accrual and carry-over; accrual rules are jurisdiction- and policy-specific and get complicated quickly |

**Recommendation:** A for MVP, B for V1.1, with the limitation stated plainly in sales material rather than discovered by a customer.

---

### OQ-013 — Does Premium ship at launch?
**Owner:** Product · **Blocks:** release plan, commercial matrix · **Source:** [`RISK-004`](#/risks), [`ASM-006`](#/assumptions)

Premium consists of three deliverable features — video recording, Office vs Remote, internet connectivity — plus one that cannot currently be specified. All are scheduled last.

| Option | Consequence |
|---|---|
| **A — Ship all three** | Full three-tier launch; recording is the largest remaining technical risk after the tracker itself |
| **B — Launch with two tiers** | Publish a two-tier matrix; add Premium in V1.1. Loses the top of the pricing ladder at launch |
| **C — Ship recording only** | Premium exists with one differentiator; Office vs Remote and connectivity follow |

**Recommendation:** decide now rather than discovering it in R8. C is the pragmatic middle.

---

### OQ-014 — Which jurisdictions, and what does the law require there?
**Owner:** Product / Legal · **Blocks:** launch, data residency, possibly Premium · **Source:** [`RISK-005`](#/risks), [Security & Privacy](#/security-privacy) §6

Target markets are undetermined, and no legal review has begun. Questions L1–L12 in [Security & Privacy](#/security-privacy) §6 all depend on this one.

**The four that must be answered before launch:**
- L1 — which markets
- L2 — lawful basis for continuous monitoring, given the employment power asymmetry
- L3 — whether works council or employee representative consultation is required
- L4 — whether screen recording is lawful in each market

**Cost of delay:** the highest of any question here. Legal review has a lead time measured in weeks, and a negative answer in a target market cannot be engineered around.

---

### OQ-023 — How does screen capture handle multiple and high-DPI displays?
**Owner:** Product / Engineering · **Blocks:** `MON` and `REC` implementation · **Source:** [`NFR-COMPAT-004`](#/non-functional-requirements)

Undefined anywhere. Options: capture all displays composited, capture each display separately, capture only the display with focus.

**Considerations:** compositing multiple 4K displays produces large images and large recordings; capturing only the focused display can miss the work; capturing separately multiplies storage. Storage cost and privacy exposure both scale with this choice.

---

### OQ-027 — Is multi-factor authentication required before launch?
**Owner:** Product / Security · **Blocks:** `AUTH` scope · **Source:** [Security & Privacy](#/security-privacy) §4 T10

MFA is not specified anywhere in `resources/` and is not in MVP scope. For a product holding screen recordings of employees, an account takeover on an Administrator or Manager account exposes video of named individuals.

**Recommendation:** treat as `{P1}` for MVP at minimum for Owner and Administrator roles. Its absence is difficult to defend to a security-conscious buyer, and adding authentication factors later means a migration for every existing account.

---

## Blocks launch

### OQ-003 — Is there a support channel at launch?
**Owner:** Product · **Source:** [`CONF-12`](#/source-audit), [`RISK-022`](#/risks)

Every Support row in the matrix — **including Email** — is marked future release. Read literally, a paying customer has nowhere to go.

**Almost certainly a defect in the source document.** It is recorded rather than silently corrected because correcting a commercial commitment without authority is exactly what this documentation should not do.

**Recommendation:** confirm, then re-issue the matrix with at least email support available at launch.

---

### OQ-004 — What are "work-life balance metrics"?
**Owner:** Product · **Blocks:** [`REQ-REPORT-014`](#/functional-requirements) · **Source:** `GAP-01`

Sold in Standard and Premium `{Confirmed}`. Defined nowhere.

**What is known:** the underlying data already exists — tracked hours against scheduled hours, work outside scheduled hours, break frequency and duration, session length, weekend and late-night activity. **The gap is entirely definitional**, which makes it cheap to close once someone decides.

**What must be decided:** which metrics, what thresholds constitute a concern, who sees them, and — most importantly — whether they are framed as *employee wellbeing* or as *management oversight*. The same data supports both framings and they are very different products.

---

### OQ-005 — What is the "executive dashboard"?
**Owner:** Product · **Blocks:** [`REQ-REPORT-013`](#/functional-requirements) · **Source:** `GAP-03`

Sold as a Premium capability `{Confirmed}`. Defined nowhere.

**What is known:** it belongs to the "Company Insights" audience, and that audience asks about organization-level performance rather than individual or team activity.

**What must be decided:** which questions it answers, which metrics it shows, what period it covers, and whether it requires pre-computed aggregates — which would move aggregate tables from V1.1 into MVP and change [`RISK-013`](#/risks).

---

### OQ-007 — What is the pricing?
**Owner:** Commercial · **Source:** `GAP-10`, [`ASM-002`](#/assumptions)

No price, currency, billing interval, seat band or discount appears anywhere in any source.

**Depends on it:** seat limits per plan, trial length, downgrade rules, and the unit economics that determine whether the retention tiering is sufficient cost control ([`RISK-018`](#/risks)).

---

### OQ-009 — Which billing provider?
**Owner:** Product / Engineering · **Blocks:** R7 · **Source:** `GAP-19`, [`RISK-008`](#/risks)

The subscription model abstracts a provider without selecting one. The abstraction contains the change, but the choice affects trial handling, proration on upgrade, dunning behaviour on failed payment, and the reconciliation design in [`REQ-BILL-008`](#/functional-requirements).

---

### OQ-010 — Which transactional email provider?
**Owner:** Operations · **Blocks:** R0 · **Source:** `GAP-19`, [`RISK-024`](#/risks)

Invitations, verification, password resets and approval notifications all depend on email arriving. Needed early — R0 cannot be demonstrated without it.

---

### OQ-021 — Team, capacity and target date?
**Owner:** Project management · **Blocks:** all scheduling

No team size, composition, availability or velocity data exists. [Project Planning](#/project-planning) deliberately publishes sequencing and dependencies without dates rather than inventing them.

**Needed to answer:** whether the MVP as scoped is achievable, and if not, which of the descope options in [`RISK-006`](#/risks) applies.

---

### OQ-026 — How does a single-person organization approve its own time?
**Owner:** Product · **Source:** [`BR-TS-005`](#/business-rules)

No Member may approve their own Timesheet — including an Owner. In an organization of one, no Timesheet can ever be approved, and therefore payroll can never run.

| Option | Consequence |
|---|---|
| **A — Owner self-approval where they are the only active Member** | Narrow exception, audit-logged and visibly flagged as self-approved |
| **B — Payroll runs on unapproved time in single-member organizations** | Violates [`BR-PAY-001`](#/business-rules) — not recommended |
| **C — Solo organizations cannot use payroll** | Simple and defensible; excludes a plausible customer |

**Recommendation:** A, with the self-approval explicitly marked in the approval history and the payroll export, so nothing is silently self-certified.

---

## Blocks a specific feature

### OQ-012 — What is the time rounding rule for payroll?
**Owner:** Product / Finance · **Blocks:** `PAY` · **Source:** `GAP-14`

Rounding is referenced in the organization settings example and never specified. Payroll converts integer seconds into payable hours, and the rule determines what people are paid.

**Must decide:** rounding increment (exact, nearest minute, nearest 5/15 minutes), direction (nearest, up, down), and whether rounding applies per entry, per day or per period. Applying it per entry versus per period can produce materially different totals for the same work.

[`BR-PAY-004`](#/business-rules) already requires that whatever rule is chosen is recorded with the output.

---

### OQ-015 — Screenshot blurring and sensitive-application exclusion?
**Owner:** Product · **Source:** `GAP-17`, [Security & Privacy](#/security-privacy) §2

Screenshots capture whatever is on screen — including personal messages, banking pages, third-party confidential material and visible credentials. Blur-by-default and per-application exclusion are the strongest available mitigations and are **not in MVP**.

**Options:** blur by default with click-to-reveal (audited); per-application or per-domain exclusion lists; Member-initiated pause with a recorded gap.

**Recommendation:** at least one before selling into sectors handling third-party confidential data (legal, healthcare, financial).

---

### OQ-017 — How is Basic positioned?
**Owner:** Product · **Source:** [`RISK-017`](#/risks)

Basic has no management features at all — no attendance, schedules, approvals, payroll, or activity data. It is screenshots, hours, timeline and reports, at nearly the same infrastructure cost as Standard.

**Risk:** it reads as a surveillance tool with no management value, which is both a churn driver and a reputational one.

**Options:** reposition as an explicit entry tier with a clear upgrade trigger; move one management feature down (attendance is the strongest candidate); or accept it as a trial-conversion tier.

---

### OQ-018 — Do contractors need different behaviour?
**Owner:** Product · **Source:** [`ASM-007`](#/assumptions)

Currently a contractor is a Membership with the Employee role and an hourly Pay Rate. If contractors need different leave rules, no schedule, different approval routing or invoice-shaped output, that is new behaviour in `LEAVE`, `SCHED` and `TS`.

---

### OQ-019 — Is a separate Finance role needed at MVP?
**Owner:** Product · **Source:** [`ASM-008`](#/assumptions)

Currently payroll is performed by an Owner or Administrator. A dedicated role would let someone run payroll without being able to change organization settings, and would let an Administrator manage the organization without seeing pay rates.

**Note:** many organizations consider pay rates confidential from operational administrators. This is a smaller decision than it looks, and a cheap one to make now.

---

### OQ-028 — What is the default screenshot interval?
**Owner:** Product · **Source:** [`ASM-020`](#/assumptions)

The matrix specifies no interval. `resources/` mentions 15 and 10 minutes only as illustrative examples.

**Must decide:** the default, the enforced minimum ([`BR-MON-002`](#/business-rules)), and whether capture times are randomised within the interval.

**Why it matters more than it looks:** the default is what most organizations will use, so it effectively *is* the product's privacy posture. It also drives storage cost linearly.

---

## Should be answered early

### OQ-016 — Should real competitive research be commissioned?
**Owner:** Product · **Source:** [Product Analysis](#/product-analysis) §1

`resources/` contains **no factual material about Time Doctor or any competitor** beyond an unattributed feature matrix. [Product Analysis](#/product-analysis) therefore analyses the capability set rather than the market, and makes no competitor claims.

**Consequence of leaving it:** positioning, pricing and differentiation decisions are being made without market evidence.

---

### OQ-020 — Should the personas be validated?
**Owner:** Product · **Source:** [Personas](#/personas)

The six personas are constructed from the capability set, not from research. They are useful for prioritisation and should not be cited as evidence of user need.

**Cheapest useful validation:** five to eight interviews across the Manager, Employee and Administrator roles at target-profile organizations, before UI/UX Design begins.

---

### OQ-022 — What grace period applies before a downgrade deletes data?
**Owner:** Product · **Source:** [`REQ-BILL-009`](#/functional-requirements)

Moving from Premium (24 months retention) to Basic (3 months) makes 21 months of data immediately eligible for deletion.

**Must decide:** the grace period length, whether export is offered first, and whether the customer is warned of the volume affected before confirming. Deleting a year of screenshots the moment a customer saves money on their plan is a support incident waiting to happen.

---

### OQ-024 — Which monitoring policy changes require re-acknowledgement?
**Owner:** Product / Legal · **Source:** [`REQ-MON-009`](#/functional-requirements)

Members acknowledge a monitoring disclosure before first capture. When the Organization changes the configuration, some changes plainly warrant re-acknowledgement (enabling screen recording) and some plainly do not (a longer screenshot interval).

**Must decide:** where the line falls, and whether re-acknowledgement blocks tracking until given.

---

### OQ-025 — Can an Organization opt out of vendor support access?
**Owner:** Product · **Source:** [`REQ-ADMIN-005`](#/functional-requirements)

Support elevation is audited, time-bounded and notified. Should an Organization additionally be able to refuse it entirely?

**Trade-off:** opting out is a meaningful trust signal and a plausible enterprise requirement. It also means some support problems become undiagnosable, and the customer must understand that trade before choosing it.

---

### OQ-029 — What resource limits apply during a trial? {Open}
**Owner:** Commercial · **Source:** `DEC-029`, Round 2 §5 · **Raised by:** the answers themselves

`DEC-008` gives every plan a **30-day trial**, and `DEC-029` makes trials **entitlement-identical to the paid plan** — no feature restrictions. A Premium trial therefore grants multi-display screen recording for 30 days at no cost to the trialist.

At the figures in [Capture & Media](#/sd-capture) §4, an unconstrained Premium trial with two displays can generate roughly **80 GB in a single 30-day trial per member**. Ten trial members produce close to a terabyte that must be stored for the plan's retention period.

`DEC-029` explicitly separates **feature entitlement** from **resource abuse limits** and declines to invent numbers without a unit-economics decision. That is the right call — but the numbers are still needed.

**Must decide:** the limit type and value for `trial_max_storage_bytes`, `trial_max_recording_hours` and `trial_max_seats`; whether breaching a limit stops recording, stops all capture, or prompts an upgrade; and whether limits differ by plan.

**Already built:** the enforcement point sits in the upload-intent endpoint reading `storage_usage_daily`, and the limits are `plan_features` rows applied only while `status = 'trialing'` — [Jobs, Reporting & Billing](#/sd-platform) §9. Setting values is configuration, not development.

**Until then:** the exposure is monitored rather than capped — a knowingly accepted position, not an oversight. [`RISK-018`](#/risks).

---

## Question summary

| ID | Question | Owner | Blocking |
|---|---|---|---|
| `OQ-001` | Product name | Product | Design |
| `OQ-002` | Mobile and Chrome clients in MVP | Product | Design |
| `OQ-003` | Support channel at launch | Product | Launch |
| `OQ-004` | Work-life balance metrics definition | Product | Launch |
| `OQ-005` | Executive dashboard definition | Product | Launch |
| `OQ-006` | Automatic tracking behaviour | Product/Legal | Design |
| `OQ-007` | Pricing | Commercial | Launch |
| `OQ-008` | Performance, scale, availability targets | Product/Engineering | Design |
| `OQ-009` | Billing provider | Product/Engineering | Launch |
| `OQ-010` | Email provider | Operations | Launch |
| `OQ-011` | Leave balances in MVP | Product | Design |
| `OQ-012` | Payroll rounding rule | Product/Finance | Feature |
| `OQ-013` | Premium at launch | Product | Design |
| `OQ-014` | Jurisdictions and legal requirements | Product/Legal | Design + Launch |
| `OQ-015` | Screenshot blurring and exclusions | Product | Feature |
| `OQ-016` | Commission competitive research | Product | Early |
| `OQ-017` | Basic tier positioning | Product | Feature |
| `OQ-018` | Contractor behaviour | Product | Feature |
| `OQ-019` | Separate Finance role | Product | Feature |
| `OQ-020` | Validate personas | Product | Early |
| `OQ-021` | Team, capacity, target date | Project management | Launch |
| `OQ-022` | Downgrade grace period | Product | Early |
| `OQ-023` | Multi-display capture behaviour | Product/Engineering | Design |
| `OQ-024` | Material monitoring policy changes | Product/Legal | Early |
| `OQ-025` | Organization opt-out of support access | Product | Early |
| `OQ-026` | Single-person organization approval | Product | Launch |
| `OQ-027` | Multi-factor authentication | Product/Security | Design |
| `OQ-028` | Default screenshot interval | Product | Feature |
| `OQ-029` | Trial resource limits | Commercial | **Open** — early |

---

## If only five can be answered this week

1. **`OQ-014`** — jurisdictions. It has the longest lead time and no engineering workaround.
2. **`OQ-002`** — platform commitments. Free to fix today; a misrepresentation the moment the matrix reaches a customer.
3. **`OQ-004`** and **`OQ-005`** — the two unspecifiable features. Both are pure definition work, and both block a `{Confirmed}` commercial commitment.
4. **`OQ-006`** — automatic tracking. It shapes the product's privacy posture, and the answer constrains architecture.
5. **`OQ-021`** — team and dates. Without it, no statement about what MVP contains can be tested against reality.
