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

const videoModal           = document.getElementById('videoModal');
const btnVideoModalConfirm = document.getElementById('btnVideoModalConfirm');
const btnVideoModalCancel  = document.getElementById('btnVideoModalCancel');
const videoCsvList         = document.getElementById('videoCsvList');
const videoModalDesc       = document.getElementById('videoModalDesc');

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

let fileRaw             = null;
let storedFilename      = null;
let chartDataProcessed  = false;
let pendingFile         = null;   // CSV waiting for session modal
let pendingVideoFile    = null;   // MP4 waiting for video modal
let selectedCsvForVideo = null;   // CSV filename chosen in video modal

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes < 1024)         return `${bytes} B`;
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function showToast(msg, type) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = type === 'success' ? 'toast toast--success' : 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 5000);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

// ─── Session Info Modal (CSV) ─────────────────────────────────────────────────

function openSessionModal(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.csv')) {
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
  const radioE = document.querySelector('input[name="storeType"][value="E"]');
  if (radioE) radioE.checked = true;

  sessionModal.hidden = false;
  setTimeout(() => advisorNameInput.focus(), 80);
}

function closeSessionModal() {
  sessionModal.hidden = true;
  pendingFile = null;
  inputRaw.value = '';
}

btnModalCancel.addEventListener('click', closeSessionModal);

sessionModal.addEventListener('click', (e) => {
  if (e.target === sessionModal) closeSessionModal();
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
  const now  = new Date();
  const dd   = String(now.getDate()).padStart(2, '0');
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const dateStr    = `${dd}.${mm}.${yyyy}`;
  const safeName   = name.replace(/[^a-zA-Z0-9äöüÄÖÜß-]/g, '_');
  const newFilename = `${storeType}_${safeName}_${dateStr}.csv`;

  const renamedFile = new File([pendingFile], newFilename, { type: 'text/csv' });
  sessionModal.hidden = true;
  pendingFile = null;
  setFile(renamedFile);
});

advisorNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnModalConfirm.click();
});

// ─── Video Link Modal (MP4) ───────────────────────────────────────────────────

function openVideoModal(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.mp4')) {
    showToast(`"${file.name}" is not an MP4 file.`);
    return;
  }
  if (file.size > 500 * 1024 * 1024) {
    showToast(`File is too large (${formatBytes(file.size)}). Maximum size is 500 MB.`);
    return;
  }

  pendingVideoFile    = file;
  selectedCsvForVideo = null;
  btnVideoModalConfirm.disabled = true;

  videoModalDesc.textContent =
    `Video: "${file.name}" (${formatBytes(file.size)}) — select the CSV session file to link it with.`;

  const csvFiles = currentLibraryFiles.filter(f => f.type === 'csv');
  if (!csvFiles.length) {
    videoCsvList.innerHTML = '<p class="modal__empty">No CSV files in library yet. Please upload a CSV first.</p>';
  } else {
    videoCsvList.innerHTML = '';
    csvFiles.forEach(f => {
      const item = document.createElement('div');
      item.className = 'modal__csv-item';
      item.dataset.filename = f.filename;
      item.innerHTML = `
        <span class="modal__csv-check"></span>
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <span class="modal__csv-item-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
      `;
      item.addEventListener('click', () => {
        videoCsvList.querySelectorAll('.modal__csv-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        selectedCsvForVideo = f.filename;
        btnVideoModalConfirm.disabled = false;
      });
      videoCsvList.appendChild(item);
    });
  }

  videoModal.hidden = false;
}

function closeVideoModal() {
  videoModal.hidden   = true;
  pendingVideoFile    = null;
  selectedCsvForVideo = null;
  inputRaw.value      = '';
}

btnVideoModalCancel.addEventListener('click', closeVideoModal);

videoModal.addEventListener('click', (e) => {
  if (e.target === videoModal) closeVideoModal();
});

btnVideoModalConfirm.addEventListener('click', async () => {
  if (!pendingVideoFile || !selectedCsvForVideo) return;

  btnVideoModalConfirm.disabled    = true;
  btnVideoModalConfirm.textContent = 'Uploading…';

  try {
    const formData = new FormData();
    formData.append('video', pendingVideoFile);
    formData.append('linkedCsv', selectedCsvForVideo);

    const res    = await fetch('/api/upload-video', { method: 'POST', body: formData });
    const result = await res.json();

    if (!res.ok || !result.success) {
      showToast(`Upload failed: ${result.error || 'Unknown error'}`);
      btnVideoModalConfirm.disabled = false;
      btnVideoModalConfirm.innerHTML =
        'Upload Video <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>';
      return;
    }

    videoModal.hidden   = true;
    pendingVideoFile    = null;
    selectedCsvForVideo = null;
    inputRaw.value      = '';

    showToast('Video uploaded and linked successfully.', 'success');
    await refreshFileLibrary();
  } catch (err) {
    showToast(`Network error: ${err.message}`);
    btnVideoModalConfirm.disabled = false;
  }

  btnVideoModalConfirm.innerHTML =
    'Upload Video <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>';
});

// ─── Global Escape key handler ────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!sessionModal.hidden) closeSessionModal();
    if (!videoModal.hidden)   closeVideoModal();
  }
});

// ─── File selection dispatcher ────────────────────────────────────────────────

function dispatchFile(file) {
  if (!file) return;
  if (file.name.toLowerCase().endsWith('.mp4')) {
    openVideoModal(file);
  } else {
    openSessionModal(file);
  }
}

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
  renderFileLibrary(currentLibraryFiles);
}

// ─── Input change listeners ───────────────────────────────────────────────────

inputRaw.addEventListener('change', () => {
  if (inputRaw.files[0]) dispatchFile(inputRaw.files[0]);
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
    if (file) dispatchFile(file);
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
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ filename: storedFilename }),
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
    const isVideo  = f.type === 'video';
    const isActive = !isVideo && storedFilename === f.filename;
    const date = new Date(f.uploadedAt).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const item = document.createElement('div');
    item.className = `file-library__item${isActive ? ' active' : ''}${isVideo ? ' file-library__item--video' : ''}`;

    const iconSvg = isVideo
      ? `<svg class="icon file-library__item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <polygon points="23 7 16 12 23 17 23 7"/>
           <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
         </svg>`
      : `<svg class="icon file-library__item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
           <polyline points="14 2 14 8 20 8"/>
         </svg>`;

    const linkedCsvHtml = (isVideo && f.linkedCsv)
      ? `<div class="file-library__linked-csv">&#128279; ${escapeHtml(f.linkedCsv)}</div>`
      : '';

    const actionsHtml = isVideo
      ? `<div class="file-library__actions">
           <button class="btn-delete-file">Delete</button>
         </div>`
      : `<div class="file-library__actions">
           <button class="btn-select-file" ${isActive ? 'disabled' : ''}>${isActive ? 'Selected' : 'Select'}</button>
           <button class="btn-delete-file">Delete</button>
         </div>`;

    item.innerHTML = `
      ${iconSvg}
      <div class="file-library__item-info">
        <div class="file-library__item-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
        <div class="file-library__item-meta">${escapeHtml(formatBytes(f.size))} · ${escapeHtml(date)}</div>
        ${linkedCsvHtml}
      </div>
      ${actionsHtml}
    `;

    if (!isVideo) {
      item.querySelector('.btn-select-file').addEventListener('click', () => {
        selectStoredFile(f.filename, f.name, f.size);
      });
    }

    item.querySelector('.btn-delete-file').addEventListener('click', () => {
      deleteStoredFile(f.filename);
    });

    list.appendChild(item);
  });
}

async function selectStoredFile(filename, displayName, size) {
  storedFilename          = filename;
  fileRaw                 = null;
  filenameRaw.textContent = displayName;
  filesizeRaw.textContent = formatBytes(size);
  labelRaw.hidden         = true;
  previewRaw.hidden       = false;
  zoneRaw.classList.add('has-file');
  updateProgress();
  renderFileLibrary(currentLibraryFiles);

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
    if (storedFilename === filename) clearFile();
    await refreshFileLibrary();
  } catch (err) {
    showToast(`Network error: ${err.message}`);
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

updateProgress();

if (sessionStorage.getItem('chartData')) {
  chartDataProcessed = true;
  enableChartButtons();
}

refreshFileLibrary();