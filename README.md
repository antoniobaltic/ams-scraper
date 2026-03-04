# AMS Scraper Studio (Vercel)

Modernes, minimalistisches Web-Tool zum Scrapen von AMS-Stellenangeboten mit Export nach CSV und Excel.

## Technologie

- **Frontend**: statische Dateien in `public/`
- **Backend**: Vercel Serverless Function in `api/scrape.js`
- **Export**:
  - CSV im Browser erzeugt
  - Excel (`.xlsx`) im Browser via SheetJS

## Funktionen

- Deutsche Eingabemaske mit benutzerfreundlichen Feldern statt Parameterliste.
- Filterbereiche mit echten UI-Elementen (Checkboxen/Radio-Buttons), angelehnt an AMS:
  - Quelle der Stellenangebote
  - Arbeitszeit
  - Aktualität
  - Dienstverhältnis
  - Ausbildung
- Durchläuft Suchseiten inkl. Pagination und öffnet jede gefundene Detailseite.
- Extrahiert strukturierte Daten aus JSON-LD (`JobPosting`).
- Vorschau + Download von CSV und Excel.

## Scraping-Ablauf

1. URL aus Suchfeldern + gewählten Filtern erzeugen.
2. Suchergebnis-Seite laden.
3. Job-Links (`/public/emps/job/...`) extrahieren.
4. Pagination folgen (`rel="next"`, sonst `page+1`).
5. Detailseiten laden und `application/ld+json` auswerten.
6. Normalisierte Datensätze ans Frontend zurückgeben.
7. CSV/XLSX im Browser herunterladen.

## Lokal starten

```bash
npm install
npm run dev
```

Danach im Browser öffnen: `http://localhost:3000` (oder die URL aus `vercel dev`).

## Deployment auf Vercel

1. Vercel CLI installieren:
   ```bash
   npm i -g vercel
   ```
2. Login:
   ```bash
   vercel login
   ```
3. Preview-Deployment:
   ```bash
   vercel
   ```
4. Produktion:
   ```bash
   vercel --prod
   ```

Es sind keine Umgebungsvariablen erforderlich.

## Hinweis

Wenn das Laufzeitumfeld ausgehende Verbindungen zu `https://jobs.ams.at` blockiert, liefert die API entsprechende Hinweise in `errors` und ggf. keine Treffer.
