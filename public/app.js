'use strict';

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const inputRaw         = document.getElementById('inputRaw');
const zoneRaw          = document.getElementById('zoneRaw');
const labelRaw         = document.getElementById('labelRaw');
const previewRaw       = document.getElementById('previewRaw');
const filenameRaw      = document.getElementById('filenameRaw');
const filesizeRaw      = document.getElementById('filesizeRaw');
const removeRaw        = document.getElementById('removeRaw');

const sessionModal     = document.getElementById('sessionModal');
const btnModalConfirm  = document.getElementById('btnModalConfirm');
const btnModalCancel   = document.getElementById('btnModalCancel');
const advisorNameInput = document.getElementById('advisorName');

const btnGenerate      = document.getElementById('btnGenerate');
const generateHint     = document.getElementById('generateHint');

const loadingOverlay   = document.getElementById('loadingOverlay');
const loadingStep      = document.getElementById('loadingStep');
const loadingBarFill   = document.getElementById('loadingBarFill');

const resultCard       = document.getElementById('resultCard');
const resultSub        = document.getElementById('resultSub');
const btnDownload      = document.getElementById('btnDownload');
const btnReset         = document.getElementById('btnReset');
const statsGrid        = document.getElementById('statsGrid');

const stepRaw          = document.getElementById('stepRaw');
const stepGenerate     = document.getElementById('stepGenerate');

const lines            = document.querySelectorAll('.upload-progress__line');

// ─── State ────────────────────────────────────────────────────────────────────

let fileRaw            = null;
let storedFilename     = null; // filename in /uploads/ of the currently active file
let chartDataProcessed = false;
let pendingFile        = null; // file waiting for session info modal confirmation

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes < 1024)         return `${bytes} B`;
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 5000);
}

// ─── Progress indicator ───────────────────────────────────────────────────────

function updateProgress() {
  const hasFile = !!(fileRaw || storedFilename);

  stepRaw.classList.toggle('done',   hasFile);
  stepRaw.classList.toggle('active', !hasFile);

  stepGenerate.classList.toggle('active', hasFile);
  stepGenerate.classList.remove('done');

  lines[0].classList.toggle('done',   hasFile);
  lines[0].classList.toggle('active', !hasFile);

  btnGenerate.disabled = !hasFile;
  generateHint.textContent = hasFile
    ? 'File ready — click to generate your PDF report. Cumulative metrics will be computed automatically.'
    : 'Please upload a CSV file or select one from the library to enable report generation.';
}

// ─── Session Info Modal ───────────────────────────────────────────────────────

function openSessionModal(file) {
  if (!file) return;

  // Basic validation before showing modal
  if (!file.name.endsWith('.csv')) {
    showToast(`"${file.name}" is not a CSV file. Please select a .csv file.`);
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    showToast(`File is too large (${formatBytes(file.size)}). Maximum size is 50 MB.`);
    return;
  }

  pendingFile = file;
  advisorNameInput.value = '';
  advisorNameInput.classList.remove('input--error');
  // Reset radio to E
  const radioE = document.querySelector('input[name="storeType"][value="E"]');
  if (radioE) radioE.checked = true;

  sessionModal.hidden = false;
  // Focus name input after transition
  setTimeout(() => advisorNameInput.focus(), 80);
}

function closeSessionModal() {
  sessionModal.hidden = true;
  pendingFile = null;
  // Reset file input so the same file can be re-selected if cancelled
  inputRaw.value = '';
}

btnModalCancel.addEventListener('click', closeSessionModal);

// Close on backdrop click
sessionModal.addEventListener('click', (e) => {
  if (e.target === sessionModal) closeSessionModal();
});

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !sessionModal.hidden) closeSessionModal();
});

btnModalConfirm.addEventListener('click', () => {
  const name = advisorNameInput.value.trim();
  if (!name) {
    advisorNameInput.classList.add('input--error');
    advisorNameInput.focus();
    showToast('Please enter the advisor name.');
    return;
  }
  advisorNameInput.classList.remove('input--error');

  const storeType = document.querySelector('input[name="storeType"]:checked').value;

  // Build date string DD.MM.YYYY
  const now  = new Date();
  const dd   = String(now.getDate()).padStart(2, '0');
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const dateStr = `${dd}.${mm}.${yyyy}`;

  // Sanitize name: keep letters, digits, hyphens; replace everything else with _
  const safeName    = name.replace(/[^a-zA-Z0-9äöüÄÖÜß-]/g, '_');
  const newFilename = `${storeType}_${safeName}_${dateStr}.csv`;

  const renamedFile = new File([pendingFile], newFilename, { type: 'text/csv' });

  sessionModal.hidden = true;
  pendingFile = null;

  setFile(renamedFile);
});

// Allow submitting with Enter in the name field
advisorNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnModalConfirm.click();
});

// ─── File selection (new upload) ──────────────────────────────────────────────

async function setFile(file) {
  if (!file) return;

  fileRaw = file;
  filenameRaw.textContent = file.name;
  filesizeRaw.textContent = formatBytes(file.size);
  labelRaw.hidden         = true;
  previewRaw.hidden       = false;
  zoneRaw.classList.add('has-file');

  updateProgress();
  await processChartData(file);
}

function clearFile() {
  fileRaw            = null;
  storedFilename     = null;
  inputRaw.value     = '';
  labelRaw.hidden    = false;
  previewRaw.hidden  = true;
  zoneRaw.classList.remove('has-file');
  disableChartButtons();
  updateProgress();
  renderFileLibrary(currentLibraryFiles); // refresh active state in library
}

// ─── Input change listeners ───────────────────────────────────────────────────

inputRaw.addEventListener('change', () => {
  if (inputRaw.files[0]) openSessionModal(inputRaw.files[0]);
});

removeRaw.addEventListener('click', (e) => {
  e.preventDefault();
  clearFile();
});

// ─── Drag & drop ──────────────────────────────────────────────────────────────

function setupDragDrop(zone) {
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('drag-over');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) openSessionModal(file);
  });
}

setupDragDrop(zoneRaw);

// ─── Loading animation ────────────────────────────────────────────────────────

const LOADING_STEPS = [
  { text: 'Parsing CSV data…',              pct: 15 },
  { text: 'Analysing fixation durations…',  pct: 30 },
  { text: 'Computing gaze scatter data…',   pct: 45 },
  { text: 'Calculating AOI dwell times…',   pct: 58 },
  { text: 'Rendering charts (1/3)…',        pct: 68 },
  { text: 'Rendering charts (2/3)…',        pct: 78 },
  { text: 'Rendering charts (3/3)…',        pct: 88 },
  { text: 'Building PDF document…',         pct: 95 },
];

let loadingTimer = null;

function startLoadingAnimation() {
  loadingOverlay.hidden = false;
  loadingBarFill.style.width = '0%';
  loadingStep.textContent = LOADING_STEPS[0].text;

  let idx = 0;
  loadingTimer = setInterval(() => {
    idx = Math.min(idx + 1, LOADING_STEPS.length - 1);
    loadingStep.textContent    = LOADING_STEPS[idx].text;
    loadingBarFill.style.width = LOADING_STEPS[idx].pct + '%';
    if (idx === LOADING_STEPS.length - 1) clearInterval(loadingTimer);
  }, 900);
}

function stopLoadingAnimation() {
  clearInterval(loadingTimer);
  loadingBarFill.style.width = '100%';
  setTimeout(() => { loadingOverlay.hidden = true; }, 400);
}

// ─── Generate ─────────────────────────────────────────────────────────────────

btnGenerate.addEventListener('click', async () => {
  if (!fileRaw && !storedFilename) return;

  resultCard.hidden = true;
  startLoadingAnimation();

  try {
    let res;

    if (storedFilename) {
      res = await fetch('/api/generate-stored', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: storedFilename }),
      });
    } else {
      const formData = new FormData();
      formData.append('raw', fileRaw);
      res = await fetch('/api/generate', { method: 'POST', body: formData });
    }

    const data = await res.json();
    stopLoadingAnimation();

    if (!res.ok || !data.success) {
      showToast(`Error: ${data.error || 'Unknown server error'}`);
      return;
    }

    btnDownload.href      = data.pdfUrl;
    btnDownload.download  = data.pdfName;
    resultSub.textContent = `Report "${data.pdfName}" generated successfully.`;

    statsGrid.innerHTML = '';
    if (data.stats) {
      Object.entries(data.stats).forEach(([key, val]) => {
        const item = document.createElement('div');
        item.className = 'stat-item';
        item.innerHTML = `
          <div class="stat-item__key">${escapeHtml(key)}</div>
          <div class="stat-item__val">${escapeHtml(String(val))}</div>
        `;
        statsGrid.appendChild(item);
      });
    }

    stepGenerate.classList.remove('active');
    stepGenerate.classList.add('done');
    if (lines[0]) lines[0].classList.add('done');

    resultCard.hidden = false;
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Refresh library in case a new file was stored
    await refreshFileLibrary();

  } catch (err) {
    stopLoadingAnimation();
    showToast(`Network error: ${err.message}`);
  }
});

// ─── Reset ────────────────────────────────────────────────────────────────────

btnReset.addEventListener('click', () => {
  clearFile();
  resultCard.hidden = true;
  stepGenerate.classList.remove('done', 'active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ─── Chart Data Processing ────────────────────────────────────────────────────

async function processChartData(file) {
  const formData = new FormData();
  formData.append('raw', file);

  try {
    const res    = await fetch('/api/process', { method: 'POST', body: formData });
    const result = await res.json();

    if (!res.ok || !result.success) {
      console.error('Chart data processing failed:', result.error);
      return;
    }

    sessionStorage.setItem('chartData', JSON.stringify(result.data));
    storedFilename     = result.storedFilename;
    chartDataProcessed = true;

    enableChartButtons();
    await refreshFileLibrary();
  } catch (err) {
    console.error('Chart data processing error:', err);
  }
}

function enableChartButtons() {
  document.querySelectorAll('.btn-view-chart').forEach(btn => {
    btn.disabled = false;
    btn.addEventListener('click', handleViewChart);
  });
}

function disableChartButtons() {
  document.querySelectorAll('.btn-view-chart').forEach(btn => {
    btn.disabled = true;
    btn.removeEventListener('click', handleViewChart);
  });
  chartDataProcessed = false;
  sessionStorage.removeItem('chartData');
}

function handleViewChart(e) {
  const chartId = e.target.dataset.chartId;
  if (chartId && chartDataProcessed) {
    window.location.href = `chart.html?chart=${chartId}`;
  }
}

// ─── File Library ─────────────────────────────────────────────────────────────

let currentLibraryFiles = [];

async function refreshFileLibrary() {
  try {
    const res  = await fetch('/api/files');
    const data = await res.json();
    currentLibraryFiles = data.files || [];
    renderFileLibrary(currentLibraryFiles);
  } catch (err) {
    console.error('Failed to load file library:', err);
  }
}

function renderFileLibrary(files) {
  const container = document.getElementById('fileLibrary');
  const list      = document.getElementById('fileLibraryList');
  const countEl   = document.getElementById('fileLibraryCount');

  if (!files.length) {
    container.hidden = true;
    return;
  }

  container.hidden = false;
  countEl.textContent = `${files.length} file${files.length !== 1 ? 's' : ''}`;

  list.innerHTML = '';
  files.forEach(f => {
    const isActive = storedFilename === f.filename;
    const date = new Date(f.uploadedAt).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const item = document.createElement('div');
    item.className = `file-library__item${isActive ? ' active' : ''}`;
    item.innerHTML = `
      <svg class="icon file-library__item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <div class="file-library__item-info">
        <div class="file-library__item-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
        <div class="file-library__item-meta">${escapeHtml(formatBytes(f.size))} · ${escapeHtml(date)}</div>
      </div>
      <div class="file-library__actions">
        <button class="btn-select-file" ${isActive ? 'disabled' : ''}>${isActive ? 'Selected' : 'Select'}</button>
        <button class="btn-delete-file">Delete</button>
      </div>
    `;

    item.querySelector('.btn-select-file').addEventListener('click', () => {
      selectStoredFile(f.filename, f.name, f.size);
    });

    item.querySelector('.btn-delete-file').addEventListener('click', () => {
      deleteStoredFile(f.filename);
    });

    list.appendChild(item);
  });
}

async function selectStoredFile(filename, displayName, size) {
  // Update upload zone UI to reflect selected file
  storedFilename          = filename;
  fileRaw                 = null;
  filenameRaw.textContent = displayName;
  filesizeRaw.textContent = formatBytes(size);
  labelRaw.hidden         = true;
  previewRaw.hidden       = false;
  zoneRaw.classList.add('has-file');
  updateProgress();
  renderFileLibrary(currentLibraryFiles); // immediately show selected state

  // Process chart data for the selected file
  disableChartButtons();
  try {
    const res    = await fetch('/api/process-stored', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ filename }),
    });
    const result = await res.json();

    if (!res.ok || !result.success) {
      showToast(`Error: ${result.error || 'Processing failed'}`);
      return;
    }

    sessionStorage.setItem('chartData', JSON.stringify(result.data));
    chartDataProcessed = true;
    enableChartButtons();
  } catch (err) {
    showToast(`Network error: ${err.message}`);
  }
}

async function deleteStoredFile(filename) {
  try {
    const res = await fetch(`/api/files/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    if (!res.ok) {
      showToast('Failed to delete file.');
      return;
    }
    if (storedFilename === filename) {
      clearFile();
    }
    await refreshFileLibrary();
  } catch (err) {
    showToast(`Network error: ${err.message}`);
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Init ─────────────────────────────────────────────────────────────────────

updateProgress();

// Re-enable chart buttons if data is still in session storage
if (sessionStorage.getItem('chartData')) {
  chartDataProcessed = true;
  enableChartButtons();
}

// Load file library on startup
refreshFileLibrary();