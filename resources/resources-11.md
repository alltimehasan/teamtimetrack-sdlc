Let's continue with the **workforce-management layer**: schedules, shifts, attendance, breaks, and leave.

This layer sits between raw time tracking and timesheets/payroll:

```text
Desktop Tracking
       ↓
Tracking Sessions
       ↓
Time Entries
       │
       ├───────────────┐
       ↓               ↓
Attendance        Timesheets
       ↑               ↓
Schedules          Approval
       ↑               ↓
   Shifts          Payroll
```

# 26. `schedules`

A schedule defines the expected working pattern for an organization or employee.

```php
Schema::create('schedules', function (Blueprint $table) {
    $table->uuid('id')->primary();

    $table->foreignUuid('organization_id')
        ->constrained()
        ->restrictOnDelete();

    $table->string('name', 150);

    $table->string('timezone', 100);

    $table->string('status', 30)
        ->default('active');

    $table->timestampsTz();

    $table->softDeletesTz();

    $table->index([
        'organization_id',
        'status',
    ]);
});
```

Examples:

```text
Standard 9–5
Night Shift
Part Time
US Eastern Team
Bangladesh Team
```

---

# 27. `schedule_shifts`

A schedule itself doesn't contain individual working hours. Those belong to its shifts.

For example:

```text
Standard 9–5

Monday    09:00 → 17:00
Tuesday   09:00 → 17:00
Wednesday 09:00 → 17:00
Thursday  09:00 → 17:00
Friday    09:00 → 17:00
Saturday  OFF
Sunday    OFF
```

Migration:

```php
Schema::create('schedule_shifts', function (Blueprint $table) {
    $table->uuid('id')->primary();

    $table->foreignUuid('schedule_id')
        ->constrained()
        ->cascadeOnDelete();

    $table->unsignedSmallInteger('day_of_week');

    $table->time('start_time');
    $table->time('end_time');

    $table->unsignedBigInteger('break_duration_seconds')
        ->default(0);

    $table->unsignedBigInteger('minimum_work_seconds')
        ->default(0);

    $table->timestampsTz();

    $table->unique([
        'schedule_id',
        'day_of_week',
    ]);
});
```

### Important design decision

`day_of_week` should use a documented convention.

For example:

```text
0 = Sunday
1 = Monday
...
6 = Saturday
```

We'll use the same convention throughout Laravel.

---

# 28. Overnight shifts

We need to support shifts such as:

```text
22:00 → 06:00
```

So we **must not assume**:

```text
end_time > start_time
```

An overnight shift is valid.

For example:

```text
Monday
22:00 → 06:00 Tuesday
```

The schedule calculation service determines that this crosses midnight.

This is an important reason not to store a simplistic `working_hours = 8` field.

---

# 29. `membership_schedules`

Now we assign schedules to employees.

```text
Organization
     │
     ├── Schedule A
     │
     ├── Schedule B
     │
     └── Schedule C

Membership
     │
     └── assigned Schedule
```

Migration:

```php
Schema::create('membership_schedules', function (Blueprint $table) {
    $table->uuid('id')->primary();

    $table->foreignUuid('membership_id')
        ->constrained('organization_memberships')
        ->restrictOnDelete();

    $table->foreignUuid('schedule_id')
        ->constrained()
        ->restrictOnDelete();

    $table->date('effective_from');
    $table->date('effective_until')->nullable();

    $table->timestampsTz();

    $table->index([
        'membership_id',
        'effective_from',
    ]);
});
```

This lets us change an employee's schedule without rewriting history.

Example:

```text
Hasan
──────────────────────────────
Jan 1 → Jun 30     Standard 9–5
Jul 1 →            Flexible
```

Historical attendance remains associated with the schedule that was effective at that time.

---

# 30. Attendance

Now we calculate what actually happened.

```text
Schedule
    ↓
Expected work

Tracking Sessions
    ↓
Actual work

Expected vs Actual
        ↓
Attendance
```

Migration:

```php
Schema::create('attendance_records', function (Blueprint $table) {
    $table->uuid('id')->primary();

    $table->foreignUuid('organization_id')
        ->constrained()
        ->restrictOnDelete();

    $table->foreignUuid('membership_id')
        ->constrained('organization_memberships')
        ->restrictOnDelete();

    $table->date('date');

    $table->timestampTz('first_activity_at')
        ->nullable();

    $table->timestampTz('last_activity_at')
        ->nullable();

    $table->unsignedBigInteger('scheduled_seconds')
        ->default(0);

    $table->unsignedBigInteger('worked_seconds')
        ->default(0);

    $table->string('status', 30)
        ->default('absent');

    $table->unsignedBigInteger('late_seconds')
        ->default(0);

    $table->unsignedBigInteger('early_leave_seconds')
        ->default(0);

    $table->timestampsTz();

    $table->unique([
        'organization_id',
        'membership_id',
        'date',
    ]);

    $table->index([
        'organization_id',
        'date',
    ]);

    $table->index([
        'organization_id',
        'membership_id',
        'date',
    ]);
});
```

The unique constraint is important:

```text
One employee
+
One organization
+
One calendar date
=
One attendance record
```

---

# 31. Attendance is an aggregate

An important architectural distinction:

`attendance_records` should **not** be treated as the raw source of work activity.

Instead:

```text
Tracking Events
       ↓
Time Entries
       ↓
Attendance calculation
       ↓
Attendance Record
```

For example:

```text
Scheduled:
08:00:00

Worked:
07:32:15

Late:
00:12:00

Early leave:
00:15:45
```

The attendance record is therefore a **derived business record**.

---

# 32. Attendance statuses

We'll initially support something along these lines:

```text
present
late
absent
half_day
on_leave
holiday
rest_day
```

The exact status vocabulary should become a PHP enum and database constraint when we finalize the domain rules.

---

# 33. `breaks`

Breaks belong to an employee's tracking session.

```php
Schema::create('breaks', function (Blueprint $table) {
    $table->uuid('id')->primary();

    $table->foreignUuid('organization_id')
        ->constrained()
        ->restrictOnDelete();

    $table->foreignUuid('membership_id')
        ->constrained('organization_memberships')
        ->restrictOnDelete();

    $table->foreignUuid('tracking_session_id')
        ->constrained('tracking_sessions')
        ->restrictOnDelete();

    $table->timestampTz('started_at');
    $table->timestampTz('ended_at')->nullable();

    $table->unsignedBigInteger('duration_seconds')
        ->default(0);

    $table->string('break_type', 30);

    $table->string('source', 30)
        ->default('desktop');

    $table->timestampsTz();

    $table->index([
        'organization_id',
        'membership_id',
        'started_at',
    ]);

    $table->index([
        'tracking_session_id',
        'started_at',
    ]);
});
```

---

# 34. Why breaks are separate from idle periods

This distinction is important.

### Idle period

The employee is technically tracking time, but the computer detects inactivity.

```text
Tracking ON
    ↓
No mouse/keyboard
    ↓
Idle period
```

### Break

The employee explicitly stops working or starts a break.

```text
Working
   ↓
Break
   ↓
Working
```

Therefore:

```text
idle_periods ≠ breaks
```

We should preserve that distinction in the database.

---

# 35. Leave Types

Now we model planned absence.

```php
Schema::create('leave_types', function (Blueprint $table) {
    $table->uuid('id')->primary();

    $table->foreignUuid('organization_id')
        ->constrained()
        ->restrictOnDelete();

    $table->string('name', 100);

    $table->text('description')->nullable();

    $table->boolean('is_paid')
        ->default(true);

    $table->boolean('requires_approval')
        ->default(true);

    $table->timestampsTz();

    $table->index([
        'organization_id',
    ]);
});
```

Examples:

```text
Vacation
Sick Leave
Personal Leave
Unpaid Leave
Maternity Leave
```

The actual available leave types should be configurable by each organization.

---

# 36. Leave Requests

```php
Schema::create('leave_requests', function (Blueprint $table) {
    $table->uuid('id')->primary();

    $table->foreignUuid('organization_id')
        ->constrained()
        ->restrictOnDelete();

    $table->foreignUuid('membership_id')
        ->constrained('organization_memberships')
        ->restrictOnDelete();

    $table->foreignUuid('leave_type_id')
        ->constrained()
        ->restrictOnDelete();

    $table->foreignUuid('reviewed_by')
        ->nullable()
        ->constrained('organization_memberships')
        ->restrictOnDelete();

    $table->timestampTz('starts_at');
    $table->timestampTz('ends_at');

    $table->text('reason')->nullable();

    $table->string('status', 30)
        ->default('pending');

    $table->timestampTz('reviewed_at')
        ->nullable();

    $table->timestampsTz();

    $table->index([
        'organization_id',
        'membership_id',
        'starts_at',
    ]);

    $table->index([
        'organization_id',
        'status',
    ]);
});
```

---

# 37. Why `reviewed_by` is a membership

Notice:

```php
reviewed_by
    → organization_memberships.id
```

rather than:

```text
reviewed_by → users.id
```

This is intentional.

Suppose Hasan belongs to:

```text
Company A → Employee
Company B → Manager
```

He can approve a leave request for Company B because his **Company B membership** has the appropriate permissions.

The authorization context remains tenant-specific.

---

# 38. Leave lifecycle

A request follows:

```text
PENDING
   │
   ├──── APPROVED
   │
   └──── REJECTED
```

We should also consider:

```text
CANCELLED
```

for an employee cancelling a previously submitted request.

---

# 39. How Leave interacts with Attendance

This is an important business rule.

Suppose:

```text
Hasan
Monday
Approved Vacation
```

The system should not produce:

```text
Attendance:
ABSENT
```

Instead:

```text
Attendance:
ON_LEAVE
```

The calculation becomes:

```text
Schedule
   +
Approved Leave
   +
Tracking
        ↓
Attendance
```

---

# 40. Workforce data flow

We now have the complete workforce chain:

```text
                  SCHEDULE
                     │
                     ▼
              SCHEDULE SHIFT
                     │
                     ▼
            MEMBERSHIP SCHEDULE
                     │
                     ▼
              EXPECTED HOURS
                     │
                     │
                     ▼
TRACKING ────────> ATTENDANCE
   │
   ├── Time Entries
   │
   └── Breaks

LEAVE REQUEST
     │
     ▼
APPROVED LEAVE
     │
     └──────────────> ATTENDANCE
```

This is much more robust than simply storing "hours worked" against an employee.

---

# 41. Current migration sequence

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
11  Projects                      ✅
12  Project Members               ✅
13  Tasks                         ✅
14  Task Assignees                ✅
15  Devices                       ✅
16  Tracking Sessions             ✅
17  Tracking Events               ✅
18  Time Entries                  ✅

19  Activity Events               ✅
20  Application Usage             ✅
21  Website Usage                 ✅
22  Productivity Rules            ✅
23  Screenshots                   ✅
24  Recordings                    ✅
25  Recording Segments            ✅

26  Schedules                     ✅
27  Schedule Shifts               ✅
28  Membership Schedules          ✅
29  Attendance                    ✅
30  Breaks                        ✅
31  Leave Types                   ✅
32  Leave Requests                ✅

33  Timesheets                    ← NEXT
34  Timesheet Entries
35  Timesheet Approvals
36  Pay Rates
37  Payroll Periods
38  Payroll Entries

39  Plans
40  Features
41  Plan Features
42  Subscriptions

43  Office Locations
44  Office Networks
45  Connectivity Events

46  Notifications
47  Notification Preferences
48  Audit Logs
49  Retention Policies
```

### The next layer is particularly important:

```text
Time Entries
      ↓
Timesheet
      ↓
Employee submits
      ↓
Manager approves/rejects
      ↓
Approved hours
      ↓
Payroll
```

So the next step is **Timesheets → Approvals → Pay Rates → Payroll**, where we'll establish exactly what constitutes *approved payable time* and prevent payroll from accidentally using unapproved tracking data.