# 07 — Production practices (capstone)

Where every "set this header / flag / check" from topics 1–6 actually lives in a
shipped app: a production static server, edge-config files for real hosts, a
CI workflow, a bundle secret-scan, a CSP reporting endpoint, and one pre-ship
checklist mapping each item back to its topic.

| | branch |
|---|---|
| Production lab | `topic/07-production-practices` (chained off `topic/06-common-attacks`) |

```bash
git switch topic/07-production-practices
npm run build && npm run serve:prod   # http://localhost:4173 — real headers + strict CSP
npm run dev                           # http://localhost:5173 → sidebar "7 · Production practices"
npm run check:secrets                 # scan dist/ for secret-shaped strings
```

New files:
- `server/prod.js` — serves `dist/` with the full header set + strict CSP + a `/csp-report` collector + `/_audit`
- `deploy/_headers`, `deploy/vercel.json`, `deploy/nginx.conf` — the same header set for Netlify/Cloudflare, Vercel, nginx
- `scripts/check-bundle-secrets.mjs` + `.github/workflows/security.yml`

---

## Resolves from topic 05 & 06

> **05 & 06: "Every topic since 03 ends with 'set this header / cookie flag /
> CSP / CI check' — where does all of that actually live for a Vite SPA in
> production?"**

**At the edge, not in the app.** The SPA is static files; whatever serves them
(CDN, host, reverse proxy) attaches the headers to *every* response — HTML,
assets, 404s, redirects. This repo shows the same policy four ways:

| Host | File | Mechanism |
|---|---|---|
| local prod-like | `server/prod.js` | Express middleware before `express.static` |
| Netlify / Cloudflare Pages | `deploy/_headers` (→ `public/_headers`) | `_headers` rules file |
| Vercel | `deploy/vercel.json` | `headers[]` config |
| nginx | `deploy/nginx.conf` | `add_header … always` |

Keep it **versioned in the repo** and **verified in CI** (Observatory /
securityheaders CLI against a preview URL) so a config change can't silently
drop a header.

Cookie flags (`HttpOnly`, `Secure`, `SameSite`) are the exception — those are
set by the **API/BFF** when it issues the session (topics 3–4), not the static
host.

> **05: "CSP Report-Only — how does the reporting pipeline actually work?"**

1. Send `Content-Security-Policy-Report-Only: …; report-uri /csp-report`
   (or the newer `report-to` + `Reporting-Endpoints`). Nothing is blocked.
2. Browser POSTs a JSON violation report per blocked resource to that endpoint.
3. Collect, dedupe by `blocked-uri` + `violated-directive`, triage. Expect
   heavy noise from browser extensions and injected junk — filter aggressively.
4. Add the legitimate sources you find, tighten, repeat.
5. When the report stream is clean, switch the header to the enforcing
   `Content-Security-Policy`.

Verified in the lab: `server/prod.js` has a `/csp-report` collector; the lesson
POSTs a sample report and reads the log back. Route it to Sentry /
report-uri.com / your log pipeline in production, not a hand-rolled array.

---

## CSP with Vite — the dev/prod split

**The production build is CSP-clean.** `npm run build` emits only hashed
`<script type="module" src>` / `<link rel=stylesheet>` — **no inline scripts**.
So `script-src 'self'` works with **no nonces and no hashes**. Verified: the
built app loads on `:4173` under the strict CSP with **zero console
violations**.

The **dev server** is the one that injects inline scripts (HMR client) — that's
why you can't run the same strict CSP in `npm run dev`, and why "add a strict
CSP" is a deploy-config task, not an app-code one.

Remaining loosener: `style-src 'unsafe-inline'` — Vite may emit a small inline
`<style>`. Options: accept it (inline *style* is low-risk), hash it, or use a
plugin to extract it. If you have genuine inline `<script>` (an analytics
snippet), use a **per-response nonce** from your server/edge, never static
hashes you maintain by hand.

Full policy shipped in this repo:

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
connect-src 'self' <YOUR-API-ORIGIN>;
font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
report-uri /csp-report
```

---

## Supply chain & CI

`.github/workflows/security.yml` runs on every push/PR:

1. **`npm ci`** — install exactly the committed lockfile (no floating
   versions, deterministic, lifecycle scripts only for pinned deps).
2. **`npm audit --audit-level=high`** — fail on known high/critical vulns.
3. **`npm run build`**.
4. **`node scripts/check-bundle-secrets.mjs`** — regex-scan `dist/` for
   AWS keys, `sk_live_`, GitHub tokens, private keys, JWTs. A backstop — the
   real rule is *never reference a secret from front-end code; anything in
   `import.meta.env.VITE_*` is public*. Verified: passes on the clean build.

Plus (not in the workflow file, but the practice): Dependabot/Renovate for
bounded, reviewed updates; SRI hashes on any `<script>` loaded from a CDN;
review new transitive deps.

---

## Verified in this topic

- `npm run build` clean; `npm run check:secrets` → "no obvious secrets".
- `server/prod.js` on `:4173` sends all 8 security headers + the strict CSP
  (`curl -I` confirmed); `/_audit` mirrors them; SPA fallback works.
- Built app loads under the enforcing CSP with **no console violations**.
- CSP report round-trip: `POST /csp-report` → `204`, `GET /csp-report` returns
  the stored reports; lesson UI shows the audit checklist (8/8 ✅) and the
  report log.
- Fixed an Express 5 breakage (`app.get('*')` is no longer valid — use a
  trailing middleware for the SPA fallback).

---

## The pre-ship checklist (also rendered in the lesson)

**Transport** — HTTPS + HTTP→HTTPS redirect (7); HSTS long max-age, preload
once sure (5/7).

**Response headers, at the edge, every response** — CSP, enforced after a
Report-Only period (2/5/7); `frame-ancestors 'none'` + `X-Frame-Options: DENY`
(5); `nosniff` (5); `Referrer-Policy`, `Permissions-Policy`, COOP, CORP (5).

**Auth & sessions** — session in `HttpOnly`+`Secure`+`SameSite` cookie or BFF
(1/4); CSRF token + `Origin` check on mutations (3); short access-token TTL,
refresh rotation, server-side logout (4); no tokens/PII in web storage (1/4).

**App code** — no `dangerouslySetInnerHTML`/`innerHTML` on untrusted data,
DOMPurify if unavoidable (2); allowlist URL schemes and redirect targets (2/6);
every `postMessage` listener checks `event.origin` (6); untrusted keys never
reach a recursive merge/set (6); state changes only on POST/PUT/PATCH/DELETE
(3/6).

**CORS** — allowlist origins, never reflect `Origin` + `Allow-Credentials`
(5); `ACAO: *` only on public endpoints (5).

**Supply chain & CI** — `npm ci` from committed lockfile (6/7); `npm audit`
fail-on-high in CI (6/7); bundle secret-scan + Dependabot/Renovate (6/7); no
secret in front-end code / `VITE_*` (6/7); source maps to the error tracker,
not the public deploy (6).

**Ops** — rate-limit auth/OTP/reset with generic responses (6);
user-uploaded files on a separate origin (6); generic error pages, no stack
traces to clients (6).

---

## How security scales with the app (resolves from topic 06)

| Stage | Add |
|---|---|
| **Minimum viable secure** | HTTPS+HSTS, the header set at the edge, `HttpOnly`+`SameSite` session cookie + CSRF token, React default escaping, allowlisted CORS, `npm ci`+`npm audit` in CI |
| **Growing** | BFF for OAuth token handling (4); separate origin for user uploads (6); CSP tightened via Report-Only telemetry (7); Dependabot + SRI (6/7) |
| **Larger / regulated** | WAF + bot management at the edge; centralised auth (OIDC provider); secret manager + short-lived credentials; SAST/DAST in CI; pen-test cadence; audit logging |

Responsibilities: **edge** owns transport + headers + WAF; **BFF** owns the
session cookie and holds upstream tokens; **API** re-validates *everything*
(the client is never trusted); **CI** owns dependency + secret + header
regression checks.

---

## Beyond this series (deliberately not covered)

Subresource Integrity edge cases, Trusted Types, COEP/`credentialless` +
cross-origin isolation for `SharedArrayBuffer`, CSP `strict-dynamic`,
OAuth/OIDC/PKCE internals, WebAuthn/passkeys, iframe sandboxing tokens,
service-worker security, WebSocket auth, cookie `__Host-`/`__Secure-` prefixes
in depth, DNS/domain security (CAA, DNSSEC), CSP nonce propagation in SSR
frameworks. Each is worth a session of its own once the fundamentals here are
reflexes.
