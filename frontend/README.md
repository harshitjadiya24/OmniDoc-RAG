# OmniDoc web

The frontend of OmniDoc RAG: a product site at `/` and the document workspace at `/app`. It talks to the FastAPI backend in `../backend`.

```bash
npm ci
npm run dev        # http://localhost:3000 (start the backend on :8000 first)
npm run check      # typecheck, lint, unit tests, production build, Playwright
```

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend address, compiled into the bundle |
| `NEXT_PUBLIC_GITHUB_URL` | unset | Shows a GitHub link in the header and footer (http(s) only) |

The backend must allow the frontend origin (`CORS_ORIGINS`, default `localhost:3000`).

Playwright stubs the whole API with `page.route` (`tests/support/mock-api.ts`), so the suite needs no backend. It builds and serves its own production server on port 3200, so it never picks up a running `next dev`.

More: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (data flow, state, tests) and [docs/DESIGN.md](docs/DESIGN.md) (tokens, contrast, motion).
