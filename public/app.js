'use strict';

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const inputRaw        = document.getElementById('inputRaw');
const inputCumulated  = document.getElementById('inputCumulated');

const zoneRaw         = document.getElementById('zoneRaw');
const zoneCumulated   = document.getElementById('zoneCumulated');

const labelRaw        = document.getElementById('labelRaw');
const labelCumulated  = document.getElementById('labelCumulated');

const previewRaw      = document.getElementById('previewRaw');
const previewCumulated= document.getElementById('previewCumulated');

const filenameRaw     = document.getElementById('filenameRaw');
const filenameCumulated = document.getElementById('filenameCumulated');
const filesizeRaw     = document.getElementById('filesizeRaw');
const filesizeCumulated = document.getElementById('filesizeCumulated');

const removeRaw       = document.getElementById('removeRaw');
const removeCumulated = document.getElementById('removeCumulated');

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

const dotRaw          = document.getElementById('dotRaw');
const dotCumulated    = document.getElementById('dotCumulated');
const dotGenerate     = document.getElementById('dotGenerate');
const stepRaw         = document.getElementById('stepRaw');
const stepCumulated   = document.getElementById('stepCumulated');
const stepGenerate    = document.getElementById('stepGenerate');

const lines           = document.querySelectorAll('.upload-progress__line');

// ─── State ────────────────────────────────────────────────────────────────────

let fileRaw       = null;
let fileCumulated = null;

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
  const hasCum = !!fileCumulated;
  const both   = hasRaw && hasCum;

  // Step: Raw
  stepRaw.classList.toggle('done',   hasRaw);
  stepRaw.classList.toggle('active', !hasRaw);

  // Step: Cumulated
  stepCumulated.classList.toggle('done',   hasCum);
  stepCumulated.classList.toggle('active', !hasCum && hasRaw);

  // Step: Generate
  stepGenerate.classList.toggle('active', both);
  stepGenerate.classList.remove('done');

  // Lines
  lines[0].classList.toggle('done',   hasRaw);
  lines[0].classList.toggle('active', !hasRaw);
  lines[1].classList.toggle('done',   both);
  lines[1].classList.toggle('active', hasCum && !both);

  // Button
  btnGenerate.disabled = !both;
  generateHint.textContent = both
    ? 'Both files ready — click to generate your PDF report.'
    : !hasRaw && !hasCum
      ? 'Please upload both CSV files to enable report generation.'
      : !hasRaw
        ? 'Please upload the Raw CSV file.'
        : 'Please upload the Cumulated CSV file.';
}

// ─── File selection ───────────────────────────────────────────────────────────

function setFile(type, file) {
  if (!file) return;

  if (!file.name.endsWith('.csv')) {
    showToast(`"${file.name}" is not a CSV file. Please select a .csv file.`);
    return;
  }

  if (file.size > 50 * 1024 * 1024) {
    showToast(`File is too large (${formatBytes(file.size)}). Maximum size is 50 MB.`);
    return;
  }

  if (type === 'raw') {
    fileRaw = file;
    filenameRaw.textContent  = file.name;
    filesizeRaw.textContent  = formatBytes(file.size);
    labelRaw.hidden          = true;
    previewRaw.hidden        = false;
    zoneRaw.classList.add('has-file');
  } else {
    fileCumulated = file;
    filenameCumulated.textContent = file.name;
    filesizeCumulated.textContent = formatBytes(file.size);
    labelCumulated.hidden         = true;
    previewCumulated.hidden       = false;
    zoneCumulated.classList.add('has-file');
  }

  updateProgress();
}

function clearFile(type) {
  if (type === 'raw') {
    fileRaw                  = null;
    inputRaw.value           = '';
    labelRaw.hidden          = false;
    previewRaw.hidden        = true;
    zoneRaw.classList.remove('has-file');
  } else {
    fileCumulated            = null;
    inputCumulated.value     = '';
    labelCumulated.hidden    = false;
    previewCumulated.hidden  = true;
    zoneCumulated.classList.remove('has-file');
  }
  updateProgress();
}

// ─── Input change listeners ───────────────────────────────────────────────────

inputRaw.addEventListener('change', () => {
  if (inputRaw.files[0]) setFile('raw', inputRaw.files[0]);
});

inputCumulated.addEventListener('change', () => {
  if (inputCumulated.files[0]) setFile('cumulated', inputCumulated.files[0]);
});

removeRaw.addEventListener('click', (e) => {
  e.preventDefault();
  clearFile('raw');
});

removeCumulated.addEventListener('click', (e) => {
  e.preventDefault();
  clearFile('cumulated');
});

// ─── Drag & drop ──────────────────────────────────────────────────────────────

function setupDragDrop(zone, type) {
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
    if (file) setFile(type, file);
  });
}

setupDragDrop(zoneRaw, 'raw');
setupDragDrop(zoneCumulated, 'cumulated');

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
  if (!fileRaw || !fileCumulated) return;

  // Hide previous result
  resultCard.hidden = true;

  startLoadingAnimation();

  const formData = new FormData();
  formData.append('raw', fileRaw);
  formData.append('cumulated', fileCumulated);

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
    lines[1].classList.add('done');

    resultCard.hidden = false;
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    stopLoadingAnimation();
    showToast(`Network error: ${err.message}`);
  }
});

// ─── Reset ────────────────────────────────────────────────────────────────────

btnReset.addEventListener('click', () => {
  clearFile('raw');
  clearFile('cumulated');
  resultCard.hidden = true;
  stepGenerate.classList.remove('done', 'active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

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