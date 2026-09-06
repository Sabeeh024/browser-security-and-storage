# 01 — Client-side storage: the five options and when each fits

An interactive lab with a live demo for every place a web app can keep data in
the browser. Lives on its own branch off the pristine scaffold.

| | branch |
|---|---|
| Storage lab | `topic/01-storage` |

```bash
git switch topic/01-storage
npm run dev            # sidebar → "1 · Client-side storage"
```

Open DevTools → **Application** while poking at each demo; every store updates
live there.

---

## The five stores

| Store | Size | Lifetime | API | JS-readable | Server sees it | Good for |
|---|---|---|---|---|---|---|
| `localStorage` | ~5 MB | forever (until cleared) | sync, strings | **yes** | no | UI prefs, non-sensitive cache |
| `sessionStorage` | ~5 MB | one tab | sync, strings | **yes** | no | one-tab flow / wizard state |
| Cookie (`HttpOnly`) | ~4 KB | server-set | — | **no** | yes, every request | session / auth token |
| Cookie (normal) | ~4 KB | server- or JS-set | `document.cookie` | yes | yes, every request | CSRF token, light prefs |
| IndexedDB | 100s MB | forever | **async**, structured | yes | no | offline data, large/media cache |
| In-memory (JS var / state) | RAM | until reload | sync | no\* | no | access tokens, secrets mid-session |

\* a *live* XSS script can still read your variables — see below.

---

## The one security idea that ties it together

**Anything JavaScript can read, an injected XSS script can read too.**

That covers `localStorage`, `sessionStorage`, IndexedDB, and any non-`HttpOnly`
cookie. The demo makes this concrete: set a `localStorage` value, then run
`localStorage.getItem('theme')` in the console — that single line *is* the token
-theft payload. Verified in the smoke test: the console call returned `"dark"`.

Only an **`HttpOnly` cookie** is invisible to `document.cookie` and to any
script on the page. That property — not encryption, not obscurity — is the
entire reason session tokens belong in one.

`HttpOnly` can't be demoed from the client; it only exists as a flag on a
server's `Set-Cookie` response header. That demo is deferred to topic 04.

---

## What each store is actually for

- **localStorage** — theme, language, "you've seen this banner", a cached list
  you can happily refetch. Synchronous, so a large `JSON.parse` on every load
  blocks paint. Never tokens, never PII.
- **sessionStorage** — same API, but dies with the tab and never shared between
  tabs. Good for "step 3 of 5" state that shouldn't leak into a second tab.
- **Cookies** — the only store the *server* sets and reads, and the browser
  attaches them to **every** matching request automatically. That automatic
  attachment is the convenience that makes them right for sessions and also the
  mechanism CSRF abuses (topic 03). Flags a server sets:
  - `HttpOnly` — no JS access (defeats XSS token theft)
  - `Secure` — HTTPS only
  - `SameSite=Lax|Strict|None` — ride along on cross-site requests? (CSRF lever)
  - `Domain` / `Path` — scope
  - `Max-Age` / `Expires` — session vs. persistent
- **IndexedDB** — the only option for real volume or offline. Async and
  transactional; the raw API is verbose enough that production code uses `idb`
  or Dexie. No security boundary vs. XSS.
- **In-memory** — write nothing to disk. Safe from *persisted* theft (a later
  XSS can't scrape what was never stored), safe from other origins. Cost: you
  re-acquire it on every reload, which is why it's paired with a silent-refresh
  call (topic 04).

---

## The real distinction

Two axes decide everything:

1. **Does JavaScript need to touch it?** If no (session token) → `HttpOnly`
   cookie. If yes → you're exposed to XSS and must prevent XSS (topic 02).
2. **Does it need to persist / how big / how long?** prefs → localStorage;
   one-tab → sessionStorage; large or offline → IndexedDB; only for this
   session → memory.

Client storage is **never a trust boundary** — the user can edit any of it in
DevTools. Every value that matters must be re-validated server-side.

---

## Verified in this topic

- `npm run build` clean (19 modules).
- Browser smoke test: app renders, `localStorage` setItem persists and is
  console-readable, no console errors.

---

## Next questions this raises

**"Where do I keep the JWT / session token?"**
The lab states the options (HttpOnly cookie, or in-memory + refresh) but doesn't
build either. Topic **04 — auth token storage** stands up a tiny backend and
implements both, including the access/refresh split and the BFF pattern.

**If XSS defeats every JS-readable store, how do I actually prevent XSS?**
Topic **02 — XSS**: React's auto-escaping, the `dangerouslySetInnerHTML` /
`innerHTML` holes, sanitisation (DOMPurify), and `Content-Security-Policy` as
defence-in-depth.

**Cookies get sent on every request automatically — isn't that dangerous?**
Yes, that's CSRF. Topic **03 — CSRF**: `SameSite`, synchronizer vs.
double-submit tokens, and `Origin`/`Referer` checks. Also explains why
token-in-header auth is largely CSRF-immune (and trades that for XSS exposure —
closing the loop with topic 02).

**How do I set these cookie flags and security headers in practice?**
Topic **05 — headers & CORS** covers the response-header side; topic
**07 — production practices** covers wiring them into the Vite build / host.
