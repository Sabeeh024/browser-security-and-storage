# 04 — Auth token storage: cookie vs in-memory+refresh vs BFF

Three working implementations of "hold an auth credential in the browser",
against the same protected endpoints, each with a **Run XSS payload** button
that prints what an injected script could actually exfiltrate.

| | branch |
|---|---|
| Auth token lab (extends the demo server) | `topic/04-auth-token-storage` (chained off `topic/03-csrf`) |

```bash
git switch topic/04-auth-token-storage
npm run server      # terminal 1
npm run dev         # terminal 2  → sidebar "4 · Auth token storage"
```

---

## Resolves from topic 01 & 02

> **01: "Where do I keep the JWT / session token?"**
> **02: "If a session token can't safely live anywhere JS can read, where does
> it go?"**

Definitive answer, three viable options (localStorage is **not** one of them):

| | A · HttpOnly cookie | B · in-memory + refresh | C · BFF |
|---|---|---|---|
| What the browser holds | `sid` cookie, `HttpOnly` | short-lived access token in a **JS variable**; `refresh` cookie `HttpOnly` | only an opaque `bff_sid` cookie |
| XSS can **exfiltrate** it | **No** | Yes — but only the ~15s access token; refresh stays HttpOnly | **No** |
| XSS can **use** it in-page | Yes | Yes | Yes |
| Survives reload w/o re-login | Yes | Via a `/auth/refresh` call on boot | Yes |
| CSRF exposure | Yes → needs SameSite+token (topic 03) | **No** (Authorization header) | Yes → needs SameSite+token |
| Plumbing | Minimal | Most | Medium + you run a BFF |

**Verified in the lab:**
- B: `/auth/login` returns `{accessToken}` in the body; `/auth/data` with the
  Bearer header → 200; without it → 401; `/auth/refresh` (HttpOnly cookie) mints
  a *different* token → silent refresh works. The panel auto-restores on mount.
- C: `/bff/login` response contains **no token**; `/bff/data` succeeds using the
  server-side-stored upstream token; `document.cookie` is empty (`bff_sid` is
  HttpOnly).
- A: `document.cookie` empty; the payload can't read `sid` but *can* still call
  `/me` successfully — i.e. ride the session.

## Resolves from topic 03

> **"The header-token alternative dodges CSRF but reintroduces the XSS storage
> problem. Which is actually better, and is there an option that avoids both?"**

- **Cookie (A)** → CSRF-exposed, XSS-exfil-safe.
- **Header token (B)** → CSRF-safe, XSS can exfil the short-lived half.
- **BFF (C)** → avoids *both*: cookie to the browser so no token for XSS to
  steal, and because the BFF is same-origin you control CSRF on it normally.
  The cost is operational (you run and scale the BFF).

There is no option where a browser app is immune to a live XSS *using* the
session while the page is open — see below.

---

## The one idea that outranks the table

**No storage choice stops XSS from acting as the user while the page is open.**
A script on your origin can call your API with the cookie riding along (A, C),
or read the in-memory token variable (B). The only thing storage choice changes
is **whether the credential can be exfiltrated for use elsewhere / later**.

So the ranking of *consequences* of one XSS bug:

```
localStorage token   → stolen, no expiry, full account takeover, forever
in-memory access tok  → stolen, ~minutes of access off-site, then needs your page again
HttpOnly cookie / BFF → NOT stolen; abuse limited to while the victim has your page open
```

That gap is real and worth designing for — but XSS prevention (topic 02) is
still the actual mitigation, not storage.

---

## Decision guide

- **Most apps → A.** HttpOnly cookie session + `SameSite=Lax` + CSRF token.
  Least code, no long-lived secret in JS, well-trodden.
- **Need header-based auth** (calling a third-party API directly, native +
  web sharing one auth server) **→ B.** Access token in memory, refresh token
  in an HttpOnly cookie path-scoped to the refresh endpoint. Accept the
  on-load refresh round-trip.
- **OAuth/OIDC SPA → C (BFF).** Current IETF guidance ("OAuth 2.0 for
  Browser-Based Apps") is: don't put OAuth tokens in the browser at all; the
  server-side BFF holds them and exposes a cookie session.
- **Always:** short access-token TTL, rotate refresh tokens, server-side logout
  / revocation, bind tokens to a session where you can.

---

## Verified in this topic

- `npm run build` clean (254 kB bundle).
- Server extended with `/auth/*` (approach B) and `/bff/*` (approach C);
  `Authorization` added to the CORS allow-headers (fix commit).
- All three flows exercised via the running server from the page origin:
  login, protected read, 401 without credential, refresh rotation, BFF
  no-token response. `document.cookie` confirmed empty for A and C.

---

## Next questions this raises

**Approaches A and C both say "needs SameSite + token" and B keeps bumping into
CORS. Time to actually understand the header layer.**
Topic **05 — security headers & CORS**: `SameSite` vs CORS vs `Origin` checks
and exactly what each defends; the full response-header set (CSP, HSTS,
`X-Content-Type-Options`, `X-Frame-Options` / `frame-ancestors`,
`Referrer-Policy`, `Permissions-Policy`); the classic CORS misconfigs
(`Allow-Origin: *` with credentials, blind Origin reflection). Also: when the
stateless double-submit CSRF token fails (subdomain cookie-setting).

**"XSS can ride the session" keeps being the unfixable-by-storage caveat. What
else can an attacker do without stealing anything — just by getting your page
to load in the wrong context?**
Topic **06 — common attacks, briefly**: clickjacking (your real page in an
invisible iframe), `target="_blank"` reverse tabnabbing, open redirects used to
launder OAuth flows, prototype pollution.

**Where does all this cookie/header config actually live in a real deploy?**
Topic **07 — production practices**: setting headers at the edge/host, CSP
with Vite (nonces/hashes), CSRF middleware, `npm audit` / supply chain, secrets
that must never reach the bundle.
