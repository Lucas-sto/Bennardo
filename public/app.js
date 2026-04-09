'use strict';

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const inputRaw        = document.getElementById('inputRaw');
const zoneRaw         = document.getElementById('zoneRaw');
const labelRaw        = document.getElementById('labelRaw');
const previewRaw      = document.getElementById('previewRaw');
const filenameRaw     = document.getElementById('filenameRaw');
const filesizeRaw     = document.getElementById('filesizeRaw');
const removeRaw       = document.getElementById('removeRaw');

const btnGenerate     = document.getElementById('btnGenerate');
const generateHint    = document.getElementById('generateHint');

const loadingOverlay  = document.getElementById('loadingOverlay');
const loadingStep     = document.getElementById('loadingStep');
const loadingBarFill  = document.getElementById('loadingBarFill');

const resultCard      = document.getElementById('resultCard');
const resultSub       = document.getElementById('resultSub');
const btnDownload     = document.getElementById('btnDownload');
const btnReset        = document.getElementById('btnReset');
const statsGrid       = document.getElementById('statsGrid');

const stepRaw         = document.getElementById('stepRaw');
const stepGenerate    = document.getElementById('stepGenerate');

const lines           = document.querySelectorAll('.upload-progress__line');

// ─── State ────────────────────────────────────────────────────────────────────

let fileRaw = null;
let chartDataProcessed = false;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
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
  const hasRaw = !!fileRaw;

  // Step: Raw
  stepRaw.classList.toggle('done',   hasRaw);
  stepRaw.classList.toggle('active', !hasRaw);

  // Step: Generate
  stepGenerate.classList.toggle('active', hasRaw);
  stepGenerate.classList.remove('done');

  // Line
  lines[0].classList.toggle('done',   hasRaw);
  lines[0].classList.toggle('active', !hasRaw);

  // Button
  btnGenerate.disabled = !hasRaw;
  generateHint.textContent = hasRaw
    ? 'Raw file ready — click to generate your PDF report. Cumulative metrics will be computed automatically.'
    : 'Please upload the raw fixations CSV file to enable report generation.';
}

// ─── File selection ───────────────────────────────────────────────────────────

async function setFile(file) {
  if (!file) return;

  if (!file.name.endsWith('.csv')) {
    showToast(`"${file.name}" is not a CSV file. Please select a .csv file.`);
    return;
  }

  if (file.size > 50 * 1024 * 1024) {
    showToast(`File is too large (${formatBytes(file.size)}). Maximum size is 50 MB.`);
    return;
  }

  fileRaw = file;
  filenameRaw.textContent  = file.name;
  filesizeRaw.textContent  = formatBytes(file.size);
  labelRaw.hidden          = true;
  previewRaw.hidden        = false;
  zoneRaw.classList.add('has-file');

  updateProgress();
  
  // Process chart data in background
  await processChartData(file);
}

function clearFile() {
  fileRaw                  = null;
  inputRaw.value           = '';
  labelRaw.hidden          = false;
  previewRaw.hidden        = true;
  zoneRaw.classList.remove('has-file');
  disableChartButtons();
  updateProgress();
}

// ─── Input change listeners ───────────────────────────────────────────────────

inputRaw.addEventListener('change', () => {
  if (inputRaw.files[0]) setFile(inputRaw.files[0]);
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
    if (file) setFile(file);
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
  if (!fileRaw) return;

  // Hide previous result
  resultCard.hidden = true;

  startLoadingAnimation();

  const formData = new FormData();
  formData.append('raw', fileRaw);

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();

    stopLoadingAnimation();

    if (!res.ok || !data.success) {
      showToast(`Error: ${data.error || 'Unknown server error'}`);
      return;
    }

    // ── Show result ──────────────────────────────────────────────────────────
    btnDownload.href        = data.pdfUrl;
    btnDownload.download    = data.pdfName;
    resultSub.textContent   = `Report "${data.pdfName}" generated successfully.`;

    // Stats
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

    // Mark generate step as done
    stepGenerate.classList.remove('active');
    stepGenerate.classList.add('done');
    if (lines[0]) lines[0].classList.add('done');

    resultCard.hidden = false;
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

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
    const res = await fetch('/api/process', {
      method: 'POST',
      body: formData,
    });

    const result = await res.json();

    if (!res.ok || !result.success) {
      console.error('Chart data processing failed:', result.error);
      return;
    }

    // Store chart data in sessionStorage
    sessionStorage.setItem('chartData', JSON.stringify(result.data));
    chartDataProcessed = true;

    // Enable all "View Chart" buttons
    enableChartButtons();

  } catch (err) {
    console.error('Chart data processing error:', err);
  }
}

function enableChartButtons() {
  const buttons = document.querySelectorAll('.btn-view-chart');
  buttons.forEach(btn => {
    btn.disabled = false;
    btn.addEventListener('click', handleViewChart);
  });
}

function disableChartButtons() {
  const buttons = document.querySelectorAll('.btn-view-chart');
  buttons.forEach(btn => {
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

// Check if chart data is already in sessionStorage
if (sessionStorage.getItem('chartData')) {
  chartDataProcessed = true;
  enableChartButtons();
  
  // Show visual indicator that data is loaded from previous session
  filenameRaw.textContent = 'Data from previous upload';
  filesizeRaw.textContent = 'Session data available';
  labelRaw.hidden = true;
  previewRaw.hidden = false;
  zoneRaw.classList.add('has-file');
  
  // Mark as if file is present for progress indicator
  fileRaw = { name: 'session-data' }; // Dummy file object
  updateProgress();
}
