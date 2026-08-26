Yes. Let's finish the remaining physical database design so we have a **complete Team Time Track PostgreSQL schema blueprint**.

We have already designed tables **1–44**. We'll now finish **45–51**, then consolidate the entire database and establish the rules we'll carry into the Laravel models and migrations.

# Team Time Track — Physical Database Design Complete

## 45. `office_locations`

This supports the **Office vs. Remote** functionality in the Premium plan. The product requirements explicitly include the Office vs. Remote report. 

```php
Schema::create('office_locations', function (Blueprint $table) {
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

Example:

```text
ABC Corporation
│
├── New York Office
├── London Office
└── Dhaka Office
```

---

# 46. `office_networks`

We need a way to determine whether a device is connected from a recognized office network.

```php
Schema::create('office_networks', function (Blueprint $table) {
    $table->uuid('id')->primary();

    $table->foreignUuid('office_location_id')
        ->constrained()
        ->cascadeOnDelete();

    $table->string('type', 30);

    $table->string('value', 255);

    $table->string('description', 255)
        ->nullable();

    $table->timestampsTz();

    $table->index([
        'office_location_id',
        'type',
    ]);
});
```

Possible network types:

```text
ipv4
ipv6
cidr
```

Example:

```text
New York Office
    │
    ├── 203.0.113.0/24
    └── 2001:db8::/32
```

---

# 47. `connectivity_events`

This records device connectivity observations.

```php
Schema::create('connectivity_events', function (Blueprint $table) {
    $table->uuid('id')->primary();

    $table->foreignUuid('organization_id')
        ->constrained()
        ->restrictOnDelete();

    $table->foreignUuid('device_id')
        ->constrained()
        ->restrictOnDelete();

    $table->timestampTz('occurred_at');

    $table->string('status', 30);

    $table->unsignedInteger('latency_ms')
        ->nullable();

    $table->timestampsTz();

    $table->index([
        'organization_id',
        'device_id',
        'occurred_at',
    ]);

    $table->index([
        'organization_id',
        'occurred_at',
    ]);
});
```

Possible statuses:

```text
online
offline
degraded
unknown
```

---

# 48. How Office vs Remote works

The database does **not** need a permanent:

```text
employee.work_mode = remote
```

field.

Instead, the system can derive work location from connectivity observations.

Conceptually:

```text
Device
   │
   ▼
Connectivity Event
   │
   ▼
IP / Network
   │
   ▼
Office Network?
   │
   ├── YES → OFFICE
   │
   └── NO  → REMOTE
```

This is better because an employee may work:

```text
Monday    → Office
Tuesday   → Remote
Wednesday → Office
Thursday  → Remote
Friday    → Office
```

The report is therefore based on actual observed activity rather than a permanent employee attribute.

---

# 49. Notifications

Now we move into the platform layer.

### `notifications`

```php
Schema::create('notifications', function (Blueprint $table) {
    $table->uuid('id')->primary();

    $table->foreignUuid('organization_id')
        ->constrained()
        ->restrictOnDelete();

    $table->foreignUuid('recipient_membership_id')
        ->constrained('organization_memberships')
        ->cascadeOnDelete();

    $table->string('type', 100);

    $table->string('title', 255);

    $table->jsonb('data')
        ->nullable();

    $table->timestampTz('read_at')
        ->nullable();

    $table->timestampsTz();

    $table->index([
        'recipient_membership_id',
        'read_at',
        'created_at',
    ]);

    $table->index([
        'organization_id',
        'created_at',
    ]);
});
```

Examples:

```text
Timesheet submitted
Timesheet approved
Timesheet rejected
Leave approved
Leave rejected
New organization invitation
Subscription expiring
```

---

# 50. `notification_preferences`

Users need control over how they receive notifications.

```php
Schema::create('notification_preferences', function (Blueprint $table) {
    $table->uuid('id')->primary();

    $table->foreignUuid('membership_id')
        ->constrained('organization_memberships')
        ->cascadeOnDelete();

    $table->string('notification_type', 100);

    $table->boolean('email_enabled')
        ->default(true);

    $table->boolean('in_app_enabled')
        ->default(true);

    $table->boolean('push_enabled')
        ->default(true);

    $table->timestampsTz();

    $table->unique([
        'membership_id',
        'notification_type',
    ]);
});
```

Notice again that preferences are attached to the **organization membership**, not the global user.

That allows:

```text
Hasan @ Company A
    → email notifications ON

Hasan @ Company B
    → email notifications OFF
```

---

# 51. Audit Logs

This is one of the most important platform tables.

```php
Schema::create('audit_logs', function (Blueprint $table) {
    $table->uuid('id')->primary();

    $table->foreignUuid('organization_id')
        ->constrained()
        ->restrictOnDelete();

    $table->foreignUuid('actor_membership_id')
        ->nullable()
        ->constrained('organization_memberships')
        ->nullOnDelete();

    $table->string('action', 100);

    $table->string('entity_type', 150);

    $table->uuid('entity_id');

    $table->jsonb('old_values')
        ->nullable();

    $table->jsonb('new_values')
        ->nullable();

    $table->ipAddress('ip_address')
        ->nullable();

    $table->text('user_agent')
        ->nullable();

    $table->timestampTz('created_at');

    $table->index([
        'organization_id',
        'created_at',
    ]);

    $table->index([
        'organization_id',
        'entity_type',
        'entity_id',
    ]);

    $table->index([
        'actor_membership_id',
        'created_at',
    ]);
});
```

---

# 52. Why `actor_membership_id` is nullable

Consider this:

```text
Admin deletes an employee
```

We can record:

```text
actor_membership_id = Admin's membership
```

But what about:

```text
Automatic retention cleanup
```

There may be no human actor.

Therefore:

```text
actor_membership_id = NULL
```

is valid.

The `action` can identify the operation:

```text
retention.delete
```

---

# 53. Audit log example

Suppose a manager changes an employee's role.

We could record:

```json
{
    "action": "membership.role_changed",
    "entity_type": "organization_membership",
    "entity_id": "...",
    "old_values": {
        "role": "employee"
    },
    "new_values": {
        "role": "manager"
    }
}
```

This gives us an immutable historical trail.

---

# 54. Important audit rule

Audit logs should generally be:

> **Append-only.**

We should not allow ordinary application users to:

```text
UPDATE audit_logs
DELETE audit_logs
```

The application should only create new audit records.

---

# 55. `retention_policies`

The product requirements define different historical-data retention periods by plan:

```text
Basic     → 3 months
Standard  → 6 months
Premium   → 2 years
```



We previously designed a `retention_policies` table, but now that we have our entitlement system, we need to refine its purpose.

The **plan entitlement** tells us what the organization is allowed to retain.

The `retention_policies` table tells us **how that organization currently applies its retention configuration**.

```php
Schema::create('retention_policies', function (Blueprint $table) {
    $table->uuid('id')->primary();

    $table->foreignUuid('organization_id')
        ->constrained()
        ->cascadeOnDelete();

    $table->string('data_type', 50);

    $table->unsignedInteger('retention_days');

    $table->timestampsTz();

    $table->unique([
        'organization_id',
        'data_type',
    ]);
});
```

---

# 56. Data types for retention

Examples:

```text
tracking_events
activity_events
application_usage
website_usage
screenshots
recordings
audit_logs
```

So an organization could conceptually have:

```text
organization_id | data_type            | retention_days
--------------------------------------------------------
ABC             | screenshots          | 180
ABC             | recordings           | 180
ABC             | tracking_events      | 180
ABC             | audit_logs            | 365
```

But there is an important rule:

> The organization cannot configure retention beyond the limit allowed by its subscription.

So if Premium allows 2 years, an organization cannot configure 10 years.

The entitlement service enforces that boundary.

---

# 57. Retention architecture

The final flow is:

```text
Subscription
      ↓
Plan
      ↓
retention_months entitlement
      ↓
Retention Policy
      ↓
Scheduled Cleanup
      ↓
Queue
      ↓
Delete expired data
```

For screenshots:

```text
PostgreSQL metadata
       +
Cloudflare R2 object
```

both must eventually be cleaned up.

---

# 58. Complete database — 51 tables

We can now consider the **physical database design complete**.

## Identity & tenancy

```text
01  users
02  organizations
03  organization_memberships
04  organization_invitations
05  organization_settings
```

## Authorization

```text
06  roles
07  permissions
08  membership_roles
09  role_permissions
```

## Teams & work management

```text
10  teams
11  team_members
12  projects
13  project_members
14  tasks
15  task_assignees
```

## Desktop tracking

```text
16  devices
17  tracking_sessions
18  tracking_events
19  time_entries
20  idle_periods
21  breaks
```

## Monitoring

```text
22  activity_events
23  application_usage
24  website_usage
25  productivity_rules
26  screenshots
27  recordings
28  recording_segments
```

## Workforce management

```text
29  schedules
30  schedule_shifts
31  membership_schedules
32  attendance_records
33  leave_types
34  leave_requests
```

## Timesheets & payroll

```text
35  timesheets
36  timesheet_entries
37  timesheet_approvals
38  pay_rates
39  payroll_periods
40  payroll_entries
```

## SaaS billing & entitlements

```text
41  plans
42  features
43  plan_features
44  subscriptions
```

## Office / remote

```text
45  office_locations
46  office_networks
47  connectivity_events
```

## Platform

```text
48  notifications
49  notification_preferences
50  audit_logs
51  retention_policies
```

---

# 59. Complete high-level ERD

The complete logical flow now looks like this:

```text
                                      ┌─────────────┐
                                      │    USERS    │
                                      └──────┬──────┘
                                             │
                                             │
                                             ▼
                              ┌─────────────────────────┐
                              │ ORGANIZATION_MEMBERSHIPS│
                              └────────────┬────────────┘
                                           │
                                           ▼
                                  ┌─────────────────┐
                                  │ ORGANIZATIONS   │
                                  └────────┬────────┘
                                           │
          ┌────────────────────────────────┼──────────────────────────────┐
          │                                │                              │
          ▼                                ▼                              ▼
       TEAMS                           PROJECTS                       SUBSCRIPTIONS
          │                                │                              │
          ▼                                ▼                              ▼
    TEAM_MEMBERS                         TASKS                          PLANS
                                           │                              │
                                           ▼                              ▼
                                    TASK_ASSIGNEES                 PLAN_FEATURES
                                                                          │
                                                                          ▼
                                                                      FEATURES


                  ORGANIZATION MEMBERSHIP
                           │
             ┌─────────────┼──────────────┐
             ▼             ▼              ▼
          DEVICES      SCHEDULES       PAY_RATES
             │             │
             ▼             ▼
      TRACKING_SESSIONS  SHIFTS
             │
      ┌──────┼─────────────┬─────────────┐
      ▼      ▼             ▼             ▼
   EVENTS  TIME_ENTRIES  ACTIVITY     APPLICATION
                              │          USAGE
                              │
                              └──── WEBSITE USAGE

             TRACKING SESSION
                    │
             ┌──────┴─────────┐
             ▼                ▼
        SCREENSHOTS       RECORDINGS
                              │
                              ▼
                       RECORDING_SEGMENTS
                              │
                              ▼
                         CLOUDFLARE R2


 TIME_ENTRIES
      │
      ▼
 TIMESHEET
      │
      ├───────────────┐
      ▼               ▼
 TIMESHEET_ENTRY   APPROVAL
      │               │
      └───────┬───────┘
              ▼
       APPROVED TIME
              │
              ▼
      PAYROLL_PERIOD
              │
              ▼
       PAYROLL_ENTRY


 SCHEDULE
    │
    ▼
 ATTENDANCE
    ▲
    │
    ├──────── TRACKING
    │
    └──────── LEAVE


 ORGANIZATION
      │
      ├── OFFICE_LOCATIONS
      │       │
      │       └── OFFICE_NETWORKS
      │
      └── CONNECTIVITY_EVENTS
                 ▲
                 │
               DEVICES


 ORGANIZATION
      │
      ├── NOTIFICATIONS
      │
      ├── AUDIT_LOGS
      │
      └── RETENTION_POLICIES
```

---

# 60. The four major domains

Although we have 51 tables, the application is much easier to reason about if we divide them into domains.

### Identity & Access

```text
User
Organization
Membership
Role
Permission
Invitation
```

### Work & Tracking

```text
Team
Project
Task
Device
Tracking Session
Tracking Event
Time Entry
Activity
Application
Website
Screenshot
Recording
```

### Workforce & Payroll

```text
Schedule
Attendance
Break
Leave
Timesheet
Approval
Pay Rate
Payroll
```

### SaaS Platform

```text
Plan
Feature
Subscription
Office
Notification
Audit
Retention
```

This domain separation will become extremely useful when we build the Laravel application.

---

# 61. Critical architectural rules

Before leaving the database design, I want to lock down these rules.

### Rule 1 — Organization is the tenant

Every tenant-owned table must be traceable to:

```text
organization_id
```

---

### Rule 2 — User is global

A user can belong to:

```text
0 → many organizations
```

through:

```text
organization_memberships
```

---

### Rule 3 — Membership is the authorization context

When Hasan acts inside Company A:

```text
User
 ↓
Company A Membership
 ↓
Roles
 ↓
Permissions
```

---

### Rule 4 — Tracking is not payroll

Never:

```text
Tracking Event → Payroll
```

Always:

```text
Tracking
 → Time Entry
 → Timesheet
 → Approval
 → Payroll
```

---

### Rule 5 — R2 stores media, PostgreSQL stores metadata

```text
Screenshot/Video
      │
      ├── metadata → PostgreSQL
      │
      └── binary   → R2
```

---

### Rule 6 — Entitlements are separate from permissions

```text
Permission
= what the user can do

Entitlement
= what the organization purchased
```

Both must pass for restricted functionality.

---

### Rule 7 — Historical financial records are immutable

Approved:

```text
Timesheet
Payroll
```

should not be casually overwritten.

---

### Rule 8 — High-volume tables are retention-aware

Especially:

```text
tracking_events
activity_events
application_usage
website_usage
screenshots
recordings
```

---

### Rule 9 — UUIDs everywhere

Business entities use UUID primary keys.

Many-to-many pivot tables use composite primary keys.

---

### Rule 10 — UTC in the database

Store actual instants as:

```text
TIMESTAMPTZ
```

and convert to organization/user timezone at the application/presentation layer.

---

# 62. One important correction before implementation

There is one design point I would change from our earlier discussions.

We originally considered `retention_months` as a feature entitlement. I would keep that **as the plan-level entitlement**, but also retain `retention_policies` for organization-level operational configuration.

So:

```text
PLAN
 │
 └── retention_months = 24
              │
              ▼
RETENTION_POLICY
 │
 └── configured retention = 12 months
```

The policy can be **less than or equal to** the entitlement, never greater.

This gives customers flexibility while maintaining the commercial limit.

---

# 63. Database is now ready for Laravel modeling

We have now completed:

```text
Product Requirements
        ↓
System Architecture
        ↓
Domain Model
        ↓
Logical ERD
        ↓
Physical PostgreSQL Design
        ↓
51 Tables
        ↓
PK / FK
        ↓
Indexes
        ↓
Constraints
        ↓
Delete Behavior
        ↓
Retention Strategy
        ↓
R2 Media Strategy
        ↓
Subscription Entitlements
```

### The next phase should therefore be:

# **Laravel Eloquent Domain Model**

We'll define, table by table:

```text
app/Models/
├── User.php
├── Organization.php
├── OrganizationMembership.php
├── Role.php
├── Permission.php
├── Team.php
├── Project.php
├── Task.php
├── Device.php
├── TrackingSession.php
├── TrackingEvent.php
├── TimeEntry.php
├── Screenshot.php
├── Recording.php
├── Schedule.php
├── AttendanceRecord.php
├── LeaveRequest.php
├── Timesheet.php
├── PayrollEntry.php
├── Plan.php
├── Feature.php
├── Subscription.php
├── OfficeLocation.php
├── Notification.php
├── AuditLog.php
└── RetentionPolicy.php
```

And for each model we'll define the exact:

- `belongsTo()`
- `hasMany()`
- `belongsToMany()`
- `hasOne()`
- PHP backed enums
- casts
- scopes
- tenant isolation rules
- UUID handling
- soft deletes
- authorization boundaries

**At that point we'll have the database-to-Laravel mapping completely specified, and then we can move into the actual API/domain architecture.**