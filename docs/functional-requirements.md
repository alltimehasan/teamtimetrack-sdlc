# Functional Requirements

**Specification:** Team Time Track SRS foundation, v1.0
**Requirement count:** 162
**Convention:** every requirement is written as *"The system shall…"*, has exactly one owning module, one priority, one evidence class, and at least one testable acceptance criterion.

---

## How to read this document

### Requirement anatomy

Requirements come in two shapes. Both are normative; the difference is only how much elaboration the requirement needs.

**Detailed** — used where flow, alternatives and failure handling materially affect implementation. Carries actor, preconditions, main flow, alternative flows, exceptions, business rules and acceptance criteria.

**Compact** — used where the requirement is a single well-bounded capability. Carries a shall statement, actor, dependencies and acceptance criteria.

### Acceptance criteria

Written in Given/When/Then where a state transition is involved, and as verifiable assertions otherwise. A requirement without a criterion that can fail is not a requirement.

### Badges on every requirement

`{P0}`–`{P3}` priority · `{MVP}`/`{V1.1}`/`{V2}`/`{Future}` release · `{Confirmed}`/`{Derived}`/`{Proposed}`/`{Open}` evidence · `{Basic}`/`{Standard}`/`{Premium}` entitlement floor where one applies.

### Universal preconditions

Unless a requirement states otherwise, all of the following are preconditions and are **not** repeated on each requirement:

1. The actor is authenticated.
2. The actor has an active Membership in the Organization the request targets.
3. The request resolves to exactly one Organization, and every record read or written belongs to it — [`BR-ORG-001`](#/business-rules).
4. The actor holds the permission the action requires — [`BR-RBAC-001`](#/business-rules).
5. The Organization holds the entitlement the feature requires — [`BR-BILL-001`](#/business-rules).
6. The Organization's subscription is not `expired` and the Organization is not `suspended`.

### Universal error behaviour

| Condition | Response |
|---|---|
| Not authenticated | Reject; no information about the resource is disclosed |
| Authenticated, wrong organization | Reject as not found — never as forbidden, which would confirm existence |
| Authenticated, correct organization, missing permission | Reject as forbidden, and record the attempt |
| Missing entitlement | Reject with the plan required, and the attempt is recorded |
| Validation failure | Reject with per-field detail; no partial write |
| Downstream failure (storage, provider, queue) | Fail the operation atomically; never leave a partial record |

---

# AUTH · Authentication & Identity

## REQ-AUTH-001 — User registration
{P0} {MVP} {Derived}

**Statement.** The system shall allow a person to register a global User account with a name, a unique email address and a password.

| | |
|---|---|
| **Actor** | Prospective Owner, or an invited person |
| **Preconditions** | None |
| **Dependencies** | — |

**Main flow**
1. Actor submits name, email and password.
2. System validates the email format and the password against the password policy.
3. System verifies the email is not already registered.
4. System creates the User with status `active` and `email_verified_at` unset.
5. System issues a verification token and sends a verification email.
6. System returns success without authenticating the actor.

**Alternative flows**
- **A1 — Email already registered.** System returns a generic success-shaped response and sends an email to the existing address stating that a registration was attempted. No new account is created.
- **A2 — Registering from an invitation link.** The invitation's email address is pre-filled and immutable; on completion the account is created and treated as verified, since possession of the invitation proves control of the mailbox.

**Exceptions**
| Condition | Behaviour |
|---|---|
| Password fails policy | Reject with the specific unmet rules |
| Email malformed | Reject |
| Registration rate limit exceeded for the source | Reject and record |
| Email delivery fails | Account is retained; resend is available |

**Business rules** [`BR-AUTH-001`](#/business-rules), [`BR-AUTH-002`](#/business-rules)

**Acceptance criteria**
1. Given a valid, unused email, when registration is submitted, then a User exists with status `active`, `email_verified_at` null, and a verification email has been queued.
2. Given an already-registered email, when registration is submitted, then no second User is created and the response is indistinguishable from a successful registration.
3. Given a password below policy, when registration is submitted, then no User is created and the unmet rules are named.
4. The stored password is never recoverable in plaintext from the database or logs.

---

## REQ-AUTH-002 — Email verification
{P0} {MVP} {Derived} · Actor: Registered User · Depends: `REQ-AUTH-001`

**The system shall** require a User to verify their email address before creating or joining an Organization, using a single-use token that expires after a defined period.

**Acceptance criteria**
- A valid unexpired token sets `email_verified_at` and invalidates the token.
- A used or expired token is rejected with the option to request a new one.
- An unverified User attempting to create an Organization is refused with the reason.
- Verification tokens are stored hashed, never in plaintext.

---

## REQ-AUTH-003 — Login
{P0} {MVP} {Derived} · Actor: User · Depends: `REQ-AUTH-002`

**The system shall** authenticate a User by email and password and establish a session appropriate to the client type: a secure, HttpOnly, SameSite cookie for the web application, and a device-scoped token for the desktop tracker.

**Acceptance criteria**
- Correct credentials for a verified, active User establish a session.
- Incorrect credentials fail with a message that does not reveal whether the email exists.
- A User with status `suspended` or `deactivated` cannot authenticate.
- The web application never receives a long-lived token in a JavaScript-readable store.
- `last_login_at` is updated on success.

---

## REQ-AUTH-004 — Logout and session termination
{P0} {MVP} {Derived} · Actor: User · Depends: `REQ-AUTH-003`

**The system shall** allow a User to terminate the current session, and to terminate all other active sessions and device tokens.

**Acceptance criteria**
- After logout, the terminated session's credentials are rejected.
- Terminating all sessions revokes every device token for that User, and each affected tracker requires re-authentication on its next request.

---

## REQ-AUTH-005 — Password reset
{P0} {MVP} {Derived} · Actor: User · Depends: `REQ-AUTH-001`

**The system shall** allow a User to reset a forgotten password using a single-use, time-limited token delivered by email.

**Acceptance criteria**
- Requesting a reset for an unknown address produces the same response as for a known one.
- A successful reset invalidates the token, all existing sessions and all device tokens.
- Reset tokens are stored hashed.
- Reset requests are rate-limited per address and per source.

---

## REQ-AUTH-006 — Desktop device authentication
{P0} {MVP} {Derived} · Actor: Desktop Tracker · Depends: `REQ-AUTH-003`, `REQ-DEV-001`

**The system shall** authenticate the desktop tracker with a token bound to a registered Device and one Membership, stored in the operating system's credential store, and revocable independently of web sessions.

**Acceptance criteria**
- A device token authorises requests only for the Membership and Organization it was issued for.
- Revoking a Device invalidates its token immediately; the next request is rejected.
- The token is never written to application logs, crash reports or plaintext configuration files.
- A token for a suspended Membership is rejected.

---

## REQ-AUTH-007 — Password change
{P1} {MVP} {Derived} · Actor: User

**The system shall** allow an authenticated User to change their password by supplying the current password, and shall terminate all other sessions on success.

**Acceptance criteria**
- An incorrect current password is rejected without changing anything.
- On success, the current session survives and all others are terminated.
- The User is notified by email that the password changed.

---

## REQ-AUTH-008 — Credential endpoint rate limiting
{P0} {MVP} {Derived} · Actor: System

**The system shall** rate-limit login, registration, password reset, invitation acceptance and email verification by source address and by target account, and shall record limit breaches.

**Acceptance criteria**
- Repeated failed logins for one account are throttled independently of source address.
- Throttling responses do not disclose whether the account exists.
- Breaches are visible in platform health.

---

## REQ-AUTH-009 — Account deactivation
{P1} {MVP} {Derived} · Actor: User, Platform Administrator

**The system shall** allow a User account to be deactivated, preventing authentication while retaining all historical records associated with their Memberships.

**Acceptance criteria**
- A deactivated User cannot authenticate on any client.
- Time entries, timesheets, approvals and payroll entries associated with that person's Memberships remain intact and reportable.
- Deactivation is audit-logged in every Organization where the User held a Membership.

---

## REQ-AUTH-010 — Session inventory
{P2} {V1.1} {Proposed} · Actor: User

**The system shall** allow a User to view their active web sessions and registered Devices, with last-used time and origin, and to revoke any of them.

**Acceptance criteria**
- Each entry shows client type, last activity time and approximate origin.
- Revoking an entry terminates it within one request cycle.

---

# ORG · Organization Management

## REQ-ORG-001 — Create an Organization
{P0} {MVP} {Derived}

**Statement.** The system shall allow a verified User to create an Organization, becoming its Owner.

| | |
|---|---|
| **Actor** | Verified User |
| **Preconditions** | Email verified |
| **Dependencies** | `REQ-AUTH-002` |

**Main flow**
1. Actor submits organization name, timezone, country and currency.
2. System generates a unique slug from the name.
3. System creates the Organization with status `trialing`.
4. System creates a Membership linking the actor to the Organization with status `active`.
5. System assigns the Owner role to that Membership.
6. System creates default organization settings, default leave types, and default retention policies bounded by the plan's retention entitlement.
7. System writes an audit record.

**Alternative flows**
- **A1 — Slug collision.** System appends a disambiguating suffix and offers the result for editing.
- **A2 — Actor already owns Organizations.** Creation proceeds; the actor may switch between them.

**Exceptions**
| Condition | Behaviour |
|---|---|
| Email unverified | Reject with the reason |
| Invalid timezone, country or currency identifier | Reject per field |
| Any step fails | Whole creation is rolled back — no Organization without an Owner |

**Business rules** [`BR-ORG-003`](#/business-rules), [`BR-ORG-004`](#/business-rules)

**Acceptance criteria**
1. Given a verified User, when an Organization is created, then that User holds exactly one Membership in it with the Owner role.
2. Every new Organization has settings, default leave types and retention policies present immediately.
3. No Organization can exist without exactly one Owner.
4. Two Organizations never share a slug.

---

## REQ-ORG-002 — Organization identity settings
{P0} {MVP} {Derived} · Actor: Owner, Administrator

**The system shall** allow the Organization's name, slug and logo to be maintained, with slug uniqueness enforced platform-wide.

**Acceptance criteria**
- A slug already in use is rejected with alternatives offered.
- Logo uploads are validated for type and size and stored in private object storage.
- Every change is audit-logged with before and after values.

---

## REQ-ORG-003 — Organization locale settings
{P0} {MVP} {Derived} · Actor: Owner, Administrator

**The system shall** allow the Organization's timezone, country, default currency, date format, time format and week start day to be configured, and shall use them to render all dates, times and durations in the web application.

**Acceptance criteria**
- All instants remain stored in UTC; locale settings affect presentation and calendar-boundary calculations only — [`BR-ORG-005`](#/business-rules).
- Changing the timezone does not alter any stored instant.
- Changing the timezone warns that day boundaries in reports will shift.
- Week start affects weekly report and timesheet boundaries.

---

## REQ-ORG-004 — Working-day defaults
{P1} {MVP} {Derived} · Actor: Administrator

**The system shall** allow default working days and default daily hours to be configured, used where no Schedule is assigned.

**Acceptance criteria**
- Defaults apply only to Members with no effective Schedule assignment.
- A Member with neither a Schedule nor applicable defaults is reported as unscheduled, never as absent.

---

## REQ-ORG-005 — Tracking policy settings
{P0} {MVP} {Derived} · Actor: Administrator

**The system shall** allow the idle threshold, minimum tracking interval, maximum unattended session duration and tracking mode (user-controlled or automatic) to be configured per Organization.

**Acceptance criteria**
- The idle threshold is bounded to a defined minimum and maximum — [`BR-TIME-003`](#/business-rules).
- Changes apply to trackers on their next policy refresh and are reported to affected Members.
- Every change is audit-logged.

---

## REQ-ORG-006 — Organization switching
{P1} {MVP} {Derived} · Actor: User with multiple Memberships

**The system shall** allow a User holding Memberships in more than one Organization to switch the active Organization in both the web application and the desktop tracker, with all data and permissions re-scoped on switch.

**Acceptance criteria**
- After switching, no data from the previous Organization is visible or reachable.
- Roles are resolved from the Membership in the newly active Organization, not carried over.
- On the tracker, switching while a session is active is refused until the session is stopped.

---

## REQ-ORG-007 — Monitoring policy settings
{P0} {MVP} {Confirmed} + {Proposed}

**Statement.** The system shall allow an Organization to configure, per capture type, whether it is enabled and how it behaves — and shall notify affected Members when the configuration becomes more intrusive.

| | |
|---|---|
| **Actor** | Owner, Administrator |
| **Dependencies** | `REQ-BILL-002`, `REQ-MON-009` |
| **Entitlement** | Per capture type; screenshots {Basic}, activity and web/app {Standard}, recording {Premium} |

**Main flow**
1. Actor opens monitoring settings and sees, for each capture type, what it collects, who can view it and how long it is retained.
2. Actor enables or disables screenshots, activity capture, application usage, website usage and screen recording.
3. Actor sets the screenshot interval and whether capture is randomised within the interval.
4. Actor reviews a plain-language summary of what Members will be told.
5. System saves, writes an audit record with before and after values, and notifies affected Members of any change that increases capture.

**Alternative flows**
- **A1 — Entitlement absent.** The capture type is shown as requiring a named plan; it is not hidden.
- **A2 — Capture disabled.** Existing captured data is retained under the retention policy; no new data of that type is captured.

**Exceptions**
| Condition | Behaviour |
|---|---|
| Screenshot interval below the configured floor | Reject, stating the minimum — [`BR-MON-002`](#/business-rules) |
| Recording enabled without the entitlement | Reject at the API regardless of the client used |

**Business rules** [`BR-MON-001`](#/business-rules), [`BR-MON-002`](#/business-rules), [`BR-MON-008`](#/business-rules)

**Acceptance criteria**
1. Given a Basic Organization, when screen recording is enabled through a direct API call, then the request is refused and recorded.
2. Given screenshots are enabled at a longer interval and then shortened, then every affected Member receives a notification before the change takes effect.
3. Disabling a capture type stops new capture within one tracker policy refresh and does not delete existing data.
4. Every monitoring settings change produces an audit record containing both old and new values.

---

## REQ-ORG-008 — Organization status lifecycle
{P1} {MVP} {Derived} · Actor: Owner, Platform Administrator

**The system shall** support Organization statuses `trialing`, `active`, `suspended` and `closed`, and shall restrict behaviour accordingly.

**Acceptance criteria**
- A `suspended` Organization permits no authentication into it, no capture and no data modification; data is retained.
- A `closed` Organization permits export for a defined grace period, after which its data becomes eligible for deletion.
- Status transitions are audit-logged with the actor and reason.

---

# USER · Membership & User Management

## REQ-USER-001 — Membership as the authorization context
{P0} {MVP} {Derived} · Actor: System

**The system shall** represent a person's participation in an Organization as a Membership, and shall resolve that person's roles, teams, projects, schedule, pay rate and notification preferences from the Membership rather than from the global User.

**Acceptance criteria**
- One User can hold Memberships in many Organizations, with different roles in each.
- No permission, team, project, schedule or rate is resolvable without a Membership context.
- A User with no Membership in an Organization cannot read any of its data by any route.
- `UNIQUE(organization, user)` — a User cannot hold two Memberships in one Organization.

---

## REQ-USER-002 — Invite a person to an Organization
{P0} {MVP} {Derived}

**Statement.** The system shall allow an authorised Member to invite one or more email addresses to join the Organization with a specified role.

| | |
|---|---|
| **Actor** | Owner, Administrator |
| **Preconditions** | Seat capacity available under the plan |
| **Dependencies** | `REQ-BILL-006`, `REQ-NOTIF-002` |

**Main flow**
1. Actor submits email addresses and selects a role.
2. System validates each address and checks it is not already a Member.
3. System checks seat capacity for the count being invited.
4. For each address, System creates an Invitation with a hashed single-use token and an expiry.
5. System queues an invitation email per address.
6. Invitations appear in a pending list with their expiry.

**Alternative flows**
- **A1 — Address belongs to an existing platform User.** The Invitation links to that User; no second account is created.
- **A2 — Bulk invite, partial validity.** Valid addresses are invited; invalid ones are reported individually; the operation is not all-or-nothing.

**Exceptions**
| Condition | Behaviour |
|---|---|
| Seat limit would be exceeded | Reject, stating current usage and the plan limit |
| Address is already an active Member | Reject that address with the reason |
| Address has an unexpired pending Invitation | Offer resend instead of duplicating |
| Email delivery fails | Report to the actor; allow the link to be copied and shared directly |

**Business rules** [`BR-USER-001`](#/business-rules), [`BR-BILL-004`](#/business-rules)

**Acceptance criteria**
1. Invitation tokens are stored hashed; the plaintext token exists only in the email.
2. An expired Invitation cannot be accepted under any circumstances.
3. Inviting beyond the seat limit is refused before any Invitation is created.
4. A bulk invite with a mix of valid and invalid addresses creates Invitations for the valid ones only, and reports each failure.

---

## REQ-USER-003 — Resend and revoke an invitation
{P0} {MVP} {Derived} · Actor: Owner, Administrator · Depends: `REQ-USER-002`

**The system shall** allow a pending Invitation to be resent, which issues a new token and invalidates the previous one, or revoked, which invalidates it immediately.

**Acceptance criteria**
- After a resend, the earlier token is rejected.
- After a revoke, the token is rejected and the Invitation is no longer pending.
- Both actions are audit-logged.

---

## REQ-USER-004 — Accept an invitation
{P0} {MVP} {Derived} · Actor: Invited person · Depends: `REQ-USER-002`

**The system shall** create a Membership with the invited role when a valid, unexpired Invitation is accepted, creating the User account first if one does not exist.

**Acceptance criteria**
- Acceptance by a new person creates a verified User and an `active` Membership atomically.
- Acceptance by an existing User creates only the Membership.
- The Invitation is marked accepted and cannot be reused.
- The inviting Member is notified.
- Acceptance is refused if it would exceed the seat limit at the time of acceptance, not only at the time of invitation.

---

## REQ-USER-005 — Suspend or remove a Member
{P0} {MVP} {Derived} · Actor: Owner, Administrator

**The system shall** allow a Membership to be suspended, blocking access and capture while retaining all data, or removed, ending participation while retaining all historical records.

**Acceptance criteria**
- A suspended Membership cannot authenticate into that Organization; its device tokens are rejected.
- A removed Membership's time entries, timesheets, approvals, attendance and payroll entries remain intact and reportable.
- Removal never cascades to historical business records — [`BR-USER-003`](#/business-rules).
- An active tracking session is stopped when the Membership is suspended or removed.
- The Owner's Membership cannot be removed or suspended while they are the Owner — [`BR-ORG-004`](#/business-rules).

---

## REQ-USER-006 — Member directory
{P1} {MVP} {Derived} · Actor: Owner, Administrator, Manager (scope)

**The system shall** provide a searchable, filterable, paginated list of Memberships showing role, teams, status, schedule, last activity and device sync state.

**Acceptance criteria**
- Filterable by role, team, status and tracking state.
- A Manager sees only Memberships within their scope.
- The list distinguishes "not tracking" from "tracker not syncing".

---

## REQ-USER-007 — Ownership transfer
{P1} {MVP} {Derived} · Actor: Owner

**The system shall** allow the Owner to transfer ownership to another active Member, after which the transferring Member retains an Administrator role unless changed.

**Acceptance criteria**
- Exactly one Owner exists at every point during and after the transfer.
- The transfer requires re-authentication of the current Owner.
- Both parties are notified and the transfer is audit-logged.

---

# RBAC · Roles & Permissions

## REQ-RBAC-001 — Permission catalogue
{P0} {MVP} {Derived} · Actor: System

**The system shall** define permissions as `<resource>.<action>` and shall evaluate every state-changing and data-reading operation against the permission set of the acting Membership.

**Acceptance criteria**
- Every API operation maps to at least one named permission.
- An operation with no mapped permission fails a build-time or test-time coverage check.
- Permission evaluation always occurs server-side.

---

## REQ-RBAC-002 — System roles
{P0} {MVP} {Derived} · Actor: System

**The system shall** provide four system roles — Owner, Administrator, Manager, Employee — present in every Organization and not deletable.

**Acceptance criteria**
- Every new Organization has all four roles available immediately.
- System roles cannot be deleted; their permission sets cannot be edited at MVP.
- Owner permissions are a strict superset of Administrator permissions.
- Employee permissions grant access to the Member's own data only.

---

## REQ-RBAC-003 — Role assignment
{P0} {MVP} {Derived} · Actor: Owner, Administrator

**The system shall** allow roles to be assigned to and removed from a Membership, with changes taking effect on the Member's next request.

**Acceptance criteria**
- A Membership always holds at least one role.
- Assigning the Owner role is possible only through ownership transfer — [`REQ-USER-007`](#req-user-007).
- Role changes are audit-logged with before and after values.
- A Member cannot change their own role.

---

## REQ-RBAC-004 — Manager scope
{P0} {MVP} {Derived} · Actor: System

**The system shall** restrict a Manager's access to Memberships within their scope, defined as the Members of Teams they manage plus any Members explicitly assigned to them.

**Acceptance criteria**
- A Manager requesting data for a Member outside their scope receives a not-found response, and the attempt is recorded.
- A Manager with no scope can read only their own data.
- Scope is evaluated per request, never cached across Organization switches.

---

## REQ-RBAC-005 — Permission and entitlement are evaluated independently
{P0} {MVP} {Derived} · Actor: System · Depends: `REQ-BILL-002`

**The system shall** require both a permission check and an entitlement check to pass before a gated operation proceeds, evaluating them independently.

**Acceptance criteria**
- A Member with the permission but whose Organization lacks the entitlement is refused, and told which plan provides it.
- An Organization with the entitlement but a Member without the permission is refused, without reference to the plan.
- Neither check can satisfy the other.

---

## REQ-RBAC-006 — Custom roles
{P2} {V1.1} {Proposed} · Actor: Owner, Administrator

**The system shall** allow an Organization to define custom roles composed of existing permissions.

**Acceptance criteria**
- A custom role cannot grant a permission the creating Member does not hold.
- Custom roles are scoped to their Organization and invisible elsewhere.

---

# TEAM · Teams

## REQ-TEAM-001 — Team lifecycle
{P0} {MVP} {Confirmed} · Actor: Owner, Administrator

**The system shall** allow Teams to be created, renamed, described, archived and reactivated within an Organization.

**Acceptance criteria**
- Team names are unique within an Organization.
- Archiving hides the Team from selection while preserving historical reporting.
- All lifecycle actions are audit-logged.

---

## REQ-TEAM-002 — Team membership
{P0} {MVP} {Confirmed} · Actor: Owner, Administrator

**The system shall** allow Memberships to be added to and removed from Teams, with a Membership able to belong to multiple Teams.

**Acceptance criteria**
- Only Memberships in the same Organization can be added.
- Removing a Membership from a Team does not affect its historical time entries or reports.
- A Membership may belong to zero Teams.

---

## REQ-TEAM-003 — Team manager assignment
{P0} {MVP} {Derived} · Actor: Owner, Administrator · Depends: `REQ-RBAC-004`

**The system shall** allow one or more Memberships to be designated as managers of a Team, which extends their Manager scope to that Team's Members.

**Acceptance criteria**
- Designating a manager immediately extends scope for approvals and reporting.
- A Team may have several managers.
- A Team manager who is not also a Team member does not appear in that Team's reports as a subject.

---

## REQ-TEAM-004 — Team-scoped reporting
{P0} {MVP} {Confirmed} · Actor: Manager, Administrator, Owner

**The system shall** allow every report and dashboard to be filtered by Team.

**Acceptance criteria**
- Team filters return only Members of that Team for the period selected.
- Historical membership is respected: a report over a past period reflects who was in the Team at that time where the data supports it, and states its basis where it does not.

---

# PROJ · Projects & Tasks

## REQ-PROJ-001 — Project lifecycle
{P0} {MVP} {Confirmed} · Actor: Owner, Administrator, Manager

**The system shall** allow Projects to be created with a name, description, colour, optional start and end dates and a status of `active`, `completed` or `archived`.

**Acceptance criteria**
- A Project always belongs to exactly one Organization.
- `completed` Projects accept no new tracking but remain fully reportable.
- `archived` Projects are hidden from tracker selection and remain fully reportable.
- All lifecycle changes are audit-logged.

---

## REQ-PROJ-002 — Project membership
{P0} {MVP} {Derived} · Actor: Owner, Administrator, Manager

**The system shall** require Memberships to be explicitly assigned to a Project before they can track time to it.

**Acceptance criteria**
- A Member not assigned to a Project cannot select it in the tracker and cannot create a time entry against it via the API.
- Assigning and unassigning is audit-logged.
- Unassignment does not alter existing time entries for that Project.

---

## REQ-PROJ-003 — Task lifecycle
{P0} {MVP} {Confirmed} · Actor: Owner, Administrator, Manager

**The system shall** allow Tasks to be created within a Project with a name, description, status, priority and optional due date, and to be marked complete.

**Acceptance criteria**
- A Task belongs to exactly one Project and inherits its Organization.
- Completing a Task records the completion time.
- A completed Task accepts no new tracking unless reopened.

---

## REQ-PROJ-004 — Task assignment
{P0} {MVP} {Confirmed} · Actor: Owner, Administrator, Manager

**The system shall** allow Memberships assigned to a Project to be assigned to its Tasks.

**Acceptance criteria**
- Assigning a Member to a Task requires that Member to be assigned to the parent Project first.
- A Task may have several assignees.
- Assignment does not restrict who may report on the Task.

---

## REQ-PROJ-005 — Cross-organization assignment prevention
{P0} {MVP} {Derived} · Actor: System

**The system shall** reject any attempt to associate a Project, Task, Membership, Team or time record belonging to one Organization with a record belonging to another.

**Acceptance criteria**
- Every such attempt is rejected and recorded as a tenancy violation.
- The rejection is enforced server-side, independently of any client validation.
- Automated tests cover every relationship that spans two tenant-scoped entities.

---

## REQ-PROJ-006 — Project and task selection surface
{P0} {MVP} {Derived} · Actor: Employee · Depends: `REQ-PROJ-002`

**The system shall** present the desktop tracker with the active Organization's Projects and Tasks that the Member is assigned to and that are in a trackable state.

**Acceptance criteria**
- Only `active` Projects and non-completed Tasks are offered.
- The list refreshes on assignment change without requiring the tracker to restart.
- The list is available from the local store while offline, using the last synchronised state.

---

## REQ-PROJ-007 — Project search and listing
{P1} {MVP} {Derived} · Actor: All

**The system shall** provide a searchable, filterable, paginated Project list showing status, member count, task count and tracked hours.

**Acceptance criteria**
- Filterable by status, team and assigned member.
- Tracked-hours totals respect the viewer's permitted scope.

---

## REQ-PROJ-008 — Time attribution rules
{P0} {MVP} {Derived} · Actor: System

**The system shall** permit a time entry to reference a Project and optionally a Task, and shall require that both belong to the same Organization as the entry and that the Task belongs to the referenced Project.

**Acceptance criteria**
- A time entry with a Task but no Project is rejected.
- A time entry whose Task does not belong to its Project is rejected.
- A time entry with neither is permitted only where the Organization allows unattributed tracking — [`BR-PROJ-002`](#/business-rules).

---

# DEV · Devices & Desktop Tracker

## REQ-DEV-001 — Device registration
{P0} {MVP} {Derived} · Actor: Desktop Tracker · Depends: `REQ-AUTH-006`

**The system shall** register a desktop tracker installation as a Device bound to one Membership, recording a client-generated device identifier, name, platform, platform version and application version.

**Acceptance criteria**
- A Device is uniquely identified across the platform by its device identifier.
- A Device belongs to exactly one Membership and one Organization.
- `last_seen_at` updates on every authenticated request from that Device.
- Registering the same installation twice updates the existing Device rather than creating a duplicate.

---

## REQ-DEV-002 — Device inventory
{P1} {MVP} {Derived} · Actor: Owner, Administrator, Member (own devices)

**The system shall** list Devices with their Member, platform, application version, last-seen time, status and unsynchronised backlog.

**Acceptance criteria**
- A Member sees only their own Devices; an Administrator sees all in the Organization.
- Devices with an unresolved sync backlog beyond a threshold are visually distinguished.

---

## REQ-DEV-003 — Device revocation
{P0} {MVP} {Derived} · Actor: Owner, Administrator, Member (own devices)

**The system shall** allow a Device to be revoked, invalidating its token immediately.

**Acceptance criteria**
- The next request from a revoked Device is rejected.
- Events already captured on the revoked Device that have not yet synchronised are still accepted for a defined grace period, so revocation does not destroy recorded work — [`BR-SYNC-004`](#/business-rules).
- Revocation is audit-logged.

---

## REQ-DEV-004 — Tracker state display
{P0} {MVP} {Derived}

**Statement.** The desktop tracker shall continuously display its own state to the Member, and shall never present a state more favourable than the truth.

| | |
|---|---|
| **Actor** | Desktop Tracker |
| **Dependencies** | `REQ-TIME-001`, `REQ-SYNC-006` |

**Main flow**
1. Tracker displays whether tracking is active, paused or stopped.
2. Tracker displays elapsed time for the current session, the selected Project and Task.
3. Tracker displays connection state: online, offline, or synchronising.
4. Tracker displays the amount of captured time not yet acknowledged by the server.
5. Tracker displays which capture types are currently active, per the Organization's policy.
6. Tracker displays any capture type that is configured but not functioning.

**Alternative flows**
- **A1 — Window closed.** State remains visible in the system tray or menu bar.
- **A2 — Offline.** State shows offline with the unsynchronised amount; it does not show a success indication.

**Exceptions**
| Condition | Behaviour |
|---|---|
| A capture type is enabled but the OS denies permission | Tracker shows that capture type as unavailable and reports the state to the server — [`REQ-DEV-006`](#req-dev-006) |
| Server unreachable | Offline state shown; capture continues |

**Business rules** [`BR-MON-008`](#/business-rules), [`BR-SYNC-005`](#/business-rules)

**Acceptance criteria**
1. Given the tracker cannot reach the server, when the Member views it, then the offline state and the unsynchronised amount are both shown.
2. Given screenshot capture is enabled but permission has been denied by the operating system, then the tracker shows screenshots as unavailable rather than as active.
3. The tracker is never visually indistinguishable between "capturing" and "not capturing".
4. Tracking state is visible without opening the main window.

---

## REQ-DEV-005 — Tracker session recovery
{P0} {MVP} {Derived} · Actor: Desktop Tracker

**The system shall** recover from an abnormal tracker termination by reading the local store on next launch, transmitting unsent events, and closing any session that was left open **at the time of its last recorded event**.

**Acceptance criteria**
- A session interrupted by a crash or power loss is closed at the last recorded event time, never at restart time.
- No time is claimed for the interval between the last event and the restart.
- The Member is informed that a session was recovered and for what period.

---

## REQ-DEV-006 — Capture permission degradation
{P0} {MVP} {Proposed} · Actor: Desktop Tracker

**The system shall** detect when the operating system denies a permission required for a configured capture type, continue tracking with that capture type disabled, and report the degraded state to both the Member and the Organization.

**Acceptance criteria**
- Denied screen-recording, accessibility or input-monitoring permission does not stop time tracking.
- The degraded state appears in the tracker and in the Organization's device inventory.
- Evidence gaps caused by degradation are distinguishable in reports from gaps caused by retention or by capture being disabled — [`REQ-MON-006`](#req-mon-006).

---

## REQ-DEV-007 — Tracker update
{P1} {MVP} {Derived} · Actor: Desktop Tracker

**The system shall** support tracker updates, and shall not lose locally stored unsynchronised events across an update.

**Acceptance criteria**
- The local store survives an update and its contents are transmitted afterwards.
- The server records the application version per Device.
- A minimum supported version can be enforced, with the Member told clearly what to do.

---

# TIME · Time Tracking Engine

## REQ-TIME-001 — Start a tracking session
{P0} {MVP} {Confirmed}

**Statement.** The system shall allow a Member to start a tracking session against a selected Project and optional Task on a registered Device.

| | |
|---|---|
| **Actor** | Employee (any Member) |
| **Preconditions** | Registered Device; assigned to at least one trackable Project unless unattributed tracking is permitted |
| **Dependencies** | `REQ-DEV-001`, `REQ-PROJ-006` |
| **Entitlement** | `time_tracking` {Basic} |

**Main flow**
1. Member selects a Project and optionally a Task.
2. Member starts tracking.
3. Tracker generates a `session_started` event with a client-generated identifier and the local timestamp.
4. Tracker writes the event to the local store, then queues it for transmission.
5. Tracker begins capture according to the Organization's current policy.
6. Server receives the event, opens a Session with status `active`, and records both `occurred_at` and `received_at`.

**Alternative flows**
- **A1 — Offline at start.** Session begins locally; the Session is created server-side when the event is first received. Local time is authoritative for `occurred_at`.
- **A2 — A session is already active on another Device.** The server closes the older session and notifies the Member — [`BR-TIME-002`](#/business-rules).
- **A3 — Automatic tracking mode.** The session starts without member action, subject to `REQ-TIME-004`.

**Exceptions**
| Condition | Behaviour |
|---|---|
| Project not assigned to the Member | Reject; the Project was not offered by `REQ-PROJ-006` and a direct call is refused |
| Membership suspended | Reject; tracker signs out |
| Device revoked | Reject; tracker requires re-authentication |
| Device clock implausibly skewed from server time | Event is accepted and flagged for review — [`BR-TIME-008`](#/business-rules) |

**Business rules** [`BR-TIME-001`](#/business-rules), [`BR-TIME-002`](#/business-rules), [`BR-TIME-008`](#/business-rules)

**Acceptance criteria**
1. Given a Member with an assigned Project, when they start tracking, then a Session with status `active` exists and capture has begun.
2. Given the tracker is offline, when the Member starts tracking, then tracking begins locally and the resulting Session, once synchronised, starts at the local start time — not at the time of synchronisation.
3. Given a Member already has an active Session on another Device, when they start on a second Device, then exactly one Session remains active and the Member is told.
4. A start attempt against an unassigned Project is refused server-side even when made directly against the API.

---

## REQ-TIME-002 — Pause and resume
{P0} {MVP} {Derived} · Actor: Employee · Depends: `REQ-TIME-001`

**The system shall** allow an active session to be paused and resumed, recording each transition as an event, and shall exclude paused intervals from derived time entries.

**Acceptance criteria**
- Paused time appears in neither worked time nor billable time.
- Pause and resume events survive an offline period and synchronise in order.
- Resuming a session that was never paused is rejected as an invalid transition.

---

## REQ-TIME-003 — Stop a session
{P0} {MVP} {Confirmed} · Actor: Employee · Depends: `REQ-TIME-001`

**The system shall** allow an active or paused session to be stopped, closing it and finalising its derived time entries.

**Acceptance criteria**
- A stopped Session accepts no further events except those that occurred before its stop time and arrive late.
- Time entries for the Session are finalised on stop.
- Stopping an already stopped Session is idempotent, not an error.

---

## REQ-TIME-004 — Automatic tracking mode
{P1} {MVP} {Confirmed} feature / {Proposed} behaviour

**Statement.** The system shall support an automatic tracking mode in which a session starts without explicit member action, constrained so that automatic capture is bounded, visible and opt-in at the Organization level.

| | |
|---|---|
| **Actor** | Desktop Tracker, Organization |
| **Dependencies** | `REQ-ORG-005`, `REQ-SCHED-003` |
| **Entitlement** | `time_tracking` {Basic} |

:::warning The matrix sells this; nothing defines it
"User controlled or automatic tracking" appears in the feature matrix for all plans `{Confirmed}`, but no source defines what automatic means (`GAP-04`). The constraints below are `{Proposed}` and are the most privacy-consequential proposal in this document. They require explicit confirmation: [`OQ-006`](#/open-questions).
:::

**Main flow**
1. Organization enables automatic tracking explicitly; it is off by default.
2. Tracker starts a session automatically only when **all** of: the Member is signed in, the current time falls inside the Member's scheduled shift, and input activity is detected.
3. Tracker displays prominently that tracking started automatically.
4. Member may stop the session at any time; the tracker does not restart it for a defined cooldown.
5. Tracker stops the session automatically at the end of the scheduled shift or after sustained inactivity.

**Alternative flows**
- **A1 — No Schedule assigned.** Automatic tracking does not start; the Member is told why.
- **A2 — Member stops during scheduled hours.** No automatic restart during the cooldown.

**Exceptions**
| Condition | Behaviour |
|---|---|
| Automatic mode enabled without `schedules` entitlement | Automatic tracking is unavailable, because it has no defined boundary |
| Shift crosses midnight | Boundaries computed in the Schedule's timezone — [`BR-SCHED-005`](#/business-rules) |

**Business rules** [`BR-TIME-009`](#/business-rules), [`BR-MON-008`](#/business-rules)

**Acceptance criteria**
1. Automatic tracking never starts outside the Member's scheduled hours.
2. Automatic tracking never starts without the Organization having explicitly enabled it.
3. A Member who stops an automatic session is not re-tracked within the cooldown period.
4. Every automatically started session is visually identified as such to the Member and in reports.

---

## REQ-TIME-005 — Project and task switching
{P0} {MVP} {Derived} · Actor: Employee · Depends: `REQ-TIME-001`

**The system shall** allow the Project or Task of an active session to be changed, recording an event and closing the current time entry before opening a new one.

**Acceptance criteria**
- No tracked second is attributed to two Projects.
- No tracked second is lost at the switch boundary.
- The switch is recorded as an event and is visible in the timeline.

---

## REQ-TIME-006 — Idle detection and resolution
{P0} {MVP} {Derived}

**Statement.** The system shall detect intervals during a session with no input activity beyond the Organization's idle threshold, record them as Idle Periods, and let the Member resolve each one on their return.

| | |
|---|---|
| **Actor** | Desktop Tracker, Employee |
| **Dependencies** | `REQ-ORG-005`, `REQ-TIME-001` |

**Main flow**
1. Tracker observes no keyboard or mouse input for longer than the idle threshold.
2. Tracker records an idle-start event at the moment activity actually ceased, not at the moment the threshold elapsed.
3. On the Member's return, the tracker records an idle-end event and prompts.
4. Member resolves the interval as: keep as worked time, discard it, or reclassify it as a Break.
5. Tracker records the resolution as an event; the server adjusts the derived time entries.

**Alternative flows**
- **A1 — Machine slept or locked.** Treated as idle; on wake the gap is reconciled and prompted the same way.
- **A2 — Member does not respond to the prompt.** The Organization's default applies — keep or discard — and the unresolved state is visible in reports.
- **A3 — Idle spans a session stop.** The idle interval is bounded by the session stop time.

**Exceptions**
| Condition | Behaviour |
|---|---|
| Idle longer than the maximum session duration | Session auto-stopped — [`BR-TIME-007`](#/business-rules) |
| Input monitoring permission denied | Idle detection is unavailable; the degraded state is reported — [`REQ-DEV-006`](#req-dev-006) |

**Business rules** [`BR-TIME-003`](#/business-rules), [`BR-TIME-006`](#/business-rules)

**Acceptance criteria**
1. An idle period begins at the last observed input, not at the threshold expiry.
2. Resolving an idle period as worked time restores exactly that interval to the derived time entries.
3. Resolving it as a Break creates a Break record, not an Idle Period reclassification — the two remain distinct.
4. An unresolved idle period is visible as unresolved and does not silently default without being reportable.

---

## REQ-TIME-007 — Time entry derivation
{P0} {MVP} {Derived}

**Statement.** The system shall derive Time Entries server-side from the Tracking Events of a session, and shall be able to re-derive them from the same events with an identical result.

| | |
|---|---|
| **Actor** | System |
| **Dependencies** | `REQ-TIME-001` to `REQ-TIME-006`, `REQ-SYNC-003` |

**Main flow**
1. Server receives events for a session.
2. Server orders them by `occurred_at`.
3. Server computes worked intervals, excluding paused, discarded-idle and break intervals.
4. Server creates or updates Time Entries with `source = tracked`.
5. Server recomputes affected Attendance Records.

**Alternative flows**
- **A1 — Late-arriving events.** Entries for the affected session are re-derived; entries already included in a submitted or approved Timesheet are **not** altered — the discrepancy is surfaced instead.
- **A2 — Events arrive out of order.** Ordering is by `occurred_at`, so arrival order does not affect the result.

**Exceptions**
| Condition | Behaviour |
|---|---|
| Events are internally inconsistent (resume with no pause) | Session is flagged for review; a best-effort derivation is produced and marked as such |
| Derived entry duration is zero or negative | Entry is not created; the condition is recorded |

**Business rules** [`BR-TIME-001`](#/business-rules), [`BR-TS-004`](#/business-rules)

**Acceptance criteria**
1. Given a fixed set of events, when derivation runs twice, then the resulting Time Entries are identical.
2. Given events arrive in reverse order, when derivation runs, then the result matches the in-order case.
3. Given an event arrives late for a session whose entries are in an approved Timesheet, then the approved figures are unchanged and the discrepancy is reported.
4. Derived entries never overlap one another for the same Membership — [`BR-TIME-004`](#/business-rules).

---

## REQ-TIME-008 — Manual time entry
{P0} {MVP} {Derived} + {Proposed}

**Statement.** The system shall allow a Member to create a time entry manually for work that was not tracked, requiring a reason, recording the creating actor, and marking the entry as manual.

| | |
|---|---|
| **Actor** | Employee (own), Manager (in scope), Administrator, Owner |
| **Dependencies** | `REQ-PROJ-008` |

:::note Governance is proposed, not sourced
The data model in `resources-3.md` §16 supports manual entries with a `reason` and a creator, but no source states who may create them, over what period, or whether approval is needed (`GAP-06`). The rules below are `{Proposed}`.
:::

**Main flow**
1. Actor selects a date, start and end time, Project and optional Task.
2. Actor supplies a reason — mandatory.
3. System validates the interval against the correction window, overlap rules and any daily maximum.
4. System creates the entry with `source = manual`, recording the creating Membership and the reason.
5. System writes an audit record and recomputes Attendance for the affected date.
6. If the Organization requires it, the Member's Manager is notified.

**Alternative flows**
- **A1 — Manager creates on a Member's behalf.** The Member is notified; the actor is recorded as the Manager, and the subject as the Member.
- **A2 — Entry falls in an approved Timesheet's period.** Rejected; the Timesheet must be reopened first.

**Exceptions**
| Condition | Behaviour |
|---|---|
| Reason omitted | Reject |
| Overlaps an existing entry for the same Membership | Reject, showing the conflict |
| Outside the correction window | Reject, with escalation to a Manager offered |
| Would exceed the daily maximum | Flag for review rather than silently accept |

**Business rules** [`BR-TIME-004`](#/business-rules), [`BR-TIME-005`](#/business-rules)

**Acceptance criteria**
1. A manual entry without a reason is never created.
2. A manual entry is always distinguishable from a tracked entry in every report and export.
3. A manual entry that would overlap an existing entry for the same Membership is refused.
4. Every manual entry produces an audit record naming the actor, the subject, the interval and the reason.

---

## REQ-TIME-009 — Edit a time entry
{P0} {MVP} {Derived} · Actor: Employee (own), Manager (scope), Administrator · Depends: `REQ-TIME-008`

**The system shall** allow an existing time entry to be edited with a mandatory reason, retaining the original values in the audit record.

**Acceptance criteria**
- The pre-edit values are recoverable from the audit log.
- Editing an entry that belongs to a submitted or approved Timesheet is refused.
- The edited entry is marked as edited and remains distinguishable from an unmodified tracked entry.

---

## REQ-TIME-010 — Discard a time entry
{P0} {MVP} {Derived} · Actor: Employee (own), Manager (scope), Administrator

**The system shall** allow a time entry to be discarded with a mandatory reason, excluding it from all totals while retaining the record.

**Acceptance criteria**
- A discarded entry is excluded from reports, timesheets and payroll.
- A discarded entry is never physically deleted before its retention period expires.
- Discarding an entry inside an approved Timesheet is refused.

---

## REQ-TIME-011 — Correction window
{P0} {MVP} {Proposed} · Actor: System · Depends: `REQ-TIME-008`

**The system shall** enforce an Organization-configured window within which Members may create or edit their own time entries, beyond which only a Manager or Administrator may do so.

**Acceptance criteria**
- The window is configurable and audit-logged when changed.
- Requests outside the window are refused for Employees with an explanation and an escalation path.
- Managers and Administrators are bounded by the timesheet-approval state, not by the window.

---

# SYNC · Offline Synchronisation

## REQ-SYNC-001 — Durable local capture store
{P0} {MVP} {Confirmed} · Actor: Desktop Tracker

**The system shall** write every captured event to durable local storage on the Device before attempting transmission, and shall retain it until the server acknowledges it.

**Acceptance criteria**
- Events survive tracker restart, machine restart and application update.
- No event is removed from the local store before an explicit server acknowledgement.
- Local store growth is bounded and its remaining capacity is observable; approaching the bound warns the Member rather than silently discarding.

---

## REQ-SYNC-002 — Batch submission
{P0} {MVP} {Confirmed} · Actor: Desktop Tracker · Depends: `REQ-SYNC-001`

**The system shall** transmit queued events to the server in ordered batches, oldest first, each batch carrying a client-generated batch identifier.

**Acceptance criteria**
- Batches are transmitted in the order the events occurred.
- A batch is acknowledged as a whole or not at all — partial acceptance is not possible.
- Batch size is bounded so a single failure cannot block an unbounded backlog.

---

## REQ-SYNC-003 — Idempotent ingestion
{P0} {MVP} {Confirmed}

**Statement.** The system shall accept the same event any number of times and shall store it exactly once, using the client-generated event identifier as the uniqueness key within the Organization.

| | |
|---|---|
| **Actor** | System |
| **Dependencies** | `REQ-SYNC-002` |

**Main flow**
1. Server receives a batch.
2. For each event, the server checks whether that client event identifier already exists for the Organization.
3. Known events are acknowledged without being stored again.
4. Unknown events are stored with `received_at` set to server time.
5. Server acknowledges the batch.
6. Server triggers time entry derivation for the affected sessions.

**Alternative flows**
- **A1 — Whole batch already processed.** Server acknowledges without creating anything.
- **A2 — Partial overlap.** New events are stored, known ones skipped, and the batch is acknowledged as a whole.

**Exceptions**
| Condition | Behaviour |
|---|---|
| Event references a session in another Organization | Rejected as a tenancy violation and recorded |
| Event malformed | Whole batch rejected with a reason; the tracker quarantines it locally rather than discarding it |
| Event references an unknown session | Session is created from the event if the event is a session start; otherwise the event is held for reconciliation |

**Business rules** [`BR-SYNC-001`](#/business-rules), [`BR-SYNC-002`](#/business-rules)

**Acceptance criteria**
1. Given an identical batch is submitted ten times, then exactly one set of events exists and exactly one set of time entries is derived.
2. Given a batch times out after the server processed it, when the tracker retries, then no duplicate records are created and the retry is acknowledged.
3. Duplicate suppression is enforced by a database constraint, not only by application logic.
4. Event ordering for derivation uses `occurred_at`; `received_at` never affects the derived result.

---

## REQ-SYNC-004 — Retry with backoff
{P0} {MVP} {Derived} · Actor: Desktop Tracker

**The system shall** retry unacknowledged batches with increasing intervals, without discarding events, and without saturating the network or the server.

**Acceptance criteria**
- Retry intervals increase up to a bound.
- Retries continue across tracker restarts.
- A batch repeatedly rejected as malformed is quarantined locally and reported, not retried indefinitely.

---

## REQ-SYNC-005 — Synchronisation ledger
{P1} {MVP} {Derived} · Actor: System

**The system shall** record each received batch with its client batch identifier, Device, receipt time, event count and outcome.

:::note Restoring a dropped design element
`resources-3.md` §29 proposed this ledger; it does not appear in the final schema (`CONF-11`). Correctness is preserved without it, but sync failure — the metric `resources-2.md` §18 calls critical — cannot be diagnosed without it.
:::

**Acceptance criteria**
- Every batch outcome is queryable by Device and by Organization.
- Rejected batches record the rejection reason.
- The ledger supports per-organization and per-device sync failure rate reporting.

---

## REQ-SYNC-006 — Synchronisation status visibility
{P0} {MVP} {Proposed} · Actor: Desktop Tracker, Member, Administrator

**The system shall** report unsynchronised captured time to the Member on the tracker, and unresolved synchronisation backlog to the Organization.

**Acceptance criteria**
- The tracker shows the quantity of captured but unacknowledged time.
- The tracker never displays a synchronised state while a backlog exists.
- Devices with a backlog beyond a threshold appear in the Organization's device inventory and raise a notification.

---

## REQ-SYNC-007 — Platform synchronisation health
{P1} {MVP} {Derived} · Actor: Platform Administrator · Depends: `REQ-SYNC-005`

**The system shall** expose synchronisation failure rate, backlog volume and rejected batch counts per Organization and per Device to platform operations.

**Acceptance criteria**
- Failure rate is computed from the ledger, not estimated.
- Thresholds raise operational alerts.
- The metrics contain no captured content — counts, timestamps and outcomes only.

---

# MON · Activity Monitoring

## REQ-MON-001 — Screenshot capture
{P0} {MVP} {Confirmed} {Basic}

**Statement.** The system shall capture screenshots during an active tracking session at the Organization's configured interval, and shall store the image in private object storage with metadata in the database.

| | |
|---|---|
| **Actor** | Desktop Tracker |
| **Dependencies** | `REQ-ORG-007`, `REQ-TIME-001` |
| **Entitlement** | `screenshots` {Basic} |

**Main flow**
1. Tracker captures the screen at the configured interval while a session is active.
2. Tracker compresses the image.
3. Tracker requests a short-lived upload authorisation from the server.
4. Tracker uploads the image directly to object storage.
5. Tracker submits metadata — capture time, session, Project, Task, dimensions, size, storage key.
6. Server records the Screenshot with status `available`.

**Alternative flows**
- **A1 — Offline.** Image and metadata are held locally and uploaded when connectivity returns.
- **A2 — Interval randomisation enabled.** Capture time varies within the interval so it is not predictable.
- **A3 — Multiple displays.** Behaviour is a design decision — [`OQ-023`](#/open-questions).

**Exceptions**
| Condition | Behaviour |
|---|---|
| Screen-capture permission denied | Screenshots unavailable; tracking continues; degraded state reported — [`REQ-DEV-006`](#req-dev-006) |
| Upload fails | Retried with backoff; on exhaustion the failure is recorded so the gap is visible |
| Local storage full | Oldest unsent images are dropped **only after** the Member is warned; time events are never dropped in favour of images |

**Business rules** [`BR-MON-001`](#/business-rules), [`BR-MON-002`](#/business-rules), [`BR-MON-003`](#/business-rules)

**Acceptance criteria**
1. Screenshots are captured only while a session is active — never when tracking is stopped or paused.
2. The image is never transmitted through, or stored by, the application server.
3. Screenshot metadata is always associated with the Membership, Organization and Session it belongs to.
4. A failed capture or upload leaves a recorded gap, never a silent absence.
5. Time events are prioritised over images when local storage is constrained.

---

## REQ-MON-002 — Screenshot viewing
{P0} {MVP} {Confirmed} {Basic} · Actor: Member (own), Manager (scope), Administrator, Owner

**The system shall** allow authorised viewers to view screenshots through short-lived signed URLs generated per request after authorization.

**Acceptance criteria**
- No permanent public URL to a screenshot exists.
- The signed URL expires within a short bounded period.
- Every view is authorised against both permission and entitlement before the URL is issued.
- A Member can always view their own screenshots — [`REQ-MON-010`](#req-mon-010).

---

## REQ-MON-003 — Activity capture
{P0} {MVP} {Confirmed} {Standard}

**The system shall** capture aggregated input activity during a session as intervals carrying keyboard activity, mouse activity and a derived activity percentage, and shall never capture keystroke content.

**Acceptance criteria**
- Stored activity data contains counts and percentages only — no key identities, no key sequences, no clipboard content.
- Activity intervals are bounded in length so reporting can aggregate them without unbounded row growth.
- Activity is captured only during an active session.
- A Basic Organization captures no activity data at all.

---

## REQ-MON-004 — Application usage capture
{P0} {MVP} {Confirmed} {Standard}

**The system shall** record the foreground application during an active session as intervals with an application name, optional process name, start, end and duration.

**Acceptance criteria**
- Only the foreground application is recorded; background processes are not enumerated.
- Recording occurs only during an active session.
- Window titles are not captured at MVP — [`BR-MON-005`](#/business-rules).

---

## REQ-MON-005 — Website usage capture
{P0} {MVP} {Confirmed} {Standard}

**The system shall** record the foreground browser domain during an active session as intervals with a domain, start, end and duration, and shall not record full URLs by default.

**Acceptance criteria**
- The default capture stores the domain only.
- Path capture, where enabled, is an explicit Organization setting that is disclosed to Members — [`BR-MON-004`](#/business-rules).
- Query strings and URL fragments are never stored.
- Recording occurs only during an active session.

:::warning Full URLs are a liability, not a feature
URLs routinely contain session tokens, document identifiers, search terms and medical or financial context. `resources-3.md` §25 raises this; this requirement makes domain-only the default rather than an option.
:::

---

## REQ-MON-006 — Evidence gap classification
{P0} {MVP} {Proposed} · Actor: System

**The system shall** distinguish, in every view of captured evidence, between: capture not configured, capture configured but unavailable, capture failed, and data expired under retention.

**Acceptance criteria**
- The four states are visually and semantically distinct wherever evidence is displayed.
- A gap is never rendered as an unexplained absence.
- The classification is available in exports.

---

## REQ-MON-007 — Inactivity alerts
{P1} {MVP} {Confirmed} feature / {Proposed} behaviour {Standard}

**Statement.** The system shall raise an alert when a Member records no input activity for longer than a configured threshold during their scheduled working hours, notifying both the Member and their Manager.

| | |
|---|---|
| **Actor** | System |
| **Dependencies** | `REQ-MON-003`, `REQ-SCHED-004`, `REQ-NOTIF-001` |
| **Entitlement** | `inactivity_alerts` {Standard} |

:::note Threshold and recipients are proposed
The matrix sells inactivity alerts without defining any threshold, recipient or channel (`GAP-02`). Notifying the Member as well as the Manager is a `{Proposed}` fairness decision — an alert about a person that the person never sees is difficult to defend.
:::

**Main flow**
1. System evaluates activity against the Organization's inactivity threshold.
2. Where sustained inactivity occurs inside scheduled hours with tracking active, an alert is raised.
3. Both the Member and the Manager are notified, per their notification preferences.
4. The alert records the interval and the observed activity level.

**Alternative flows**
- **A1 — Member on approved leave.** No alert.
- **A2 — Outside scheduled hours.** No alert.
- **A3 — Tracking stopped.** No alert; absence of tracking is an attendance matter, not an inactivity matter.

**Exceptions**
| Condition | Behaviour |
|---|---|
| No Schedule assigned | Alerts are not raised, since there is no defined working period |
| Activity capture unavailable on the Device | No alert; the degraded state is reported instead |

**Acceptance criteria**
1. No alert is ever raised outside the Member's scheduled hours.
2. Every alert raised about a Member is also delivered to that Member.
3. Alerts are not raised for periods covered by approved leave or a declared break.
4. The threshold is Organization-configurable and its changes are audit-logged.

---

## REQ-MON-008 — Productivity rules
{P0} {MVP} {Confirmed} {Standard} · Actor: Administrator

**The system shall** allow an Organization to classify applications and domains as productive, unproductive or neutral, and shall apply those classifications when reporting time.

**Acceptance criteria**
- Classifications are Organization-scoped; no cross-organization default is imposed.
- A target unclassified by the Organization is reported as neutral, not as unproductive.
- Classification changes apply to reporting from the point of change; historical reports state the basis used — [`BR-MON-006`](#/business-rules).
- Classifications apply to applications and domains only, never to people.

---

## REQ-MON-009 — Monitoring disclosure and change notification
{P0} {MVP} {Proposed}

**Statement.** The system shall present each Member with a disclosure of what is captured about them before capture begins, record their acknowledgement, and notify them whenever the Organization increases what is captured.

| | |
|---|---|
| **Actor** | System, Member |
| **Dependencies** | `REQ-ORG-007`, `REQ-USER-004` |

:::warning Entirely proposed, and rated `{P0}`
No source requires this (`GAP-07`). It is included at launch priority because a monitoring product without it is difficult to defend in several jurisdictions, difficult to defend in an employment dispute, and disproportionately expensive to retrofit after every capture path has shipped. See [Security & Privacy](#/security-privacy).
:::

**Main flow**
1. On first sign-in to the desktop tracker for an Organization, the Member is shown what is captured, at what frequency, who can view it, and how long it is retained.
2. Member acknowledges.
3. System records the acknowledgement with a timestamp and the policy version acknowledged.
4. Tracking becomes available.
5. When the Organization enables a capture type or shortens a capture interval, affected Members are notified before it takes effect.

**Alternative flows**
- **A1 — Member declines.** Tracking is unavailable; the Administrator is notified. This is a defined outcome, not an error.
- **A2 — Policy changes materially.** Re-acknowledgement is required — [`OQ-024`](#/open-questions) settles which changes are material.

**Exceptions**
| Condition | Behaviour |
|---|---|
| Notification delivery fails | The change still takes effect; the failure is recorded and retried |

**Business rules** [`BR-MON-008`](#/business-rules), [`BR-MON-009`](#/business-rules)

**Acceptance criteria**
1. No capture occurs for a Member who has not been shown the disclosure.
2. The acknowledgement record includes the policy version and timestamp and is retained for the life of the Membership.
3. Enabling screen recording notifies every affected Member before the first recording is made.
4. The disclosure content is generated from the actual configuration, not maintained as separate prose that can drift.

---

## REQ-MON-010 — Member self-visibility
{P0} {MVP} {Proposed}

**Statement.** The system shall allow a Member to view, for any date within retention, every category of data captured about them.

| | |
|---|---|
| **Actor** | Member |
| **Dependencies** | `REQ-MON-001` to `REQ-MON-005`, `REQ-REC-004` |

**Main flow**
1. Member opens their personal record and selects a date or range.
2. System displays: sessions and time entries; idle periods and breaks; activity percentages; applications and domains recorded; every screenshot captured; every recording made; attendance; timesheets and approval history; current pay rate.
3. System displays the Organization's current monitoring policy and retention periods.
4. Member may export their own data.

**Alternative flows**
- **A1 — Data expired under retention.** Shown as expired with the window that applied, not as absent.
- **A2 — Capture type disabled.** Shown as not captured for that period.

**Exceptions**
| Condition | Behaviour |
|---|---|
| Member requests another Member's data | Refused and recorded |
| Export is large | Queued and delivered asynchronously through a time-limited link |

**Business rules** [`BR-MON-009`](#/business-rules)

**Acceptance criteria**
1. For every category of data the product captures about a Member, that Member can view their own instance of it.
2. A Member's view of their own screenshots and recordings is not gated on a Manager permission.
3. No capture type exists that a Member cannot see for themselves.
4. Self-visibility does not require the `activity_summary` or other Standard entitlements for data the Organization has actually captured.

---

## REQ-MON-011 — Evidence deletion request
{P1} {MVP} {Proposed} · Actor: Member, Administrator

**The system shall** allow a Member to request deletion of a specific screenshot or recording with a reason, and shall route the request to an Administrator for decision.

**Acceptance criteria**
- The request, the decision and the reason are all audit-logged.
- Approved deletions remove the object from storage before removing the metadata — [`BR-DATA-004`](#/business-rules).
- A refusal is communicated to the Member with a reason.
- A Member cannot delete captured evidence unilaterally.

---

# REC · Video Screen Recording

## REQ-REC-001 — Screen recording capture
{P1} {MVP} {Confirmed} {Premium}

**Statement.** The system shall capture screen video during an active tracking session as a sequence of independently uploadable segments, only where the Organization holds the `video_recording` entitlement and has explicitly enabled it.

| | |
|---|---|
| **Actor** | Desktop Tracker |
| **Dependencies** | `REQ-ORG-007`, `REQ-BILL-002`, `REQ-MON-009` |
| **Entitlement** | `video_recording` {Premium} |

**Main flow**
1. Organization enables recording; every affected Member is notified before the first capture.
2. On session start, the tracker begins recording and creates a Recording with status `recording`.
3. The tracker writes video in bounded segments.
4. Each completed segment is uploaded directly to object storage under a short-lived authorisation, and its metadata submitted with a sequence number and checksum.
5. On session stop, the Recording is finalised and reaches status `ready` once all segments are accounted for.
6. The tracker displays a persistent, unmistakable recording indicator throughout.

**Alternative flows**
- **A1 — Tracker crashes mid-recording.** Segments already uploaded remain valid and playable; the Recording is finalised as partial on recovery.
- **A2 — Offline.** Segments are held locally and uploaded on reconnection, subject to the local storage bound.
- **A3 — Entitlement lost mid-period.** Recording stops; existing recordings remain viewable until retention expires.

**Exceptions**
| Condition | Behaviour |
|---|---|
| Screen-recording permission denied by the OS | Recording unavailable; tracking continues; degraded state reported |
| Segment upload fails repeatedly | Segment marked failed; the Recording is finalised as partial with the gap visible |
| Local storage exhausted | Recording stops with the Member informed; time capture is never sacrificed for video |

**Business rules** [`BR-REC-001`](#/business-rules), [`BR-MON-008`](#/business-rules)

**Acceptance criteria**
1. A forced termination during recording loses at most one segment.
2. Recording never occurs without the `video_recording` entitlement, regardless of client-side configuration.
3. A recording indicator is visible to the Member for the entire duration of capture.
4. Video bytes never pass through the application server.
5. Recording never occurs while tracking is stopped or paused.

---

## REQ-REC-002 — Recording assembly and status
{P1} {MVP} {Derived} {Premium} · Actor: System

**The system shall** maintain a Recording status of `recording`, `uploading`, `processing`, `ready`, `failed` or `deleted`, and shall record segment count, total size, duration, resolution, frame rate and codec.

**Acceptance criteria**
- Segment sequence numbers are unique within a Recording.
- A Recording reaches `ready` only when every expected segment is accounted for or explicitly marked failed.
- A partial Recording is playable for the segments that succeeded.

---

## REQ-REC-003 — Recording playback
{P1} {MVP} {Confirmed} {Premium} · Actor: Manager (scope), Administrator, Owner, Member (own)

**The system shall** allow authorised viewers to play back a Recording through short-lived signed URLs issued per segment after authorization.

**Acceptance criteria**
- No permanent public URL to any segment exists.
- Playback authorization is evaluated against permission and entitlement on each request.
- A Member can always play back their own recordings.

---

## REQ-REC-004 — Recording permission is distinct from screenshots
{P1} {MVP} {Proposed} · Actor: System

**The system shall** govern recording viewing with a permission distinct from screenshot viewing.

**Acceptance criteria**
- A role granted screenshot viewing does not automatically gain recording viewing.
- The distinction is enforced server-side.

:::note Why separate
Screen video is materially more intrusive than a periodic still. Collapsing both under one permission means every screenshot reviewer silently gains continuous video access the moment an Organization upgrades to Premium.
:::

---

# SCHED · Schedules

## REQ-SCHED-001 — Schedule definition
{P0} {MVP} {Confirmed} {Standard} · Actor: Administrator

**The system shall** allow an Organization to define named Schedules, each with its own timezone and status.

**Acceptance criteria**
- A Schedule's timezone is independent of the Organization's timezone.
- Several Schedules may exist concurrently in one Organization.
- Archiving a Schedule does not affect historical attendance derived under it.

---

## REQ-SCHED-002 — Shift definition including overnight shifts
{P0} {MVP} {Confirmed} {Standard}

**Statement.** The system shall allow a Schedule to define, per day of week, a shift with a start time, end time, expected break duration and minimum work duration — and shall support shifts that cross midnight.

| | |
|---|---|
| **Actor** | Administrator |
| **Dependencies** | `REQ-SCHED-001` |

**Main flow**
1. Administrator selects a day of week and enters start and end times.
2. System accepts an end time earlier than the start time, interpreting it as crossing midnight.
3. System computes expected duration in the Schedule's timezone.
4. Days without a shift are treated as non-working.

**Alternative flows**
- **A1 — Overnight shift (22:00 → 06:00).** Expected duration is 8 hours; the shift spans two calendar dates and is attributed to its start date.
- **A2 — DST transition inside the shift.** Expected duration reflects the actual elapsed time in the Schedule's timezone — a 23- or 25-hour day is computed correctly.

**Exceptions**
| Condition | Behaviour |
|---|---|
| Two shifts defined for the same day | Rejected; one shift per day per Schedule at MVP |
| Shift longer than 24 hours | Rejected |
| Start equals end | Rejected as ambiguous |

**Business rules** [`BR-SCHED-001`](#/business-rules), [`BR-SCHED-005`](#/business-rules)

**Acceptance criteria**
1. A shift of 22:00 → 06:00 is accepted and yields an expected duration of 8 hours.
2. A shift spanning a DST transition yields the true elapsed duration, not a nominal one.
3. An overnight shift's attendance is attributed to the date the shift started.
4. A day with no shift produces attendance status `rest_day`, never `absent`.

---

## REQ-SCHED-003 — Dated schedule assignment
{P0} {MVP} {Derived} {Standard} · Actor: Administrator

**The system shall** assign a Schedule to a Membership with an effective-from date and an optional effective-until date, so that a schedule change does not rewrite historical expectations.

**Acceptance criteria**
- Assignments for one Membership never overlap in time — [`BR-SCHED-003`](#/business-rules).
- Attendance for a past date uses the Schedule that was effective on that date.
- Changing a future assignment does not alter derived past attendance.
- Ending an assignment sets an effective-until date rather than deleting the record.

---

## REQ-SCHED-004 — Expected hours computation
{P0} {MVP} {Derived} {Standard} · Actor: System

**The system shall** compute expected working seconds for a Membership on a date from the effective Schedule's shift for that day, less the expected break duration, adjusted for approved leave and holidays.

**Acceptance criteria**
- A date covered by approved leave has expected seconds reduced according to the leave type's rules.
- A date that is a defined holiday has expected seconds of zero and status `holiday`.
- A Membership with no effective Schedule has no expected seconds and is reported as unscheduled.

---

## REQ-SCHED-005 — Schedule change recomputation
{P1} {MVP} {Derived} {Standard} · Actor: Administrator

**The system shall** require confirmation before a Schedule change affects dates for which attendance has already been derived, and shall recompute affected attendance on confirmation.

**Acceptance criteria**
- The confirmation states how many dates and Members are affected.
- Recomputation is audit-logged.
- Attendance inside an approved Timesheet's period is not silently changed; the discrepancy is surfaced.

---

## REQ-SCHED-006 — Holiday calendar
{P1} {MVP} {Proposed} {Standard} · Actor: Administrator

**The system shall** allow an Organization to define non-working holiday dates, optionally scoped to a Team or a Schedule.

:::note Filling a hole in the source design
The attendance status vocabulary includes `holiday`, but no source defines any entity that holds holidays (`GAP-13`). Without this, `holiday` is unreachable and public holidays are reported as absence.
:::

**Acceptance criteria**
- A defined holiday produces attendance status `holiday` with zero expected seconds.
- Time tracked on a holiday is recorded normally and flagged as worked on a holiday.
- Holidays can differ per Team or Schedule, supporting multi-country organizations.

---

# ATT · Attendance & Breaks

## REQ-ATT-001 — Attendance derivation
{P0} {MVP} {Confirmed} {Standard}

**Statement.** The system shall derive one Attendance Record per Membership per calendar date, comparing expected working time against actual worked time, and shall be able to re-derive it identically from the same inputs.

| | |
|---|---|
| **Actor** | System |
| **Dependencies** | `REQ-SCHED-004`, `REQ-TIME-007`, `REQ-LEAVE-006` |
| **Entitlement** | `attendance` {Standard} |

**Main flow**
1. For a Membership and date, the system resolves expected seconds from the effective Schedule.
2. System sums worked seconds from Time Entries for that date, in the Schedule's timezone.
3. System records first and last activity times.
4. System computes lateness against the shift start and early departure against the shift end.
5. System assigns a status.
6. System stores exactly one Attendance Record for that Membership and date.

**Alternative flows**
- **A1 — Overnight shift.** Attendance is attributed to the shift's start date, and worked time from both calendar dates that falls inside the shift window is counted to it.
- **A2 — Approved leave covers the date.** Status is `on_leave`; expected seconds are adjusted; the record is not `absent`.
- **A3 — Date is a holiday or a non-working day.** Status is `holiday` or `rest_day` respectively.
- **A4 — Member unscheduled.** No expected seconds; status reflects unscheduled rather than absent.

**Exceptions**
| Condition | Behaviour |
|---|---|
| Time entries change after derivation | Attendance is recomputed for affected dates |
| Attendance falls inside an approved Timesheet period | Recomputation occurs but the discrepancy against the approved figure is surfaced rather than hidden |

**Business rules** [`BR-ATT-001`](#/business-rules) to [`BR-ATT-004`](#/business-rules)

**Acceptance criteria**
1. Exactly one Attendance Record exists per Membership per date.
2. Given a member with approved leave on a date, the status is `on_leave` and never `absent`.
3. Given a shift of 22:00 → 06:00, worked time either side of midnight inside that window counts to the shift's start date.
4. Re-running derivation over unchanged inputs produces an identical record.

---

## REQ-ATT-002 — Attendance status assignment
{P0} {MVP} {Derived} {Standard} · Actor: System

**The system shall** assign each Attendance Record exactly one status from `present`, `late`, `absent`, `half_day`, `on_leave`, `holiday` or `rest_day`.

**Acceptance criteria**
- The vocabulary is fixed; no other value is producible.
- Status precedence is deterministic and documented — [`BR-ATT-003`](#/business-rules).
- A single date never carries two statuses.

---

## REQ-ATT-003 — Attendance recomputation
{P0} {MVP} {Derived} {Standard} · Actor: System

**The system shall** recompute Attendance Records when any input changes: time entries, schedule assignment, leave decisions, or holiday definitions.

**Acceptance criteria**
- Recomputation is triggered automatically, not by manual action.
- Recomputation is idempotent.
- Recomputation over an approved period surfaces the discrepancy rather than silently changing approved figures.

---

## REQ-ATT-004 — Break declaration
{P0} {MVP} {Confirmed} {Standard}

**Statement.** The system shall allow a Member to declare the start and end of a break, recording it as a Break distinct from an Idle Period, and excluding break time from worked time.

| | |
|---|---|
| **Actor** | Employee |
| **Dependencies** | `REQ-TIME-001` |
| **Entitlement** | `breaks` {Standard} |

**Main flow**
1. Member declares a break start from the tracker.
2. Tracker records a break-start event.
3. Capture of screenshots, activity, applications and websites pauses for the duration of the break.
4. Member declares the break end.
5. Server records the Break and excludes its duration from derived worked time.

**Alternative flows**
- **A1 — Break declared with tracking stopped.** The Break is recorded against the Membership and date without a session association — [`BR-ATT-006`](#/business-rules).
- **A2 — Idle period reclassified as a break.** A Break is created; the Idle Period record is retained.
- **A3 — Break not ended before the day closes.** Bounded by the shift end or a configured maximum, and flagged.

**Exceptions**
| Condition | Behaviour |
|---|---|
| Break start with a break already open | Rejected as an invalid transition |
| Break end without an open break | Rejected |

**Business rules** [`BR-ATT-005`](#/business-rules), [`BR-ATT-006`](#/business-rules), [`BR-TIME-006`](#/business-rules)

**Acceptance criteria**
1. A Break can exist for a Membership and date without any tracking session — this resolves `CONF-06`.
2. Break time is excluded from worked time in every report and in payroll.
3. Screenshots and activity capture do not occur during a declared break.
4. A Break record and an Idle Period record are never merged or interchanged.

---

## REQ-ATT-005 — Break types and policy
{P1} {MVP} {Derived} {Standard} · Actor: Administrator

**The system shall** allow an Organization to define break types and whether each is paid, and shall apply that classification in worked-time and payroll calculations.

**Acceptance criteria**
- Paid break time is excluded from worked time but included in payable time where the type is paid.
- The classification applied is recorded on the Break so historical calculations remain explicable.

---

## REQ-ATT-006 — Attendance exceptions view
{P1} {MVP} {Derived} {Standard} · Actor: Manager, Administrator

**The system shall** surface attendance exceptions — late, absent, early departure, unscheduled activity and missing data — for a Manager's scope over a selected period.

**Acceptance criteria**
- Exceptions distinguish "not tracking" from "tracker not syncing" from "on leave" from "not scheduled".
- The view is filterable by Team and date range.
- Each exception links to the underlying evidence.

---

# LEAVE · Leave Management

## REQ-LEAVE-001 — Leave types
{P0} {MVP} {Confirmed} {Standard} · Actor: Administrator

**The system shall** allow an Organization to define Leave Types with a name, description, paid flag and approval-required flag.

**Acceptance criteria**
- Leave Types are Organization-scoped.
- A Leave Type in use cannot be deleted; it can be deactivated.
- A default set is created with a new Organization and is fully editable.

---

## REQ-LEAVE-002 — Leave request submission
{P0} {MVP} {Confirmed} {Standard} · Actor: Employee

**The system shall** allow a Member to submit a leave request for a Leave Type over a date range with an optional reason.

**Acceptance criteria**
- Overlapping requests for the same Membership are refused, showing the conflict.
- A request for a Leave Type not requiring approval is auto-approved on submission.
- The approving Manager is notified on submission.
- Requests for past dates are permitted and trigger attendance recomputation.

---

## REQ-LEAVE-003 — Leave decision
{P0} {MVP} {Confirmed} {Standard} · Actor: Manager, Administrator, Owner

**The system shall** allow an authorised Member to approve or reject a leave request, with a comment, and shall notify the requester.

**Acceptance criteria**
- The deciding Membership and decision time are recorded — the decider is recorded as a Membership, not as a global User.
- A Member cannot decide their own request — [`BR-LEAVE-002`](#/business-rules).
- Rejection requires a comment.
- Approval triggers attendance recomputation for the covered dates.

---

## REQ-LEAVE-004 — Leave cancellation
{P1} {MVP} {Derived} {Standard} · Actor: Employee, Manager

**The system shall** allow a pending request to be cancelled by the requester, and an approved future request to be cancelled by the requester or an authorised Member.

**Acceptance criteria**
- Cancelling approved leave triggers attendance recomputation for the affected dates.
- Cancellation is audit-logged.
- Cancelling leave inside an approved Timesheet period requires the Timesheet to be reopened first.

---

## REQ-LEAVE-005 — Leave calendar
{P1} {MVP} {Confirmed} {Standard} · Actor: Manager, Administrator, Employee

**The system shall** present leave as a calendar over a Team or the Organization for a selected period.

**Acceptance criteria**
- A Manager sees their scope; an Employee sees their own leave and, where the Organization permits, their Team's.
- Pending and approved leave are visually distinct.

---

## REQ-LEAVE-006 — Leave and attendance integration
{P0} {MVP} {Derived} {Standard} · Actor: System

**The system shall** apply approved leave when deriving attendance, producing status `on_leave` and adjusting expected seconds.

**Acceptance criteria**
- A date with approved leave is never `absent`.
- Time tracked on an approved leave date is recorded and flagged as an inconsistency for review — [`BR-LEAVE-004`](#/business-rules).
- Partial-day leave adjusts expected seconds proportionally where the Leave Type supports it.

:::warning Leave balances are not in MVP
No entity holds leave entitlement, accrual or balance (`CONF-09`). Members can request leave; nobody can ask how much they have left. This is a stated limitation, not an oversight — [`OQ-011`](#/open-questions).
:::

---

# TS · Timesheets & Approvals

## REQ-TS-001 — Timesheet generation
{P0} {MVP} {Confirmed} {Standard} · Actor: System

**The system shall** generate one Timesheet per Membership per configured period, containing the Time Entries whose start falls within the period.

**Acceptance criteria**
- The Organization has exactly one timesheet periodicity in effect at a time — [`BR-TS-002`](#/business-rules).
- A Time Entry belongs to at most one Timesheet — [`BR-TS-003`](#/business-rules).
- Exactly one Timesheet exists per Membership per period.
- Generation is idempotent.

:::warning This resolves a double-payment risk
`resources-1.md` §19 offers daily, weekly and monthly timesheets simultaneously while the schema allows overlapping periods (`CONF-08`) — which would let one time entry be approved twice and paid twice. A single periodicity, plus one-timesheet-per-entry, closes it.
:::

---

## REQ-TS-002 — Timesheet review
{P0} {MVP} {Derived} {Standard} · Actor: Employee

**The system shall** allow a Member to review a draft Timesheet showing every included Time Entry, its Project and Task, and the period total, before submission.

**Acceptance criteria**
- Manual and edited entries are visually distinguished from tracked entries.
- Totals reconcile to the sum of included entries exactly.
- The Member can correct entries while the Timesheet is `draft` — [`REQ-TIME-009`](#req-time-009).

---

## REQ-TS-003 — Timesheet submission
{P0} {MVP} {Confirmed} {Standard}

**Statement.** The system shall allow a Member to submit a draft Timesheet, snapshotting each included entry's duration at the moment of submission.

| | |
|---|---|
| **Actor** | Employee |
| **Dependencies** | `REQ-TS-001` |
| **Entitlement** | `time_approvals` {Standard} |

**Main flow**
1. Member submits the Timesheet.
2. System snapshots each included Time Entry's duration onto its Timesheet Entry.
3. System sets status `submitted` and records the submission time.
4. System notifies the approving Manager.

**Alternative flows**
- **A1 — Manager submits on the Member's behalf.** Permitted where the Organization allows it; the actor is recorded as the Manager.
- **A2 — Period contains no entries.** A zero Timesheet may be submitted; this is meaningful and distinct from not submitting.

**Exceptions**
| Condition | Behaviour |
|---|---|
| Timesheet not in `draft` | Rejected as an invalid transition |
| Period has not ended | Rejected unless the Organization permits early submission |

**Business rules** [`BR-TS-001`](#/business-rules), [`BR-TS-004`](#/business-rules)

**Acceptance criteria**
1. After submission, editing an underlying Time Entry does not change the submitted Timesheet's total.
2. The snapshot is stored per entry, not only as a period total.
3. Submission is idempotent — resubmitting a submitted Timesheet is not an error and does not re-snapshot.

---

## REQ-TS-004 — Timesheet approval
{P0} {MVP} {Confirmed} {Standard}

**Statement.** The system shall allow an authorised Member to approve a submitted Timesheet, creating an immutable Approval record and making the time available to payroll.

| | |
|---|---|
| **Actor** | Manager (in scope), Administrator, Owner |
| **Dependencies** | `REQ-TS-003`, `REQ-RBAC-004` |
| **Entitlement** | `time_approvals` {Standard} |

**Main flow**
1. Reviewer opens the submitted Timesheet with anomalies surfaced.
2. Reviewer approves.
3. System sets status `approved`, records the approval time, and writes an Approval record with action `approved` and the reviewing Membership.
4. System notifies the Member.
5. The time becomes eligible for payroll.

**Alternative flows**
- **A1 — Reject.** A comment is mandatory; status returns to `draft`; the Member is notified with the comment.
- **A2 — Request changes.** Similar to reject, with specific entries flagged; status returns to `draft`.

**Exceptions**
| Condition | Behaviour |
|---|---|
| Reviewer is the Timesheet's owner | Refused — [`BR-TS-005`](#/business-rules) |
| Timesheet not in `submitted` | Refused as an invalid transition |
| Reviewer outside scope | Refused as not found, and recorded |

**Business rules** [`BR-TS-005`](#/business-rules), [`BR-TS-006`](#/business-rules), [`BR-TS-007`](#/business-rules)

**Acceptance criteria**
1. A Member cannot approve their own Timesheet by any route, including a direct API call.
2. Every decision produces an Approval record; no decision overwrites a previous one.
3. Rejection without a comment is refused.
4. Only approved Timesheet time is visible to payroll calculation.

---

## REQ-TS-005 — Approval history
{P0} {MVP} {Derived} {Standard} · Actor: System

**The system shall** retain every approval action on a Timesheet as an append-only history, recording the reviewing Membership, the action, any comment and the time.

**Acceptance criteria**
- No API path updates or deletes an Approval record.
- The full history is visible to the Member and to authorised reviewers.
- History survives the reviewer leaving the Organization.

---

## REQ-TS-006 — Timesheet reopening
{P1} {MVP} {Derived} {Standard} · Actor: Administrator, Owner

**The system shall** allow an approved Timesheet to be reopened through an explicit, permissioned, audited action that returns it to `draft` and invalidates any payroll entry derived from it.

**Acceptance criteria**
- Reopening requires a reason.
- Reopening is refused while a Payroll Period containing it is `processed`, until that period is reopened — [`BR-PAY-005`](#/business-rules).
- Reopening is recorded in the approval history, not as an edit to the approval.
- Affected payroll entries are marked invalid, never silently recalculated.

---

## REQ-TS-007 — Submission escalation
{P2} {V1.1} {Proposed} {Standard} · Actor: System

**The system shall** notify a Member and their Manager when a Timesheet period has ended and the Timesheet remains unsubmitted beyond a configured interval.

**Acceptance criteria**
- The interval is Organization-configurable.
- Escalation stops on submission.

---

## REQ-TS-008 — Approval queue
{P0} {MVP} {Derived} {Standard} · Actor: Manager, Administrator

**The system shall** present a queue of Timesheets awaiting the reviewer's decision, ordered so that those with anomalies appear first.

**Acceptance criteria**
- Anomaly signals include manual entries, edited entries, unresolved idle periods, attendance exceptions and unusually high or low totals.
- The queue shows only Timesheets within the reviewer's scope.
- Each item reaches the underlying evidence in one step.

---

# PAY · Payroll Preparation

## REQ-PAY-001 — Payroll scope and positioning
{P0} {MVP} {Confirmed} {Standard} · Actor: System

**The system shall** provide payroll **preparation**: calculating payable amounts from approved time and exporting them. It shall not disburse payments, compute tax or statutory deductions, or calculate overtime at MVP.

**Acceptance criteria**
- No payment instruction is generated or transmitted.
- Export output is documented as an input to an external payroll system.
- The absence of overtime, tax and deduction handling is stated in the product interface, not only in documentation.

:::warning Naming risk
The feature matrix calls this "Payroll" `{Confirmed}`. What is built is preparation and export (`CONF-10`). A finance buyer who reads "Payroll" and receives no tax handling will treat the difference as a defect.
:::

---

## REQ-PAY-002 — Pay rates
{P0} {MVP} {Derived} {Standard} · Actor: Administrator, Owner

**The system shall** allow a Pay Rate to be recorded per Membership with an amount, a currency and an effective-from date, optionally with an effective-until date.

**Acceptance criteria**
- Rate periods for one Membership never overlap.
- Currency is recorded on the rate, independently of the Organization's default currency.
- Changing a rate creates a new record; it never overwrites an existing one — [`BR-PAY-002`](#/business-rules).
- Rate changes are audit-logged and visible to the Member.

---

## REQ-PAY-003 — Payroll period lifecycle
{P0} {MVP} {Derived} {Standard} · Actor: Administrator, Owner

**The system shall** support Payroll Period statuses `draft`, `open`, `calculating`, `calculated`, `approved`, `processed` and `failed`, with defined transitions.

**Acceptance criteria**
- Periods for one Organization do not overlap.
- A `failed` calculation is retryable and leaves no partial entries.
- Every transition is audit-logged.

---

## REQ-PAY-004 — Payroll calculation
{P0} {MVP} {Confirmed} {Standard}

**Statement.** The system shall calculate payroll for a period exclusively from time belonging to approved Timesheets, applying the Pay Rate effective for each portion of the period and snapshotting the rate applied.

| | |
|---|---|
| **Actor** | Administrator, Owner |
| **Dependencies** | `REQ-TS-004`, `REQ-PAY-002` |
| **Entitlement** | `payroll` {Standard} |

**Main flow**
1. Operator opens the Payroll Period and triggers calculation.
2. System lists Memberships with approved time in the period, and separately lists time that is not approved.
3. For each Membership, the system sums approved seconds, resolves the effective Pay Rate for each portion, computes gross, applies adjustments and computes net.
4. System writes a Payroll Entry per Membership containing approved seconds, the rate applied, gross, adjustments, net and currency.
5. Period reaches `calculated`.

**Alternative flows**
- **A1 — Rate change mid-period.** Each portion is calculated at the rate effective for its dates and the composition is shown.
- **A2 — Unapproved time exists.** It is excluded and reported explicitly; the operator acknowledges before proceeding.
- **A3 — Recalculation before approval.** Permitted; previous entries are replaced and the recalculation is audit-logged.

**Exceptions**
| Condition | Behaviour |
|---|---|
| A Membership has approved time but no Pay Rate | Listed as an exception; calculation does not proceed silently at zero |
| Calculation fails partway | Period moves to `failed`; no partial entries remain |
| Approved time in two currencies for one Membership | Rejected; a Membership has one rate in effect at any instant |

**Business rules** [`BR-PAY-001`](#/business-rules) to [`BR-PAY-004`](#/business-rules)

**Acceptance criteria**
1. Time not belonging to an approved Timesheet never contributes to any Payroll Entry.
2. Each Payroll Entry records the rate actually applied, so a later rate change does not alter historical payroll.
3. A rate change mid-period produces a gross amount equal to the sum of each portion at its own rate.
4. Amounts are computed with fixed-precision arithmetic; no floating-point rounding artefacts appear in output — [`NFR-REL-006`](#/non-functional-requirements).

---

## REQ-PAY-005 — Payroll adjustments
{P1} {MVP} {Derived} {Standard} · Actor: Administrator, Owner

**The system shall** allow a single adjustment amount with a description to be applied per Membership per Payroll Period.

**Acceptance criteria**
- The adjustment and its description are recorded on the Payroll Entry.
- Adding or changing an adjustment is audit-logged.
- Adjustments cannot be applied to a `processed` period without reopening it.

:::note An accepted MVP limitation
`resources-12.md` §48 identifies that a single unexplained adjustment amount has no audit trail and recommends an itemised model, then defers it (`GAP-20`). MVP accepts the limitation with the description field as partial mitigation — [`BR-PAY-006`](#/business-rules).
:::

---

## REQ-PAY-006 — Payroll approval and processing
{P0} {MVP} {Derived} {Standard} · Actor: Owner, Administrator

**The system shall** require explicit approval of a calculated Payroll Period before it can be marked processed, and shall make processed entries immutable.

**Acceptance criteria**
- A `processed` Payroll Entry cannot be modified by any API path.
- Approval and processing are separately audit-logged with the acting Membership.
- Approving a period whose underlying Timesheets have since been reopened is refused.

---

## REQ-PAY-007 — Payroll export
{P0} {MVP} {Derived} {Standard} · Actor: Owner, Administrator

**The system shall** export a Payroll Period as CSV containing, per Membership, approved seconds and hours, rate, currency, gross, adjustments and net.

**Acceptance criteria**
- The export reconciles exactly to the stored Payroll Entries.
- Durations appear both as seconds and as decimal hours, with the rounding rule applied stated in the file.
- The export is generated asynchronously and delivered through a time-limited link.
- Export generation is audit-logged.

---

## REQ-PAY-008 — Payroll period reopening
{P1} {MVP} {Derived} {Standard} · Actor: Owner

**The system shall** allow a processed Payroll Period to be reopened through an explicit, permissioned, audited action, invalidating its export.

**Acceptance criteria**
- Reopening requires a reason.
- The prior entries are retained as a superseded version, not overwritten.
- The invalidated export is marked as such wherever it is referenced.

---

# REPORT · Reporting & Dashboards

## REQ-REPORT-001 — Common report model
{P0} {MVP} {Derived} · Actor: All

**The system shall** apply a common filter, sort, pagination and export model to every report: date range, Member, Team, Project and Task.

**Acceptance criteria**
- Every report accepts the same filter parameters where they are meaningful.
- Every report is paginated and never returns an unbounded result set.
- Every report offers CSV export.
- Results are always scoped to the viewer's permitted scope before any filter is applied.

---

## REQ-REPORT-002 — Hours report
{P0} {MVP} {Confirmed} {Basic} · Actor: All

**The system shall** report tracked hours by Member, Team, Project and Task over a period, with totals and per-day breakdown.

**Acceptance criteria**
- Totals reconcile exactly to the underlying Time Entries.
- Manual and edited entries are distinguishable in the output.
- Discarded entries are excluded.

---

## REQ-REPORT-003 — Timeline report
{P0} {MVP} {Confirmed} {Basic}

**Statement.** The system shall present a single chronological view for a Member and date combining time entries, idle periods, breaks, activity levels, applications, websites, screenshots and, where entitled, recordings.

| | |
|---|---|
| **Actor** | Member (own), Manager (scope), Administrator, Owner |
| **Dependencies** | `REQ-TIME-007`, `REQ-MON-001` to `REQ-MON-005` |
| **Entitlement** | `timeline_report` {Basic}; individual layers gated by their own entitlements |

**Main flow**
1. Viewer selects a Member and a date.
2. System renders one time axis carrying every available layer.
3. Viewer inspects any point to see the underlying records.
4. Viewer navigates to adjacent dates without losing context.

**Alternative flows**
- **A1 — Entitlement missing for a layer.** The layer is shown as requiring a named plan, not silently omitted.
- **A2 — Data expired under retention.** Shown as expired with the window that applied.
- **A3 — Capture degraded on the Device.** Shown as unavailable for that period — [`REQ-MON-006`](#req-mon-006).

**Exceptions**
| Condition | Behaviour |
|---|---|
| Member outside the viewer's scope | Refused as not found, and recorded |
| Very long day (overnight shift) | Axis spans the shift, not the calendar day |

**Acceptance criteria**
1. All available layers render on one shared time axis.
2. The four evidence-gap states are visually distinct.
3. Any point on the axis reaches its underlying record in one step.
4. A Member can always view their own timeline in full.

---

## REQ-REPORT-004 — Project and task report
{P0} {MVP} {Confirmed} {Basic} · Actor: All

**The system shall** report time by Project and Task, with per-Member breakdown and period totals.

**Acceptance criteria**
- Archived and completed Projects remain reportable.
- Unattributed time, where permitted, is reported as a distinct category.

---

## REQ-REPORT-005 — Member and team report
{P0} {MVP} {Confirmed} {Basic} · Actor: Manager, Administrator, Owner

**The system shall** report tracked time, activity, attendance and approval state by Member and by Team.

**Acceptance criteria**
- A Manager sees only their scope.
- Columns requiring an absent entitlement are shown as requiring an upgrade, not hidden.

---

## REQ-REPORT-006 — Attendance report
{P0} {MVP} {Confirmed} {Standard} · Actor: Manager, Administrator, Owner

**The system shall** report attendance per Member per date with expected, worked, lateness, early departure and status.

**Acceptance criteria**
- Statuses use the fixed vocabulary.
- Leave and holidays are visible and are never presented as absence.
- Exportable to CSV.

---

## REQ-REPORT-007 — Activity and usage report
{P0} {MVP} {Confirmed} {Standard} · Actor: Manager, Administrator, Owner

**The system shall** report activity percentages, application usage and website usage by Member, Team and period, classified by the Organization's Productivity Rules.

**Acceptance criteria**
- Unclassified targets report as neutral.
- The report never presents an aggregate score for a person as a performance measure — [`BR-MON-007`](#/business-rules).
- The classification basis and its effective date are stated.

---

## REQ-REPORT-008 — Screenshot report
{P0} {MVP} {Confirmed} {Basic} · Actor: Manager (scope), Administrator, Owner, Member (own)

**The system shall** present screenshots for a Member and period as a paginated gallery with capture time, Project and Task.

**Acceptance criteria**
- Images load through short-lived signed URLs issued after authorization.
- Expired screenshots are indicated as expired rather than missing.
- The gallery is paginated and does not load an unbounded number of images.

---

## REQ-REPORT-009 — Dashboards
{P0} {MVP} {Confirmed} {Basic} · Actor: All

**The system shall** provide three dashboards: individual, team and organization, each answering that audience's primary questions.

**Acceptance criteria**
- The individual dashboard shows today's tracked time, current tracking state, sync state, this period's total, timesheet state and schedule.
- The team dashboard shows per-Member tracked time, activity, attendance status, tracking state and pending approvals.
- The organization dashboard shows tracked hours, active Members, attendance summary, project totals, subscription state and seat usage.
- Every dashboard respects scope and entitlements.

---

## REQ-REPORT-010 — Asynchronous export
{P0} {MVP} {Derived} · Actor: All

**The system shall** generate exports asynchronously and deliver them through a time-limited authenticated link.

**Acceptance criteria**
- No export blocks an interactive request.
- The link expires within a bounded period.
- Export generation is audit-logged with the requester, the report and the filters.

---

## REQ-REPORT-011 — Office vs Remote report
{P2} {V1.1} {Confirmed} {Premium} · Actor: Manager, Administrator, Owner

**The system shall** classify tracking sessions as office or remote by comparing observed device network information against the Organization's defined office networks, and report the split by Member, Team and period.

**Acceptance criteria**
- Classification is derived per session from observation, never stored as a permanent attribute of a person — [`BR-REPORT-002`](#/business-rules).
- Sessions that cannot be classified are reported as unknown, not defaulted to remote.
- Office locations and their networks are Organization-defined.

---

## REQ-REPORT-012 — Internet connectivity report
{P2} {V1.1} {Confirmed} {Premium} · Actor: Manager, Administrator, Platform Operations

**The system shall** record device connectivity observations and report connectivity state and interruptions by Device, Member and period.

**Acceptance criteria**
- Connectivity observations record status and optional latency, and nothing about content.
- The report distinguishes device offline from server unreachable where the data supports it.
- Connectivity data supports explaining sync backlogs to a Manager.

---

## REQ-REPORT-013 — Executive dashboard
{P3} {Future} {Open} {Premium}

**Statement.** Blocked. The feature matrix sells "Executive dashboard and reporting" as a Premium capability `{Confirmed}`, and no source defines its content, audience questions, metrics or data model (`GAP-03`).

**This requirement cannot be specified without a product decision** — [`OQ-005`](#/open-questions).

**What is known:** it is Premium-only, it belongs to the "Company Insights" audience, and the executive audience's question is organization-level performance rather than individual or team activity.

**Acceptance criteria** — not definable until `OQ-005` is resolved.

---

## REQ-REPORT-014 — Work-life balance metrics
{P3} {Future} {Open} {Standard}

**Statement.** Blocked. The feature matrix sells "Work-life balance metrics" for Standard and Premium `{Confirmed}`, and no source defines any metric, threshold, calculation or presentation (`GAP-01`).

**This requirement cannot be specified without a product decision** — [`OQ-004`](#/open-questions).

**What is known:** the underlying data — tracked hours against scheduled hours, work outside scheduled hours, break frequency, session length, weekend and late-night activity — is already captured. The gap is entirely definitional.

**Acceptance criteria** — not definable until `OQ-004` is resolved.

:::warning Two sold features are unbuildable from this documentation
`REQ-REPORT-013` and `REQ-REPORT-014` are commercially committed by the matrix and cannot be specified. They are the clearest examples of why the matrix is a sales artefact rather than a specification. See [`RISK-003`](#/risks).
:::

---

# NOTIF · Notifications

## REQ-NOTIF-001 — In-app notifications
{P0} {MVP} {Derived} · Actor: System

**The system shall** deliver notifications to a Membership in-app, with a read state and a notification history.

**Acceptance criteria**
- Notifications are addressed to a Membership, not to a global User — a person's notifications in one Organization are invisible in another.
- Read state is per notification and per Membership.
- History is paginated and filterable by type.

---

## REQ-NOTIF-002 — Email notifications
{P0} {MVP} {Derived} · Actor: System

**The system shall** deliver notifications by email asynchronously through a queue, retrying transient failures.

**Acceptance criteria**
- No email is sent inside a request cycle.
- Failures are retried with backoff and permanent failures are recorded.
- Delivery failures are visible to platform operations.

---

## REQ-NOTIF-003 — Notification preferences
{P0} {MVP} {Derived} · Actor: Member

**The system shall** allow a Member to configure, per notification type, whether it is delivered in-app and by email.

**Acceptance criteria**
- Preferences are stored per Membership, so a person can have different settings in different Organizations.
- A defined set of notifications is mandatory and cannot be disabled — security events, monitoring policy changes and decisions affecting the Member's pay — [`BR-NOTIF-002`](#/business-rules).
- Preference changes take effect immediately.

---

## REQ-NOTIF-004 — Real-time delivery
{P1} {MVP} {Confirmed} {Standard} · Actor: System

**The system shall** deliver notifications and live tracking-state changes to open web application sessions without requiring a page reload.

**Acceptance criteria**
- A notification raised while the Member has the application open appears without reload.
- Failure of the real-time channel degrades to periodic refresh; no notification is lost.
- Real-time delivery is gated on the `realtime_notifications` entitlement; in-app and email delivery are not.

:::note Transport undecided
No source selects a real-time transport (`GAP-05`). The requirement is stated behaviourally so System Design can choose between WebSocket, server-sent events and polling on operational grounds.
:::

---

## REQ-NOTIF-005 — Notification catalogue
{P0} {MVP} {Derived} · Actor: System

**The system shall** define a fixed catalogue of notification types, each with a recipient rule, a default channel set and a mandatory flag.

**Acceptance criteria**
- Every notification the system emits belongs to the catalogue.
- Adding a type requires defining its recipient rule and defaults.
- The catalogue covers at minimum: invitation, invitation accepted, timesheet submitted, timesheet approved, timesheet rejected, timesheet reopened, leave requested, leave decided, inactivity alert, monitoring policy changed, sync backlog, subscription trial ending, payment failed, seat limit reached, pay rate changed, and security events.

---

# BILL · Plans, Subscriptions & Entitlements

## REQ-BILL-001 — Plan and feature catalogue
{P0} {MVP} {Confirmed} · Actor: Platform Administrator

**The system shall** maintain a catalogue of Plans and Features, and a mapping of which Features each Plan grants, with typed limits where a Feature is not boolean.

**Acceptance criteria**
- Features are identified by stable codes.
- A Feature may be boolean, numeric or configuration-valued.
- Plan composition is data, changeable without code deployment.
- Features marked future release in the commercial matrix are granted by **no** plan — [`BR-BILL-005`](#/business-rules).

---

## REQ-BILL-002 — Entitlement resolution
{P0} {MVP} {Derived}

**Statement.** The system shall resolve every entitlement question for an Organization through a single service that reads the Organization's active Subscription, its Plan, and that Plan's Features.

| | |
|---|---|
| **Actor** | System |
| **Dependencies** | `REQ-BILL-001`, `REQ-BILL-005` |

**Main flow**
1. A caller asks whether an Organization is entitled to a Feature, or asks for a numeric limit.
2. The service resolves the Organization's active Subscription.
3. The service resolves the Plan and its Feature mapping.
4. The service returns a typed answer.

**Alternative flows**
- **A1 — Subscription `trialing`.** Entitlements of the selected Plan apply in full.
- **A2 — Subscription `past_due`.** Entitlements continue during the grace period.
- **A3 — Subscription `expired` or `canceled` past its period end.** Only read and export entitlements remain; capture and creation stop.

**Exceptions**
| Condition | Behaviour |
|---|---|
| No active Subscription | Treated as no entitlements beyond read and export |
| Unknown Feature code | Treated as not entitled, and the lookup is recorded as a defect signal |

**Business rules** [`BR-BILL-001`](#/business-rules) to [`BR-BILL-003`](#/business-rules)

**Acceptance criteria**
1. No code path outside this service reads the Plan name to make an access decision.
2. A plan composition change alters behaviour without a code deployment.
3. Entitlement results are cacheable but invalidate immediately on subscription or plan change.
4. An automated test asserts that no plan-name comparison exists in any request-handling code.

---

## REQ-BILL-003 — Server-side feature gating
{P0} {MVP} {Derived} · Actor: System · Depends: `REQ-BILL-002`

**The system shall** enforce entitlement on every gated operation at the API, independently of any client behaviour.

**Acceptance criteria**
- Every gated endpoint refuses a request from an unentitled Organization, including when called directly with valid credentials.
- The refusal names the plan that provides the feature.
- An automated matrix test covers every gated endpoint against every plan.

---

## REQ-BILL-004 — Trial
{P0} {MVP} {Derived} · Actor: Owner

**The system shall** provide a time-limited trial of a selected Plan, granting that Plan's entitlements in full, with advance notice before expiry.

**Acceptance criteria**
- Trial length is configurable platform-wide.
- Trial entitlements are identical to the paid Plan's.
- The Owner is notified in advance of expiry at defined intervals.
- On expiry without payment the Organization enters the restricted state, and data is retained subject to retention.

---

## REQ-BILL-005 — Subscription lifecycle
{P0} {MVP} {Derived} · Actor: Owner

**The system shall** maintain Subscription statuses `trialing`, `active`, `past_due`, `canceled` and `expired`, with a start and end date on each Subscription record so plan history is explicit.

**Acceptance criteria**
- An Organization has at most one active Subscription at any time — [`BR-BILL-006`](#/business-rules).
- Superseded Subscriptions are retained with their dates, providing plan history.
- Every status change is audit-logged and notified to the Owner.

---

## REQ-BILL-006 — Seat counting and limits
{P1} {MVP} {Proposed} · Actor: System

**The system shall** count active Memberships as seats, expose current usage against the Plan limit, and refuse actions that would exceed it.

**Acceptance criteria**
- Invitation and acceptance are both refused when the limit would be exceeded — the check occurs at both points.
- Suspended and removed Memberships do not consume seats.
- Usage and limit are visible to the Owner.
- Where a Plan has no seat limit, the limit is explicitly unlimited rather than absent.

---

## REQ-BILL-007 — Payment method and invoices
{P0} {MVP} {Derived} · Actor: Owner

**The system shall** allow a payment method to be added and replaced, and shall present invoice history.

**Acceptance criteria**
- Card and bank details are never stored by the platform; only a provider reference is retained — [`BR-BILL-007`](#/business-rules).
- Invoice history is available for the life of the Organization.
- Payment failure moves the Subscription to `past_due` and notifies the Owner.

---

## REQ-BILL-008 — Billing provider reconciliation
{P1} {MVP} {Derived} · Actor: System

**The system shall** reconcile local Subscription state against the billing provider on a schedule, correcting divergence caused by lost webhooks.

**Acceptance criteria**
- Divergence is detected and corrected without manual intervention.
- Every correction is audit-logged.
- Reconciliation failures are visible to platform operations.

---

## REQ-BILL-009 — Downgrade guardrails
{P1} {MVP} {Proposed} · Actor: Owner · Depends: `REQ-DATA-002`

**The system shall** state the consequences of a downgrade before it is confirmed, including which features become unavailable and how retention changes.

**Acceptance criteria**
- The confirmation names each entitlement being lost.
- Where retention shortens, the confirmation states the volume of data that becomes eligible for deletion.
- A grace period applies before data outside the new retention window is deleted — [`OQ-022`](#/open-questions).
- A downgrade below the current seat count is refused with the number of Memberships that must be removed first.

---

# AUDIT · Audit Logging

## REQ-AUDIT-001 — Audit record capture
{P0} {MVP} {Derived} · Actor: System

**The system shall** write an append-only audit record for every state change that is permission-relevant, policy-relevant or financially relevant, capturing the acting Membership, action, entity type and identifier, prior values, new values, source address and client.

**Acceptance criteria**
- Audit records are scoped to an Organization.
- Prior and new values are captured for changed fields.
- The record is written in the same transaction as the change it describes, or the change does not commit.

---

## REQ-AUDIT-002 — Audit coverage
{P0} {MVP} {Derived} · Actor: System

**The system shall** audit at minimum: authentication events, role and permission changes, membership lifecycle, organization and monitoring settings changes, retention configuration changes, project and task lifecycle, manual time entry creation and editing, timesheet decisions and reopening, pay rate changes, payroll calculation, approval, processing and reopening, subscription changes, evidence deletion requests and decisions, retention-driven deletions, and support elevation.

**Acceptance criteria**
- A coverage checklist is verified before each release gate.
- An audited action that produces no record fails its test.

---

## REQ-AUDIT-003 — Audit immutability
{P0} {MVP} {Derived} · Actor: System

**The system shall** provide no interface, API path or application code path that updates or deletes an audit record.

**Acceptance criteria**
- No update or delete operation against audit records exists in application code.
- Audit records are removed only by the retention process, and that removal is itself recorded.
- An Administrator cannot delete audit records.

---

## REQ-AUDIT-004 — System actor
{P0} {MVP} {Derived} · Actor: System

**The system shall** permit an audit record with no human actor for system-initiated actions, identifying the action so the origin is unambiguous.

**Acceptance criteria**
- Retention deletions, reconciliation corrections and scheduled derivations produce records with a null actor and a named system action.
- No system-initiated change is unattributed.

---

## REQ-AUDIT-005 — Audit browsing
{P1} {MVP} {Derived} · Actor: Owner, Administrator

**The system shall** allow authorised Members to browse, filter and export their Organization's audit log by actor, action, entity and date range.

**Acceptance criteria**
- Results are Organization-scoped and paginated.
- Export is asynchronous and is itself audited.
- The interface is read-only.

---

# DATA · Data Retention & Deletion

## REQ-DATA-001 — Retention policy configuration
{P0} {MVP} {Confirmed} · Actor: Administrator

**The system shall** allow an Organization to configure a retention period per data type, bounded above by the retention entitlement of its Plan.

**Acceptance criteria**
- Data types include at minimum: tracking events, activity events, application usage, website usage, screenshots, recordings and audit logs.
- A configured period greater than the entitlement ceiling is refused, stating the maximum — [`BR-DATA-002`](#/business-rules).
- Defaults are created with a new Organization at the entitlement ceiling.
- Changes are audit-logged.

---

## REQ-DATA-002 — Retention entitlement ceiling
{P0} {MVP} {Confirmed} · Actor: System · Depends: `REQ-BILL-002`

**The system shall** derive the maximum retention period from the Plan's `retention_months` entitlement — Basic 3 months, Standard 6 months, Premium 24 months — and shall apply the lower of the entitlement and the Organization's configured policy.

**Acceptance criteria**
- The effective retention is always `min(entitlement, policy)`.
- A downgrade reduces the effective ceiling immediately; deletion of newly-out-of-window data is subject to the grace period in `REQ-BILL-009`.
- The effective retention per data type is visible to Administrators and to Members.

---

## REQ-DATA-003 — Retention execution
{P0} {MVP} {Confirmed}

**Statement.** The system shall identify data past its effective retention period and delete it from both object storage and the database on a recurring schedule.

| | |
|---|---|
| **Actor** | System |
| **Dependencies** | `REQ-DATA-001`, `REQ-DATA-002` |

**Main flow**
1. Scheduled job identifies records past effective retention, per Organization and data type.
2. For media, the record is marked `pending_deletion`.
3. The object is deleted from object storage.
4. On confirmed storage deletion, the database record is deleted or marked `deleted`.
5. An audit record is written with a null actor and a retention action.

**Alternative flows**
- **A1 — Non-media data.** Deleted directly from the database with an audit record.
- **A2 — Large backlog.** Processed in bounded batches across runs.

**Exceptions**
| Condition | Behaviour |
|---|---|
| Object storage deletion fails | Record stays `pending_deletion` and is retried; metadata is **not** deleted first — [`BR-DATA-004`](#/business-rules) |
| Data is subject to a legal hold | Excluded from deletion; the hold is recorded — [`OQ-014`](#/open-questions) |

**Business rules** [`BR-DATA-001`](#/business-rules), [`BR-DATA-003`](#/business-rules), [`BR-DATA-004`](#/business-rules)

**Acceptance criteria**
1. Data past its retention period is deleted from both systems within 24 hours of expiry.
2. Metadata is never deleted before its object is confirmed removed — no orphaned private files.
3. Every retention deletion produces an audit record.
4. Retention job failures are visible in platform health, not silent.

---

## REQ-DATA-004 — Organization data export
{P1} {MVP} {Proposed} · Actor: Owner

**The system shall** allow an Owner to export their Organization's data in a machine-readable format.

**Acceptance criteria**
- The export includes members, projects, tasks, time entries, attendance, timesheets, approvals and payroll entries.
- Media is included by reference with time-limited links, or as a bundle where volume permits.
- Export is available while an Organization is `closed`, throughout the grace period.
- Export generation is audit-logged.

---

## REQ-DATA-005 — Member data access and erasure request
{P1} {MVP} {Proposed} · Actor: Member, Administrator

**The system shall** allow a Member to export all data held about them within one Organization, and to raise an erasure request that is routed to an Administrator for decision.

:::warning Legal scope is not determined here
This requirement provides the mechanism. Whether erasure must be granted, what may be lawfully retained despite a request, and which jurisdictions apply are legal questions outside this documentation's competence — [`OQ-014`](#/open-questions) and [Security & Privacy](#/security-privacy).
:::

**Acceptance criteria**
- The export covers every category listed in `REQ-MON-010`.
- The request, decision, reason and outcome are audit-logged.
- Erasure never removes records required for financial integrity without an explicit, recorded decision — [`BR-DATA-005`](#/business-rules).

## REQ-DATA-006 — Storage accounting per media type
{P1} {MVP} {Decided} · Actor: System · Depends: `REQ-MON-001`, `REQ-REC-001` · Decision: `DEC-026`

**The system shall** record, per Organization per day per media type, the bytes added, bytes deleted, total bytes stored and object count.

:::note Added by decision, not by the original baseline
`DEC-026` keeps recordings on the shared `retention_months` entitlement and requires that **storage consumption be tracked separately** from commercial retention. This requirement is that mechanism, and it is the early-warning system for [`RISK-018`](#/risks).
:::

**Acceptance criteria**
- Media types are distinguished: screenshot, recording, export, avatar.
- Totals reconcile to the sum of media metadata for that Organization.
- Figures are visible to Platform Administrators per Organization and platform-wide.
- Growth materially out of step with seat count raises an operational alert — [`NFR-SCALE-006`](#/non-functional-requirements).
- The record contains byte counts and object counts only; no captured content and no member-identifying detail beyond the Organization.
- The accounting is the enforcement input for trial resource limits once [`OQ-029`](#/open-questions) sets values.

---

# ADMIN · Platform Administration

## REQ-ADMIN-001 — Organization administration
{P1} {MVP} {Derived} · Actor: Platform Administrator

**The system shall** allow Platform Administrators to list, search and inspect Organization records — name, status, plan, seat count, creation date and activity summary.

**Acceptance criteria**
- The listing exposes Organization metadata only, never tenant business data.
- Every access is audit-logged.
- The platform surface is separate from the Organization application.

---

## REQ-ADMIN-002 — Organization suspension and reinstatement
{P1} {MVP} {Derived} · Actor: Platform Administrator

**The system shall** allow an Organization to be suspended and reinstated, with suspension blocking access and capture while retaining all data.

**Acceptance criteria**
- A suspended Organization's Members cannot authenticate into it and its Devices are rejected.
- Suspension deletes nothing.
- Suspension and reinstatement require a reason and are audit-logged.
- The Owner is notified.

---

## REQ-ADMIN-003 — Subscription administration
{P1} {MVP} {Derived} · Actor: Platform Administrator

**The system shall** allow Platform Administrators to view and adjust an Organization's Subscription, including extending a trial and correcting provider divergence.

**Acceptance criteria**
- Every adjustment is audit-logged with the acting Platform Administrator and a reason.
- Adjustments are visible in the Organization's own audit log.

---

## REQ-ADMIN-004 — Platform health
{P1} {MVP} {Derived} · Actor: Platform Administrator · Depends: `REQ-SYNC-007`

**The system shall** expose platform health: synchronisation failure rate, queue depth, failed jobs, media upload failures, email delivery failures, retention job outcomes and authentication failure rates.

**Acceptance criteria**
- Metrics are available per Organization and platform-wide.
- Metrics contain no captured content.
- Thresholds raise operational alerts.

---

## REQ-ADMIN-005 — Audited support elevation
{P1} {MVP} {Proposed}

**Statement.** The system shall require a Platform Administrator to request explicit, time-bounded, reason-recorded elevation before accessing any tenant business data, and shall make that access visible to the Organization.

| | |
|---|---|
| **Actor** | Platform Administrator |
| **Dependencies** | `REQ-AUDIT-001` |

:::warning The vendor is a privacy risk surface
This platform stores screenshots and screen recordings of people at work. An unaudited vendor-side view of that data is a serious exposure, both to the individuals and contractually to the customer. No source addresses this (`GAP-15`); the model below is `{Proposed}` and rated `{P1}` only because it accompanies the `ADMIN` module — its absence would be a launch-blocking gap, not a minor one.
:::

**Main flow**
1. Platform Administrator requests elevation for a named Organization with a reason and a duration.
2. System grants read-only elevation for the requested window.
3. Every read under elevation is audit-logged in **both** the platform log and the Organization's own audit log.
4. Elevation expires automatically.
5. The Organization's Owner is notified that elevation occurred, with the reason and window.

**Alternative flows**
- **A1 — Elevation expires mid-task.** Access ends; a new request is required.
- **A2 — Organization has disabled support access.** Elevation is refused — [`OQ-025`](#/open-questions) settles whether Organizations may opt out.

**Exceptions**
| Condition | Behaviour |
|---|---|
| Elevation requested without a reason | Refused |
| Access attempted without elevation | Refused and recorded as a security event |

**Business rules** [`BR-ADMIN-001`](#/business-rules)

**Acceptance criteria**
1. No tenant business data is readable by a Platform Administrator without an active elevation.
2. Every elevated read appears in the Organization's own audit log, visible to its Administrators.
3. Elevation expires automatically without an explicit revocation step.
4. The Owner is notified of every elevation.

---

## REQ-ADMIN-006 — Plan catalogue administration
{P1} {MVP} {Derived} · Actor: Platform Administrator · Depends: `REQ-BILL-001`

**The system shall** allow Platform Administrators to maintain Plans, Features and their mappings.

**Acceptance criteria**
- Changing a Plan's composition takes effect for subscribed Organizations without a code deployment.
- Removing a Feature from a Plan does not delete data captured while it was entitled.
- Every change is audit-logged.

---

## Requirement summary

| Module | Count | P0 | P1 | P2 | P3 |
|---|---|---|---|---|---|
| AUTH | 10 | 7 | 2 | 1 | 0 |
| ORG | 8 | 5 | 3 | 0 | 0 |
| USER | 7 | 5 | 2 | 0 | 0 |
| RBAC | 6 | 5 | 0 | 1 | 0 |
| TEAM | 4 | 4 | 0 | 0 | 0 |
| PROJ | 8 | 7 | 1 | 0 | 0 |
| DEV | 7 | 4 | 3 | 0 | 0 |
| TIME | 11 | 10 | 1 | 0 | 0 |
| SYNC | 7 | 5 | 2 | 0 | 0 |
| MON | 11 | 9 | 2 | 0 | 0 |
| REC | 4 | 0 | 4 | 0 | 0 |
| SCHED | 6 | 4 | 2 | 0 | 0 |
| ATT | 6 | 4 | 2 | 0 | 0 |
| LEAVE | 6 | 4 | 2 | 0 | 0 |
| TS | 8 | 6 | 1 | 1 | 0 |
| PAY | 8 | 6 | 2 | 0 | 0 |
| REPORT | 14 | 10 | 0 | 2 | 2 |
| NOTIF | 5 | 4 | 1 | 0 | 0 |
| BILL | 9 | 6 | 3 | 0 | 0 |
| AUDIT | 5 | 4 | 1 | 0 | 0 |
| DATA | 6 | 3 | 3 | 0 | 0 |
| ADMIN | 6 | 0 | 6 | 0 | 0 |
| **Total** | **162** | **113** | **42** | **5** | **2** |

### By evidence class

Six requirements carry two evidence badges — a `{Confirmed}` commercial commitment whose behaviour had to be `{Proposed}` — so the counts below total more than 161.

| Class | Requirements | Interpretation |
|---|---|---|
| `{Confirmed}` | 52 | Traceable to the feature matrix |
| `{Derived}` | 92 | Argued in the research notes |
| `{Proposed}` | 21 | New decisions made here, concentrated in privacy, transparency, manual-entry governance and platform administration |
| `{Open}` | 2 | Cannot be specified — `REQ-REPORT-013`, `REQ-REPORT-014` |

:::note Where the proposals cluster
`{Proposed}` requirements are not spread evenly. They concentrate in monitoring transparency, member self-visibility, manual time governance and vendor support access — precisely the areas a feature matrix never covers and a design conversation about database schemas never reaches. These are the requirements most in need of stakeholder review.
:::

