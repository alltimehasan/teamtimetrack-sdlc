Yes. Let's do exactly that: **the complete Team Time Track ERD, table by table, with PK/FK relationships and cardinalities**.

I’ll treat the product-plan PDF as the feature baseline and distinguish architectural decisions we have made from anything the PDF itself specifies. The PDF establishes the plan-level capabilities and retention periods; it does not define the database schema.  

# Team Time Track — Complete ERD Specification

## 1. ERD notation

We'll use standard **Crow's Foot** cardinality:

```text
||    exactly one
o|    zero or one
|{    one or many
o{    zero or many
```

For example:

```text
USERS ||--o{ ORGANIZATION_MEMBERSHIPS
```

means:

> One user can have zero or many organization memberships.

---

# 2. Identity & Multi-Tenancy

This is the foundation of the entire application.

```text
USERS
   │
   │ 1:N
   ▼
ORGANIZATION_MEMBERSHIPS
   │
   │ N:1
   ▼
ORGANIZATIONS
```

### `users`

| Column | Key | Purpose |
|---|---|---|
| `id` | PK | Global user identity |
| `name` | | User's name |
| `email` | UK | Login email |
| `password` | | Password hash |
| `email_verified_at` | | Verification timestamp |
| `avatar` | | Avatar reference |
| `status` | | Account status |
| `last_login_at` | | Last login |
| `created_at` | | |
| `updated_at` | | |
| `deleted_at` | | Soft deletion |

### `organizations`

| Column | Key | Purpose |
|---|---|---|
| `id` | PK | Tenant ID |
| `name` | | Company/workspace name |
| `slug` | UK | URL-safe identifier |
| `logo_path` | | Logo reference |
| `timezone` | | Organization timezone |
| `country` | | Country |
| `currency` | | Default currency |
| `date_format` | | Display preference |
| `time_format` | | 12/24-hour preference |
| `week_starts_on` | | Week configuration |
| `status` | | Organization status |
| `created_at` | | |
| `updated_at` | | |
| `deleted_at` | | |

### `organization_memberships`

This is the **bridge between a global user and an organization**.

| Column | Key |
|---|---|
| `id` | PK |
| `organization_id` | FK → `organizations.id` |
| `user_id` | FK → `users.id` |
| `status` | |
| `invited_at` | |
| `joined_at` | |
| `created_at` | |
| `updated_at` |
| `deleted_at` | |

Constraint:

```text
UNIQUE(organization_id, user_id)
```

Relationship:

```text
USERS ||--o{ ORGANIZATION_MEMBERSHIPS : has
ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERSHIPS : contains
```

---

# 3. Roles & Permissions

Roles belong to an organization's membership, not directly to the global user.

```text
ORGANIZATION_MEMBERSHIP
          │
          │ N:M
          ▼
        ROLES
          │
          │ N:M
          ▼
     PERMISSIONS
```

### Tables

```text
roles
permissions
membership_roles
role_permissions
```

### `roles`

```text
id                  PK
organization_id     FK → organizations.id
name
slug
description
is_system
created_at
updated_at
```

### `permissions`

```text
id                  PK
name
slug                UK
description
```

### `membership_roles`

```text
membership_id       FK → organization_memberships.id
role_id             FK → roles.id
```

Composite PK:

```text
PK(membership_id, role_id)
```

### `role_permissions`

```text
role_id             FK → roles.id
permission_id       FK → permissions.id
```

Composite PK:

```text
PK(role_id, permission_id)
```

Relationships:

```text
ORGANIZATION_MEMBERSHIPS ||--o{ MEMBERSHIP_ROLES : has
ROLES ||--o{ MEMBERSHIP_ROLES : assigned

ROLES ||--o{ ROLE_PERMISSIONS : grants
PERMISSIONS ||--o{ ROLE_PERMISSIONS : contains
```

---

# 4. Organization Invitations

```text
ORGANIZATIONS
      │
      │ 1:N
      ▼
ORGANIZATION_INVITATIONS
```

### `organization_invitations`

```text
id                  PK
organization_id     FK
role_id             FK
invited_by          FK → users.id
email
token_hash
expires_at
accepted_at
created_at
```

Relationship:

```text
ORGANIZATIONS ||--o{ ORGANIZATION_INVITATIONS : creates
ROLES ||--o{ ORGANIZATION_INVITATIONS : assigns
USERS ||--o{ ORGANIZATION_INVITATIONS : sends
```

---

# 5. Teams

```text
ORGANIZATIONS
      │
      └──< TEAMS
              │
              └──< TEAM_MEMBERS >── ORGANIZATION_MEMBERSHIPS
```

### `teams`

```text
id                  PK
organization_id     FK
name
description
status
created_at
updated_at
deleted_at
```

### `team_members`

```text
team_id             FK
membership_id       FK
```

Composite PK:

```text
PK(team_id, membership_id)
```

Relationships:

```text
ORGANIZATIONS ||--o{ TEAMS : contains
TEAMS ||--o{ TEAM_MEMBERS : contains
ORGANIZATION_MEMBERSHIPS ||--o{ TEAM_MEMBERS : joins
```

---

# 6. Projects

```text
ORGANIZATIONS
      │
      └──< PROJECTS
              │
       ┌──────┴──────┐
       ▼             ▼
PROJECT_MEMBERS    TASKS
```

### `projects`

```text
id                  PK
organization_id     FK
created_by          FK → users.id
name
description
status
color
start_date
end_date
created_at
updated_at
deleted_at
```

### `project_members`

```text
project_id          FK
membership_id       FK
```

Composite PK:

```text
PK(project_id, membership_id)
```

Relationships:

```text
ORGANIZATIONS ||--o{ PROJECTS : contains
PROJECTS ||--o{ PROJECT_MEMBERS : has
ORGANIZATION_MEMBERSHIPS ||--o{ PROJECT_MEMBERS : assigned
```

---

# 7. Tasks

### `tasks`

```text
id                  PK
organization_id     FK
project_id          FK
created_by          FK → users.id
name
description
status
priority
due_at
completed_at
created_at
updated_at
deleted_at
```

### `task_assignees`

```text
task_id             FK
membership_id       FK
```

Composite PK:

```text
PK(task_id, membership_id)
```

Relationships:

```text
PROJECTS ||--o{ TASKS : contains

TASKS ||--o{ TASK_ASSIGNEES : assigned
ORGANIZATION_MEMBERSHIPS ||--o{ TASK_ASSIGNEES : receives
```

---

# 8. Devices

A user can have multiple desktop devices.

```text
MEMBERSHIP
    │
    └──< DEVICES
```

### `devices`

```text
id                  PK
organization_id     FK
membership_id       FK
device_uuid         UK
name
platform
platform_version
app_version
last_seen_at
status
created_at
updated_at
```

Relationship:

```text
ORGANIZATION_MEMBERSHIPS ||--o{ DEVICES : uses
```

---

# 9. Tracking Sessions

This is the core of the tracker.

```text
MEMBERSHIP
     │
     └──< TRACKING_SESSIONS
                  │
       ┌──────────┼──────────┐
       ▼          ▼          ▼
   EVENTS       TIME       ACTIVITY
               ENTRIES
```

### `tracking_sessions`

```text
id                  PK
organization_id     FK
membership_id       FK
device_id           FK
project_id          FK
task_id             FK
started_at
ended_at
status
source
timezone
created_at
updated_at
```

Relationships:

```text
DEVICES ||--o{ TRACKING_SESSIONS : runs
ORGANIZATION_MEMBERSHIPS ||--o{ TRACKING_SESSIONS : creates
PROJECTS ||--o{ TRACKING_SESSIONS : tracks
TASKS ||--o{ TRACKING_SESSIONS : tracks
```

---

# 10. Tracking Events

### `tracking_events`

```text
id                  PK
organization_id     FK
membership_id       FK
session_id          FK
device_id           FK
client_event_id
event_type
occurred_at
received_at
payload             JSONB
created_at
```

Important:

```text
UNIQUE(organization_id, client_event_id)
```

Relationship:

```text
TRACKING_SESSIONS ||--o{ TRACKING_EVENTS : contains
```

This is what enables reliable offline synchronization.

---

# 11. Time Entries

Raw events are not the same thing as billable/reportable time.

```text
TRACKING_EVENTS
       ↓
calculation
       ↓
TIME_ENTRIES
```

### `time_entries`

```text
id                  PK
organization_id     FK
membership_id       FK
tracking_session_id FK
project_id          FK
task_id             FK
created_by          FK
started_at
ended_at
duration_seconds
entry_type
source
status
reason
created_at
updated_at
```

Relationships:

```text
TRACKING_SESSIONS ||--o{ TIME_ENTRIES : produces
PROJECTS ||--o{ TIME_ENTRIES : contains
TASKS ||--o{ TIME_ENTRIES : contains
ORGANIZATION_MEMBERSHIPS ||--o{ TIME_ENTRIES : owns
```

---

# 12. Idle Periods

### `idle_periods`

```text
id
organization_id
membership_id
tracking_session_id
started_at
ended_at
duration_seconds
source
created_at
```

Relationship:

```text
TRACKING_SESSIONS ||--o{ IDLE_PERIODS : contains
```

---

# 13. Activity Tracking

### `activity_events`

```text
id
organization_id
membership_id
tracking_session_id
started_at
ended_at
keyboard_activity
mouse_activity
activity_percentage
created_at
```

Relationship:

```text
TRACKING_SESSIONS ||--o{ ACTIVITY_EVENTS : generates
```

---

# 14. Application Usage

### `application_usage`

```text
id
organization_id
membership_id
tracking_session_id
application_name
process_name
started_at
ended_at
duration_seconds
created_at
```

Relationship:

```text
TRACKING_SESSIONS ||--o{ APPLICATION_USAGE : records
```

---

# 15. Website Usage

### `website_usage`

```text
id
organization_id
membership_id
tracking_session_id
domain
path
started_at
ended_at
duration_seconds
created_at
```

Relationship:

```text
TRACKING_SESSIONS ||--o{ WEBSITE_USAGE : records
```

---

# 16. Productivity Rules

The PDF specifies configurable productivity ratings for Standard/Premium. 

### `productivity_rules`

```text
id
organization_id
target_type
target
classification
created_by
created_at
updated_at
```

Example:

```text
github.com → productive
youtube.com → unproductive
```

---

# 17. Screenshots

### `screenshots`

```text
id
organization_id
membership_id
tracking_session_id
project_id
task_id
captured_at
storage_key
mime_type
file_size
width
height
status
created_at
```

Relationship:

```text
TRACKING_SESSIONS ||--o{ SCREENSHOTS : captures
```

Actual image:

```text
Cloudflare R2
```

PostgreSQL stores only metadata and the storage key.

---

# 18. Video Recordings

The PDF specifies video screen recording as **Premium-only**. 

### `recordings`

```text
id
organization_id
membership_id
tracking_session_id
started_at
ended_at
duration_seconds
status
total_size
resolution
frame_rate
codec
created_at
updated_at
```

### `recording_segments`

```text
id
recording_id
sequence
storage_key
duration_seconds
file_size
checksum
status
created_at
```

Relationship:

```text
TRACKING_SESSIONS ||--o{ RECORDINGS : produces
RECORDINGS ||--o{ RECORDING_SEGMENTS : contains
```

Actual video:

```text
Cloudflare R2
```

---

# 19. Schedules

### `schedules`

```text
id
organization_id
name
timezone
status
created_at
updated_at
```

### `schedule_shifts`

```text
id
schedule_id
day_of_week
start_time
end_time
break_duration_seconds
minimum_work_seconds
```

### `membership_schedules`

```text
id
membership_id
schedule_id
effective_from
effective_until
```

Relationships:

```text
ORGANIZATIONS ||--o{ SCHEDULES : defines
SCHEDULES ||--o{ SCHEDULE_SHIFTS : contains

ORGANIZATION_MEMBERSHIPS ||--o{ MEMBERSHIP_SCHEDULES : assigned
SCHEDULES ||--o{ MEMBERSHIP_SCHEDULES : assigned_to
```

---

# 20. Attendance

### `attendance_records`

```text
id
organization_id
membership_id
date
first_activity_at
last_activity_at
scheduled_seconds
worked_seconds
status
late_seconds
early_leave_seconds
created_at
updated_at
```

Critical constraint:

```text
UNIQUE(organization_id, membership_id, date)
```

Relationship:

```text
ORGANIZATION_MEMBERSHIPS ||--o{ ATTENDANCE_RECORDS : has
```

---

# 21. Breaks

### `breaks`

```text
id
organization_id
membership_id
tracking_session_id
started_at
ended_at
duration_seconds
break_type
source
created_at
updated_at
```

Relationship:

```text
TRACKING_SESSIONS ||--o{ BREAKS : contains
```

---

# 22. Leave

### `leave_types`

```text
id
organization_id
name
description
is_paid
requires_approval
created_at
updated_at
```

### `leave_requests`

```text
id
organization_id
membership_id
leave_type_id
reviewed_by
starts_at
ends_at
reason
status
reviewed_at
created_at
updated_at
```

Relationships:

```text
ORGANIZATIONS ||--o{ LEAVE_TYPES : defines
LEAVE_TYPES ||--o{ LEAVE_REQUESTS : used_by
ORGANIZATION_MEMBERSHIPS ||--o{ LEAVE_REQUESTS : requests
```

---

# 23. Timesheets

### `timesheets`

```text
id
organization_id
membership_id
period_start
period_end
total_seconds
status
submitted_at
approved_at
rejected_at
created_at
updated_at
```

### `timesheet_entries`

```text
id
timesheet_id
time_entry_id
duration_seconds
```

### `timesheet_approvals`

```text
id
timesheet_id
reviewer_membership_id
action
comment
created_at
```

Relationships:

```text
ORGANIZATION_MEMBERSHIPS ||--o{ TIMESHEETS : owns

TIMESHEETS ||--o{ TIMESHEET_ENTRIES : contains
TIME_ENTRIES ||--o{ TIMESHEET_ENTRIES : included

TIMESHEETS ||--o{ TIMESHEET_APPROVALS : receives
ORGANIZATION_MEMBERSHIPS ||--o{ TIMESHEET_APPROVALS : reviews
```

---

# 24. Payroll

The PDF places payroll in Standard/Premium. 

### `pay_rates`

```text
id
organization_id
membership_id
rate
currency
effective_from
effective_until
created_at
updated_at
```

### `payroll_periods`

```text
id
organization_id
period_start
period_end
status
processed_at
created_at
updated_at
```

### `payroll_entries`

```text
id
payroll_period_id
membership_id
approved_seconds
hourly_rate
gross_amount
adjustments
net_amount
currency
created_at
```

Relationships:

```text
ORGANIZATION_MEMBERSHIPS ||--o{ PAY_RATES : has

ORGANIZATIONS ||--o{ PAYROLL_PERIODS : owns
PAYROLL_PERIODS ||--o{ PAYROLL_ENTRIES : contains
ORGANIZATION_MEMBERSHIPS ||--o{ PAYROLL_ENTRIES : receives
```

---

# 25. Subscription & Plans

The PDF defines:

```text
Basic
Standard
Premium
```

and assigns features to those plans. 

### `plans`

```text
id
name
slug
description
billing_interval
price
currency
is_active
created_at
updated_at
```

### `features`

```text
id
code
name
description
type
created_at
updated_at
```

### `plan_features`

```text
plan_id
feature_id
enabled
limit_value
limit_unit
```

### `subscriptions`

```text
id
organization_id
plan_id
status
provider
provider_subscription_id
trial_ends_at
current_period_start
current_period_end
canceled_at
created_at
updated_at
```

Relationships:

```text
PLANS ||--o{ PLAN_FEATURES : provides
FEATURES ||--o{ PLAN_FEATURES : included

ORGANIZATIONS ||--o{ SUBSCRIPTIONS : has
PLANS ||--o{ SUBSCRIPTIONS : selected
```

---

# 26. Office vs Remote

The PDF defines this as Premium. 

### `office_locations`

```text
id
organization_id
name
timezone
status
created_at
updated_at
```

### `office_networks`

```text
id
office_location_id
type
value
description
created_at
```

Relationships:

```text
ORGANIZATIONS ||--o{ OFFICE_LOCATIONS : owns
OFFICE_LOCATIONS ||--o{ OFFICE_NETWORKS : contains
```

---

# 27. Internet Connectivity

### `connectivity_events`

```text
id
organization_id
device_id
occurred_at
status
latency_ms
created_at
```

Relationship:

```text
DEVICES ||--o{ CONNECTIVITY_EVENTS : reports
```

---

# 28. Notifications

### `notifications`

```text
id
organization_id
recipient_membership_id
type
title
data
read_at
created_at
```

### `notification_preferences`

```text
id
membership_id
notification_type
email_enabled
in_app_enabled
push_enabled
created_at
updated_at
```

Relationships:

```text
ORGANIZATION_MEMBERSHIPS ||--o{ NOTIFICATIONS : receives
ORGANIZATION_MEMBERSHIPS ||--o{ NOTIFICATION_PREFERENCES : configures
```

---

# 29. Audit Logs

### `audit_logs`

```text
id
organization_id
actor_membership_id
action
entity_type
entity_id
old_values
new_values
ip_address
user_agent
created_at
```

Relationships:

```text
ORGANIZATIONS ||--o{ AUDIT_LOGS : records
ORGANIZATION_MEMBERSHIPS ||--o{ AUDIT_LOGS : performs
```

This is particularly important for things such as:

```text
Timesheet approval
Payroll changes
Role changes
Screenshot policy changes
Project changes
User suspension
```

---

# 30. Retention Policies

The PDF specifies different historical-data retention periods by plan:

- Basic — 3 months
- Standard — 6 months
- Premium — 2 years. 

We'll model that as:

### `retention_policies`

```text
id
organization_id
data_type
retention_days
created_at
updated_at
```

Relationship:

```text
ORGANIZATIONS ||--o{ RETENTION_POLICIES : defines
```

---

# 31. Complete Relationship Map

Now putting everything together:

```text
                                      ┌──────────────┐
                                      │    USERS     │
                                      └──────┬───────┘
                                             │
                                             │ 1:N
                                             ▼
                              ┌──────────────────────────┐
                              │ ORGANIZATION_MEMBERSHIPS │
                              └────────────┬─────────────┘
                                           │
                                           │ N:1
                                           ▼
                                  ┌────────────────┐
                                  │ ORGANIZATIONS  │
                                  └───────┬────────┘
                                          │
       ┌──────────────┬──────────────────┼──────────────────┬───────────────┐
       │              │                  │                  │               │
       ▼              ▼                  ▼                  ▼               ▼
     TEAMS         PROJECTS          SCHEDULES          LEAVE TYPES     SUBSCRIPTIONS
       │              │                  │                  │               │
       ▼              ▼                  ▼                  ▼               ▼
 TEAM_MEMBERS       TASKS          SCHEDULE_SHIFTS    LEAVE_REQUESTS     PLANS
                      │                  │
                      ▼                  ▼
                 TASK_ASSIGNEES    MEMBERSHIP_SCHEDULES
                      │
                      │
                      ▼
                 TRACKING_SESSIONS
                      │
       ┌──────────────┼───────────────┬──────────────┬───────────────┐
       │              │               │              │               │
       ▼              ▼               ▼              ▼               ▼
 TRACKING_EVENTS  TIME_ENTRIES    IDLE_PERIODS   ACTIVITY_EVENTS  BREAKS
                                      │
                                      │
                         ┌────────────┴─────────────┐
                         ▼                          ▼
                 APPLICATION_USAGE            WEBSITE_USAGE

                 TRACKING_SESSIONS
                       │
                 ┌─────┴──────┐
                 ▼            ▼
            SCREENSHOTS    RECORDINGS
                              │
                              ▼
                      RECORDING_SEGMENTS

                  TIME_ENTRIES
                       │
                       ▼
                   TIMESHEETS
                       │
                       ▼
               TIMESHEET_APPROVALS
                       │
                       ▼
                    PAYROLL
```

---

# 32. The Most Important Relationships

For implementation, these are the relationships I consider **architecturally critical**:

### Identity

```text
User
  1:N
OrganizationMembership
  N:1
Organization
```

### Work

```text
Organization
  1:N
Project
  1:N
Task
```

### Tracking

```text
Membership
  1:N
TrackingSession
  1:N
TrackingEvent
```

### Time

```text
TrackingSession
  1:N
TimeEntry
```

### Monitoring

```text
TrackingSession
  1:N
Screenshot

TrackingSession
  1:N
ActivityEvent

TrackingSession
  1:N
ApplicationUsage

TrackingSession
  1:N
WebsiteUsage

TrackingSession
  1:N
Recording
  1:N
RecordingSegment
```

### Payroll

```text
TimeEntry
  ↓
Timesheet
  ↓
Approval
  ↓
Payroll
```

### SaaS

```text
Organization
  1:N
Subscription
  N:1
Plan
  N:M
Feature
```

---

# 33. Full ERD in One Sentence

If we reduce the entire application to its essential data flow:

> **A global User joins one or more Organizations through Memberships; memberships receive roles, teams, projects and schedules; their Devices generate Tracking Sessions and Events; sessions produce Time Entries and monitoring data such as activity, screenshots, applications, websites and Premium recordings; time entries become Timesheets, approvals and Payroll; Organizations are governed by Plans, Features, Subscriptions, Notifications, Audit Logs and Retention Policies.**

That is the **complete logical ERD for Team Time Track v1**.

One important point: **this is still the logical ERD, not yet the physical PostgreSQL schema**. We should not start writing Laravel migrations until we make the next pass over this ERD and resolve things such as exact FK delete behavior, UUID implementation, enum/check constraints, composite indexes, and whether any relationship needs an additional entity. That is the next step after this ERD.