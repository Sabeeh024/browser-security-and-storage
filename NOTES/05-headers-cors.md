# 05 — Security headers & CORS

A CORS playground (four `Access-Control-Allow-Origin` strategies as a live
toggle), a `frame-ancestors` / `X-Frame-Options` clickjacking demo with a real
iframe, and the response-header checklist.

| | branch |
|---|---|
| Headers + CORS lab | `topic/05-headers-cors` (chained off `topic/04-auth-token-storage`) |

```bash
git switch topic/05-headers-cors
npm run server ; npm run dev      # → sidebar "5 · Headers & CORS"
# cross-site CORS probe: http://127.0.0.1:8787/cors-probe
```

---

## Resolves from topic 03 & 04

> **03: "`SameSite` keeps coming up next to CORS and `Origin`. How do these fit
> together, and what does CORS protect that SameSite doesn't?"**
> **04: "Time to actually understand the header layer."**

They solve *different* problems and are not substitutes:

| Mechanism | Question it answers | Who enforces | Stops the request? |
|---|---|---|---|
| **Same-Origin Policy** | "can site A **read** site B's response?" | browser, by default | no — request is sent, reading the reply is blocked |
| **CORS** | "will site B **let** specific origins read its responses?" | server opts in via headers, browser enforces | no — it only *loosens* SOP |
| **`SameSite` cookie** | "should this cookie ride along on a **cross-site** request?" | browser, per cookie attribute | it withholds the *cookie*, not the request |
| **`Origin` header check** | "did this state-changing request come from **my** front-end?" | your server code | **yes** — you reject it |

So: **CORS never protects you from CSRF** (the forged request still reaches
your handler and side effects still happen — topic 03 proved this). And
`SameSite` doesn't help you decide who may *read* an API response — that's CORS.
`B` "keeps bumping into CORS" because header-based auth is genuinely
cross-origin and the server must explicitly allowlist the SPA's origin
(we had to add `Authorization` to `Access-Control-Allow-Headers` in topic 04).

> **04: "What else can an attacker do just by getting your page to load in the
> wrong context?"** — partially answered here (clickjacking); rest in topic 06.

> **03: "double-submit vs synchronizer CSRF token — when does the stateless one
> fail?"**

Double-submit relies on the attacker being unable to *set* your cookie. It
fails when the attacker controls a **sibling subdomain** (`evil.example.com`)
that can write a cookie on the parent domain (`.example.com`) — they set both
the cookie and the matching header value. Mitigations: sign/HMAC the token
against the session, use `__Host-` cookie prefix, or use the **synchronizer
token** (value stored server-side in the session, nothing to overwrite).

---

## 1 · CORS — the four ACAO strategies

Verified from the SPA and the cross-site probe:

| Mode | `Access-Control-Allow-Origin` sent | Result |
|---|---|---|
| **off** | none | default SOP — cross-origin JS can't read; same-origin fine |
| **`*`** | `*` | any site reads it. Fine for **public** data. Browser **forbids `*` + credentials**. |
| **reflect ⚠️** | echoes whatever `Origin` came in, **+ `Allow-Credentials: true`** | **every site can read authenticated responses.** Classic account-takeover CORS bug. |
| **allowlist ✅** | echoes `Origin` only if it's in a fixed set | the correct pattern |

Lab check: allowlist mode → SPA (`localhost:5173`) reads `/cors/data`;
`127.0.0.1` probe is blocked. reflect mode → `curl -H "Origin: http://evil.example"`
comes back with `Access-Control-Allow-Origin: http://evil.example` +
`Allow-Credentials: true`.

**Preflight:** non-simple requests (custom headers, `PUT`/`DELETE`, most JSON
content-types) trigger an `OPTIONS` first. The browser blocks the real request
unless the preflight response allows the method + headers. This is why adding a
header to a request can suddenly "break CORS".

---

## 2 · Clickjacking — `frame-ancestors` / `X-Frame-Options`

Attack: your real, logged-in page in a transparent iframe over attacker bait,
so the victim's clicks hit your buttons.

Lab (`/framed` iframed from the SPA), verified at the network layer:

| Policy | Outcome |
|---|---|
| `Content-Security-Policy: frame-ancestors 'none'` (+ `X-Frame-Options: DENY`) | `net::ERR_BLOCKED_BY_RESPONSE` — iframe refuses to load |
| `frame-ancestors 'self'` | still blocked from the SPA (`'self'` = the framed page's own origin, not yours) |
| `frame-ancestors http://localhost:5173` | loads |

Notes: `X-Frame-Options` has **no "allow a specific origin" value** (`ALLOW-FROM`
is dead) — it's `DENY`/`SAMEORIGIN` only; CSP `frame-ancestors` is the modern,
multi-origin-capable version. Send **both** for old-browser coverage. Default to
`frame-ancestors 'none'` and add origins only if something legitimately embeds
you.

---

## 3 · The response-header checklist

| Header | Reasonable value | Why / caveat |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'` | Biggest single XSS mitigation. Roll out **Report-Only** first, watch reports, then enforce. |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Forces HTTPS on future visits, kills SSL-strip. HTTPS-only; you're committed for `max-age`. |
| `X-Content-Type-Options` | `nosniff` | Stops MIME sniffing (uploaded `.txt` executed as JS). Always. |
| `X-Frame-Options` | `DENY` | Legacy clickjacking; superseded by `frame-ancestors`, still send it. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Trims `Referer` cross-site so paths/tokens-in-URLs don't leak. |
| `Permissions-Policy` | `geolocation=(), camera=(), microphone=()` | Disable powerful APIs you don't use, incl. for embedded frames. |
| `Cross-Origin-Opener-Policy` | `same-origin` | Severs the link to cross-origin openers/popups (reverse-tabnabbing, Spectre). |
| `Cross-Origin-Resource-Policy` | `same-origin` | Stops other sites `no-cors`-loading your images/JSON. |

Set them **at the edge** (CDN / reverse proxy / host config) so they cover every
response — static files, redirects, error pages. Verify with `curl -I` or
securityheaders.com. In this lab the demo server sets the baseline set via one
middleware that runs before all routes.

---

## Verified in this topic

- `npm run build` clean (264 kB).
- CORS: allowlist allows SPA / blocks `127.0.0.1`; reflect mode echoes an
  arbitrary `Origin` + credentials; `*` mode sends `*` and drops credentials.
- Clickjacking: `/framed` blocked under `frame-ancestors 'none'`
  (`ERR_BLOCKED_BY_RESPONSE`), loads under `frame-ancestors <SPA origin>`.
- Baseline security headers present on non-lesson routes.
- Fixed a middleware-ordering bug so `/headers/*` and `/framed` get correct
  CORS / `X-Frame-Options` (global middleware now runs before routes).

---

## Next questions this raises

**Clickjacking was "load your page in the wrong context". What's the full list
of that class, and the other "safe by convention" footguns from earlier topics
(GET-that-mutates, `target="_blank"`)?**
Topic **06 — common attacks, briefly**: reverse tabnabbing &
`rel="noopener noreferrer"`, open redirects (and how they launder OAuth /
phishing), `postMessage` origin checks, prototype pollution, dependency /
supply-chain risk (`npm audit`), secrets leaking into the client bundle.

**All of topics 03–05 end with "set this header / cookie flag / CSP" — where
does that actually get configured for a Vite SPA in production?**
Topic **07 — production practices**: CSP with Vite (the dev server injects
inline scripts; prod needs nonces/hashes), setting headers on common hosts
(Netlify/Vercel/nginx/Cloudflare), CSRF middleware choices, `npm audit` in CI,
`import.meta.env` and what must never reach the bundle, a pre-ship checklist.

**CSP Report-Only was mentioned twice — how does the reporting pipeline work?**
Covered in topic 07 (the `report-to` / `report-uri` directive and triaging the
noise).
