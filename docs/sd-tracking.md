# Tracking, Synchronisation & Derivation

The event protocol, the offline guarantee, and the pipeline that turns device observations into payable time. This is the part of the system whose failure modes cost people money.

---

## 1. The chain

```text
Device observation
      ↓  immutable, client-identified
Tracking Event
      ↓  ordered by occurred_at, grouped by session
Tracking Session
      ↓  server-side derivation, idempotent, re-runnable
Time Entry
      ↓  snapshotted at submission
Timesheet
      ↓  reviewed, append-only history
Approval
      ↓  rounded once, at period scope
Payroll Entry
```

Two rules hold the chain together:

1. **Events are facts and are never modified.** Corrections change Time Entries and leave the evidence intact. [`BR-TIME-001`](#/business-rules).
2. **Derivation is a pure function of events.** Re-running it over unchanged events produces byte-identical output. This is what makes late-arriving events safe.

---

## 2. Event model

### Identity

Every event carries three identifiers generated **on the device**:

| Field | Purpose |
|---|---|
| `client_event_id` (UUIDv7) | Idempotency key. Generated once, immutable in the local store |
| `session_id` (UUIDv7) | Generated when the session starts, so a session can begin with no network |
| `device_seq` (BIGINT) | Monotonic per device. Detects loss, never used for ordering |

**The client generating `session_id` is load-bearing.** It means a session started offline needs no server round-trip, and any event can materialise its session on arrival — including when the `session_started` event is the one that got delayed.

### Vocabulary

| Event | Payload |
|---|---|
| `session_started` | project_id, task_id, start_mode, timezone, device_displays snapshot |
| `session_paused` / `session_resumed` | — |
| `session_stopped` | reason |
| `project_changed` / `task_changed` | project_id, task_id |
| `idle_started` / `idle_ended` | detected_at (last input), threshold_seconds |
| `idle_resolved` | idle_client_id, resolution: `kept` \| `discarded` \| `reclassified_break` |
| `break_started` / `break_ended` | break_type |
| `capture_paused` / `capture_resumed` | reason, auto_resumed |
| `activity_sample` | interval bounds, keyboard_events, mouse_events, activity_percentage |
| `application_focus` | application_name, process_name, interval bounds |
| `website_focus` | domain, path (only if enabled), interval bounds |
| `screenshot_captured` | capture_group_id, device_display_id, storage_key, dimensions, size |
| `recording_segment` | recording_stream_id, sequence, offset_ms, storage_key, size, checksum |
| `display_configuration` | full `device_displays` snapshot |
| `connectivity` | status, latency_ms, public_ip |
| `heartbeat` | pending_event_count, app_version, capture_capabilities |

### Time fields

| Field | Source | Used for |
|---|---|---|
| `occurred_at` | Device clock | **Ordering and derivation.** The only clock that knows when offline work happened |
| `received_at` | Server clock | Diagnostics, sync latency, audit |
| `clock_skew_seconds` | Computed | Flagging, never correction |

[`BR-TIME-008`](#/business-rules): both are recorded, the device clock is authoritative for derivation, and implausible skew is flagged rather than silently adjusted. A device more than 24 hours out of step has its session flagged for review and the member is warned; events are still accepted, because refusing them would destroy real work.

---

## 3. Synchronisation protocol

### Batch envelope

```http
POST /api/v1/tracking/batches
Authorization: Bearer ttt_dev_…
Content-Type: application/json
```

```json
{
  "client_batch_id": "018f9c2a-…",
  "device_seq_from": 88214,
  "device_seq_to":   88377,
  "pending_after":   412,
  "events": [
    {
      "client_event_id": "018f9c2b-…",
      "session_id":      "018f9b10-…",
      "device_seq":      88214,
      "event_type":      "activity_sample",
      "occurred_at":     "2026-08-27T09:14:00.000Z",
      "payload":         { "keyboard_events": 412, "mouse_events": 233, "activity_percentage": 68 }
    }
  ]
}
```

| Constraint | Value |
|---|---|
| Maximum events per batch | 500 |
| Maximum body size | 2 MB |
| Ordering | Ascending `device_seq`; the server does not require it but the client sends it |
| Acceptance | **Whole batch or nothing** — no partial acceptance |

### Server processing

```text
1  verify device token, resolve membership + organization, set tenant GUC
2  look up sync_batches by (device_id, client_batch_id)
       ├── found & accepted → return the stored acknowledgement (idempotent replay)
       └── not found → continue
3  BEGIN
4    validate every event structurally; any failure → reject the whole batch
5    materialise unknown sessions from their events
6    INSERT … ON CONFLICT (organization_id, client_event_id, occurred_at) DO NOTHING
7    count accepted vs duplicate
8    project payload rows: activity_events, application_usage, website_usage,
       screenshots, recording_segments, capture_pauses, connectivity_events
9    advance tracking_sessions.last_event_seq
10   write sync_batches row
11 COMMIT
12 dispatch DeriveSession jobs (afterCommit, debounced per session)
13 respond 202 with accepted / duplicate counts and the server clock
```

### Response

```json
{
  "batch_id": "018f9c2a-…",
  "accepted": 160,
  "duplicates": 3,
  "server_time": "2026-08-27T09:15:02.118Z",
  "next_poll_seconds": 30
}
```

`server_time` lets the tracker measure its own clock skew and warn the member.

### Failure handling

| Condition | Server | Tracker |
|---|---|---|
| Network failure | — | Retry with backoff; nothing removed from the local store |
| `202` received | Batch recorded | Delete the acknowledged range from the local store |
| `409` duplicate batch | Returns the original acknowledgement | Treat as success |
| `422` malformed | Records `status='quarantined'` with a rejection code | **Quarantine locally, do not discard**; report to the member; surface in platform health |
| `429` rate limited | — | Honour `Retry-After`; halve the batch size |
| `5xx` | — | Backoff; alert after the threshold |

Nothing is ever deleted from the local store without an explicit acknowledgement. [`BR-SYNC-003`](#/business-rules).

### Backoff schedule

`5s → 15s → 45s → 2m → 5m → 15m`, capped at 15 minutes, with ±20% jitter so 2,000 devices returning from a shared outage do not arrive together.

### Ordering and gaps

`device_seq` is contiguous per device. A gap that persists past three batches raises a diagnostic — it means the local store lost rows, which is a defect worth knowing about. Ordering for derivation is always by `occurred_at`; `device_seq` only detects loss.

---

## 4. Local store `ADR-024`

SQLite in WAL mode, in the Electron user-data directory, encrypted with a key held in the OS keystore.

```text
events(client_event_id PK, session_id, device_seq, event_type,
       occurred_at, payload, state, batch_id, created_at)
       state ∈ pending | in_flight | acked | quarantined

batches(client_batch_id PK, seq_from, seq_to, sent_at, acked_at, attempts, last_error)

media_queue(id PK, kind, storage_key, local_path, bytes, sha256,
            state, attempts, created_at)
       kind ∈ screenshot | recording_segment

meta(key PK, value)         device_seq counter, last policy version, clock offset
```

| Property | Value |
|---|---|
| Endurance | ≥ 72 hours of continuous tracking — [`NFR-REL-002`](#/non-functional-requirements) |
| Soft cap | 2 GB, or 20% of free disk, whichever is lower |
| Pressure order | Drop oldest **media** first, after warning the member. **Never drop events** — [`BR-SYNC-003`](#/business-rules) |
| Retention after ack | Events pruned immediately; batch rows kept 7 days for diagnostics |
| Survives | Application restart, machine restart, tracker update |

A screenshot lost to disk pressure is an evidence gap. An event lost to disk pressure is unpaid work. The asymmetry is deliberate and is why the pressure order is fixed rather than configurable.

---

## 5. Session lifecycle

### Start

```text
member selects project [+ task] → Start
   ↓ generate session_id (UUIDv7)
   ↓ write session_started to the local store
   ↓ begin capture per the effective monitoring policy
   ↓ queue for transmission
```

If another session is live on a different device, the server closes the older one on arrival and notifies the member. [`BR-TIME-002`](#/business-rules), enforced by the partial unique index in [Domain & Database Design](#/sd-data-model) §8.

### Automatic start `DEC-006` `DEC-030`

All conditions must hold:

```text
organization tracking_mode = automatic
  AND organization holds the schedules entitlement
  AND the member has an effective schedule
  AND now is inside the member's shift, in the schedule's timezone
  AND input activity observed
  AND no manual stop has occurred during this shift
        ↓
session starts with start_mode = 'automatic'
        ↓
tracker shows an unmistakable automatic-start indicator
```

**After a manual stop, automatic tracking does not resume for the remainder of that shift.** It becomes eligible again at the next scheduled shift. `DEC-030` chose this over a timed cooldown, and it is the right call: a timer produces exactly the behaviour the decision set out to avoid — a member who stopped tracking to do something private being silently re-tracked twenty minutes later. Manual start remains available at any time.

The tracker persists `manual_stop_shift_key` (schedule id + shift date) in `meta`, so the suppression survives a restart.

### Close

| Trigger | `closed_reason` |
|---|---|
| Member stops | `stopped` |
| Exceeds `max_session_seconds` | `auto_max_duration` — flagged for confirmation, [`BR-TIME-007`](#/business-rules) |
| Crash or power loss, detected on next launch | `crash_recovered` — closed at the **last recorded event time**, never at restart time |
| Membership suspended or device revoked | `membership_suspended` |
| Shift ends in automatic mode | `stopped` |

Crash recovery never claims the interval between the last event and the restart. [`REQ-DEV-005`](#/functional-requirements).

---

## 6. Derivation

### Trigger and concurrency

`DeriveSession` is dispatched after every batch commit, **debounced 10 seconds per session** so a burst of batches produces one derivation. The job takes a PostgreSQL advisory lock on the session id, so two workers never derive the same session concurrently:

```sql
SELECT pg_advisory_xact_lock(hashtextextended(:session_id::text, 0));
```

Derivation is idempotent. Re-running it produces the same rows; it is safe to run at any time, and a nightly reconciliation does exactly that for sessions touched in the last 48 hours.

### Algorithm

```text
input   all events for the session, ordered by (occurred_at, device_seq)
output  the complete set of time_entries for that session

1  build the session interval
     from session_started.occurred_at
     to   session_stopped.occurred_at, or the last event, or now if still active

2  build a subtraction set
     paused        [session_paused → session_resumed)
     break         [break_started  → break_ended)
     idle-discarded [idle_started  → idle_ended)  where resolution = discarded
     (idle resolved as kept remains work; reclassified becomes a break record)

3  build an attribution set
     [session start | project_changed | task_changed → next change or session end)

4  intersect: for each attribution segment, subtract the subtraction set
     → candidate work intervals

5  drop intervals shorter than minimum_interval_seconds

6  reconcile with existing rows for this session
     match on (started_at, ended_at, project_id, task_id)
     unchanged → leave alone
     new       → insert with source='tracked'
     stale     → delete, unless it belongs to a submitted or approved timesheet

7  emit TimeEntriesDerived(session, affected_dates)
```

### Late-arriving events

Step 6 is what makes late events safe. An event arriving hours after its session was first derived simply changes the candidate set and the reconciliation applies the difference.

The one thing it must not do is alter an approved figure. Entries already inside a submitted or approved timesheet are **not modified**; instead the discrepancy is recorded and surfaced:

```text
late event changes a derived interval
        ↓
entry belongs to an approved timesheet?
        ├── no  → apply the change
        └── yes → leave the entry, write a derivation_discrepancy notice,
                  notify the approver, surface on the timesheet
```

[`BR-TS-004`](#/business-rules) protects the snapshot; this is the mechanism that makes protection visible rather than silent.

### Manual entries

Manual entries are created directly, never derived, and always carry an actor and a reason. [`BR-TIME-005`](#/business-rules). The overlap exclusion constraint means a manual entry colliding with tracked time is rejected by the database, with the conflicting entry returned to the caller. [`BR-TIME-004`](#/business-rules).

---

## 7. Idle handling

```text
no keyboard or mouse input for idle_threshold_seconds
        ↓
idle_started, occurred_at = the LAST OBSERVED INPUT
        ↓                     not the moment the threshold expired
input returns → idle_ended
        ↓
tracker prompts the member
        ↓
   ┌────────────┬──────────────┬────────────────────┐
   ▼            ▼              ▼                    ▼
 Keep        Discard      Reclassify as break    No response
   │            │              │                    │
work time   subtracted    break record         organization default,
retained    from work     created              recorded as unresolved
```

Backdating `idle_started` to the last observed input is essential: a five-minute threshold must not silently convert five minutes of genuine idleness into work.

Sleep, lock and hibernate are treated as idle. On wake the tracker reconciles the gap from `powerMonitor` and prompts identically.

An idle period resolved as a break creates a **Break record**; the Idle Period row is retained with `resolution='reclassified'`. The two never merge. [`BR-TIME-006`](#/business-rules) — one is what the system observed, the other is what the member said, and in a dispute those carry different weight.

---

## 8. Attendance derivation

Triggered by `TimeEntriesDerived`, `LeaveDecided`, schedule assignment changes and holiday changes. Idempotent, keyed on `(organization_id, membership_id, date)`.

```text
for each affected (membership, date):

  1  resolve the effective schedule for that date        (dated assignment)
  2  resolve the shift for that weekday
        no shift            → status rest_day, scheduled 0
        holiday applies     → status holiday,  scheduled 0
  3  compute the shift window in the SCHEDULE's timezone
        end_time <= start_time → window crosses midnight
        attribute to the shift's START date
  4  sum time_entries intersecting the window
  5  sum breaks, idle, capture-pause gaps in the window
  6  first_activity_at / last_activity_at from the entries
  7  late_seconds       = first_activity − shift_start, if positive beyond tolerance
     early_leave_seconds = shift_end − last_activity,   if positive
  8  approved leave covering the date → status on_leave, scheduled adjusted
  9  otherwise apply BR-ATT-003 precedence:
        holiday → rest_day → on_leave → absent → half_day → late → present
 10  UPSERT attendance_records
```

Attendance is derived, never entered. If it disagrees with its inputs, the inputs win and it is regenerated. [`BR-ATT-002`](#/business-rules).

`capture_gap_seconds` is populated here from `capture_pauses`, so a report can state *tracked 8h 10m, captured 7h 40m, capture paused 30m* — which `DEC-028` requires and a single worked-seconds figure cannot express.

---

## 9. Capture pause `DEC-028`

Distinct from every other pause in the system.

| | Tracking | Capture | Time counted |
|---|---|---|---|
| Session paused | stopped | stopped | no |
| Break | continues | stopped | no |
| Idle | continues | continues | depends on resolution |
| **Capture paused** | **continues** | **stopped** | **yes** |

```text
member pauses capture, selects a reason
      ↓ capture_paused event, capture_pauses row opened
      ↓ screenshots, activity, application, website and recording all stop
      ↓ time tracking continues; the timer keeps running
      ↓ after at most 30 minutes → automatic resume, auto_resumed = true
      ↓ capture_resumed event, row closed
```

The manager sees the interval and the reason category — never a free-text note beyond the recorded reason, and never any inference about what happened. `DEC-028`.

The 30-minute bound is enforced twice: the tracker resumes on its own timer, and the server rejects a `capture_resumed` more than 30 minutes after its `capture_paused`, closing the pause at the bound.

---

## 10. Evidence gap classification `REQ-MON-006`

Five distinct states. A gap is never rendered as an unexplained absence.

| State | Cause | Shown as |
|---|---|---|
| `not_configured` | The capture type is disabled for the organization | "Not captured" |
| `paused_by_member` | An open `capture_pauses` row — `DEC-028` | "Capture paused — personal" |
| `unavailable` | OS permission denied, `devices.capture_capabilities` | "Capture unavailable on this device" |
| `failed` | Capture or upload attempted and failed | "Capture failed" |
| `expired` | Past retention | "Expired under the 3-month retention policy" |

These mean entirely different things to a manager reviewing a week, and conflating them is how an evidence gap becomes an accusation.

---

## 11. Failure modes and responses

| Failure | Behaviour |
|---|---|
| Network unavailable | Capture continues; local queue grows; member sees the offline state and the unsynchronised amount |
| API down for hours | As above, up to the 72-hour endurance target |
| Tracker crash | Session closed at the last event on next launch; unsent events transmitted; member informed |
| Machine loses power | Identical to crash recovery |
| Local store corrupted | Unrecoverable range reported to the member **with the affected period stated explicitly**. Silent loss is not acceptable |
| Device clock wrong | Events accepted; skew recorded and flagged; member and reviewer warned |
| Duplicate batch after timeout | Original acknowledgement replayed; nothing created |
| Events for a session the server has not seen | Session materialised from the event |
| Backlog past threshold | Member and organization both alerted; visible in device inventory and platform health |
| Membership suspended mid-session | Session closed on next contact; already-captured events still accepted for 72 hours |

---

## 12. Verification

| Property | Test |
|---|---|
| Idempotency | Replay an identical batch 10 times → exactly one set of events and entries — `SC-03` |
| Order independence | Shuffle a session's events, derive, compare to in-order output — must be identical |
| Offline endurance | 8-hour offline session, reconnect, compare derived entries to local capture to the second — `SC-02` |
| No overlap | Property test generating overlapping manual and tracked entries; the database must reject every one |
| Late arrival | Deliver an event after approval; assert the approved total is unchanged and a discrepancy is raised |
| Crash recovery | Kill the tracker mid-session; assert the session closes at the last event, not at restart |
| Timezone matrix | Three timezones × DST both directions × an overnight shift |
| Clock skew | Device clock ±26 hours; assert acceptance, flagging and warning |
| Sync failure rate | Derived from `sync_batches`, exposed per organization and per device — `SC-11` |
