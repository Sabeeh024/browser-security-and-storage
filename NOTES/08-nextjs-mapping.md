# 08 — The same security, on Next.js (frontend + BFF) over a real backend

Does anything from topics 1–7 carry over if you switch the SPA to Next.js?
**~80% unchanged** — the browser is the browser. What moves is the *server-side*
half, and there are four genuinely new Next footguns.

This lab uses the **realistic split**: Next.js is the **frontend + BFF**
(SSR/CSR, session, proxy); the **actual API is the Express bank server** from
topics 3–7 (`server/index.js`, port 8787) — standing in for a separate
Spring/Rails/Go/Nest service owned by another team.

| | branch |
|---|---|
| Next + Express lab | `topic/08-nextjs-mapping` (adds `next-lab/`, chained off `topic/07`) |

```bash
npm run server                 # terminal 1, repo root — Express API :8787
cd next-lab && cp .env.example .env.local && npm install
npm run dev                    # terminal 2 — Next :3000
```

Built on **Next 16.3.4**. Next 16 renamed `middleware.js` → **`proxy.js`**
(export `proxy`), same API.

---

## The architecture

```
browser ──same-origin──► Next.js (:3000) ──server-to-server──► Express API (:8787)
        HttpOnly cookie                    Bearer token + X-API-Key
```

Two trust boundaries, and they are **not the same problem**:

| | browser ↔ Next | Next ↔ Express |
|---|---|---|
| Same origin? | yes (:3000) | n/a — server-to-server |
| **CORS** | irrelevant (same origin) | **irrelevant (no browser)** |
| **CSRF** | **applies** → SameSite + Origin check + Server Actions | not possible |
| Credential | opaque HttpOnly cookie (`bff_session`) | per-user Bearer token + service `X-API-Key` |
| XSS impact | can *ride* the cookie by calling `/api/*` | can't reach it |
| Harden with | CSP, cookie flags, CSRF tokens, input handling | network policy / mTLS, token scope, **backend re-validates** |

**Putting Next in front removes the browser↔API CORS relationship entirely.**
The Express CORS config from topic 5 now only matters if some *other* browser
client calls Express directly. Verified: a `fetch('http://localhost:8787/...')`
from the browser is blocked three ways over — CSP `connect-src 'self'`, no CORS
header for `:3000`, and no token anyway.

---

## Per-topic mapping

### 1 · Storage — unchanged
Same browser APIs. `window`/`localStorage` absent during SSR (guard). Cookies
become first-class: `cookies()` from `next/headers`, read in Server Components,
written only in Route Handlers / Server Actions / `proxy.js`.

### 2 · XSS — mostly unchanged
React auto-escaping, `dangerouslySetInnerHTML`, DOMPurify — identical. New
surface: the SSR/RSC HTML stream, `next/script`, route handlers reflecting
input. Server-side sanitising: `isomorphic-dompurify` / `sanitize-html`.

### 3 · CSRF — concept identical, and now clearly a *browser↔Next* concern only
`next-lab/app/csrf/` — verified:

| | Server Action (`actions.js`) | Route Handler (`app/api/transfer`) |
|---|---|---|
| Auto Origin/CSRF check | **✅ built in** (POST-only, `Origin` vs `Host`) | ❌ none |
| Verified | cross-origin forged action rejected by Next | cross-origin `POST` → **403 only because `proxy.js` adds the Origin check** |
| Then | → `backendTransfer()` with Bearer token | same |

Next → Express is a server call — no ambient credential, nothing to forge. The
backend still validates the Bearer token independently ("Next forwarded it" is
not authorization). Verified: same-origin transfer 200 → balance $1000→$750 at
Express; cross-origin → 403 at Next.

### 4 · Auth token storage — this IS the BFF now, not a demo of one
`next-lab/app/lib/session.js` + `app/api/login` — verified end to end:

1. browser → Next `/api/login`
2. Next → Express `POST /api/token` with `X-API-Key` (server-to-server secret)
3. Express returns a per-user access token
4. Next stores `{ user, accessToken }` in its own cookie:
   `bff_session=…; HttpOnly; SameSite=Lax` — the **token is inside the cookie
   value, server-readable only**
5. browser gets a redirect + the opaque cookie

`document.cookie` is empty in the browser. `/api/me` still works (rides the
cookie). Topic 4 approaches A and C collapse into one thing here: **the cookie
*is* the BFF session.** Approach B (token in browser memory) is what you avoid —
you have Next to hold it. Real apps: Auth.js / Lucia / iron-session (sign or
encrypt the cookie, or store only a session id + server-side store).

### 5 · Headers & CORS — config moves, CORS mostly vanishes
`next-lab/next.config.mjs` `headers()` — verified on every response (HSTS,
`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`,
COOP) + `poweredByHeader: false`. CSP with a **per-request nonce** in
`proxy.js` (Next's official pattern) — *easier* than the Vite setup.
`connect-src 'self'` needs nothing added because the browser only calls Next.

### 6 · Common attacks — nearly verbatim
Open redirect, tabnabbing, `postMessage`, prototype pollution — identical. Two
grow: `NEXT_PUBLIC_` is the `VITE_` of Next (`app/env/`), and RSC data leakage
(below). The topic-7 CI bundle secret-scan works the same on `.next/static`.

### 7 · Production — concept identical, tooling changes
Headers in `next.config.mjs` (host-agnostic). The dev/prod CSP split is one
file: `proxy.js` adds `'unsafe-eval'` only when `NODE_ENV === 'development'`
(React dev + HMR); the production build drops it.

---

## The four genuinely new footguns

1. **RSC / SSR data leakage** — `next-lab/app/rsc-leak/`, **verified**: a value
   passed as a prop from a Server Component to a Client Component appears
   verbatim in the page source (the `dev-ba…` secret prefix found in
   `document.documentElement.outerHTML`). Anything a Client Component receives
   is serialised into the RSC payload. Defenses: do secret-work server-side and
   pass only the *result*; guard modules with `import 'server-only'` (used in
   `lib/backend.js`, `lib/session.js`, `lib/secrets.js` — build fails on a
   client import).

2. **Caching correctness** — `next-lab/app/caching/`, **verified**: `/caching/leaky`
   proxies the per-user backend balance with `Cache-Control: public, max-age=60`;
   `/caching/safe` uses `private, no-store`. A shared cache keyed on the URL
   serves one user's balance to the next. Also: `force-static` on a route that
   reads `cookies()`, `fetch(url, {cache:'force-cache'})` of personalised data,
   `unstable_cache` keys missing the user id. No analog in the SPA lab.

3. **Server Actions are public HTTP endpoints** — the built-in check is CSRF,
   **not authorization**. `actions.js` re-checks the session and validates
   `amount` before calling the backend. Args are attacker-controlled.

4. **`proxy.js` as a security control** — easy to write an auth gate whose
   `matcher` misses routes or assumes Edge APIs. Here it does two narrow jobs
   (CSP nonce, `/api/*` Origin check), not auth — auth checks belong close to
   the data (action / handler / Server Component / **the backend**), with
   middleware as an optimisation, not the sole gate (Next's own CVE-2025-29927
   middleware-bypass advisory).

---

## What gets easier

CSP (official nonce pattern), CSRF (Server Actions), the BFF (it's the
architecture), cookie handling (`cookies()`), security headers (`next.config`
is host-agnostic), and **CORS basically disappears** from the browser's view.

## Verified in this topic

- `npm run build` clean (11 routes, all dynamic; proxy active).
- Login: browser → Next → Express `/api/token` (X-API-Key) → `bff_session`
  cookie `HttpOnly; SameSite=lax`; home SSR shows the live backend balance.
- Transfer: same-origin via Next route → Express → balance $1000→$750;
  cross-origin → 403 at `proxy.js`; Server Action path also works.
- `/data-flow`: SSR renders the Express response in HTML; browser → Express
  direct fetch blocked (CSP `connect-src` + no CORS).
- RSC leak: secret prefix present in page source.
- `document.cookie` empty; backend token never in the browser.
- Fixed: `middleware.js`→`proxy.js`, `<form>`-in-`<p>` hydration, dev-only
  `'unsafe-eval'`, `agentRules: false` to stop Next writing AGENTS.md/CLAUDE.md.

---

## Next questions this raises

**We hand-rolled the BFF session (base64 cookie). A real one is signed/encrypted
and often just a session id + server store. Do Auth.js / Lucia / iron-session
hold up against topics 2–4, and what do they actually set?**
Would be topic 09: wire one in, inspect the cookie flags, rotation, CSRF
handling, and where the session is validated.

**The backend trusts a static `X-API-Key` from Next. In a real multi-service
setup that's mTLS / short-lived service tokens / a mesh. When does the
service-to-service auth choice bite the frontend security model?**
Out of scope here (backend/infra), but the frontend consequence is: if the
Next↔Express channel is compromised, the BFF's own defenses (CSP, CSRF, cookie
flags) are irrelevant — so that channel needs its own hardening, tracked
separately from this series.

**Pages Router (`getServerSideProps`, API routes) predates RSC / Server
Actions — does the mapping differ?**
Mostly: no RSC-leak class, no Server Actions (CSRF is all-manual like the
Express lab), `next.config` headers and `cookies` via `req/res` still apply.
Not worth a full topic unless maintaining a Pages Router app.

**Edge vs Node runtime for `proxy.js` / route handlers changes which APIs and
crypto you get — when does it bite security code?**
`crypto.randomUUID()` works on both; `Buffer` and Node-only libs don't run on
Edge. Pin security-critical handlers with `export const runtime = 'nodejs'`.
A footnote, not a topic.
