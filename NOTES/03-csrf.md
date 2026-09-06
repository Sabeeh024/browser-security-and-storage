# 03 — CSRF (Cross-Site Request Forgery)

A working end-to-end CSRF exploit against a tiny bank API, plus every common
defense as a runtime toggle so you can watch each one stop the attack.

| | branch |
|---|---|
| CSRF lab + demo server | `topic/03-csrf` (chained off `topic/02-xss`) |

```bash
git switch topic/03-csrf
npm run server     # terminal 1 — bank API on :8787
npm run dev        # terminal 2 — SPA on :5173  → sidebar "3 · CSRF"
# attacker page: http://127.0.0.1:8787/evil
```

`localhost` and `127.0.0.1` are **different sites** to a browser, so a request
from `127.0.0.1` → `localhost` is genuinely cross-site — the exact condition
SameSite and CSRF tokens address.

---

## Resolves from topic 02

> **"XSS can steal cookies — unless they're `HttpOnly`. But `HttpOnly` cookies
> still get auto-sent on every request, including ones triggered by another
> site. Isn't that a different hole?"**

Yes — that hole is CSRF, and this topic is the answer. The browser attaches
`bank.com`'s cookie to *any* request to `bank.com`, no matter who initiated it.
So `evil.com` can make your browser POST to `bank.com/transfer` with your real
session cookie riding along, and a naive server can't tell it wasn't you.
`HttpOnly` doesn't help here — the attacker never needs to *read* the cookie,
just cause a request that carries it.

Fixes, in order of leverage: **`SameSite=Lax` on the cookie** (one line, stops
the cross-site POST from carrying the cookie at all) → **CSRF token** → **Origin
check**. All demonstrated below.

## Resolves from topic 01

> **"How do I actually set those cookie flags (`HttpOnly`, `Secure`,
> `SameSite`) in practice?"**

Partially — `server/index.js` now shows the real call:

```js
res.cookie('sid', sid, {
  httpOnly: true,                       // JS can't read it
  sameSite: 'Lax',                      // not sent on cross-site POST
  secure: true,                         // HTTPS only (prod)
  path: '/',
})
```

That's the mechanism. Full response-header hardening (CSP, HSTS, frame
options, and how `SameSite`/CORS interact) is still topic 05, and wiring it
through the build/host is topic 07.

---

## The attack (in the lab)

The attacker page at `/evil` runs two classic vectors on load:

| Vector | Subject to CORS? | Result in lab |
|---|---|---|
| **A — hidden auto-submitting `<form method=POST>`** | **No.** Forms have always been allowed to POST cross-site. | This is the real CSRF. With defenses off: **balance $1000 → $500.** |
| **B — `fetch(..., {credentials:'include'})`** | Yes. JSON body triggers a preflight; server doesn't allow the attacker origin. | Blocked before send (`TypeError: Failed to fetch`). CORS accidentally helps here — but *only* because of the non-simple content-type; a `text/plain` or form-encoded body would send. |

Verified: with `SameSite=None, csrf off, originCheck off`, the forged form POST
moved money ($1000 → $500). With `SameSite=Lax`, the same attack left the
balance at $1000 — the cookie wasn't attached, server returned 401.

---

## The defenses (each toggle, verified)

| Defense | How it stops the forged request | Cost / caveat |
|---|---|---|
| **`SameSite=Lax`** (modern browser default) | Cookie is omitted from cross-site POSTs / iframes / `fetch`. Top-level GET navigations still carry it. | Almost free. Doesn't cover the rare same-site-but-untrusted subdomain case. |
| **`SameSite=Strict`** | Cookie never leaves on *any* cross-site request, incl. following a link from email. | Breaks "click link → already logged in" UX. Common pattern: Strict for the session, a Lax "read-only" companion cookie. |
| **`SameSite=None`** | Nothing — cookie always sent. Requires `Secure`. | You've opted fully into CSRF exposure; token + Origin checks are all that remain. Needed for legit cross-site cookies (embeds, some SSO). |
| **CSRF token (double-submit)** | Server sends a random value as a *non-HttpOnly* cookie; SPA reads it and echoes it in `X-CSRF-Token`. Attacker's site can't read your cookie (Same-Origin Policy), so can't set the matching header. | Token plumbing in the client. Stateless (no server store). Synchronizer-token variant stores it server-side — stronger, needs session state. |
| **Origin / Referer check** | Forged request carries the attacker's `Origin` (or a cross-site `Referer`); server allowlists its own. | `Referer` can be stripped by privacy tools; `Origin` is reliable on state-changing methods. Cheap, no tokens. |

Verified the legit path still works with **all** defenses on: a transfer from
the SPA (correct `Origin`, valid `X-CSRF-Token`) returned 200 and both checks
passed.

---

## The mental model

```
Is auth "ambient" (cookie / HTTP Basic / client cert — browser adds it automatically)?
   │ no  (token in Authorization header) → attacker site can't add that header → ~CSRF-immune
   │                                        (but the token is now JS-reachable → XSS risk, topic 04)
   │ yes → you MUST defend:
            1. SameSite=Lax/Strict on the cookie      (baseline, always)
            2. CSRF token on state-changing endpoints  (defense in depth)
            3. check Origin on state-changing methods  (cheap extra)
            4. never mutate state on GET
```

**CORS is not a CSRF defense.** It governs who may *read* a cross-origin
response; the request still reaches your handler and side effects still happen.
(Full CORS treatment: topic 05.)

**XSS defeats all of this.** Script running on your origin passes the Origin
check and can read the CSRF token cookie. CSRF defenses assume no XSS — which is
why topic 02 comes first.

---

## Verified in this topic

- `npm run build` clean (245 kB bundle).
- Live exploit: forged cross-site form POST moved money with defenses off
  ($1000 → $500).
- `SameSite=Lax` blocked the same attack (balance unchanged, 401).
- Legit SPA transfer succeeded with CSRF token + Origin check both enabled.
- Dev server logs clean; no build errors.

---

## Next questions this raises

**The header-token alternative dodges CSRF but reintroduces the XSS storage
problem. Which is actually better, and is there an option that avoids both?**
Topic **04 — auth token storage**: HttpOnly-cookie sessions vs. in-memory
access token + refresh vs. the BFF pattern (cookie to the browser, token kept
server-side). Uses this same server.

**`SameSite` keeps coming up next to CORS and `Origin`. How do these headers
actually fit together, and what does CORS protect that SameSite doesn't?**
Topic **05 — security headers & CORS**: the full response-header set (CSP,
HSTS, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`,
`Referrer-Policy`, `Permissions-Policy`) and the common CORS misconfigs
(`Allow-Origin: *` with credentials, reflecting Origin blindly).

**Double-submit vs. synchronizer token — when does the stateless one fail?**
Covered briefly in topic 05; the failure mode is a subdomain that can set
cookies on the parent domain. Framework CSRF middleware (Rails, Django,
`csrf-csrf`) is the practical answer — topic 07.

**GET-that-mutates showed up as a footgun. What other "safe by convention"
assumptions bite?**
Topic **06 — common attacks, briefly**: clickjacking, open redirects,
tabnabbing, `target="_blank"` without `rel=noopener`, prototype pollution.
