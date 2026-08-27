One important point first: feature (resources/Features_Per_Plan.pdf) matrix confirms that **screenshots, hours tracked, timeline, projects/tasks reports, and groups/teams are in all three plans**; Standard adds activity/inactivity, web/app usage, productivity, attendance, breaks, leave, payroll, schedules, work-life metrics and time approvals; Premium adds Office vs. Remote, internet connectivity, video recording and executive dashboard/reporting.  

---

# OQ-001 — Product name

### Decision: **Team Time Track**

I agree with the recommendation.

Our official product/project name should be:

> **Team Time Track**

We'll use it consistently in:

- database/documentation
- Laravel application
- Next.js application
- Electron tracker
- API
- installer
- email templates
- domains
- environment variables
- branding

We should not carry **Time Time Track** forward.

**Status: RESOLVED**

---

# OQ-002 — Mobile and Chrome clients

This one needs a distinction between **cloning the Time Doctor feature matrix** and **MVP implementation scope**.

Your source says:

> Windows, Mac, Linux, Chrome and mobile apps — YES for all three plans. 

But your current technical architecture only has:

```text
Next.js
Laravel API
Electron Desktop Tracker
```

### My recommendation

For our **MVP**, I would explicitly define:

```text
MVP
├── Web application
├── Windows Electron tracker
├── macOS Electron tracker
└── Linux Electron tracker
```

Do **not** promise:

```text
Mobile
Chrome extension
```

until we actually implement them.

However, because we're cloning the product rather than permanently redefining its commercial model, I'd keep the architecture open for:

```text
V1.1+
├── Chrome extension
└── Mobile app
```

### Why?

The backend should already expose platform-neutral APIs:

```text
Electron
Chrome
Mobile
Web
   ↓
Laravel API
```

So adding clients later shouldn't require redesigning the backend.

**Decision: MVP = Desktop + Web. Mobile/Chrome = future client surfaces.**

---

# OQ-006 — What exactly is Automatic Tracking?

This is one of the most important questions.

The source only confirms:

> User controlled or automatic tracking — YES for all plans. 

It does **not** define the exact behavior.

Therefore we should not claim that Time Doctor's exact internal algorithm is known from the source.

### For our Time Doctor-style clone, I recommend:

```text
Organization enables automatic tracking
                ↓
Employee has an active schedule
                ↓
Scheduled working period begins
                ↓
Tracker becomes eligible
                ↓
Desktop detects activity
                ↓
Tracking begins
```

But there is an important distinction:

### Automatic tracking ≠ invisible surveillance

The Electron application should visibly indicate:

```text
● Tracking
```

and the user should be able to stop/pause according to the product rules we establish.

### My proposed behavior

| Question | Decision |
|---|---|
| Start at sign-in? | **No** |
| Start at activity? | **Yes, within eligible period** |
| Start at scheduled shift? | **Eligible from shift start** |
| Start outside schedule? | **No, by default** |
| Can employee stop? | **Yes** |
| Visible tracking indicator? | **Yes** |
| Can organization enable it without schedules? | **No** |

This is a **Team Time Track design decision**, not something explicitly established by your source.

I particularly agree with your document's concern here: automatic tracking is privacy-sensitive and shouldn't be left ambiguous.

**Decision: adopt the proposed controlled automatic-tracking model.**

---

# OQ-008 — Performance, scale and availability

I would **not treat 99.5% availability and 2,000 concurrent trackers as confirmed requirements**.

Your OQ correctly says these are proposed numbers rather than measured requirements.

And because we're using:

```text
Hostinger VPS
    ↓
Laravel
    ↓
PostgreSQL
    ↓
Redis
    ↓
Cloudflare R2
```

we should avoid designing MVP infrastructure around massive-scale assumptions.

### My recommendation

For MVP:

```text
Availability target:
99.5% monthly

Initial capacity target:
500 organizations
10,000 memberships
2,000 concurrent trackers
```

But classify these as:

> **Initial engineering capacity targets, not guaranteed SLA commitments.**

Then load-test before launch.

### Critical point

2,000 concurrent trackers is not the same as:

```text
2,000 API requests/second
```

The Electron tracker should batch telemetry.

For example:

```text
Electron
   ↓
local queue
   ↓
batch
   ↓
API
   ↓
Redis/Queue
   ↓
PostgreSQL
```

That dramatically changes infrastructure requirements.

### Hostinger VPS

For the initial MVP, I would keep the single VPS.

But:

> **Do not make the application architecturally dependent on a single server.**

We should be able to later move:

```text
Laravel
PostgreSQL
Redis
Workers
```

onto separate infrastructure.

**Decision: keep proposed targets as engineering targets; don't call them SLA guarantees.**

---

# OQ-011 — Leave balances

Your source confirms **Leave Tracking** for Standard and Premium. 

It does not, in the material you've provided, define a full accrual/balance system.

Therefore I agree:

### MVP

```text
Leave Types
      ↓
Leave Request
      ↓
Approval
      ↓
Approved Leave
      ↓
Attendance
```

No complex:

```text
Annual entitlement
Accrual
Carry-over
Proration
Jurisdiction-specific rules
```

for MVP.

However, there's a subtle improvement I'd make to our database.

We should make the model extensible for:

```text
leave_balances
leave_accruals
```

later without implementing them now.

**Decision: Leave requests + approval in MVP. Leave balances in V1.1.**

---

# OQ-013 — Does Premium ship at launch?

The feature matrix clearly puts these Premium capabilities in the product:

```text
Office vs Remote
Internet connectivity
Video screen recording
Executive dashboard/reporting
```



Your architecture also explicitly says we will use Cloudflare R2 for screenshots/video recordings.

### My recommendation is actually Option A.

I would **not launch Premium with only video recording**.

Why?

Because then the commercial matrix becomes awkward:

```text
Premium
 └── Video recording
```

while our requirements explicitly describe Premium as a broader tier.

Instead:

### Launch

```text
Basic
Standard
Premium
```

with:

```text
Premium
├── Video recording
├── Office vs Remote
├── Internet connectivity
└── Executive dashboard/reporting
```

But we should distinguish:

> **Feature available** vs **feature fully mature.**

Video recording is the biggest engineering risk, so it should be developed early enough to be production-tested.

**Decision: Premium ships at launch, with all four defined Premium capabilities.**

---

# OQ-014 — Jurisdictions / legal requirements

This one cannot be answered from the product requirements.

Your sources explicitly identify this as unresolved.

So we should **not invent a legal answer**.

Before public launch, we need to decide:

```text
Target markets
     ↓
Legal/privacy review
     ↓
Monitoring requirements
     ↓
Employee notification/consent requirements
     ↓
Screen recording requirements
     ↓
Data retention
     ↓
Data processing agreements
```

### From an engineering perspective

We should nevertheless design the system to support privacy controls:

```text
Organization monitoring settings
Employee visibility
Pause tracking
Capture configuration
Retention
Access control
Audit logs
Deletion
```

That gives us flexibility once the target jurisdictions are determined.

**Decision: unresolved; legal/product decision required before launch.**

---

# OQ-023 — Multiple / High-DPI Displays

**Owner:** Product / Engineering  
**Blocks:** `MON` and `REC` implementation  
**Source:** `NFR-COMPAT-004`

### Decision

**Team Time Track MVP will support simultaneous multi-monitor screen recording, with one independent recording stream per physical display.**

This means we will **not** composite multiple monitors into one video.

For example, if a user's workstation has three displays:

```text
Workstation
├── Display 1 → Recording Stream 1
├── Display 2 → Recording Stream 2
└── Display 3 → Recording Stream 3
```

All streams are recorded **simultaneously** during the same recording session.

---

### Screenshot behavior

Screenshots will also be captured **per display**:

```text
Screenshot Capture
├── Display 1 → Screenshot
├── Display 2 → Screenshot
└── Display 3 → Screenshot
```

This keeps screenshots and video consistent with the physical-monitor model.

---

### Video recording model

A single recording session may therefore contain multiple streams:

```text
Recording Session
│
├── Display 1
│    ├── Segment 001
│    ├── Segment 002
│    └── Segment 003
│
├── Display 2
│    ├── Segment 001
│    ├── Segment 002
│    └── Segment 003
│
└── Display 3
     ├── Segment 001
     ├── Segment 002
     └── Segment 003
```

The streams should share a common session/recording timeline so the web application can later play or inspect them synchronously.

---

### High-DPI support

The Electron tracker must detect each display's:

- physical resolution
- logical resolution
- DPI / scale factor
- display identifier
- display position
- display orientation

We should **capture at the appropriate physical pixel resolution**, rather than accidentally recording only the scaled/logical resolution.

For example:

```text
Display 1
3840 × 2160
Scale: 150%

Display 2
2560 × 1440
Scale: 100%
```

These remain two independent recording streams.

---

### Important database implication

Our existing `recordings` / `recording_segments` design should be refined.

I recommend:

```text
recordings
    │
    ├── display 1
    │     └── recording segments
    │
    ├── display 2
    │     └── recording segments
    │
    └── display 3
          └── recording segments
```

Therefore, a recording should have a `display_id` or equivalent display identifier.

We should also maintain a workstation-level display identity rather than relying only on:

```text
display_index = 1
display_index = 2
```

because monitor ordering can change when users connect/disconnect displays.

---

### Cloudflare R2 storage

Each display stream should be stored independently in R2.

For example:

```text
recordings/
  {organization_id}/
    {membership_id}/
      {recording_id}/
        display-1/
          segment-001.mp4
          segment-002.mp4

        display-2/
          segment-001.mp4
          segment-002.mp4
```

This provides better scalability than creating one huge multi-monitor video.

---

### Synchronization requirement

The streams need a common timeline.

For example:

```text
Recording starts
00:00 ───────────────────────────── 10:00
       │                             │
Display 1 ────────────────────────────
Display 2 ────────────────────────────
Display 3 ────────────────────────────
```

Every segment should have timestamps that allow the frontend to determine:

> "At 04:37 in the recording session, show Display 1, Display 2 and Display 3 simultaneously."

This is particularly important for the future **multi-monitor playback UI**.

---

### MVP scope

The MVP will support:

- ✅ Multiple physical displays
- ✅ Simultaneous recording
- ✅ One video stream per display
- ✅ High-DPI displays
- ✅ Different resolutions per display
- ✅ Different scale factors
- ✅ Display-specific recording metadata
- ✅ Synchronized timestamps
- ✅ Independent R2 objects
- ✅ Independent recording segments
- ✅ Multi-display screenshots

We will **not** composite the displays into a single video stream.

---

### Updated OQ decision

> **Decision: Team Time Track MVP will record all connected displays simultaneously, using one independent video recording stream per physical display. Screenshots will also be captured per display. Each display stream will retain its own resolution/DPI metadata and will share a common recording timeline to support synchronized playback.**

**Status: ✅ RESOLVED**

This also means I would update our earlier database design before we start implementing the Laravel migrations—particularly **`recordings`, `recording_segments`, and `devices`**—to explicitly model physical displays.

---

# OQ-027 — MFA

I agree strongly with the recommendation.

For a system containing:

- employee screenshots
- video recordings
- activity history
- payroll
- pay rates

MFA is an important security control.

### MVP

At minimum:

```text
Owner
Administrator
```

should support/require MFA.

Ideally:

```text
Owner
Administrator
Manager
```

should support MFA, with organization policy determining whether it is mandatory.

### Authentication architecture

I'd design:

```text
Password
   +
TOTP MFA
```

for MVP.

Later:

```text
WebAuthn / Passkeys
SSO
```

can be added.

SSO itself is marked as future release in your matrix, so it should not become an MVP dependency. 

**Decision: MFA = P1 MVP. TOTP first; passkeys/SSO later.**

---

# OQ-003 — Support channel

Your matrix currently says even Email support is future release. 

I agree that this is commercially problematic.

For a paid SaaS:

```text
Customer
   ↓
Problem
   ↓
???
```

is not acceptable.

### MVP

At minimum:

```text
Support email
```

should exist.

It doesn't require a sophisticated support-ticket system.

For example:

```text
support@teamtimetrack.com
```

could initially be sufficient.

Ticket portal/live chat/callback can come later.

**Decision: Email support at launch.**

---

# OQ-004 — Work-life balance metrics

This should **not become an employee surveillance score**.

The underlying data supports useful measurements:

```text
Scheduled hours
Tracked hours
Work outside schedule
Late-night work
Weekend work
Break duration
Session duration
```

I recommend the Standard/Premium feature be presented as:

### Work-life balance insights

Examples:

```text
Work outside scheduled hours
Weekend work
Average daily tracked hours
Long work sessions
Break patterns
Scheduled vs tracked time
```

### Avoid

Something like:

```text
Employee work-life score = 43/100
```

unless we have a very clear product definition.

That could become misleading and potentially harmful.

**Decision: objective metrics, not a simplistic employee "wellbeing score."**

---

# OQ-005 — Executive Dashboard

I recommend defining it as an **organization-level business overview**.

Not another employee surveillance screen.

### MVP Premium dashboard

```text
Organization
│
├── Total tracked hours
├── Active members
├── Team utilization
├── Scheduled vs tracked
├── Productivity trends
├── Attendance trends
├── Project/time distribution
├── Remote vs office
└── Connectivity overview
```

Time range:

```text
Today
7 days
30 days
Custom
```

The exact metric definitions should be written as functional requirements before implementation.

### Aggregates?

For MVP:

**Don't introduce a huge aggregate-data architecture prematurely.**

Start with indexed queries/materialized summaries where measurement shows they're necessary.

If the dashboard becomes slow:

```text
Raw data
   ↓
Aggregation jobs
   ↓
Daily organization metrics
```

can be introduced.

**Decision: organization-level executive overview; aggregation only where performance requires it.**

---

# OQ-007 — Pricing

This remains **unresolved**.

Your feature matrix doesn't provide:

- price
- currency
- billing interval
- seat bands
- discounts
- trial period

So we shouldn't invent these.

However, the database design we created already supports:

```text
Plan
Subscription
Price
Currency
Billing interval
Provider
```

Therefore pricing can be plugged in later without changing the core domain.

**Decision: Commercial decision required.**

---

Absolutely. Since we have now decided that **Team Time Track will use Stripe**, OQ-009 can be closed.

# OQ-009 — Which billing provider?

**Owner:** Product / Engineering · **Blocks:** `BILL` implementation, subscription lifecycle, checkout, trials, upgrades/downgrades, payment failures · **Source:** Product Decision

The original requirements abstracted the billing provider without selecting one. We have now made the commercial/technical decision to use **Stripe**.

### Decision

> **Team Time Track will use Stripe as its billing provider.**

Stripe will handle the payment and subscription lifecycle, while **Laravel remains the application-level source of truth for organizations, plans, subscriptions, and feature entitlements.**

### Billing architecture

```text
Customer
    │
    ▼
Team Time Track
    │
    ▼
Stripe Checkout
    │
    ├── Payment
    ├── Subscription
    ├── 30-day trial
    ├── Invoice
    └── Payment status
            │
            ▼
       Stripe Webhook
            │
            ▼
      Laravel Billing
            │
            ▼
      Subscription
            │
            ▼
       Plan / Entitlements
```

### Stripe will handle

- Customer payment
- Recurring subscriptions
- 30-day free trials
- Monthly/yearly billing
- Invoices
- Payment failures
- Subscription cancellation
- Subscription upgrades/downgrades
- Proration where applicable
- Billing-related webhooks

### Laravel will handle

Laravel will maintain our application-side records:

```text
Organization
      │
      ▼
Subscription
      │
      ▼
Plan
      │
      ▼
Plan Features
      │
      ▼
Entitlements
```

For example:

```text
Stripe
Premium subscription = active
        │
        │ webhook
        ▼
Laravel
subscription.status = active
        │
        ▼
Premium entitlements enabled
        │
        ├── Video recording
        ├── Office vs Remote
        ├── Internet connectivity
        └── Executive dashboard
```

### 30-day trial

Since we have also decided that **every plan has a 30-day free trial**, Stripe will manage the billing-side trial period.

```text
Basic     ──┐
Standard  ──┼──→ 30-day Stripe trial
Premium   ──┘
```

The selected plan's entitlements will be active during the trial.

### Webhook requirement

We should **not rely solely on the user's browser returning from Stripe** to activate a subscription.

Instead:

```text
Stripe Event
     ↓
Webhook
     ↓
Laravel
     ↓
Validate Stripe signature
     ↓
Process event
     ↓
Update subscription
     ↓
Update entitlements
```

Important Stripe events will include subscription and invoice/payment lifecycle events.

We should make webhook processing **idempotent**, so receiving the same Stripe event twice does not create duplicate subscription changes.

### Database

Our existing `subscriptions` table already has the appropriate abstraction:

```text
provider
provider_subscription_id
status
trial_ends_at
current_period_start
current_period_end
started_at
ended_at
canceled_at
```

For Stripe, for example:

```text
provider = stripe
provider_subscription_id = sub_xxxxxxxxx
```

We should also retain Stripe's customer identifier on the organization/billing side so we can reliably associate the Team Time Track organization with its Stripe customer.

### Important architectural rule

We should **not put Stripe-specific logic throughout the application**.

Instead:

```text
Stripe
   ↓
Stripe Billing Adapter
   ↓
Billing Domain
   ↓
Subscription
   ↓
Entitlement Service
```

This keeps the application clean and makes a future billing-provider change possible without rewriting the subscription system.

---

### Final decision

> **Team Time Track will use Stripe as its billing provider. Stripe will manage payment processing, recurring subscriptions, trials, invoices and billing lifecycle events. Laravel will remain the application-level source of truth for subscription state, plans and feature entitlements, synchronized through verified and idempotent Stripe webhooks. Every plan will provide a 30-day free trial.**

**Status: ✅ RESOLVED**

This also means **OQ-007 (Pricing)** is now the main remaining commercial billing question—we know *how* customers will pay, but we still need to decide *how much* Basic, Standard, and Premium will cost.

---

# OQ-010 — Transactional email

This one **must be solved early**.

We'll need email for:

```text
Email verification
Password reset
Organization invitations
Leave notifications
Timesheet notifications
Payroll notifications
Subscription notifications
```

The actual provider is still a commercial/operations decision.

For development we can use a sandbox/test mail service, then select the production provider before launch.

**Decision: provider unresolved; transactional email is an MVP dependency.**

---

# OQ-021 — Team, capacity and target date

This cannot be determined from the product documents.

So don't invent a deadline.

What we *can* do is sequence the work:

```text
Phase 1
Foundation
    ↓
Phase 2
Authentication / tenancy
    ↓
Phase 3
Time tracking
    ↓
Phase 4
Screenshots
    ↓
Phase 5
Standard management
    ↓
Phase 6
Payroll
    ↓
Phase 7
Premium
    ↓
Phase 8
Production hardening
```

Once you know the actual development team and availability, we can put dates against those phases.

**Decision: schedule remains dependent on team capacity.**

---

# OQ-026 — Single-member organization approval

I agree with **Option A**.

Example:

```text
Organization
└── Hasan
     └── Owner
```

If Hasan creates his own timesheet:

```text
Submit
   ↓
No other member
   ↓
Self-approval
```

Allow it, but explicitly record:

```text
approval_action = self_approved
```

and:

```text
is_self_approval = true
```

in the approval/audit trail.

That is far better than making payroll impossible for solo organizations.

**Decision: Owner can self-approve only when they are the sole active member.**

---

# OQ-012 — Payroll rounding

This one needs a concrete decision before payroll implementation.

For the MVP, I recommend:

> **Exact-to-the-second calculation internally, with configurable payroll rounding applied only at payroll calculation time.**

Default:

```text
Rounding: 1 minute
Method: nearest
Scope: payroll period
```

So we preserve:

```text
raw tracking = exact
```

and:

```text
payroll = rounded according to configured policy
```

### Why period-level?

Consider:

```text
Entry A = 2m 20s
Entry B = 2m 20s
```

Rounding each entry independently can produce a different result from rounding the combined period.

Payroll should use the organization's defined policy consistently.

And, as your OQ correctly notes, the actual rule must be recorded with the payroll output.

**Decision: default = nearest minute, period-level; retain exact seconds underneath.**

---

# OQ-015 — Screenshot blurring / sensitive applications

This is one where I would change our MVP posture slightly.

The source doesn't provide a required implementation. It identifies the privacy risk.

For a **Time Doctor clone**, screenshot capture is a core product capability—screenshots are available in all three plans. 

I recommend MVP supports:

### 1. Member-controlled pause

```text
Tracking
   ↓
Pause capture
   ↓
Gap recorded
```

### 2. Organization capture policy

For example:

```text
Screenshot capture:
Enabled / Disabled
```

### 3. Sensitive application/domain exclusions

I'd classify this as **P1/P1.5**, especially before targeting sensitive industries.

I would **not make blur-by-default mandatory for MVP**, because it changes the fundamental behavior of the screenshot feature.

But the architecture should support it later.

**Decision: pause + configurable exclusion architecture; advanced blur later.**

---

# OQ-017 — Basic positioning

I agree that this is primarily a **commercial/product decision**, not a database problem.

Your matrix gives Basic:

```text
Screenshots
Projects/tasks reports
Hours tracked
Timeline
Groups/teams
```

but not the Standard management features. 

I would keep the matrix rather than quietly moving features between tiers.

Position Basic as:

> **Core time tracking and visibility**

and Standard as:

> **Workforce management and productivity**

Premium:

> **Advanced monitoring and company insights**

That gives us a clean progression:

```text
BASIC
Track
   ↓
STANDARD
Manage
   ↓
PREMIUM
Analyze / Optimize
```

**Decision: keep the three-tier structure.**

---

# OQ-018 — Contractors

For MVP, I recommend **not creating a completely separate Contractor entity**.

Keep:

```text
User
   ↓
Organization Membership
   ↓
role = employee
```

and attach:

```text
Pay Rate
```

as we already designed.

Later we can introduce:

```text
employment_type
```

on the membership:

```text
employee
contractor
```

if behavior actually differs.

This prevents premature domain complexity.

**Decision: contractors use normal memberships in MVP; add employment type when business rules require it.**

---

# OQ-019 — Finance role

I recommend adding a dedicated:

> **Finance**

role before production.

Your concern is valid: payroll information can be considerably more sensitive than normal administration.

I'd structure the permissions approximately as:

```text
Owner
 └── Everything

Administrator
 ├── Organization management
 ├── Users
 ├── Teams
 ├── Projects
 └── Reports

Manager
 ├── Team
 ├── Time
 ├── Timesheets
 └── Approvals

Finance
 ├── Pay rates
 ├── Payroll
 └── Payroll reports

Employee
 ├── Own tracking
 ├── Own timesheets
 └── Own leave
```

The actual permission matrix should be finalized separately.

**Decision: add Finance role to MVP authorization model.**

---

# OQ-028 — Screenshot interval

This needs a concrete default.

Because screenshots are available on all three plans, the interval has major implications for both privacy and storage. 

### My recommendation

Default:

> **10 minutes**

And:

```text
Minimum allowed:
5 minutes
```

with randomized capture within the interval.

For example:

```text
Configured interval: 10 minutes

Possible captures:
10:02
10:11
10:19
10:31
...
```

rather than:

```text
10:00
10:10
10:20
10:30
```

This prevents the capture schedule from being trivially predictable.

### But one important caveat

Your source says **15 and 10 minutes were illustrative examples**, not an official requirement. So this is our proposed Team Time Track behavior, not a confirmed Time Doctor specification.

**Decision: default 10 minutes; minimum 5 minutes; randomized within interval.**

---

# OQ-016 — Should real competitive research be commissioned?

Your source is correct: the current resources do **not contain factual competitive research** about Time Doctor or other competitors. The existing Product Analysis is therefore capability analysis, not market evidence.

### Decision: **Yes — commission competitive research before final pricing/positioning.**

For our project, this should specifically include:

- Time Doctor
- Hubstaff
- ActivTrak
- Teramind
- Toggl Track
- Clockify

But because we're specifically cloning **Time Doctor**, Time Doctor should be the primary benchmark.

We should research:

```text
Competitor
├── Pricing
├── Plans
├── Feature availability
├── User/seat limits
├── Desktop tracker
├── Automatic tracking
├── Screenshots
├── Video recording
├── Activity monitoring
├── Productivity
├── Attendance
├── Payroll
├── Reports
├── SSO
├── API
├── Client access
├── Mobile
├── Chrome extension
└── Privacy controls
```

### Important

We should **not change our requirements merely because a competitor has a feature**.

The research should answer:

> "How does Team Time Track compare, and where should we deliberately match, improve, or differ?"

**Status: 🟡 Required before final commercial positioning; not a blocker for database/system design.**

---

# OQ-020 — Should the personas be validated?

I agree with the source's recommendation.

The current personas are useful **working assumptions**, but they are not evidence of actual customer behavior.

### Decision: **Yes, validate before UI/UX is finalized.**

The proposed:

> 5–8 interviews across Manager, Employee and Administrator roles

is a reasonable lightweight validation approach.

I would specifically try to cover:

```text
Manager
├── Team management
├── Time visibility
├── Productivity
└── Approvals

Employee
├── Tracking
├── Privacy concerns
├── Timesheets
└── Leave

Administrator
├── Organization setup
├── User management
├── Billing
└── Reporting
```

We should use these interviews to validate **problems and workflows**, not ask:

> "Would you use Team Time Track?"

Instead:

> "How do you currently track employee hours?"

> "What happens when someone forgets to start tracking?"

> "How do you approve time?"

> "How do you handle screenshots/privacy concerns?"

That produces much better evidence.

**Status: 🟡 Required before final UX decisions; not a blocker for backend/database design.**

---

# OQ-022 — Downgrade grace period

This one **should be explicitly resolved before billing implementation**.

The problem is significant:

```text
Premium
24-month retention
       ↓
Downgrade
       ↓
Basic
3-month retention
```

Without a grace period, potentially 21 months of historical data becomes eligible for deletion immediately.

### Decision: **30-day grace period + warning + export opportunity.**

I recommend this flow:

```text
Customer requests downgrade
          ↓
Calculate affected data
          ↓
Show warning
          ↓
Explain what will become
ineligible for retention
          ↓
Offer export
          ↓
Customer confirms downgrade
          ↓
30-day grace period
          ↓
Final warning
          ↓
Expired data becomes deletion-eligible
```

### During the grace period

The customer should still be able to access the data that would otherwise fall outside the new plan's retention window.

But we should clearly label it:

> **Scheduled for deletion**

### Important distinction

We should **not immediately delete anything merely because the subscription changed**.

Instead:

```text
subscription changed
       ↓
retention policy recalculated
       ↓
data marked eligible after grace period
       ↓
cleanup queue
```

This is much safer operationally.

### Database implication

Our retention system should eventually support:

```text
retention_policies
retention_exceptions / grace periods
deletion_eligible_at
```

We don't necessarily need a separate table for every one of these immediately, but the domain must represent the grace period.

**Status: ✅ Resolved — 30 days.**

---

# OQ-024 — Monitoring policy re-acknowledgement

This is an important privacy requirement.

The source already establishes that Members acknowledge a monitoring disclosure before first capture.

I recommend dividing configuration changes into **material** and **non-material** changes.

## Material changes → re-acknowledgement

For example:

```text
Enable screenshots
Enable video recording
Increase capture scope
Enable application monitoring
Enable website monitoring
Change monitoring from limited → broader
```

These should require the Member to acknowledge the updated disclosure.

## Non-material changes → no re-acknowledgement

For example:

```text
Screenshot interval:
15 min → 20 min

Report formatting
Dashboard configuration
```

Although there is one nuance:

If an interval becomes **more frequent**, I would classify that as material:

```text
15 min → 5 min
```

because the monitoring intensity increased.

---

## Recommended rule

```text
Monitoring intensity increases
        ↓
Re-acknowledgement required

Monitoring intensity stays same/decreases
        ↓
No re-acknowledgement
```

### Does tracking stop?

For a material change:

> **Yes.**

The new monitoring policy should not become active for that Member until the updated disclosure is acknowledged.

So:

```text
Organization changes policy
          ↓
Member has not acknowledged
          ↓
New capture disabled
          ↓
Member sees disclosure
          ↓
Acknowledges
          ↓
New policy active
```

This gives us a clean audit trail.

### Database implication

We should preserve:

```text
member
policy version
acknowledged_at
policy configuration/hash
```

rather than merely:

```text
monitoring_acknowledged = true
```

That allows us to prove which policy the Member acknowledged.

**Status: ✅ Resolved.**

---

# OQ-025 — Can an Organization opt out of vendor support access?

Your source describes support elevation as:

- audited
- time-bounded
- notified

The unresolved question is whether the customer can completely prohibit it.

### Decision: **Yes — provide an organization-level opt-out.**

I recommend:

```text
Organization Settings
        ↓
Vendor Support Access
        ↓
[ Allow / Disable ]
```

Default:

> **Allow**, with the existing audit/time-limit/notification protections.

Enterprise/security-conscious customers can choose:

> **Disable vendor support access**

---

## What happens when disabled?

Support staff cannot elevate into the organization's environment.

Instead, support receives something like:

```text
Vendor support access is disabled
for this organization.

Customer must temporarily enable
support access before privileged
diagnostic access can be granted.
```

The customer can then explicitly enable it when needed.

### Why I prefer this

It gives us two trust layers:

```text
Normal organization
        ↓
Support access available
        ↓
Time-limited
        ↓
Audited
        ↓
Customer notified
```

and:

```text
Security-sensitive organization
        ↓
Support access disabled
        ↓
No vendor elevation
```

That's a valuable enterprise control.

**Status: ✅ Resolved — customer opt-out supported.**

---

## One important consequence for our system design

These decisions introduce **three pieces we should add to the domain model**:

```text
Monitoring Policy
       │
       ├── Version
       ├── Configuration
       └── Member Acknowledgements


Subscription Downgrade
       │
       ├── Effective date
       ├── Grace period
       └── Data scheduled for deletion


Vendor Support Access
       │
       ├── Organization policy
       ├── Support elevation
       ├── Expiration
       ├── Audit log
       └── Notification
```

So I would **not start writing the final Laravel migrations yet**. We should first incorporate these three decisions into our domain model/ERD, because they affect the physical schema we just completed.

After that, the database design can be considered **version 1.0 frozen**, and we can move cleanly into the Laravel Eloquent/domain specification.

---

Everything else can largely be converted into concrete engineering requirements now.

And importantly, our **database design already accommodates most of these decisions**. The next step should therefore be to turn this decision set into a **finalized Domain Model + Eloquent Model specification**, rather than changing the physical database every time we discover a product ambiguity.