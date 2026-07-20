# BillDoor — Engineering & Security Rules

> **Naming**: Orbitex = company, BillDoor = product, Billit = billing module. Never interchange these.

## Architecture

- Two deployments: `client-portal/` (client + public) and `admin-portal/` (admin). Same Supabase project.
- Supabase handles DB, auth, storage. No Prisma. No custom JWT implementation.
- Next.js 15 App Router. TypeScript. Vanilla CSS (no Tailwind). Lucide icons only.
- Vercel deployment, Mumbai region (`bom1`). Supabase Mumbai (`ap-south-1`).

## Security Rules (MANDATORY)

<important>
### Authentication & Authorization
- NEVER implement custom JWT or token management. Use Supabase Auth exclusively.
- NEVER perform auth checks on the client side only. ALL authorization happens server-side via middleware or Server Actions.
- NEVER trust hidden form fields for user identity. Always derive user identity from `supabase.auth.getUser()` server-side.
- NEVER expose the `service_role` key to the client. It is server-side only (`SUPABASE_SERVICE_ROLE_KEY`, no `NEXT_PUBLIC_` prefix).
- The `anon` key is the ONLY Supabase key permitted in client-side code.

### Row Level Security (RLS)
- EVERY table in the `public` schema MUST have RLS enabled. No exceptions.
- ALL RLS policies MUST use `(select auth.uid())` with parenthesized select — NEVER bare `auth.uid()` — to force initPlan caching.
- EVERY column used in an RLS policy (`client_id`, `user_id`, etc.) MUST have a B-tree index.
- Multi-tenant isolation: clients see ONLY their own data. The `client_id` column is the isolation boundary.
- Security definer functions MUST set `search_path = ''` to prevent search path hijacking.

### Server Actions & API Routes
- ALL Server Actions are public HTTP POST endpoints. Treat them as such.
- EVERY Server Action MUST: (1) verify auth state FIRST, (2) validate input with Zod schema, (3) then process data.
- Use `safeParse()`, never `parse()` — handle validation failures gracefully, never throw unhandled exceptions.
- NEVER use `eval()`, `Function()`, or dynamic code evaluation on user input.
- NEVER use inline SQL string concatenation. All DB queries go through the Supabase client (parameterized).

### Input Validation
- ALL forms are validated identically on client AND server (shared validators in `shared/validation.ts`).
- Server-side validation with Zod is the enforcement layer. Client-side validation is UX only.
- Sanitize all user-generated text before rendering (XSS prevention).

### Rate Limiting
- ALL auth endpoints (login, activation, password reset) MUST be rate-limited.
- ALL public-facing endpoints (digital bill page, review flow) MUST be rate-limited.
- Use sliding window algorithm with IP-based identification.
- Extract true client IP from `x-forwarded-for` header in Server Actions.
- Configure Supabase IP forwarding for auth rate limiting behind Vercel proxy.

### Secrets & Environment
- NEVER hardcode API keys, database URIs, or credentials in source code.
- ALL secrets go in `.env.local` (gitignored). Placeholders go in `.env.example`.
- If adding a new integration, add the placeholder to `.env.example` FIRST.
- Review every `console.log` — strip ALL verbose logging from production code. Never log user objects, tokens, or PII.

### Dependencies
- NEVER install a package without verifying it exists on the official npm registry.
- Pin ALL dependency versions to exact numeric releases (no `^` or `~`).
- Do not introduce transitive dependencies without explicit approval.
- Run `npm audit` before every deployment.

### Deployment & Artifacts
- Source maps MUST NOT be shipped in production builds.
- Vercel preview deployments MUST be set to private/password-protected.
- `.npmignore` or `files` field in `package.json` must explicitly control what ships.
- No debug endpoints, test routes, or staging artifacts in production.

### Database
- snake_case in DB, camelCase in code. Plural table names. UUID primary keys.
- NEVER hard-delete client data. Always soft-delete (`deleted_at` column).
- Bill number sequences use DB-level functions for concurrency safety.
- License keys use `crypto.randomBytes()`, NEVER `Math.random()`.
</important>

## Code Standards (§12)

- **API style**: Feature endpoints, not generic REST. `/dashboard/summary` returns exactly what the screen needs.
- **Forms**: Validated the same way client and server side.
- **Icons**: Lucide React only. One family, never mixed.
- **Spacing**: 4px/8px scale. No web-only effects without React Native equivalent.
- **Mobile**: `100dvh`, `16px` min font on inputs, `env(safe-area-inset-*)`.

## Feature Ownership (§11)

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

## Incident Response (§3.6)

If a breach is suspected:
1. **Check `audit_log` first** — filter by IP/user_agent to identify the attack vector.
2. **Rotate secrets in this order:**
   - Supabase `service_role` key (highest privilege — rotate immediately)
   - WhatsApp Business API token
   - Razorpay API keys
   - Supabase `anon` key (lower risk but rotate if JWT compromise suspected)
3. **Supabase point-in-time recovery** — enabled from day one. Recover to the last known-good timestamp if data integrity is compromised.
4. **Invalidate all sessions** — force re-authentication for all clients via Supabase Auth admin API.
5. **Review all admin actions** — query `audit_log WHERE actor_type = 'admin'` for the breach window.

## Build Rules

- NEVER invent a feature not listed in the implementation plan.
- NEVER silently rename a database field.
- STOP after each assigned phase and wait for review at defined STOP points.
- Read this file before every coding session.
