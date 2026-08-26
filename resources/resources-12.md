Let's continue with the **Timesheet → Approval → Payroll layer**.

This is where Team Time Track turns raw tracked time into **approved payable time**.

The core principle should be:

> **Payroll must never calculate directly from raw tracking events.**

The authoritative chain is:

```text
Tracking Events
      ↓
Time Entries
      ↓
Timesheet
      ↓
Manager Approval
      ↓
Approved Time
      ↓
Payroll Period
      ↓
Payroll Entry
```

---

# 33. `timesheets`

A timesheet represents an employee's submitted work period.

For example:

```text
Hasan
August 1–15
────────────────────
Worked:       76h 32m
Breaks:        5h 10m
Payable:      71h 22m
Status:       Submitted
```

Migration:

```php
Schema::create('timesheets', function (Blueprint $table) {
    $table->uuid('id')->primary();

    $table->foreignUuid('organization_id')
        ->constrained()
        ->restrictOnDelete();

    $table->foreignUuid('membership_id')
        ->constrained('organization_memberships')
        ->restrictOnDelete();

    $table->date('period_start');
    $table->date('period_end');

    $table->unsignedBigInteger('total_seconds')
        ->default(0);

    $table->string('status', 30)
        ->default('draft');

    $table->timestampTz('submitted_at')->nullable();
    $table->timestampTz('approved_at')->nullable();
    $table->timestampTz('rejected_at')->nullable();

    $table->timestampsTz();

    $table->unique([
        'organization_id',
        'membership_id',
        'period_start',
        'period_end',
    ]);

    $table->index([
        'organization_id',
        'status',
    ]);

    $table->index([
        'organization_id',
        'membership_id',
        'period_start',
    ]);
});
```

---

# 34. Timesheet status

We'll use a state machine rather than allowing arbitrary status changes.

Initial states:

```text
DRAFT
  │
  ▼
SUBMITTED
  │
  ├───────────────┐
  ▼               ▼
APPROVED        REJECTED
                    │
                    ▼
                 DRAFT
```

We can also support:

```text
CANCELLED
```

later if the product requirements require it.

The important rule is:

```text
APPROVED
   ↓
immutable for normal employee editing
```

If an approved timesheet needs modification, it should go through a controlled adjustment/reopening process.

---

# 35. `timesheet_entries`

A timesheet needs to know which time entries contributed to it.

```php
Schema::create('timesheet_entries', function (Blueprint $table) {
    $table->uuid('id')->primary();

    $table->foreignUuid('timesheet_id')
        ->constrained()
        ->cascadeOnDelete();

    $table->foreignUuid('time_entry_id')
        ->constrained()
        ->restrictOnDelete();

    $table->unsignedBigInteger('duration_seconds');

    $table->timestampsTz();

    $table->unique([
        'timesheet_id',
        'time_entry_id',
    ]);

    $table->index([
        'time_entry_id',
    ]);
});
```

This gives us:

```text
TIMESHEET
    │
    ├── TIME ENTRY #1
    ├── TIME ENTRY #2
    ├── TIME ENTRY #3
    └── TIME ENTRY #4
```

---

# 36. Why `duration_seconds` exists here

You might ask:

> Why store duration again when `time_entries` already has `duration_seconds`?

Because the timesheet is a **business snapshot**.

Suppose an employee's time entry was:

```text
10:00 → 12:00
= 2 hours
```

and that entry becomes part of a submitted/approved timesheet.

We don't want later modifications to the underlying tracking record to silently alter an already-submitted financial/business record.

So:

```text
time_entries.duration_seconds
        ↓
timesheet_entries.duration_seconds
        ↓
approved timesheet
        ↓
payroll
```

This gives us a clean audit trail.

---

# 37. `timesheet_approvals`

We need a history of approval actions rather than merely storing:

```text
timesheets.approved_at
```

Migration:

```php
Schema::create('timesheet_approvals', function (Blueprint $table) {
    $table->uuid('id')->primary();

    $table->foreignUuid('timesheet_id')
        ->constrained()
        ->cascadeOnDelete();

    $table->foreignUuid('reviewer_membership_id')
        ->constrained('organization_memberships')
        ->restrictOnDelete();

    $table->string('action', 30);

    $table->text('comment')->nullable();

    $table->timestampTz('created_at');

    $table->index([
        'timesheet_id',
        'created_at',
    ]);

    $table->index([
        'reviewer_membership_id',
        'created_at',
    ]);
});
```

Example history:

```text
Aug 15 09:10
Hasan submitted timesheet

Aug 15 14:30
Manager reviewed

Aug 15 14:31
Manager approved
```

If it gets rejected:

```text
Aug 15 14:31
Manager rejected
Reason:
"Please correct Tuesday's hours."
```

---

# 38. Why approval history matters

We should **never overwrite approval history**.

This:

```text
timesheets.status = approved
```

tells us the current state.

This:

```text
timesheet_approvals
```

tells us **how we got there**.

That becomes extremely valuable for:

- payroll disputes
- audit
- manager accountability
- employee disputes
- compliance
- debugging

---

# 39. Important authorization rule

The employee should not approve their own timesheet unless the organization explicitly allows it.

The authorization flow should be:

```text
Employee
   ↓
SUBMIT
   ↓
Manager/Admin
   ↓
APPROVE
```

Laravel authorization should verify the **membership's organization and permissions**.

Not merely:

```php
$user->isManager()
```

but effectively:

```text
membership
    ↓
organization
    ↓
permission
    ↓
timesheet
```

---

# 40. `pay_rates`

Now we establish employee compensation.

```php
Schema::create('pay_rates', function (Blueprint $table) {
    $table->uuid('id')->primary();

    $table->foreignUuid('organization_id')
        ->constrained()
        ->restrictOnDelete();

    $table->foreignUuid('membership_id')
        ->constrained('organization_memberships')
        ->restrictOnDelete();

    $table->decimal('rate', 12, 2);

    $table->char('currency', 3);

    $table->date('effective_from');
    $table->date('effective_until')->nullable();

    $table->timestampsTz();

    $table->index([
        'organization_id',
        'membership_id',
        'effective_from',
    ]);
});
```

---

# 41. Why pay rates need effective dates

Suppose:

```text
Hasan
Jan 1 → Jun 30
$20/hour

Hasan
Jul 1 →
$25/hour
```

We must preserve both rates.

We cannot simply update:

```text
rate = 25
```

because historical payroll would become incorrect.

Therefore:

```text
pay_rates
────────────────────────
Jan 1 – Jun 30 → $20
Jul 1 –         → $25
```

When processing payroll, we select the rate applicable to the payroll period/time.

---

# 42. Currency belongs to the rate

Don't assume the organization currency is always the employee's compensation currency.

For example:

```text
Organization currency: USD

Employee A: USD
Employee B: EUR
```

Therefore:

```text
pay_rates.currency
```

must be explicit.

---

# 43. `payroll_periods`

A payroll period is an organization's processing window.

```php
Schema::create('payroll_periods', function (Blueprint $table) {
    $table->uuid('id')->primary();

    $table->foreignUuid('organization_id')
        ->constrained()
        ->restrictOnDelete();

    $table->date('period_start');
    $table->date('period_end');

    $table->string('status', 30)
        ->default('draft');

    $table->timestampTz('processed_at')->nullable();

    $table->timestampsTz();

    $table->unique([
        'organization_id',
        'period_start',
        'period_end',
    ]);

    $table->index([
        'organization_id',
        'status',
    ]);
});
```

---

# 44. Payroll lifecycle

We'll use:

```text
DRAFT
  ↓
OPEN
  ↓
CALCULATING
  ↓
CALCULATED
  ↓
APPROVED
  ↓
PROCESSED
```

Potential failure state:

```text
CALCULATING
     ↓
   FAILED
```

A failed payroll should be retryable.

---

# 45. `payroll_entries`

This is the financial snapshot for each employee.

```php
Schema::create('payroll_entries', function (Blueprint $table) {
    $table->uuid('id')->primary();

    $table->foreignUuid('payroll_period_id')
        ->constrained()
        ->restrictOnDelete();

    $table->foreignUuid('membership_id')
        ->constrained('organization_memberships')
        ->restrictOnDelete();

    $table->unsignedBigInteger('approved_seconds');

    $table->decimal('hourly_rate', 12, 2);

    $table->decimal('gross_amount', 12, 2)
        ->default(0);

    $table->decimal('adjustments', 12, 2)
        ->default(0);

    $table->decimal('net_amount', 12, 2)
        ->default(0);

    $table->char('currency', 3);

    $table->timestampsTz();

    $table->unique([
        'payroll_period_id',
        'membership_id',
    ]);

    $table->index([
        'membership_id',
        'created_at',
    ]);
});
```

---

# 46. The crucial payroll rule

Payroll should use:

```text
APPROVED TIMESHEET
```

—not:

```text
TRACKING SESSION
```

and not:

```text
TRACKING EVENT
```

So the calculation pipeline is:

```text
Tracking Events
       ↓
Time Entries
       ↓
Timesheet
       ↓
Manager Approval
       ↓
Approved Seconds
       ↓
Pay Rate
       ↓
Payroll Entry
```

For example:

```text
Approved time:
71h 22m

Rate:
$25/hour

Gross:
$1,784.17
```

The resulting `payroll_entries` row becomes a financial snapshot.

---

# 47. Payroll should snapshot the rate

Suppose Hasan's rate is:

```text
$20/hour
```

and payroll is processed.

The payroll entry stores:

```text
hourly_rate = 20
```

Then next month the organization changes his rate to:

```text
$25/hour
```

The previous payroll remains:

```text
$20/hour
```

This is exactly what we want.

---

# 48. Payroll adjustments

We currently have:

```text
adjustments
```

as a monetary amount.

For MVP, this can represent:

```text
bonus
deduction
manual adjustment
```

However, I recommend we **do not leave this as an unexplained number forever**.

Before implementing a sophisticated payroll system, we should eventually introduce something like:

```text
payroll_adjustments
```

with:

```text
type
description
amount
reason
created_by
```

That gives us a proper audit trail.

For MVP, the simpler `adjustments` field can be acceptable, but I would mark the richer model as a future enhancement.

---

# 49. Timesheet vs Payroll

This distinction is important:

### Timesheet

Answers:

> **How much time did this employee work, and was it approved?**

### Payroll

Answers:

> **How much money should this employee receive based on approved time and compensation rules?**

Therefore:

```text
Timesheet
    =
Time/business record

Payroll
    =
Financial record
```

They should remain separate domains.

---

# 50. Complete Timesheet/Payroll ERD

```text
                    TIME_ENTRIES
                         │
                         │ N:M
                         ▼
                 TIMESHEET_ENTRIES
                         │
                         │ N:1
                         ▼
                     TIMESHEETS
                         │
                         │ 1:N
                         ▼
                TIMESHEET_APPROVALS
                         │
                         │
                         ▼
                  APPROVED TIME
                         │
                         ▼
                 PAYROLL_PERIODS
                         │
                         │ 1:N
                         ▼
                 PAYROLL_ENTRIES
                         ▲
                         │
                         │
                     PAY_RATES
```

More precisely:

```text
ORGANIZATION
     │
     ├────────── PAYROLL_PERIOD
     │                 │
     │                 └──< PAYROLL_ENTRY >── MEMBERSHIP
     │
     └── MEMBERSHIP
             │
             ├── PAY_RATE
             │
             └── TIMESHEET
                    │
                    ├──< TIMESHEET_ENTRY >── TIME_ENTRY
                    │
                    └──< TIMESHEET_APPROVAL
```

---

# 51. Current migration status

We now have:

```text
01  Users                         ✅
02  Organizations                 ✅
03  Organization Memberships     ✅
04  Permissions                   ✅
05  Roles                         ✅
06  Membership Roles              ✅
07  Role Permissions              ✅
08  Organization Invitations      ✅
09  Organization Settings         ✅

10  Teams                         ✅
11  Team Members                  ✅
12  Projects                      ✅
13  Project Members               ✅
14  Tasks                         ✅
15  Task Assignees                ✅

16  Devices                       ✅
17  Tracking Sessions             ✅
18  Tracking Events               ✅
19  Time Entries                  ✅
20  Idle Periods                  ✅

21  Activity Events               ✅
22  Application Usage             ✅
23  Website Usage                 ✅
24  Productivity Rules            ✅
25  Screenshots                   ✅
26  Recordings                    ✅
27  Recording Segments            ✅

28  Schedules                     ✅
29  Schedule Shifts               ✅
30  Membership Schedules          ✅
31  Attendance                    ✅
32  Breaks                        ✅
33  Leave Types                   ✅
34  Leave Requests                ✅

35  Timesheets                    ✅
36  Timesheet Entries             ✅
37  Timesheet Approvals           ✅
38  Pay Rates                     ✅
39  Payroll Periods               ✅
40  Payroll Entries               ✅

41  Plans                         ← NEXT
42  Features
43  Plan Features
44  Subscriptions

45  Office Locations
46  Office Networks
47  Connectivity Events

48  Notifications
49  Notification Preferences
50  Audit Logs
51  Retention Policies
```

One refinement from the earlier count: **`team_members` and `idle_periods` are now explicitly counted**, bringing the current design to **51 tables**.

---

## Next: SaaS Billing & Entitlements

The next layer is particularly important because the application is a SaaS product.

We'll design:

```text
PLANS
   │
   └──< PLAN_FEATURES >── FEATURES
                              │
                              ▼
                       ENTITLEMENT LOGIC
                              ▲
                              │
ORGANIZATION ────────> SUBSCRIPTION
```

This is where we'll make **Basic / Standard / Premium** enforceable by the backend rather than scattering plan checks throughout Laravel and Next.js. The feature matrix in the product document will be the basis for the feature definitions. 