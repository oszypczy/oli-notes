# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

Monorepo with `frontend/` (React SPA) and shared infra at root (nginx, Docker, CI/CD). Backend auth service planned but not yet implemented.

## Build & Development Commands

```bash
cd frontend && npm run dev        # Start Vite dev server with HMR
cd frontend && npm run build      # TypeScript check + Vite production build (tsc -b && vite build)
cd frontend && npm run lint       # ESLint (flat config, ESLint 9+)
cd frontend && npm run preview    # Preview production build locally
```

Docker: `docker compose up` serves the app on port 3001 via nginx. PDFs are mounted from host via volume.

## Architecture

React 19 + TypeScript + Vite SPA that serves as a PDF notes viewer for university study materials. Polish-language UI.

### PDF Data Flow

PDFs are **not stored in the repo** - they live on the server at `~/data/notes/pdfs/` and are mounted into the Docker container as a volume at `/usr/share/nginx/html/pdfs`.

A shell script (`scripts/generate-tree.sh`) scans the PDF directory and generates `tree.json` describing the folder/file hierarchy. The React app fetches `/pdfs/tree.json` at runtime via the `usePdfTree` hook (`frontend/src/hooks/usePdfTree.ts`).

For local development: put PDFs in `frontend/public/pdfs/` (gitignored) and run `bash scripts/generate-tree.sh ./frontend/public/pdfs`.

### Component Structure

`frontend/src/App.tsx` holds top-level state (`selectedPdf`, `searchQuery`) and fetches the tree via `usePdfTree` hook. Layout is Header + Sidebar + PdfViewer.

- **Sidebar** contains SearchBar + TreeView, handles loading/error states
- **TreeView** uses the `useFilteredTree` hook (recursive memo-based filtering) and renders recursive **TreeNode** components
- **PdfViewer** displays PDFs via `<object>` tag with download fallback
- **icons.tsx** has all SVG icon components

### Type System

`frontend/src/types.ts` defines `PdfFile`, `PdfFolder`, and `TreeNode` (discriminated union on `type` field: `'file' | 'folder'`).

### Styling

CSS Modules per component. Global CSS variables in `frontend/src/index.css` define a dark theme with `--color-*` tokens. Sidebar width is 320px, header height is 64px.

## Deployment

Multi-stage Docker build (node:20-alpine -> nginx:alpine). The Dockerfile is at `frontend/Dockerfile` but uses the repo root as build context (so it can access `nginx.conf`). GitHub Actions on push to main builds and pushes to GHCR (`ghcr.io/oszypczy/notes:latest`), then SSHs to remote server to pull and restart via docker-compose. PDFs are served from a Docker volume mount, not baked into the image. Nginx config handles SPA routing and sets `Content-Disposition: inline` for PDFs.

Server: Oracle Cloud Free Tier (130.61.246.215), Oracle Linux 9.
