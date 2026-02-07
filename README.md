# Studia IV - OliNotes

Przeglądarka notatek PDF ze studiów na Wydziale Elektroniki i Technik Informacyjnych Politechniki Warszawskiej.

## Stack technologiczny

- **React 19** + **TypeScript** + **Vite**
- CSS Modules (ciemny motyw)
- Nginx (serwer produkcyjny)
- Docker (multi-stage build)
- GitHub Actions (CI/CD)

## Uruchomienie lokalne

```bash
npm install
npm run dev
```

PDFy nie są trzymane w repo. Dla lokalnego developmentu wrzuć pliki PDF do `public/pdfs/` (folder jest w `.gitignore`) i wygeneruj `tree.json`:

```bash
bash scripts/generate-tree.sh ./public/pdfs
```

## Budowanie

```bash
npm run build      # TypeScript check + Vite build
npm run preview    # Podgląd zbudowanej wersji
npm run lint       # ESLint
```

## Docker

```bash
docker compose up
```

Aplikacja na porcie `3001`. PDFy montowane z hosta przez Docker volume.

## Deployment

Push na branch `main` uruchamia GitHub Actions workflow, który:

1. Buduje obraz Docker (bez PDFów - lekki image)
2. Publikuje go w GitHub Container Registry (`ghcr.io/oszypczy/notes:latest`)
3. Łączy się po SSH z serwerem i restartuje kontener z volume mount na PDFy

Wymagane sekrety w repozytorium: `SSH_PRIVATE_KEY`, `GHCR_TOKEN`.

## Zarządzanie PDFami na serwerze

PDFy są przechowywane na serwerze w `~/data/notes/pdfs/`, montowane do kontenera Docker jako volume.

```bash
# Prześlij nowe PDFy
scp -i ~/.ssh/oracle_cloud notatki.pdf opc@130.61.246.215:~/data/notes/pdfs/semestr-1/

# Wygeneruj tree.json
ssh -i ~/.ssh/oracle_cloud opc@130.61.246.215 'bash ~/scripts/generate-tree.sh'

# Gotowe - strona od razu widzi nowe pliki (bez rebuilda)
```
