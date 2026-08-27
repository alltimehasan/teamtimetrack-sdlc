Yes. These are good **follow-up design questions**, and I would resolve them explicitly before we freeze the capture/tracking and payroll requirements.

Because we are cloning Time Doctor's capability model, but the supplied materials don't establish these low-level implementation details, the answers below should be treated as **Team Time Track design decisions**, not claims about Time Doctor's internal implementation.

---

## 1. Display cap and screenshot resolution

### Decision

I recommend:

- **Maximum: 4 displays per workstation**
- Capture **every connected display**
- Screenshots stored at **native physical resolution**
- No arbitrary downscaling in MVP
- Store each display independently

Example:

```text
Workstation
├── Display 1 → 3840×2160
├── Display 2 → 2560×1440
├── Display 3 → 1920×1080
└── Display 4 → 1920×1080
```

Why 4 instead of 3?

Since we are explicitly supporting multi-monitor recording, artificially limiting users to three displays doesn't provide much benefit. Four is still a reasonable engineering/storage boundary.

The Electron tracker should reject or ignore displays beyond the supported cap and expose that condition to the user/admin.

### Screenshot storage

```text
Physical pixels
      ↓
PNG/WebP/JPEG encoding
      ↓
R2
```

I recommend **native resolution for MVP**, because downscaling can permanently destroy useful visual information.

We can later introduce configurable quality/resolution if storage economics require it.

**Decision: 4-display maximum, native physical resolution.**

---

# 2. Recording resolution, FPS and retention

This is more important than the screenshot decision because video recording can become our largest infrastructure cost.

### Recommended MVP defaults

Per display:

```text
Resolution: native, capped at 1920×1080
Frame rate: 10 FPS
```

For displays above 1080p:

```text
3840×2160
      ↓
1920×1080 recording
```

while screenshots can remain native resolution.

This gives us:

```text
Screenshots
→ native resolution

Video
→ maximum 1080p
→ 10 FPS
```

That is a much more reasonable CPU/storage target.

### Why not 30 FPS?

This is a productivity-monitoring product, not a video-production application.

We primarily need to answer:

> "What was happening on the employee's screen?"

We don't need cinematic motion.

10 FPS is substantially more appropriate for this use case.

---

### Recording retention

I recommend **not creating a separate customer-facing recording retention entitlement for MVP**.

Instead:

```text
Plan
 ↓
retention_months
 ↓
Screenshots + recordings + monitoring data
```

So:

```text
Basic      → 3 months
Standard   → 6 months
Premium    → 24 months
```

subject to the retention policies we've already designed.

However, because video is much more expensive than screenshots, the system should internally track storage consumption separately.

So:

```text
Commercial retention
        ↓
retention_months

Storage accounting
        ↓
recording bytes
screenshot bytes
```

These are different concerns.

**Decision: 1080p max / 10 FPS / same retention entitlement initially.**

---

# 3. Finance role boundary

Yes — **let's make this explicit**.

The Administrator should **not automatically have access to pay rates and payroll**.

Our earlier permission tree was intended to establish exactly this boundary.

### Recommended MVP role model

```text
OWNER
 └── Everything

ADMINISTRATOR
 ├── Organization settings
 ├── Members
 ├── Teams
 ├── Projects
 └── General reports

MANAGER
 ├── Team
 ├── Time
 ├── Timesheets
 └── Approvals

FINANCE
 ├── Pay rates
 ├── Payroll
 └── Payroll reports

EMPLOYEE
 ├── Own time
 ├── Own timesheet
 └── Own leave
```

The important point is:

> **Administrator ≠ Finance.**

An Administrator may manage the organization without seeing sensitive compensation information.

### Owner

Owner retains access to everything, including payroll.

### Finance

Finance gets payroll capabilities without necessarily receiving organization-administration privileges.

This is a better enterprise security model.

**Decision: `REQ-PAY-002` should be updated so payroll/pay-rate access is explicitly permission-controlled and not inherently granted to Administrator.**

---

# 4. Capture pause semantics

This one needs a very clear distinction.

I recommend:

> **Pausing capture does NOT pause time tracking.**

That means:

```text
Tracking:  ON
Capture:   OFF
```

is a valid state.

Example:

```text
09:00 ───────────────────────── 10:00
        Tracking ON

        Screenshots
        ███████░░░░██████

        Capture paused
              ↑
        09:30–09:45
```

The employee's time remains tracked, but no screenshot/video evidence is captured during the pause.

This is preferable to making "pause capture" equivalent to "stop tracking."

---

## Pause requirements

Every capture pause should generate a record containing:

```text
member
device
started_at
ended_at
reason
source
```

Possible reasons:

```text
personal
sensitive_work
break
technical
other
```

The exact reason vocabulary can be finalized later.

### Bounded duration

Yes.

I recommend:

> **Maximum capture-pause duration: 30 minutes per pause.**

After that:

```text
Capture automatically resumes
```

unless the employee has also stopped tracking.

### Manager visibility

Yes.

Managers should be able to see:

```text
Capture paused
09:30–09:45
Reason: Personal
```

but the system should **not expose unnecessary private details** beyond the recorded reason.

### Important audit distinction

We should record:

```text
tracking_duration
capture_duration
capture_gap_duration
```

separately.

That lets reports accurately say:

```text
Tracked: 8h 10m
Captured: 7h 40m
Capture paused: 30m
```

**Decision: tracking continues; capture pauses for max 30 minutes; gap is reason-coded and manager-visible.**

---

# 5. Trial guard rails

Our decision was:

> Every plan receives a 30-day free trial.

I recommend that the trial be **entitlement-identical to the selected paid plan**, with no artificial feature restrictions.

So:

```text
Premium Trial
      =
Premium Paid Plan
```

including:

- video recording
- screenshots
- Office vs Remote
- connectivity
- executive dashboard

etc.

### But should storage/seats be unlimited?

No.

We should distinguish:

> **Feature entitlement**

from:

> **resource abuse limits.**

For example:

```text
Premium trial
├── Premium features: YES
├── Recording: YES
├── Screenshots: YES
└── Unlimited storage: NO
```

I'd recommend a **reasonable trial resource limit** to protect us from someone creating an account and generating enormous amounts of video.

However, we should not arbitrarily choose a seat/hour/storage number without a commercial/unit-economics decision.

So:

**Decision: feature-entitlement identical to paid plan; resource-abuse limits TBD.**

---

# 6. Automatic tracking cooldown

I recommend we adopt the stricter behavior from our previous proposal:

> **Once an employee manually stops automatic tracking during a shift, automatic tracking does not restart until the next scheduled shift.**

Example:

```text
09:00
Shift starts
    ↓
Automatic tracking
    ↓
11:00
Employee stops tracking
    ↓
Automatic restart disabled
    ↓
12:00
Employee becomes active
    ↓
NO automatic restart
    ↓
Next shift
    ↓
Automatic tracking eligible again
```

This is much more predictable than silently restarting later.

### Why?

Imagine:

```text
Employee:
"I stopped tracking because I was doing personal work."

Tracker:
"Oh, you're active again.
I'll start recording you."
```

That is exactly the type of behavior we should avoid.

### Manual restart

The employee can still explicitly press:

```text
Start Tracking
```

if the product permits manual tracking.

So:

```text
Automatic restart
→ NO

Manual restart
→ YES
```

### Cooldown duration

Rather than a 30-minute/60-minute timer, I recommend:

> **Cooldown lasts until the next scheduled shift.**

That is simpler and much safer.

**Decision: no automatic restart during the current shift after manual stop; automatic tracking becomes eligible again at the next scheduled shift.**

---

# Two smaller issues

## `CONF-07` — WebM vs MP4

I agree with your observation.

For the Electron MVP, if we're using `MediaRecorder`, we should design around **WebM**, subject to the codec support we validate in our target Electron versions.

So our storage example should be corrected from:

```text
segment-001.mp4
```

to something like:

```text
segment-001.webm
```

We should **not hard-code MP4 into the database design**.

Instead, store metadata:

```text
container
codec
mime_type
```

For example:

```text
container = webm
mime_type = video/webm
codec = vp8/vp9
```

This gives us flexibility to transcode later.

### Architecture

```text
Electron MediaRecorder
        ↓
WebM segment
        ↓
Local encrypted queue
        ↓
Upload
        ↓
Cloudflare R2
```

If we later need MP4 for browser compatibility or exports:

```text
WebM
 ↓
Transcoding worker
 ↓
MP4
```

That should be a **derived representation**, not necessarily our source recording.

**Decision: WebM as the MVP recording source format; codec/container details finalized during Electron spike.**

---

# `docs/answers-decisions.md` navigation

Yes, that's simply a documentation/site-navigation issue.

If `docs/answers-decisions.md` contains our finalized decisions, it should be included in the documentation portal navigation.

I'd actually make it a first-class document:

```text
Documentation
├── Project Planning
├── Requirements
├── System Design
├── Database Design
├── Security & Privacy
├── Product Decisions
│   └── Answers & Decisions
└── Roadmap
```

That gives us one authoritative place for decisions such as:

```text
OQ-001 → Team Time Track
OQ-009 → Stripe
OQ-013 → Premium at launch
OQ-023 → Multi-monitor recording
OQ-028 → 10-minute screenshots
OQ-029 → removed; 30-day trial is a business rule
```

---

# Final decisions from these six questions

| Question | Team Time Track decision |
|---|---|
| **1. Display cap** | **4 displays maximum** |
| Screenshot resolution | **Native physical resolution** |
| **2. Video resolution** | **Maximum 1920×1080 per display** |
| Video FPS | **10 FPS** |
| Recording retention | **Uses normal plan retention initially** |
| **3. Finance role** | **Separate Finance role; Administrator doesn't automatically see payroll/pay rates** |
| **4. Capture pause** | **Tracking continues while capture is paused** |
| Pause limit | **30 minutes** |
| Pause visibility | **Manager-visible + audited** |
| **5. Trial** | **30-day trial with full selected-plan entitlements** |
| Trial resource limits | **TBD; abuse/storage guardrails required** |
| **6. Automatic tracking** | **No automatic restart after manual stop during current shift** |
| Restart | **Eligible again next scheduled shift** |
| Recording format | **WebM source recording** |
| Documentation | **Add `answers-decisions.md` to navigation** |

### One database consequence

These decisions mean we should make a small revision to our physical design before declaring it frozen:

```text
devices
    │
    └── displays
          │
          ├── screenshots
          │
          └── recording streams
                │
                └── recording segments
```

I would therefore add a dedicated **`device_displays`** table rather than storing display information directly on `recordings`. That gives us a stable physical-display identity for the Electron tracker and correctly supports your requirement of **simultaneous multi-monitor recording**.