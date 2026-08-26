Let's continue with **migrations 19–23: the high-volume monitoring and media layer**.

This part deserves extra care because these tables can grow much faster than ordinary SaaS tables.

# Team Time Track — Database Migrations, Part 2

## 19. `activity_events`

This table records periods of keyboard/mouse activity during a tracking session.

```php
Schema::create('activity_events', function (Blueprint $table) {
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
    $table->timestampTz('ended_at');

    $table->unsignedInteger('keyboard_activity')->default(0);
    $table->unsignedInteger('mouse_activity')->default(0);

    $table->unsignedSmallInteger('activity_percentage');

    $table->timestampTz('created_at');

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

### Why store activity as an event?

Suppose the desktop application reports activity every minute:

```text
09:00 → 72%
09:01 → 85%
09:02 → 91%
09:03 → 63%
```

We can later aggregate this into:

```text
9:00–10:00
Activity: 77.8%
```

without losing the original data.

---

# 20. `application_usage`

This records which desktop applications were used.

```php
Schema::create('application_usage', function (Blueprint $table) {
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

    $table->string('application_name', 255);
    $table->string('process_name', 255)->nullable();

    $table->timestampTz('started_at');
    $table->timestampTz('ended_at');

    $table->unsignedBigInteger('duration_seconds');

    $table->timestampTz('created_at');

    $table->index([
        'organization_id',
        'membership_id',
        'started_at',
    ]);

    $table->index([
        'tracking_session_id',
        'started_at',
    ]);

    $table->index([
        'organization_id',
        'application_name',
    ]);
});
```

Example data:

```text
Hasan
 ├── VS Code       2h 31m
 ├── Chrome        1h 42m
 ├── Slack           37m
 └── Terminal        21m
```

---

# 21. `website_usage`

Similar to application usage, but for websites.

```php
Schema::create('website_usage', function (Blueprint $table) {
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

    $table->string('domain', 255);
    $table->string('path', 1000)->nullable();

    $table->timestampTz('started_at');
    $table->timestampTz('ended_at');

    $table->unsignedBigInteger('duration_seconds');

    $table->timestampTz('created_at');

    $table->index([
        'organization_id',
        'membership_id',
        'started_at',
    ]);

    $table->index([
        'tracking_session_id',
        'started_at',
    ]);

    $table->index([
        'organization_id',
        'domain',
    ]);
});
```

For reporting, we'll generally classify websites by **domain**, not every individual URL.

For example:

```text
github.com
youtube.com
google.com
slack.com
```

rather than creating millions of unique URL records.

---

# 22. `productivity_rules`

This table determines whether applications/websites are productive, unproductive, or neutral.

```php
Schema::create('productivity_rules', function (Blueprint $table) {
    $table->uuid('id')->primary();

    $table->foreignUuid('organization_id')
        ->constrained()
        ->restrictOnDelete();

    $table->string('target_type', 30);
    $table->string('target', 500);

    $table->string('classification', 30);

    $table->foreignUuid('created_by')
        ->constrained('users')
        ->restrictOnDelete();

    $table->timestampsTz();

    $table->index([
        'organization_id',
        'target_type',
    ]);

    $table->unique([
        'organization_id',
        'target_type',
        'target',
    ]);
});
```

Example:

```text
organization_id | target_type | target       | classification
----------------------------------------------------------------
ABC             | website     | github.com   | productive
ABC             | website     | youtube.com  | unproductive
ABC             | application | slack        | productive
```

### Why `organization_id`?

Because productivity is organization-specific.

One company might consider:

```text
youtube.com = unproductive
```

while another might legitimately use YouTube for work.

---

# 23. `screenshots`

Now we reach our first major media table.

The actual screenshot is **not stored in PostgreSQL**.

PostgreSQL stores metadata:

```text
Screenshot
   │
   ├── metadata → PostgreSQL
   │
   └── image → Cloudflare R2
```

Migration:

```php
Schema::create('screenshots', function (Blueprint $table) {
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

    $table->foreignUuid('project_id')
        ->nullable()
        ->constrained()
        ->restrictOnDelete();

    $table->foreignUuid('task_id')
        ->nullable()
        ->constrained()
        ->restrictOnDelete();

    $table->timestampTz('captured_at');

    $table->string('storage_key', 1000);

    $table->string('mime_type', 100);

    $table->unsignedBigInteger('file_size');

    $table->unsignedInteger('width')->nullable();
    $table->unsignedInteger('height')->nullable();

    $table->string('status', 30)
        ->default('available');

    $table->timestampTz('created_at');

    $table->index([
        'organization_id',
        'membership_id',
        'captured_at',
    ]);

    $table->index([
        'organization_id',
        'project_id',
        'captured_at',
    ]);

    $table->index([
        'tracking_session_id',
        'captured_at',
    ]);
});
```

---

# 24. R2 storage structure

I recommend that we don't put random files directly at the bucket root.

Use a predictable tenant-aware structure:

```text
team-time-track/
│
└── organizations/
    └── {organization_id}/
        ├── screenshots/
        │   └── 2026/
        │       └── 08/
        │           └── 25/
        │               └── {screenshot_id}.jpg
        │
        └── recordings/
            └── 2026/
                └── 08/
                    └── 25/
                        └── {recording_id}/
                            ├── 000001.mp4
                            ├── 000002.mp4
                            └── 000003.mp4
```

The database only needs:

```text
storage_key
```

For example:

```text
organizations/abc-uuid/screenshots/2026/08/25/uuid.jpg
```

---

# 25. Why we shouldn't store the R2 URL

Don't store:

```text
https://xxxxx.r2.cloudflarestorage.com/...
```

in the database.

Store:

```text
storage_key
```

instead.

Then Laravel generates a temporary signed URL when the user requests the image.

That gives us flexibility to change:

- R2 bucket
- custom domain
- CDN
- storage provider

without rewriting database records.

---

# 26. `recordings`

Now the Premium video recording feature.

The PDF specifies **Video Screen Recording** as a Premium feature. 

We should treat a recording as a logical recording session rather than a single enormous file.

```php
Schema::create('recordings', function (Blueprint $table) {
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

    $table->string('status', 30)
        ->default('processing');

    $table->unsignedBigInteger('total_size')
        ->default(0);

    $table->string('resolution', 30)->nullable();
    $table->unsignedSmallInteger('frame_rate')->nullable();
    $table->string('codec', 30)->nullable();

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

# 27. Why recordings need segments

We should **not** do:

```text
Recording
    ↓
one 4 GB file
```

Instead:

```text
Recording
    │
    ├── Segment 1
    ├── Segment 2
    ├── Segment 3
    ├── Segment 4
    └── ...
```

This is much safer for the Electron application.

If the computer crashes after 37 minutes, we don't lose the entire recording.

---

# 28. `recording_segments`

```php
Schema::create('recording_segments', function (Blueprint $table) {
    $table->uuid('id')->primary();

    $table->foreignUuid('recording_id')
        ->constrained()
        ->cascadeOnDelete();

    $table->unsignedInteger('sequence');

    $table->string('storage_key', 1000);

    $table->unsignedBigInteger('duration_seconds');

    $table->unsignedBigInteger('file_size');

    $table->string('checksum', 128)->nullable();

    $table->string('status', 30)
        ->default('uploaded');

    $table->timestampTz('created_at');

    $table->unique([
        'recording_id',
        'sequence',
    ]);
});
```

This gives us:

```text
recordings
    │
    ├── segment 1 → R2
    ├── segment 2 → R2
    ├── segment 3 → R2
    └── segment 4 → R2
```

---

# 29. Very important: retention

We already know from the product requirements that retention differs by plan:

```text
Basic     → 3 months
Standard  → 6 months
Premium   → 2 years
```

So screenshot and recording deletion should **not** simply happen when a user clicks delete.

Instead, we'll eventually have a retention workflow:

```text
Retention Policy
       ↓
Scheduled Cleanup Job
       ↓
Find expired records
       ↓
Delete R2 object
       ↓
Delete PostgreSQL metadata
```

This should be performed asynchronously through Laravel queues.

---

# 30. Don't delete the database row first

For media, use:

```text
Database
    ↓
mark as deleting
    ↓
Queue job
    ↓
delete R2 object
    ↓
delete/mark metadata
```

rather than:

```text
DELETE database row
      ↓
try deleting R2
```

Otherwise a failed R2 request could leave an orphaned file that we no longer know about.

---

# 31. High-volume table strategy

At this point our database has two distinct classes of tables.

### Normal transactional tables

```text
users
organizations
projects
tasks
teams
subscriptions
plans
timesheets
payroll
```

These remain ordinary PostgreSQL tables.

### High-volume event tables

```text
tracking_events
activity_events
application_usage
website_usage
screenshots
recordings
connectivity_events
audit_logs
```

These require:

- Time-based indexes
- Retention
- Batch inserts
- Queue processing where appropriate
- Potential partitioning
- Careful pagination

---

# 32. Do we partition them immediately?

**No.**

For Team Time Track MVP, I would initially use ordinary PostgreSQL tables with proper indexes.

Then monitor:

```text
rows/day
storage/day
query latency
index size
vacuum behavior
```

If `tracking_events` eventually reaches tens/hundreds of millions of rows, we can introduce monthly partitions:

```text
tracking_events
├── 2026_08
├── 2026_09
├── 2026_10
└── ...
```

The application shouldn't need to know about those partitions.

This avoids prematurely complicating the MVP.

---

# 33. Current migration sequence

We're now here:

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
16  Tracking Sessions              ✅
17  Tracking Events                ✅
18  Time Entries                   ✅

19  Activity Events               ← done
20  Application Usage             ← done
21  Website Usage                 ← done
22  Productivity Rules            ← done
23  Screenshots                   ← done
24  Recordings                    ← done
25  Recording Segments            ← done

26  Schedules                     ← next
27  Schedule Shifts
28  Membership Schedules
29  Attendance
30  Breaks
31  Leave Types
32  Leave Requests
33  Timesheets
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

So the **monitoring/media layer is now designed**.

The next logical layer is **Schedules → Attendance → Breaks → Leave → Timesheets**, because those tables form the workforce-management side of Team Time Track and eventually feed the payroll subsystem.