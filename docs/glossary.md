# Glossary

Canonical terminology for Team Time Track. Every other document in this set uses these terms exactly as defined here. Where the source research uses a different word for the same concept, the alias is listed so the mapping is unambiguous.

:::note Terminology discipline
The most common source of ambiguity in a multi-tenant product is calling the tenant four different things. In this documentation the tenant is always an **Organization** — never "company", "workspace", "account" or "client". Those words all mean something else here, and are defined below.
:::

---

## Tenancy and identity

| Term | Definition | Do not confuse with | Source aliases |
|---|---|---|---|
| **Platform** | The Team Time Track SaaS product as a whole, operated by the vendor | Organization | — |
| **Organization** | The tenant. A paying customer company or workspace. Owns all business data and holds the subscription | Client, Team | "company", "workspace", "tenant" |
| **User** | A global person identity, unique by email address, that can exist independently of any organization | Member, Employee | — |
| **Membership** | The link between one User and one Organization. Carries that person's roles, teams, projects, schedule, pay rate and notification preferences **for that organization only** | User | "organization membership" |
| **Member** | A User viewed through a particular Membership — i.e. a person acting inside a specific organization | User | — |
| **Client** | An external customer *of an organization*, for whom work is performed. Clients are not Team Time Track customers | Organization | "customer of our customer" |
| **Invitation** | A single-use, expiring token issued to an email address to create a Membership in an Organization | Registration | — |

:::note Why Membership matters
The same person can be an Employee at Organization A and a Manager at Organization B, with different teams, projects, pay rates and notification settings in each. Roles and permissions attach to the **Membership**, never to the User. This is the foundational decision of the product — see [`BR-ORG-002`](#/business-rules).
:::

---

## Authorization and commerce

| Term | Definition |
|---|---|
| **Role** | A named bundle of Permissions assignable to a Membership. System roles: Owner, Administrator, Manager, Employee |
| **Permission** | A named capability, expressed as `<resource>.<action>` (for example `timesheets.approve`). Answers *"is this person allowed to do this?"* |
| **Entitlement** | A capability an Organization has purchased through its Plan. Answers *"has this organization bought this?"* |
| **Plan** | A commercial package: Basic, Standard or Premium. A Plan grants a set of Entitlements |
| **Feature** | A named, independently gateable capability (for example `video_recording`, `payroll`, `retention_months`) that Plans grant |
| **Subscription** | An Organization's current commercial relationship to a Plan, with a status and billing period |
| **Seat** | One active Membership counted for billing purposes |

:::warning Permission and Entitlement are not the same thing
A Manager may hold the `recordings.view` permission and still be denied, because their Organization is on Basic and has no `video_recording` entitlement. Both checks must pass independently. See [`BR-BILL-001`](#/business-rules).
:::

---

## Work management

| Term | Definition |
|---|---|
| **Team** | A named group of Memberships inside an Organization, used for reporting and management scope. A Team is **not** a role |
| **Project** | A unit of work owned by an Organization, to which time is tracked. Has explicitly assigned members |
| **Task** | A unit of work inside a Project, to which time is tracked. Has explicitly assigned members |

---

## Tracking

| Term | Definition | Distinguished from |
|---|---|---|
| **Desktop Tracker** | The installed desktop application that captures time, activity and media. The primary capture surface | Web Application |
| **Web Application** | The browser-based management surface for administration, review, approval and reporting | Desktop Tracker |
| **Device** | A registered installation of the Desktop Tracker, bound to one Membership | User |
| **Tracking Session** | A continuous period during which a Member is tracking on a Device. Opened by a start action, closed by a stop action | Time Entry |
| **Tracking Event** | An immutable, timestamped record of something that happened during a Session — started, paused, resumed, idle began, project changed, stopped. Carries a client-generated identifier for idempotency | Time Entry |
| **Time Entry** | A **derived** work interval with a start, end and duration, produced by the server from Tracking Events, or created manually by a person. The unit that reports, timesheets and payroll consume | Tracking Event |
| **Idle Period** | An interval during a Session in which no input activity was observed. **Observed by the system** | Break |
| **Break** | An interval a Member **explicitly declares** as non-working. **Declared by the person** | Idle Period |
| **Manual Time Entry** | A Time Entry created by a person rather than derived from tracking, always carrying a reason and a creator | Time Entry |

:::note Idle is not a break
The distinction is deliberate and load-bearing. An Idle Period is evidence the system inferred; a Break is a statement the employee made. They have different meanings in attendance, different implications in payroll, and different fairness properties in a dispute. See [`BR-TIME-006`](#/business-rules).
:::

---

## Monitoring

| Term | Definition |
|---|---|
| **Activity Event** | An aggregated interval carrying keyboard activity, mouse activity and a derived activity percentage. Never raw keystrokes |
| **Activity Percentage** | The proportion of an interval in which input activity was observed. **Not** a productivity or performance score |
| **Application Usage** | An interval during which a named desktop application was in focus |
| **Website Usage** | An interval during which a named domain was in focus |
| **Productivity Rule** | An Organization-defined classification of an application or domain as productive, unproductive or neutral |
| **Screenshot** | A still image of a Member's screen captured during a Session. Stored as private object-storage media plus database metadata |
| **Recording** | A Premium screen video capture for a Session, stored as an ordered set of Segments |
| **Segment** | One chunk of a Recording, uploaded independently so a crash cannot lose the whole recording |

---

## Workforce management

| Term | Definition |
|---|---|
| **Schedule** | A named expected working pattern belonging to an Organization, with its own timezone |
| **Shift** | One day's expected working window within a Schedule. May cross midnight |
| **Schedule Assignment** | The dated link between a Membership and a Schedule, so schedule changes do not rewrite history |
| **Attendance Record** | A **derived** daily summary per Member: expected seconds, worked seconds, first and last activity, lateness, early departure and a status |
| **Leave Type** | An Organization-defined category of planned absence, with paid and approval-required attributes |
| **Leave Request** | A Member's request for absence over a date range, subject to approval |
| **Holiday** | A non-working day defined by the Organization calendar `{Proposed}` |

---

## Approval and pay

| Term | Definition |
|---|---|
| **Timesheet** | A Member's submitted set of Time Entries for one period, with a status: draft, submitted, approved or rejected |
| **Timesheet Entry** | The link between a Timesheet and one Time Entry, carrying a **snapshot** of the duration at submission |
| **Approval** | An immutable record of a review action taken on a Timesheet: approved, rejected or changes requested |
| **Approved Time** | Time belonging to an approved Timesheet. The **only** input payroll may use |
| **Pay Rate** | A Member's compensation rate with a currency and an effective date range |
| **Payroll Period** | An Organization's processing window |
| **Payroll Entry** | A per-Member financial snapshot for a Payroll Period: approved seconds, the rate applied, gross, adjustments and net |

---

## Platform

| Term | Definition |
|---|---|
| **Audit Log** | An append-only record of who changed what, when, from what value to what value |
| **Retention Policy** | The Organization's configured retention period per data type, bounded above by its Plan entitlement |
| **Notification** | A message delivered to a Membership in-app and/or by email according to that Membership's preferences |
| **Platform Administrator** | A vendor-side operator who administers Organizations, subscriptions and platform health. **Never** an Organization role, and has no access to tenant business data by default |

---

## Status vocabularies

Fixed value sets referenced throughout the requirements. Any change here is a breaking change.

| Entity | Values |
|---|---|
| User | `active` · `suspended` · `deactivated` |
| Membership | `invited` · `active` · `suspended` · `removed` |
| Organization | `trialing` · `active` · `suspended` · `closed` |
| Subscription | `trialing` · `active` · `past_due` · `canceled` · `expired` |
| Tracking Session | `active` · `paused` · `stopped` |
| Time Entry | `active` · `edited` · `discarded` |
| Timesheet | `draft` · `submitted` · `approved` · `rejected` |
| Approval action | `approved` · `rejected` · `changes_requested` |
| Leave Request | `pending` · `approved` · `rejected` · `cancelled` |
| Attendance | `present` · `late` · `absent` · `half_day` · `on_leave` · `holiday` · `rest_day` |
| Payroll Period | `draft` · `open` · `calculating` · `calculated` · `approved` · `processed` · `failed` |
| Recording | `recording` · `uploading` · `processing` · `ready` · `failed` · `deleted` |
| Screenshot | `available` · `pending_deletion` · `deleted` |
| Device | `active` · `revoked` |

---

## Terms deliberately avoided

| Avoided term | Reason | Use instead |
|---|---|---|
| "Employee monitoring score" | Implies a validated performance measure the product does not produce | Activity percentage |
| "Productivity score" for a person | Productivity Rules classify *applications and domains*, not people | Productive time, classified time |
| "Surveillance" | Loaded; the product's stated purpose is time and attendance accuracy | Activity monitoring |
| "Company" / "Workspace" / "Account" | Ambiguous with Organization | Organization |
| "Admin" without qualification | Ambiguous between Organization Administrator and Platform Administrator | Administrator / Platform Administrator |
| "Tracker" without qualification | Ambiguous between the app and the person | Desktop Tracker |
