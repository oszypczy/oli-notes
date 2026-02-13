# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

Monorepo with two services:
- `frontend/` — React SPA (PDF notes viewer)
- `backend/` — Express auth/admin server (USOS OAuth, JWT sessions, admin panel)

Shared infra at root: `nginx.conf`, `docker-compose.yml`, `.github/workflows/deploy.yml`.

## Build & Development Commands

### Frontend
```bash
cd frontend && npm run dev        # Vite dev server with HMR (auto-skips USOS login)
cd frontend && npm run build      # tsc -b && vite build
cd frontend && npm run lint       # ESLint (flat config, ESLint 9+)
```

### Backend
```bash
cd backend && npm run dev         # tsx watch src/index.ts
cd backend && npm run build       # tsc
cd backend && npm run start       # node dist/index.js
```

### Docker (production-like)
```bash
docker compose up                 # Both services on internal network, nginx on port 3001
```

## Architecture

### Frontend (React 19 + TypeScript + Vite)
- PDF notes viewer for WEiTI students (Polish-language UI, dark theme)
- `useAuth` hook handles auth state; in `DEV` mode (`import.meta.env.DEV`) skips USOS login with mock user
- `usePdfTree` fetches `/pdfs/tree.json` for folder/file hierarchy
- `useFilteredTree` provides recursive memo-based search filtering
- CSS Modules per component, global `--color-*` tokens in `index.css`
- Header shows admin button for users with `isAdmin` flag

### Backend (Express 5 + TypeScript)
- **Auth** (`src/auth/`): USOS OAuth 1.0a flow, JWT HS256 sessions in httpOnly cookies
  - `usos.ts` — OAuth token exchange + user data fetch (with `AbortSignal.timeout(10s)`)
  - `jwt.ts` — sign/verify with `TokenPayload { usosId, name, email, isAdmin }`
  - `routes.ts` — `/auth/login`, `/auth/callback`, `/auth/verify` (nginx subrequest), `/auth/logout`, `/api/auth/me`
  - Faculty check: only WEiTI students (faculty ID `103000`) can log in
  - `isAdmin` flag set for USOS IDs listed in `ADMIN_IDS` env var
- **Admin** (`src/admin/`): monitoring dashboard at `/admin`
  - `logger.ts` — `EventLogger` class with ring buffer (500 events, ~150KB RAM). Events: `login_success`, `login_denied_faculty`, `logout`, `resource_access`, `error`. Persists to `/app/data/events.json` every 60s + on SIGTERM/SIGINT
  - `routes.ts` — JWT + `isAdmin` middleware, endpoints: `/api/admin/events`, `/api/admin/stats`, `/api/admin/activity`
  - `panel.ts` — inline HTML/JS served from Express (dark theme, SVG chart, event table, auto-refresh 30s). CSP-safe (no inline scripts, JS served from `/admin/app.js`)
- **Config** (`src/config.ts`): all env vars validated at startup, JWT secret min 32 chars

### Nginx (reverse proxy)
- Serves frontend static files, proxies `/auth/`, `/api/`, `/admin/` to backend
- `auth_request` subrequests protect `/pdfs/` — backend verifies JWT cookie
- `X-Original-URI` header passes request path to backend for resource access logging (cleared in `/auth/` block to prevent spoofing)
- Rate limit zones: `pdf_limit` (10r/s), `general_limit` (30r/s), `auth_limit` (5r/s), `admin_limit` (5r/s)
- Security headers: CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy

### Docker Compose
- `notes` service: nginx + frontend static files, volume mount for PDFs
- `auth` service: backend, `env_file: .env`, volume mount for event persistence (`~/data/notes/logs:/app/data`)
- Networks: `internal` (bridge between services), `proxy` (external, for Caddy)

## Deployment

GitHub Actions on push to `main`:
1. Builds two Docker images (frontend+nginx, backend auth)
2. Pushes to GHCR (`ghcr.io/oszypczy/notes:latest`, `ghcr.io/oszypczy/notes-auth:latest`)
3. SSHs to server, pulls images, writes `docker-compose.yml`, runs `docker compose up -d --force-recreate`

Server: Oracle Cloud Free Tier, Oracle Linux 9. Caddy as TLS-terminating reverse proxy in front of nginx. Cloudflare DNS proxy with Full Strict SSL.

### Required secrets (GitHub Actions)
`SSH_PRIVATE_KEY`, `SERVER_HOST`, `SERVER_USER`, `GHCR_TOKEN`

### Required env vars (server `.env`)
`USOS_CONSUMER_KEY`, `USOS_CONSUMER_SECRET`, `JWT_SECRET` (min 32 chars), `CALLBACK_URL`, `FRONTEND_URL`, `COOKIE_DOMAIN`, `ADMIN_IDS` (comma-separated USOS IDs)

## PDF Management

PDFs are stored on the server at `~/data/notes/pdfs/`, mounted into the nginx container. Not in the repo.

```bash
scp -i ~/.ssh/oracle_cloud notatki.pdf opc@SERVER:~/data/notes/pdfs/semestr/
ssh -i ~/.ssh/oracle_cloud opc@SERVER 'bash ~/scripts/generate-tree.sh'
```

For local dev: put PDFs in `frontend/public/pdfs/` (gitignored) and run `bash scripts/generate-tree.sh ./frontend/public/pdfs`.

## Security Notes

- `.env` files gitignored; secrets only in GitHub Actions secrets and server `.env`
- Source maps disabled in production (`tsconfig.json`)
- Backend runs as non-root `app` user in Docker
- All USOS API calls have 10s timeout
- Express global rate limit: 100 req/15min (admin paths exempted)
- Admin paths have separate rate limit: 30 req/15min (Express) + nginx zones
- XSS prevention: `esc()` function in admin panel, CSP headers
- X-Original-URI spoofing prevented by clearing header in `/auth/` nginx block
