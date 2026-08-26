# User Journeys

Eighteen end-to-end workflows covering every persona and every module. Each journey names its actor, trigger, preconditions, main path, alternative paths, failure modes and the requirements that implement it.

| Journey | Actor | Frequency | Evidence |
|---|---|---|---|
| [`JRN-01`](#jrn-01) Organization registration | Prospective Owner | Once per organization | {Derived} |
| [`JRN-02`](#jrn-02) Plan selection and trial | Owner | Once, then at renewal | {Derived} |
| [`JRN-03`](#jrn-03) Organization configuration | Administrator | Once, then occasional | {Derived} |
| [`JRN-04`](#jrn-04) Member invitation | Administrator | Ongoing | {Derived} |
| [`JRN-05`](#jrn-05) Member onboarding | Employee | Once per member | {Derived} |
| [`JRN-06`](#jrn-06) Project and task setup | Administrator, Manager | Ongoing | {Confirmed} |
| [`JRN-07`](#jrn-07) Tracking a working session | Employee | Many times daily | {Confirmed} |
| [`JRN-08`](#jrn-08) Working offline and resynchronising | Employee | Unpredictable | {Confirmed} |
| [`JRN-09`](#jrn-09) Correcting tracked time | Employee, Manager | Weekly | {Derived} |
| [`JRN-10`](#jrn-10) Requesting and approving leave | Employee, Manager | Monthly | {Confirmed} |
| [`JRN-11`](#jrn-11) Schedule configuration | Administrator | Occasional | {Confirmed} |
| [`JRN-12`](#jrn-12) Reviewing team activity | Manager | Daily | {Confirmed} |
| [`JRN-13`](#jrn-13) Investigating an anomaly | Manager | Occasional | {Confirmed} |
| [`JRN-14`](#jrn-14) Timesheet submission and approval | Employee, Manager | Per period | {Confirmed} |
| [`JRN-15`](#jrn-15) Payroll preparation and export | Owner, Administrator | Per period | {Confirmed} |
| [`JRN-16`](#jrn-16) Subscription management | Owner | Occasional | {Derived} |
| [`JRN-17`](#jrn-17) Monitoring and retention configuration | Administrator | Rare, high impact | {Confirmed} + {Proposed} |
| [`JRN-18`](#jrn-18) Reviewing your own record | Employee | Occasional | {Proposed} |

---

## JRN-01 — Organization registration {P0} {Derived}

**Actor:** Prospective Owner · **Trigger:** decides to evaluate the product · **Preconditions:** none

### Main path
1. Submits name, email and password to register
2. System creates a User in `active` status, unverified
3. System sends a verification email
4. Owner verifies the email
5. Owner is prompted to create an Organization: name, timezone, country, currency
6. System creates the Organization, creates a Membership for the User, and assigns the Owner role
7. System creates default organization settings, default leave types and default retention policies
8. Owner lands on an empty organization dashboard with guided next steps

### Alternative paths
- **Email already registered** → prompt to sign in instead; do not disclose whether the account exists beyond the standard message
- **Invited user registers directly** → after verification, pending invitations for that email are offered
- **Person already owns an organization** → creating a second is permitted; organization switching applies

### Failure modes
| Failure | Behaviour |
|---|---|
| Verification email not delivered | Resend available, rate-limited |
| Verification link expired | New link issued on request |
| Registration abandoned after step 2 | Unverified account retained; may not create an Organization until verified |
| Organization slug collision | System proposes a unique alternative |

**Requirements:** [`REQ-AUTH-001`](#/functional-requirements) · [`REQ-AUTH-002`](#/functional-requirements) · [`REQ-ORG-001`](#/functional-requirements) · [`REQ-USER-001`](#/functional-requirements) · [`REQ-RBAC-002`](#/functional-requirements)

---

## JRN-02 — Plan selection and trial {P0} {Derived}

**Actor:** Owner · **Trigger:** organization created, or trial ending · **Preconditions:** verified Owner with an Organization

### Main path
1. Owner views the three plans with their entitlements
2. Owner selects a plan and starts a trial
3. System creates a Subscription in `trialing` with a trial end date
4. Entitlements for the selected plan become active immediately
5. Owner is notified in advance of trial expiry
6. Before expiry, Owner adds a payment method and confirms
7. Subscription moves to `active` at the first billing period

### Alternative paths
- **Trial expires without payment** → subscription becomes `expired`; the organization moves to a restricted state where existing data is readable and export is permitted, but tracking and new data capture stop `{Proposed}`
- **Owner changes plan during trial** → entitlements change immediately; trial end date unchanged
- **Payment fails** → subscription becomes `past_due`; grace period applies; Owner is notified

### Failure modes
| Failure | Behaviour |
|---|---|
| Payment provider unavailable | Retry with backoff; Owner informed the subscription is unchanged |
| Downgrade below current seat count | Blocked with an explanation of how many memberships must be removed first |
| Downgrade removing entitlements in use | Warned explicitly which data becomes inaccessible and what retention now applies |

:::warning Downgrade shortens retention
Moving from Premium (24 months) to Basic (3 months) means data outside the new window becomes subject to deletion. This must be stated explicitly before confirmation, and a grace period before deletion is strongly recommended. [`OQ-022`](#/open-questions)
:::

**Requirements:** [`REQ-BILL-001`](#/functional-requirements) to [`REQ-BILL-007`](#/functional-requirements) · [`REQ-DATA-002`](#/functional-requirements)

---

## JRN-03 — Organization configuration {P0} {Derived}

**Actor:** Administrator · **Trigger:** new organization, or policy change · **Preconditions:** Administrator or Owner role

### Main path
1. Sets identity: name, logo, slug
2. Sets locale: timezone, country, currency, date format, time format, week start
3. Sets working defaults: working days, default daily hours
4. Sets tracking policy: idle threshold, minimum tracking interval, tracking mode
5. Sets monitoring policy: screenshot enablement and interval, activity capture, web/app capture — see [`JRN-17`](#jrn-17)
6. Sets retention per data type, bounded by the plan entitlement
7. Defines leave types
8. Every change writes an audit record

### Alternative paths
- **Entitlement absent** → setting is shown as unavailable with the plan required, never silently hidden
- **Retention above the entitlement ceiling** → rejected with the maximum stated

### Failure modes
| Failure | Behaviour |
|---|---|
| Timezone changed after tracking exists | Historical records are unaffected — all instants are stored in UTC. Reports rendered in the new timezone will show different day boundaries; warn explicitly |
| Currency changed with pay rates set | Existing pay rates keep their own currency; only the default changes |

**Requirements:** [`REQ-ORG-002`](#/functional-requirements) to [`REQ-ORG-008`](#/functional-requirements) · [`REQ-DATA-001`](#/functional-requirements) · [`REQ-AUDIT-001`](#/functional-requirements)

---

## JRN-04 — Member invitation {P0} {Derived}

**Actor:** Administrator · **Trigger:** a person needs access · **Preconditions:** available seat within the plan limit

### Main path
1. Enters one or more email addresses and selects a role
2. System checks seat availability
3. System creates Invitations with hashed, expiring tokens and sends emails
4. Invitations appear as pending with their expiry
5. On acceptance, a Membership is created and the Administrator is notified

### Alternative paths
- **Email already a member** → rejected with an explanation
- **Email is an existing platform User** → invitation links to the existing User; no new account is created
- **Resend** → issues a fresh token and invalidates the previous one
- **Revoke** → invalidates the token immediately

### Failure modes
| Failure | Behaviour |
|---|---|
| Seat limit reached | Invitation blocked with the current count and the plan limit |
| Invitation expires unused | Marked expired; a new invitation is required |
| Email undeliverable | Surfaced to the Administrator; the invitation link can be copied and shared directly |

**Requirements:** [`REQ-USER-002`](#/functional-requirements) to [`REQ-USER-006`](#/functional-requirements) · [`REQ-BILL-006`](#/functional-requirements)

---

## JRN-05 — Member onboarding {P0} {Derived}

**Actor:** Employee · **Trigger:** receives an invitation · **Preconditions:** valid, unexpired invitation

### Main path
1. Opens the invitation link
2. **New user:** sets a name and password, account created and verified through the invitation
   **Existing user:** signs in
3. Membership is created with the invited role, status `active`
4. **Before any tracking begins**, the member is shown a monitoring disclosure: what is captured, how often, who can see it, and how long it is kept
5. Member acknowledges the disclosure; the acknowledgement is recorded with a timestamp
6. Member downloads and installs the desktop tracker
7. Signs in on the tracker; the Device is registered against the Membership
8. Member sees their assigned projects and tasks, and can start tracking

### Alternative paths
- **Member belongs to several organizations** → selects the active organization on the tracker; only that organization's projects are shown
- **Invitation expired** → member requests a new one; the Administrator is notified

### Failure modes
| Failure | Behaviour |
|---|---|
| Tracker install blocked by OS policy | Documented alternative install path; web-based tracking is **not** offered as a substitute |
| OS denies screen-recording or accessibility permission | Tracker runs with reduced capture and reports the reduced state to the member and to the organization — it must never appear to be capturing when it is not |
| Member declines the monitoring disclosure | Cannot start tracking; the Administrator is notified. This is a deliberate outcome, not an error |

:::warning Step 4 is not optional
Disclosure before first capture is what separates a monitoring product from a covert one. It is `{Proposed}` — no source requires it — and it is `{P0}` in this documentation. [`REQ-MON-009`](#/functional-requirements), [Security & Privacy](#/security-privacy)
:::

**Requirements:** [`REQ-USER-004`](#/functional-requirements) · [`REQ-AUTH-006`](#/functional-requirements) · [`REQ-DEV-001`](#/functional-requirements) · [`REQ-MON-009`](#/functional-requirements)

---

## JRN-06 — Project and task setup {P0} {Confirmed}

**Actor:** Administrator or Manager · **Trigger:** new work begins · **Preconditions:** members exist

### Main path
1. Creates a Project with name, description, colour, dates and status
2. Assigns Members to the Project
3. Creates Tasks within the Project with priority and due date
4. Assigns Members to Tasks
5. Assigned members see the Project and its Tasks in the tracker

### Alternative paths
- **Project completed** → status set to `completed`; existing time preserved; no new tracking accepted
- **Project archived** → hidden from selection; historical reporting unaffected
- **Member removed from a project** → past time entries remain attributed to the project

### Failure modes
| Failure | Behaviour |
|---|---|
| Duplicate project name | Permitted with a warning; names are not required to be unique |
| Task assigned to a non-project member | Blocked; the member must be assigned to the project first |
| Cross-organization assignment attempted | Rejected — a tenancy violation, and logged as one |

**Requirements:** [`REQ-PROJ-001`](#/functional-requirements) to [`REQ-PROJ-008`](#/functional-requirements)

---

## JRN-07 — Tracking a working session {P0} {Confirmed}

**Actor:** Employee · **Trigger:** starts work · **Preconditions:** authenticated tracker, registered device, at least one assigned project

### Main path
1. Selects a project and, optionally, a task
2. Presses Start
3. Tracker records a `session_started` event with a client-generated identifier and opens a Session
4. Tracker captures continuously per organization policy: activity samples, screenshots at the configured interval, application and website focus
5. Events are queued locally and batched to the server
6. Server records events and derives Time Entries
7. Member sees elapsed time, current project and task, and sync status
8. Member presses Stop; a `session_stopped` event closes the Session
9. Server finalises Time Entries for the Session

### Alternative paths
- **Pause and resume** → recorded as events; paused time is excluded from Time Entries
- **Project or task switched mid-session** → recorded as an event; the current Time Entry closes and a new one opens
- **Break declared** → break start and end events; break time excluded from worked time and recorded as a Break
- **Idle detected** → after the configured threshold, the member is prompted on return to keep, discard or reclassify the idle time as work or a break
- **Machine sleeps or locks** → treated as idle; on wake the tracker reconciles the gap and prompts
- **Automatic tracking mode** → the session starts without member action, only within scheduled hours, and is always visibly indicated

### Failure modes
| Failure | Behaviour |
|---|---|
| Tracker crashes mid-session | On restart, the local store is read, unsent events are sent, and the session is closed at the last known event time — never at restart time |
| Machine loses power | Same recovery; time after the last event is not claimed |
| Screenshot capture fails | Session continues; the failure is recorded so the evidence gap is visible rather than silent |
| Clock changed on the device | Server records both `occurred_at` and `received_at`; implausible skew is flagged for review — [`BR-TIME-008`](#/business-rules) |
| Member forgets to stop | Session is auto-stopped after a configurable maximum, and the member is prompted to confirm — [`BR-TIME-007`](#/business-rules) |

**Requirements:** [`REQ-TIME-001`](#/functional-requirements) to [`REQ-TIME-007`](#/functional-requirements) · [`REQ-MON-001`](#/functional-requirements) to [`REQ-MON-005`](#/functional-requirements)

---

## JRN-08 — Working offline and resynchronising {P0} {Confirmed}

**Actor:** Employee · **Trigger:** network becomes unavailable · **Preconditions:** an active session

### Main path
1. Tracker detects the network is unavailable
2. Capture continues unchanged; every event is written to the local durable store with a client-generated identifier
3. Member sees an explicit offline indicator and the amount of unsynchronised time
4. Network returns; the tracker begins sending queued batches oldest-first
5. Server processes each batch, ignoring any event whose identifier it has already stored
6. Server derives Time Entries from the newly received events
7. Tracker confirms synchronisation; the indicator clears

### Alternative paths
- **Reconnect mid-session** → the session continues; only the backlog is sent
- **Machine restarted while offline** → the local store survives; the queue resumes on next launch
- **Very long offline period** → batches are sent in sequence with backoff; progress is shown to the member

### Failure modes
| Failure | Behaviour |
|---|---|
| Server rejects a batch as malformed | Batch is quarantined locally, not discarded; the failure is reported to platform monitoring |
| Duplicate batch sent after a timeout | Server creates nothing new — event identifiers already exist |
| Local store corrupted | Unrecoverable events are reported to the member with the affected period stated explicitly. **Silent loss is not acceptable** |
| Sync unresolved past a threshold | Member and organization are both alerted; unresolved sync backlog appears in platform health |

:::warning This journey is the product's core promise
`SC-02` and `SC-03` in [Project Planning](#/project-planning) test exactly this path. If it is not lossless and idempotent, nothing downstream can be trusted.
:::

**Requirements:** [`REQ-SYNC-001`](#/functional-requirements) to [`REQ-SYNC-006`](#/functional-requirements)

---

## JRN-09 — Correcting tracked time {P0} {Derived}

**Actor:** Employee (own time) or Manager (team time) · **Trigger:** an entry is wrong · **Preconditions:** entry is not in an approved timesheet

### Main path
1. Opens their time entries for a date
2. Selects the entry to correct
3. Edits the times, project, task or adds a missing entry
4. Provides a reason — **mandatory**
5. System validates against the correction window and overlap rules
6. Entry is recorded with `source = manual` or marked edited, with the actor and reason retained
7. Audit record written; the manager is notified if the organization requires it

### Alternative paths
- **Adding forgotten time** → a new manual entry within the permitted window
- **Deleting erroneous time** → marked `discarded` with a reason, never physically removed
- **Manager corrects on a member's behalf** → the member is notified; the actor is recorded as the manager
- **Correction after approval** → refused. The timesheet must be reopened first — [`JRN-14`](#jrn-14)

### Failure modes
| Failure | Behaviour |
|---|---|
| Correction overlaps an existing entry | Rejected with the conflicting entry shown — [`BR-TIME-004`](#/business-rules) |
| Correction outside the permitted window | Rejected; escalation to a Manager offered |
| Correction would exceed a daily maximum | Flagged for review rather than silently accepted |
| Reason omitted | Rejected — the reason is what makes the correction defensible |

:::note Corrections must be normal, not exceptional
Time tracking systems that make correction difficult get worked around — people stop tracking accurately because fixing it is painful. Correction is designed as a routine, attributed, audited action. `{Proposed}`, `GAP-06`.
:::

**Requirements:** [`REQ-TIME-008`](#/functional-requirements) to [`REQ-TIME-011`](#/functional-requirements) · [`BR-TIME-004`](#/business-rules), [`BR-TIME-005`](#/business-rules)

---

## JRN-10 — Requesting and approving leave {P0} {Confirmed} {Standard}

**Actor:** Employee (requests), Manager (decides) · **Preconditions:** `leave` entitlement; leave types defined

### Main path
1. Employee selects a leave type and a date range and adds a reason
2. System creates the request in `pending` and notifies the approving Manager
3. Manager reviews, seeing the team's leave calendar for the period
4. Manager approves or rejects with a comment
5. Employee is notified
6. Approved leave produces attendance status `on_leave` for the covered dates — **never `absent`**

### Alternative paths
- **Leave type requires no approval** → auto-approved on submission
- **Employee cancels before decision** → status `cancelled`
- **Employee cancels approved future leave** → permitted; attendance for those dates reverts
- **Retrospective leave for a past date** → permitted; attendance for those dates is recomputed

### Failure modes
| Failure | Behaviour |
|---|---|
| Overlapping request | Rejected with the conflicting request shown |
| Leave overlaps time already tracked | Flagged to both parties; not silently overwritten — [`BR-LEAVE-004`](#/business-rules) |
| No approver configured | Falls back to any Administrator; the gap is surfaced |
| Balance check requested | **Not available at MVP** — `CONF-09` |

**Requirements:** [`REQ-LEAVE-001`](#/functional-requirements) to [`REQ-LEAVE-006`](#/functional-requirements) · [`BR-ATT-004`](#/business-rules)

---

## JRN-11 — Schedule configuration {P0} {Confirmed} {Standard}

**Actor:** Administrator · **Preconditions:** `schedules` entitlement

### Main path
1. Creates a Schedule with a name and its own timezone
2. Defines a Shift per working day: start, end, expected break duration, minimum work time
3. Leaves non-working days undefined — they become `rest_day`
4. Assigns the Schedule to Members with an effective-from date
5. Attendance derivation begins using the Schedule from that date

### Alternative paths
- **Overnight shift (22:00 → 06:00)** → supported; the end time being earlier than the start time is valid and means the shift crosses midnight
- **Member changes schedule** → the previous assignment is closed with an effective-until date; history is not rewritten
- **Team in a different timezone** → a separate Schedule with its own timezone
- **Public holiday** → the holiday calendar produces attendance status `holiday`

### Failure modes
| Failure | Behaviour |
|---|---|
| Overlapping assignments for one member | Rejected — [`BR-SCHED-003`](#/business-rules) |
| Schedule changed retroactively over derived attendance | Requires confirmation and triggers recomputation, with an audit record |
| DST transition inside a shift | Expected duration is computed in the schedule's timezone, so a 23- or 25-hour day is handled correctly — [`BR-SCHED-005`](#/business-rules) |
| No schedule assigned | Attendance cannot be derived; the member is listed as unscheduled rather than absent |

**Requirements:** [`REQ-SCHED-001`](#/functional-requirements) to [`REQ-SCHED-006`](#/functional-requirements)

---

## JRN-12 — Reviewing team activity {P0} {Confirmed}

**Actor:** Manager · **Trigger:** daily review · **Preconditions:** Manager scope over at least one Member

### Main path
1. Opens the team dashboard for a date or range
2. Sees per member: tracked hours, activity percentage, attendance status, current tracking state
3. Sees team totals and exceptions — late, absent, no data, sync backlog
4. Drills into a member's day: timeline of sessions, idle, breaks, applications, websites and screenshots on one axis
5. Filters by project, task or team
6. Exports if needed

### Alternative paths
- **Member currently tracking** → live status shown, refreshed on the real-time channel where entitled
- **Member has no data** → distinguished explicitly between "not scheduled", "on leave", "not tracking" and "tracker not syncing" — these four look identical in a naive implementation and mean completely different things
- **Basic plan** → activity, web/app usage and attendance columns are shown as requiring an upgrade, not hidden

### Failure modes
| Failure | Behaviour |
|---|---|
| Large date range | Paginated; export is queued and delivered asynchronously |
| Manager requests a member outside scope | Refused and logged |
| Screenshots unavailable due to retention | Explained as expired, not shown as missing |

**Requirements:** [`REQ-REPORT-001`](#/functional-requirements) to [`REQ-REPORT-009`](#/functional-requirements)

---

## JRN-13 — Investigating an anomaly {P1} {Confirmed}

**Actor:** Manager · **Trigger:** an alert, an odd figure, or a dispute · **Preconditions:** Manager scope; relevant entitlements

### Main path
1. Opens the member's timeline for the period in question
2. Correlates on one axis: time entries, idle periods, breaks, activity percentage, applications, websites, screenshots and — where Premium — recording
3. Identifies the cause: forgotten stop, idle during a call, misattributed project, sync gap
4. Takes action: requests a correction, corrects on the member's behalf, or rejects the timesheet with a comment
5. Every action is audit-logged and the member is notified

### Alternative paths
- **Evidence gap** → the timeline distinguishes "no capture configured", "capture failed" and "expired under retention"
- **Sync backlog explains it** → the manager sees the sync state rather than concluding the member did not work
- **Member disputes the finding** → the member's own view (see [`JRN-18`](#jrn-18)) shows exactly the same data, so the discussion is about facts rather than access

### Failure modes
| Failure | Behaviour |
|---|---|
| Screenshots expired | Stated plainly with the retention window that applied |
| Recording failed to upload | Recording status shows the failure; segments that did upload are still playable |
| Timeline components disagree | The underlying events are authoritative; derived values are recomputed |

:::note This journey justifies the timeline report
If time, activity and evidence cannot be read together on one axis, investigation degrades into cross-referencing four screens by hand, and managers stop doing it. `resources-1.md` §18 identifies this correctly.
:::

**Requirements:** [`REQ-REPORT-003`](#/functional-requirements) · [`REQ-MON-006`](#/functional-requirements) · [`REQ-TIME-010`](#/functional-requirements)

---

## JRN-14 — Timesheet submission and approval {P0} {Confirmed} {Standard}

**Actor:** Employee (submits), Manager (decides) · **Preconditions:** `time_approvals` entitlement; period ended

### Main path
1. System generates a draft Timesheet for the member covering the configured period
2. Employee reviews the included time entries and totals
3. Employee submits; status becomes `submitted`, each entry's duration is **snapshotted**, and the Manager is notified
4. Manager reviews, with anomalies surfaced
5. Manager approves; status becomes `approved` and an immutable Approval record is written
6. Employee is notified; the time is now available to payroll

### Alternative paths
- **Manager rejects** → a comment is mandatory; status returns to `draft`; the employee corrects and resubmits
- **Manager requests changes** → similar, with the specific entries flagged
- **Employee corrects before submitting** → normal editing, no approval needed
- **Approved timesheet must change** → a permissioned **reopen** action, audit-logged, which returns it to `draft` and invalidates any payroll entry derived from it
- **Employee does not submit** → the period is escalated; the Manager may submit on the employee's behalf, recorded as such

### Failure modes
| Failure | Behaviour |
|---|---|
| Manager attempts to approve their own timesheet | Refused — [`BR-TS-005`](#/business-rules) |
| Time entry edited after submission | Refused; the snapshot protects the submitted figure — [`BR-TS-004`](#/business-rules) |
| Reopen after payroll processed | Requires the payroll period to be reopened first; the dependency is stated explicitly — [`BR-PAY-005`](#/business-rules) |
| Approver has left the organization | Approval history is retained with the historical actor; a current approver is required for new decisions |

**Requirements:** [`REQ-TS-001`](#/functional-requirements) to [`REQ-TS-008`](#/functional-requirements)

---

## JRN-15 — Payroll preparation and export {P0} {Confirmed} {Standard}

**Actor:** Owner or Administrator · **Preconditions:** `payroll` entitlement; pay rates set; timesheets approved

### Main path
1. Creates a Payroll Period with a start and end date
2. System lists members with approved time in the period and flags any unapproved time as excluded
3. Operator resolves outstanding approvals or proceeds with the exclusion acknowledged
4. Operator triggers calculation
5. For each member the system applies the Pay Rate effective for the period, computes gross, applies adjustments, computes net, and **snapshots the rate applied**
6. Period reaches `calculated`; the operator reviews
7. Operator approves; the period is `approved`, then `processed`
8. Operator exports CSV

### Alternative paths
- **Rate change mid-period** → each portion is calculated at the rate effective for its dates
- **Adjustment applied** → a single amount per member with a description
- **Recalculation before approval** → permitted, and audit-logged
- **Reopen after processing** → permissioned, audited, and it invalidates the export

### Failure modes
| Failure | Behaviour |
|---|---|
| Member has no pay rate | Listed as an exception; calculation does not proceed silently with zero |
| Calculation fails | Period moves to `failed` and is retryable; no partial entries are left behind |
| Mixed currencies | Each entry keeps its own currency; **no conversion is performed** — [`BR-PAY-003`](#/business-rules) |
| Approved timesheet reopened after processing | Blocked until the payroll period is reopened |

:::warning Payroll preparation, not payroll
No tax, no statutory deduction, no overtime calculation and no disbursement. The export is an input to a real payroll system. `CONF-10`
:::

**Requirements:** [`REQ-PAY-001`](#/functional-requirements) to [`REQ-PAY-008`](#/functional-requirements)

---

## JRN-16 — Subscription management {P0} {Derived}

**Actor:** Owner · **Preconditions:** Owner role

### Main path
1. Views current plan, status, period, seat usage and invoices
2. Upgrades, downgrades, updates the payment method or cancels
3. Entitlements change according to the action
4. Change is confirmed by email and audit-logged

### Alternative paths
- **Upgrade** → new entitlements active immediately; billing is prorated according to the provider's model
- **Downgrade** → takes effect at the end of the current period; consequences for entitlements and retention are stated before confirmation
- **Cancel** → status `canceled`; access continues to the period end; then the restricted state applies
- **Reactivate** → permitted while data is still within retention

### Failure modes
| Failure | Behaviour |
|---|---|
| Payment fails | Status `past_due`; grace period; escalating notification; access maintained during grace |
| Seats exceed the target plan | Downgrade blocked until memberships are removed |
| Provider webhook lost | Reconciliation job compares provider state against local state — [`REQ-BILL-008`](#/functional-requirements) |

**Requirements:** [`REQ-BILL-001`](#/functional-requirements) to [`REQ-BILL-009`](#/functional-requirements)

---

## JRN-17 — Monitoring and retention configuration {P0} {Confirmed} + {Proposed}

**Actor:** Administrator · **Trigger:** setup or policy change · **Preconditions:** Administrator or Owner

### Main path
1. Opens monitoring settings and sees, for each capture type, what it collects and who can see it
2. Enables or disables per type: screenshots, activity, application usage, website usage, screen recording
3. Sets the screenshot interval and whether capture times are randomised within it
4. Sets the idle threshold
5. Sets the tracking mode: user-controlled or automatic
6. Sets retention per data type, bounded above by the plan entitlement
7. Reviews a plain-language summary of what members will be told
8. Saves; every change is audit-logged and **affected members are notified of the change**

### Alternative paths
- **Enabling a more intrusive setting** → members are notified before it takes effect `{Proposed}`
- **Reducing retention** → data outside the new window becomes eligible for deletion; confirmation is required with the volume affected stated
- **Entitlement missing** → the setting is shown as requiring a plan upgrade

### Failure modes
| Failure | Behaviour |
|---|---|
| Retention above the plan ceiling | Rejected with the maximum stated |
| Screenshot interval below the minimum | Rejected — [`BR-MON-002`](#/business-rules) |
| Recording enabled without the entitlement | Refused at the API, not only in the UI |

:::warning Notifying members of monitoring changes is `{Proposed}` and `{P0}`
No source requires it. It is the difference between a configurable monitoring product and a covert one, and it is far cheaper to build now than to add after a trust incident. [`REQ-MON-009`](#/functional-requirements)
:::

**Requirements:** [`REQ-ORG-007`](#/functional-requirements) · [`REQ-MON-009`](#/functional-requirements) · [`REQ-DATA-001`](#/functional-requirements) to [`REQ-DATA-003`](#/functional-requirements)

---

## JRN-18 — Reviewing your own record {P0} {Proposed}

**Actor:** Employee · **Trigger:** curiosity, a dispute, or a pay query · **Preconditions:** active Membership

### Main path
1. Opens their personal record
2. Sees, for any date they choose: tracked sessions and time entries; idle periods and breaks; activity percentages; applications and websites recorded; every screenshot captured; every recording made
3. Sees their attendance, timesheets, approval history and current pay rate
4. Sees the organization's current monitoring policy and retention periods
5. Can export their own data
6. Can request deletion of a specific screenshot or recording, with a reason; the request goes to an Administrator and is audit-logged

### Alternative paths
- **Data expired under retention** → shown as expired with the window that applied, rather than as absent
- **Deletion request approved** → media is deleted from object storage first, then metadata; both the request and the outcome are audit-logged
- **Deletion request refused** → the member is told, with a reason

### Failure modes
| Failure | Behaviour |
|---|---|
| Member requests another member's data | Refused and logged |
| Export is large | Queued and delivered asynchronously via a time-limited link |
| Deletion request would remove evidence for a period under dispute | Administrator may refuse with a reason; the refusal is recorded |

:::note This journey has no source requirement at all
Nothing in `resources/` mentions it. It is `{Proposed}` and rated `{P0}` because a monitoring product where the monitored person cannot see their own record is (a) hard to defend in several jurisdictions, (b) impossible to argue for in an employment dispute, and (c) extremely expensive to retrofit once every capture path has shipped without it. `GAP-07`
:::

**Requirements:** [`REQ-MON-010`](#/functional-requirements) · [`REQ-MON-011`](#/functional-requirements) · [`REQ-DATA-005`](#/functional-requirements)

---

## Journey coverage check

| Module | Covered by |
|---|---|
| AUTH | JRN-01, JRN-05 |
| ORG | JRN-01, JRN-03, JRN-17 |
| USER | JRN-04, JRN-05 |
| RBAC | JRN-01, JRN-04 |
| TEAM | JRN-03, JRN-12 |
| PROJ | JRN-06 |
| DEV | JRN-05, JRN-07 |
| TIME | JRN-07, JRN-09 |
| SYNC | JRN-08 |
| MON | JRN-07, JRN-13, JRN-17, JRN-18 |
| REC | JRN-13, JRN-17, JRN-18 |
| SCHED | JRN-11 |
| ATT | JRN-10, JRN-11, JRN-12 |
| LEAVE | JRN-10 |
| TS | JRN-14 |
| PAY | JRN-15 |
| REPORT | JRN-12, JRN-13 |
| NOTIF | JRN-04, JRN-10, JRN-14, JRN-17 |
| BILL | JRN-02, JRN-16 |
| AUDIT | JRN-03, JRN-09, JRN-14, JRN-17, JRN-18 |
| DATA | JRN-17, JRN-18 |
| ADMIN | **Not covered by an end-user journey** — platform operations are described in [Stakeholders](#/stakeholders) and specified in the `ADMIN` requirements |
