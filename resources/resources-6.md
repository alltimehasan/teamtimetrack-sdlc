Absolutely. Since you want this to become the **authoritative ERD for the full Team Time Track application**, I would make one important refinement before drawing it:

We should include the **complete production domain**, but keep the ERD focused on **database entities and relationships**. Things such as Laravel queues, Redis, Electron, Next.js, and R2 belong in the system architecture diagram, not the ERD.

Below is the first authoritative version.

# Team Time Track — Full Application ERD

The ERD covers:

- SaaS / multi-tenancy
- Identity & access control
- Organizations
- Teams
- Projects & tasks
- Desktop devices
- Time tracking
- Offline synchronization
- Screenshots
- Activity
- Applications/websites
- Premium video recordings
- Attendance
- Breaks
- Schedules
- Leave
- Timesheets
- Payroll
- Subscriptions/plans/features
- Premium office/remote
- Notifications
- Audit
- Retention

The Premium recording portion is included because the PDF explicitly specifies **Video Screen Recording for Premium**. 

---

## 1. Full ERD — Mermaid Source

This is the source I recommend we keep as the authoritative ERD:

```mermaid
erDiagram

    %% =========================================================
    %% IDENTITY & MULTI-TENANCY
    %% =========================================================

    USERS {
        uuid id PK
        string name
        string email UK
        string password
        timestamp email_verified_at
        string avatar
        string status
        timestamp last_login_at
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    ORGANIZATIONS {
        uuid id PK
        string name
        string slug UK
        string logo_path
        string timezone
        string country
        string currency
        string date_format
        string time_format
        string week_starts_on
        string status
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    ORGANIZATION_MEMBERSHIPS {
        uuid id PK
        uuid organization_id FK
        uuid user_id FK
        string status
        timestamp invited_at
        timestamp joined_at
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    ROLES {
        uuid id PK
        uuid organization_id FK
        string name
        string slug
        string description
        boolean is_system
        timestamp created_at
        timestamp updated_at
    }

    PERMISSIONS {
        uuid id PK
        string name UK
        string slug UK
        string description
    }

    MEMBERSHIP_ROLES {
        uuid membership_id FK
        uuid role_id FK
    }

    ROLE_PERMISSIONS {
        uuid role_id FK
        uuid permission_id FK
    }

    ORGANIZATION_INVITATIONS {
        uuid id PK
        uuid organization_id FK
        uuid role_id FK
        uuid invited_by FK
        string email
        string token_hash
        timestamp expires_at
        timestamp accepted_at
        timestamp created_at
    }


    %% =========================================================
    %% TEAMS
    %% =========================================================

    TEAMS {
        uuid id PK
        uuid organization_id FK
        string name
        string description
        string status
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    TEAM_MEMBERS {
        uuid team_id FK
        uuid membership_id FK
    }


    %% =========================================================
    %% PROJECTS & TASKS
    %% =========================================================

    PROJECTS {
        uuid id PK
        uuid organization_id FK
        uuid created_by FK
        string name
        string description
        string status
        string color
        date start_date
        date end_date
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    PROJECT_MEMBERS {
        uuid project_id FK
        uuid membership_id FK
    }

    TASKS {
        uuid id PK
        uuid organization_id FK
        uuid project_id FK
        uuid created_by FK
        string name
        string description
        string status
        string priority
        timestamp due_at
        timestamp completed_at
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    TASK_ASSIGNEES {
        uuid task_id FK
        uuid membership_id FK
    }


    %% =========================================================
    %% DEVICES & TRACKING
    %% =========================================================

    DEVICES {
        uuid id PK
        uuid organization_id FK
        uuid membership_id FK
        string device_uuid
        string name
        string platform
        string platform_version
        string app_version
        timestamp last_seen_at
        string status
        timestamp created_at
        timestamp updated_at
    }

    TRACKING_SESSIONS {
        uuid id PK
        uuid organization_id FK
        uuid membership_id FK
        uuid device_id FK
        uuid project_id FK
        uuid task_id FK
        timestamp started_at
        timestamp ended_at
        string status
        string source
        string timezone
        timestamp created_at
        timestamp updated_at
    }

    TRACKING_EVENTS {
        uuid id PK
        uuid organization_id FK
        uuid membership_id FK
        uuid session_id FK
        uuid device_id FK
        string client_event_id
        string event_type
        timestamp occurred_at
        timestamp received_at
        jsonb payload
        timestamp created_at
    }

    TIME_ENTRIES {
        uuid id PK
        uuid organization_id FK
        uuid membership_id FK
        uuid tracking_session_id FK
        uuid project_id FK
        uuid task_id FK
        uuid created_by FK
        timestamp started_at
        timestamp ended_at
        bigint duration_seconds
        string entry_type
        string source
        string status
        string reason
        timestamp created_at
        timestamp updated_at
    }

    IDLE_PERIODS {
        uuid id PK
        uuid organization_id FK
        uuid membership_id FK
        uuid tracking_session_id FK
        timestamp started_at
        timestamp ended_at
        bigint duration_seconds
        string source
        timestamp created_at
    }


    %% =========================================================
    %% ACTIVITY / MONITORING
    %% =========================================================

    ACTIVITY_EVENTS {
        uuid id PK
        uuid organization_id FK
        uuid membership_id FK
        uuid tracking_session_id FK
        timestamp started_at
        timestamp ended_at
        integer keyboard_activity
        integer mouse_activity
        integer activity_percentage
        timestamp created_at
    }

    APPLICATION_USAGE {
        uuid id PK
        uuid organization_id FK
        uuid membership_id FK
        uuid tracking_session_id FK
        string application_name
        string process_name
        timestamp started_at
        timestamp ended_at
        bigint duration_seconds
        timestamp created_at
    }

    WEBSITE_USAGE {
        uuid id PK
        uuid organization_id FK
        uuid membership_id FK
        uuid tracking_session_id FK
        string domain
        string path
        timestamp started_at
        timestamp ended_at
        bigint duration_seconds
        timestamp created_at
    }

    PRODUCTIVITY_RULES {
        uuid id PK
        uuid organization_id FK
        string target_type
        string target
        string classification
        uuid created_by FK
        timestamp created_at
        timestamp updated_at
    }

    SCREENSHOTS {
        uuid id PK
        uuid organization_id FK
        uuid membership_id FK
        uuid tracking_session_id FK
        uuid project_id FK
        uuid task_id FK
        timestamp captured_at
        string storage_key
        string mime_type
        bigint file_size
        integer width
        integer height
        string status
        timestamp created_at
    }


    %% =========================================================
    %% PREMIUM VIDEO RECORDING
    %% =========================================================

    RECORDINGS {
        uuid id PK
        uuid organization_id FK
        uuid membership_id FK
        uuid tracking_session_id FK
        timestamp started_at
        timestamp ended_at
        bigint duration_seconds
        string status
        bigint total_size
        string resolution
        integer frame_rate
        string codec
        timestamp created_at
        timestamp updated_at
    }

    RECORDING_SEGMENTS {
        uuid id PK
        uuid recording_id FK
        integer sequence
        string storage_key
        bigint duration_seconds
        bigint file_size
        string checksum
        string status
        timestamp created_at
    }


    %% =========================================================
    %% SCHEDULES / ATTENDANCE / BREAKS
    %% =========================================================

    SCHEDULES {
        uuid id PK
        uuid organization_id FK
        string name
        string timezone
        string status
        timestamp created_at
        timestamp updated_at
    }

    SCHEDULE_SHIFTS {
        uuid id PK
        uuid schedule_id FK
        integer day_of_week
        time start_time
        time end_time
        bigint break_duration_seconds
        bigint minimum_work_seconds
    }

    MEMBERSHIP_SCHEDULES {
        uuid id PK
        uuid membership_id FK
        uuid schedule_id FK
        date effective_from
        date effective_until
    }

    ATTENDANCE_RECORDS {
        uuid id PK
        uuid organization_id FK
        uuid membership_id FK
        date date
        timestamp first_activity_at
        timestamp last_activity_at
        bigint scheduled_seconds
        bigint worked_seconds
        string status
        bigint late_seconds
        bigint early_leave_seconds
        timestamp created_at
        timestamp updated_at
    }

    BREAKS {
        uuid id PK
        uuid organization_id FK
        uuid membership_id FK
        uuid tracking_session_id FK
        timestamp started_at
        timestamp ended_at
        bigint duration_seconds
        string break_type
        string source
        timestamp created_at
        timestamp updated_at
    }


    %% =========================================================
    %% LEAVE
    %% =========================================================

    LEAVE_TYPES {
        uuid id PK
        uuid organization_id FK
        string name
        string description
        boolean is_paid
        boolean requires_approval
        timestamp created_at
        timestamp updated_at
    }

    LEAVE_REQUESTS {
        uuid id PK
        uuid organization_id FK
        uuid membership_id FK
        uuid leave_type_id FK
        uuid reviewed_by FK
        timestamp starts_at
        timestamp ends_at
        string reason
        string status
        timestamp reviewed_at
        timestamp created_at
        timestamp updated_at
    }


    %% =========================================================
    %% TIMESHEETS
    %% =========================================================

    TIMESHEETS {
        uuid id PK
        uuid organization_id FK
        uuid membership_id FK
        date period_start
        date period_end
        bigint total_seconds
        string status
        timestamp submitted_at
        timestamp approved_at
        timestamp rejected_at
        timestamp created_at
        timestamp updated_at
    }

    TIMESHEET_ENTRIES {
        uuid id PK
        uuid timesheet_id FK
        uuid time_entry_id FK
        bigint duration_seconds
    }

    TIMESHEET_APPROVALS {
        uuid id PK
        uuid timesheet_id FK
        uuid reviewer_membership_id FK
        string action
        string comment
        timestamp created_at
    }


    %% =========================================================
    %% PAYROLL
    %% =========================================================

    PAY_RATES {
        uuid id PK
        uuid organization_id FK
        uuid membership_id FK
        decimal rate
        string currency
        date effective_from
        date effective_until
        timestamp created_at
        timestamp updated_at
    }

    PAYROLL_PERIODS {
        uuid id PK
        uuid organization_id FK
        date period_start
        date period_end
        string status
        timestamp processed_at
        timestamp created_at
        timestamp updated_at
    }

    PAYROLL_ENTRIES {
        uuid id PK
        uuid payroll_period_id FK
        uuid membership_id FK
        bigint approved_seconds
        decimal hourly_rate
        decimal gross_amount
        decimal adjustments
        decimal net_amount
        string currency
        timestamp created_at
    }


    %% =========================================================
    %% SUBSCRIPTIONS / FEATURE ENTITLEMENTS
    %% =========================================================

    PLANS {
        uuid id PK
        string name
        string slug UK
        string description
        string billing_interval
        decimal price
        string currency
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    FEATURES {
        uuid id PK
        string code UK
        string name
        string description
        string type
        timestamp created_at
        timestamp updated_at
    }

    PLAN_FEATURES {
        uuid plan_id FK
        uuid feature_id FK
        boolean enabled
        string limit_value
        string limit_unit
    }

    SUBSCRIPTIONS {
        uuid id PK
        uuid organization_id FK
        uuid plan_id FK
        string status
        string provider
        string provider_subscription_id
        timestamp trial_ends_at
        timestamp current_period_start
        timestamp current_period_end
        timestamp canceled_at
        timestamp created_at
        timestamp updated_at
    }


    %% =========================================================
    %% PREMIUM OFFICE / REMOTE
    %% =========================================================

    OFFICE_LOCATIONS {
        uuid id PK
        uuid organization_id FK
        string name
        string timezone
        string status
        timestamp created_at
        timestamp updated_at
    }

    OFFICE_NETWORKS {
        uuid id PK
        uuid office_location_id FK
        string type
        string value
        string description
        timestamp created_at
    }

    CONNECTIVITY_EVENTS {
        uuid id PK
        uuid organization_id FK
        uuid device_id FK
        timestamp occurred_at
        string status
        integer latency_ms
        timestamp created_at
    }


    %% =========================================================
    %% NOTIFICATIONS
    %% =========================================================

    NOTIFICATIONS {
        uuid id PK
        uuid organization_id FK
        uuid recipient_membership_id FK
        string type
        string title
        jsonb data
        timestamp read_at
        timestamp created_at
    }

    NOTIFICATION_PREFERENCES {
        uuid id PK
        uuid membership_id FK
        string notification_type
        boolean email_enabled
        boolean in_app_enabled
        boolean push_enabled
        timestamp created_at
        timestamp updated_at
    }


    %% =========================================================
    %% AUDIT / RETENTION
    %% =========================================================

    AUDIT_LOGS {
        uuid id PK
        uuid organization_id FK
        uuid actor_membership_id FK
        string action
        string entity_type
        uuid entity_id
        jsonb old_values
        jsonb new_values
        string ip_address
        string user_agent
        timestamp created_at
    }

    RETENTION_POLICIES {
        uuid id PK
        uuid organization_id FK
        string data_type
        integer retention_days
        timestamp created_at
        timestamp updated_at
    }


    %% =========================================================
    %% RELATIONSHIPS
    %% =========================================================

    USERS ||--o{ ORGANIZATION_MEMBERSHIPS : belongs_to
    ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERSHIPS : has

    ORGANIZATIONS ||--o{ ROLES : defines
    ROLES ||--o{ MEMBERSHIP_ROLES : assigned_to
    ORGANIZATION_MEMBERSHIPS ||--o{ MEMBERSHIP_ROLES : has

    ROLES ||--o{ ROLE_PERMISSIONS : grants
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : contains

    ORGANIZATIONS ||--o{ ORGANIZATION_INVITATIONS : sends
    ROLES ||--o{ ORGANIZATION_INVITATIONS : assigns
    USERS ||--o{ ORGANIZATION_INVITATIONS : creates

    ORGANIZATIONS ||--o{ TEAMS : contains
    TEAMS ||--o{ TEAM_MEMBERS : has
    ORGANIZATION_MEMBERSHIPS ||--o{ TEAM_MEMBERS : belongs_to

    ORGANIZATIONS ||--o{ PROJECTS : contains
    PROJECTS ||--o{ PROJECT_MEMBERS : has
    ORGANIZATION_MEMBERSHIPS ||--o{ PROJECT_MEMBERS : assigned_to

    PROJECTS ||--o{ TASKS : contains
    ORGANIZATIONS ||--o{ TASKS : owns
    TASKS ||--o{ TASK_ASSIGNEES : has
    ORGANIZATION_MEMBERSHIPS ||--o{ TASK_ASSIGNEES : assigned_to

    ORGANIZATIONS ||--o{ DEVICES : owns
    ORGANIZATION_MEMBERSHIPS ||--o{ DEVICES : uses

    DEVICES ||--o{ TRACKING_SESSIONS : runs
    ORGANIZATION_MEMBERSHIPS ||--o{ TRACKING_SESSIONS : creates
    PROJECTS ||--o{ TRACKING_SESSIONS : tracks
    TASKS ||--o{ TRACKING_SESSIONS : tracks

    TRACKING_SESSIONS ||--o{ TRACKING_EVENTS : contains
    TRACKING_SESSIONS ||--o{ TIME_ENTRIES : produces
    TRACKING_SESSIONS ||--o{ IDLE_PERIODS : contains
    TRACKING_SESSIONS ||--o{ ACTIVITY_EVENTS : contains
    TRACKING_SESSIONS ||--o{ APPLICATION_USAGE : contains
    TRACKING_SESSIONS ||--o{ WEBSITE_USAGE : contains
    TRACKING_SESSIONS ||--o{ SCREENSHOTS : captures
    TRACKING_SESSIONS ||--o{ RECORDINGS : records
    TRACKING_SESSIONS ||--o{ BREAKS : contains

    ORGANIZATION_MEMBERSHIPS ||--o{ TRACKING_EVENTS : generates
    ORGANIZATION_MEMBERSHIPS ||--o{ TIME_ENTRIES : owns
    ORGANIZATION_MEMBERSHIPS ||--o{ IDLE_PERIODS : has
    ORGANIZATION_MEMBERSHIPS ||--o{ ACTIVITY_EVENTS : generates
    ORGANIZATION_MEMBERSHIPS ||--o{ APPLICATION_USAGE : generates
    ORGANIZATION_MEMBERSHIPS ||--o{ WEBSITE_USAGE : generates
    ORGANIZATION_MEMBERSHIPS ||--o{ SCREENSHOTS : owns
    ORGANIZATION_MEMBERSHIPS ||--o{ RECORDINGS : owns

    PROJECTS ||--o{ TIME_ENTRIES : contains
    TASKS ||--o{ TIME_ENTRIES : contains

    ORGANIZATIONS ||--o{ PRODUCTIVITY_RULES : defines

    RECORDINGS ||--o{ RECORDING_SEGMENTS : contains

    ORGANIZATIONS ||--o{ SCHEDULES : defines
    SCHEDULES ||--o{ SCHEDULE_SHIFTS : contains
    ORGANIZATION_MEMBERSHIPS ||--o{ MEMBERSHIP_SCHEDULES : assigned
    SCHEDULES ||--o{ MEMBERSHIP_SCHEDULES : assigned_to

    ORGANIZATION_MEMBERSHIPS ||--o{ ATTENDANCE_RECORDS : has
    ORGANIZATION_MEMBERSHIPS ||--o{ BREAKS : takes

    ORGANIZATIONS ||--o{ LEAVE_TYPES : defines
    LEAVE_TYPES ||--o{ LEAVE_REQUESTS : used_by
    ORGANIZATION_MEMBERSHIPS ||--o{ LEAVE_REQUESTS : requests

    ORGANIZATION_MEMBERSHIPS ||--o{ TIMESHEETS : owns
    TIMESHEETS ||--o{ TIMESHEET_ENTRIES : contains
    TIME_ENTRIES ||--o{ TIMESHEET_ENTRIES : included_in
    TIMESHEETS ||--o{ TIMESHEET_APPROVALS : reviewed
    ORGANIZATION_MEMBERSHIPS ||--o{ TIMESHEET_APPROVALS : reviews

    ORGANIZATION_MEMBERSHIPS ||--o{ PAY_RATES : has
    ORGANIZATIONS ||--o{ PAYROLL_PERIODS : owns
    PAYROLL_PERIODS ||--o{ PAYROLL_ENTRIES : contains
    ORGANIZATION_MEMBERSHIPS ||--o{ PAYROLL_ENTRIES : paid_to

    PLANS ||--o{ PLAN_FEATURES : provides
    FEATURES ||--o{ PLAN_FEATURES : included_in
    ORGANIZATIONS ||--o{ SUBSCRIPTIONS : subscribes
    PLANS ||--o{ SUBSCRIPTIONS : selected

    ORGANIZATIONS ||--o{ OFFICE_LOCATIONS : owns
    OFFICE_LOCATIONS ||--o{ OFFICE_NETWORKS : contains
    DEVICES ||--o{ CONNECTIVITY_EVENTS : reports

    ORGANIZATION_MEMBERSHIPS ||--o{ NOTIFICATIONS : receives
    ORGANIZATION_MEMBERSHIPS ||--o{ NOTIFICATION_PREFERENCES : configures

    ORGANIZATIONS ||--o{ AUDIT_LOGS : records
    ORGANIZATION_MEMBERSHIPS ||--o{ AUDIT_LOGS : performs

    ORGANIZATIONS ||--o{ RETENTION_POLICIES : defines
```

---

# 2. One correction I would make to our earlier model

There is one important refinement in this full ERD.

Previously, we discussed:

```text
users → organization_memberships → organizations
```

I strongly recommend keeping that.

That means:

```text
USER
 │
 ├──── Membership ──── Organization A
 │                       └── Employee
 │
 └──── Membership ──── Organization B
                         └── Manager
```

This is the correct foundation for our multi-tenant SaaS.

The **membership**, rather than the global user, is what should carry the organization's role, teams, permissions and organization-specific settings.

That distinction will become extremely important in the Laravel authorization layer.

---

# 3. How the actual data flows through the ERD

The most important chain in Team Time Track is this:

```text
User
 ↓
Organization Membership
 ↓
Device
 ↓
Tracking Session
 ↓
Tracking Events
 ↓
Time Entries
 ↓
Timesheet
 ↓
Approval
 ↓
Payroll
 ↓
Reports
```

And monitoring attaches to the tracking session:

```text
                     Tracking Session
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
     Screenshots         Activity       App/Website
          │                 │                 │
          └─────────────────┴─────────────────┘
                            │
                            ▼
                         Reports
```

Premium recording attaches to that same session:

```text
Tracking Session
      │
      ▼
 Recording
      │
      ├── Segment 1 → R2
      ├── Segment 2 → R2
      ├── Segment 3 → R2
      └── Segment 4 → R2
```

This is a very clean model.

---

# 4. What lives in PostgreSQL vs R2

The ERD deliberately contains **metadata**, not binary files.

### PostgreSQL

```text
screenshots
├── id
├── organization_id
├── membership_id
├── captured_at
├── storage_key
└── metadata
```

### Cloudflare R2

```text
organizations/
    screenshots/
        2026/
            08/
                25/
                    screenshot-uuid.jpg
```

Similarly:

```text
recordings
recording_segments
```

contain metadata and R2 keys, while the actual video remains in R2.

This is particularly important because the Premium video feature can generate a **very large volume of data**.

---

# 5. Tenant boundaries

This ERD deliberately puts `organization_id` on most high-value business entities.

For example:

```text
time_entries.organization_id
screenshots.organization_id
recordings.organization_id
attendance_records.organization_id
timesheets.organization_id
payroll_periods.organization_id
audit_logs.organization_id
```

So we can enforce:

> **No organization can ever access another organization's business data.**

For example, when Hasan is working for Organization A:

```text
Hasan
 ↓
Membership A
 ↓
Organization A
 ↓
Tracking Session A
 ↓
Time Entry A
```

When he switches to Organization B:

```text
Hasan
 ↓
Membership B
 ↓
Organization B
 ↓
Tracking Session B
 ↓
Time Entry B
```

The global `users.id` remains the same.

---

# 6. One thing intentionally missing: reports tables

You may notice that there aren't tables such as:

```text
hours_reports
timeline_reports
attendance_reports
```

That's intentional.

A **report is generally a query/view of domain data**, not necessarily a domain entity.

Initially:

```text
Time Entries
Activity
Screenshots
Attendance
Projects
Teams
       ↓
Laravel reporting queries
       ↓
Next.js report
```

As we scale, we can introduce aggregate tables such as:

```text
daily_user_statistics
daily_team_statistics
daily_project_statistics
```

but I would not add those to the foundational ERD until we have a demonstrated performance requirement.

---

# 7. Redis, Laravel queues and R2 aren't in the ERD

Also intentionally excluded:

```text
Redis
Laravel Queue
Supervisor
Nginx
Next.js
Electron
Cloudflare
R2
```

Those belong to the **System Architecture Diagram**.

The ERD answers:

> **"How is Team Time Track's persistent business data related?"**

The system architecture answers:

> **"How do the applications and infrastructure communicate?"**

We'll maintain both.

---

# 8. Recommended project documentation structure

I recommend that Team Time Track eventually have:

```text
docs/
│
├── requirements/
│   └── product-requirements.md
│
├── architecture/
│   ├── system-architecture.md
│   ├── domain-model.md
│   ├── database-design.md
│   └── erd.md
│
├── api/
│   └── api-specification.md
│
├── desktop/
│   └── electron-architecture.md
│
├── security/
│   └── security-architecture.md
│
└── deployment/
    └── production-deployment.md
```

And:

```text
docs/architecture/erd.md
```

would contain the Mermaid source above.

That makes the ERD **version-controlled architecture**, rather than a diagram that gets forgotten after six months.

---

# 9. Are we ready for physical database design?

**Almost, but I would make one more pass before writing migrations.**

The next stage should be:

### Physical PostgreSQL Schema

For **every table**, we'll define:

```text
Table
├── Column
│   ├── PostgreSQL type
│   ├── nullable?
│   ├── default?
│   └── description
│
├── Primary key
├── Foreign keys
├── Unique constraints
├── Check constraints
├── Indexes
├── Delete behavior
└── Update behavior
```

For example, instead of merely saying:

```text
time_entries
├── organization_id
├── membership_id
└── duration_seconds
```

we'll decide:

```text
time_entries.organization_id
    UUID NOT NULL
    FK → organizations.id
    ON DELETE RESTRICT

time_entries.membership_id
    UUID NOT NULL
    FK → organization_memberships.id
    ON DELETE RESTRICT

time_entries.duration_seconds
    BIGINT NOT NULL
    CHECK (duration_seconds > 0)
```

We'll also settle the **UUID strategy, enum strategy, indexing strategy, high-volume event tables, partitioning readiness, soft deletion, and Laravel migration order**.

That physical schema will be the point where our ERD becomes the **actual blueprint for Team Time Track's PostgreSQL database**.