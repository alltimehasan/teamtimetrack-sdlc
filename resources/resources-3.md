Absolutely. We should now turn the previous system architecture into a **concrete domain model and PostgreSQL database design**.

I'll treat the attached **Features Per Plan** PDF as the product-feature baseline. It confirms the core domains we need to support: screenshots, projects/tasks, hours, timeline, teams, activity, web/app usage, productivity ratings, attendance, breaks, leave, payroll, schedules, work-life balance, approvals, Premium Office vs. Remote, Internet Connectivity, video recording, dashboards, online/offline tracking, notifications, and the defined historical-data retention periods.   

Everything below that is **our architectural/design decision**, rather than something explicitly specified by the PDF.

# Team Time Track
## Domain Model & Database Design — v1.0

### Technology

| Area | Decision |
|---|---|
| Database | PostgreSQL |
| ORM | Laravel Eloquent |
| Primary key | UUID |
| API | Laravel |
| Cache/queue | Redis |
| Object storage | Cloudflare R2 |
| Web | Next.js |
| Desktop | Electron |
| Tenant model | Shared database / shared schema |
| Tenant isolation | `organization_id` + authorization |
| Time storage | Event/session + derived time entries |
| Video | Chunked recordings |
| Soft deletion | Where appropriate |
| Audit data | Append-only |

---

# 1. Core Domain Model

The most important thing is to establish the **business relationships** before thinking about individual tables.

At the highest level:

```text
                         TEAM TIME TRACK
                                │
                         ┌──────▼──────┐
                         │ Organization │
                         └──────┬──────┘
                                │
             ┌──────────────────┼──────────────────┐
             │                  │                  │
             ▼                  ▼                  ▼
           Users              Teams            Subscription
             │                  │
             │                  │
             ├────────────┐     │
             ▼            ▼     ▼
          Projects      Schedules
             │
             ▼
           Tasks
             │
             ▼
       Time Tracking
             │
      ┌──────┼────────┬───────────┐
      ▼      ▼        ▼           ▼
   Activity Screenshots  Applications/Websites
      │
      ▼
   Reports
```

And separately:

```text
Organization
     │
     ├── Attendance
     ├── Breaks
     ├── Leave
     ├── Timesheets
     ├── Payroll
     ├── Notifications
     └── Audit Logs
```

---

# 2. The Most Important Decision: Users vs Organizations

I recommend **not putting `organization_id` directly on `users`**.

Why?

Because eventually a person may belong to more than one organization.

For example:

```text
Hasan
 ├── Organization A → Employee
 └── Organization B → Manager
```

So we should model:

```text
users
   │
   │ many-to-many
   ▼
organization_memberships
   │
   ▼
organizations
```

This gives us a much stronger SaaS foundation.

---

# 3. `users`

This represents a **person's global identity** in Team Time Track.

```text
users
────────────────────────────
id
name
email
password
email_verified_at
avatar
status
last_login_at
created_at
updated_at
deleted_at
```

### Important constraints

```text
email UNIQUE
```

Email should be globally unique if we want one identity to potentially belong to multiple organizations.

### Status

```text
active
suspended
deactivated
```

Don't delete users simply because they leave an organization.

---

# 4. `organizations`

This represents our SaaS customer's company/workspace.

```text
organizations
────────────────────────────
id
name
slug
logo_path
timezone
country
currency
date_format
time_format
week_starts_on
status
created_at
updated_at
deleted_at
```

Example:

```text
id:       01...
name:     ABC Web Agency
slug:     abc-web-agency
timezone: America/Los_Angeles
currency: USD
```

### Unique

```text
slug UNIQUE
```

---

# 5. `organization_memberships`

This is one of the most important tables.

```text
organization_memberships
────────────────────────────
id
organization_id
user_id
status
joined_at
invited_at
created_at
updated_at
deleted_at
```

Relationships:

```text
organizations 1 ──── * organization_memberships
users         1 ──── * organization_memberships
```

Unique:

```text
UNIQUE(organization_id, user_id)
```

This prevents accidentally adding the same user twice.

---

# 6. Roles & Permissions

We should **not hard-code roles into users**.

Use:

```text
roles
permissions
role_permissions
membership_roles
```

### Roles

```text
roles
────────────────
id
organization_id NULL
name
slug
description
is_system
created_at
updated_at
```

System roles:

```text
owner
admin
manager
employee
```

Future:

```text
client
auditor
payroll_manager
```

### Permissions

```text
permissions
────────────────
id
name
slug
description
```

Examples:

```text
users.view
users.manage

teams.view
teams.manage

projects.view
projects.manage

tracking.view
tracking.manage

screenshots.view

timesheets.view
timesheets.approve

payroll.view
payroll.manage

reports.view

billing.manage
```

### Membership roles

```text
membership_roles
────────────────────
membership_id
role_id
```

This allows:

```text
Hasan
 ├── Manager
 └── Payroll Manager
```

if we ever need that flexibility.

---

# 7. Organization Invitations

```text
organization_invitations
────────────────────────────
id
organization_id
email
role_id
invited_by
token_hash
expires_at
accepted_at
created_at
```

Flow:

```text
Admin
 ↓
Invitation
 ↓
Email
 ↓
Accept
 ↓
User account
 ↓
Membership
```

This is our MVP user-provisioning mechanism.

The PDF's **Automatic user provisioning** is a separate future enterprise capability. 

---

# 8. Teams

```text
teams
────────────────────────────
id
organization_id
name
description
status
created_at
updated_at
deleted_at
```

Users ↔ Teams:

```text
team_members
────────────────
team_id
membership_id
```

A user can therefore belong to multiple teams.

---

# 9. Projects

```text
projects
────────────────────────────
id
organization_id
name
description
status
color
start_date
end_date
created_by
created_at
updated_at
deleted_at
```

Project statuses:

```text
active
completed
archived
```

---

# 10. Project Members

```text
project_members
────────────────
project_id
membership_id
```

This allows:

```text
Project A
 ├── Hasan
 ├── John
 └── Sarah
```

without giving every employee access to every project.

---

# 11. Tasks

```text
tasks
────────────────────────
id
organization_id
project_id
name
description
status
priority
created_by
due_at
completed_at
created_at
updated_at
deleted_at
```

Relationship:

```text
Project
   │
   └── Tasks
```

---

# 12. Task Assignment

```text
task_assignees
────────────────
task_id
membership_id
```

---

# 13. Tracking Sessions

Now we reach the **core of Team Time Track**.

A tracking session represents a continuous tracking period.

```text
tracking_sessions
────────────────────────────
id
organization_id
membership_id
device_id
project_id
task_id
started_at
ended_at
status
source
timezone
created_at
updated_at
```

Status:

```text
active
paused
stopped
```

Source:

```text
desktop
web
manual
```

The PDF requires both online/offline and user-controlled/automatic tracking. 

---

# 14. Tracking Events

Instead of trusting a single start/end record, the desktop client sends events.

```text
tracking_events
────────────────────────────
id
organization_id
membership_id
session_id
device_id
client_event_id
event_type
occurred_at
received_at
payload
created_at
```

Example event types:

```text
session_started
session_paused
session_resumed
session_stopped
idle_started
idle_ended
break_started
break_ended
project_changed
task_changed
```

### Critical constraint

```text
UNIQUE(device_id, client_event_id)
```

or:

```text
UNIQUE(organization_id, client_event_id)
```

This gives us **idempotency** during offline synchronization.

---

# 15. Time Entries

`tracking_events` are raw events.

`time_entries` represent **actual calculated work intervals**.

```text
time_entries
────────────────────────────
id
organization_id
membership_id
tracking_session_id
project_id
task_id
started_at
ended_at
duration_seconds
entry_type
source
status
created_at
updated_at
```

Example:

```text
09:00 → 10:30
10:45 → 12:00
13:00 → 17:00
```

becomes separate time entries.

This gives us a clean reporting layer.

---

# 16. Manual Time Entries

A manually entered time record should still use `time_entries`.

Set:

```text
source = manual
```

and record:

```text
created_by
```

Potential additional fields:

```text
reason
approved_at
```

This is important for auditability.

---

# 17. Idle Periods

```text
idle_periods
────────────────────────
id
organization_id
membership_id
tracking_session_id
started_at
ended_at
duration_seconds
source
```

Example:

```text
10:42 → 10:51
Idle = 9 minutes
```

---

# 18. Breaks

```text
breaks
────────────────────────
id
organization_id
membership_id
started_at
ended_at
duration_seconds
break_type
source
created_at
updated_at
```

The PDF includes Break Tracking in Standard and Premium. 

---

# 19. Attendance

Attendance should **not simply duplicate time entries**.

```text
attendance_records
────────────────────────────
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

Status:

```text
present
late
absent
partial
leave
holiday
```

This lets us compare:

```text
Expected: 8h
Worked:   7h 32m
```

---

# 20. Schedules

```text
schedules
────────────────────────────
id
organization_id
name
timezone
status
created_at
updated_at
```

### Schedule shifts

```text
schedule_shifts
────────────────────────────
id
schedule_id
day_of_week
start_time
end_time
break_duration_seconds
minimum_work_seconds
```

### Assignment

```text
membership_schedules
────────────────────────
membership_id
schedule_id
effective_from
effective_until
```

This allows an employee to change schedules over time.

The PDF explicitly includes Schedules as a Standard/Premium management feature. 

---

# 21. Leave

### Leave types

```text
leave_types
────────────────────
id
organization_id
name
description
is_paid
requires_approval
```

Examples:

```text
Vacation
Sick Leave
Personal Leave
Unpaid Leave
```

### Leave requests

```text
leave_requests
────────────────────────
id
organization_id
membership_id
leave_type_id
starts_at
ends_at
reason
status
reviewed_by
reviewed_at
created_at
updated_at
```

Status:

```text
pending
approved
rejected
cancelled
```

---

# 22. Screenshots

Screenshots should contain **metadata only** in PostgreSQL.

The actual image goes to R2.

```text
screenshots
────────────────────────────
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

Example R2 key:

```text
organizations/{organization}/screenshots/{year}/{month}/{day}/{uuid}.jpg
```

Never store the image binary in PostgreSQL.

---

# 23. Activity Events

We should avoid storing every raw mouse movement.

Instead, aggregate activity into useful intervals.

```text
activity_events
────────────────────────────
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

Example:

```text
09:00–09:15
Keyboard: 72%
Mouse:    45%
Activity: 68%
```

This keeps the database manageable.

---

# 24. Application Usage

```text
application_usage
────────────────────────────
id
organization_id
membership_id
tracking_session_id
application_name
process_name
started_at
ended_at
duration_seconds
```

Example:

```text
VS Code
3h 21m
```

---

# 25. Website Usage

```text
website_usage
────────────────────────────
id
organization_id
membership_id
tracking_session_id
domain
url
started_at
ended_at
duration_seconds
```

We should be cautious about storing complete URLs because URLs can contain sensitive query parameters.

For MVP, I'd primarily store:

```text
domain
path
```

only where required.

---

# 26. Productivity Rules

The PDF includes **Configurable Productivity Ratings** in Standard/Premium. 

Use:

```text
productivity_rules
────────────────────────────
id
organization_id
target_type
target
classification
created_by
created_at
updated_at
```

Classification:

```text
productive
unproductive
neutral
```

Target:

```text
domain
application
```

Example:

```text
github.com → productive
youtube.com → unproductive
slack → productive
```

---

# 27. Video Recordings

Because we have explicitly decided to include **Premium video screen recording**, this gets its own domain.

The PDF confirms:

```text
Basic      NO
Standard   NO
Premium    YES
```



### Recordings

```text
recordings
────────────────────────────
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

Status:

```text
recording
uploading
processing
ready
failed
deleted
```

### Recording segments

```text
recording_segments
────────────────────────────
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

This allows:

```text
Recording
 ├── Segment 001
 ├── Segment 002
 ├── Segment 003
 └── Segment 004
```

rather than one huge file.

---

# 28. Devices

We need a device identity for Electron.

```text
devices
────────────────────────────
id
organization_id
membership_id
device_uuid
name
platform
platform_version
app_version
last_seen_at
status
created_at
updated_at
```

Example:

```text
Hasan's Windows PC
Windows 11
Team Time Track 1.0.0
```

This is important for offline sync and security.

---

# 29. Synchronization

We can use a synchronization ledger.

```text
sync_batches
────────────────────────
id
device_id
client_batch_id
received_at
status
```

And every event has:

```text
client_event_id
```

The server can safely process:

```text
Batch 123
 ↓
Event A
Event B
Event C
```

If the same batch is sent again:

```text
Batch 123 already processed
```

No duplicates.

---

# 30. Timesheets

```text
timesheets
────────────────────────────
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

Status:

```text
draft
submitted
approved
rejected
```

### Timesheet entries

```text
timesheet_entries
────────────────────────────
id
timesheet_id
time_entry_id
duration_seconds
```

---

# 31. Timesheet Approvals

```text
timesheet_approvals
────────────────────────────
id
timesheet_id
reviewer_membership_id
action
comment
created_at
```

Actions:

```text
approved
rejected
requested_changes
```

---

# 32. Payroll

The PDF includes Payroll as a Standard/Premium management capability. 

### Pay rates

```text
pay_rates
────────────────────────────
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

### Payroll periods

```text
payroll_periods
────────────────────────────
id
organization_id
period_start
period_end
status
processed_at
created_at
updated_at
```

### Payroll entries

```text
payroll_entries
────────────────────────────
id
payroll_period_id
membership_id
approved_seconds
hourly_rate
gross_amount
adjustments
net_amount
currency
```

This gives us a payroll **calculation/export system** without making Team Time Track itself a payment processor.

---

# 33. Office vs Remote

Premium feature.

The PDF explicitly identifies Office vs. Remote as Premium-only. 

### Office locations

```text
office_locations
────────────────────────────
id
organization_id
name
timezone
status
created_at
updated_at
```

### Network configuration

```text
office_networks
────────────────────────────
id
office_location_id
type
value
description
```

Possible types:

```text
public_ip
ip_range
wifi_ssid
```

Then tracking sessions can record:

```text
location_type
```

such as:

```text
office
remote
```

We should **derive** this from network/location information rather than permanently treating the employee as remote or office.

---

# 34. Internet Connectivity

Premium feature.

The PDF identifies Internet Connectivity as Premium. 

We can track connection state in the desktop application:

```text
connectivity_events
────────────────────────────
id
organization_id
device_id
occurred_at
status
latency_ms
```

Status:

```text
online
offline
```

This is particularly useful for diagnosing:

> "Why did this employee's tracker stop syncing?"

---

# 35. Notifications

```text
notifications
────────────────────────────
id
organization_id
recipient_membership_id
type
title
data
read_at
created_at
```

Examples:

```text
timesheet_submitted
timesheet_approved
timesheet_rejected
schedule_reminder
leave_approved
inactivity_alert
```

---

# 36. Notification Preferences

```text
notification_preferences
────────────────────────────
id
membership_id
notification_type
email_enabled
in_app_enabled
push_enabled
```

---

# 37. Audit Logs

This should be append-only.

```text
audit_logs
────────────────────────────
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

Example:

```text
Manager approved Timesheet #123
```

or:

```text
Admin changed screenshot interval
15 minutes → 10 minutes
```

---

# 38. Subscription Model

We need to separate **plans** from **subscriptions**.

### Plans

```text
plans
────────────────────────────
id
name
slug
description
billing_interval
price
currency
is_active
```

Example:

```text
Basic
Standard
Premium
```

### Features

```text
features
────────────────────────────
id
code
name
description
type
```

Examples:

```text
screenshots
activity_summary
web_app_usage
attendance
payroll
schedules
time_approvals
office_remote
video_recording
executive_dashboard
```

### Plan features

```text
plan_features
────────────────────────────
plan_id
feature_id
enabled
limit_value
limit_unit
```

This is our entitlement system.

---

# 39. Subscriptions

```text
subscriptions
────────────────────────────
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

Status:

```text
trialing
active
past_due
canceled
expired
```

---

# 40. Subscription Seats

Because Team Time Track is likely to be priced per user/seat, we should track:

```text
subscription_usage
────────────────────────────
id
subscription_id
metric
value
recorded_at
```

Example:

```text
active_users = 15
```

But we should calculate current usage from actual memberships where practical; cached usage can be maintained for billing/reporting.

---

# 41. Retention Policies

The PDF specifies:

```text
Basic      3 months
Standard   6 months
Premium    2 years
```



Don't hard-code this into every cleanup job.

Create:

```text
retention_policies
────────────────────────
organization_id
data_type
retention_days
```

Possible data types:

```text
time_entries
screenshots
activity
website_usage
application_usage
recordings
audit_logs
```

This gives us flexibility.

---

# 42. Entity Relationship Overview

The core ER structure looks like this:

```text
users
  │
  └────< organization_memberships >──── organizations
                                             │
             ┌───────────────────────────────┼───────────────────────────────┐
             │                               │                               │
             ▼                               ▼                               ▼
           teams                          projects                      subscription
             │                               │
             │                               ▼
             │                             tasks
             │                               │
             └──────────────┐                │
                            ▼                ▼
                         tracking_sessions
                                │
                    ┌───────────┼────────────┐
                    │           │            │
                    ▼           ▼            ▼
              tracking_events  time_entries  activity_events
                    │                        │
                    │                 ┌──────┴───────┐
                    │                 ▼              ▼
                    │          application_usage website_usage
                    │
                    ├── screenshots
                    │
                    └── recordings
                              │
                              ▼
                    recording_segments

organization
    │
    ├── schedules → schedule_shifts
    ├── attendance_records
    ├── breaks
    ├── leave_requests
    ├── timesheets → timesheet_entries
    ├── payroll_periods → payroll_entries
    ├── notifications
    └── audit_logs
```

---

# 43. Tenant Ownership Rules

This is critical.

Almost every business table should contain:

```text
organization_id
```

For example:

```text
projects.organization_id
tasks.organization_id
time_entries.organization_id
screenshots.organization_id
recordings.organization_id
attendance_records.organization_id
payroll_periods.organization_id
```

Even when the relationship can theoretically be inferred through another table, keeping `organization_id` directly available gives us:

1. Faster tenant filtering
2. Better indexes
3. Easier authorization
4. Safer queries
5. Easier reporting
6. Better partitioning options later

But we must avoid inconsistent ownership.

For example:

```text
time_entries.organization_id
```

must always match:

```text
time_entries.membership.organization_id
```

and:

```text
time_entries.project.organization_id
```

if a project is assigned.

The application/domain layer should enforce this invariant.

---

# 44. Indexing Strategy

This will be particularly important because time-tracking systems become **write-heavy**.

### Common tenant index

```text
INDEX(organization_id)
```

### User reports

```text
INDEX(organization_id, membership_id, created_at)
```

### Time reports

```text
INDEX(organization_id, started_at)
```

### Project reports

```text
INDEX(organization_id, project_id, started_at)
```

### Screenshots

```text
INDEX(organization_id, membership_id, captured_at)
```

### Recordings

```text
INDEX(organization_id, membership_id, started_at)
```

### Attendance

```text
UNIQUE(organization_id, membership_id, date)
```

### Teams

```text
UNIQUE(organization_id, name)
```

where appropriate.

---

# 45. Time & Date Strategy

This needs to be standardized.

### Database

Store timestamps in:

> **UTC**

For example:

```text
2026-08-25 15:00:00 UTC
```

### Organization

Stores:

```text
timezone = Asia/Dhaka
```

### User-facing display

Convert UTC → organization/user timezone.

### Schedules

Schedules need an explicit timezone because:

```text
09:00 America/New_York
```

is not equivalent to:

```text
09:00 Asia/Dhaka
```

This becomes particularly important for global teams.

---

# 46. Monetary Values

Do **not** use floating-point values for money.

Use:

```text
numeric(12,2)
```

or integer minor units.

For example:

```text
$25.50
```

can be stored as:

```text
2550 cents
```

For payroll, I'd prefer integer minor units where possible.

---

# 47. Duration Strategy

Do not store:

```text
7.5 hours
```

as a floating-point number.

Use:

```text
duration_seconds BIGINT
```

Example:

```text
7h 30m
=
27000 seconds
```

This avoids floating-point errors.

---

# 48. JSONB Usage

PostgreSQL `JSONB` is useful, but we should **not turn the database into an unstructured JSON database**.

Good use:

```text
tracking_events.payload
audit_logs.old_values
audit_logs.new_values
notifications.data
```

Bad use:

```text
users.profile_data
projects.everything
time_entries.all_information
```

Important business fields should remain proper columns.

---

# 49. Soft Deletes

Use `deleted_at` for entities where historical relationships matter:

```text
users
teams
projects
tasks
```

But don't blindly use soft deletes everywhere.

For high-volume event data:

```text
tracking_events
activity_events
connectivity_events
```

retention/archival policies are more appropriate.

---

# 50. High-Volume Tables

These are likely to grow rapidly:

```text
tracking_events
activity_events
application_usage
website_usage
screenshots
recording_segments
audit_logs
```

We should design them as **partition-ready**.

Initially, PostgreSQL can handle them with proper indexing.

As Team Time Track grows, we can introduce monthly partitions:

```text
tracking_events_2026_08
tracking_events_2026_09
tracking_events_2026_10
```

without changing the domain model.

I would **not prematurely partition every table on day one**.

---

# 51. What Should NOT Be Stored in PostgreSQL?

Large binary data should remain outside the database.

### Don't store:

```text
Screenshot binary
Video binary
Large generated reports
```

### Store:

```text
R2 storage key
MIME type
Size
Checksum
Metadata
```

So:

```text
PostgreSQL
     │
     └── storage_key
             │
             ▼
          Cloudflare R2
```

---

# 52. R2 Storage Organization

I recommend a predictable key structure:

```text
{organization_id}/
    screenshots/
        {year}/
            {month}/
                {day}/
                    {uuid}.jpg

    recordings/
        {year}/
            {month}/
                {day}/
                    {recording_id}/
                        000001.webm
                        000002.webm

    exports/
        {year}/
            {month}/
                {uuid}.csv
```

This gives us excellent organization and makes lifecycle policies easier.

---

# 53. Database State Machines

Several domains need explicit states.

### Tracking session

```text
active
  ↓
paused
  ↓
active
  ↓
stopped
```

### Timesheet

```text
draft
 ↓
submitted
 ↓
approved

or

submitted
 ↓
rejected
 ↓
draft
```

### Leave

```text
pending
 ↓
approved

pending
 ↓
rejected
```

### Recording

```text
recording
 ↓
uploading
 ↓
processing
 ↓
ready
```

or:

```text
uploading
 ↓
failed
```

These transitions should be enforced in domain services rather than allowing arbitrary status updates.

---

# 54. Important Invariants

These are rules that must **always** be true.

### Tenant

```text
A resource belongs to exactly one organization.
```

### Membership

```text
A membership connects one user to one organization.
```

### Time entry

```text
Time entry cannot belong to another organization's project.
```

### Tracking session

```text
A session belongs to exactly one employee/device.
```

### Recording

```text
A recording belongs to exactly one tracking session.
```

### Screenshot

```text
A screenshot belongs to exactly one organization and employee.
```

### Payroll

```text
Payroll should be based on approved/eligible time according to organization policy.
```

These invariants are more important than the individual table definitions.

---

# 55. Database Layering

I recommend thinking of the database as four layers:

```text
┌───────────────────────────────┐
│ SaaS / Identity               │
│ Organizations Users Roles     │
└───────────────────────────────┘

┌───────────────────────────────┐
│ Workforce / Work Management   │
│ Teams Projects Tasks          │
│ Schedules Attendance Leave    │
└───────────────────────────────┘

┌───────────────────────────────┐
│ Tracking / Monitoring         │
│ Sessions Events Time Activity │
│ Screenshots Recordings        │
└───────────────────────────────┘

┌───────────────────────────────┐
│ Business / Reporting          │
│ Timesheets Payroll Reports    │
│ Subscriptions Notifications   │
└───────────────────────────────┘
```

This separation will also translate nicely into Laravel domain modules.

---

# 56. Laravel Domain Mapping

Our database model maps naturally to:

```text
app/Domain/
│
├── Identity/
│   ├── User
│   ├── Role
│   └── Permission
│
├── Organizations/
│   ├── Organization
│   └── Membership
│
├── Teams/
│   └── Team
│
├── Projects/
│   ├── Project
│   └── Task
│
├── TimeTracking/
│   ├── TrackingSession
│   ├── TrackingEvent
│   └── TimeEntry
│
├── Monitoring/
│   ├── Screenshot
│   ├── ActivityEvent
│   ├── ApplicationUsage
│   └── WebsiteUsage
│
├── Recordings/
│   ├── Recording
│   └── RecordingSegment
│
├── Workforce/
│   ├── Attendance
│   ├── Break
│   ├── Schedule
│   └── Leave
│
├── Timesheets/
│   └── Timesheet
│
├── Payroll/
│   └── PayrollPeriod
│
├── Reports/
│
├── Billing/
│   ├── Plan
│   ├── Feature
│   └── Subscription
│
└── Audit/
    └── AuditLog
```

This is the structure I'd like us to preserve when we start writing Laravel code.

---

# 57. MVP Database vs Future Database

We should **design for future features without implementing unnecessary tables now**.

### MVP/core

```text
organizations
users
organization_memberships
roles
permissions
organization_invitations

teams
team_members

projects
project_members
tasks
task_assignees

devices
tracking_sessions
tracking_events
time_entries
idle_periods

screenshots
activity_events
application_usage
website_usage

schedules
schedule_shifts
membership_schedules

attendance_records
breaks
leave_types
leave_requests

timesheets
timesheet_entries
timesheet_approvals

pay_rates
payroll_periods
payroll_entries

plans
features
plan_features
subscriptions

notifications
notification_preferences
audit_logs

retention_policies
```

### Premium

Add:

```text
recordings
recording_segments
office_locations
office_networks
connectivity_events
```

The Premium additions align with the PDF's Premium-only Office vs. Remote, Internet Connectivity and Video Screen Recording capabilities. 

### Future

We can later add domains for:

```text
client portal
SSO
SCIM
HRIS
API keys
integrations
BigQuery
AI insights
meeting insights
software cost insights
```

The PDF explicitly places several of these in future releases, including Open API, SSO, automatic provisioning, BigQuery and HRIS integration.  

---

# 58. The Core Principle

The most important architectural distinction is:

```text
RAW DATA
   ↓
Events
   ↓
Sessions
   ↓
Derived time
   ↓
Timesheets
   ↓
Approvals
   ↓
Payroll
   ↓
Reports
```

For example:

```text
Electron says:

09:00 START
09:45 IDLE
09:50 RESUME
12:00 STOP
```

We don't immediately turn that into payroll.

Instead:

```text
Tracking Events
      ↓
Tracking Session
      ↓
Time Entries
      ↓
Timesheet
      ↓
Manager Approval
      ↓
Payroll
```

This separation will make Team Time Track much easier to reason about and much safer when users edit time, work offline, change projects, or dispute payroll.

---

# 59. Final Core ERD

The simplified production model is therefore:

```text
                         ┌──────────────┐
                         │    USERS     │
                         └──────┬───────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │ ORGANIZATION_MEMBERSHIP│
                    └───────────┬────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ ORGANIZATIONS   │
                       └───────┬─────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
     TEAMS                 PROJECTS              SCHEDULES
        │                      │                      │
        │                      ▼                      ▼
        │                    TASKS                ATTENDANCE
        │                      │                   BREAKS
        │                      │                   LEAVE
        └──────────────┐       │
                       ▼       ▼
                    TRACKING SESSIONS
                           │
              ┌────────────┼───────────────┐
              ▼            ▼               ▼
        TRACKING EVENTS  TIME ENTRIES   ACTIVITY
              │            │               │
              │            │          ┌────┴────┐
              ▼            ▼          ▼         ▼
        SCREENSHOTS    TIMESHEETS   APPS      WEBSITES
              │            │
              ▼            ▼
             R2          APPROVALS
                           │
                           ▼
                        PAYROLL

Organization
    │
    ├── Subscription → Plan → Features
    ├── Notifications
    ├── Audit Logs
    └── Retention Policies

Tracking Session
    │
    └── Recording
          └── Recording Segments → R2
```

## My recommendation before we proceed

**Do not start creating Laravel migrations from this yet.** This is our **logical database design**.

The next step should be to turn this into a **physical PostgreSQL schema specification**:

1. Exact table names
2. Every column
3. PostgreSQL data type
4. `NULL`/`NOT NULL`
5. Default values
6. Primary keys
7. Foreign keys
8. `ON DELETE` behavior
9. Unique constraints
10. Composite indexes
11. Check constraints
12. Enum strategy
13. UUID strategy
14. Timestamp strategy
15. Soft-delete strategy
16. High-volume table/index strategy
17. Tenant-isolation rules
18. Laravel migration ordering

That document will effectively become the **blueprint from which we can generate the Laravel migrations and Eloquent models**. It is worth being meticulous there because changing the fundamental data model after the Electron tracker, reports, payroll, and subscription system are built would be expensive.