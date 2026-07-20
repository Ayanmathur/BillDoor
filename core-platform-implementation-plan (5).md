# Core Platform — Full Implementation Plan (built from scratch)

One multi-tenant app. Left nav renders only the modules a client is licensed for — this is what keeps a cake shop's dashboard from looking like a clinic's.

```
Super Admin (you)
   └── issues License Keys, manages Clients
Client (business owner) — logs in with username/password
   └── sees only: Dashboard + [Billit] + [Appointer] + [Review Flow] + [WhatsApp Auto] + Orbitex Services + Settings
        (bracketed modules only if enabled for that client; notification bell in top nav on every screen)
Customer (public, no login)
   └── scans QR → Review Flow
   └── receives WhatsApp bill/reminder
```

---

## 0. Brand assets required before Phase 0 starts

These block real UI work if missing, so gather them before Antigravity starts building screens, not mid-build:

- **Favicon** — square, works at 16×16 and 32×32 (a detailed logo turns to mud that small; often a simplified mark, not the full logo).
- **App logo** — for the app header/nav, needs a version that reads clearly on both light and dark theme (given theme toggling is in scope), plus a square "icon-only" variant for the collapsed icons-only nav state.
- **Client-facing branded QR logo asset** — the mark that gets embedded in the center of each client's Review Flow QR is *Orbitex's* branding on the QR frame (not the client's own logo — that's a separate per-client asset collected at onboarding), so this needs to exist before Review Flow (Phase 2) ships.
- **Two names to keep straight going forward**: **Orbitex** is the company; **BillDoor** is the product/website name; **Billit** is the billing module inside BillDoor's client panel (renamed from "BillDoor" to avoid the module and the platform sharing a name). Worth a one-line style note in the engineering standards (§12) so nobody building a screen mixes these up.

---

## 1. Data model (core tables)

- **platform_settings** — singleton row: `admin_whatsapp_number`, edited from Admin Settings, referenced by both the license-onboarding flow (§2) and every Orbitex Services request button (§9a) — one field, one source of truth.
- **admin_users** — `username`, `password_hash`, `created_at`. Same hashing standard as client auth, changeable from Admin Settings (§3).
- **customers** — `id`, `client_id`, `name`, `phone` (deduped per client — one row per phone number, shared across Billit, Appointer, and Review Flow, not three separate lists), `email` (optional), `opted_in`, `total_visits`, `total_spent`, `last_visit_at`, `created_at`. Created automatically the first time a phone number appears on a bill or appointment — never a manual "add customer" step.
- **license_keys** — `key_hash`, `mobile_number`, `status` (unused/activated), `client_id` (nullable until activated), `created_at`. Key is permanent once activated (also used for password reset).
- **clients** — `id`, `business_name`, `slug`, `business_type`, `google_place_id`, `about`, `license_key_id`, `username`, `password_hash`, `email` (optional, strongly prompted at signup), `email_verified`, `phone`, `registered_at`, `valid_till`, `status` (active/revoked), `modules_enabled` (jsonb: `{review_flow, billit, appointer, whatsapp_auto}`), `has_gst`, `gst_number`, `instagram_url`, `facebook_url`, `website_url`, `show_barcode_on_bill`
- **resources** — `client_id`, `name` (e.g. "Dr. Sharma", "Chair 2"), `active`. One row per client if solo, multiple if the client has staff/chairs — Appointer supports both from day one, driven entirely by how many rows exist for that client.
- **review_sessions** — `client_id`, `bill_id` (nullable), `source` (qr/bill_page), `stars`, `reward_issued` (bool), `created_at`. Logs every QR scan or emoji-row open, even if the customer never submits a rating — cheap to add now, useful funnel data later (scans vs. completed reviews).
- **reward_codes** — `client_id`, `customer_id`, `source_type` (feedback/bill_created/appointment_completed), `source_id`, `code`, `type` (percent_discount/flat_discount/free_item), `value` (client-configured), `redeemed`, `created_at`. One row per issued reward. `client.reward_settings` (jsonb: `{triggers: {feedback, bill_created, appointment_completed}, reward_type, reward_value, review_reward_mode: all_feedback/positive_only, max_per_customer_per_day: 1}`) controls all of it from one place — a client with Billit + Appointer both enabled can reward every bill *and* every completed appointment, with the daily cap preventing one real visit (appointment → bill) from firing two rewards.
- **google_review_events** — `review_session_id`, `event` (redirected/copied/skipped), `created_at`. No review text stored — just tracks whether the redirect happened, for funnel analytics.
- **reviews** — `client_id`, `bill_id` (nullable — set when the review came from a Digital Bill page rather than the standalone QR, so you know which transaction drove which review), `customer_id` (nullable — populated whenever the bill/QR context makes the customer known), `stars`, `feedback_text` (1-3★, private), `ai_review_text` (4-5★, what was generated/copied), `read`, `archived`, `created_at`
- **catalog_items** — `client_id`, `name`, `type` (product/service — unified, one table not two), `price`, `unit`, `default_gst_percent`, `default_resource_id` (nullable, services only), `default_duration_min` (nullable, services only), searchable
- **bills** — `client_id`, `customer_id` (resolved/created by phone lookup at bill creation — `customer_name`/`customer_phone` are entered on the form but resolve into this FK, never stored as separate loose fields), `bill_number`, `bill_slug` (short random public identifier — the actual public URL, distinct from the sequential internal `bill_number`), `items` (jsonb — each line: `catalog_item_id`, `qty`, `unit_price`, `item_discount` [optional, default 0], `gst_percent`, `line_total`), `subtotal`, `discount` (bill-level, separate from per-item discount), `gst`, `extra_charges`, `grand_total`, `whatsapp_sent`, `sent_via` (auto/manual/none), `sent_at`, `created_at`
- **payments** *(v1, minimal)* — `bill_id`, `method` (cash/upi/card), `amount`, `created_at`. Just enough to record how a bill was settled — no split-payment or refund logic until a real client asks for it.
- **notifications** — `client_id`, `type` (bill_sent/bill_failed/appointment_booked/feedback_received/orbittex_update/subscription_due/whatsapp_disconnected), `title`, `message`, `read`, `created_at`. Every module writes here — one global bell icon, one inbox, instead of scattered per-module alerts.
- **service_requests** *(minimal Orbitex Services tracker, not a full department system)* — `client_id`, `service_type` (website/seo/ads/branding/support), `status` (requested/in_progress/done), `description`, `created_at`, `updated_at`. Client sees status + a simple message thread. No campaign metrics, no keyword tracking, no ad-platform dashboards inside the app — you already have those tools on the ad/SEO platforms themselves; build a bespoke admin console for this only once request volume makes a spreadsheet genuinely too slow.
- **appointments** — `client_id`, `resource_id`, `customer_id` (same phone-lookup resolution as bills — this is what lets one customer's booking and billing history show up in the same place), `slot_start`, `slot_end`, `estimated_duration_min`, `status` (booked/walkin/completed/no_show/cancelled), `reminder_sent`
- **whatsapp_templates** — `client_id`, `type` (billit/appointer_reminder/broadcast), `content`, `is_active`
- **whatsapp_config** — `client_id`, encrypted API credentials, `connection_status`, `automation_enabled`
- **broadcast_campaigns** — `client_id`, `template_id`, `audience_filter`, `sent_at`, `recipient_count`
- **audit_log** — `actor_type`, `actor_id`, `action`, `target`, `created_at`

**General Settings fields (business_name, GST number, logo, address) live once on `clients` and are referenced by Billit's print template and Review Flow's AI prompt — never duplicated per module.**

---

## 2. Onboarding & auth flow

**License key generation (admin):**
- Admin enters client mobile number (required). Optionally pre-fills business_name / slug / google_place_id / about as a **paid setup service** — this is your upsell lever, make it visually distinct in the admin UI ("Setup by us — billable").
- Key is cryptographically random (not sequential/guessable), stored **hashed**, status starts "Not Activated."
- Admin gets a "Copy Key" button and a WhatsApp redirect to hand it over manually — pulled from the same `admin_whatsapp_number` setting used by "Get license key" on the client login screen and by every "Request" button in Orbitex Services (§9a). One number, stored once, editable in Admin Settings — never hardcoded in more than one place, so changing your number later is a single edit, not a find-and-replace across the codebase.

**Client activation:**
- **Login screen layout**: one screen, login form front and center (username + password) as the default/primary view, since that's the common case for a returning client. Two secondary text links below it — "Have a license key? Create your account" and "Need a license key? Get one" — rather than three equally-weighted options competing for attention; the onboarding paths shouldn't visually compete with ordinary login.
- "Have license key" → client enters key → creates username + password (hashed, bcrypt/argon2). Email is **optional but strongly prompted** at this step ("add an email so you can reset your password even faster").
- **On account creation, seed default WhatsApp templates** (one per type — Billit thank-you, Appointer reminder, a starter broadcast/offer template) so the client never opens a blank template editor. They can edit these or add their own for manual, auto, or broadcast use — templates are per-client from that point on, the defaults are just a starting point.
- **Password reset (two paths):**
  1. **Email on file** — client enters license key + clicks a magic link sent to their registered email. Two factors, low friction.
  2. **No email on file** — client enters license key alone, but the reset is routed through a short admin-assisted check (admin gets a flag in their dashboard, confirms via the same WhatsApp number on record before the reset completes). Never silently allow a reset on license key alone with zero secondary check, even for email-less clients.
  - Rate-limit both paths and log every attempt in `audit_log` — this endpoint is effectively a recovery-code flow and deserves the same care as any password reset link.

---

## 3. Admin panel

**Access model — real protection, not a hidden shortcut:** the admin panel is a **separate application on its own subdomain** (e.g. `admin.yourapp.com`), not a hidden route inside the client-facing app. This means admin code never ships in a client's browser bundle at all — nothing to discover via dev tools or the network tab, which a hidden keyboard-shortcut approach inside the shared app can't achieve (that code would still be sitting in the JS bundle every client downloads, just gated by a `keydown` listener someone could find in minutes). A keyboard shortcut is still fine to add — as a personal quick-access convenience once you're already on the admin app's own login screen, not as the thing hiding admin access from clients. The actual protection is the hashed password check on that login screen, same as any other auth (§2).

**Deployment note:** Public Portal doesn't need this same isolation — it has no privileged code, so it folds into the Client Portal deployment. Only two deployments needed: Client+Public (`app.yourbrand.com`) and Admin (`admin.yourbrand.com`), same GitHub repo with two folders, two Vercel Projects each pointing at a different Root Directory, both talking to the same Supabase project. "Separate deployment" means separate bundles, not separate data — the shared database is what actually connects them.

**Client table columns:** License Key (masked, copy icon) · Business Name · Username · Phone · Registered At · Valid Till (extend +1/+N months, one click) · Status badge (active/revoked/expiring soon) · Actions.

**Actions:** edit username · **reset password** (not view password — see correction above) · delete (soft delete + confirm) · revoke/reactivate · **toggle modules** (checkboxes for Billit / Appointer / Review Flow / WhatsApp Auto / Orbitex Services — this is how a budget-limited client ends up seeing only Review Flow, writes straight to `client.modules_enabled`) · "Message client" (opens WhatsApp to their number, no template — human-written reminder, exactly as you specified).

**Auto payment reminder:** scheduled job checks `valid_till`; N days before expiry, badge the client row and surface it in an admin "Due Soon" widget on the dashboard. This notifies *you*, not the client automatically — matches your "no template, human message" requirement. When you do message the client, generate a **Razorpay payment link** alongside it rather than asking for a manual UPI transfer + screenshot — a webhook on payment confirmation can auto-extend `valid_till`, removing the manual reconciliation step while keeping the reminder itself human. Full subscription auto-billing (recurring charges, dunning, invoicing) is deferred — see §13.

**Admin's own account:** the admin panel has its own login (username + password, hashed to the same standard as client auth — no special-casing "it's just me" into weaker security), plus a small Admin Settings screen: change username, change password, and edit `admin_whatsapp_number` — the one field that feeds both the license-onboarding WhatsApp redirect and every Orbitex Services request button.

---

## 4. Review Flow

**Customer-facing (no login), from the QR/permanent link:**
1. Star rating (1–5, smiley UI)
2. **1–3★** → feedback form → saved privately, visible only to the client, never redirected to Google
3. **4–5★** → Gemini generates a review draft from `business_name + business_type + about`. Copy button + Regenerate button. Every prior draft in the session (not just the last one) is passed back into the prompt as "don't repeat any of these," so regenerations stay distinct across the whole session, not just from the immediately previous one. **Regenerate cancels/pauses the countdown** rather than racing it — API latency isn't reliably under 3 seconds every time, so the timer only starts fresh once the new draft actually renders, never while a generation is in flight. Capped at 3-5 regenerations per session to bound API cost against spam-clicking. 3-second countdown auto-redirect to the Google review URL (built from `google_place_id`); instant redirect if Copy is clicked first.
4. If `client.status = revoked`, show a neutral "temporarily unavailable" page instead of continuing to collect reviews.

**Client dashboard:** QR (download button), shortened review link (copy), ratings table (date, stars, feedback) filterable by date range, **XLSX export**, and a simple 4-5★ vs 1-3★ split so they see the funnel at a glance. Feedback rows have a separate **Archive** action distinct from "read" — read just clears the unread dot, archive moves it out of the active list into a date-filterable archive view, so a client can acknowledge feedback without it cluttering their working list.

**Logo-in-QR — confirmed feasible, not a gimmick.** QR codes use Reed-Solomon error correction; at the highest correction level (~30% of the code recoverable), a business logo can sit in the center and the code still scans reliably. Standard capability in any decent QR-generation library — build the branded QR (logo + brand color) once at onboarding alongside the permanent link.

**Optional reward on feedback submission (admin/client toggle, off by default):** a "click copy to get a discount on your next visit" CTA, discount value configurable per client. Two modes, both available, **defaulting to the safer one**:
- **"Reward all feedback"** (default) — triggers on any rating, 1 through 5: a 1-3★ customer sees it right after submitting private feedback, a 4-5★ customer sees it right after their AI review is generated. Same mechanic and copy either way — this is the one to actually ship.
- **"Reward positive reviews only"** — triggers only inside the 4-5★ branch, shown alongside the review-copy step. Available if a client explicitly wants it, but the settings UI must show a one-line risk note directly on this option before it can be enabled: conditioning a reward on a positive rating is what Google's incentivized/gated-review enforcement targets (review removal, up to full Business Profile suspension) — the client is choosing this knowingly, not discovering it after the fact.

**Reward card, shown regardless of rating (1-5):** discount text ("10% OFF your next visit"), a short human-readable code beneath it (e.g. `SAVE10-X4F9`, not a raw UUID), and "Screenshot this to redeem next time." No login or WhatsApp round-trip needed to claim it — the screenshot itself is the redemption artifact. The code exists specifically so this isn't a pure honor system: without it, one screenshot could be reused indefinitely or shared with someone who never visited. Redemption happens back in Billit — a small "Apply reward code" field on Create Bill looks up the code, checks it isn't already `redeemed`, applies the discount to the new bill, and flips `redeemed = true` so it can't be reused. This is also the deliberate policy-safety point from before: tying the reward specifically to a 4-5★ result (or to confirmed Google submission, which can't be reliably verified anyway — Google gives no completion callback after the redirect) crosses from "loyalty reward for engaging" into "incentivized/gated reviews." Rewarding every rating equally keeps the default mode defensible while still driving more people into the funnel — most 4-5★ raters will still continue to Google on their own, since the redirect happens regardless of the reward.

---

## 5. Billit

**Customers screen** — the actual answer to "who visited, whose bill was created": one searchable list (by name or phone), filterable by date range via a calendar icon (Today / This Week / This Month / Custom Range presets, filtering Last Visit or Registered date), pulling from the shared `customers` table, each row showing Name, Phone, Total Visits, Total Spent, Last Visit. Click through to a single customer to see their full history in one place — every bill, every appointment (if Appointer's enabled), every review they've left. Deliberately lightweight, not a CRM — no tags, no notes, no pipeline stages, matching the "operations platform, not CRM" principle already locked in.

**This same searchable, date-filtered list is the WhatsApp Auto broadcast audience picker** — not a separate system. Filtering Customers by "last visit 30+ days ago" and hitting "Broadcast to these" is literally the come-back-offer segmentation WhatsApp Auto §7 already calls for; building one filterable list that both screens read from avoids maintaining two customer-selection UIs that could drift out of sync.

**Module-specific settings (isolated from other modules):** products/services list with typeahead search, default GST %, default discount, extra-charge button (ad hoc per bill, e.g. delivery), WhatsApp message template (`{customer_name}`, `{shop_name}` placeholders, save multiple named templates e.g. "Diwali offer" and pick the active one), print template (generic 55mm to start).

**Bill creation:** customer phone first — the system looks it up against `customers` for this client as soon as it's entered; if found, name auto-fills (editable, in case of a correction) and their visit history is one click away; if not found, the name field opens for a new entry and a `customers` row is created silently. Phone-first because the lookup drives everything downstream — asking name first would mean typing in a name for someone the system might already know. → **optional reward code field** (looks up `reward_codes`, applies the discount if valid and unredeemed, marks `redeemed = true`) → typeahead product search → auto-calc (qty × price → GST → discount → extra charges → grand total) → Bill number `BILL-YYYYMMDD-###` using a **per-client, per-day DB sequence** (not raw timestamp, to guarantee uniqueness under concurrent bills) → Send WhatsApp (auto if API connected, else manual: generate bill image, open WhatsApp with prefilled text, client attaches image) → Save & Print / Save Only / Clear.

**Manual send tracking:** even when the client sends manually via the `wa.me` link (no delivery confirmation possible outside the API), the app logs the send event the instant the button is clicked — `bill.sent_via = 'manual'`, exact `customer_phone`, `sent_at` timestamp, which template was used. The link itself is built as `wa.me/{customer_phone}?text={message}`, with `{customer_name}` and other placeholders substituted into the message text before the link is generated. This keeps reporting complete for clients not yet on the paid WhatsApp API tier: you always know which bill was intended for which customer, even without a delivery receipt.

### Digital Bill page (public, `/bill/{bill_slug}`)

One link does three jobs: shows the bill, collects the review, is the only thing sent on WhatsApp. Referenced from Zudio's digital bill pattern, adapted for unified product/service billing.

Top to bottom: logo + business name/address header → **5-emoji rating row, submitted inline** (this *is* the Review Flow, embedded — immediate, casual framing right after they land on the page — 1-3★ opens inline private feedback tied to this exact `bill_id`; 4-5★ triggers the same AI-generated review + copy + 3s redirect as the standalone flow) → invoice block (name, contact, address, GSTIN only if `has_gst`) → invoice meta (bill number, date/time, customer name, customer number) → unified line items table (Description / Qty·Unit / Price / Discount / Tax / Total — per-item discount is optional, defaults to zero, computed before GST) → summary (Subtotal → Discount, rendered only if >0 → GST breakdown → Extra Charges, rendered only if present → Grand Total) → barcode (off by default, opt-in toggle per client — no scanner infrastructure in these verticals, unlike retail) → social + review footer (Instagram/Facebook/Website icons, each conditional on that field being set; a **second, differently-framed** rating prompt — "Enjoyed our service? Leave a Google Review ★★★★★," deliberate ask after they've seen the full invoice, distinct copy and visual from the top emoji row but identical underlying mechanism and the same already-rated guard, so nobody double-submits) → Print/Download button using browser print, no separate thermal-template subsystem needed for MVP.

WhatsApp template: `"Dear {customer_name}, thanks for shopping at {shop_name}! Your digital bill: {bill_link}"` — replaces sending a bill image plus a separate review QR link with one link that does both.

---

## 6. Appointer — resource-based scheduling

Clients vary from solo practitioner to multi-chair salon, so Appointer is built around **resources**, not just time slots, from day one.

**Setup:** client defines one or more `resources` in Appointer settings (e.g. a solo dentist = 1 resource; a 3-chair salon = 3). Each service can have a default `estimated_duration_min`, overridable per booking.

**The one hard rule: booked slots are never touched.** A resource's confirmed reservation is protected absolute time — the system will never place a walk-in on top of it, and it never "auto-reschedules" a booking to accommodate walk-ins. This single rule is what prevents the exact conflict scenario you described (a walk-in colliding with a real booking) from ever happening by design.

**Walk-ins fill gaps, not slots.** When staff adds a walk-in, the system scans each resource's timeline for the current day and finds the next gap large enough for the estimated service duration, before the next reservation on that resource. If a gap exists, the walk-in is placed there. If no gap is big enough before the next booking, the walk-in goes into a **live queue** with an estimated wait time (e.g. "next available ~2:15 PM on Chair 2") — a suggestion for staff to confirm or override, not an automatic decision.

**One merged "Today" view**, not two disconnected lists: booked appointments and the walk-in queue rendered on a single timeline per resource, so staff sees the real picture — who's booked, who's waiting, and where any tight gaps are — at a glance. Conflicts show as a **"Running Late"** flag in a warning color, left for a human to resolve, never silently auto-resolved.

**No-show handling:** booked customer absent past a grace window (e.g. 10 min) → auto-flag no-show, free that resource's slot for the queue.

**Reminders (v1, kept simple):** scheduled job fires ~30 min before `slot_start` regardless of walk-in congestion, via WhatsApp (auto/manual toggle, same pattern as Billit). An auto-adjusted "running behind, expect to be seen ~X" reminder is a good v2 feature once you have real usage data to predict delays accurately — for now, staff can manually trigger a "running late" notice to affected upcoming appointments if a resource falls behind.

**Staff-facing reminder ladder (internal, separate from the customer WhatsApp reminder above):** the same scheduled job also fires into the Notification Center at T-30min, T-5min, and T-0 ("Appointment about to start: {customer_name}") — landing in the same bell-icon inbox as every other notification, no new infrastructure needed.

**Manual fallback for clients without WhatsApp API connected:** the T-30min and T-5min entries each get a **"Send Update" button** right on the notification. If automation is on, the reminder already auto-sent and no button is needed. If it's off, clicking Send Update opens the same `wa.me/{customer_phone}?text=...` pattern used everywhere else in the plan, prefilled with "Reminder {customer_name}, your appointment starts in {30/5} minutes" — no new mechanism, just the existing manual-send pattern attached to a notification instead of a dedicated screen.

---

## 7. WhatsApp Auto (broadcast)

Audience pulled from Billit + Appointer customer records (`opted_in = true` only), deduped by phone. Separate template editor from Billit's and Appointer's. **Bulk send requires the official WhatsApp Business API** (WhatsApp Settings below), not personal-number click-to-chat — the two carry fundamentally different risk profiles:

- **Official API + opt-in + approved templates** → ban risk is near zero for compliant use. Quality rating (Green/Yellow/Red) gates how far a client's account can scale, and Meta shows the warning (Yellow) before anything serious happens — it's visible, not a surprise.
- **Unofficial/personal-number bulk sending** → detection is behavioral and the ban typically arrives with no warning.

Design implications for the module:
- **Opt-in is mandatory, enforced at data collection** — the checkbox on Billit/Appointer forms, not assumed from a past transaction.
- **Segment, don't blast** — broadcasting the same template to a client's entire list in one shot is exactly the pattern that drags quality rating down; the UI should nudge segmentation (by date range, by module, by engagement) rather than a single "send to all" button.
- **Any bot/auto-responder built for a client (e.g. a clinic's AI inquiry responder) must stay scoped to that business's own FAQs, bookings, and orders.** Meta prohibits general-purpose AI assistants on WhatsApp Business — an open-ended chatbot is a compliance risk, a business-specific one is fine.

---

## 8. WhatsApp Settings (central)

API credentials (encrypted, never returned client-side in plaintext), connection status, quality rating + current tier if available via the API, global automation on/off (used by Billit + Appointer both), and a running monthly message count per client — useful for watching cost exposure once Meta's Oct 2026 utility/service message pricing kicks in.

---

## 9. General Settings

Business name, owner name, WhatsApp number, GST number, logo, address, account management (username/password change), delete account (type business name or "DELETE" to confirm — keep this exactly as you specified).

**Rewards panel (v1, simple):** lives here rather than inside any one module, since it spans three — checkboxes for which events trigger a reward (Bill Created / Appointment Completed / Feedback Given), one shared reward type/value, the feedback-reward mode toggle from Review Flow §4 (all-feedback vs. positive-only, default all-feedback), and the max-one-per-customer-per-day cap. **Deferred to v2**: milestone/tiered rewards (e.g. "every 5th visit gets a bigger discount"), per-trigger reward values — only worth the added complexity once real client usage shows the simple version isn't enough.

---

## 9a. Orbitex Services (client-facing, minimal v1)

One tab: Website / SEO / Ads / Branding / Support, each with a status badge (Requested / In Progress / Done) and a "Request" or "Message" button. The "Request" button opens `wa.me/{admin_whatsapp_number}?text=I need help with {service_type}...` — same shared setting used in the license onboarding flow (§2), same click-to-chat pattern used everywhere else in the plan. "Book Meeting" opens an embedded Calendly/Cal.com link — **don't build a booking/availability engine from scratch**, that's a solved problem and not worth the build time right now. Client sees status and a simple thread — never hosting details, keyword rankings, ROAS, campaign budgets, or deployment logs. That stays entirely on your side, tracked in `service_requests` and whatever tool you're already using to actually do the SEO/ads work — don't build a metrics dashboard into the app for this until request volume outgrows a spreadsheet. Any request sitting in "Requested" status surfaces as a "Pending Tasks" card on the client's Dashboard, pulled from the same `service_requests` table — no separate tracking needed.

## 9b. Notification Center (global)

Bell icon, top nav, on every authenticated screen. Every module writes an event here — bill sent/failed, appointment booked, private feedback received, subscription due, WhatsApp disconnected, Orbitex request status change. One inbox, no per-module alert systems.

---

## 10. Left-nav / UX rule

Nav renders dynamically from `client.modules_enabled`, in fixed display order **Dashboard → Billit → Appointer → Review Flow → WhatsApp Auto → Orbitex Services → Settings** regardless of which modules are enabled (a client with only Billit and Review Flow still sees them in that relative order, just with Appointer and WhatsApp Auto absent). This display order is independent of build order (§15 builds Review Flow before Billit, since it's the faster path to a pilot) — build sequence optimizes for speed to revenue, display sequence optimizes for how a business owner actually thinks about their day. Each module (Billit, Appointer, Review Flow, WhatsApp Auto) has its **own** settings icon inside that module's screen — scoped only to that module. General Settings is the one account-wide screen, reached separately. Orbitex Services sits as its own nav item, visually separated from the operational modules (a divider above it) since it's a request gateway to you, not a self-serve tool. Notification bell lives in the top nav on every screen, independent of the left sidebar. This is what keeps a review-only client from ever seeing Billit's GST fields.

---

## 10a. App shell (shared across all screens)

Theme toggle (light/dark), collapsible nav (icons-only mode for screen space), a real logout button, and the notification bell — all shell-level, built once, not per-module. **Billit keyboard shortcuts**: Alt+C (clear bill), Alt+W (manual WhatsApp send), Alt+P (print) — show the shortcut hint on the button itself so it's discoverable, and test across browsers since `Alt`-only combos can collide with OS/browser menu mnemonics on Windows.

---

## 10b. UI/UX standards

- **Non-generic, deliberately designed, not default-AI-looking**: one intentional accent color, a type scale that isn't the untouched Tailwind default, restrained shadows — avoid the violet-to-blue gradient + heavy-rounded-cards + stock-illustration combination that reads as template-generated.
- **One icon family, never mixed** — Lucide (already committed to via the Expo/NativeWind stack) across web and native, consistently. Mixing icon sets mid-app is one of the fastest tells of an unpolished build.
- **Reference real shipped software, not concept art** — use Mobbin (production screenshots of apps people actually love — Linear, Notion, Stripe, etc., searchable by screen type) over Dribbble, which shows concepts that often don't survive a real build.
- **Max 3 clicks to any primary action from Dashboard** — create bill, book appointment, view a review, request an Orbitex service. This is a hard constraint checked against every future feature, not a soft goal.
- **Theme tokens shared identically between Client Portal and Admin** (colors, spacing, type scale) even though they're separate deployments (§3), so light/dark stays visually consistent across both rather than drifting apart over time.
- **Mobile web specifics (Safari/Android)**: use `100dvh` not `100vh` (iOS Safari's dynamic toolbar breaks the latter), form inputs need `font-size: 16px` minimum or iOS auto-zooms on focus, respect `env(safe-area-inset-*)` for notch/home-indicator clearance.
- **Native-ready spacing**: stick to a 4px/8px spacing scale and avoid web-only effects with no React Native equivalent (complex CSS grid, `backdrop-filter`), so the visual language ports cleanly when native builds start (per the web-first, native-later decision already made).

---

One line, one module, no ambiguity — every future feature request gets checked against this before it's built anywhere.

## 11. Feature ownership matrix

| Feature | Module |
|---|---|
| Bill, invoice, catalog items | Billit |
| Digital Bill page | Billit |
| Appointment, resource, walk-in queue | Appointer |
| QR, private feedback, review stats | Review Flow |
| WhatsApp templates, broadcast | WhatsApp Auto |
| License, client status, revoke/reactivate | Admin |
| Business identity, GST, socials | Settings |
| Website/SEO/ads/branding requests | Orbitex Services |
| Cross-module alerts | Notification Center |

## 12. Engineering standards (condensed)

- **API style**: feature endpoints over generic REST — `/dashboard/summary` returns exactly what that screen needs, not four separate calls the frontend has to assemble.
- **Naming**: snake_case in the DB, camelCase in code, plural table names, UUID primary keys, soft delete (never hard-delete a client's data).
- **Forms**: validated the same way client and server side — never trust client-side validation alone.
- **AI agent rules** (for Antigravity/Claude Code sessions building this): read this plan before coding, never invent a feature not listed here, never silently rename a field, stop after the assigned phase and wait for review at the STOP points already defined in §... above.

These are deliberately short. A five-page engineering doc a solo founder actually rereads beats a fifty-page one that gets skimmed once.

## 13. MVP now vs. explicitly deferred

Scope discipline, stated plainly so it doesn't creep back in feature by feature:

**Building now:** everything in sections 1–10 above — license onboarding, Dashboard, Billit + Digital Bill page, Review Flow, Appointer, WhatsApp Auto/Settings, General Settings. General Settings v1 scope specifically: Business info (name/logo/GST/address/phone/email), Integration status (Google Place ID connected, WhatsApp connected — read-only status, not a config builder), Billing/subscription (read-only, admin-managed), Security (password change only), simple notification toggle (email/WhatsApp on-off), Danger Zone.

**Deferred until a real client asks for it, not before:** staff roles/permissions beyond the single owner login, 2FA, session/device management, SMS as a notification channel, multi-language/timezone/currency support, customer tags (VIP/Corporate/etc.), split payments (a bill's `payments` row and a simple "mark as refunded" status flag are v1 — actual payment-gateway refund processing is not), appointment audit-log history, a documents/contracts repository, holiday calendars, push notifications as a channel, barcode-based inventory, full subscription auto-billing (recurring charges, dunning, generated invoices — Razorpay payment links + manual reminder are v1, not this), Stripe entirely (no international clients yet, Razorpay covers India-only needs fully), and any Orbitex-agency-side admin tooling beyond the minimal request tracker already specced.

None of the deferred items are wrong ideas. They're wrong *right now*, before the first paying pilot is running. Add them when a client's actual usage tells you to, not because a spec document left room for them.

---

## 14. Customer journey (no new tables — this is what the modules already do together)

`Visit → Bill Generated → WhatsApp Bill → Digital Bill Page → [Review → Google Rating] / [Follow Socials] → repeat visit / campaign response`. This loop is already fully served by existing data: `bills` + `reviews` (with `bill_id` linking a review to the transaction that drove it) + `customers.opted_in` feeding WhatsApp Auto's "30 days, come-back offer" automation. Naming the loop explicitly here so it's clear these modules are one journey, not four disconnected features — worth keeping in mind when building any of them so nothing accidentally breaks the handoff between steps (e.g. a bill without a `bill_slug` breaks the WhatsApp→Digital Bill→Review chain).

---

## 15. Phased build order

| Phase | Build | Why this order |
|---|---|---|
| 0 | Data model + license/auth flow + admin shell | Everything else depends on client identity existing first |
| 1 | General Settings + Dashboard shell + dynamic left-nav | Modules need somewhere to render into |
| 2 | Review Flow | Simplest module, no billing/scheduling complexity, fastest to a sellable pilot |
| 3 | Billit | Second most requested per our earlier plan (cake shop, cafe) |
| 4 | Appointer | Needed for clinic/salon vertical |
| 5 | WhatsApp Auto + WhatsApp Settings | Depends on having real customer data from phases 3-4 |
| 6 | Admin refinements (payment reminders, revoke/reactivate, audit log) | Polish once core flows are proven |
| 7 | Security pass (see the security baseline from the earlier build-plan doc) + load test | Before any real client's data touches it |
| 8 | Pilot with real client | Matches the 90-day go-to-market plan |

Use the same Antigravity workflow from the previous plan (explore → plan artifact → your approval → execute → browser-verify) for each phase, with these **added stop points** specific to this spec:
- License key generation logic (must confirm real cryptographic randomness, not `Math.random()`)
- The password-reset-via-license-key endpoint (rate limiting, logging)
- Bill number sequence generation (concurrency test before trusting it)
- Appointment conflict-flagging logic (test with deliberately overlapping bookings before it touches a real clinic's schedule)
