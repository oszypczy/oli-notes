Raport bezpieczeństwa OliNotes Auth
                                                                      
Serwer -- stan OK
- Firewall: HTTP/HTTPS/SSH otwarte, egress nieograniczony (auth dotrze do USOS)
- Caddy terminuje TLS na 80/443
- auth kontener nie wystawia portu na hosta -- dostępny tylko przez Docker DNS
- Sieci Docker: proxy (caddy <-> nginx), notes_internal (nginx <-> auth)

Rzeczy do naprawić

CRITICAL:
┌─────┬─────────────────────────────────────────────────────────────────┬────────────┐
│  #  │                             Problem                             │    Plik    │
├─────┼─────────────────────────────────────────────────────────────────┼────────────┤
│ 1   │ .env nie jest w .gitignore -- przypadkowy commit ujawni sekrety │ .gitignore │
└─────┴─────────────────────────────────────────────────────────────────┴────────────┘
HIGH:
#: 2
Problem: Brak Content-Security-Policy headera
Plik: nginx.conf
────────────────────────────────────────
#: 3
Problem: Security headers (X-Frame-Options, nosniff) gubiące się w bloku /pdfs/ -- nginx nie
  dziedziczy add_header gdy blok definiuje własny
Plik: nginx.conf
────────────────────────────────────────
#: 4
Problem: Brak rate limitingu w Express (nginx ma, ale backend nie)
Plik: backend/src/index.ts
MEDIUM:
┌─────┬───────────────────────────────────────────────────────────────┬───────────────────────┐
│  #  │                            Problem                            │         Plik          │
├─────┼───────────────────────────────────────────────────────────────┼───────────────────────┤
│ 5   │ Brak timeoutów na fetch do USOS -- hang = wyczerpanie zasobów │ auth/usos.ts          │
├─────┼───────────────────────────────────────────────────────────────┼───────────────────────┤
│ 6   │ Brak .dockerignore -- .env może wpaść do build stage          │ backend/              │
├─────┼───────────────────────────────────────────────────────────────┼───────────────────────┤
│ 7   │ Source maps w produkcyjnym obrazie                            │ backend/tsconfig.json │
├─────┼───────────────────────────────────────────────────────────────┼───────────────────────┤
│ 8   │ clearCookie nie przekazuje pełnych opcji (domain/secure)      │ auth/routes.ts        │
├─────┼───────────────────────────────────────────────────────────────┼───────────────────────┤
│ 9   │ Secret w deploy.yml niecytowany (shell injection risk)        │ deploy.yml            │
├─────┼───────────────────────────────────────────────────────────────┼───────────────────────┤
│ 10  │ Brak HSTS headera (Caddy może go ustawiać -- zweryfikuj)      │ nginx.conf            │
└─────┴───────────────────────────────────────────────────────────────┴───────────────────────┘
LOW:
┌─────┬───────────────────────────────────────────────────────────────────────┐
│  #  │                                Problem                                │
├─────┼───────────────────────────────────────────────────────────────────────┤
│ 11  │ Non-null assertions ! na odpowiedziach USOS (brak runtime validation) │
├─────┼───────────────────────────────────────────────────────────────────────┤
│ 12  │ PII w logach (imię/nazwisko przy logowaniu)                           │
├─────┼───────────────────────────────────────────────────────────────────────┤
│ 13  │ JWT secret bez minimalnej długości                                    │
├─────┼───────────────────────────────────────────────────────────────────────┤
│ 14  │ /auth/verify nie forwarduje tożsamości (X-User-Id header)             │
└─────┴───────────────────────────────────────────────────────────────────────┘