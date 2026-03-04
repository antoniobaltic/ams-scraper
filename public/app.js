const runBtn = document.getElementById('run');
const statusEl = document.getElementById('status');
const resultCard = document.getElementById('resultCard');
const csvBtn = document.getElementById('csvBtn');
const xlsxBtn = document.getElementById('xlsxBtn');

let latestRows = [];

function sammleFilter() {
  const filterMap = new Map();
  const aktiveElemente = document.querySelectorAll('input[data-filter-key]');

  aktiveElemente.forEach((input) => {
    const key = input.dataset.filterKey;
    if (!key) return;

    const istCheckbox = input.type === 'checkbox';
    const istRadio = input.type === 'radio';

    if (istCheckbox && !input.checked) return;
    if (istRadio && !input.checked) return;

    const value = String(input.value || '').trim();
    if (!value) return;

    if (!filterMap.has(key)) filterMap.set(key, []);
    filterMap.get(key).push(value);
  });

  return [...filterMap.entries()].flatMap(([key, values]) => values.map((value) => ({ key, value })));
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
  const esc = (v) => {
    const value = String(v ?? '');
    if (value.includes('"') || value.includes(',') || value.includes('\n')) {
      return `"${value.replaceAll('"', '""')}"`;
    }
    return value;
  };
  const lines = [headers.join(',')];
  rows.forEach((row) => lines.push(headers.map((h) => esc(row[h])).join(',')));
  return lines.join('\n');
}

csvBtn.addEventListener('click', () => {
  downloadBlob(toCsv(latestRows), 'ams_jobs.csv', 'text/csv;charset=utf-8');
});

xlsxBtn.addEventListener('click', () => {
  if (!latestRows.length) return;
  const worksheet = XLSX.utils.json_to_sheet(latestRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'jobs');
  XLSX.writeFile(workbook, 'ams_jobs.xlsx');
});

runBtn.addEventListener('click', async () => {
  statusEl.textContent = 'Suche läuft ...';
  runBtn.disabled = true;

  const payload = {
    query: document.getElementById('query').value,
    location: document.getElementById('location').value,
    radius: document.getElementById('radius').value,
    max_pages: Number(document.getElementById('maxPages').value),
    max_jobs: Number(document.getElementById('maxJobs').value),
    filters: sammleFilter(),
  };

  try {
    const res = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Suche fehlgeschlagen');

    latestRows = data.rows || [];
    resultCard.hidden = false;
    document.getElementById('summary').textContent = `${data.job_count} Jobs extrahiert.`;
    document.getElementById('searchUrl').textContent = data.search_url;

    const errorsEl = document.getElementById('errors');
    errorsEl.innerHTML = '';
    if (data.errors?.length) {
      errorsEl.innerHTML = `<p id="error"><strong>Hinweise:</strong><br>${data.errors.join('<br>')}</p>`;
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
