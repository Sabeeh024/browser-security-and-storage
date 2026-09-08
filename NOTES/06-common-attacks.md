# 06 — Common attacks, briefly

The "every dev should know" tail: not XSS/CSRF, but they bite constantly. Four
interactive demos + a reference table of the non-demoable ones.

| | branch |
|---|---|
| Common-attacks lab | `topic/06-common-attacks` (chained off `topic/05-headers-cors`) |

```bash
git switch topic/06-common-attacks
npm run server ; npm run dev      # → sidebar "6 · Common attacks"
```

---

## Resolves from topic 03, 04 & 05

> **05: "Clickjacking was 'load your page in the wrong context'. What's the full
> list of that class?"**
> **04: "What else can an attacker do just by getting your page to load in the
> wrong context — without stealing anything?"**

The "wrong context" family:

| Attack | The wrong context | Defense |
|---|---|---|
| Clickjacking (topic 05) | your page in a transparent iframe on attacker's site | `frame-ancestors 'none'` (+ XFO) |
| Reverse tabnabbing | attacker's page opened *from* your `target="_blank"` link, holding `window.opener` | `rel="noopener noreferrer"` explicitly |
| Open redirect | your trusted URL that forwards anywhere | redirect only to allowlisted paths/hosts |
| `postMessage` injection | attacker's iframe/opener sending messages your handler trusts | check `event.origin` before acting |
| Login CSRF / cross-site cookie fixation | your login form submitted from attacker's page | same CSRF defenses as topic 03 |

> **03: "GET-that-mutates was a footgun. What other 'safe by convention'
> assumptions bite?"**

Table in section 5 of the lab: GET side effects, unvalidated uploads served
same-origin, verbose errors / public source maps, missing rate-limits, secrets
in the bundle, supply-chain. The pattern: **a convention the framework doesn't
enforce is a convention someone will break.**

---

## The demos

**1 · Open redirect** — `/redirect?to=<url>` blindly `res.redirect`s.
Verified: `?to=https://evil.example/login` → `302` to `evil.example`. The
phishing link shows *your* domain; users and mail filters trust it. Also used
to slip past OAuth `redirect_uri` allowlists.
`/safe-redirect` verified: external URL → bounced to `/`; `/dashboard` → allowed.
Fix: `to.startsWith('/') && !to.startsWith('//')`, or opaque-key→URL map, or
host allowlist.

**2 · Reverse tabnabbing** — a page opened via `target="_blank"` gets
`window.opener` and can do `window.opener.location = <phishing>`. Modern
browsers imply `noopener` for `target="_blank"` (Chrome 88+, FF 79+, Safari
12.1+), so it's *mostly* closed by default — but **set `rel="noopener
noreferrer"` explicitly**; old webviews and `window.open()` calls still leak.

**3 · `postMessage` without an origin check** — verified live:
the iframe (origin `localhost:8787`, not the SPA) posts
`{type:'SET_BALANCE', amount:0}`.
- handler checks `event.origin === location.origin` → message **logged, ignored**, balance stays **$1000**
- handler doesn't check → balance driven to **$0** by a foreign frame

Rule: **every `message` listener validates `event.origin` first**; every
`postMessage` *send* names an explicit target origin, never `'*'` for anything
sensitive.

**4 · Prototype pollution** — verified: a naive recursive `merge({}, JSON)`
with `{"__proto__":{"polluted":"yes"}}` makes `({}).polluted === "yes"` — every
object in the app now carries the key. Leads to DoS, auth/logic bypass,
sometimes RCE (SSR/Node). Fix: reject `__proto__`/`constructor`/`prototype`
keys, `Object.create(null)` or `Map` for lookup tables,
`Object.freeze(Object.prototype)`, vetted libs (lodash ≥ 4.17.21).

---

## Reference — the non-demo ones

| Issue | Fix |
|---|---|
| **Secrets in the bundle** — `import.meta.env.VITE_*` and any client-referenced value ship as plaintext | only publishable keys client-side; real secrets on server/BFF; CI grep for secret patterns |
| **Dependency / supply chain** — malicious/typo-squatted/compromised npm package | `npm audit`, `npm ci` from committed lockfile in CI, pin + Renovate/Dependabot, `--ignore-scripts`, SRI on CDN `<script>` |
| **GET mutates state** — `<img src="/logout">`, link prefetch fires it | only POST/PUT/PATCH/DELETE mutate |
| **Unvalidated upload** — user `x.svg`/`x.html` served from your origin → stored XSS | separate origin for user files, `Content-Disposition: attachment` + `nosniff`, validate type |
| **Verbose errors / prod source maps** | generic error pages; ship source maps to the error tracker only |
| **No rate limiting** — login/OTP/reset brute force, user enumeration | per-IP + per-account throttle, generic responses, lockout w/ backoff |

---

## Verified in this topic

- `npm run build` clean (276 kB).
- Open redirect: naive endpoint 302s to an arbitrary external URL;
  `/safe-redirect` rejects it and allows only relative paths.
- `postMessage`: cross-origin iframe message ignored with the origin check on,
  mutates app state ($1000 → $0) with it off.
- Prototype pollution: `({}).polluted` set via the vulnerable merge, cleaned up
  after.
- Fixed `/pm-frame` so the SPA can embed it (it was caught by the global
  `X-Frame-Options: DENY` from topic 05).

---

## Next questions this raises

**Every topic from 03 on ends with "set this header / cookie flag / CSP / CI
check". Where does all of that actually live for a Vite SPA going to
production?**
Topic **07 — production practices** (final): CSP with Vite (dev injects inline
scripts → prod needs nonces or hashes), setting security headers on real hosts
(Netlify `_headers`, Vercel `vercel.json`, nginx, Cloudflare Workers), the CSP
`report-to` pipeline and triaging its noise, CSRF middleware choice
(`csrf-csrf`, framework built-ins), `npm audit`/lockfile/`npm ci` in CI,
`import.meta.env` rules and a secret-scan step, and a single pre-ship checklist
that ties topics 1–6 together.

**"Separate origin for user uploads" and "BFF" both mean more infrastructure —
how does security scale with the app?**
Also topic 07: where responsibilities sit (edge / BFF / API / CI), and what the
minimum viable secure setup is versus what you add as you grow.
