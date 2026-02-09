Plan: AI Chat — asystent przeszukiwania notatek PDF                                           │
│                                                                                               │
│ Kontekst                                                                                      │
│                                                                                               │
│ OliNotes to przegladarka PDF-ow z notatkami studenckimi (PW). Uzytkownik chce dodac AI chata, │
│  ktory zna zawartosc wszystkich PDF-ow i potrafi:                                             │
│ - Odpowiedziec "gdzie znajde info o architekturze potokowej?" — z dokladna sciezka + nr       │
│ strony                                                                                        │
│ - Krotko zacytowac odpowiedz                                                                  │
│ - Dac kontekst (o czym byl caly wyklad)                                                       │
│ - Sugerowac powiazane materialy (np. kolosy z tego tematu)                                    │
│                                                                                               │
│ Kluczowe ograniczenia:                                                                        │
│ - Serwer: Oracle Cloud Free Tier — 503 MB RAM, 283 MB zajete                                  │
│ - PDF-y w wyklad*/ to odrecznie pisane notatki (przetestowane — AI vision czyta je dobrze)    │
│ - Uzytkownik nie chce placic — uzycie Gemini API free tier (1500 req/day, 15 req/min)         │
│ - Brak bazy danych                                                                            │
│                                                                                               │
│ Architektura — 3 warstwy                                                                      │
│                                                                                               │
│ [1. OFFLINE — lokalna maszyna]                                                                │
│     PDF-y → Gemini Vision OCR → index.json (statyczny plik)                                   │
│                                                                                               │
│ [2. SERWER — 0 dodatkowego RAM]                                                               │
│     nginx serwuje index.json (obok tree.json)                                                 │
│                                                                                               │
│ [3. RUNTIME — zapytanie usera]                                                                │
│     Frontend text search → top fragmenty → backend proxy → Gemini Flash → odpowiedz           │
│                                                                                               │
│ ---                                                                                           │
│ Krok 1: Skrypt indeksujacy (offline, Python)                                                  │
│                                                                                               │
│ Nowy plik: scripts/generate-index.py                                                          │
│                                                                                               │
│ Dla kazdego PDF w katalogu:                                                                   │
│ 1. Drukowane PDF-y (kolosy/, laby/, beton/): ekstrakcja tekstu przez pdftotext (poppler)      │
│ 2. Odrecznie pisane PDF-y (wyklady/): konwersja stron na PNG (pdftoppm), wyslanie do Gemini   │
│ Vision API z promptem OCR                                                                     │
│                                                                                               │
│ Prompt OCR dla Gemini Vision:                                                                 │
│ Odczytaj tekst z tej strony notatek. Zachowaj strukture (naglowki, punkty, wzory).            │
│ Jezyk: polski. Jesli sa schematy/rysunki, opisz je krotko.                                    │
│ Zwroc czysty tekst, bez markdownu.                                                            │
│                                                                                               │
│ Output: index.json obok tree.json                                                             │
│ [                                                                                             │
│   {                                                                                           │
│     "path": "/pdfs/23L/wykłady/arko.pdf",                                                     │
│     "subject": "ARKO",                                                                        │
│     "semester": "23L",                                                                        │
│     "category": "wykłady",                                                                    │
│     "totalPages": 45,                                                                         │
│     "pages": [                                                                                │
│       {                                                                                       │
│         "page": 1,                                                                            │
│         "text": "Wykład 1. Wprowadzenie do architektury komputerów..."                        │
│       }                                                                                       │
│     ]                                                                                         │
│   }                                                                                           │
│ ]                                                                                             │
│                                                                                               │
│ Estymacja:                                                                                    │
│ - ~60 PDF-ow wykladowych × ~25 stron = ~1500 stron OCR                                        │
│ - Gemini free tier: 1500 req/day → 1 dzien na pelne indeksowanie                              │
│ - Kolosy/laby (drukowane): pdftotext, instant, 0 requestow API                                │
│ - Skrypt uruchamiany recznie po dodaniu nowych PDF-ow                                         │
│                                                                                               │
│ Zaleznosci: google-generativeai (Python), poppler-utils (system)                              │
│                                                                                               │
│ ---                                                                                           │
│ Krok 2: Wyszukiwanie — lekki search na frontendzie                                            │
│                                                                                               │
│ Nowy plik: frontend/src/utils/searchIndex.ts                                                  │
│                                                                                               │
│ Frontend laduje index.json (cachowany w pamieci). Wyszukiwanie:                               │
│ 1. Tokenizacja zapytania usera (rozbij na slowa)                                              │
│ 2. Dla kazdej strony: policz ile slow zapytania wystepuje w tekscie (case-insensitive)        │
│ 3. Sortuj po trafnosci, zwroc top 10 fragmentow (path + page + snippet 200 znakow wokol       │
│ trafienia)                                                                                    │
│                                                                                               │
│ To prosty TF-IDF-like scoring — wystarczajacy dla ~1500 stron. Brak potrzeby vector DB.       │
│                                                                                               │
│ Nowy hook: frontend/src/hooks/useSearchIndex.ts                                               │
│ - Fetch /pdfs/index.json przy starcie (lazy, po zaladowaniu tree)                             │
│ - Memoizacja indeksu                                                                          │
│ - Eksportuje searchPages(query): SearchResult[]                                               │
│                                                                                               │
│ ---                                                                                           │
│ Krok 3: Backend — proxy do Gemini API                                                         │
│                                                                                               │
│ Nowy plik: backend/src/ai/routes.ts                                                           │
│                                                                                               │
│ POST /api/chat                                                                                │
│ Body: { question: string, context: SearchResult[] }                                           │
│ Headers: Cookie z JWT (reuse istniejacego auth)                                               │
│                                                                                               │
│ Logika:                                                                                       │
│ 1. verifyToken() — reuse z backend/src/auth/jwt.ts                                            │
│ 2. Rate limit: max 15 req/min per user (in-memory Map, analogicznie do pendingTokens w        │
│ usos.ts)                                                                                      │
│ 3. Buduj prompt systemowy:                                                                    │
│                                                                                               │
│ Jestes asystentem pomagajacym studentom znalezc informacje w notatkach z wykladow.            │
│ Odpowiadasz po polsku. Na podstawie ponizszych fragmentow notatek:                            │
│                                                                                               │
│ [kontekst z SearchResult[] — sciezka, nr strony, tekst]                                       │
│                                                                                               │
│ Odpowiedz na pytanie studenta. W odpowiedzi:                                                  │
│ - Podaj dokladna sciezke do PDF i numer strony                                                │
│ - Krotko zacytuj istotny fragment                                                             │
│ - Daj kontekst (o czym byl wyklad/temat)                                                      │
│ - Jesli sa powiazane materialy (kolosy, inne wyklady), zasugeruj je                           │
│ - Jesli nie znalazles odpowiedzi, powiedz o tym szczerze                                      │
│                                                                                               │
│ 4. Wywolaj Gemini 2.0 Flash (free tier) z kontekstem + pytaniem                               │
│ 5. Stream odpowiedzi przez SSE (Server-Sent Events) do frontendu                              │
│                                                                                               │
│ Nowy plik: backend/src/ai/rateLimiter.ts — prosta mapa usosId → {count, resetAt}              │
│                                                                                               │
│ Zaleznosc: @google/generative-ai (npm)                                                        │
│                                                                                               │
│ Modyfikacja: backend/src/index.ts — zarejestruj nowy router /api/chat                         │
│                                                                                               │
│ ---                                                                                           │
│ Krok 4: Frontend — komponent ChatPanel                                                        │
│                                                                                               │
│ Nowe pliki:                                                                                   │
│ - frontend/src/components/ChatPanel/ChatPanel.tsx + .module.css                               │
│ - frontend/src/hooks/useChat.ts                                                               │
│                                                                                               │
│ ChatPanel UI:                                                                                 │
│                                                                                               │
│ - Slide-out panel z prawej strony (obok PdfViewer) lub drawer od dolu na mobile               │
│ - Input na dole, historia wiadomosci powyzej                                                  │
│ - Kazda odpowiedz AI zawiera klikalne linki: [ARKO, s.10](/pdfs/23L/wykłady/arko.pdf)         │
│ — klikniecie otwiera PDF na wlasciwej stronie (reuse setSelectedPdf)                          │
│ - Przycisk "Zapytaj AI" w headerze lub jako floating button                                   │
│ - Stan: messages[], isLoading, error                                                          │
│                                                                                               │
│ useChat hook:                                                                                 │
│                                                                                               │
│ - Zarzadza messages state                                                                     │
│ - Wywoluje searchPages(query) z useSearchIndex                                                │
│ - Wysyla POST /api/chat z pytaniem + kontekstem                                               │
│ - Odbiera SSE stream i aktualizuje ostatnia wiadomosc token po tokenie                        │
│ - Obsluga bledow (rate limit, brak wynikow)                                                   │
│                                                                                               │
│ Modyfikacje istniejacych plikow:                                                              │
│                                                                                               │
│ - frontend/src/App.tsx — dodaj state chatOpen, przycisk otwierajacy, renderuj ChatPanel       │
│ - frontend/src/App.module.css — layout z opcjonalnym panelem po prawej                        │
│ - frontend/src/components/Header/Header.tsx — przycisk "AI" w headerze                        │
│ - frontend/src/components/icons.tsx — ikona chata (ChatIcon)                                  │
│ - frontend/vite.config.ts — proxy /api/chat do localhost:3000                                 │
│                                                                                               │
│ ---                                                                                           │
│ Krok 5: Konfiguracja Gemini API key                                                           │
│                                                                                               │
│ - Wygeneruj klucz na https://aistudio.google.com/apikey (darmowy)                             │
│ - Dodaj GEMINI_API_KEY=... do .env na serwerze                                                │
│ - Dodaj GEMINI_API_KEY do backend/src/config.ts                                               │
│ - Dodaj do Docker secrets (w docker-compose.yml juz jest env_file: .env)                      │
│                                                                                               │
│ ---                                                                                           │
│ Kluczowe pliki do modyfikacji                                                                 │
│ ┌───────────────────────────────────────────┬─────────────────────────────────────┐           │
│ │                   Plik                    │               Zmiana                │           │
│ ├───────────────────────────────────────────┼─────────────────────────────────────┤           │
│ │ backend/src/index.ts                      │ Rejestracja /api/chat routera       │           │
│ ├───────────────────────────────────────────┼─────────────────────────────────────┤           │
│ │ backend/src/config.ts                     │ Dodanie geminiApiKey                │           │
│ ├───────────────────────────────────────────┼─────────────────────────────────────┤           │
│ │ backend/package.json                      │ Dodanie @google/generative-ai       │           │
│ ├───────────────────────────────────────────┼─────────────────────────────────────┤           │
│ │ frontend/src/App.tsx                      │ State chatOpen, rendering ChatPanel │           │
│ ├───────────────────────────────────────────┼─────────────────────────────────────┤           │
│ │ frontend/src/App.module.css               │ Layout z panelem AI                 │           │
│ ├───────────────────────────────────────────┼─────────────────────────────────────┤           │
│ │ frontend/src/components/Header/Header.tsx │ Przycisk AI chat                    │           │
│ ├───────────────────────────────────────────┼─────────────────────────────────────┤           │
│ │ frontend/src/components/icons.tsx         │ ChatIcon                            │           │
│ ├───────────────────────────────────────────┼─────────────────────────────────────┤           │
│ │ frontend/vite.config.ts                   │ Proxy /api/chat                     │           │
│ └───────────────────────────────────────────┴─────────────────────────────────────┘           │
│ Nowe pliki                                                                                    │
│ ┌────────────────────────────────────────────────────────┬─────────────────────────────────── │
│ ─┐                                                                                            │
│ │                          Plik                          │                Opis                │
│  │                                                                                            │
│ ├────────────────────────────────────────────────────────┼─────────────────────────────────── │
│ ─┤                                                                                            │
│ │ scripts/generate-index.py                              │ Offline skrypt OCR + indeksowanie  │
│  │                                                                                            │
│ ├────────────────────────────────────────────────────────┼─────────────────────────────────── │
│ ─┤                                                                                            │
│ │ frontend/src/components/ChatPanel/ChatPanel.tsx        │ UI chata                           │
│  │                                                                                            │
│ ├────────────────────────────────────────────────────────┼─────────────────────────────────── │
│ ─┤                                                                                            │
│ │ frontend/src/components/ChatPanel/ChatPanel.module.css │ Style                              │
│  │                                                                                            │
│ ├────────────────────────────────────────────────────────┼─────────────────────────────────── │
│ ─┤                                                                                            │
│ │ frontend/src/hooks/useChat.ts                          │ Logika konwersacji + SSE           │
│  │                                                                                            │
│ ├────────────────────────────────────────────────────────┼─────────────────────────────────── │
│ ─┤                                                                                            │
│ │ frontend/src/hooks/useSearchIndex.ts                   │ Ladowanie i przeszukiwanie indeksu │
│  │                                                                                            │
│ ├────────────────────────────────────────────────────────┼─────────────────────────────────── │
│ ─┤                                                                                            │
│ │ frontend/src/utils/searchIndex.ts                      │ Algorytm wyszukiwania              │
│  │                                                                                            │
│ ├────────────────────────────────────────────────────────┼─────────────────────────────────── │
│ ─┤                                                                                            │
│ │ backend/src/ai/routes.ts                               │ Endpoint /api/chat                 │
│  │                                                                                            │
│ ├────────────────────────────────────────────────────────┼─────────────────────────────────── │
│ ─┤                                                                                            │
│ │ backend/src/ai/rateLimiter.ts                          │ Rate limiting per user             │
│  │                                                                                            │
│ └────────────────────────────────────────────────────────┴─────────────────────────────────── │
│ ─┘                                                                                            │
│ ---                                                                                           │
│ Kolejnosc implementacji                                                                       │
│                                                                                               │
│ 1. Skrypt indeksujacy (generate-index.py) — fundament, bez tego reszta nie dziala             │
│ 2. Backend endpoint (/api/chat) — proxy do Gemini                                             │
│ 3. Frontend search (useSearchIndex) — ladowanie indeksu + wyszukiwanie                        │
│ 4. ChatPanel UI — komponent chata + integracja                                                │
│ 5. Deploy — push obu obrazow, dodanie GEMINI_API_KEY do .env na serwerze                      │
│                                                                                               │
│ Weryfikacja                                                                                   │
│                                                                                               │
│ 1. Uruchom scripts/generate-index.py na kilku PDF-ach → sprawdz index.json                    │
│ 2. cd backend && npm run dev → test POST /api/chat curl-em                                    │
│ 3. cd frontend && npm run dev → otworz chat, zadaj pytanie "gdzie znajde info o Prologu?"     │
│ 4. Oczekiwana odpowiedz: "Informacje o Prologu znajdziesz w PARP, wyklad A2, strona 3         │
│ (/pdfs/24Z/wykłady/PARP.pdf). Notatki omawiaja fakty, zapytania, reguly w Prologu..."         │
│ 5. Test rate limitingu: wyslij 16 requestow w minucie → 16. powinien zwrocic 429              │
│ 6. npm run build — sprawdz czy sie kompiluje                                                  │
│ 7. Deploy na serwer, sprawdz free -h — RAM nie powinien wzrosnac znaczaco  