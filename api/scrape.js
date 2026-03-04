const BASE_URL = 'https://jobs.ams.at';
const SEARCH_PATH = '/public/emps/jobs';

function buildSearchUrl({ query = '', location = '', radius = '', filters = [] }) {
  const params = new URLSearchParams();
  if (query) params.append('query', query);
  if (location) params.append('location', location);
  if (radius !== '' && radius !== null && radius !== undefined) params.append('radius', String(radius));

  for (const filter of filters) {
    const key = String(filter?.key || '').trim();
    const value = String(filter?.value || '').trim();
    if (key && value) params.append(key, value);
  }

  const queryString = params.toString();
  return queryString ? `${BASE_URL}${SEARCH_PATH}?${queryString}` : `${BASE_URL}${SEARCH_PATH}`;
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.text();
}

function parseJobLinks(html) {
  const links = [...html.matchAll(/href=["']([^"']*\/public\/emps\/job\/[^"']+)["']/gi)].map((match) => match[1]);
  const nextMatch = html.match(/<a[^>]*rel=["']next["'][^>]*href=["']([^"']+)["']/i) ||
    html.match(/<a[^>]*href=["']([^"']+)["'][^>]*rel=["']next["']/i);

  return {
    links: [...new Set(links)].map((link) => new URL(link, BASE_URL).toString()),
    nextLink: nextMatch?.[1] ? new URL(nextMatch[1], BASE_URL).toString() : null,
  };
}

function parseJsonLd(html) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);

  for (const raw of scripts) {
    const text = raw.trim();
    if (!text) continue;
    try {
      const parsed = JSON.parse(text);
      const candidates = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.['@graph'])
          ? parsed['@graph']
          : [parsed];

      const hit = candidates.find((item) => item && item['@type'] === 'JobPosting');
      if (hit) return hit;
    } catch {
      // ignore invalid blocks
    }
  }

  return {};
}

function cleanHtmlText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractJobId(url) {
  const match = url.match(/\/job\/(\d+)/);
  return match ? match[1] : '';
}

async function parseJobDetail(url) {
  const html = await fetchHtml(url);
  const payload = parseJsonLd(html);
  const organization = typeof payload?.hiringOrganization === 'object' ? payload.hiringOrganization : {};
  const location = typeof payload?.jobLocation === 'object' ? payload.jobLocation : {};
  const address = typeof location?.address === 'object' ? location.address : {};

  return {
    id: extractJobId(url),
    title: String(payload?.title || '').trim(),
    company: String(organization?.name || '').trim(),
    location: String(address?.addressLocality || '').trim(),
    posted_at: String(payload?.datePosted || '').trim(),
    employment_type: String(payload?.employmentType || '').trim(),
    url,
    description: cleanHtmlText(payload?.description || ''),
  };
}

function nextPageUrl(url) {
  const parsed = new URL(url);
  const current = Number(parsed.searchParams.get('page') || '1');
  parsed.searchParams.set('page', String(current + 1));
  return parsed.toString();
}

async function collectJobs(searchUrl, maxPages, maxJobs) {
  const seenPages = new Set();
  const allJobLinks = [];
  const errors = [];
  let current = searchUrl;

  for (let i = 0; i < maxPages; i += 1) {
    if (seenPages.has(current)) break;
    seenPages.add(current);

    try {
      const html = await fetchHtml(current);
      const { links, nextLink } = parseJobLinks(html);

      for (const link of links) {
        if (!allJobLinks.includes(link)) allJobLinks.push(link);
        if (allJobLinks.length >= maxJobs) break;
      }

      if (allJobLinks.length >= maxJobs) break;
      current = nextLink || nextPageUrl(current);
    } catch (error) {
      errors.push(`Suchergebnisseite konnte nicht geladen werden ${current}: ${error.message}`);
      break;
    }
  }

  const jobs = [];
  for (const link of allJobLinks.slice(0, maxJobs)) {
    try {
      jobs.push(await parseJobDetail(link));
    } catch (error) {
      errors.push(`Detailseite konnte nicht verarbeitet werden ${link}: ${error.message}`);
    }
  }

  return { jobs, errors };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Methode nicht erlaubt' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const payload = {
    query: String(body.query || '').trim(),
    location: String(body.location || '').trim(),
    radius: String(body.radius ?? '').trim(),
    filters: Array.isArray(body.filters) ? body.filters : [],
  };

  const maxPages = Math.min(Math.max(Number(body.max_pages || 5), 1), 100);
  const maxJobs = Math.min(Math.max(Number(body.max_jobs || 200), 1), 3000);

  const searchUrl = buildSearchUrl(payload);
  const { jobs, errors } = await collectJobs(searchUrl, maxPages, maxJobs);

  return res.status(200).json({
    search_url: searchUrl,
    job_count: jobs.length,
    errors,
    preview: jobs.slice(0, 20),
    rows: jobs,
  });
};
