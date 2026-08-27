# Tenancy, Identity & Security

The mechanisms behind the product's highest-severity requirement — that no organization can ever read another's data — and everything that governs who may do what.

---

## 1. Tenancy model

```text
users                     global identity, unique by email
  │ 1:N
organization_memberships  the authorization context — roles, teams, rates, preferences
  │ N:1
organizations             the tenant; owns all business data
```

Every tenant-owned row carries `organization_id`. Every permission, team, project assignment, schedule, pay rate and notification preference hangs off the **Membership**, never the User. [`BR-ORG-002`](#/business-rules), `ADR-002`.

One person working for two organizations has two Memberships, two role sets, two pay rates, and no visibility between them. Their `users` row is shared; nothing else is.

---

## 2. Isolation: two independent layers

A single mechanism is not enough for a failure this severe. Two layers, each sufficient on its own, neither trusted alone.

### Layer 1 — application scoping

```text
Authenticate ──▶ resolve Membership ──▶ bind TenantContext ──▶ global query scope
```

`TenantContext` is a request-scoped singleton holding the organization and membership. A `BelongsToTenant` trait on every tenant-owned model adds a global scope that appends `WHERE organization_id = ?` to every query and sets `organization_id` on every insert.

Bypassing the scope requires `withoutGlobalScope(TenantScope::class)`, which is banned outside an explicit allowlist and enforced by the CI rule in [Application Architecture](#/sd-architecture) §3.

### Layer 2 — PostgreSQL row-level security `ADR-005`

Middleware issues, inside the request transaction:

```sql
SET LOCAL app.organization_id = '018f...';
```

Every tenant-owned table carries:

```sql
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON time_entries
  USING      (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
```

The application connects as a **non-superuser role without `BYPASSRLS`**. A forgotten `WHERE` clause therefore returns nothing rather than another tenant's rows.

:::note This departs from the source research
`resources-2.md` §2 places row-level security in a later phase. It is brought forward because `SC-01` is a launch gate and the cost of adding it now is a migration plus a connection-role change, while the cost of retrofitting it later is auditing every query written in the meantime. `ADR-005`.
:::

**Where the GUC is not set** — queue workers, scheduled jobs, migrations — the policy denies everything by default. Background jobs that legitimately span tenants (retention sweeps, billing reconciliation) run under a separate `ttt_maintenance` role holding `BYPASSRLS`, use explicit per-organization loops, and are the only code permitted to do so. That role's use is logged.

### What is deliberately not tenant-scoped

`users`, `permissions`, `plans`, `features`, `plan_features` — global reference and identity data with no tenant column and no RLS.

---

## 3. Authentication

Two client types, two credential shapes. `ADR-014`.

### Web application

Laravel Sanctum stateful sessions on the same origin as the API.

```text
POST /api/v1/auth/login
   ↓ verify credentials (Argon2id)
   ↓ if MFA enrolled → 401 mfa_required + challenge id
POST /api/v1/auth/mfa/verify
   ↓ verify TOTP
   ↓ issue session
Set-Cookie: ttt_session=…; HttpOnly; Secure; SameSite=Lax; Path=/
```

The browser never holds a token in JavaScript-reachable storage — [`NFR-SEC-004`](#/non-functional-requirements). CSRF is covered by Sanctum's XSRF token on state-changing requests.

### Desktop tracker

A device-scoped bearer token bound to one Membership and one Device.

```text
POST /api/v1/auth/device/login    email, password, device fingerprint, platform
   ↓ verify credentials, then MFA if required
   ↓ create or match Device
   ↓ issue device token (opaque, 40 bytes, stored hashed)
   ↓ tracker stores it via Electron safeStorage (OS keychain / DPAPI / libsecret)

Authorization: Bearer ttt_dev_<id>.<secret>
```

| Property | Value |
|---|---|
| Storage | Hashed server-side (`SHA-256`); plaintext only in the OS credential store |
| Scope | One Membership, one Organization, one Device |
| Rotation | Silent rotation on every successful refresh, ≤ 30 days |
| Revocation | Immediate — [`REQ-DEV-003`](#/functional-requirements) |
| After revocation | Events captured **before** revocation are still accepted for 72 hours so work is never destroyed — [`BR-SYNC-004`](#/business-rules) |

Switching the active organization on the tracker issues a different device token; a token can never address two organizations.

### Multi-factor authentication `ADR-023` `DEC-023`

TOTP (RFC 6238), 30-second step, ±1 window tolerance, 6 digits.

| Role | MFA |
|---|---|
| Owner | **Required** |
| Administrator | **Required** |
| Finance | **Required** |
| Manager | Supported; required if organization policy demands it |
| Employee | Supported; required if organization policy demands it |

Ten single-use recovery codes are issued at enrolment, stored hashed, and regenerable. Enrolment, verification failure, recovery-code use and reset are all audited. An organization-level `mfa_required_for_all` setting escalates the table above.

MFA is verified once per session for the web client, and at device-token issue for the tracker — not on every request.

---

## 4. Authorization

Two independent questions, both must pass. [`BR-BILL-001`](#/business-rules).

```text
Permission   "may this person do this?"        → Access module, Laravel policies
Entitlement  "did this organization buy it?"   → Billing module, EntitlementService
```

### Roles

Five system roles. `DEC-016`, `DEC-027`.

| Role | Grants |
|---|---|
| **Owner** | Everything, including billing, ownership transfer, organization closure, and payroll |
| **Administrator** | Organization settings, members, teams, projects, schedules, leave types, monitoring and retention policy, audit log, general reports. **Not pay rates or payroll** |
| **Manager** | Within scope: view tracking and monitoring data, approve timesheets and leave, correct time, team reports |
| **Finance** | Pay rates, payroll periods, payroll calculation and export, payroll reports. **Not organization administration** |
| **Employee** | Own tracking, own monitoring record, own timesheets, own leave, own pay rate |

:::warning Administrator ≠ Finance
`DEC-027` explicitly separates compensation from administration. An operations administrator can run the organization without seeing what anyone is paid. This reverses [`REQ-PAY-002`](#/functional-requirements) as originally written, which granted pay-rate access to Administrators; the decision is authoritative.
:::

### Permission catalogue

Named `<resource>.<action>`. Every API operation maps to at least one, verified by a coverage test.

```text
organization.view / manage / close
members.view / invite / manage / suspend
roles.assign
teams.view / manage           projects.view / manage       tasks.view / manage
tracking.view.own / view.team / view.all / correct.own / correct.team
screenshots.view.own / view.team / view.all
recordings.view.own / view.team / view.all      ← distinct from screenshots, DEC/BR-REC-002
monitoring.policy.manage      retention.manage
attendance.view.team / view.all       schedules.manage
leave.request / decide
timesheets.view.own / view.team / submit / approve / reopen
payrates.view / manage        payroll.view / run / approve / export
reports.view.team / view.all  audit.view
billing.view / manage         support.access.manage
```

### Manager scope

A Manager's reach is the union of members of Teams they manage plus members explicitly assigned to them. Resolved per request, never cached across an organization switch. [`BR-RBAC-004`](#/business-rules).

```sql
-- membership ids visible to a manager
SELECT tm.membership_id FROM team_members tm
  JOIN team_managers g ON g.team_id = tm.team_id
 WHERE g.membership_id = :manager
UNION
SELECT membership_id FROM organization_memberships
 WHERE manager_membership_id = :manager;
```

Out-of-scope access returns **404**, and the attempt is recorded.

### Policies

One policy class per aggregate, taking the acting **Membership** rather than the User. A policy never sees a User without a tenant context.

---

## 5. Media access control

Screenshots and recordings are the most sensitive data in the system and are never publicly addressable.

```text
GET /api/v1/screenshots/{id}/url
      ↓ tenant scope        (RLS + query scope)
      ↓ policy              screenshots.view.own | .team | .all
      ↓ entitlement         screenshots
      ↓ retention check     not expired, not pending deletion
      ↓ presign             R2 GET, TTL 15 minutes, single object
      ↓ audit               access recorded for recordings and cross-member views
```

| Control | Value |
|---|---|
| Bucket policy | Private; no public read; no bucket listing |
| URL lifetime | ≤ 15 minutes — [`NFR-SEC-005`](#/non-functional-requirements) |
| Scope | One object per URL; never a prefix |
| Logging | The URL is never written to any log, metric or error payload |
| Batch | A gallery request presigns per item, capped at the page size |

Recording playback presigns **per segment**, so a leaked URL exposes one segment rather than a session.

---

## 6. Monitoring policy and consent gating `ADR-019` `DEC-020`

Monitoring configuration is versioned and immutable once published.

```text
monitoring_policies              monitoring_acknowledgements
  organization_id                  membership_id
  version                          monitoring_policy_id
  config          jsonb            acknowledged_at
  config_hash                      ip_address, user_agent
  materiality     enum
  published_at, published_by
```

### Materiality

On publish, the new configuration is compared with its predecessor across an ordered intensity vector:

| Dimension | Increase means |
|---|---|
| Capture type enabled | `screenshots`, `activity`, `application`, `website`, `recording` turned on |
| Screenshot interval | shorter |
| Website capture depth | domain → path |
| Recording | disabled → enabled, or frame rate increased |
| Tracking mode | user-controlled → automatic |

Any increase makes the version **material**. Anything else — a longer interval, a disabled capture type, a display or reporting change — is non-material.

### Gating

```text
material version published
        ↓
member has not acknowledged
        ↓
capture types introduced or intensified by that version are DISABLED for that member
        ↓
tracker shows the updated disclosure
        ↓
member acknowledges
        ↓
full policy becomes effective
```

Tracking itself continues throughout. Only the newly-intensified capture is withheld — the member is never silently locked out of working. Non-material versions apply immediately with notification only.

The disclosure text is **generated from the stored configuration**, so it cannot drift from what the system actually does. The acknowledgement records the `config_hash`, which is what proves *what* was agreed to.

---

## 7. Vendor support access `DEC-021`

Platform Administrators hold **no standing access** to tenant business data. [`BR-ADMIN-001`](#/business-rules).

```text
organization_settings.support_access_enabled   default TRUE

support_elevations
  organization_id · platform_user_id · reason · requested_at
  expires_at (≤ 4h) · revoked_at · granted_by
```

```text
Platform Administrator requests elevation
        ↓ organization has support access disabled? → REFUSED
        ↓ reason required, duration ≤ 4 hours
        ↓ read-only grant
        ↓ EVERY read logged to the organization's own audit_logs
        ↓ Owner notified immediately
        ↓ expires automatically; no revocation step needed
```

An organization may set `support_access_enabled = false`, in which case elevation is refused outright and support must ask the customer to enable it. Default is enabled, with the audit and notification protections.

Diagnostics that do not require elevation — sync failure rates, queue depth, job outcomes, batch counts — are built from **metadata only**. [`BR-ADMIN-002`](#/business-rules). Routine debugging never requires viewing customer screen content.

---

## 8. Data protection

| Concern | Control |
|---|---|
| Passwords | Argon2id, per-credential salt |
| Device tokens, invitation tokens, reset tokens, recovery codes | SHA-256 hashed at rest |
| TOTP secrets | Encrypted at rest with the application key |
| Transport | TLS 1.2+, HSTS, plaintext refused |
| Media at rest | R2 server-side encryption; private buckets |
| Tracker local queue | SQLite encrypted with a key held in the OS keystore — `DEC-031` |
| Database at rest | Full-disk encryption on the host; backups encrypted before leaving it |
| Logs | Structured; credentials, tokens, signed URLs and captured content never logged |

---

## 9. Rate limiting

Redis-backed, applied per route class and keyed by both source address and identity.

| Class | Limit |
|---|---|
| `auth` — login, MFA verify, reset, invitation accept | 5/min per account, 20/min per IP |
| `sync` — event batch ingestion | 120/min per device |
| `media` — upload authorisation | 240/min per device |
| `read` — general API reads | 600/min per membership |
| `write` — general API writes | 120/min per membership |
| `export` — report and data exports | 10/hour per membership |
| `webhook` — Stripe | not limited; verified by signature |

Throttled authentication responses do not reveal whether the account exists. [`BR-AUTH-003`](#/business-rules).

---

## 10. Threat controls map

Against the threat surface in [Security & Privacy](#/security-privacy) §4.

| Threat | Primary control | Secondary |
|---|---|---|
| `T1` Cross-tenant access | RLS with `FORCE` and a non-bypass role | Global query scope; isolation test per endpoint; 404 on foreign ids |
| `T2` Vendor-side access | No standing access; audited, expiring elevation | Organization opt-out; metadata-only diagnostics |
| `T3` Signed URL leakage | 15-minute TTL, single object, never logged | Per-segment presigning for recordings |
| `T4` Scope escalation | Per-request scope resolution | Out-of-scope attempts recorded; 404 not 403 |
| `T5` Device credential theft | OS keystore, hashed server-side, single-membership scope | Immediate revocation; device inventory; token rotation |
| `T6` Tracker tampering | Code signing and notarisation; verified updates | Server-side derivation; clock-skew flagging; visible gaps |
| `T7` Retention failure | Partition-drop retention with per-batch audit | Job outcome alerting; storage growth monitoring |
| `T8` Payroll manipulation | Approved-time-only reader; snapshots; append-only approvals | Self-approval flagged; full audit chain |
| `T9` Denial of capture | 72-hour offline endurance; bounded local store | Backlog visible to member and organization |
| `T10` Account takeover | Argon2id; TOTP MFA required for Owner, Administrator, Finance | Rate limiting; reset invalidates all sessions and device tokens |

---

## 11. Security testing gates

| Gate | Runs |
|---|---|
| Tenant isolation suite — every tenant-scoped endpoint with foreign identifiers | Every build; blocks merge |
| RLS verification — direct SQL without the GUC returns zero rows | Every build |
| Entitlement matrix — every gated endpoint × every plan | Every build |
| Permission coverage — every route maps to a declared permission | Every build |
| Dependency vulnerability scan | Every build; criticals block release |
| Secret scanning | Pre-commit and CI |
| Penetration test, tenancy-focused | Before `M-09` |

---

## 12. Known residual risk

| Residual | Position |
|---|---|
| Infrastructure-level database access bypasses the application entirely | Controlled operationally: no shared credentials, access logged, break-glass only. Not solvable in the application |
| A leaked signed URL is valid for up to 15 minutes | Accepted trade-off between usability and exposure |
| A member with local administrator rights can prevent capture | Not preventable. The design makes the resulting gap **visible and classified** rather than silent — [`REQ-MON-006`](#/functional-requirements) |
| Screenshots remain indiscriminate | Mitigated by capture pause, exclusions and retention; blur deferred — [`OQ-015`](#/open-questions) |
| Legal basis for monitoring is undetermined | [`OQ-014`](#/open-questions), [`RISK-005`](#/risks). Controls exist; lawfulness is a product and legal determination |
