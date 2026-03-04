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

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Column widths (px) for the fixed-layout preview table
// Total ≈ 1520px → matches min-width in CSS
const COL_WIDTHS = {
  id: 55,
  title: 220,
  company: 170,
  location: 90,
  state: 115,
  zip: 55,
  posted_at: 90,
  working_time: 80,
  employment_type: 155,
  job_offer_type: 90,
  education: 160,
  description: 275,
  url: 65,
};

const DESC_LIMIT = 220;

function renderPreview(rows) {
  const table = document.getElementById('previewTable');
  table.innerHTML = '';

  if (!rows.length) {
    table.innerHTML = '<tr><td>Keine Treffer.</td></tr>';
    return;
  }

  const columns = Object.keys(rows[0]);

  // Colgroup: explicit column widths so table-layout:fixed gives predictable results
  const cg = document.createElement('colgroup');
  columns.forEach((c) => {
    const col = document.createElement('col');
    col.style.width = (COL_WIDTHS[c] ?? 100) + 'px';
    cg.appendChild(col);
  });
  table.appendChild(cg);

  // Header
  const head = document.createElement('tr');
  head.innerHTML = columns.map((c) => `<th title="${escHtml(c)}">${escHtml(c)}</th>`).join('');
  table.appendChild(head);

  // Body rows
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    columns.forEach((col) => {
      const td = document.createElement('td');
      const val = String(row[col] ?? '');

      if (col === 'description' && val.length > DESC_LIMIT) {
        td.className = 'col-desc';
        const short = escHtml(val.slice(0, DESC_LIMIT));
        const full = escHtml(val);
        td.innerHTML =
          `<span class="desc-short">${short}&hellip;</span>` +
          `<span class="desc-full" style="display:none">${full}</span>` +
          `<button class="desc-btn" type="button">▾ mehr</button>`;
      } else if (col === 'url') {
        td.innerHTML = `<a href="${escHtml(val)}" target="_blank" rel="noopener noreferrer">Öffnen ↗</a>`;
      } else {
        td.textContent = val;
      }

      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
}

// Description expand/collapse via event delegation
document.getElementById('previewTable').addEventListener('click', (e) => {
  if (!e.target.classList.contains('desc-btn')) return;
  const btn = e.target;
  const td = btn.closest('td');
  const sh = td.querySelector('.desc-short');
  const fu = td.querySelector('.desc-full');
  const expanded = fu.style.display !== 'none';
  sh.style.display = expanded ? '' : 'none';
  fu.style.display = expanded ? 'none' : '';
  btn.textContent = expanded ? '▾ mehr' : '▴ weniger';
});

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
