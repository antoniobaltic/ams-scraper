const filtersEl = document.getElementById('filters');
const addFilterBtn = document.getElementById('addFilter');
const runBtn = document.getElementById('run');
const statusEl = document.getElementById('status');
const resultCard = document.getElementById('resultCard');
const csvBtn = document.getElementById('csvBtn');
const xlsxBtn = document.getElementById('xlsxBtn');

let latestRows = [];

function addFilterRow(key = '', value = '') {
  const row = document.createElement('div');
  row.className = 'filterRow';
  row.innerHTML = `
    <input class="fKey" placeholder="Parametername (z.B. JOB_OFFER_TYPE)" value="${key}" />
    <input class="fValue" placeholder="Wert (z.B. SB_WKO)" value="${value}" />
    <button class="ghost remove" type="button">✕</button>
  `;
  row.querySelector('.remove').addEventListener('click', () => row.remove());
  filtersEl.appendChild(row);
}

function readFilters() {
  return [...filtersEl.querySelectorAll('.filterRow')].map((row) => ({
    key: row.querySelector('.fKey').value,
    value: row.querySelector('.fValue').value,
  }));
}

function renderPreview(rows) {
  const table = document.getElementById('previewTable');
  table.innerHTML = '';

  if (!rows.length) {
    table.innerHTML = '<tr><td>Keine Treffer.</td></tr>';
    return;
  }

  const columns = Object.keys(rows[0]);
  const head = document.createElement('tr');
  head.innerHTML = columns.map((c) => `<th>${c}</th>`).join('');
  table.appendChild(head);

  rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = columns.map((c) => `<td>${row[c] ?? ''}</td>`).join('');
    table.appendChild(tr);
  });
}

function downloadBlob(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const value = String(v ?? '');
    if (value.includes('"') || value.includes(',') || value.includes('\n')) {
      return `"${value.replaceAll('"', '""')}"`;
    }
    return value;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

csvBtn.addEventListener('click', () => {
  const csv = toCsv(latestRows);
  downloadBlob(csv, 'ams_jobs.csv', 'text/csv;charset=utf-8');
});

xlsxBtn.addEventListener('click', () => {
  if (!latestRows.length) return;
  const worksheet = XLSX.utils.json_to_sheet(latestRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'jobs');
  XLSX.writeFile(workbook, 'ams_jobs.xlsx');
});

addFilterBtn.addEventListener('click', () => addFilterRow());

runBtn.addEventListener('click', async () => {
  statusEl.textContent = 'Scrape läuft...';
  runBtn.disabled = true;

  const payload = {
    query: document.getElementById('query').value,
    location: document.getElementById('location').value,
    radius: document.getElementById('radius').value,
    max_pages: Number(document.getElementById('maxPages').value),
    max_jobs: Number(document.getElementById('maxJobs').value),
    filters: readFilters(),
  };

  try {
    const res = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Scrape fehlgeschlagen');

    latestRows = data.rows || [];
    resultCard.hidden = false;
    document.getElementById('summary').textContent = `${data.job_count} Jobs extrahiert.`;
    document.getElementById('searchUrl').textContent = data.search_url;

    const errorsEl = document.getElementById('errors');
    errorsEl.innerHTML = '';
    if (data.errors?.length) {
      errorsEl.innerHTML = `<p id="error"><strong>Warnungen:</strong><br>${data.errors.join('<br>')}</p>`;
    }

    renderPreview(data.preview || []);
    csvBtn.disabled = latestRows.length === 0;
    xlsxBtn.disabled = latestRows.length === 0;
    statusEl.textContent = 'Fertig.';
  } catch (error) {
    statusEl.textContent = `Fehler: ${error.message}`;
  } finally {
    runBtn.disabled = false;
  }
});

addFilterRow('JOB_OFFER_TYPE', 'SB_WKO');
addFilterRow('JOB_OFFER_TYPE', 'IJ');
addFilterRow('JOB_OFFER_TYPE', 'BA');
addFilterRow('JOB_OFFER_TYPE', 'BZ');
addFilterRow('JOB_OFFER_TYPE', 'TN');
