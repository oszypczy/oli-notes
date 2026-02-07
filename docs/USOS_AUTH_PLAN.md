# Plan implementacji USOS OAuth dla OliNotes

## Spis treści

1. [Przegląd](#1-przegląd)
2. [Architektura docelowa](#2-architektura-docelowa)
3. [Struktura projektu (monorepo)](#3-struktura-projektu-monorepo)
4. [Rejestracja aplikacji w USOS API](#4-rejestracja-aplikacji-w-usos-api)
5. [Backend - serwer auth](#5-backend---serwer-auth)
6. [Nginx - ochrona zasobów](#6-nginx---ochrona-zasobów)
7. [Frontend - zmiany w React](#7-frontend---zmiany-w-react)
8. [Docker - konfiguracja](#8-docker---konfiguracja)
9. [GitHub Actions - deployment](#9-github-actions---deployment)
10. [Zmienne środowiskowe i sekrety](#10-zmienne-środowiskowe-i-sekrety)
11. [Bezpieczeństwo - analiza i hardening](#11-bezpieczeństwo---analiza-i-hardening)
12. [Kolejność implementacji](#12-kolejność-implementacji)

---

## 1. Przegląd

### Cel

Zabezpieczyć dostęp do OliNotes tak, aby tylko osoby z kontem USOS Politechniki Warszawskiej mogły przeglądać notatki.

### Obecny stan

- SPA (React + Vite) serwowane przez nginx
- Brak backendu - aplikacja jest w 100% statyczna
- PDFy serwowane bezpośrednio przez nginx z volume mount
- Deploy przez GitHub Actions na Oracle Cloud (130.61.246.215)

### Co trzeba dodać

- **Backend Node.js** obsługujący OAuth 1.0a z USOS API
- **Ochronę nginx** dla `/pdfs/` - tylko zalogowani użytkownicy
- **Ekran logowania** w React
- **Dodatkowy serwis Docker** dla backendu

### Ograniczenia serwera (Oracle Cloud Free Tier)

Serwer ma **bardzo mało RAM** - to darmowa instancja Oracle Cloud:
- **503 MB RAM total**, ~218 MB available (stan na luty 2026)
- 2 vCPU x86_64
- 2.5 GB swap (mało użyty)
- Obecne zużycie: dockerd ~54 MB, Caddy ~12 MB, notes (nginx) ~1.3 MB, systemowe ~100 MB

Backend auth (Express + Node.js) powinien zająć **~30-50 MB RAM**. To się zmieści, ale marginesu nie ma dużo. Jeśli po deployu pojawią się problemy z OOM-killerem, crashami kontenerów, lub ogólną niestabilnością — **przyczyną prawdopodobnie jest brak RAM**. W takiej sytuacji patrz: sekcja 8 → "Ograniczenia pamięci".

### Dlaczego potrzebny backend?

USOS API używa **OAuth 1.0a**, który wymaga:
- Podpisywania requestów kluczem `consumer_secret` (HMAC-SHA1)
- Server-to-server komunikacji (request token, access token)
- Przechowywania sekretów po stronie serwera

Nie da się tego bezpiecznie zrobić w przeglądarce.

---

## 2. Architektura docelowa

```
                    ┌──────────────────────────────────────────────┐
                    │              nginx (port 80)                  │
                    │                                              │
Przeglądarka ──────┤  /            → static React SPA             │
                    │  /pdfs/*     → auth_request → static PDFs   │
                    │  /auth/*     → proxy_pass → backend:3000    │
                    │  /api/*      → proxy_pass → backend:3000    │
                    └──────────────────────────────────────────────┘
                                        │
                                        ▼
                              ┌──────────────────┐
                              │  Backend (:3000)  │
                              │  Node.js/Express  │
                              │                   │
                              │  /auth/login      │──── OAuth 1.0a ────▶ USOS API
                              │  /auth/callback   │◀─── callback ──────  (apps.usos.pw.edu.pl)
                              │  /api/auth/me     │
                              │  /auth/logout     │
                              │  /auth/verify     │ ◀── nginx auth_request (internal)
                              └──────────────────┘
```

### Flow logowania (krok po kroku)

```
1.  User wchodzi na stronę
2.  React sprawdza GET /api/auth/me
3.  Brak sesji → wyświetla ekran logowania
4.  User klika "Zaloguj przez USOS"
5.  GET /auth/login → backend generuje losowy state, zapisuje w cookie
6.  Backend pobiera request_token z USOS, zapamiętuje token_secret
7.  Redirect → https://apps.usos.pw.edu.pl/services/oauth/authorize?oauth_token=...
8.  User loguje się na stronie USOS i autoryzuje aplikację
9.  USOS redirectuje na /auth/callback?oauth_token=...&oauth_verifier=...
10. Backend weryfikuje state cookie (CSRF protection)
11. Backend wymienia tokeny na access_token
12. Backend pobiera dane usera z USOS API
13. Backend tworzy sesję (JWT w httpOnly cookie)
14. Redirect → / (strona główna)
15. React ponownie sprawdza /api/auth/me → zalogowany → widzi notatki
```

### Ochrona PDFów

```
1. Przeglądarka żąda GET /pdfs/jakis-plik.pdf
2. Nginx wysyła internal subrequest: GET /auth/verify
3. Backend sprawdza cookie JWT
4. JWT OK → nginx serwuje PDF (200)
5. JWT brak/nieważny → nginx zwraca 401
```

---

## 3. Struktura projektu (monorepo)

### Obecna struktura

```
notes/
├── src/           ← React app
├── public/
├── Dockerfile
├── nginx.conf
├── package.json
├── vite.config.ts
└── ...
```

### Docelowa struktura

Rozdzielenie na `frontend/` i `backend/` żeby nie mieszać dwóch projektów:

```
notes/
├── frontend/                      ← przeniesiony React app
│   ├── src/
│   │   ├── components/
│   │   │   ├── EmptyState/
│   │   │   ├── Header/
│   │   │   ├── LoginScreen/       ← NOWY
│   │   │   ├── PdfViewer/
│   │   │   ├── SearchBar/
│   │   │   ├── Sidebar/
│   │   │   ├── TreeNode/
│   │   │   ├── TreeView/
│   │   │   └── icons.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts         ← NOWY
│   │   │   ├── useFilteredTree.ts
│   │   │   └── usePdfTree.ts
│   │   ├── types.ts
│   │   ├── App.tsx                ← ZMIENIONY
│   │   ├── App.module.css
│   │   ├── main.tsx
│   │   └── index.css
│   ├── public/
│   │   └── favicon.ico
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   ├── eslint.config.js
│   ├── index.html
│   └── Dockerfile
│
├── backend/                       ← NOWY
│   ├── src/
│   │   ├── index.ts
│   │   ├── config.ts
│   │   └── auth/
│   │       ├── routes.ts
│   │       ├── usos.ts
│   │       └── jwt.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── nginx.conf                     ← ZMIENIONY (zostaje w root)
├── docker-compose.yml             ← ZMIENIONY (zostaje w root)
├── scripts/
│   └── generate-tree.sh
├── .github/workflows/deploy.yml   ← ZMIENIONY
├── CLAUDE.md
├── docs/
│   └── USOS_AUTH_PLAN.md
└── README.md
```

### Migracja - co przenieść

Pliki do przeniesienia z root → `frontend/`:

```bash
# Nowy katalog
mkdir frontend

# Przeniesienie kodu React
mv src/ frontend/
mv public/ frontend/
mv index.html frontend/
mv package.json frontend/
mv package-lock.json frontend/
mv tsconfig.json frontend/
mv tsconfig.app.json frontend/
mv tsconfig.node.json frontend/
mv vite.config.ts frontend/
mv eslint.config.js frontend/

# Dockerfile frontendu (stary Dockerfile, zmodyfikowany)
mv Dockerfile frontend/Dockerfile
```

Pliki, które zostają w root (dotyczą całego projektu):

```
nginx.conf, docker-compose.yml, .github/, scripts/, CLAUDE.md, README.md, docs/
```

### Aktualizacja CLAUDE.md

Po migracji trzeba zaktualizować komendy:
```bash
cd frontend && npm run dev       # Start Vite dev server
cd frontend && npm run build     # Production build
cd frontend && npm run lint      # ESLint
cd backend && npm run dev        # Start auth server (dev)
```

---

## 4. Rejestracja aplikacji w USOS API

### Gdzie zarejestrować

Portal deweloperski USOS PW: **https://apps.usos.pw.edu.pl/developers/**

### Procedura

1. Zaloguj się na https://apps.usos.pw.edu.pl/developers/ swoim kontem USOS PW
2. Kliknij "Dodaj nową aplikację"
3. Wypełnij formularz:
   - **Nazwa aplikacji**: `OliNotes`
   - **URL aplikacji**: `https://notes.twoja-domena.pl` (lub adres IP)
   - **Callback URL**: `https://notes.twoja-domena.pl/auth/callback`
   - **Opis**: Przeglądarka notatek studenckich
   - **Wymagane scopy**: `studies|email` (minimalny zakres)
4. Po zatwierdzeniu otrzymasz:
   - `USOS_CONSUMER_KEY`
   - `USOS_CONSUMER_SECRET`

### Ważne

- Rejestracja jest natychmiastowa (nie wymaga akceptacji admina)
- Consumer secret NIGDY nie może trafić do kodu frontendowego ani do repo
- Scopy można rozszerzyć później jeśli potrzeba

---

## 5. Backend - serwer auth

### Dependencje (backend/package.json)

```json
{
  "name": "notes-auth",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^5.1.0",
    "oauth-1.0a": "^2.2.6",
    "jsonwebtoken": "^9.0.2",
    "cookie-parser": "^1.4.7",
    "helmet": "^8.1.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.9",
    "@types/cookie-parser": "^1.4.8",
    "typescript": "~5.9.3",
    "tsx": "^4.19.0"
  }
}
```

Zmiany vs pierwotny plan:
- `oauth` → **`oauth-1.0a`** (aktywnie utrzymywany, nie martwy projekt)
- Dodany **`helmet`** (security headers)

### Konfiguracja (backend/src/config.ts)

```typescript
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

export const config = {
  usosBaseUrl: process.env.USOS_BASE_URL || 'https://apps.usos.pw.edu.pl',
  consumerKey: requireEnv('USOS_CONSUMER_KEY'),
  consumerSecret: requireEnv('USOS_CONSUMER_SECRET'),

  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: '24h',   // <-- zmiana: 24h zamiast 7d (kompromis bezpieczeństwo/UX)

  callbackUrl: requireEnv('CALLBACK_URL'),
  frontendUrl: requireEnv('FRONTEND_URL'),
  port: parseInt(process.env.PORT || '3000'),
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  isProduction: process.env.NODE_ENV === 'production',
};
```

Zmiany vs pierwotny plan:
- `requireEnv()` zamiast `!` - fail-fast przy starcie jeśli brakuje zmiennych
- JWT ważny **24h** zamiast 7 dni - mniejsze okno ataku przy kradzieży tokena

### Komunikacja z USOS (backend/src/auth/usos.ts)

```typescript
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';
import { config } from '../config.js';

const oauth = new OAuth({
  consumer: {
    key: config.consumerKey,
    secret: config.consumerSecret,
  },
  signature_method: 'HMAC-SHA1',
  hash_function(baseString, key) {
    return crypto.createHmac('sha1', key).update(baseString).digest('base64');
  },
});

// --- Pending tokens z limitem rozmiaru ---
const MAX_PENDING = 1000;
const pendingTokens = new Map<string, { secret: string; state: string; expires: number }>();

function cleanExpired() {
  const now = Date.now();
  for (const [key, val] of pendingTokens) {
    if (val.expires < now) pendingTokens.delete(key);
  }
}

// --- Request Token ---
export async function getRequestToken(state: string): Promise<{ token: string; authorizeUrl: string }> {
  cleanExpired();
  if (pendingTokens.size >= MAX_PENDING) {
    throw new Error('Too many pending auth requests');
  }

  const requestTokenUrl = `${config.usosBaseUrl}/services/oauth/request_token`;

  const requestData = {
    url: requestTokenUrl,
    method: 'POST',
    data: { oauth_callback: config.callbackUrl, scopes: 'studies|email' },
  };

  const response = await fetch(requestTokenUrl, {
    method: 'POST',
    headers: {
      ...oauth.toHeader(oauth.authorize(requestData)),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ oauth_callback: config.callbackUrl, scopes: 'studies|email' }),
  });

  if (!response.ok) throw new Error(`USOS request_token failed: ${response.status}`);

  const text = await response.text();
  const params = new URLSearchParams(text);
  const token = params.get('oauth_token')!;
  const tokenSecret = params.get('oauth_token_secret')!;

  pendingTokens.set(token, {
    secret: tokenSecret,
    state,
    expires: Date.now() + 5 * 60 * 1000, // 5 min
  });

  return {
    token,
    authorizeUrl: `${config.usosBaseUrl}/services/oauth/authorize?oauth_token=${token}`,
  };
}

// --- Access Token ---
export async function getAccessToken(
  oauthToken: string,
  oauthVerifier: string,
  expectedState: string
): Promise<{ accessToken: string; accessSecret: string }> {
  const pending = pendingTokens.get(oauthToken);
  if (!pending) throw new Error('Invalid or expired request token');
  if (pending.state !== expectedState) throw new Error('State mismatch (CSRF)');
  if (pending.expires < Date.now()) {
    pendingTokens.delete(oauthToken);
    throw new Error('Request token expired');
  }
  pendingTokens.delete(oauthToken);

  const accessTokenUrl = `${config.usosBaseUrl}/services/oauth/access_token`;
  const tokenData = { key: oauthToken, secret: pending.secret };

  const requestData = {
    url: accessTokenUrl,
    method: 'POST',
    data: { oauth_verifier: oauthVerifier },
  };

  const response = await fetch(accessTokenUrl, {
    method: 'POST',
    headers: {
      ...oauth.toHeader(oauth.authorize(requestData, tokenData)),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ oauth_verifier: oauthVerifier }),
  });

  if (!response.ok) throw new Error(`USOS access_token failed: ${response.status}`);

  const text = await response.text();
  const params = new URLSearchParams(text);

  return {
    accessToken: params.get('oauth_token')!,
    accessSecret: params.get('oauth_token_secret')!,
  };
}

// --- User info ---
export async function getUser(
  accessToken: string,
  accessSecret: string
): Promise<{ id: string; first_name: string; last_name: string; email: string }> {
  const userUrl = `${config.usosBaseUrl}/services/users/user?fields=id|first_name|last_name|email`;
  const tokenData = { key: accessToken, secret: accessSecret };

  const requestData = { url: userUrl, method: 'GET' };

  const response = await fetch(userUrl, {
    headers: oauth.toHeader(oauth.authorize(requestData, tokenData)),
  });

  if (!response.ok) throw new Error(`USOS user fetch failed: ${response.status}`);
  return response.json();
}
```

Zmiany vs pierwotny plan:
- `oauth-1.0a` zamiast `oauth` (nowoczesna biblioteka, `fetch` zamiast callbacków)
- **Limit 1000 pending tokenów** - ochrona przed DoS
- **Automatyczne czyszczenie** wygasłych tokenów
- **Weryfikacja `state`** - ochrona przed login CSRF

### JWT (backend/src/auth/jwt.ts)

```typescript
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface TokenPayload {
  usosId: string;
  name: string;
  email: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
    algorithm: 'HS256',       // jawnie określony algorytm
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],  // akceptuj TYLKO HS256 (blokuje "none" attack)
    }) as TokenPayload;
  } catch {
    return null;
  }
}
```

Zmiany vs pierwotny plan:
- Jawne `algorithm: 'HS256'` w sign i verify - blokuje atak **JWT algorithm confusion** (podrzucenie `alg: "none"`)

### Endpointy (backend/src/auth/routes.ts)

```typescript
import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { getRequestToken, getAccessToken, getUser } from './usos.js';
import { signToken, verifyToken } from './jwt.js';
import { config } from '../config.js';

export const authRouter = Router();

const SESSION_COOKIE = 'notes_session';
const STATE_COOKIE = 'oauth_state';

const cookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: 'lax' as const,
  maxAge: 24 * 60 * 60 * 1000,  // 24h (dopasowane do JWT TTL)
  path: '/',
  domain: config.cookieDomain,
};

// --- 1. Inicjuje OAuth flow ---
authRouter.get('/auth/login', async (_req: Request, res: Response) => {
  try {
    // Generuj losowy state (CSRF protection)
    const state = crypto.randomBytes(32).toString('hex');

    const { authorizeUrl } = await getRequestToken(state);

    // Zapisz state w osobnym cookie (krótki TTL)
    res.cookie(STATE_COOKIE, state, {
      ...cookieOptions,
      maxAge: 5 * 60 * 1000,  // 5 min
    });

    res.redirect(authorizeUrl);
  } catch (err) {
    console.error('Failed to get request token:', err);
    res.redirect(`${config.frontendUrl}?auth_error=usos_unavailable`);
  }
});

// --- 2. Callback z USOS ---
authRouter.get('/auth/callback', async (req: Request, res: Response) => {
  const { oauth_token, oauth_verifier } = req.query;
  const state = req.cookies[STATE_COOKIE];

  // Wyczyść state cookie natychmiast (jednorazowe użycie)
  res.clearCookie(STATE_COOKIE, { path: '/' });

  if (typeof oauth_token !== 'string' || typeof oauth_verifier !== 'string' || !state) {
    return res.redirect(`${config.frontendUrl}?auth_error=invalid_callback`);
  }

  try {
    const { accessToken, accessSecret } = await getAccessToken(oauth_token, oauth_verifier, state);
    const user = await getUser(accessToken, accessSecret);

    // Walidacja danych z USOS
    if (!user.id || !user.first_name || !user.last_name) {
      throw new Error('Incomplete user data from USOS');
    }

    const token = signToken({
      usosId: String(user.id),
      name: `${user.first_name} ${user.last_name}`.slice(0, 200),  // limit długości
      email: (user.email || '').slice(0, 320),
    });

    console.log(`User logged in: ${user.id} (${user.first_name} ${user.last_name})`);

    res.cookie(SESSION_COOKIE, token, cookieOptions);
    res.redirect(config.frontendUrl);
  } catch (err) {
    console.error('OAuth callback failed:', err);
    res.redirect(`${config.frontendUrl}?auth_error=callback_failed`);
  }
});

// --- 3. Dane zalogowanego usera (dla React) ---
authRouter.get('/api/auth/me', (req: Request, res: Response) => {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid session' });

  res.json({ name: payload.name, email: payload.email });
});

// --- 4. Wylogowanie ---
authRouter.post('/auth/logout', (_req: Request, res: Response) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

// --- 5. Weryfikacja dla nginx auth_request ---
authRouter.get('/auth/verify', (req: Request, res: Response) => {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return res.sendStatus(401);

  const payload = verifyToken(token);
  if (!payload) return res.sendStatus(401);

  res.sendStatus(200);
});
```

Zmiany vs pierwotny plan:
- **CSRF protection przez `state` cookie** - losowy token generowany w `/auth/login`, weryfikowany w `/auth/callback`
- **Walidacja danych z USOS** - sprawdzenie kompletności + `.slice()` na stringach
- **Logowanie zdarzeń auth** - `console.log` przy logowaniu (minimum audit trail)
- **Natychmiastowe czyszczenie state cookie** - jednorazowe użycie

### Entry point (backend/src/index.ts)

```typescript
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { authRouter } from './auth/routes.js';
import { config } from './config.js';

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,  // nginx obsługuje CSP
  crossOriginEmbedderPolicy: false,
}));

app.use(cookieParser());

// Trust proxy (nginx)
app.set('trust proxy', 1);

app.use(authRouter);

// Health check
app.get('/health', (_req, res) => res.sendStatus(200));

app.listen(config.port, () => {
  console.log(`Auth server running on port ${config.port}`);
});
```

Zmiany vs pierwotny plan:
- Dodany **`helmet`** - automatyczne security headers
- **`trust proxy`** - poprawne działanie za nginx (IP forwarding, secure cookies)
- **Health check** endpoint

### Dockerfile backendu (backend/Dockerfile)

```dockerfile
FROM node:20.20.0-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20.20.0-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
USER app
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

Zmiana vs pierwotny plan:
- **Non-root user** (`app`) - nie uruchamiamy Node.js jako root w kontenerze

---

## 6. Nginx - ochrona zasobów

### Zmieniony nginx.conf

```nginx
limit_req_zone $binary_remote_addr zone=pdf_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=general_limit:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/s;

server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    server_tokens off;

    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log warn;

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # --- SPA - React (publiczny) ---
    location / {
        limit_req zone=general_limit burst=20 nodelay;
        try_files $uri $uri/ /index.html;
    }

    # --- PDFy - CHRONIONE ---
    location /pdfs/ {
        limit_req zone=pdf_limit burst=5 nodelay;
        auth_request /internal/auth/verify;
        error_page 401 = @unauthorized;
        add_header Content-Disposition "inline" always;
        autoindex off;
    }

    # --- tree.json - też chroniony ---
    location = /pdfs/tree.json {
        auth_request /internal/auth/verify;
        error_page 401 = @unauthorized;
    }

    # --- Internal: weryfikacja auth (niedostępna z zewnątrz) ---
    location = /internal/auth/verify {
        internal;    # KLUCZOWE: blokuje dostęp z zewnątrz
        proxy_pass http://auth:3000/auth/verify;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header Cookie $http_cookie;
    }

    # --- Auth endpoints → proxy do backendu ---
    location /auth/ {
        limit_req zone=auth_limit burst=3 nodelay;
        proxy_pass http://auth:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Cookie $http_cookie;
    }

    # --- API endpoints → proxy do backendu ---
    location /api/ {
        limit_req zone=auth_limit burst=5 nodelay;
        proxy_pass http://auth:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Cookie $http_cookie;
    }

    # --- Obsługa 401 ---
    location @unauthorized {
        default_type application/json;
        return 401 '{"error": "unauthorized"}';
    }
}
```

### Zmiany vs pierwotny plan

| Element | Zmiana | Dlaczego |
|---------|--------|----------|
| `zone=auth_limit` 5r/s | **Nowy** rate limit na `/auth/` i `/api/` | Ochrona przed brute-force/spamem |
| `location /internal/auth/verify` | Zmieniony z `/auth/verify` | Dyrektywa `internal` blokuje zewnętrzny dostęp |
| `proxy_pass_request_body off` | Dodany do verify | auth_request nie potrzebuje body, optymalizacja |
| Security headers | Dodane `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` | Hardening |

### Ważne: `internal` na verify

W pierwotnym planie `/auth/verify` był dostępny z zewnątrz (ktoś mógł go probować). Teraz:
- auth_request wskazuje na `/internal/auth/verify`
- Dyrektywa `internal` oznacza, że nginx obsłuży ten location TYLKO dla subrequestów
- Bezpośredni `GET /internal/auth/verify` z przeglądarki zwróci 404

---

## 7. Frontend - zmiany w React

### Nowe pliki

```
frontend/src/
├── hooks/
│   └── useAuth.ts              # NOWY
├── components/
│   └── LoginScreen/
│       ├── LoginScreen.tsx      # NOWY
│       └── LoginScreen.module.css
└── App.tsx                      # ZMIENIONY
```

### Hook useAuth (frontend/src/hooks/useAuth.ts)

```typescript
import { useState, useEffect, useCallback } from 'react';

interface User {
  name: string;
  email: string;
}

interface UseAuthResult {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((res) => {
        if (!res.ok) throw new Error('Not authenticated');
        return res.json();
      })
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(async () => {
    await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });
    setUser(null);
  }, []);

  return { user, loading, logout };
}
```

### Ekran logowania (frontend/src/components/LoginScreen/LoginScreen.tsx)

```tsx
import styles from './LoginScreen.module.css';

export function LoginScreen() {
  // Obsługa błędów auth z query params
  const params = new URLSearchParams(window.location.search);
  const authError = params.get('auth_error');

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <img src="/favicon.ico" alt="" className={styles.icon} />
        <h1 className={styles.title}>OliNotes</h1>
        <p className={styles.subtitle}>
          Notatki studenckie — Informatyka, Wydział EiTI, PW
        </p>

        {authError && (
          <p className={styles.error}>
            Logowanie nie powiodło się. Spróbuj ponownie.
          </p>
        )}

        <a href="/auth/login" className={styles.loginBtn}>
          Zaloguj się przez USOS
        </a>
        <p className={styles.hint}>
          Wymagane konto USOS Politechniki Warszawskiej
        </p>
      </div>
    </div>
  );
}
```

Zmiana vs pierwotny plan:
- **Obsługa `?auth_error=`** - wyświetlanie komunikatu o błędzie

### Zmieniony App.tsx

```tsx
import { useState, useCallback } from 'react';
import type { PdfFile } from './types';
import { usePdfTree } from './hooks/usePdfTree';
import { useAuth } from './hooks/useAuth';
import { Header } from './components/Header/Header';
import { Sidebar } from './components/Sidebar/Sidebar';
import { PdfViewer } from './components/PdfViewer/PdfViewer';
import { LoginScreen } from './components/LoginScreen/LoginScreen';
import styles from './App.module.css';

function App() {
  const { user, loading: authLoading, logout } = useAuth();
  const { tree, loading, error } = usePdfTree();
  const [selectedPdf, setSelectedPdf] = useState<PdfFile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSelectPdf = useCallback((pdf: PdfFile) => {
    setSelectedPdf(pdf);
    setSidebarOpen(false);
  }, []);

  if (authLoading) {
    return <div className={styles.authLoading}>Ładowanie...</div>;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className={styles.layout}>
      <Header
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(prev => !prev)}
        user={user}
        onLogout={logout}
      />
      <main className={styles.main}>
        {sidebarOpen && (
          <div
            className={styles.overlay}
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <Sidebar
          tree={tree}
          loading={loading}
          error={error}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedPath={selectedPdf?.path ?? null}
          onSelectPdf={handleSelectPdf}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <PdfViewer pdf={selectedPdf} />
      </main>
    </div>
  );
}

export default App;
```

### Zmieniony Header.tsx

Dodać props `user` i `onLogout` + przycisk wylogowania:

```tsx
interface HeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  user?: { name: string };
  onLogout?: () => void;
}

// W renderze, obok <p className={styles.credit}>:
{user && (
  <div className={styles.userInfo}>
    <span>{user.name}</span>
    <button onClick={onLogout} className={styles.logoutBtn}>Wyloguj</button>
  </div>
)}
```

### Obsługa 401 w usePdfTree

```typescript
// W usePdfTree.ts — zmienić response check:
.then((res) => {
  if (res.status === 401) throw new Error('Sesja wygasła — zaloguj się ponownie');
  if (!res.ok) throw new Error('Nie udało się załadować listy plików');
  return res.json();
})
```

---

## 8. Docker - konfiguracja

### docker-compose.yml (root)

```yaml
services:
  notes:
    image: ghcr.io/oszypczy/notes:latest
    volumes:
      - /home/opc/data/notes/pdfs:/usr/share/nginx/html/pdfs:ro
    depends_on:
      auth:
        condition: service_started
    restart: unless-stopped
    networks:
      - internal
      - proxy

  auth:
    image: ghcr.io/oszypczy/notes-auth:latest
    env_file: .env
    restart: unless-stopped
    networks:
      - internal

networks:
  internal:
    driver: bridge
  proxy:
    external: true
```

### Co się zmieniło

- **Nowy serwis `auth`** - backend Node.js
- **Sieć `internal`** - auth dostępny TYLKO z nginx, nie wystawiony na zewnątrz
- **`env_file: .env`** - sekrety z pliku na serwerze
- Nginx resolves `auth` jako hostname przez Docker DNS

### Ograniczenia pamięci (serwer ma tylko 503 MB RAM)

Serwer ma niewiele wolnego RAM (~218 MB). Backend auth (Node.js + Express) powinien zajmować ~30-50 MB i zmieścić się bez problemu. Jeśli jednak po deployu pojawiają się problemy typu:
- Kontener `auth` jest restartowany (OOM kill)
- `docker compose up` się nie udaje
- Serwer ogólnie zwalnia / nie odpowiada

**To prawdopodobnie brak RAM.** Rozwiązania (od najprostszego):

1. **Dodaj `mem_limit` do docker-compose** - twardy limit żeby Node nie rozrósł się ponad miarę:
   ```yaml
   auth:
     image: ghcr.io/oszypczy/notes-auth:latest
     mem_limit: 64m
     env_file: .env
   ```

2. **Ogranicz heap Node.js** - zmień CMD w Dockerfile backendu:
   ```dockerfile
   CMD ["node", "--max-old-space-size=48", "dist/index.js"]
   ```

3. **Wyczyść nieużywane Docker images** na serwerze:
   ```bash
   docker image prune -a
   ```
   Stare, nieużywane obrazy potrafią zjadać dużo RAM przy indeksowaniu.

4. **Przenieś na instancję ARM** - Oracle Free Tier pozwala mieć do 4 instancji ARM Ampere po 1 GB RAM każda (łącznie 4 vCPU + 24 GB RAM). To wymaga migracji, ale daje 2x więcej RAM.

---

## 9. GitHub Actions - deployment

### Zmieniony .github/workflows/deploy.yml

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push frontend image
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          push: true
          tags: ghcr.io/oszypczy/notes:latest

      - name: Build and push auth image
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: ghcr.io/oszypczy/notes-auth:latest

      - name: Deploy to server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            echo ${{ secrets.GHCR_TOKEN }} | docker login ghcr.io -u oszypczy --password-stdin
            docker pull ghcr.io/oszypczy/notes:latest
            docker pull ghcr.io/oszypczy/notes-auth:latest
            mkdir -p ~/apps/notes ~/data/notes/pdfs
            cd ~/apps/notes

            cat > docker-compose.yml << 'COMPOSE'
            services:
              notes:
                image: ghcr.io/oszypczy/notes:latest
                volumes:
                  - /home/opc/data/notes/pdfs:/usr/share/nginx/html/pdfs:ro
                depends_on:
                  auth:
                    condition: service_started
                restart: unless-stopped
                networks:
                  - internal
                  - proxy
              auth:
                image: ghcr.io/oszypczy/notes-auth:latest
                env_file: .env
                restart: unless-stopped
                networks:
                  - internal
            networks:
              internal:
                driver: bridge
              proxy:
                external: true
            COMPOSE

            docker compose up -d --force-recreate
```

Zmiana vs pierwotny plan:
- `context: ./frontend` zamiast `.` (nowa struktura monorepo)

---

## 10. Zmienne środowiskowe i sekrety

### Plik .env na serwerze (/home/opc/apps/notes/.env)

```env
USOS_CONSUMER_KEY=twoj-consumer-key
USOS_CONSUMER_SECRET=twoj-consumer-secret
JWT_SECRET=<wynik openssl rand -hex 32>
CALLBACK_URL=https://notes.twoja-domena.pl/auth/callback
FRONTEND_URL=https://notes.twoja-domena.pl
NODE_ENV=production
```

### Generowanie JWT_SECRET

```bash
openssl rand -hex 32
```

### Podsumowanie

| Zmienna | Gdzie | Źródło |
|---------|-------|--------|
| `USOS_CONSUMER_KEY` | `.env` na serwerze | Portal USOS developers |
| `USOS_CONSUMER_SECRET` | `.env` na serwerze | Portal USOS developers |
| `JWT_SECRET` | `.env` na serwerze | `openssl rand -hex 32` |
| `CALLBACK_URL` | `.env` na serwerze | Twoja domena + `/auth/callback` |
| `FRONTEND_URL` | `.env` na serwerze | Twoja domena |

---

## 11. Bezpieczeństwo - analiza i hardening

### Wektory ataków i mitygacje

| Wektor | Ryzyko | Mitygacja w planie |
|--------|--------|-------------------|
| **Login CSRF** - atakujący wymusza logowanie ofiary na swoje konto | Średnie | Losowy `state` w cookie, weryfikowany w callbacku |
| **Kradzież JWT** (np. z laptopa) | Średnie | TTL 24h (nie 7 dni), httpOnly (niedostępny z JS) |
| **JWT algorithm confusion** (`alg: "none"`) | Wysokie | Jawne `algorithms: ['HS256']` w verify |
| **DoS na pending tokenów** | Niskie | Limit 1000 w Map + auto-cleanup + rate limit 5r/s na `/auth/` |
| **XSS → kradzież sesji** | Wysokie | Cookie httpOnly (JS nie ma dostępu do tokena) |
| **CSRF na /auth/logout** | Niskie | SameSite=Lax blokuje cross-site POST |
| **Dostęp do /auth/verify z zewnątrz** | Niskie | `internal` directive w nginx — zwraca 404 |
| **Brak security headers** | Niskie | `helmet` + nginx headers (X-Frame-Options, nosniff, Referrer-Policy) |
| **Stary pakiet `oauth` npm** | Średnie | Zamieniony na `oauth-1.0a` (aktywnie utrzymywany) |
| **Root w kontenerze** | Niskie | Non-root user `app` w Dockerfile backendu |
| **Wyciek danych USOS do JWT** | Niskie | Minimalne dane (id, imię, email) + `.slice()` na stringach |
| **Backend dostępny z internetu** | Średnie | Sieć `internal` w Docker — auth nie ma wystawionego portu |

### Co NIE jest chronione (akceptowane ryzyko)

| Element | Dlaczego akceptujemy |
|---------|---------------------|
| Brak revokacji JWT | Przy TTL 24h i małej skali — akceptowalne. Dodanie Redis/DB to overengineering na tym etapie. |
| Pending tokens w pamięci | Restart backendu przerywa ~max kilka aktywnych logowań. Przy małej liczbie userów — OK. |
| Brak bazy danych | Nie logujemy kto co pobrał. Dodanie DB to osobny feature na przyszłość. |
| Brak whitelisty userów | Każdy z kontem USOS PW może wejść. Ograniczenie do wydziału/kierunku → wymagałoby dodatkowej logiki. |

### Checklist przed deployem

- [ ] `JWT_SECRET` ma minimum 32 bajty entropii (`openssl rand -hex 32`)
- [ ] `CALLBACK_URL` używa HTTPS (nie HTTP)
- [ ] `.env` ma `chmod 600` na serwerze
- [ ] Cookie `secure: true` w produkcji (wymaga HTTPS)
- [ ] Reverse proxy (przed nginx) terminuje TLS
- [ ] `docker compose` nie wystawia portu backendu na zewnątrz
- [ ] Consumer secret NIE jest w repo / CI / logach

---

## 12. Kolejność implementacji

### Faza 0: Reorganizacja repo (30 min)
- [ ] Przenieś pliki React do `frontend/` (patrz sekcja 3)
- [ ] Zaktualizuj `Dockerfile` (context = `frontend/`)
- [ ] Zaktualizuj `deploy.yml` (context = `./frontend`)
- [ ] Zaktualizuj `CLAUDE.md` z nowymi ścieżkami
- [ ] Sprawdź że `cd frontend && npm run build` działa
- [ ] Commit + deploy (upewnij się że nic nie zepsuło)

### Faza 1: Rejestracja USOS (5 min)
- [ ] Zarejestruj aplikację na https://apps.usos.pw.edu.pl/developers/
- [ ] Zapisz consumer_key i consumer_secret (NIE commituj do repo)

### Faza 2: Backend (1-2h)
- [ ] Utwórz `backend/` z package.json, tsconfig.json
- [ ] Zaimplementuj `src/config.ts` (z `requireEnv`)
- [ ] Zaimplementuj `src/auth/usos.ts` (oauth-1.0a + state + limit)
- [ ] Zaimplementuj `src/auth/jwt.ts` (HS256 explicit)
- [ ] Zaimplementuj `src/auth/routes.ts` (5 endpointów + CSRF state)
- [ ] Zaimplementuj `src/index.ts` (Express + helmet + trust proxy)
- [ ] Utwórz `backend/Dockerfile` (non-root user)
- [ ] Przetestuj lokalnie: `cd backend && npm run dev`

### Faza 3: Nginx (15 min)
- [ ] Dodaj `auth_request` + `internal` verify location
- [ ] Dodaj rate limit zone `auth_limit` (5r/s)
- [ ] Dodaj `location /auth/` i `/api/` z proxy
- [ ] Dodaj security headers
- [ ] Dodaj ochronę `tree.json`

### Faza 4: Frontend (30-45 min)
- [ ] Utwórz `frontend/src/hooks/useAuth.ts`
- [ ] Utwórz `frontend/src/components/LoginScreen/` (+ obsługa auth_error)
- [ ] Zmodyfikuj `App.tsx` — auth gate
- [ ] Zmodyfikuj `Header.tsx` — user info + logout
- [ ] Zmodyfikuj `usePdfTree.ts` — obsługa 401
- [ ] Ostyluj LoginScreen (dark theme, spójny z resztą)

### Faza 5: Docker i deployment (30 min)
- [ ] Zaktualizuj `docker-compose.yml` (serwis `auth` + sieć `internal`)
- [ ] Zaktualizuj `.github/workflows/deploy.yml`
- [ ] Na serwerze: utwórz `/home/opc/apps/notes/.env` z `chmod 600`
- [ ] Na serwerze: wygeneruj JWT_SECRET
- [ ] Push i przetestuj deploy

### Faza 6: Testy end-to-end (15 min)
- [ ] Niezalogowany → widzi LoginScreen
- [ ] `GET /pdfs/tree.json` bez sesji → 401
- [ ] `GET /pdfs/jakis.pdf` bez sesji → 401
- [ ] Kliknięcie "Zaloguj" → redirect do USOS → callback → zalogowany
- [ ] Po zalogowaniu → PDFy się ładują normalnie
- [ ] Przycisk "Wyloguj" → sesja usunięta → LoginScreen
- [ ] `GET /internal/auth/verify` z przeglądarki → 404 (not 200/401)
- [ ] Spam `/auth/login` → rate limit 5r/s działa
