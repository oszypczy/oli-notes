# OliNotes

Przeglądarka notatek PDF ze studiów na Wydziale Elektroniki i Technik Informacyjnych Politechniki Warszawskiej. Dostęp tylko dla studentów WEiTI, uwierzytelnianie przez USOS.

**https://notes.oszypczyn.com**

## Stack technologiczny

- **Frontend:** React 19 + TypeScript + Vite (CSS Modules, ciemny motyw)
- **Backend:** Express 5 + TypeScript (OAuth 1.0a, JWT, admin panel)
- **Nginx** (reverse proxy, auth subrequests, rate limiting)
- **Docker** (multi-stage builds, docker-compose)
- **GitHub Actions** (CI/CD)
- **Serwer:** Caddy (TLS) + Cloudflare DNS

## Architektura

```
Cloudflare → Caddy (TLS) → Nginx (port 80)
                              ├─ /           → pliki statyczne (React SPA)
                              ├─ /pdfs/      → pliki PDF (auth_request → backend)
                              ├─ /auth/      → proxy → backend (OAuth flow)
                              ├─ /api/       → proxy → backend (REST API)
                              └─ /admin      → proxy → backend (panel admina)
```

**Frontend** to SPA serwujące hierarchię PDF-ów w formie drzewa z wyszukiwaniem. Dane o plikach pochodzą z `tree.json` generowanego skryptem na serwerze.

**Backend** obsługuje uwierzytelnianie USOS OAuth 1.0a, weryfikację sesji JWT (httpOnly cookie), kontrolę dostępu (tylko wydział WEiTI) oraz panel administracyjny z monitoringiem.

## Uruchomienie lokalne

### Frontend
```bash
cd frontend
npm install
npm run dev
```
W trybie `dev` logowanie USOS jest pomijane (mock user).

PDFy nie są trzymane w repo. Wrzuć pliki do `public/pdfs/` i wygeneruj `tree.json`:
```bash
bash scripts/generate-tree.sh ./frontend/public/pdfs
```

### Backend
```bash
cd backend
npm install
cp .env.example .env  # uzupełnij zmienne
npm run dev
```

### Docker (produkcyjnie)
```bash
docker compose up
```
Aplikacja na porcie `3001`. PDFy montowane z hosta przez Docker volume.

## Zmienne środowiskowe (backend)

| Zmienna | Wymagana | Opis |
|---------|----------|------|
| `USOS_CONSUMER_KEY` | tak | Klucz OAuth USOS |
| `USOS_CONSUMER_SECRET` | tak | Sekret OAuth USOS |
| `JWT_SECRET` | tak | Min. 32 znaki |
| `CALLBACK_URL` | tak | URL callbacka OAuth (np. `https://notes.example.com/auth/callback`) |
| `FRONTEND_URL` | tak | URL frontendu (np. `https://notes.example.com`) |
| `COOKIE_DOMAIN` | nie | Domena cookie sesji |
| `ADMIN_IDS` | nie | USOS ID adminów, oddzielone przecinkiem |
| `ALLOWED_FACULTY_ID` | nie | ID wydziału (domyslnie `103000` — WEiTI) |
| `PORT` | nie | Port backendu (domyslnie `3000`) |

## Deployment

Push na branch `main` uruchamia GitHub Actions workflow:

1. Buduje dwa obrazy Docker (frontend+nginx, backend auth)
2. Publikuje je w GHCR (`ghcr.io/oszypczy/notes:latest`, `ghcr.io/oszypczy/notes-auth:latest`)
3. Łączy się po SSH z serwerem i restartuje kontenery

Wymagane sekrety w repozytorium: `SSH_PRIVATE_KEY`, `SERVER_HOST`, `SERVER_USER`, `GHCR_TOKEN`.

## Zarządzanie PDFami na serwerze

PDFy są przechowywane na serwerze w `~/data/notes/pdfs/`, montowane do kontenera jako volume.

```bash
# Prześlij nowe PDFy
scp notatki.pdf SERVER:~/data/notes/pdfs/semestr/

# Wygeneruj tree.json
ssh SERVER 'bash ~/scripts/generate-tree.sh'
```

Strona od razu widzi nowe pliki (bez rebuilda).

## Panel admina

Dostępny pod `/admin` dla użytkowników z USOS ID w `ADMIN_IDS`. Zawiera:
- Statystyki (logowania, dostęp do zasobów, odmowy, błędy)
- Wykres aktywności użytkowników (ostatnie 6h)
- Tabela zdarzeń z filtrami i paginacją
- Auto-refresh co 30s

Dane monitoringu przechowywane w ring bufferze (500 zdarzeń, ~150KB RAM) z persystencją na dysk.

## Bezpieczeństwo

- Uwierzytelnianie USOS OAuth 1.0a + sesje JWT (HS256, httpOnly cookie)
- Kontrola dostępu na poziomie wydziału (tylko WEiTI)
- Rate limiting: nginx (4 zony) + Express (global + admin)
- CSP, HSTS, X-Content-Type-Options, X-Frame-Options
- Backend jako non-root user w Docker
- Brak source maps w produkcji
- `.env` w `.gitignore`
