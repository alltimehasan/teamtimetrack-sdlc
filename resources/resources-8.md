Yes. The next step is the **Physical PostgreSQL Schema Specification**.

We now move from:

> **What entities exist and how do they relate?**

to:

> **Exactly how will PostgreSQL store them?**

For Team Time Track, I recommend we establish these rules first.

---

# Team Time Track — Physical Database Design

## 1. PostgreSQL as the source of truth

Production database:

```text
PostgreSQL
```

PostgreSQL is authoritative for:

- Users
- Organizations
- Memberships
- Projects
- Tasks
- Tracking sessions
- Time entries
- Attendance
- Timesheets
- Payroll
- Subscriptions
- Permissions
- Audit records
- Screenshot/recording metadata

Redis is **not** a source of truth.

R2 is **not** a relational database.

---

# 2. Primary Key Strategy

I recommend **UUIDv7** for primary keys.

Instead of:

```sql
id BIGSERIAL
```

we use:

```text
id UUID
```

with UUIDv7 generation.

### Why UUIDv7?

It gives us:

- Globally unique IDs
- Better database index locality than random UUIDv4
- IDs that contain a time-ordered component
- Safer distributed/offline client workflows
- No sequential tenant-wide IDs exposed through APIs

This is particularly useful for Team Time Track because Electron can generate identifiers while offline.

### Important distinction

We should have two kinds of IDs:

```text
id
```

for the database entity, and:

```text
client_event_id
```

for synchronization idempotency.

For example:

```text
tracking_events
├── id                 UUID
└── client_event_id    UUID
```

---

# 3. Timestamp Strategy

All timestamps should be stored as:

```sql
TIMESTAMPTZ
```

and interpreted as UTC.

For example:

```text
started_at TIMESTAMPTZ
ended_at   TIMESTAMPTZ
```

Do **not** use:

```sql
TIMESTAMP
```

for events that represent an actual moment in time.

### Example

Employee in Bangladesh:

```text
2026-08-25 21:00 Asia/Dhaka
```

gets stored as the corresponding UTC instant.

The organization/user timezone is used only for presentation and calendar calculations.

---

# 4. Duration Strategy

Never use:

```text
FLOAT
DOUBLE
```

for tracked hours.

Use:

```sql
BIGINT
```

containing seconds.

Example:

```text
7 hours 30 minutes
```

becomes:

```text
27000
```

So:

```sql
duration_seconds BIGINT NOT NULL
```

This prevents floating-point problems in payroll and reporting.

---

# 5. Money Strategy

For payroll and subscriptions, don't use floating-point numbers.

For example:

```text
hourly_rate
gross_amount
net_amount
price
```

should use:

```sql
NUMERIC(12,2)
```

or a minor-unit integer strategy.

For the first version, I'd use:

```sql
NUMERIC(12,2)
```

because it is straightforward for payroll calculations.

---

# 6. Status Strategy

I don't recommend creating PostgreSQL `ENUM` types for every status.

Instead, use:

```text
VARCHAR
```

with application-level enums and PostgreSQL `CHECK` constraints where the state is critical.

For example:

```sql
status VARCHAR(20) NOT NULL
CHECK (status IN ('active', 'paused', 'stopped'))
```

This gives Laravel a clean PHP enum while keeping the database protected.

---

# 7. `users`

```text
users
────────────────────────────────────
id                  UUID PK
name                VARCHAR(150)
email               VARCHAR(255) UNIQUE
password            VARCHAR(255)
email_verified_at   TIMESTAMPTZ NULL
avatar              VARCHAR(500) NULL
status              VARCHAR(30)
last_login_at       TIMESTAMPTZ NULL
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
deleted_at          TIMESTAMPTZ NULL
```

Constraints:

```text
email UNIQUE
status ∈ active, suspended, deactivated
```

---

# 8. `organizations`

```text
organizations
────────────────────────────────────
id                  UUID PK
name                VARCHAR(200)
slug                VARCHAR(150) UNIQUE
logo_path           VARCHAR(500) NULL
timezone            VARCHAR(100)
country             CHAR(2)
currency            CHAR(3)
date_format         VARCHAR(30)
time_format         VARCHAR(10)
week_starts_on      SMALLINT
status              VARCHAR(30)
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
deleted_at          TIMESTAMPTZ NULL
```

Example:

```text
timezone = America/New_York
country  = US
currency = USD
```

---

# 9. `organization_memberships`

```text
organization_memberships
────────────────────────────────────
id                  UUID PK
organization_id     UUID FK
user_id             UUID FK
status              VARCHAR(30)
invited_at          TIMESTAMPTZ NULL
joined_at           TIMESTAMPTZ NULL
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
deleted_at          TIMESTAMPTZ NULL
```

Critical constraint:

```text
UNIQUE(organization_id, user_id)
```

Foreign keys:

```text
organization_id
    → organizations.id

user_id
    → users.id
```

Delete behavior:

```text
organizations → RESTRICT
users         → RESTRICT
```

We don't want deleting a company accidentally deleting its historical employee records.

---

# 10. Roles

```text
roles
────────────────────────────────────
id                  UUID PK
organization_id     UUID FK NULL
name                VARCHAR(100)
slug                VARCHAR(100)
description         TEXT NULL
is_system           BOOLEAN
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

`organization_id` can be NULL for global/system roles if we decide to support them.

Unique:

```text
UNIQUE(organization_id, slug)
```

---

# 11. Permissions

```text
permissions
────────────────────────────────────
id                  UUID PK
name                VARCHAR(150)
slug                VARCHAR(150) UNIQUE
description         TEXT NULL
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

Examples:

```text
users.view
users.manage
projects.view
projects.manage
tracking.view
tracking.manage
screenshots.view
reports.view
payroll.manage
billing.manage
```

---

# 12. Many-to-Many Tables

For relationship tables, I recommend **composite primary keys** rather than unnecessary UUIDs.

### `membership_roles`

```text
membership_roles
────────────────────────────
membership_id UUID FK
role_id       UUID FK

PRIMARY KEY (membership_id, role_id)
```

### `role_permissions`

```text
role_permissions
────────────────────────────
role_id       UUID FK
permission_id UUID FK

PRIMARY KEY (role_id, permission_id)
```

### `team_members`

```text
team_members
────────────────────────────
team_id       UUID FK
membership_id UUID FK

PRIMARY KEY (team_id, membership_id)
```

Same principle for:

```text
project_members
task_assignees
```

---

# 13. `teams`

```text
teams
────────────────────────────────────
id                  UUID PK
organization_id     UUID FK
name                VARCHAR(150)
description         TEXT NULL
status              VARCHAR(30)
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
deleted_at          TIMESTAMPTZ NULL
```

Constraint:

```text
UNIQUE(organization_id, name)
```

---

# 14. `projects`

```text
projects
────────────────────────────────────
id                  UUID PK
organization_id     UUID FK
created_by          UUID FK
name                VARCHAR(200)
description         TEXT NULL
status              VARCHAR(30)
color               VARCHAR(20) NULL
start_date          DATE NULL
end_date            DATE NULL
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
deleted_at          TIMESTAMPTZ NULL
```

Indexes:

```text
INDEX(organization_id, status)
INDEX(organization_id, created_at)
```

---

# 15. `tasks`

```text
tasks
────────────────────────────────────
id                  UUID PK
organization_id     UUID FK
project_id          UUID FK
created_by          UUID FK
name                VARCHAR(200)
description         TEXT NULL
status              VARCHAR(30)
priority            VARCHAR(20)
due_at              TIMESTAMPTZ NULL
completed_at        TIMESTAMPTZ NULL
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
deleted_at          TIMESTAMPTZ NULL
```

Indexes:

```text
INDEX(project_id, status)
INDEX(organization_id, status)
```

---

# 16. `devices`

```text
devices
────────────────────────────────────
id                  UUID PK
organization_id     UUID FK
membership_id       UUID FK
device_uuid         UUID UNIQUE
name                VARCHAR(150)
platform            VARCHAR(30)
platform_version    VARCHAR(100)
app_version         VARCHAR(50)
last_seen_at        TIMESTAMPTZ NULL
status              VARCHAR(30)
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

Important:

A physical computer can have one Team Time Track installation identity.

---

# 17. `tracking_sessions`

```text
tracking_sessions
────────────────────────────────────
id                  UUID PK
organization_id     UUID FK
membership_id       UUID FK
device_id           UUID FK
project_id          UUID FK NULL
task_id             UUID FK NULL
started_at          TIMESTAMPTZ
ended_at            TIMESTAMPTZ NULL
status              VARCHAR(20)
source              VARCHAR(20)
timezone            VARCHAR(100)
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

Critical indexes:

```text
INDEX(organization_id, membership_id, started_at)
INDEX(organization_id, started_at)
INDEX(device_id, started_at)
```

---

# 18. `tracking_events`

This will probably become one of our highest-volume tables.

```text
tracking_events
────────────────────────────────────
id                  UUID PK
organization_id     UUID FK
membership_id       UUID FK
session_id          UUID FK
device_id           UUID FK
client_event_id     UUID
event_type          VARCHAR(40)
occurred_at         TIMESTAMPTZ
received_at         TIMESTAMPTZ
payload             JSONB
created_at          TIMESTAMPTZ
```

Critical:

```text
UNIQUE(organization_id, client_event_id)
```

Indexes:

```text
INDEX(organization_id, membership_id, occurred_at)
INDEX(session_id, occurred_at)
INDEX(device_id, occurred_at)
```

This table should be **partition-ready by time**.

---

# 19. `time_entries`

```text
time_entries
────────────────────────────────────
id                  UUID PK
organization_id     UUID FK
membership_id       UUID FK
tracking_session_id UUID FK NULL
project_id          UUID FK NULL
task_id             UUID FK NULL
created_by          UUID FK
started_at          TIMESTAMPTZ
ended_at            TIMESTAMPTZ
duration_seconds    BIGINT
entry_type          VARCHAR(30)
source              VARCHAR(30)
status              VARCHAR(30)
reason              TEXT NULL
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

Constraint:

```text
duration_seconds >= 0
ended_at >= started_at
```

Indexes:

```text
INDEX(organization_id, membership_id, started_at)
INDEX(organization_id, project_id, started_at)
INDEX(organization_id, task_id, started_at)
```

---

# 20. Monitoring Tables

The same physical strategy applies to:

```text
activity_events
application_usage
website_usage
```

Each should have:

```text
id
organization_id
membership_id
tracking_session_id
started_at
ended_at
...
created_at
```

and indexes around:

```text
organization_id
membership_id
tracking_session_id
started_at
```

These are also **high-volume, time-oriented tables**.

---

# 21. `screenshots`

```text
screenshots
────────────────────────────────────
id                  UUID PK
organization_id     UUID FK
membership_id       UUID FK
tracking_session_id UUID FK
project_id          UUID FK NULL
task_id             UUID FK NULL
captured_at         TIMESTAMPTZ
storage_key         VARCHAR(1000)
mime_type           VARCHAR(100)
file_size           BIGINT
width               INTEGER
height              INTEGER
status              VARCHAR(30)
created_at          TIMESTAMPTZ
```

Index:

```text
INDEX(organization_id, membership_id, captured_at)
```

The actual image stays in R2.

---

# 22. `recordings`

```text
recordings
────────────────────────────────────
id                  UUID PK
organization_id     UUID FK
membership_id       UUID FK
tracking_session_id UUID FK
started_at          TIMESTAMPTZ
ended_at            TIMESTAMPTZ NULL
duration_seconds    BIGINT
status              VARCHAR(30)
total_size          BIGINT
resolution          VARCHAR(30)
frame_rate          SMALLINT
codec               VARCHAR(30)
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

### `recording_segments`

```text
recording_segments
────────────────────────────────────
id                  UUID PK
recording_id        UUID FK
sequence            INTEGER
storage_key         VARCHAR(1000)
duration_seconds    BIGINT
file_size           BIGINT
checksum            VARCHAR(128)
status              VARCHAR(30)
created_at          TIMESTAMPTZ
```

Constraint:

```text
UNIQUE(recording_id, sequence)
```

---

# 23. Attendance

```text
attendance_records
────────────────────────────────────
id                  UUID PK
organization_id     UUID FK
membership_id       UUID FK
date                DATE
first_activity_at   TIMESTAMPTZ NULL
last_activity_at    TIMESTAMPTZ NULL
scheduled_seconds   BIGINT
worked_seconds      BIGINT
status              VARCHAR(30)
late_seconds        BIGINT
early_leave_seconds BIGINT
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

Critical:

```text
UNIQUE(organization_id, membership_id, date)
```

---

# 24. Timesheets

```text
timesheets
────────────────────────────────────
id                  UUID PK
organization_id     UUID FK
membership_id       UUID FK
period_start        DATE
period_end          DATE
total_seconds       BIGINT
status              VARCHAR(30)
submitted_at        TIMESTAMPTZ NULL
approved_at         TIMESTAMPTZ NULL
rejected_at         TIMESTAMPTZ NULL
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

Constraint:

```text
period_end >= period_start
```

Potential unique constraint:

```text
UNIQUE(organization_id, membership_id, period_start, period_end)
```

---

# 25. Payroll

```text
pay_rates
payroll_periods
payroll_entries
```

Use:

```text
NUMERIC(12,2)
```

for rates and monetary amounts.

Do **not** calculate payroll from raw tracking events.

The authoritative chain is:

```text
Tracking
    ↓
Time Entries
    ↓
Timesheet
    ↓
Approval
    ↓
Payroll
```

---

# 26. Subscription Entitlements

The important physical relationship is:

```text
organizations
      │
      ▼
subscriptions
      │
      ▼
plans
      │
      ▼
plan_features
      │
      ▼
features
```

This lets us check:

```text
organization.hasFeature('video_recording')
```

instead of hard-coding:

```php
if ($plan === 'premium')
```

That is a significant architectural decision for Team Time Track.

---

# 27. Foreign-Key Delete Strategy

This needs to be deliberate.

### Historical/business records

Prefer:

```text
ON DELETE RESTRICT
```

Examples:

```text
organization
membership
project
time entry
timesheet
payroll
```

### Pure relationship tables

Use:

```text
ON DELETE CASCADE
```

Examples:

```text
team_members
project_members
task_assignees
membership_roles
role_permissions
```

So deleting a team membership relationship doesn't leave orphaned rows.

### Example

```text
organization_membership
        │
        ├── time_entries
        ├── timesheets
        ├── payroll_entries
        └── attendance
```

We should **not** cascade-delete those historical records when a membership is removed.

Instead, deactivate/soft-delete the membership.

---

# 28. Tenant Isolation Rule

Every tenant-owned table should satisfy:

```text
organization_id → organizations.id
```

This includes:

```text
projects
tasks
devices
tracking_sessions
tracking_events
time_entries
screenshots
recordings
attendance
timesheets
payroll
notifications
audit_logs
```

This makes the organization boundary explicit.

---

# 29. Composite Index Philosophy

We should generally start indexes with:

```text
organization_id
```

because most queries will be tenant-scoped.

For example:

```text
INDEX(organization_id, membership_id, started_at)
```

rather than simply:

```text
INDEX(started_at)
```

This is particularly important for a multi-tenant SaaS.

---

# 30. High-Volume Tables

These deserve special treatment:

```text
tracking_events
activity_events
application_usage
website_usage
screenshots
connectivity_events
audit_logs
```

We should make them **partition-ready**.

Initially, we don't necessarily partition them.

But the schema and indexes should allow us to introduce monthly partitions later without redesigning the application.

---

# 31. The resulting physical architecture

At this point the data architecture becomes:

```text
                    PostgreSQL
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
     Identity        Workforce         SaaS/Billing
        │                │                │
        ▼                ▼                ▼
 Organizations      Schedules         Plans
 Memberships        Attendance        Features
 Users              Leave             Subscriptions
 Roles              Timesheets
 Permissions        Payroll
        │
        ▼
    Work Management
        │
   Projects / Tasks
        │
        ▼
   Time Tracking
        │
 ┌──────┼────────┬──────────┐
 ▼      ▼        ▼          ▼
Events Time     Activity  Monitoring
       Entries
                          │
                    ┌─────┴─────┐
                    ▼           ▼
               Screenshots   Recordings
                                │
                                ▼
                               R2
```

---

# 32. One architectural change I recommend before migrations

There is one thing I'd add to our previous design:

## `organization_settings`

Rather than putting every future organization configuration directly into `organizations`, create:

```text
organization_settings
────────────────────────────
id                  UUID PK
organization_id     UUID FK UNIQUE
tracking_settings   JSONB
screenshot_settings JSONB
recording_settings  JSONB
attendance_settings JSONB
payroll_settings    JSONB
notification_settings JSONB
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

However, **we should not put core business data into JSONB**.

This table is specifically for configuration such as:

```text
screenshot interval
idle timeout
work week
tracking mode
rounding rules
```

This keeps `organizations` clean while allowing configuration to evolve.

---

# 33. Final Physical Schema Count

Our current design is approximately:

**Identity / SaaS**

```text
users
organizations
organization_memberships
roles
permissions
membership_roles
role_permissions
organization_invitations
organization_settings
```

**Work management**

```text
teams
team_members
projects
project_members
tasks
task_assignees
```

**Tracking**

```text
devices
tracking_sessions
tracking_events
time_entries
idle_periods
```

**Monitoring**

```text
activity_events
application_usage
website_usage
productivity_rules
screenshots
recordings
recording_segments
```

**Workforce**

```text
schedules
schedule_shifts
membership_schedules
attendance_records
breaks
leave_types
leave_requests
```

**Timesheets/payroll**

```text
timesheets
timesheet_entries
timesheet_approvals
pay_rates
payroll_periods
payroll_entries
```

**Billing**

```text
plans
features
plan_features
subscriptions
```

**Premium**

```text
office_locations
office_networks
connectivity_events
```

**Platform**

```text
notifications
notification_preferences
audit_logs
retention_policies
```

That's roughly **50 tables**, which is entirely reasonable for a product of the scope we're designing.

---

## Where we are now

Our design progression is now:

```text
Product Requirements
        ↓
System Architecture             ✅
        ↓
Domain Model                     ✅
        ↓
Logical ERD                      ✅
        ↓
Physical Database Design        ← NOW COMPLETED
        ↓
PostgreSQL Schema / Migrations  ← NEXT
        ↓
Eloquent Models
        ↓
API Contracts
```

### The next step should be **PostgreSQL Schema & Laravel Migration Specification**.

There we'll go **table by table**, starting with `users`, `organizations`, and `organization_memberships`, and produce the exact Laravel migration definitions—including PostgreSQL types, UUIDv7 handling, foreign keys, indexes, unique constraints, check constraints, and migration dependency/order.