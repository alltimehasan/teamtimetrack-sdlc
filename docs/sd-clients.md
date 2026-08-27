# Web & Desktop Clients

Two clients, very different problems. The web application is a conventional management interface. The desktop tracker runs continuously on machines the vendor does not control, captures sensitive material, and must not lose a minute of anyone's work.

---

# Part 1 — Desktop Tracker

The highest-risk component in the system. [`RISK-001`](#/risks).

## 1. Process model `ADR-015`

```text
┌─────────────────────────────────────────────────────────────────┐
│ MAIN PROCESS                          Node, full OS access      │
│                                                                 │
│  Tray & window          Secure storage       Auto-update        │
│  IPC broker             (safeStorage)        (electron-updater) │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ TRACKING CORE                                             │  │
│  │  Session state machine    Idle detector (powerMonitor)    │  │
│  │  Display watcher          Foreground app/window sampler   │  │
│  │  Capture scheduler        Policy cache                    │  │
│  │  Local store (SQLite/WAL) Sync engine                     │  │
│  │  Upload engine            Clock-skew monitor              │  │
│  └───────────────────────────────────────────────────────────┘  │
└───────────┬─────────────────────────────────┬───────────────────┘
            │ IPC (contextBridge)             │ IPC
            ▼                                 ▼
┌────────────────────────┐      ┌──────────────────────────────────┐
│ UI RENDERER            │      │ CAPTURE RENDERERS  (hidden)      │
│ sandboxed              │      │ one per captured display         │
│ nodeIntegration off    │      │ desktopCapturer + MediaRecorder  │
│ Timer · projects       │      │ → WebM chunks → main process     │
│ Sync state · settings  │      └──────────────────────────────────┘
└────────────────────────┘
```

### Why hidden renderers for recording

`MediaRecorder` is a renderer API; it does not exist in the main process. Recording up to four displays simultaneously (`DEC-019`) therefore needs one hidden `BrowserWindow` per captured display, each holding a `desktopCapturer` stream for its own source. The main process owns scheduling, chunk collection and upload; renderers only encode.

Screenshots are captured in the main process via `desktopCapturer.getSources({ thumbnailSize })` at native size, so the still path does not depend on a renderer being alive.

### Security posture

| Setting | Value |
|---|---|
| `contextIsolation` | `true` |
| `nodeIntegration` | `false` |
| `sandbox` | `true` for the UI renderer |
| Preload surface | An explicit, minimal `contextBridge` API — no `ipcRenderer` exposure |
| Remote content | None. The UI is local; only the API is contacted |
| CSP | `default-src 'self'`; `connect-src` limited to the API origin |
| Update integrity | Signed updates verified before application — [`NFR-SEC-012`](#/non-functional-requirements) |

---

## 2. Start-up sequence

```text
launch
  ├─ read device identity + token from OS keystore
  ├─ open local store, run schema migrations
  ├─ RECOVER: unclosed session?  → close at last recorded event  (REQ-DEV-005)
  ├─ flush pending event batches (oldest first)
  ├─ flush pending media uploads
  ├─ GET /tracking/bootstrap
  │     policy version · projects · tasks · schedule · settings · entitlements
  ├─ compare policy version with the acknowledged version
  │     material and unacknowledged → show disclosure, gate new capture  (DEC-020)
  ├─ enumerate displays → device_displays upsert, apply the 4-display cap
  ├─ probe OS capture permissions → report capabilities
  └─ idle, or auto-start if eligible  (DEC-006, DEC-030)
```

Recovery runs **before** anything else. A tracker that syncs before recovering can lose the tail of an interrupted session.

---

## 3. Capture scheduler

One timer wheel drives every periodic activity, so the tracker has a single place where "should this happen now" is decided.

| Task | Cadence | Guards |
|---|---|---|
| Activity sample | 60 s | session active |
| Foreground application sample | 15 s | session active; capture allowed; accessibility permission |
| Screenshot | interval ± randomisation, default 600 s | session active; not paused; not capture-paused; policy acknowledged; entitled; permission granted |
| Recording segment close | 60 s | recording active |
| Batch flush | 30 s, or 500 events, or on session state change | connectivity |
| Media upload | continuous, 2 concurrent | connectivity |
| Heartbeat | 300 s | always |
| Policy refresh | 300 s | connectivity |
| Idle evaluation | 10 s | session active |
| Display enumeration | on OS event + 60 s poll | always |

Every capture task passes the same five guards from [Capture & Media](#/sd-capture) §3 before acting. The guards live in one function; a capture path that bypasses them is a defect.

---

## 4. Local store `ADR-024`

SQLite in WAL mode, encrypted with a key from the OS keystore. Schema in [Tracking & Sync](#/sd-tracking) §4.

| Property | Value |
|---|---|
| Endurance | ≥ 72 hours continuous tracking |
| Soft cap | 2 GB or 20% of free disk, whichever is lower |
| Pressure order | Warn → drop oldest media → **never drop events** |
| Survives | Restart, power loss, application update |
| Integrity | `PRAGMA integrity_check` at start-up; corruption reported with the affected period stated |

Media files are staged on disk with their metadata row in `media_queue`; the row is removed only after the upload is acknowledged and the metadata event has been accepted.

---

## 5. Tracker state, made honest

The UI must never present a state better than reality. [`BR-SYNC-005`](#/business-rules).

```text
┌──────────────────────────────┐
│  ● Tracking     02:14:33     │   ← timer, always visible in tray/menu bar
│  Website redesign · QA pass  │
│                              │
│  ⟳ Syncing — 12m unsynced    │   ← never a tick while a backlog exists
│  ◉ Screenshots  ⏸ paused 8m  │   ← per capture type, live
│  ▣ Recording — 2 displays    │
│  ⚠ Activity unavailable      │   ← OS permission denied
└──────────────────────────────┘
```

| Indicator | Rule |
|---|---|
| Tracking state | Visible without opening the window |
| Sync state | Shows unsynchronised **minutes of work**, not a byte count |
| Capture types | Live per-type state, including degraded |
| Automatic start | Unmistakably marked as automatic — `DEC-006` |
| Recording | Persistent indicator for the entire duration — [`REQ-REC-001`](#/functional-requirements) |
| Colour | Never the sole carrier of state — [`NFR-USE-002`](#/non-functional-requirements) |

---

## 6. OS integration

| Capability | Windows | macOS | Linux |
|---|---|---|---|
| Screen capture | DXGI via `desktopCapturer` | `desktopCapturer` — **Screen Recording permission** | X11 fine; **Wayland portal-gated** |
| Input idle | `powerMonitor.getSystemIdleTime()` | same | same |
| Foreground app | Win32 query | **Accessibility permission** | X11 properties; Wayland often unavailable |
| Display enumeration | `screen` + WMI EDID | `screen` + `CGDisplay` | `screen` + X11 EDID |
| Credential storage | DPAPI | Keychain | libsecret |
| Autostart | Registry Run key | Launch Agent | XDG autostart |
| Sleep / wake | `powerMonitor` | same | same |
| Signing | Authenticode | Developer ID + notarisation | — |

### Permission handling

Permissions are user-grantable and revocable at any time, so they are **probed continuously, not once**:

```text
probe on start-up, on wake, and every 5 minutes
      ↓ state change
report to /devices/{id}/heartbeat  →  devices.capture_capabilities
      ↓
tracker shows the capture type as unavailable
      ↓
reports classify the gap as 'unavailable', not 'failed' or 'expired'
```

Time tracking never stops because a capture permission was denied. [`REQ-DEV-006`](#/functional-requirements).

:::warning Wayland
Continuous unattended capture is not reliably achievable under Wayland: the screencast portal prompts per session on most compositors, and foreground-window detection is frequently unavailable. Position for MVP — **X11 supported, Wayland detected and reported as degraded** with capture marked unavailable while time tracking continues. This must be confirmed in the `M-03` spike and stated in the Linux system requirements rather than discovered by a customer.
:::

---

## 7. Updates

| Aspect | Approach |
|---|---|
| Channel | Stable; a beta channel for internal validation |
| Mechanism | `electron-updater` against a signed release feed |
| Cadence | Check at start-up and every 6 hours; apply on quit |
| Data safety | The local store survives updates; schema migrations run at next launch — [`REQ-DEV-007`](#/functional-requirements) |
| Minimum version | The API rejects trackers below the floor with a clear, actionable message |
| Rollback | Previous release retained on the feed |

---

## 8. Build and distribution

```text
electron-builder
  ├── Windows  NSIS installer + MSI, Authenticode signed
  ├── macOS    universal (arm64 + x64) DMG, Developer ID signed, notarised, stapled
  └── Linux    AppImage + deb, X11 target
```

Code signing certificates and Apple notarisation have real procurement lead times and block distribution entirely. They start before R2 completes. [`RISK-009`](#/risks).

---

# Part 2 — Web Application

## 9. Framework and rendering `ADR-014`

Next.js 15 App Router, `output: 'standalone'`, served by Nginx on the **same origin** as the API.

Same-origin is the decision that removes a whole class of problems: the Sanctum session cookie is `SameSite=Lax` and simply works, there is no token in JavaScript, no CORS preflight on every call, and no refresh-token dance.

```text
teamtimetrack.com/            → Next.js
teamtimetrack.com/api/v1/*    → Laravel
```

| Surface | Rendering |
|---|---|
| Marketing, sign-in, invitation acceptance | Server components, static where possible |
| Application shell, navigation, settings | Server components with client islands |
| Dashboards, reports, timeline, approvals | Client components — interactive, filter-driven |
| Screenshot gallery, recording playback | Client components with virtualised lists |

Data is fetched from the browser against the API with the session cookie. Next.js is not a BFF: it renders, it does not proxy. One authorization implementation, in Laravel.

## 10. Structure

```text
app/
├── (public)/          sign-in, register, verify, accept-invitation, reset
├── (app)/
│   ├── layout.tsx                     shell: sidebar, org switcher, notifications
│   ├── dashboard/                     individual · team · organization · executive
│   ├── timesheets/                    list · detail · approval queue
│   ├── time/                          entries, corrections, timeline
│   ├── people/                        members, invitations, roles, teams
│   ├── work/                          projects, tasks
│   ├── workforce/                     schedules, attendance, leave, holidays
│   ├── monitoring/                    screenshots, recordings, activity, policy
│   ├── payroll/                       rates, periods, entries, exports   (finance)
│   ├── reports/
│   ├── settings/                      organization, tracking, monitoring, retention
│   ├── billing/                       plan, subscription, invoices, seats
│   └── me/                            my record — JRN-18
└── platform/                          vendor administration, separate auth
```

## 11. Client-side concerns

| Concern | Approach |
|---|---|
| Server state | TanStack Query — caching, background refetch, optimistic updates on mutations |
| Client state | React context for session, active organization, entitlements. No global store |
| Forms | React Hook Form + Zod, schemas mirroring the API's validation |
| Tables | Virtualised; server-side pagination, sorting and filtering throughout |
| Charts | Lightweight SVG charting; no heavyweight dependency for what dashboards need |
| Real-time | Laravel Echo over WebSockets where the `realtime_notifications` entitlement allows; **degrades to 30-second polling** otherwise, so no notification is ever lost — [`REQ-NOTIF-004`](#/functional-requirements) |
| Time display | All timestamps rendered in the organization's timezone with the zone shown — [`NFR-USE-005`](#/non-functional-requirements) |
| Errors | The API's `problem+json` rendered directly; `request_id` shown for support |

## 12. Entitlement-aware UI

The client **hides nothing silently**. An unavailable feature is shown as requiring a named plan.

```text
GET /billing/entitlements → cached in context

<FeatureGate feature="video_recording" fallback={<UpgradePrompt plan="Premium" />}>
  <RecordingPlayer …/>
</FeatureGate>
```

This is presentation only. The API refuses regardless of what the client renders. [`BR-BILL-003`](#/business-rules).

## 13. Accessibility

| Requirement | Implementation |
|---|---|
| WCAG 2.1 AA — [`NFR-USE-001`](#/non-functional-requirements) | Semantic landmarks, labelled controls, visible focus |
| Keyboard | Every workflow completable without a pointer; approval queue fully keyboard-driven |
| Contrast | 4.5:1 body, 3:1 large text and interface elements, verified in both themes |
| Status | Never colour alone — icon plus text accompanies every state |
| Motion | `prefers-reduced-motion` respected |
| Screen readers | Live regions for timer and sync state; tables with proper headers and captions |
| Verification | Automated scan on every build; manual keyboard and screen-reader review before `M-09` |

## 14. Responsive behaviour

| Width | Design |
|---|---|
| ≥ 1280 px | Full three-column: navigation, content, contextual panel |
| 768–1279 px | Collapsible navigation; approval, review and reporting fully usable — a manager approving on a tablet is a real scenario |
| 320–767 px | Single column. Personal record, timesheet submission, leave requests and approvals work. Schedule and monitoring configuration are desktop tasks and say so |

[`NFR-COMPAT-003`](#/non-functional-requirements).

## 15. Performance budget

| Metric | Target |
|---|---|
| First Contentful Paint, application shell | < 1.2 s on a warm cache |
| Largest Contentful Paint, dashboard | < 2.5 s |
| Interaction to Next Paint | < 200 ms |
| Initial JavaScript, shell | < 180 KB gzipped |
| Screenshot gallery | Virtualised; images lazy-loaded and presigned per page |

---

## 16. Shared conventions

Both clients follow the same rules, because inconsistency between them is how contradictory states arise.

1. **The API is the only authority.** Clients never make an authorization or entitlement decision.
2. **State is never optimistically better than reality.** No success indicator before acknowledgement.
3. **Errors surface a `request_id`.** Support conversations start from a correlatable identifier.
4. **All times display with their timezone.** Distributed teams misread bare local times, and the misreading arrives later as a payroll dispute.
5. **Destructive and policy-changing actions preview their consequence** before confirmation — [`NFR-USE-003`](#/non-functional-requirements).
