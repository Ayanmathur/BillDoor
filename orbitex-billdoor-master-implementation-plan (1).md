# Orbitex / BillDoor — Master Implementation Plan for Antigravity

**One document. Feed this whole file to Antigravity as project context before Phase 0 starts.** Everything below — stack, data model, security, UI/UX, modules, barcode system, build order, and ready-to-paste prompts — is one continuous spec so nothing gets built out of sequence or re-explained mid-project.

Three names, kept straight everywhere in this doc: **Orbitex** = the company. **BillDoor** = the product/website. **Billit** = the billing module inside BillDoor's client panel.

```
Super Admin (you)
   └── issues License Keys, manages Clients
Client (business owner) — logs in with username/password
   └── sees only: Dashboard + [Billit] + [Appointer] + [Review Flow] + [WhatsApp Auto] + Orbitex Services + Settings
        (bracketed modules only if enabled for that client; notification bell in top nav on every screen)
Customer (public, no login)
   └── scans QR → Review Flow
   └── receives WhatsApp bill/reminder
   └── (if client has barcode-enabled products) never interacts with barcodes directly — that's a staff-side scanning tool
```

---

## 0. How to feed this to Antigravity

Antigravity works best with a persistent rules file it re-reads every session, plus this plan as living context. Set the repo up like this **before Phase 0**:

```
/repo-root
  /AGENTS.md                 ← engineering standards + "never do X" rules (§10), Antigravity reads this every session
  /docs/master-plan.md       ← this entire file, committed to the repo, not just pasted into chat
  /apps
    /client-public           ← Next.js app: Client Portal + Public Portal (Review Flow, Digital Bill page)
    /admin                   ← Next.js app: Admin Portal, separate deployment
    /mobile                  ← Expo (React Native) app, built in Phase 9+ reusing the same API + design tokens
  /packages
    /shared-types             ← TypeScript types generated from the Supabase schema, imported by all three apps
    /ui-tokens                ← shared design tokens (colors, spacing, type scale) so web + native never drift (§7)
  /supabase
    /migrations                ← every schema change as a numbered SQL migration, RLS policies live here too
    /functions                 ← Edge Functions (WhatsApp send, Gemini review generation, barcode lookup, reminders)
```

**Antigravity session discipline (applies to every phase below):**
1. Antigravity reads `AGENTS.md` and the relevant section of `docs/master-plan.md` before writing any code.
2. Antigravity produces a plan artifact for the phase and stops for your approval before executing.
3. Antigravity executes only the approved phase — no scope creep into later phases, no inventing fields not in §3.
4. Antigravity browser-verifies the built screens against the spec before marking a phase done.
5. Explicit **STOP points** (flagged 🛑 throughout this doc) require your manual review before Antigravity continues — these are the spots most likely to hide a security or data-integrity bug.

---

## 1. Tech stack & platform decisions

| Layer | Choice | Why |
|---|---|---|
| **Language** | TypeScript everywhere (frontend, backend, Edge Functions) | One language across the whole stack — Antigravity and any future dev never context-switches between Python/Node/etc.; also gives end-to-end type safety from DB → API → UI via generated types. |
| **Web frontend** | Next.js (App Router) + Tailwind CSS | Server-rendered, SEO-capable for the Public Portal (Digital Bill pages, Review Flow), fast, deploys natively on Vercel. |
| **Mobile-friendly phase** | Same Next.js app, fully responsive (this *is* the "mobile-friendly" phase — not a separate build, see §8) | Ships a mobile-web experience immediately without waiting on app-store review cycles. |
| **Native app phase (later)** | Expo (React Native) + NativeWind, same design tokens as web (§7, §8) | Reuses business logic and API layer; NativeWind means the same Tailwind-style classes port almost directly from the web app. |
| **Backend / DB** | Supabase (managed Postgres + Auth + Storage + Edge Functions + Realtime) | Postgres gives real relational integrity for a multi-tenant billing/appointment system; **Row Level Security (RLS) is the core of the security model** (§4); Edge Functions (Deno/TS) handle WhatsApp sends, Gemini calls, reminders, barcode lookups without a separate backend service to deploy. |
| **Auth** | Supabase Auth (email/password + custom license-key flow layered on top) for clients; separate hashed-credential auth for the Admin app (§2) | Supabase Auth issues JWTs that RLS policies read directly (`auth.uid()`), which is what makes tenant isolation enforceable at the database layer, not just the app layer. |
| **AI (review generation)** | Google Gemini API | Already the mandated AI layer for Review Flow's 4–5★ draft generation (§6.3). |
| **Messaging** | Meta WhatsApp Business Cloud API (official) for automated sends; `wa.me` click-to-chat as the manual fallback | Only the official API is safe for bulk/broadcast (§6.6) — personal-number bulk sending is a ban risk. |
| **Payments** | Razorpay (India-only scope, no Stripe — see §11) | Payment links for subscription renewal, webhook-driven `valid_till` extension. |
| **Booking (Orbitex Services)** | Embedded Calendly/Cal.com link | Don't build a scheduling engine for internal agency bookings — solved problem, not core product. |
| **QR generation** | `qrcode` + a logo-overlay library (e.g. `qr-code-styling`) | Reed-Solomon error correction at high level tolerates a center logo — confirmed feasible (§6.3). |
| **Barcode generation (product clients only)** | `JsBarcode` (Code128 symbology) on web; `expo-camera` / `react-native-vision-camera` + ML Kit barcode module on native | Code128 is chosen deliberately — see §5 for why over UPC/EAN. |
| **Hosting / Deployment** | Vercel (two separate Projects: `client-public`, `admin`) + Supabase (single shared project/database) | "Separate deployment" means separate JS bundles (admin code never ships to client browsers), not separate data — both point at the same Supabase project. |
| **File/image storage** | Supabase Storage | Logos, QR assets, generated bill images, barcode label PNGs. |
| **Background jobs** | Supabase Edge Functions on `pg_cron` schedule | Payment reminders, appointment reminder ladder, subscription due-soon checks. |

**Why Supabase specifically, given the security ask:** RLS policies are written once in SQL and enforced by Postgres itself — even if an API route has a bug, the database still refuses to return another tenant's row. This is the single biggest lever against the "hacking/breach" concern in the brief, and it's why the entire data model below is designed around `client_id`-scoped RLS rather than app-layer tenant checks alone.

---

## 2. Data model (core tables)

Carried forward from the base spec, with barcode fields added (§5) and RLS ownership noted per table.

- **platform_settings** — singleton row: `admin_whatsapp_number`. RLS: admin-only read/write.
- **admin_users** — `username`, `password_hash`, `created_at`. Lives in a schema the client apps' Supabase key can never query (see §4.2).
- **customers** — `id`, `client_id`, `name`, `phone` (deduped per client), `email`, `opted_in`, `total_visits`, `total_spent`, `last_visit_at`, `created_at`. RLS: `client_id = auth-linked client`.
- **license_keys** — `key_hash`, `mobile_number`, `status`, `client_id` (nullable until activated), `created_at`. Never stored plaintext.
- **clients** — `id`, `business_name`, `slug`, `business_type`, `google_place_id`, `about`, `license_key_id`, `username`, `password_hash`, `email`, `email_verified`, `phone`, `registered_at`, `valid_till`, `status`, `modules_enabled` (jsonb), `has_gst`, `gst_number`, `instagram_url`, `facebook_url`, `website_url`, `show_barcode_on_bill`, **`barcode_enabled`** (new — see §5), **`barcode_settings`** (new, jsonb — see §5).
- **catalog_items** — `client_id`, `name`, `type` (product/service), `price`, `unit`, `default_gst_percent`, `default_resource_id`, `default_duration_min`, `buffer_after_min` (**new**, default 0 — cleanup/prep time after this service, services only), `barcode_value`, `barcode_format`, `barcode_auto_generated`.
- **review_sessions** — `client_id`, `bill_id`, `source`, `stars`, `reward_issued`, `created_at`.
- **reward_codes** — `client_id`, `customer_id`, `source_type`, `source_id`, `code`, `type`, `value`, `redeemed`, `created_at`.
- **google_review_events** — `review_session_id`, `event`, `created_at`.
- **reviews** — `client_id`, `bill_id`, `customer_id`, `stars`, `feedback_text`, `ai_review_text`, `read`, `archived`, `created_at`.
- **resources** — `client_id`, `name`, `active`, `business_hours` (jsonb, **new** — open/close per day of week, required for the walk-in gap-fill logic in §5.5 to know what counts as a "gap").
- **bills** — `client_id`, `customer_id`, `bill_number`, `bill_slug`, `items` (jsonb — each line now optionally carries `added_via: 'search' | 'barcode'` for analytics, see §5), `subtotal`, `discount`, `gst`, `extra_charges`, `grand_total`, `whatsapp_sent`, `sent_via`, `sent_at`, `status` (draft/issued/voided — **new**, see §5.4a), `void_reason` (nullable, **new**), `created_at`.
- **payments** — `bill_id`, `method`, `amount`, `created_at`.
- **notifications** — `client_id`, `type`, `title`, `message`, `read`, `created_at`.
- **service_requests** — `client_id`, `service_type`, `status`, `description`, `created_at`, `updated_at`.
- **portfolio_items** — `category` (website/seo/ads/branding/social_media), `title`, `description`, `image_url`, `external_link` (nullable — points out to the live site or Instagram/YouTube post for a "reel" sample), `display_order`, `created_at`. **Not client-scoped** — this is Orbitex's own showcase content, admin-managed, read-only to every client (no `client_id`, no per-tenant RLS needed here, just admin-write / authenticated-client-read).
- **appointments** — `client_id`, `resource_id`, `customer_id`, `slot_start`, `slot_end`, `estimated_duration_min`, `status`, `reminder_sent`.
- **whatsapp_templates** — `client_id`, `type`, `content`, `is_active`.
- **whatsapp_config** — `client_id`, encrypted API credentials, `connection_status`, `automation_enabled`.
- **broadcast_campaigns** — `client_id`, `template_id`, `audience_filter`, `sent_at`, `recipient_count`.
- **audit_log** — `actor_type`, `actor_id`, `action`, `target`, `ip_address` (new), `user_agent` (new), `created_at`. IP/UA added specifically to support breach forensics (§4.5).

**Rule for every tenant-scoped table:** if it has a `client_id` column, it has an RLS policy before it has a UI screen. No table ships without RLS enabled — this is a hard gate in §10.

---

## 3. Security architecture (RLS, breach resistance, attack surface)

This section is non-negotiable scope — build it alongside each phase, not as a bolt-on at the end (§14 still has a dedicated hardening phase for the things that can only be tested once everything exists, like load and penetration testing).

### 3.1 Tenant isolation (the core defense)
- **RLS enabled on every table with a `client_id` column, no exceptions.** Default-deny: a table with RLS on and no matching policy returns zero rows, never an error that leaks existence.
- Policy pattern for client-facing tables:
  ```sql
  create policy "client_isolation" on bills
    for all
    using (client_id = (select client_id from clients where auth_user_id = auth.uid()))
    with check (client_id = (select client_id from clients where auth_user_id = auth.uid()));
  ```
- Public tables (Digital Bill page, Review Flow QR landing) are read via a **separate, narrowly-scoped RLS policy** that exposes only the exact columns a public visitor needs (e.g. `bills` public policy exposes bill line items and business identity, never `customer_phone` in full, never other customers' data) — never by disabling RLS for convenience.
- The Admin app uses a **separate Supabase service role / schema boundary**, never the same anon key as the client app, so a leaked client-side key can never reach admin tables.

### 3.2 Auth hardening
- Passwords hashed with bcrypt or argon2 (already specified in §2 of the base spec) — same standard for admin and client accounts, no "it's just me" exception for the admin account.
- License keys: cryptographically random (`crypto.randomBytes`, never `Math.random()`), stored hashed, rate-limited on the redemption endpoint. 🛑 **STOP point** — confirm this with a code review before it ships, this is explicitly called out because a guessable/brute-forceable key is a full account-takeover vector.
- Password reset via license key: never a single-factor reset. Email-on-file → magic link. No email → admin-assisted confirmation via the WhatsApp number on record. Every attempt logged in `audit_log` with IP + user agent, rate-limited (e.g. 5 attempts / hour / key).
- JWT/session expiry set explicitly (don't rely on framework defaults); refresh tokens rotated on use.

### 3.3 Input & injection defense
- All forms validated server-side, identically to client-side validation — client-side is UX only, never trusted.
- Every DB write goes through parameterized queries / Supabase's query builder — no raw string-concatenated SQL anywhere, including in Edge Functions.
- File uploads (logos, QR assets) restricted by MIME type and size at both the client and the Storage bucket policy level; re-encoded server-side before serving, never served as user-uploaded raw bytes to strip embedded scripts/metadata.
- Barcode scan input (§5.4) is treated as untrusted user input even though it "looks like" a scanner — sanitized and length-capped before any DB lookup, since a barcode field is still a text input an attacker could paste into.

### 3.4 Transport & secrets
- All traffic HTTPS-only (Vercel default, enforced via HSTS header).
- WhatsApp API credentials and Razorpay keys stored encrypted at rest (`whatsapp_config` table), never returned to any client-side bundle in plaintext, referenced only from Edge Functions running server-side.
- `.env` secrets never committed; Antigravity is explicitly instructed (in `AGENTS.md`) never to hardcode a key it generates during a session — flag it as a required secret instead.

### 3.5 Attack-surface specific defenses
| Threat | Defense |
|---|---|
| Cross-tenant data leak | RLS (§3.1) — the primary defense, tested per-table in Phase 7 (§14). |
| Brute-force login / license key | Rate limiting + exponential backoff on auth endpoints, logged in `audit_log`. |
| Public endpoint abuse (Review Flow, Digital Bill page) | Rate limit per-IP and per-`bill_slug`/`client_slug`; CAPTCHA-style friction only if abuse is actually observed (don't add friction to a real customer flow speculatively). |
| Reward code / discount abuse | Codes are single-use (`redeemed` flag, checked and flipped in the same transaction as bill creation — no race window), human-readable but not sequentially guessable. |
| WhatsApp bulk-send account ban | Official API only for broadcast, opt-in enforced at data collection, segmentation nudged in UI (§6.6). |
| Barcode lookup abuse (scanning garbage strings to enumerate a competitor's catalog) | Lookup scoped to the authenticated client's own catalog only via RLS; never a public/unauthenticated barcode-lookup endpoint. |
| XSS via user-entered business "about" text (feeds into Gemini prompt and public pages) | Escape/sanitize on render everywhere it's echoed to a public page; treat AI-generated review text as displayable-only, never executable. |
| Session hijacking | HttpOnly, Secure cookies for session tokens; no tokens in localStorage where avoidable. |
| Admin panel discovery | Separate subdomain + separate bundle (§4 of base spec) — no admin code ships in the client bundle at all. |

### 3.6 Audit & breach response readiness
- `audit_log` captures actor, action, target, IP, user agent, timestamp for every auth event, every admin action, every module toggle, every password reset attempt.
- Supabase's point-in-time recovery enabled from day one (not added "later") — a breach or bad migration should be recoverable to a specific timestamp.
- A documented (even if brief) incident-response note in `AGENTS.md`: what gets rotated first (Supabase service key, WhatsApp API token, Razorpay keys) if a breach is suspected, and that `audit_log` is the first place to check.

---

## 4. Barcode system (optional, per-client toggle)

**Who this is for:** product-selling clients (bakeries, retail, cafés with packaged goods) where staff want to scan an item instead of typing it into search. **Who this is not for:** pure service clients (clinics, salons, consultants) — they never see this UI at all unless they turn it on.

### 4.1 The toggle
- New field: `clients.barcode_enabled` (boolean, default `false`).
- Lives **inside Billit's own settings screen**, not General Settings — this is deliberately scoped as a Billit-specific feature, consistent with the existing "each module owns its own settings" rule (§10 of base spec), and keeps a pure service client from ever seeing barcode UI even in Settings.
- Toggling it **on** reveals: barcode field on each `catalog_items` entry, the scan input on Bill creation, and a "Print barcode labels" action. Toggling it **off** hides all three immediately — no data is deleted, so a client can turn it back on later without re-generating anything.

### 4.2 Barcode symbology decision
Use **Code128**, not UPC-A/EAN-13. Reasoning to lock in before Antigravity builds this:
- UPC/EAN are numeric-only and require registering a manufacturer prefix (GS1) to be "real" retail barcodes — irrelevant and unnecessary friction for an internal, single-store scanning tool.
- Code128 encodes the full ASCII alphanumeric range directly, which is exactly the "letters and numbers get scanned and typed" behavior described in the brief, and it's what every standard USB/Bluetooth barcode scanner reads out of the box with zero configuration — genuinely universal, no proprietary format.

### 4.3 Barcode value generation
- On `catalog_items` creation, if `client.barcode_enabled = true`, auto-generate a `barcode_value`:
  - Derive a prefix from the item name (e.g. "Blueberry Cake" → `BLUB-CAKE`), strip special characters, uppercase, cap length.
  - Append a zero-padded per-client sequence number to guarantee uniqueness (e.g. `BLUB-CAKE-0045`).
  - Enforce a DB unique constraint on `(client_id, barcode_value)` — collisions fail loudly at insert time, never silently overwrite.
- Client can **override** the auto-generated value with their own existing barcode string if they already have printed packaging (`barcode_auto_generated` flips to `false` when manually edited) — this matters for clients who already have SKUs from a supplier and don't want to reprint anything.
- "Print barcode label" renders the value as a Code128 SVG via `JsBarcode`, sized for common label printer stock (start with a generic 40mm×30mm template, same "don't over-build the print subsystem" philosophy as the existing 55mm bill template).

### 4.4 Scanning in Billit (Bill creation)
- When `barcode_enabled = true`, the Create Bill screen gets a **scan input** alongside the existing typeahead product search — not a replacement, both coexist.
- Detection logic (works with any standard HID-mode USB/Bluetooth scanner, since these devices just "type" fast and send Enter): listen for a burst of keystrokes with inter-character delay under a threshold (e.g. 30–50ms) terminated by Enter/Tab. This distinguishes a scanner burst from a human typing, so the field doesn't need a dedicated "scan mode" toggle — it just works when a scanner is plugged in and is otherwise a normal text field a staff member could type into and press Enter on manually as a fallback.
- On a completed scan string: look up `catalog_items` by `(client_id, barcode_value)` — **RLS-scoped, never a public endpoint** (§3.5) — and if found, add it to the bill's line items with `added_via: 'barcode'`; if not found, show a clear "no product matches this barcode" message rather than failing silently, since a genuine typo or an unregistered product barcode should be visibly recoverable, not swallowed.
- This entire block of UI is conditionally rendered — if `barcode_enabled = false`, none of this code path, DOM, or listener exists on the page at all, so it adds zero overhead or clutter for service clients.

### 4.5 Native app (later phase, §8)
- Same optional toggle carries over to the Expo app. Instead of (or in addition to) a physical scanner, the native app can use the phone's camera via `expo-camera`'s barcode-scanning mode (or `react-native-vision-camera` + an ML Kit barcode frame processor) to scan Code128 labels directly — genuinely useful for a client who wants to bill from a phone without buying a dedicated USB scanner.
- Same lookup logic, same RLS scoping, same `added_via: 'barcode'` tagging — no divergent logic between web and native, just a different input source feeding the same lookup function.

### 4.6 What this deliberately does not do
No inventory/stock-count tracking is implied by adding barcodes (that's a different, much bigger feature — pure identification-and-lookup only, matching the "operations platform, not a full retail/inventory system" philosophy already locked in for the rest of the product). If a client later asks for stock counts, that's a new spec, not an extension bolted onto this one.

---

## 5. Module specs (condensed reference — full detail already locked from the base spec, listed here so Antigravity has one document to read)

### 5.1 Onboarding & auth
License key generation (admin-issued, hashed, WhatsApp handoff) → client redemption → username/password creation → optional-but-strongly-prompted email → default WhatsApp templates seeded automatically. Two-path password reset (§3.2). Full detail: base spec §2.

### 5.2 Admin panel
Separate subdomain/deployment (§1). Client table with license key (masked), business name, status, module toggles, valid-till extension, revoke/reactivate, "message client" (raw WhatsApp, no template). Auto payment reminder via `valid_till` scheduled check + Razorpay payment link with webhook-driven auto-extension. Full detail: base spec §3.

### 5.3 Review Flow
Public QR/link → star rating → 1–3★ private feedback (never redirected to Google) / 4–5★ Gemini-generated review draft with regenerate + 3s auto-redirect countdown (cancels/pauses correctly on regenerate, capped 3–5 regenerations/session). Branded QR with center logo (§1, Reed-Solomon tolerant). Optional reward-on-feedback, defaulting to the safer "reward all feedback" mode with a visible policy-risk note if a client chooses "positive only." Full detail: base spec §4.

**5.3a — Consciously deferred, not a gap:** in-app reply-to-Google-review (Podium/Birdeye-style) requires Google Business Profile OAuth and real integration complexity — worth naming explicitly as a deliberate v2 decision rather than leaving it silently absent.

### 5.4 Billit
Customers screen (shared list, also doubles as the WhatsApp broadcast audience picker). Bill creation: phone-first customer lookup → optional reward code → typeahead search **and/or barcode scan if enabled (§4)** → auto-calc → per-client-per-day sequenced bill number → WhatsApp send (auto/manual) → save/print. Digital Bill public page doing three jobs at once (bill display + inline review + sole WhatsApp payload). Full detail: base spec §5, barcode addendum §4 above.

**5.4a — Void workflow and GST numbering (co-founder audit addition):** bills are never hard-deleted after issue — a "Void" action requires a reason, flips `status` to `voided`, and the bill stays visible (marked) in the sequence rather than disappearing, since a GST-registered client can't have gaps in their invoice numbering without an audit problem. Relatedly: `BILL-YYYYMMDD-###` (date-reset) is fine for non-GST clients, but GST-registered clients need a **continuous financial-year sequence** instead — `has_gst = true` on a client should switch the numbering scheme, not just show/hide the GSTIN field. **Draft/hold bill**: a bill can be saved with `status = draft` mid-entry (customer steps away, staff gets interrupted) and resumed later — standard POS pattern, cheap to support given `status` already exists on the table now.

### 5.5 Appointer
Resource-based (not slot-based), booked reservations are protected absolute time and are never touched by walk-in logic, walk-ins fill gaps or join a live queue with an estimated wait, merged "Today" timeline view, no-show auto-flagging, WhatsApp + in-app notification reminder ladder (T-30/T-5/T-0) with manual "Send Update" fallback when automation is off. Full detail: base spec §6.

**5.5a — Public self-booking (co-founder audit addition, treated as core not optional):** every competitor in this category (Calendly, Fresha, Acuity, Setmore) exists specifically so the *customer* books themselves via a public link — as originally specced, Appointer required staff to enter every booking, which adds labor rather than removing it, contradicting the platform's own founding principle. Fix: a public `/book/{client_slug}` page — customer picks a resource/service, sees real availability computed from `resources.business_hours` minus existing reservations minus `buffer_after_min`, books directly, resolves into `customers` by phone exactly like a bill does. **Business hours** (`resources.business_hours`, now in the data model) are what the walk-in gap-fill logic needs to know what counts as a "gap" versus "closed" — this was a hole in the original logic, not a new feature. **Buffer time** (`catalog_items.buffer_after_min`) adds realistic cleanup/prep gaps between bookings. **Recurring appointments are explicitly deferred** — real feature, genuinely v2, not core to a pilot.

### 5.6 WhatsApp Auto + Settings
Broadcast restricted to the official API (never personal-number bulk sends — ban-risk asymmetry is real, §3.5), opt-in enforced at collection, segmentation nudged over "send to all." Central settings: encrypted credentials, connection status, quality rating, automation on/off, monthly message count. Full detail: base spec §7–§8.

### 5.7 Orbitex Services (agency request tracker)
One tab, five service types, status badges, WhatsApp "Request" button, embedded Calendly/Cal.com for meetings — deliberately not a metrics dashboard. Full detail: base spec §9a.

**Portfolio / showcase (new addition)** — a small gallery of sample work per service type (sample website screenshots, sample Instagram reels, sample branding/design pieces), shown inline above the Request button for that category, so a client sees "here's what a website request could look like" before they click. Kept deliberately light: one `portfolio_items` table (`category`, `title`, `description`, `external_link`, `display_order`), admin-managed via a simple add/edit/delete screen. **Reels render via Instagram's official public embed widget** (the `blockquote` + `embed.js` snippet from a post's own "Embed" menu), not a hosted thumbnail — the DB only ever stores the permalink, Instagram's script does the actual rendering client-side at page load, so there's zero image storage or bandwidth cost on our side. Web-only mechanism (no script-tag embeds inside React Native) — the native app falls back to a plain link-out card for the same data, once the native phase starts. Same data also works as content for a standalone Orbitex marketing site later (a separate, much smaller project outside this app's build phases) — worth noting so it isn't rebuilt twice, but that site itself isn't part of this plan.

### 5.8 Notification Center
Global bell, every module writes to one `notifications` table, one inbox. Full detail: base spec §9b.

### 5.9 General Settings
Business identity, GST, socials, account management, rewards panel (spans Billit/Appointer/Review Flow triggers from one screen), danger zone. Full detail: base spec §9.

---

## 6. UI/UX standards & design system

- **Non-generic, deliberately designed** — one intentional accent color, a real type scale (not untouched Tailwind defaults), restrained shadows. Actively avoid the violet-to-blue-gradient + heavy-rounded-card + stock-illustration look that reads as AI-template-generated.
- **One icon family, never mixed** — Lucide, consistently across web and native (NativeWind carries the same set forward, so this holds through the mobile phase too).
- **Reference real shipped software** (Mobbin — production screens from Linear, Notion, Stripe, etc.) over concept art.
- **Max 3 clicks to any primary action from Dashboard** — create bill, book appointment, view a review, request an Orbitex service, (and now) scan a barcode into a bill. Hard constraint, checked against every future feature.
- **Theme tokens shared identically** between Client Portal, Admin, and (later) the native app, stored once in `/packages/ui-tokens` and imported everywhere — this is what actually prevents visual drift across three deployments instead of three teams eyeballing "close enough."
- **Left-nav renders dynamically** from `client.modules_enabled`, fixed display order regardless of which are enabled: Dashboard → Billit → Appointer → Review Flow → WhatsApp Auto → Orbitex Services → Settings. Each module owns its own settings screen; General Settings is the one account-wide screen; notification bell lives in top nav independent of the sidebar.
- **App shell** (built once, not per-module): theme toggle, collapsible icons-only nav, logout, notification bell, keyboard shortcuts on Billit (Alt+C/Alt+W/Alt+P) with visible hints, cross-browser tested for OS mnemonic collisions.

---

## 7. Mobile-friendly → native app roadmap

This is intentionally a two-phase path, not a simultaneous build — the brief asks for "mobile friendly and then mobile app," which maps directly onto how this repo is structured (§0).

**Phase A — Mobile-friendly web (ships with every phase in §14, not deferred):**
- The Next.js app (`/apps/client-public`) is fully responsive from the first screen built, not retrofitted later.
- `100dvh` not `100vh` (iOS Safari toolbar behavior), form inputs `font-size: 16px` minimum (prevents iOS auto-zoom on focus), `env(safe-area-inset-*)` respected for notch/home-indicator clearance.
- Installable as a PWA (manifest + service worker) so a client or customer can "Add to Home Screen" well before a native app exists — this alone covers most of the "mobile app" feel for launch.
- **Native-ready spacing discipline enforced now, paid off later**: a strict 4px/8px spacing scale, and avoidance of web-only effects with no React Native equivalent (complex CSS grid, `backdrop-filter`) — this is the single decision that makes Phase B fast instead of a rewrite.

**Phase B — Native app (Expo/React Native + NativeWind), built after the web product is proven with a real pilot client (§14, after Phase 8):**
- Reuses `/packages/shared-types` and the same Supabase client/API layer — no parallel backend.
- Reuses `/packages/ui-tokens` — same colors, spacing, type scale as web, so the native app doesn't look like a different product.
- Adds native-only capability where it genuinely earns its place: camera-based barcode scanning (§4.5), push notifications (currently deferred per §11, revisit once native ships since push is a natural native-first feature), and offline-tolerant bill drafting for spotty connectivity environments (stretch goal, not MVP).
- Ships to both app stores as one Expo build target for iOS + Android, not two separate native codebases.

---

## 8. Feature ownership matrix

| Feature | Module |
|---|---|
| Bill, invoice, catalog items | Billit |
| Digital Bill page | Billit |
| Barcode generation, scanning, product lookup | Billit (toggle-gated, §4) |
| Appointment, resource, walk-in queue | Appointer |
| QR, private feedback, review stats | Review Flow |
| WhatsApp templates, broadcast | WhatsApp Auto |
| License, client status, revoke/reactivate | Admin |
| Business identity, GST, socials | Settings |
| Website/SEO/ads/branding requests | Orbitex Services |
| Sample work / portfolio showcase | Orbitex Services (admin-managed) |
| Cross-module alerts | Notification Center |
| RLS policies, audit log, rate limiting | Platform (cross-cutting, §3) |

---

## 9. Engineering standards (`AGENTS.md` content — condensed)

- **API style**: feature endpoints over generic REST — `/dashboard/summary` returns exactly what that screen needs.
- **Naming**: snake_case in DB, camelCase in code, plural table names, UUID primary keys, soft delete only (never hard-delete a client's data).
- **Forms**: validated identically client- and server-side.
- **Security-first defaults**: RLS on by default for every new table (§3.1) — a table shipped without RLS is a bug, not a "we'll add it later." Every new endpoint that touches user input gets a rate-limit consideration before it's marked done.
- **AI agent rules for Antigravity**: read `docs/master-plan.md` before coding, never invent a feature not listed in this document, never silently rename a field, stop at every 🛑 flagged point in §3 and §14 and wait for human review, never hardcode a secret — flag it as a required `.env` variable instead.
- **These are deliberately short.** A five-page doc a solo founder actually rereads beats a fifty-page one that gets skimmed once.

---

## 10. MVP now vs. explicitly deferred

**Building now (Phases 0–8, §14):** license onboarding, Dashboard, Billit + Digital Bill page (+ optional barcode system, §4), Review Flow, Appointer, WhatsApp Auto/Settings, General Settings, full RLS/security baseline (§3), mobile-friendly responsive web (§7 Phase A).

**Deferred until a real client asks for it:** staff roles/permissions beyond single-owner login, 2FA, session/device management, SMS as a channel, multi-language/timezone/currency, customer tags, split payments beyond a status flag, appointment audit-log history, documents repository, holiday calendars, push notifications (revisit at native launch, §7), barcode-based **inventory** counting (barcode *identification* is in scope now, stock tracking is not — §4.6), full subscription auto-billing beyond payment links, Stripe (India-only for now), Orbitex-side admin tooling beyond the minimal tracker, and the native app itself (§7 Phase B, sequenced after a proven pilot).

None of the deferred items are wrong ideas — they're wrong *right now*, before the first paying pilot proves the core loop.

---

## 11. Phased build order — priority-tagged, ready for Antigravity

**P0 = blocks everything downstream. P1 = core sellable product. P2 = polish/scale. P3 = post-pilot only.**

| Phase | Priority | Build | Why this order |
|---|---|---|---|
| 0 | P0 | Data model + RLS policies for every table + license/auth flow + admin shell | Nothing else can be built safely without tenant isolation existing first. |
| 1 | P0 | General Settings + Dashboard shell + dynamic left-nav + mobile-responsive app shell | Modules need somewhere to render into; mobile-friendly baseline established here, not bolted on later. |
| 2 | P1 | Review Flow | Simplest module, fastest path to a sellable pilot. |
| 3 | P1 | Billit (core billing, no barcode yet — includes void/draft workflow, GST-vs-non-GST numbering, §5.4a) | Second most requested vertical need; void/numbering built in from the start, not retrofitted after real invoices exist. |
| 4 | P1 | Billit barcode system (§4) — **only if a pilot client needs it** | Optional add-on to Billit, sequenced right after core billing works, gated behind real demand. |
| 5 | P1 | Appointer, **including public self-booking page (§5.5a)** | Needed for clinic/salon vertical — public booking is core to the module's value, not a later add-on. |
| 6 | P1 | WhatsApp Auto + WhatsApp Settings | Depends on real customer data existing from Phases 3–5. |
| 6b | P2 | Orbitex Services (request tracker + portfolio showcase, §5.7) | Agency-facing, not on the core billing path — sequenced after the operational modules are proven. |
| 7 | P2 | Admin refinements (payment reminders, revoke/reactivate, audit log surfacing) | Polish once core flows are proven. |
| 8 | P0 (gate before launch) | **Security pass**: RLS test per table, rate-limit test on every public endpoint, load test, penetration-style manual attack pass on auth + barcode lookup + reward-code redemption | Nothing touches a real client's data before this phase is signed off. |
| 9 | P1 | Pilot with real client | Matches go-to-market timing. |
| 10 | P3 | Native app (Expo/React Native), reusing shared types + ui-tokens | Sequenced deliberately after a proven pilot, not before (§7 Phase B). |

**Added 🛑 stop points specific to this build** (in addition to the security-pass gate at Phase 8):
- License key generation logic — confirm real cryptographic randomness before Phase 0 closes.
- Password-reset-via-license-key endpoint — rate limiting and logging confirmed before Phase 0 closes.
- Bill number sequence generation — concurrency-tested before Phase 3 closes.
- Appointment conflict-flagging logic — tested with deliberately overlapping bookings before Phase 5 closes.
- Barcode uniqueness constraint and RLS scoping on the lookup endpoint — confirmed before Phase 4 closes.

---

## 12. Antigravity prompts — one per phase, copy-pasteable

Paste each block into Antigravity **in order**, one phase at a time. Each prompt assumes `AGENTS.md` and `docs/master-plan.md` are already in the repo (§0) and tells Antigravity to read them first.

### Phase 0 — Data model, RLS, auth, admin shell
```
Read /AGENTS.md and /docs/master-plan.md sections 1-3 and 11 (Phase 0 row) before doing anything.

Build Phase 0 only:
1. Create all Supabase migrations for every table in master-plan.md §2. Every table with a client_id
   column must have RLS enabled with a policy in the same migration file that creates it — do not
   create a table and defer its RLS policy to a later migration.
2. Build the license key generation flow (admin-issued) exactly as described in the base spec §2,
   using crypto.randomBytes for key generation, never Math.random(). Store only the hash.
3. Build the client redemption flow: license key -> username/password creation (bcrypt/argon2) ->
   optional email prompt -> default WhatsApp templates seeded on account creation.
4. Build the two-path password reset flow (email magic link / admin-assisted for no-email clients),
   rate-limited and logged to audit_log with IP and user agent.
5. Build the Admin app as a SEPARATE Next.js app under /apps/admin, its own Vercel-target folder,
   its own login screen with the same password hashing standard as client auth. Do not let any
   admin-only code exist inside /apps/client-public.
6. Produce a plan artifact listing every file you intend to create/modify before writing code, and
   stop for my review before executing.

Do not build any UI beyond the admin shell and auth screens in this phase. Do not touch Billit,
Appointer, Review Flow, or WhatsApp modules yet.

STOP after this phase and wait for my review, specifically on: (a) license key randomness source,
(b) the password reset endpoint's rate limiting, (c) a manual RLS check where you attempt to query
another client's row using client A's session token and confirm it returns zero rows.
```

### Phase 1 — Settings, dashboard shell, dynamic nav, mobile-responsive shell
```
Read /docs/master-plan.md sections 6, 7, and 11 (Phase 1 row) before starting.

Build Phase 1 only:
1. Build General Settings screen per master-plan.md §5.9 / base spec §9.
2. Build the Dashboard shell (empty state is fine, modules render into it in later phases).
3. Build the dynamic left-nav driven by clients.modules_enabled, fixed display order per §6,
   with the divider before Orbitex Services and the notification bell in top nav.
4. Build the app shell: theme toggle, collapsible icons-only nav mode, logout, notification bell
   UI (no notifications exist yet, just the shell).
5. Apply the mobile-responsive baseline from §7 Phase A: 100dvh not 100vh, 16px minimum font-size
   on all form inputs, env(safe-area-inset-*) padding, and the 4px/8px spacing scale from §6 across
   every component built in this phase and all future phases.
6. Set up /packages/ui-tokens now and import from it in every component, do not hardcode colors or
   spacing inline anywhere in this phase.

Plan artifact first, stop for my review before executing. Browser-verify on a real mobile viewport
width (not just resizing desktop chrome) before marking this phase done.
```

### Phase 2 — Review Flow
```
Read /docs/master-plan.md section 5.2 and base spec §4 in full before starting.

Build Phase 2 only, exactly per that spec: public QR/link landing, star rating, 1-3 star private
feedback path, 4-5 star Gemini-generated review draft with copy/regenerate (capped 3-5 regenerations,
countdown pauses correctly while a generation is in flight, never races it), branded QR with center
logo, client dashboard with ratings table + XLSX export + read/archive states, optional reward-on-
feedback defaulting to "reward all feedback" mode with the policy-risk note shown before "positive
only" can be enabled.

Confirm the Gemini API key is referenced only from a server-side Edge Function, never exposed to the
client bundle.

Plan artifact first, stop for my review before executing.
```

### Phase 3 — Billit (core, no barcode)
```
Read /docs/master-plan.md section 5.4 and base spec §5 in full before starting.

Build Phase 3 only: Customers screen, Bill creation (phone-first lookup, reward code field, typeahead
product search, auto-calc, per-client-per-day sequenced bill number), WhatsApp send (auto/manual with
sent_via tracking), Digital Bill public page doing bill display + inline review + WhatsApp payload in
one link. Do NOT build any barcode UI in this phase - barcode_enabled does not exist on the clients
table yet, that's Phase 4.

STOP specifically on the bill number sequence: write a concurrency test that fires multiple simultaneous
bill creations for the same client on the same day and confirms no duplicate bill_number is produced,
before marking this phase done.

Plan artifact first, stop for my review before executing.
```

### Phase 4 — Barcode system (optional, gated)
```
Read /docs/master-plan.md section 4 in full before starting. This phase is ONLY built if a real
pilot client has confirmed they need it - confirm with me before starting this phase even if it's
next in the build order.

Build Phase 4 only:
1. Add barcode_enabled (boolean, default false) and barcode_settings (jsonb) to clients, and
   barcode_value / barcode_format / barcode_auto_generated to catalog_items, with a unique
   constraint on (client_id, barcode_value). Write the RLS policy for the barcode lookup query
   in the same migration.
2. Add the toggle inside Billit's own settings screen only - not General Settings.
3. Auto-generate barcode_value on catalog_items creation using the prefix + sequence logic in
   master-plan.md §4.3, using Code128 as the symbology (JsBarcode on web). Allow manual override.
4. Add "Print barcode label" rendering a Code128 SVG sized for a 40mm x 30mm label template.
5. Add the scan input to Bill creation, conditionally rendered only when barcode_enabled is true,
   using the keystroke-burst-plus-Enter detection logic in §4.4 to distinguish a scanner from manual
   typing, doing an RLS-scoped lookup against catalog_items by (client_id, barcode_value), tagging
   the resulting line item added_via: 'barcode'.
6. Confirm this lookup is never exposed as a public/unauthenticated endpoint - it must go through
   the same authenticated, RLS-scoped path as every other Billit query.

STOP before marking this phase done: manually attempt a barcode lookup using client A's session
against client B's barcode_value and confirm it returns no match.

Plan artifact first, stop for my review before executing.
```

### Phase 5 — Appointer
```
Read /docs/master-plan.md section 5.5 and base spec §6 in full before starting.

Build Phase 5 only: resource setup, the "booked slots are never touched" hard rule, walk-ins filling
gaps or joining a live queue with estimated wait, merged Today timeline view per resource, no-show
auto-flagging with grace window, WhatsApp + in-app reminder ladder (T-30/T-5/T-0) with manual
"Send Update" fallback when automation is off.

STOP before marking this phase done: write a test that deliberately creates overlapping bookings
on the same resource and confirms the system flags the conflict rather than silently double-booking
or auto-rescheduling either one.

Plan artifact first, stop for my review before executing.
```

### Phase 6 — WhatsApp Auto + Settings
```
Read /docs/master-plan.md section 5.6 and base spec §7-8 in full before starting.

Build Phase 6 only: central WhatsApp Settings (encrypted credential storage, connection status,
quality rating, automation on/off, monthly message count), broadcast module pulling audience from
the shared Customers list (opted_in = true only, deduped by phone), template editor separate from
Billit's and Appointer's. Confirm broadcast sending only ever goes through the official WhatsApp
Business Cloud API, never a personal-number bulk-send path, and confirm credentials are only ever
read server-side from an Edge Function.

Plan artifact first, stop for my review before executing.
```

### Phase 7 — Admin refinements
```
Read /docs/master-plan.md section 5.2 and base spec §3 in full before starting.

Build Phase 7 only: payment reminder scheduled job against valid_till, Razorpay payment link
generation, webhook-driven valid_till auto-extension, revoke/reactivate polish, audit_log surfaced
as a readable admin screen (filterable by actor/action/date).

Plan artifact first, stop for my review before executing.
```

### Phase 8 — Security pass (mandatory gate before any real client data)
```
Read /docs/master-plan.md section 3 in full before starting. This phase does not add features -
it is a hardening and verification pass on everything built in Phases 0-7.

For every table with a client_id column, write and run a test that authenticates as client A and
attempts to read/write client B's rows via every exposed query path, confirming RLS blocks all of
them.

For every public/unauthenticated endpoint (Review Flow landing, Digital Bill page, license key
redemption), add or confirm rate limiting and test it under a scripted burst of requests.

Confirm reward code redemption cannot be double-applied under concurrent requests (same race-
condition class as the bill number sequence test in Phase 3).

Confirm no API key, WhatsApp credential, or Razorpay key appears in any client-side bundle - grep
the built output, not just the source.

Confirm audit_log is capturing IP and user agent on every auth event.

Produce a written summary of every check performed and its result. Do not mark this phase done
until every check in this list has a passing result documented.
```

### Phase 9 — Pilot
```
Read /docs/master-plan.md section 11 (Phase 9 row) before starting. No new features in this phase -
this is deployment, monitoring setup, and support readiness for the first real client's data to
touch the system. Confirm Supabase point-in-time recovery is enabled. Confirm the admin app and
client app are deployed as separate Vercel projects pointing at the same Supabase project, per
section 1.
```

### Phase 10 — Native app (post-pilot only)
```
Read /docs/master-plan.md sections 7 and 4.5 in full before starting. Do not start this phase until
I confirm the pilot in Phase 9 is stable.

Scaffold /apps/mobile as an Expo (React Native) + NativeWind app. Import /packages/shared-types and
/packages/ui-tokens - do not redefine types or design tokens locally in the mobile app. Rebuild the
core Billit and Appointer flows reusing the same Supabase client and RLS-scoped queries already
proven on web. Add camera-based Code128 barcode scanning via expo-camera (or react-native-vision-
camera + ML Kit) as an additional input source feeding the same barcode lookup function built in
Phase 4 - do not write a separate lookup path for native.

Plan artifact first, stop for my review before executing.
```

---

## 13. What changed vs. the base spec (for anyone comparing documents)

- Barcode system added as a fully optional, Billit-scoped, toggle-gated feature (§4) — zero footprint for service-only clients.
- A dedicated security architecture section (§3) consolidating RLS, auth hardening, injection defense, and a threat table that was previously implicit across several sections.
- Tech stack, language, and deployment decisions made explicit in one place (§1) rather than inferred from scattered mentions.
- Mobile-friendly-then-native path formalized into two named phases (§7) with a concrete repo structure (§0) supporting the transition.
- Every build phase now carries an explicit priority tag and, where relevant, a copy-pasteable Antigravity prompt with its own stop points (§12) — this is the part meant to be pasted directly into tool sessions rather than re-typed from prose each time.
