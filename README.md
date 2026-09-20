# Cleverbot — AI Chat Assistant

A Vite + React chat app that talks to free AI models on OpenRouter — through
**Netlify serverless functions** so the **API key never reaches the browser** —
with optional **Convex Auth (email/password or anonymous)** and **saved chat history** for signed-in users.

## Guest vs signed-in

| | Guest | Signed in (password or anonymous) |
|---|---|---|
| Chat via Netlify `/api/chat` (streaming) | Yes | Yes |
| Web search (OpenRouter `web` plugin) | Yes (server-side) | Yes (server-side) |
| Left sidebar history | CTA only — not persisted | Threads + messages in Convex |
| New chat | Clears local session | Clears selection; creates thread on first send |

**OpenRouter + web search stay on Netlify functions.** Do **not** put
`OPENROUTER_API_KEY` in Convex or any `VITE_*` client variable.

## Architecture

```
browser ── Convex Auth (password / anonymous) ──▶ Convex (*.convex.cloud / *.convex.site)
browser ──GET  /api/models──────▶ Netlify Function ──▶ OpenRouter /models
browser ──POST /api/chat────────▶ Netlify Function ──Bearer key──▶ OpenRouter
browser ◀────── SSE stream ──────────────────────────────────────
signed-in users also write threads/messages to Convex after each reply
```

## Features

- **Vite + React + TypeScript** SPA with theme toggle (light / dark / system)
- **Streaming markdown** chat (marked + DOMPurify + highlight.js)
- **On-demand HTML files** only when a user explicitly asks for an HTML file
- **Best-available free model** ranking via `/api/models`
- **Web search by default** in `netlify/functions/chat.mjs`
- **Convex** as auth + database (password + anonymous)
- Left **chat-history sidebar** for signed-in users

## Credentials still needed (checklist)

After merging / deploying this branch you must supply:

### 1. Convex project

1. Create a project at [dashboard.convex.dev](https://dashboard.convex.dev)
2. In this repo: `npx convex dev` (links the project, writes `.env.local` with `VITE_CONVEX_URL`, generates `_generated`)
3. Deploy backend: `npx convex deploy`

### 2. Convex dashboard env vars

| Variable | Where | Notes |
|---|---|---|
| `SITE_URL` | Convex env | Frontend origin, e.g. `https://cleverbot.netlify.app` |
| `JWT_PRIVATE_KEY` | Convex env | From `npx @convex-dev/auth` |
| `JWKS` | Convex env | Generated with the JWT key |

No Google/GitHub OAuth client is required. Sign-in is **email + password** or **Continue anonymously**.

### 3. Netlify / Vite env

| Variable | Where | Notes |
|---|---|---|
| `VITE_CONVEX_URL` | Netlify + local `.env.local` | `https://<deployment>.convex.cloud` |
| `OPENROUTER_API_KEY` | Netlify + local `.env` | Server-side only (`sk-or-...`) |

Copy `.env.example` → `.env.local` / `.env` and fill placeholders. **Never commit real secrets.**

## Local setup

```bash
npm install
cp .env.example .env.local   # add VITE_CONVEX_URL after convex dev
# OpenRouter for functions:
echo 'OPENROUTER_API_KEY=sk-or-...' > .env

npx convex dev               # terminal 1 — auth + DB
npm start                    # terminal 2 — netlify dev (Vite + /api/*)
# or: npm run dev            # Vite only (chat APIs need Netlify proxy)
```

Unit tests: `npm test`

Production build (dummy Convex URL is fine for compile):

```bash
VITE_CONVEX_URL=https://placeholder.convex.cloud npm run build
```

## Deploy

1. `npx convex deploy`
2. Set Netlify env: `VITE_CONVEX_URL`, `OPENROUTER_API_KEY`
3. Push / redeploy on Netlify (`npm run build` → `dist/`, functions unchanged)

## Project structure

```
index.html                 Vite HTML shell
src/
  main.tsx                 ConvexAuthProvider + app bootstrap
  App.tsx                  Sidebar + chat layout
  components/              Chat UI, auth button, theme toggle
  lib/api.ts               /api/chat SSE client (ported from vanilla)
  lib/config.ts            Model preference list (no secrets)
  css/styles.css
convex/
  schema.ts                authTables + threads + messages
  auth.ts                  Convex Auth + Google provider
  http.ts                  Auth HTTP routes
  threads.ts / messages.ts Auth-gated queries & mutations
  users.ts                 Current user (viewer)
netlify/functions/         OpenRouter proxy (key stays here)
test/                      node:test (+ tsx for TS libs)
```

## Security

- API key is server-side only (`netlify/functions/chat.mjs`)
- Model allowlist + payload size limits on the chat proxy
- Model output sanitized with DOMPurify before `innerHTML`
- CSP allows Convex (`*.convex.cloud`, `*.convex.site`) for auth/sync

## License

MIT
