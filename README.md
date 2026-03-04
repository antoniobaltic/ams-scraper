# AMS Scraper Studio (Vercel)

Modern minimalist micro‑SaaS web app for scraping Austrian AMS job offers and exporting structured data to CSV + Excel.

## Stack

- **Frontend**: static files in `public/` (high-density, fast UI)
- **Backend**: Vercel Serverless Function in `api/scrape.js`
- **Exports**:
  - CSV generated in browser
  - Excel (`.xlsx`) generated in browser via SheetJS

## Features

- Input fields similar to AMS search:
  - `query`
  - `location`
  - `radius`
- Add arbitrary AMS query parameters (`key=value`) with repeated keys.
- Crawls AMS result pages and clicks through all found job detail URLs.
- Extracts structured job data from JSON-LD (`JobPosting`) on detail pages.
- Preview table + one-click CSV / Excel downloads.

## Scraping flow

1. Build AMS URL from form values + all filter rows.
2. Load search result page HTML.
3. Parse job links (`/public/emps/job/...`).
4. Follow pagination (`rel="next"`, fallback `page+1`).
5. Fetch each job page and parse `application/ld+json` blocks.
6. Normalize records and return rows to frontend.
7. Frontend exports records to CSV and XLSX.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000` (or the URL shown by `vercel dev`).

## Deploy to Vercel

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```
2. Login:
   ```bash
   vercel login
   ```
3. Deploy preview:
   ```bash
   vercel
   ```
4. Deploy production:
   ```bash
   vercel --prod
   ```

No environment variables are required.

## Important runtime note

If the deployment environment blocks outgoing requests to `https://jobs.ams.at`, the API returns warnings in `errors` and zero results. The UI still works and shows that warning.
