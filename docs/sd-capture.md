# Capture & Media Architecture

Screenshots and screen recording across up to four displays, how bytes reach storage, and how they are eventually destroyed. This subsystem carries the product's largest cost and its largest privacy exposure simultaneously.

---

## 1. Governing decisions

| Decision | Effect |
|---|---|
| `DEC-019` | Every connected display is captured **simultaneously**, one independent stream per physical display. No compositing |
| `DEC-025` | **Maximum 4 displays.** Screenshots at **native physical resolution**, no downscaling at MVP |
| `DEC-026` | Recording capped at **1920×1080 per display at 10 fps**. Recordings share the plan's `retention_months`; storage is accounted separately |
| `DEC-028` | Capture pauses are member-controlled, bounded at 30 minutes, reason-coded |
| `DEC-020` | Capture obeys the acknowledged monitoring policy version, not merely the current configuration |
| `DEC-031` | WebM source format; container and codec recorded, never assumed |

---

## 2. Display model

```text
Device
  └── device_displays          stable physical identity, ADR-010
        ├── screenshots        one row per display per capture instant
        └── recording_streams  one per display per recording
              └── recording_segments
```

### Identity, not ordinals

Display *index* is unusable as identity: unplugging one monitor renumbers the rest, and a member docking a laptop changes the set daily. `display_key` is derived from the most stable signal the platform offers:

| Preference | Source | Availability |
|---|---|---|
| 1 | EDID manufacturer + product code + serial | Windows (WMI), macOS (`CGDisplay`), Linux (X11 EDID) |
| 2 | Monitor device path / persistent OS identifier | Windows `DISPLAY_DEVICE`, macOS display UUID |
| 3 | Synthetic: `physical_resolution × scale × ordinal` hash | Fallback where 1 and 2 are unavailable |

The tracker emits a `display_configuration` event whenever the set changes — hot-plug, undock, resolution change, rotation. The server upserts `device_displays` on `(device_id, display_key)` and updates the mutable geometry fields.

### The four-display cap

```text
5 displays connected
   ↓ sort: primary first, then by bounds_x
   ↓ first 4  → is_captured = true
   ↓ 5th      → is_captured = false
   ↓ tracker notifies the member; condition appears in the device inventory
```

Silently ignoring the fifth display would produce an invisible evidence gap, so the condition is surfaced in both directions. `DEC-025`.

---

## 3. Screenshot capture

### Scheduling

```text
interval          = organization_settings.screenshot_settings.interval_seconds   (default 600)
minimum allowed   = 300                                                          (DEC-024)
randomisation     = capture at a uniform random point within each interval window
```

Randomisation is on by default. A predictable capture clock is trivially gamed, and a member who knows the schedule is being monitored differently from one who does not.

### Per-instant capture group

All displays are captured as close to simultaneously as the platform allows and share one `capture_group_id`:

```text
tick fires
  ├── Display 1 → JPEG @ 3840×2160
  ├── Display 2 → JPEG @ 2560×1440
  └── Display 3 → JPEG @ 1920×1080
        all three: capture_group_id = 018f9d… , captured_at = the same instant
```

The viewer uses `capture_group_id` to present *"all displays at 10:14"* as one moment. Without it a three-monitor member's gallery is three interleaved streams that no reviewer can align.

### Encoding

| Property | Value | Reason |
|---|---|---|
| Format | JPEG, quality 72 | Broad support; predictable size; no alpha needed |
| Resolution | Native physical pixels | `DEC-025` — downscaling permanently destroys detail |
| Colour | 4:2:0 subsampling | ~30% smaller with no readability loss for screen content |
| Metadata | Stripped | No EXIF, no device identifiers embedded in the image |

:::warning Native resolution is the dominant screenshot cost
A 4K JPEG at quality 72 is roughly 1.0–1.4 MB against 200–300 KB at 1080p. At 48 captures per display per day across two displays that is ~140 MB per member per day rather than ~30 MB. `DEC-025` accepted this trade for evidential fidelity. `storage_usage_daily` makes the consequence visible per organization from day one; if it proves unaffordable the lever is a configurable quality/resolution ceiling, which the schema already supports.
:::

### Capture guards

Before every capture the tracker checks, in order:

```text
1  session active and not paused                         else skip
2  no open capture_pause                                 else skip, DEC-028
3  screenshots enabled in the ACKNOWLEDGED policy        else skip, DEC-020
4  organization holds the screenshots entitlement        else skip
5  OS screen-capture permission granted                  else record 'unavailable'
```

Step 3 is the acknowledgement gate: if a material policy version enabled screenshots and the member has not yet acknowledged it, capture does not begin. [Tenancy & Security](#/sd-tenancy-security) §6.

---

## 4. Recording `DEC-026`

### Per-display streams `ADR-011`

```text
Recording                    one per tracking session
  ├── Stream · Display 1     1920×1080 @ 10 fps, VP9/WebM
  │     ├── Segment 001      60 s
  │     ├── Segment 002
  │     └── …
  ├── Stream · Display 2
  └── Stream · Display 3
```

Each stream is independent for capture and upload; they share the recording's absolute timeline. Every segment stores both `started_at` (absolute) and `offset_ms` (from recording origin), which is what allows the player to show three displays synchronised at 04:37.

### Encoding parameters

| Property | Value | Reason |
|---|---|---|
| Resolution | Native, **capped at 1920×1080** | `DEC-026`. A 4K display is downscaled |
| Frame rate | **10 fps** | `DEC-026`. This is a monitoring record, not video production |
| Codec | VP9, VP8 fallback | What Electron `MediaRecorder` produces reliably, `DEC-031` |
| Container | WebM | `DEC-031`. Stored in `recording_streams.container`, never assumed |
| Audio | None | Not captured. Materially different privacy category, and not required by any requirement |
| Bitrate | ~750 kbps target, VBR | Empirical for 1080p10 screen content; validated in the tracker spike |
| Segment length | 60 seconds | Bounds crash loss to one segment |
| Keyframe interval | Every segment start | Each segment is independently decodable |

### Why 60-second segments

A crash costs one segment. `resources-2.md` §9 argues this and it is right — but the segment length also sets upload granularity, retry cost and playback seek precision. Sixty seconds keeps a 1080p10 segment near 5–6 MB: small enough to retry cheaply on a poor connection, large enough that a member with three displays generates 180 uploads an hour rather than thousands.

### Cost profile

| Configuration | Per member per 8h day | Per year (220 days) |
|---|---|---|
| 1 display | ~1.3 GB | ~285 GB |
| 2 displays | ~2.6 GB | ~570 GB |
| 4 displays | ~5.2 GB | ~1.1 TB |

:::warning Recording retention is the open cost exposure
`DEC-026` keeps recordings on the shared `retention_months` entitlement — 24 months on Premium. Two displays therefore imply roughly **1.1 TB retained per member**. The 1080p/10 fps caps already cut this by an order of magnitude against native 4K/30 fps, which was the correct call. The residual remains the largest single cost line in the system. `storage_usage_daily` and the per-organization alert in [Operations](#/sd-operations) §6 are the early-warning mechanism; the available levers, in order of preference, are a shorter recording-specific retention default, a lower frame rate, or a duty cycle. See [`RISK-018`](#/risks).
:::

---

## 5. Upload protocol `ADR-009`

Media bytes never traverse the API. [`BR-MON-003`](#/business-rules).

```text
tracker                        API                         R2
   │                            │                           │
   │ POST /media/upload-intents │                           │
   │ kind, display, size, sha256│                           │
   │───────────────────────────▶│                           │
   │                            │ authorize: policy,        │
   │                            │ entitlement, quota        │
   │                            │ build deterministic key   │
   │                            │ presign PUT (15 min)      │
   │◀───────────────────────────│                           │
   │  { upload_url, storage_key, intent_id }                │
   │                            │                           │
   │  PUT bytes ────────────────────────────────────────────▶│
   │◀───────────────────────────────────── 200 ─────────────│
   │                            │                           │
   │ event: screenshot_captured │                           │
   │ or recording_segment       │                           │
   │ (in the next batch)        │                           │
   │───────────────────────────▶│                           │
   │                            │ verify size, record row   │
```

### Properties

| Property | Behaviour |
|---|---|
| Authorisation lifetime | 15 minutes, single object, `PUT` only |
| Key derivation | Server-side and deterministic from tenant, member, date and identifiers — the client never chooses a key |
| Idempotency | The intent id is the idempotency key; re-requesting returns the same key and a fresh URL |
| Integrity | Client sends `sha256`; the server records it and verifies object size on metadata submission |
| Metadata timing | Submitted in the **next event batch**, not as a separate call — one delivery path, one retry policy |
| Orphan handling | An object uploaded whose metadata never arrives is swept after 48 hours by a reconciliation job |

### Ordering

Bytes land before metadata. A row therefore never references a missing object. The reverse — an object with no row — is recoverable and is what the orphan sweep exists for.

---

## 6. Storage layout

Tenant-first, date-partitioned, so lifecycle rules and per-organization accounting are both trivial.

```text
ttt-media/
└── org/{organization_id}/
    ├── screenshots/{yyyy}/{mm}/{dd}/
    │     {capture_group_id}/{device_display_id}.jpg
    │
    ├── recordings/{yyyy}/{mm}/{dd}/
    │     {recording_id}/{device_display_id}/{sequence:06d}.webm
    │
    ├── exports/{yyyy}/{mm}/
    │     {export_id}.csv
    │
    └── avatars/
          {user_id}.jpg
```

The database stores `storage_key` only — never a URL. [`BR-MON-003`](#/business-rules), `resources-10.md` §25. Changing bucket, custom domain or CDN is then a configuration change rather than a data migration.

Grouping screenshots under `capture_group_id` means one moment's captures across four displays are one prefix — useful for both retrieval and deletion.

---

## 7. Retrieval

```text
GET /api/v1/screenshots/{id}/url
        ↓ RLS + query scope        wrong tenant → 404
        ↓ policy                   screenshots.view.own | .team | .all
        ↓ entitlement              screenshots
        ↓ status check             not pending_deletion, not deleted, not expired
        ↓ presign GET, 15 minutes, single object
        ↓ audit                    recorded for recordings and for cross-member views
```

| Rule | Value |
|---|---|
| URL lifetime | ≤ 15 minutes — [`NFR-SEC-005`](#/non-functional-requirements) |
| Scope | Exactly one object; never a prefix |
| Logging | Signed URLs are never written to logs, metrics or error payloads |
| Galleries | Presigned per item, capped at the page size |
| Recording playback | Presigned **per segment**, so a leaked URL exposes one minute, not a session |
| Member self-access | Always permitted for their own media, without a team permission — [`BR-MON-009`](#/business-rules) |

---

## 8. Retention and deletion `ADR-020`

The pipeline that makes the 3 / 6 / 24-month commitment real, and the downgrade grace that `DEC-018` requires.

### Effective retention

```text
entitlement_days = plan.retention_months × 30
policy_days      = retention_policies.retention_days for this data type
effective_days   = MIN(entitlement_days, policy_days)          BR-DATA-002
```

### Grace on downgrade `DEC-018`

A plan change that shortens retention must not delete anything immediately.

```text
subscription changes to a shorter retention
        ↓
subscriptions.retention_grace_until = now + 30 days
        ↓
during grace: effective_days = MAX(old_entitlement, new_entitlement)
        ↓
rows outside the NEW window get deletion_eligible_at = retention_grace_until
        ↓
they remain fully readable, labelled "Scheduled for deletion"
        ↓
Owner warned at grace start and again 7 days before expiry; export offered
        ↓
grace expires → normal expiry applies
```

Deleting a year of screenshots the moment a customer saves money on their plan is a support incident waiting to happen. The 30-day grace, the label and the two warnings are all `DEC-018`.

### Nightly sweep

```text
for each organization, for each data type:

  cutoff = now − effective_days

  A · PARTITIONED SOURCES  (tracking_events, activity_events, usage, audit_logs,
                            connectivity_events, notifications)
      whole partition older than every organization's cutoff?
          → DETACH, then DROP                       O(1), no bloat, ADR-007
      partition still shared across organizations?
          → batched DELETE, 10k rows per statement

  B · MEDIA  (screenshots, recording_segments)
      1  UPDATE … SET status='pending_deletion'
           WHERE captured_at < cutoff
             AND (deletion_eligible_at IS NULL OR deletion_eligible_at <= now)
      2  enqueue DeleteMediaObjects in batches of 500
      3  worker: DELETE objects from R2      ← storage FIRST
      4  on confirmed removal: delete rows / mark deleted
      5  write one audit record per batch, actor NULL, action retention.*
      6  update storage_usage_daily.bytes_deleted
```

**Storage before metadata, always.** [`BR-DATA-004`](#/business-rules), `resources-10.md` §30. Deleting the row first leaves a private object nothing references and nobody can find to remove — a permanent, invisible retention violation.

### Guarantees

| Property | Value |
|---|---|
| Deletion latency | ≤ 24 hours after expiry — [`NFR-PRIV-005`](#/non-functional-requirements) |
| Resumability | Batched with a cursor; a crash resumes rather than restarts |
| Rate limiting | Bounded R2 delete concurrency so the sweep cannot exhaust the API budget |
| Auditability | Every batch produces an audit record with counts and byte totals |
| Failure visibility | Job outcome and any `pending_deletion` backlog appear in platform health — [`RISK-016`](#/risks) |
| Cascade | Deleting the last segment of a stream marks the stream deleted; the last stream marks the recording deleted |

### Member-requested deletion

`REQ-MON-011`: a member may request deletion of a specific screenshot or recording with a reason. An Administrator decides. On approval the object is removed via the same pipeline, the gap is classified **deleted** rather than expired, and both the request and the decision are audited. Approved timesheet totals are unaffected — a deleted screenshot is an evidence gap, not a change to recorded time.

---

## 9. Storage accounting `DEC-026`

`storage_usage_daily` is maintained by the same jobs that create and delete media:

```text
organization_id · date · media_type · bytes_added · bytes_deleted · bytes_total · object_count
media_type ∈ screenshot | recording | export | avatar
```

Purposes, in order of importance:

1. **Cost attribution.** Which organizations actually cost money to serve.
2. **Anomaly detection.** Storage growth materially out of step with seat count raises an alert — [`NFR-SCALE-006`](#/non-functional-requirements).
3. **Trial guard rails.** The enforcement point for `OQ-029`, once the numbers are set. The mechanism exists; the limits are a commercial decision.
4. **Capacity planning.** Trend input for R2 spend.

---

## 10. Platform capture notes

Realities the tracker must handle, established during the spike (`M-03`).

| Platform | Screen capture | Input idle | Foreground application | Notes |
|---|---|---|---|---|
| **Windows 10/11** | `desktopCapturer`, DXGI duplication | `powerMonitor` | Win32 window query | Most reliable. Per-monitor DPI must be honoured or captures come back scaled |
| **macOS 13+** | `desktopCapturer` — **requires Screen Recording permission** | `powerMonitor` | **requires Accessibility permission** | Both are user-grantable and revocable; both must degrade visibly. Permission prompts cannot be suppressed |
| **Linux · X11** | `desktopCapturer` | `powerMonitor` | X11 window properties | Workable |
| **Linux · Wayland** | **Portal-mediated, per-session user consent** | Limited | Frequently unavailable | See below |

:::warning Wayland is a genuine constraint
Under Wayland, screen capture requires the `xdg-desktop-portal` screencast interface, which prompts the user per session and cannot be made silent or persistent on many compositors. Window-title and foreground-application detection are often unavailable entirely. Continuous unattended capture — which is what this product does — is not reliably achievable there. The position for MVP: **X11 is supported; Wayland is detected and reported as a degraded environment** with screenshots and recording marked `unavailable` while time tracking continues normally. This must be validated in the `M-03` spike and stated plainly in the Linux system requirements rather than discovered by a customer. [`RISK-001`](#/risks).
:::

---

## 11. Failure modes

| Failure | Behaviour |
|---|---|
| OS capture permission denied | Time tracking continues; the capture type is marked `unavailable` on the device and in reports; the member is prompted to grant it |
| Display disconnected mid-recording | Its stream is finalised at the last segment; other streams continue; the recording completes as `partial` |
| Display connected mid-session | A `display_configuration` event is emitted; capture extends to it at the next interval, subject to the cap |
| Upload fails repeatedly | Segment marked failed; recording completes as `partial` with the gap visible |
| Local disk pressure | Oldest **media** dropped after warning the member. Events are never dropped — [`BR-SYNC-003`](#/business-rules) |
| R2 unavailable | Uploads queue locally; time capture and ingestion are unaffected — [`NFR-REL-008`](#/non-functional-requirements) |
| Encoder unavailable or overloaded | Recording degrades — frame rate first, then stops with the reason recorded. Screenshots and time capture continue |
| Member exceeds the 30-minute pause | Capture auto-resumes; the pause row closes with `auto_resumed = true` |

---

## 12. Verification

| Property | Test |
|---|---|
| Crash cost | Force-terminate mid-recording; assert at most one segment lost per stream |
| Multi-display alignment | Three simulated displays; assert one `capture_group_id` per instant and synchronised segment offsets |
| Display identity stability | Disconnect and reconnect a display; assert the same `display_key` and no duplicate `device_displays` row |
| Cap enforcement | Five displays; assert four captured, one flagged, member notified |
| Entitlement gate | Basic organization calls the recording endpoints directly; assert refusal — `SC-05` |
| Acknowledgement gate | Publish a material policy enabling recording; assert no capture until acknowledged |
| Pause bound | Open a pause and wait; assert automatic resume at 30 minutes with `auto_resumed` set |
| Deletion ordering | Fail the R2 delete; assert metadata survives and the row stays `pending_deletion` |
| Retention latency | Seed expired media; assert removal from both systems within 24 hours — `SC-06` |
| Grace period | Downgrade Premium → Basic; assert nothing deletes for 30 days and the label appears |
| No public access | Attempt anonymous `GET` on a known key; assert refusal |
