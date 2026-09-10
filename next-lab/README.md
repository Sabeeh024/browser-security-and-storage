# next-lab — Topic 08

Browser-security lessons (topics 1–7) on a **realistic split**: Next.js is the
**frontend + BFF** (SSR/CSR, proxy, session); the **Express bank API** from
topics 3–7 (`../server/index.js`, port 8787) is the **actual backend**.

```bash
# terminal 1 — the backend (repo root)
npm run server                       # Express API on :8787

# terminal 2 — the frontend
cd next-lab
cp .env.example .env.local
npm install
npm run dev                          # http://localhost:3000
```

| Route / file | Maps to | Shows |
|---|---|---|
| `/data-flow` | new | SSR (Server Component → Express) vs CSR (browser → Next → Express); browser can't reach Express |
| `/csrf` | topic 3 | Server Action (auto Origin check) vs Route Handler (proxy.js adds it); Next→Express not CSRF-able |
| `/auth` | topic 4 | Express issues the token, Next holds it in an HttpOnly cookie, browser never sees it (BFF, for real) |
| `/rsc-leak` | topic 4/6 | value passed as a prop to a Client Component ends up in the page source |
| `/env` | topic 6 | `NEXT_PUBLIC_` inlining vs `BACKEND_API_KEY` vs the token in the session cookie |
| `/caching` | topic 7 | per-user backend response with `Cache-Control: public` → cross-user leak |
| `next.config.mjs` | topic 5/7 | static security headers, `poweredByHeader: false` |
| `proxy.js` | topic 3/5 | per-request CSP nonce + Origin check on `/api/*` mutations |
| `app/lib/*.js` + `import 'server-only'` | topic 6 | build fails if backend/secret code is pulled into the client |

Two trust boundaries: **browser ↔ Next** (CSRF, XSS, cookies, CSP) and
**Next ↔ Express** (Bearer token + service key, backend re-validates; no CORS,
no CSRF — it's server-to-server).
