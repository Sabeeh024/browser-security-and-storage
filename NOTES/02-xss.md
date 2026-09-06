# 02 — XSS (Cross-Site Scripting)

Interactive lab: six demos, each an escaping path or a way you opt out of it.
Builds directly on the storage lab.

| | branch |
|---|---|
| XSS lab | `topic/02-xss` (chained off `topic/01-storage`) |

```bash
git switch topic/02-xss
npm run dev           # sidebar → "2 · XSS"
```

Set `token = secret123` in the Lesson 1 localStorage demo first — the payloads
here read it back, which is the concrete link to topic 01.

---

## What XSS actually is

Attacker gets **their** JavaScript to execute in **your** page's origin. Once it
runs it has everything the page has: `localStorage`, non-`HttpOnly` cookies, the
DOM, the user's live session, the ability to fetch as the user. One XSS bug =
full client-side compromise for that user.

Three **delivery routes** (same payload, different arrival):

| Route | Payload lives in | Example |
|---|---|---|
| **Reflected** | the request itself | `?q=<script>…</script>` echoed into the page unescaped |
| **Stored** | server-side storage | a comment / profile bio saved raw, served to every visitor |
| **DOM-based** | never hits the server | `el.innerHTML = location.hash.slice(1)` |

The defence is one idea in every case: **treat data as data, never as
markup/code.**

---

## The demos and what each proves

**1. React escapes `{expressions}` — ✅**
`{value}` in JSX is inserted as text. `<img onerror=…>` renders as literal
characters. This single behaviour is why "React is XSS-safe by default" — but
*only* on this path.

**2. `dangerouslySetInnerHTML` — ❌ the #1 React XSS hole**
Takes your string, sets `.innerHTML`. The `<img src=x onerror=…>` fires.
Note: a bare `<script>` inserted via innerHTML does **not** execute — attackers
use event-handler attributes (`onerror`, `onload`) or `javascript:` URLs.
String usually comes from: CMS field, "rich" comment, markdown→HTML, a
third-party API.

**3. DOM sinks — `el.innerHTML =` ❌ vs `.textContent =` ✅**
DOM-based XSS. Sinks to know: `innerHTML`, `outerHTML`, `insertAdjacentHTML`,
`document.write`, `eval`, `new Function`, `setAttribute` on event handlers.
Sources: `location.hash`/`.search`, `postMessage`, `window.name`, a fetch body.
`.textContent` / `.setAttribute('class', …)` are the safe equivalents.

**4. `javascript:` URLs in `href`/`src`**
React only *warns* on `href="javascript:…"` — it still renders it. Validate the
scheme yourself: allowlist `https?:`, `mailto:`, relative (`/`, `#`). The demo
disables the link when the scheme fails the regex.

**5. DOMPurify — ✅ when you genuinely must render user HTML**
`DOMPurify.sanitize(dirty)` — verified in the smoke test: input
`<p><b>…</b> <a href="https://…">…</a></p><img onerror=…><script>…</script>`
came out as `<p><b>…</b> <a href="https://example.com">…</a></p><img src="x">` —
safe tags kept, `onerror` and `<script>` stripped. Run it **every render**, at
the point the string becomes DOM. Then pair with `dangerouslySetInnerHTML`.

**6. Content-Security-Policy — defence in depth**
Browser-enforced allowlist. Even if a payload lands in the DOM, a strict
`script-src 'self'` blocks inline handlers and unknown origins from running.
Starting policy in the lab; wiring a strict one (nonces/hashes, Vite injects
inline scripts in dev) is deferred to topic 07.

---

## The mental model

```
user input ──► [ is it going to become HTML/DOM/URL/JS? ]
                    │ no  → interpolate ({value}, .textContent). Done.
                    │ yes → do you control/trust it?
                              │ yes → still encode for the context
                              │ no  → sanitise (DOMPurify) OR reject
                                       + CSP as the net underneath
```

Output encoding is **context-sensitive**: HTML body, HTML attribute, URL,
JS string, CSS each need different escaping. Frameworks and sanitisers handle
this; hand-rolled `.replace('<','&lt;')` does not.

---

## Verified in this topic

- `npm run build` clean (dompurify added, 237 kB bundle).
- Browser smoke test: Lesson 2 renders, DOMPurify strips `<script>`/`onerror`
  and keeps safe tags, no console errors.

---

## Next questions this raises

**If a session token can't safely live anywhere JS can read, where does it go?**
Topic **04 — auth token storage**: `HttpOnly` cookie vs. in-memory+refresh vs.
BFF, with a real backend.

**XSS steals cookies too — unless they're `HttpOnly`. But `HttpOnly` cookies
get auto-sent on every request, including cross-site ones. Isn't that a
different hole?**
Yes — CSRF. Topic **03 — CSRF**: `SameSite`, CSRF tokens, `Origin` checks, and
the XSS-vs-CSRF trade-off between cookie auth and header-token auth.

**How do I actually ship a strict CSP with Vite without breaking the build?**
Topic **07 — production practices**: nonce/hash injection, `connect-src` for
your API, report-only rollout.

**Server-side rendering / dangerouslySetInnerHTML for markdown — where should
sanitisation run, client or server?**
Rule from this lab: at the point the string becomes DOM. For SSR that means
sanitise before serializing to HTML *and* trust nothing on hydration. Revisited
lightly in topic 06.
