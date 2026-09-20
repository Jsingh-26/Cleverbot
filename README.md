# Cleverbot — AI Chat Assistant

A static web chat app that talks to free AI models on OpenRouter — through
Netlify serverless functions so the **API key never reaches the browser**.

## Architecture

```
browser ──GET  /api/models──▶ Netlify Function ──▶ OpenRouter /models (live availability)
browser ──POST /api/chat────▶ Netlify Function ──Bearer key──▶ OpenRouter /chat/completions
browser ◀────── SSE stream ────────────────────────────────
```

- The OpenRouter key is stored as the `OPENROUTER_API_KEY` environment
  variable in Netlify (never committed, never sent to the client).
- `netlify/functions/models.mjs` ranks the supported models by what OpenRouter
  reports as currently live, so the "best" model is re-evaluated on every
  page refresh.
- `netlify/functions/chat.mjs` validates requests (model allowlist, message
  shape, size limits) and streams the response back unchanged.

## Features

- **Best-available model selection**: on every page load the app queries live
  model availability and orders the fallback chain best-first.
- **Model fallback chain**: transient failures retry with exponential backoff;
  permanent failures fall back to the next model.
- **Streaming responses** rendered as sanitized markdown (marked + DOMPurify).
- **Conversation context**: recent history is sent with each request.
- **Syntax highlighting** in code blocks (highlight.js).
- **Light / dark / system themes**, persisted in localStorage.

## Security

- API key is server-side only (`netlify/functions/chat.mjs`).
- The function validates the model against an allowlist and caps payload
  size, so it can't be abused as an open OpenRouter proxy.
- Model output is sanitized with DOMPurify before it ever touches `innerHTML`.
- Content Security Policy with no `unsafe-inline` scripts (see `netlify.toml`).

## Setup

1. `npm install`
2. Get a key at [openrouter.ai/keys](https://openrouter.ai/keys).
3. Configure the key:
   - **Netlify**: Site settings → Environment variables → `OPENROUTER_API_KEY`
   - **Local dev**: create a `.env` file with `OPENROUTER_API_KEY=sk-or-...`
     (git-ignored; `netlify dev` loads it automatically)
4. `npm start` (runs `netlify dev`) → http://localhost:8888

Unit tests (no server needed): `npm test` — Node's built-in test runner.

## Deploying

Push to your repo and import the project in Netlify, or run `netlify deploy`.
There is no build step — the site is static; only the functions are bundled.

## Adding / ranking a model

1. Add its id to `SUPPORTED_MODELS` in `src/js/config.js`
   (order = preference = fallback priority).
2. Add the same entry to `SUPPORTED` in `netlify/functions/models.mjs` and to
   `ALLOWED_MODELS` in `netlify/functions/chat.mjs`.

At runtime the list is automatically filtered to models that are live on
OpenRouter, so stale entries are simply skipped.

## Project structure

```
index.html                     markup + CDN libraries (marked, hljs, DOMPurify)
src/
  css/styles.css               theme-aware styles
  js/main.js                   entry point (loads live model ranking)
  js/app.js                    send/fallback flow, chat history
  js/api.js                    fetch + SSE stream parsing
  js/ui.js                     rendering, sanitization, throttled streaming
  js/config.js                 model preference list (no secrets!)
  js/theme.js                  theme switcher
netlify/functions/chat.mjs     chat proxy (holds the API key)
netlify/functions/models.mjs   live model availability ranking
test/                          node:test suites
netlify.toml                   redirects, security headers, CSP
```

## License

MIT
