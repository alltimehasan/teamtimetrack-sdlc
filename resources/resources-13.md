Absolutely. Let's continue with the **SaaS Billing & Entitlement layer**.

This is where we turn the Basic / Standard / Premium feature matrix into something the Laravel backend can enforce consistently.

The product document defines three plans—**Basic, Standard, and Premium**—and assigns capabilities such as screenshots, productivity ratings, reports, payroll, video screen recording, API access, SSO, and client access to those plans.  

---

# 41. `plans`

A plan is a commercial package.

```text id="8h7s4k"
Basic
Standard
Premium
```

Migration:

```php id="zj9kq3"
Schema::create('plans', function (Blueprint $table) {
    $table->uuid('id')->primary();

    $table->string('name', 100);
    $table->string('slug', 100)->unique();

    $table->text('description')->nullable();

    $table->string('billing_interval', 20)
        ->default('monthly');

    $table->decimal('price', 12, 2);

    $table->char('currency', 3);

    $table->boolean('is_active')
        ->default(true);

    $table->timestampsTz();
});
```

Example:

```text id="5s5g1q"
id       name       slug        price
────────────────────────────────────────
...      Basic      basic       ...
...      Standard   standard    ...
...      Premium    premium     ...
```

### Important

I don't recommend hard-coding the actual commercial price into the application based on the feature document unless the pricing itself is explicitly part of our requirements.

The schema supports pricing, but the actual price should be configured separately.

---

# 42. `features`

Now we define capabilities independently of plans.

```php id="a4f7zm"
Schema::create('features', function (Blueprint $table) {
    $table->uuid('id')->primary();

    $table->string('code', 100)->unique();

    $table->string('name', 150);

    $table->text('description')->nullable();

    $table->string('type', 30)
        ->default('boolean');

    $table->timestampsTz();
});
```

Examples derived from the product requirements include:

```text id="p8nq3r"
time_tracking
screenshots
productivity_ratings
web_app_usage
app_usage
attendance
payroll
custom_reports
advanced_reports
video_recording
api_access
client_access
sso
automatic_user_provisioning
office_remote_reports
```

The exact feature catalogue should be finalized against the product document before seeding production data. The document explicitly supports features such as screenshots, productivity ratings, payroll, video recording, API access, client login access, SSO, and automatic user provisioning.  

---

# 43. Feature types

We shouldn't assume every entitlement is simply:

```text
true / false
```

There are at least three useful types:

```text id="q0p9mf"
boolean
integer
string
```

For example:

### Boolean

```text id="z0l6ft"
video_recording = true
```

### Numeric

Useful for things like:

```text id="gqz8ai"
retention_months = 24
maximum_users = 50
```

### String/configuration

Potentially:

```text id="k9m4rf"
report_level = advanced
```

So `features.type` allows us to support more sophisticated entitlements later.

---

# 44. `plan_features`

Now we connect plans to features.

```php id="lqk6nv"
Schema::create('plan_features', function (Blueprint $table) {
    $table->foreignUuid('plan_id')
        ->constrained()
        ->cascadeOnDelete();

    $table->foreignUuid('feature_id')
        ->constrained()
        ->cascadeOnDelete();

    $table->boolean('enabled')
        ->default(true);

    $table->string('limit_value', 100)
        ->nullable();

    $table->string('limit_unit', 50)
        ->nullable();

    $table->primary([
        'plan_id',
        'feature_id',
    ]);
});
```

---

# 45. Why `limit_value` is a string

You may wonder why we're not using:

```text id="tq2n5s"
integer
```

The reason is that an entitlement may eventually be:

```text id="y49fki"
10
24
unlimited
advanced
monthly
```

For MVP, this gives us flexibility.

However, I would **not expose this raw database representation to the frontend**.

Laravel should resolve it into a strongly typed entitlement object.

---

# 46. Example plan configuration

Conceptually, our seed data could look like:

```text id="jv8g2m"
BASIC
────────────────────────
time_tracking          ✓
screenshots            ✓
productivity_ratings   ✗
advanced_reports       ✗
payroll                ✗
video_recording        ✗
api_access             ✗
sso                    ✗
```

Standard:

```text id="1g2f7h"
STANDARD
────────────────────────
time_tracking          ✓
screenshots            ✓
productivity_ratings   ✓
advanced_reports       ✓
payroll                ✓
video_recording        ✗
api_access             ✗
sso                    ✗
```

Premium:

```text id="2n7h3x"
PREMIUM
────────────────────────
time_tracking          ✓
screenshots            ✓
productivity_ratings   ✓
advanced_reports       ✓
payroll                ✓
video_recording        ✓
api_access             ✓
sso                    ✓
client_access          ✓
automatic_provisioning ✓
```

Again, the exact matrix should be seeded from the product document rather than inferred where the document is silent.  

---

# 47. `subscriptions`

Now an organization actually subscribes to a plan.

```php id="4p1k6a"
Schema::create('subscriptions', function (Blueprint $table) {
    $table->uuid('id')->primary();

    $table->foreignUuid('organization_id')
        ->constrained()
        ->restrictOnDelete();

    $table->foreignUuid('plan_id')
        ->constrained()
        ->restrictOnDelete();

    $table->string('status', 30)
        ->default('active');

    $table->string('provider', 50)
        ->nullable();

    $table->string('provider_subscription_id', 255)
        ->nullable();

    $table->timestampTz('trial_ends_at')
        ->nullable();

    $table->timestampTz('current_period_start');

    $table->timestampTz('current_period_end');

    $table->timestampTz('canceled_at')
        ->nullable();

    $table->timestampsTz();

    $table->index([
        'organization_id',
        'status',
    ]);

    $table->index([
        'provider',
        'provider_subscription_id',
    ]);
});
```

---

# 48. Why subscription belongs to Organization

This is very important.

The subscription is **not** attached to:

```text id="w9zj2f"
users
```

It is attached to:

```text id="1xqf6g"
organizations
```

because the organization is the customer/tenant.

For example:

```text id="c7x1bm"
Hasan
 │
 ├── Company A
 │      └── Standard
 │
 └── Company B
        └── Premium
```

The same user can therefore participate in organizations with different subscription levels.

---

# 49. Subscription lifecycle

We'll support a state model along these lines:

```text id="d8b7ra"
TRIALING
   │
   ▼
ACTIVE
   │
   ├───────────────┐
   ▼               ▼
PAST_DUE        CANCELLED
   │
   ▼
ACTIVE
```

Potential terminal state:

```text id="q0jv4e"
EXPIRED
```

The exact states will depend on the billing provider we eventually integrate.

---

# 50. One organization vs multiple subscriptions

For the MVP, I recommend:

> **One active subscription per organization.**

That means the database should enforce this at the application level initially.

Conceptually:

```text id="8hgj9n"
Organization
     │
     └── Active Subscription
              │
              └── Plan
```

We can later support:

- scheduled plan changes
- multiple subscriptions
- add-ons
- seat-based pricing
- usage-based billing

without redesigning the entire domain.

---

# 51. Entitlement resolution

This is one of the most important parts of the architecture.

When Laravel receives:

```http id="2clvqd"
POST /api/v1/recordings
```

it should **not** do:

```php id="r8c6h2"
if ($organization->plan === 'premium') {
    ...
}
```

Instead:

```text id="8u4fve"
Organization
     ↓
Subscription
     ↓
Plan
     ↓
Plan Features
     ↓
Feature
     ↓
Entitlement
```

Then:

```php id="lqf1q8"
$organization->entitlements()
    ->allows('video_recording');
```

This keeps the business logic centralized.

---

# 52. Entitlement service

I recommend creating a dedicated domain service:

```text id="7l8j6d"
App\Domain\Billing\Services\EntitlementService
```

Conceptually:

```php id="h3u8lc"
$entitlements->allows(
    $organization,
    'video_recording'
);
```

For numeric features:

```php id="k9z5wl"
$entitlements->limit(
    $organization,
    'retention_months'
);
```

This service becomes the single source of truth.

---

# 53. Why this matters

Without centralized entitlements, we'll eventually have:

```text id="t9q3jx"
Next.js
 ├── plan === premium

Laravel API
 ├── plan === premium

Electron
 ├── plan === premium

Queue
 ├── plan === premium

Reports
 ├── plan === premium
```

That becomes difficult to maintain.

Instead:

```text id="e1n6fj"
                  Entitlement Service
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
     Laravel          Electron         Next.js
```

The API remains authoritative.

---

# 54. Frontend must never be authoritative

Next.js can hide UI:

```text id="t8z1vy"
[Start Recording]
```

when the feature isn't available.

But that is only UX.

The API must still enforce:

```text id="d0x7qv"
POST /recordings
        ↓
Entitlement check
        ↓
Allowed?
```

Otherwise someone could simply call the API manually.

---

# 55. Feature gates

We'll eventually use Laravel middleware/policies such as:

```text id="2c4p7n"
EnsureFeatureEnabled
```

Conceptually:

```php id="4p5wqd"
Route::post('/recordings', ...)
    ->middleware('feature:video_recording');
```

For a Premium-only feature:

```text id="9h7w7x"
Request
   ↓
Authentication
   ↓
Organization context
   ↓
Permission check
   ↓
Feature entitlement
   ↓
Controller
```

Notice that **permission and entitlement are different things**.

---

# 56. Permission vs Entitlement

This distinction is fundamental.

### Permission

Answers:

> **Is this user allowed to perform this action?**

Example:

```text id="5z8o9s"
screenshots.view
```

### Entitlement

Answers:

> **Has this organization purchased this capability?**

Example:

```text id="y9v7d4"
video_recording
```

Therefore:

```text id="x2b8q5"
User permission
        +
Organization entitlement
        ↓
Action allowed
```

For example:

```text id="p8d5w2"
Employee has:
screenshots.view

Organization has:
screenshots entitlement

→ Can view screenshots
```

But:

```text id="b2x6fz"
Employee has:
recordings.view

Organization:
Basic

→ Cannot view recordings
```

---

# 57. Retention as an entitlement

The product requirements specify historical-data retention of:

- Basic — 3 months
- Standard — 6 months
- Premium — 2 years. 

Rather than hard-coding:

```php
if ($plan === 'premium') {
    $months = 24;
}
```

we can represent:

```text id="p9g8ns"
retention_months
```

as a plan feature.

Example:

```text id="s7g2qm"
Basic      → 3
Standard   → 6
Premium    → 24
```

Then our retention service asks:

```text id="4x6vpg"
What is this organization's retention entitlement?
```

---

# 58. Subscription and retention

This produces:

```text id="p7lqv8"
Organization
     │
     ▼
Subscription
     │
     ▼
Premium
     │
     ▼
retention_months = 24
     │
     ▼
Retention Service
     │
     ▼
Delete expired data
```

This is much more maintainable.

---

# 59. Billing provider abstraction

We should not couple our database directly to one payment provider.

Notice we have:

```text id="f6d1e3"
provider
provider_subscription_id
```

This allows:

```text id="h9k2p4"
Stripe
Paddle
Other provider
```

without changing the core subscription model.

The actual billing integration should live behind something like:

```text id="1qv5xj"
BillingProviderInterface
```

The database doesn't need to know how Stripe/Paddle/etc. works.

---

# 60. SaaS ERD

The resulting relationship is:

```text id="qz9h2x"
                    ORGANIZATIONS
                          │
                          │ 1:N
                          ▼
                    SUBSCRIPTIONS
                          │
                          │ N:1
                          ▼
                         PLANS
                          │
                          │ 1:N
                          ▼
                    PLAN_FEATURES
                          │
                          │ N:1
                          ▼
                       FEATURES
```

With the actual entitlement path:

```text id="s6r8lm"
Organization
     │
     ▼
Subscription
     │
     ▼
Plan
     │
     ▼
Plan Feature
     │
     ▼
Feature
     │
     ▼
Entitlement
```

---

# 61. One refinement: subscription history

There is one thing I recommend adding before we consider billing finished.

Suppose:

```text id="h6f3y2"
August
Standard

September
Premium

October
Standard
```

We need historical subscription information.

Our `subscriptions` table already allows multiple records, so the application can maintain historical subscriptions.

But I'd add:

```text id="x4w7qa"
started_at
ended_at
```

to make lifecycle history explicit.

So I'd modify the migration to:

```php id="5g3k7v"
$table->timestampTz('started_at');

$table->timestampTz('ended_at')
    ->nullable();
```

Then:

```text id="e2f8m9"
Subscription #1
Standard
started_at = Aug 1
ended_at   = Sep 1

Subscription #2
Premium
started_at = Sep 1
ended_at   = Oct 1
```

This is cleaner for historical billing and entitlement calculations.

---

# 62. Current migration status

We have now completed:

```text id="4j5zq7"
01–40   Identity / Work / Tracking / Workforce / Payroll    ✅

41      Plans                                             ✅
42      Features                                          ✅
43      Plan Features                                     ✅
44      Subscriptions                                     ✅
```

Remaining:

```text id="c2d7xm"
45      Office Locations
46      Office Networks
47      Connectivity Events

48      Notifications
49      Notification Preferences
50      Audit Logs
51      Retention Policies
```

---

# 63. Next: Office/Remote + Connectivity

The remaining **Premium-related workplace infrastructure** is:

```text id="7m3q8x"
Office Locations
       │
       ▼
Office Networks
       │
       ▼
Device Connectivity
       │
       ▼
Office vs Remote Classification
       │
       ▼
Reports
```

The product requirements explicitly include **Office vs. Remote Report** and related Premium capabilities. 

After that, we'll finish the database foundation with:

```text id="9v4m2s"
Notifications
Audit Logs
Retention Policies
```

Then the **entire physical database design will be complete**.

The next major step after that should be **Eloquent Models + relationships + model-level casts/enums/scopes**, because we'll finally have the complete PostgreSQL schema to map into Laravel's domain model.