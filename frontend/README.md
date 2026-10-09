# OmniDoc web

Next.js 16 frontend for OmniDoc RAG: a product site at `/` and the document workspace at `/app`. It talks to the FastAPI backend in `../backend` through `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`).

```bash
npm ci
npm run dev        # http://localhost:3000
npm run check      # typecheck, lint, unit tests, build, Playwright
```
