# BillDoor — Forward Plan (Pilot → v2 → Native App)

**Where we are:** the v1 web app (licensing, Billit, Appointer, Review Flow, WhatsApp Auto, Orbitex Services, Admin) is built and tested. **It has not yet been piloted with a real client.** That's the single most important gap to close before anything else in this document — an untested-with-real-customers build is exactly the situation the "validate before building more" discipline exists for, and it applies here more than anywhere else so far.

**Already shipped, separate from anything below:** the GST/discount quick calculator (Quick Tools) is implemented and live — not part of any pending phase, noted here so plan status stays accurate.

---

## Phase A — Pilot (do this now, before Phase B or C)

This isn't new — it's the original 90-day go-to-market plan from early in this project, now actually actionable since the product exists to run it against.

**Target:** salon/cake shop/cafe in Nagpur — highest product fit (review-sensitive, WhatsApp-heavy, repeat-visit businesses), easiest to reach in person.

**Outreach:** walk-in visits, 5-minute pitch with the live demo on your phone, offer a **free 30-day pilot**. Cap it at 3-5 businesses — bounded effort, real case studies, not an open-ended free tier.

**Operationally, in the actual built system:** issue a license key, set `valid_till` 30 days out, and start `modules_enabled` narrow — Review Flow + Billit only for most pilots, since those are the highest-confidence value and the fastest to show a visible before/after. Don't turn on Appointer or WhatsApp Auto for a pilot unless that specific business's pain point is clearly scheduling or broadcast, not billing/reviews.

**Track, per pilot client:** review count and rating before vs. after, number of bills sent via WhatsApp, qualitative feedback from the owner. This is the actual ammunition for the next 20 businesses you approach.

**Convert to paid when:** a visible review/rating improvement exists, the client is actually using Billit for real transactions (not just trying it once), and the owner says something positive unprompted — not just tolerates it.

**Hard stop before Phase B or C:** don't build or ship any v2 feature into a pilot client's hands until the core v1 loop (Review Flow + Billit) has proven itself with at least one real pilot converting to paid. v2 features are enhancements to a validated product, not prerequisites for finding out if the product works.

---

## Phase B — v2: Financial reporting + internal assistant

Everything below was already scoped in detail; full specs and Antigravity prompts are unchanged from that plan. Summarized here so this document is the single complete reference going forward.

**Sequencing note that matters more than the default order below:** once Phase A pilots are running, prioritize whichever of these a real client actually asks for first — don't build in the default order below just because it's written first. If a pilot cake shop owner asks about tracking expenses before anyone asks about GST reports, build the expense log first.

### B1 — Expense log + revenue periods (P1)
Simple log (amount, category, note, date) in Billit. Revenue period selector (Today/Week/Month/Year/Custom) in Reports, not Dashboard. "Revenue − Expenses" shown as a labeled estimate, never implied to be a P&L. **Also visible in Admin panel**, per-client — useful when you're helping a client with support or troubleshooting and need to see the same numbers they see, without needing their login.

### B2 — Rate-wise GST summary (P1)
`catalog_items.hsn_sac_code` (optional, additive column). Groups bills by GST rate for a filing-aligned period (monthly/QRMP quarterly), exports to XLSX/CSV in the existing Review Flow export format. No GSTN API, no filing integration, ever — produces a summary file only. **Also visible in Admin panel**, per-client, same reasoning as B1 — you can pull a client's GST summary on their behalf if they need help with it.

### B3 — Internal assistant, read-only lookup + how-to (P2)
**A floating chat bubble, but scoped to two screens only — Dashboard and Orbitex Services.** "Floating" describes the UI treatment (a small bubble in the corner that expands into a chat window), not where it's available — it does **not** follow the client onto Billit, Appointer, or Review Flow, which stay work screens uninterrupted by a chat surface, per the placement decision already locked in. Tool-calling over a fixed function set (`get_customer`, `get_bill`, `get_revenue_summary`, `get_expense_summary`, `get_appointment`), every function scoped server-side to the authenticated `client_id`. Read-only — no create/modify/delete via chat in v1. Retrieval over your own help content for "how do I" questions. Every answer links back to the real record.

### B4 — Orbitex upsell layer (P2, only after B3 is proven stable)
`check_upsell_opportunities()` as one more callable function — draws on review trend, GBP completeness, WhatsApp usage, existing service requests. Same "identify gap, route to Orbitex, never self-serve the fix" principle as the static GBP nudge, just conversational. Soft, one-line, capped frequency, never blocking the actual answer.

*(Full data model, Antigravity prompts, and explicit hard boundaries for B1–B4 are as previously specified — data model: `expenses`, `assistant_queries`, `catalog_items.hsn_sac_code`; explicitly excluded: GSTN filing integration, full bookkeeping, OCR, chatbot write-access, general-purpose chatbot behavior, forced upsell prompts.)*

---

## Toggle cascade logic — what actually happens when admin turns a module off

This needs to be explicit since several v2 features (Business Card, QR & Links) depend on knowing the real state of every module, not just Billit's own screen.

- **Billit off** → the client can't use Billit, and every link that depends on it breaks: the Digital Bill page and the Digital Catalog page both go to the same "temporarily unavailable" state already used for a revoked client's Review Flow QR (§ base spec) — reused here, not reinvented.
- **Appointer off** → the public booking link breaks the same way.
- **Review Flow off** → the review link breaks the same way.
- **Digital Catalog** — its own separate admin toggle, **and** a compound dependency on Billit being on (since `catalog_items` live in Billit). Both conditions must be true for the Catalog link to work.
- **WhatsApp Auto off** — this one needs a distinction: WA Auto's toggle governs the *broadcast/campaign* feature specifically. It does **not** gate the manual click-to-chat sending already built directly into Billit (bill delivery) and Appointer (reminders) — those are base capabilities of their own modules, not features of WhatsApp Auto, and keep working regardless of WA Auto's toggle state.

Every broken link shows the same "temporarily unavailable" page rather than a raw 404 — consistent with how a revoked client's QR already behaves.

---

## Phase C — Native app (Android/iOS via Expo) — gated on Phase A, not a default next step

**Explicit gate, not a calendar date:** only start this once Phase A produces a real signal — at minimum, several paying (not just pilot) clients specifically asking for an installable app, or clear evidence the mobile web experience is genuinely insufficient for how they use it day-to-day. Building this speculatively, before that signal exists, repeats the exact mistake this whole project has been careful to avoid elsewhere.

**Stack (already decided earlier in this project):** Expo (managed workflow), Expo Router, NativeWind v4, Lucide-React-Native icons — same icon family and design tokens as the web build, so the visual language ports over instead of requiring a redesign. 4px/8px spacing scale, avoid web-only CSS effects with no RN equivalent — this constraint was already respected in the web build specifically so this phase wouldn't require rework.

**Sequencing within Phase C:** Android first — no App Store review process or $99/yr developer account blocking a first release, faster iteration. iOS follows once the Android build is stable.

**Autonomy model carries over unchanged:** UI/styling/layout work can run autonomously in Antigravity; auth, billing logic, RLS, and anything touching production data still requires the same human-review STOP points already established for the web build. Native doesn't relax that.

**Kickoff prompt, once the gate is actually met:**
```
Context: BillDoor's web app is live with N paying clients (fill in real
number and names of features they specifically requested a native app
for). Reference the existing web build's design tokens, icon set
(Lucide), and spacing scale — this must not become a redesign.

Goal: Set up Expo Router + NativeWind v4 targeting Android first,
porting [specific screens clients asked for — likely Dashboard, Billit
bill creation, and Appointer's Today view, not the full app surface on
day one]. Reuse existing Supabase client logic and RLS policies
unchanged — this is a new frontend on the same backend, not a new
system.

Constraints:
- Do not modify any existing web app code, database schema, or RLS
  policy as part of this phase — native is additive only.
- Match the web app's design tokens exactly — same accent color, same
  type scale, same icon family. If a screen looks meaningfully
  different from its web counterpart, stop and flag it.
- Auth, billing, and any write to production data still require my
  explicit review before merging — same STOP-point discipline as the
  web build, native doesn't relax this.

Output format: Plan first — which screens, in what order, ported from
which existing web components. Wait for approval before writing code.
```

---

## Phase D — Pilot feedback additions (post-Phase A)

### D1 — Table reservations for cafe/restaurant clients (Appointer extension, not a new module)
Reuses the existing resource model almost entirely — confirms the original architecture decision was right. `resources.bookable_online` (new bool) — reservable tables show on the public booking page, walk-in-only tables stay internal, visible to staff on the Today timeline but never offered online. Booking gets an estimated duration used only for availability-checking, never enforced as a hard checkout — the table frees up when staff manually marks it "Vacated." Overruns into another booking's window surface via the **existing** "Running Late" flag (§5.5, base spec) — no new conflict-handling logic needed, this is the same mechanism already built, just applied to a case it was designed for.

### D2 — Menu photo → catalog import (Billit addition)
Client photographs their menu; Gemini (same integration as Review Flow) extracts a structured `{name, price}` list from the image. **Mandatory human review-before-commit** — extracted items land in an editable staging list, client confirms/corrects each line, only then do they commit to `catalog_items`. Never silently auto-imports — a wrong OCR'd price becoming a live billing price is a real business risk, not a cosmetic one. GST rate is asked once as a simple bulk question afterward (menus don't show GST breakdown), not extracted per item.

**XLSX export of the confirmed list** — same export pattern already used for Review Flow and the GST report (§B2), applied here to the post-review, committed catalog. Downloadable by the client (their own reference/backup copy) **and** by admin — the admin download is the more consequential one: it's structured content ready to hand straight to whoever's building a QR menu or website, no re-typing the menu from a photo a second time.

**Deliberate secondary purpose:** once a client's menu is digitized this way, that content is ready-made upsell ammunition for an Orbitex Digital Catalog or Website request — the content barrier that normally blocks that pitch is already cleared. **Concretely, this now feeds two specific Orbitex service offerings directly** — see D2a.

### D2a — QR Menu Design + Business Card Design as explicit Orbitex Services offerings
Two new service types alongside the existing Website/SEO/Ads/Branding/Support categories in Orbitex Services (§5.7, base spec) — `qr_menu_design` and `business_card_design`. Both are natural, tangible next steps once a client's catalog exists via D2: the admin-downloaded XLSX becomes the starting content for a professionally designed QR menu (a real designed version of the barebones Digital Catalog from Quick Tools, §5.0a) or a printed/digital business card design (a designed counterpart to the free auto-generated Digital Business Card). Same pattern as every other Orbitex Services entry: client requests, status badge, WhatsApp-based request routing — no new mechanism, just two more entries in the existing service type list, now with a genuinely obvious reason for a client to request them right after using D2.

### D3 — "Our Clients" directory + "Powered by Orbitex" badges (lightweight, NOT the marketplace)
**Placement, since this needs to be public to have any value:** primary home is Orbitex's own public marketing website (the separate, smaller project outside this app's build phases — same one noted for the portfolio/showcase feature). Not admin-portal-only — an admin-only directory has no marketing value, since the audience is prospective clients and their customers, not you. Admin's role is curation, not hosting: a per-client opt-in flag (`clients.publicly_listed`) controls who appears, since not every paying client necessarily wants to be listed publicly.

A simple directory page linking out to each opted-in client's existing Digital Business Card/Catalog page — near-zero cost since it's just links to pages that already exist. A "Powered by Orbitex" badge, as one shared footer component reused across **every** client-facing public page — Review Flow's QR/rating page, the Digital Bill page, the Appointer public booking page, Digital Business Card, and Digital Catalog — linking back to Orbitex. Free ongoing marketing across all of that traffic, zero marginal engineering cost since it's one component, not five separate ones. Plus: Orbitex's own social links promoted inside the Orbitex Services tab (client-facing) — cheap, low-risk, worth doing regardless of anything else in this section.

### D4 — Digital Business Card, Digital Catalog, and QR & Links management (all independent, none merged)
Both pages were designed earlier but never actually built — adding them for real in v2. Keeping every link fully separate and independent, as originally designed — Review Flow, Appointer Booking, Digital Catalog, and Digital Business Card each stand on their own, none of them routes through another.

**Digital Business Card** — `/card/{slug}` — logo, contact, socials, "Save Contact" `.vcf` download, and a "Rate us on Google" link into Review Flow (same entry-point pattern already used elsewhere, not a merge of the two pages). Its own standalone QR, its own standalone use case.

**Digital Catalog** (`/catalog/{slug}`) stays exactly as previously specced — barebones by design, no photos, no custom branding, ever, per the cannibalization guardrail already locked in.

**Dashboard placement:** Digital Business Card gets a visible quick-access tile on Dashboard, alongside the other v2 additions (revenue snapshot, the internal assistant) — a one-tap way to get to its QR/download without digging through Settings.

**Every one of these — including Digital Business Card — is individually toggleable, on both sides:**
- **Admin toggle** — same `quick_tools_enabled`-style flag already established for the rest of Quick Tools, controlling what the client has *access to* at all. Not every client's plan includes every service.
- **Client toggle** — a second, client-facing on/off inside their own Dashboard settings, controlling what actually *shows* as a tile, independent of what admin's granted. A client with access to Business Card, Catalog, and the assistant might still only want two of those three cluttering their Dashboard — that's their call, not something forced just because admin enabled it.

A tile only appears on Dashboard when **both** flags are on — admin access granted *and* the client hasn't hidden it (`clients.dashboard_tiles_hidden`, jsonb array of tile keys the client's personally turned off — additive to the existing `quick_tools_enabled` admin flag, not a replacement for it). Same two-layer pattern applies to the other new Dashboard tiles from this release (revenue snapshot, the internal assistant), not just Business Card.

**"QR & Links" screen in Settings** — one place listing every permanent link a client has enabled (Review Flow, Appointer Booking, Digital Catalog, Digital Business Card, plus any custom links from the Quick Tools QR generator), each with a thumbnail, Download, Copy Link, and a one-line suggested placement ("Great for: table tents" / "Great for: shop window"). This aggregates them for convenient viewing without merging their function — a client can still see everything in one place, they just aren't forced through one link to reach the others.

### D5 — Customer marketplace (Swiggy/Zomato-style, ALL clients, one customer app) — explicitly NOT part of this plan yet
This is a fundamentally different, much bigger initiative than anything else here — a two-sided marketplace with a real cold-start problem, competing directly against Zomato/Swiggy/Google Maps/JustDial for customer attention with a fraction of their selection. Worthless at small scale (unlike everything else in this plan, which delivers full value to a single client with zero others in the system) and only becomes real once there's genuine client density behind it. **Revisit only once there are 20-30+ paying clients across Nagpur** — at that point "every one of these businesses already trusts this system" is a real pitch. Until then, D3 captures most of the legitimate value (discoverability, cross-promotion, Orbitex visibility) without the marketplace's cold-start risk.

---

| Phase | What | Gate to start |
|---|---|---|
| A | Pilot with 3-5 real Nagpur businesses | Ready now — nothing left to build first |
| B1-B2 | Expense log, revenue periods, GST report | After Phase A's core loop is validated; order driven by real client requests |
| B3-B4 | Internal assistant + upsell layer | After B1-B2 are stable, or in parallel if a pilot client specifically asks for lookup/help features |
| C | Native Android/iOS app | Only once paying clients are specifically asking for it — not a default next step |
| D1-D2 | Table reservations, menu photo import | Direct pilot feedback — build when the relevant pilot client (cafe/restaurant) is active |
| D3 | Client directory + Orbitex badges | Cheap, low-risk, can go in anytime after a few clients are live |
| D4 | Digital Business Card (hub), Digital Catalog, QR & Links screen | Solves QR-management confusion before it becomes a real problem — worth doing alongside D3 |
| D5 | Customer marketplace | **Not yet** — revisit only past 20-30+ paying clients |
