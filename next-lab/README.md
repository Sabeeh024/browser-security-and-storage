# next-lab — Topic 08

The browser-security lessons (topics 1–7, Vite lab in the parent folder) mapped
onto **Next.js App Router**. See `../NOTES/08-nextjs-mapping.md`.

```bash
cd next-lab
cp .env.example .env.local
npm install
npm run dev            # http://localhost:3000
npm run build          # prod build — CSP tightens (no 'unsafe-eval')
```

| Route | Maps to | Shows |
|---|---|---|
| `/csrf` | topic 3 | Server Action (auto Origin check) vs Route Handler (none) |
| `/auth` | topic 4 | `cookies()` HttpOnly session read server-side; Next as BFF |
| `/rsc-leak` | topic 4/6 | a value passed as a prop to a Client Component ends up in the page source |
| `/env` | topic 6 | `NEXT_PUBLIC_` inlining vs server-only env |
| `/caching` | topic 7 | per-user response with `Cache-Control: public` → cross-user leak |
| `next.config.mjs` | topic 5/7 | static security headers, `poweredByHeader: false` |
| `proxy.js` | topic 3/5 | per-request CSP nonce + Origin check on `/api/*` mutations |
| `app/lib/*` + `import 'server-only'` | topic 6 | build fails if server code is pulled into the client |
