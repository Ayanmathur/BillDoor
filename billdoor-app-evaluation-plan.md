# BillDoor App Plan — Evaluate → Decide → Build → Distribute

**Status:** v1 and v2 (core platform + financial reporting/assistant/pilot features) are built. This plan covers turning the existing web app into installable apps — starting with a self-directed evaluation, not a client-facing rollout of multiple versions.

**Core principle carried through this whole plan:** evaluate cheaply, commit to one approach per platform category, never ship redundant versions of the same app to clients.

---

## Phase 1 — Spike and evaluate (for yourself, not client-facing)

Spike order matters — three of these are cheap wrappers around the already-built web app, one is a real rewrite. Do the cheap ones first.

### 1a. PWA spike (covers both desktop and mobile-web)
Add a web manifest, service worker, and icon set to the existing web app — no separate codebase, this just makes the existing site installable. Cheapest possible spike, can be working in an afternoon.

```
Context: BillDoor's web app is fully built and live. This is an
evaluation spike, not a production feature — the goal is to see how
good a PWA install experience actually feels before committing to
anything further.

Goal: Add a web app manifest, service worker (basic offline shell
caching is enough, not a full offline-first rebuild), and icon set to
the existing web app so it becomes installable via the browser's
"Install" prompt on desktop (Chrome/Edge) and Android, and "Add to
Home Screen" on iOS Safari.

Constraints:
- Do not modify any existing app functionality — this is additive
  manifest/service-worker configuration only.
- Do not attempt full offline support — that's a different, much
  larger scope than this spike needs.

Output format: Plan first, then implementation. Test the actual
install flow on a Windows PC, a Mac, an Android phone, and an iPhone —
report back on how each one feels (icon, launch speed, window
behavior), not just whether it technically works.
```

### 1b. Capacitor spike (mobile — Android + iOS in one pass)
Wraps the existing web app in a native shell for both app stores, no screen rewrites.

```
Context: BillDoor's web app is fully built and live. This is an
evaluation spike — wrap the existing app in Capacitor to see how it
feels as an installed Android/iOS app before committing to it over
Expo.

Goal: Set up Capacitor loading the existing web app, add a native
splash screen and basic native navigation chrome (status bar styling,
back-button handling on Android) so it doesn't feel like a bare
browser tab. Build for Android first.

Constraints:
- Do not modify the existing web app's code or auth flow — Capacitor
  wraps it, does not rebuild it.
- This is a spike — get it running and testable, don't polish every
  edge case yet.

Output format: Plan first, then implementation. Test on a real Android
device. Report back on scroll feel, transition smoothness, and camera
access (needed later for barcode/menu-photo features) compared to the
plain mobile website.
```

### 1c. Tauri spike (desktop — only if PWA feels insufficient)
Only spike this if 1a's PWA install doesn't feel like enough — e.g., a client specifically wants a "real" installer rather than a browser-based install.

```
Context: Only proceed with this spike if the PWA spike (1a) revealed a
genuine gap — e.g., needing a taskbar/system-tray presence, or an
installer file to distribute rather than a browser install prompt.

Goal: Set up a Tauri project loading the existing web app inside a
native window for Windows and Mac, evaluating it purely as an
alternative to the PWA install — not a parallel product.

Constraints: Same as the PWA spike — no modification to the underlying
app, evaluation only.

Output format: Plan first, then implementation. Compare directly
against the PWA experience from 1a — install size, launch speed,
whether it actually solves the gap PWA left.
```

### 1d. Expo prototype (only if Capacitor genuinely falls short)
The expensive one — only spike this if Capacitor's wrapped experience feels meaningfully worse than a true native app for reasons that matter to how BillDoor is actually used (not just abstractly "less native").

```
Context: Only proceed with this if the Capacitor spike (1b) revealed a
real, specific shortfall — e.g., camera-based barcode scanning or menu
photo capture performing noticeably worse in a WebView than true
native camera APIs would.

Goal: Rebuild 2-3 real screens (pick ones most affected by the
Capacitor shortfall — likely Billit bill creation with barcode
scanning) in Expo/React Native, to compare directly against the
Capacitor version of the same screens.

Constraints: This is a genuine prototype, not a shortcut — build real
functioning screens, not static mockups, so the comparison is honest.

Output format: Plan first, then implementation. Side-by-side comparison
against Capacitor on the same real device for the same specific
feature — report back on whether the difference is worth the full
rewrite this approach would require for the rest of the app.
```

---

## Phase 2 — Decide

After Phase 1, pick exactly **one** approach per category:

- **Desktop:** PWA, unless 1c's Tauri spike revealed a genuine gap PWA can't close.
- **Mobile (Android + iOS):** Capacitor, unless 1d's Expo prototype showed a real, feature-specific reason the WebView approach doesn't work well enough — not just a general "feels more native" preference.

Write the decision down with the specific reason, so it doesn't get silently re-litigated later without new information.

---

## Phase 3 — Build for real, whichever approach won

Take the winning spike from Phase 1 and finish it properly — full screen coverage (not just the priority screens used for evaluation), production error handling, real device testing across the range of devices clients actually use, not just one test phone.

If Capacitor won: add the native splash/navigation polish beyond the spike, test barcode scanning and menu-photo capture specifically on real devices per client vertical (cafe/restaurant clients especially, given D1/D2 from the v2 plan depend on camera access working well).

If Expo won: this reintroduces the full screen-porting scope from the earlier draft plan — every screen, not just the ones in the prototype, with the same STOP-point discipline (auth/billing/production-data changes need explicit review) already established for the web build.

---

## Phase 4 — Distribution

**PWA:** no file hosting needed at all — the browser installs directly from the live site. Nothing further to set up.

**Tauri (only if built):** **GitHub Releases**, not Google Drive. Drive throttles downloads on shared files after a handful of requests in a short window (a real risk right after announcing a download to clients), doesn't give a direct download link, and has no built-in versioning. GitHub Releases is free, gives clean direct-download links, and versions every release properly — the standard way small teams distribute installer files.

**Capacitor or Expo mobile:**
- **Android:** Google Play Developer account ($25 one-time), internal testing track with pilot clients before public release, privacy policy URL required for listing (confirm one exists for the web app already).
- **iOS:** Apple Developer Program ($99/year — same account covers Mac notarization if Tauri was built), TestFlight beta before public release, budget real review-cycle time — Apple's review is slower and less predictable than Google Play's.

**Login panel download section:** add "Download for Windows/Mac," "Get it on Google Play," "Download on the App Store" links once each is actually live — not before. Checklist item per platform, not something to build ahead of having anything to link to.

---

## Rollout order, end to end

| Step | What | Blocks on |
|---|---|---|
| 1 | Spike PWA, Capacitor (cheap, do both) | Nothing |
| 2 | Spike Tauri only if PWA insufficient | Step 1 results |
| 3 | Prototype Expo only if Capacitor insufficient | Step 1 results |
| 4 | Decide: one approach per category, written down with reasoning | Steps 1-3 |
| 5 | Build the winning approach(es) fully | Step 4 |
| 6 | Android internal testing with pilot clients | Step 5 |
| 7 | Android public release | Step 6 feedback addressed |
| 8 | iOS TestFlight beta | Step 7 (Android stable first) |
| 9 | iOS App Store submission | Step 8, budgeting real review time |
| 10 | Desktop distribution live (PWA install or Tauri via GitHub Releases) | Step 5 |
| 11 | Login panel download links added | Steps 7, 9, 10 each as they go live |

---

## Explicitly not doing

Shipping more than one approach per platform category to clients — evaluating multiple options for yourself is the whole point of Phase 1, but Phase 3 onward commits to one, so clients never face a choice between two versions of the same app, and nothing gets built or maintained twice.
