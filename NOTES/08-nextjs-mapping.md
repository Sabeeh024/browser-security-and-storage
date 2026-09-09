# 08 — The same security, on Next.js (App Router)

Does anything from topics 1–7 carry over if you switch from Vite/SPA to Next.js?
**~80% unchanged.** The browser is the browser; every attack and defense *at
the browser boundary* is identical. What moves is **where the server-side half
lives** — from a separate Express app to route handlers / Server Actions /
`proxy.js` (middleware) / Server Components inside one project. Plus four
genuinely new Next-specific footguns.

| | branch |
|---|---|
| Next App Router lab | `topic/08-nextjs-mapping` (adds `next-lab/`, chained off `topic/07`) |

```bash
cd next-lab && cp .env.example .env.local && npm install
npm run dev        # http://localhost:3000
npm run build      # prod build — CSP drops 'unsafe-eval'
```

Built on **Next 16.3.4**. Note: Next 16 renamed `middleware.js` → **`proxy.js`**
(export `proxy`), same API.

---

## Per-topic mapping (what actually changes)

### 1 · Client-side storage — unchanged
Same browser APIs. Two wrinkles: `window`/`localStorage` don't exist during
SSR (guard with `useEffect` / `typeof window`), and **cookies become
first-class** via `cookies()` from `next/headers` — read in Server Components,
write only in Route Handlers / Server Actions / `proxy.js`.

### 2 · XSS — mostly unchanged
React auto-escaping, `dangerouslySetInnerHTML` as the hole, DOMPurify — all
identical. New surface: injection into the SSR/RSC HTML stream, `next/script`,
route handlers reflecting input. Server-side sanitising needs
`isomorphic-dompurify` / `sanitize-html`.

### 3 · CSRF — concept identical, surface splits in two
**`next-lab/app/csrf/`** — verified:

| | Server Action (`actions.js`) | Route Handler (`app/api/transfer`) |
|---|---|---|
| Auto Origin/CSRF check | **✅ built in** (POST-only, `Origin` vs `Host`) | ❌ none |
| Verified | cross-origin forged action rejected by Next | cross-origin `POST` → **403 only because `proxy.js` adds the check** |
| Authorization | still your code | still your code |

So: form mutations via Server Actions get topic-3's defense for free. Anything
in `app/api/*` is exactly as exposed as the Express `/transfer` was — you add
`SameSite` + a token + an `Origin` check yourself (`proxy.js` shows the Origin
check).

### 4 · Auth token storage — concept identical, default shifts to "cookie / BFF"
**`next-lab/app/auth/`** + `app/lib/session.js` — verified: login route handler
sets `demo_session` as `HttpOnly; SameSite=lax`; a Server Component reads the
decoded session via `cookies()`; `document.cookie` is empty in the browser but
`fetch('/api/me')` still authenticates (rides the cookie — same "can't steal,
can ride" point as topic 4).

- **Approach A (HttpOnly cookie)** is the Next default.
- **Approach C (BFF)** is essentially free — Next *is* the backend-for-frontend;
  upstream API tokens stay in route handlers / actions.
- **Approach B (in-memory access token)** rarely needed — you have a server to
  proxy through.
- Real apps: Auth.js / Lucia / Clerk, all cookie-session by default.

### 5 · Headers & CORS — concept identical, config moves
`next-lab/next.config.mjs` `headers()` — verified present on every route
(`Strict-Transport-Security`, `nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy`, `Permissions-Policy`, COOP) plus `poweredByHeader: false`.
CSP with a **per-request nonce** lives in `proxy.js` (Next's official pattern) —
this is *easier* than the Vite setup. CORS on route handlers is manual, same
misconfigs as topic 5.

### 6 · Common attacks — nearly verbatim
Open redirect (`redirect()` from `next/navigation`), tabnabbing, `postMessage`,
prototype pollution — all identical. Two get bigger:
- **Secrets in the bundle**: `NEXT_PUBLIC_` is the `VITE_` of Next
  (`next-lab/app/env/`). Same CI bundle-scan from topic 7 works on
  `.next/static`.
- **RSC data leakage** (new — see below).

### 7 · Production practices — concept identical, tooling changes
Headers in `next.config.mjs` (host-agnostic) instead of `deploy/_headers`. CSP
nonce in `proxy.js`. **The dev/prod CSP split is now one file**: `proxy.js`
adds `'unsafe-eval'` only when `NODE_ENV === 'development'` (React dev + HMR);
the production build drops it. Verified: dev needs it, `npm run build` output
doesn't.

---

## The four genuinely new footguns

1. **RSC / SSR data leakage** — `next-lab/app/rsc-leak/`, **verified**: a value
   passed as a prop from a Server Component to a Client Component appears
   verbatim in the page source (`super-…` secret prefix found in
   `document.documentElement.outerHTML`). Anything a Client Component receives
   is serialised into the RSC payload. Defenses: do secret-work in the Server
   Component / route handler and pass only the *result*; guard modules with
   `import 'server-only'` (build fails on a client import — used in
   `app/lib/db.js` and `session.js`).

2. **Caching correctness** — `next-lab/app/caching/`, **verified**: `/caching/leaky`
   returns per-user data with `Cache-Control: public, max-age=60`; `/caching/safe`
   uses `private, no-store`. A shared cache (CDN, proxy) keyed on the URL serves
   one user's balance to the next visitor. Also applies to `force-static` on a
   route that reads `cookies()`, `fetch(url, {cache:'force-cache'})` of
   personalised data, and `unstable_cache` / `'use cache'` keys that omit the
   user id. No analog in the SPA lab.

3. **Server Actions are public HTTP endpoints** — the built-in check is CSRF,
   **not authorization**. Every action re-checks the session and validates its
   args (`actions.js` does both). Args are attacker-controlled.

4. **`proxy.js` (middleware) as a security control** — easy to write an auth
   gate whose `matcher` misses routes, or that assumes Edge-runtime APIs.
   Here it does two narrow jobs (CSP nonce, `/api/*` Origin check) rather than
   auth — auth checks belong close to the data (in the action / handler /
   Server Component), with middleware as an optimisation, not the sole gate
   (see Next's own "CVE-2025-29927" middleware-bypass advisory).

---

## What gets easier

CSP (official nonce pattern in `proxy.js`), CSRF (Server Actions),
the BFF (it's the framework), cookie handling (`cookies()` API),
security headers (`next.config` is host-agnostic).

## Verified in this topic

- `npm run build` clean (9 routes, all dynamic; proxy active).
- Auth: HttpOnly+SameSite cookie set by route handler, read by Server Component,
  `/api/me` authenticates via the cookie.
- CSRF: cross-origin `POST /api/transfer` → 403 via `proxy.js`; same-origin → 200.
- Caching: `public, max-age=60` vs `private, no-store` on the two routes.
- Headers: full set from `next.config.mjs` on page responses; no `X-Powered-By`.
- RSC leak: prop value present in page source.
- Fixed on the way: `middleware.js` → `proxy.js` (Next 16), `<form>` inside
  `<p>` hydration error, dev-only `'unsafe-eval'` in the CSP.

---

## Next questions this raises

**Auth.js / Lucia / Clerk each make different storage & CSRF choices — which,
and do they hold up against topics 2–4?**
Would be topic 09: wire a real auth library into `next-lab`, inspect the cookie
flags it sets, whether it rotates, how it does CSRF, and where the session is
validated.

**The Pages Router (`getServerSideProps`, API routes) predates all the RSC /
Server Action machinery — does the mapping differ?**
Mostly: no RSC-leak class, no Server Actions (so CSRF is all-manual like the
Express lab), `next.config` headers and `cookies` via `req/res` still apply.
Not worth a full topic unless you're maintaining a Pages Router app.

**Edge vs Node runtime for `proxy.js` / route handlers changes which APIs and
which crypto you get — when does it bite security code?**
`crypto.randomUUID()` works on both; `Buffer`, some Node APIs, and heavier libs
don't run on Edge. If a security check needs Node-only APIs, pin that handler to
`export const runtime = 'nodejs'`. A footnote, not a topic.
