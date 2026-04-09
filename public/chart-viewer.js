'use strict';

// ─── Animation State ──────────────────────────────────────────────────────────

const TIME_SERIES_CHARTS = new Set([3, 4, 6, 9, 10, 11, 12, 13, 14]);

const animState = {
  playing: false,
  currentSecond: 0,
  maxSecond: 0,
  speed: 1,
  timerId: null,
  applyFn: null,      // Called with (second) on each animation tick
};

// ─── Color Palette ────────────────────────────────────────────────────────────

const PALETTE = [
  '#4F81BD', '#C0504D', '#9BBB59', '#8064A2',
  '#4BACC6', '#F79646', '#2C4770', '#A31515',
  '#00B050', '#FF6600',
];

const rgba = (hex, a) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

// ─── DOM Elements ─────────────────────────────────────────────────────────────

const chartTitle = document.getElementById('chartTitle');
const chartSubtitle = document.getElementById('chartSubtitle');
const chartCanvasWrapper = document.getElementById('chartCanvasWrapper');
const chartCanvas = document.getElementById('chartCanvas');
const chartTableWrapper = document.getElementById('chartTableWrapper');
const chartTable = document.getElementById('chartTable');
const chartError = document.getElementById('chartError');

let chartInstance = null;

// ─── Chart Metadata ───────────────────────────────────────────────────────────

const CHART_META = {
  1: { title: 'Fixations per Product', subtitle: 'Bar chart · Intra-Product · Total fixation count per product', type: 'bar' },
  2: { title: 'Dwell Time per Product', subtitle: 'Bar chart · Intra-Product · Total dwell time (ms) per product', type: 'bar' },
  3: { title: 'Fixations per Product over Time', subtitle: 'Line chart · Intra-Product · Fixation counts in 10-second buckets', type: 'line-time' },
  4: { title: 'Dwell Time per Product over Time', subtitle: 'Line chart · Intra-Product · Dwell time in 10-second buckets', type: 'line-time' },
  5: { title: 'Percentage Looked at Product Features', subtitle: 'Pie chart · Inter-Product · Share of fixations per feature', type: 'pie' },
  6: { title: 'Feature Attention Distribution over Time', subtitle: 'Line chart · Inter-Product · Cumulative dwell-time share (%) per feature', type: 'line-feature-time' },
  7: { title: 'Pupil Dilation per Product', subtitle: 'Table · Inter-Product · Duration-weighted average pupil diameter', type: 'table-pupil' },
  8: { title: 'Product Comparison Behaviour', subtitle: 'Table · Inter-Product · Most compared product pairs (A→B→A)', type: 'table-comparison' },
  9: { title: 'Cumulative Unique Products Viewed over Time', subtitle: 'Line chart · Inter-Product · Distinct products seen', type: 'line-single' },
  10: { title: 'Cumulative Total Product Views over Time', subtitle: 'Line chart · Inter-Product · Total views including revisits', type: 'line-single' },
  11: { title: 'Rolling Mean Saccade Speed over Time', subtitle: 'Line chart · Inter-Product · 10-second rolling window', type: 'line-single' },
  12: { title: 'Average Fixation Duration over Time', subtitle: 'Line chart · Inter-Product · Cumulative and rolling averages', type: 'line-dual' },
  13: { title: 'Variance of Fixation Duration over Time', subtitle: 'Line chart · Inter-Product · Cumulative and rolling variance', type: 'line-dual' },
  14: { title: 'Variance of Total Visit Duration per Product over Time', subtitle: 'Line chart · Inter-Product · Cumulative and rolling variance', type: 'line-dual' },
  15: { title: 'Max Revisit per Product', subtitle: 'Horizontal bar chart · Inter-Product · Revisit counts', type: 'bar-horizontal' },
};

// ─── Initialize ───────────────────────────────────────────────────────────────

function init() {
  const params = new URLSearchParams(window.location.search);
  const chartId = parseInt(params.get('chart'));

  if (!chartId || !CHART_META[chartId]) {
    showError('Invalid chart ID');
    return;
  }

  const chartData = sessionStorage.getItem('chartData');
  if (!chartData) {
    showError();
    return;
  }

  try {
    const data = JSON.parse(chartData);
    renderChart(chartId, data);
  } catch (err) {
    console.error('Chart rendering error:', err);
    showError('Error rendering chart: ' + err.message);
  }
}

// ─── Show Error ───────────────────────────────────────────────────────────────

function showError(message) {
  chartCanvasWrapper.hidden = true;
  chartTableWrapper.hidden = true;
  chartError.hidden = false;
  if (message) {
    chartError.querySelector('p').textContent = message;
  }
}

// ─── Render Chart ─────────────────────────────────────────────────────────────

function renderChart(chartId, data) {
  const meta = CHART_META[chartId];
  chartTitle.textContent = meta.title;
  chartSubtitle.textContent = meta.subtitle;

  switch (chartId) {
    case 1: renderFixationsPerProduct(data); break;
    case 2: renderDwellTimePerProduct(data); break;
    case 3: renderFixationsOverTime(data); break;
    case 4: renderDwellTimeOverTime(data); break;
    case 5: renderFeatureDistribution(data); break;
    case 6: renderFeatureDistributionOverTime(data); break;
    case 7: renderPupilDilationTable(data); break;
    case 8: renderProductComparisonTable(data); break;
    case 9: renderUniqueProductsOverTime(data); break;
    case 10: renderTotalProductViewsOverTime(data); break;
    case 11: renderSaccadeSpeedOverTime(data); break;
    case 12: renderAvgFixationDurationOverTime(data); break;
    case 13: renderFixationVarianceOverTime(data); break;
    case 14: renderVisitVarianceOverTime(data); break;
    case 15: renderMaxRevisitPerProduct(data); break;
    default: showError('Chart not implemented');
  }
}

// ─── Chart 1: Fixations per Product ───────────────────────────────────────────

function renderFixationsPerProduct(data) {
  const fixations = data.fixationsPerProduct || {};
  const fixationsOT = data.fixationsOverTime || {};
  const products = Object.keys(fixations).sort();
  const values = products.map(p => fixations[p]);
  const maxVal = Math.max(...values, 1);

  createChart({
    type: 'bar',
    data: {
      labels: products,
      datasets: [{
        label: 'Number of Fixations',
        data: values,
        backgroundColor: products.map((_, i) => rgba(PALETTE[i % PALETTE.length], 0.82)),
        borderColor: products.map((_, i) => PALETTE[i % PALETTE.length]),
        borderWidth: 2,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: 'rgba(0,0,0,0.8)' },
      },
      scales: {
        x: { title: { display: true, text: 'Product' } },
        y: { title: { display: true, text: 'Fixation Count' }, beginAtZero: true, max: maxVal },
      },
    },
  });

  const { frameBySecond, maxSecond } = buildBarFrames(fixationsOT);
  initAnimation(maxSecond, (second) => {
    if (!chartInstance) return;
    const frame = frameBySecond[second] || {};
    chartInstance.data.datasets[0].data = products.map(p => frame[p] || 0);
    chartInstance.update('none');
  });
}

// ─── Chart 2: Dwell Time per Product ──────────────────────────────────────────

function renderDwellTimePerProduct(data) {
  const dwellTime = data.dwellTimePerProduct || {};
  const dwellOT = data.dwellTimeOverTime || {};
  const products = Object.keys(dwellTime).sort();
  const values = products.map(p => dwellTime[p]);
  const maxVal = Math.max(...values, 1);

  createChart({
    type: 'bar',
    data: {
      labels: products,
      datasets: [{
        label: 'Dwell Time (ms)',
        data: values,
        backgroundColor: products.map((_, i) => rgba(PALETTE[i % PALETTE.length], 0.82)),
        borderColor: products.map((_, i) => PALETTE[i % PALETTE.length]),
        borderWidth: 2,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: 'rgba(0,0,0,0.8)' },
      },
      scales: {
        x: { title: { display: true, text: 'Product' } },
        y: { title: { display: true, text: 'Total Dwell Time (ms)' }, beginAtZero: true, max: maxVal },
      },
    },
  });

  const { frameBySecond, maxSecond } = buildBarFrames(dwellOT);
  initAnimation(maxSecond, (second) => {
    if (!chartInstance) return;
    const frame = frameBySecond[second] || {};
    chartInstance.data.datasets[0].data = products.map(p => frame[p] || 0);
    chartInstance.update('none');
  });
}

// ─── Chart 3: Fixations over Time ─────────────────────────────────────────────

function renderFixationsOverTime(data) {
  const buckets = data.fixationsOverTime || {};
  renderTimeSeriesMultiProduct(buckets, 'Fixation Count');
}

// ─── Chart 4: Dwell Time over Time ────────────────────────────────────────────

function renderDwellTimeOverTime(data) {
  const buckets = data.dwellTimeOverTime || {};
  renderTimeSeriesMultiProduct(buckets, 'Dwell Time (ms)');
}

// ─── Helper: Time Series Multi-Product ────────────────────────────────────────

function renderTimeSeriesMultiProduct(buckets, yLabel) {
  const times = Object.keys(buckets).map(Number).sort((a, b) => a - b);
  const products = new Set();
  times.forEach(t => Object.keys(buckets[t]).forEach(p => products.add(p)));
  const productList = Array.from(products).sort();

  const fullDatasets = productList.map(product =>
    times.map(t => ({ x: t / 1000, y: buckets[t][product] || 0 }))
  );
  const maxSecond = times.length > 0 ? Math.ceil(times[times.length - 1] / 1000) : 60;

  const datasets = productList.map((product, i) => ({
    label: product,
    data: fullDatasets[i].slice(),
    borderColor: PALETTE[i % PALETTE.length],
    backgroundColor: rgba(PALETTE[i % PALETTE.length], 0.1),
    borderWidth: 2,
    tension: 0.3,
    pointRadius: 3,
  }));

  createChart({
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: { backgroundColor: 'rgba(0,0,0,0.8)' },
      },
      scales: {
        x: { type: 'linear', min: 0, max: maxSecond, title: { display: true, text: 'Time (seconds)' } },
        y: { title: { display: true, text: yLabel }, beginAtZero: true },
      },
    },
  });

  initAnimation(maxSecond, (second) => {
    if (!chartInstance) return;
    chartInstance.data.datasets.forEach((dataset, i) => {
      dataset.data = fullDatasets[i].filter(pt => pt.x <= second);
    });
    chartInstance.update('none');
  });
}

// ─── Chart 5: Feature Distribution ────────────────────────────────────────────

function renderFeatureDistribution(data) {
  const features = data.featureDistribution || {};
  const featureAbsOT = data.featureAbsoluteOverTime || {};
  const labels = Object.keys(features).sort();
  const values = labels.map(l => features[l]);
  const total = values.reduce((s, v) => s + v, 0);

  const legendLabels = labels.map((l, i) => {
    const pct = total > 0 ? ((values[i] / total) * 100).toFixed(1) : '0';
    return `${l} (${pct}%)`;
  });

  createChart({
    type: 'pie',
    data: {
      labels: legendLabels,
      datasets: [{
        data: values,
        backgroundColor: labels.map((_, i) => rgba(PALETTE[i % PALETTE.length], 0.88)),
        borderColor: '#ffffff',
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'right' },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          callbacks: {
            label: (ctx) => {
              const frameTotal = ctx.chart.data.datasets[0].data.reduce((s, v) => s + v, 0);
              const pct = frameTotal > 0 ? ((ctx.parsed / frameTotal) * 100).toFixed(1) : '0';
              return `  ${ctx.label.split(' (')[0]}: ${Math.round(ctx.parsed)} ms (${pct}%)`;
            },
          },
        },
      },
    },
  });

  const { frameBySecond, maxSecond } = buildBarFrames(featureAbsOT);
  initAnimation(maxSecond, (second) => {
    if (!chartInstance) return;
    const frame = frameBySecond[second] || {};
    chartInstance.data.datasets[0].data = labels.map(l => frame[l] || 0);
    chartInstance.update('none');
  });
}

// ─── Chart 6: Feature Distribution over Time ──────────────────────────────────

function renderFeatureDistributionOverTime(data) {
  const buckets = data.featureDistributionOverTime || {};
  const times = Object.keys(buckets).map(Number).sort((a, b) => a - b);
  const features = new Set();
  times.forEach(t => Object.keys(buckets[t]).forEach(f => features.add(f)));
  const featureList = Array.from(features).sort();

  const fullDatasets = featureList.map(feature =>
    times.map(t => ({ x: t / 1000, y: buckets[t][feature] || 0 }))
  );
  const maxSecond = times.length > 0 ? Math.ceil(times[times.length - 1] / 1000) : 60;

  const datasets = featureList.map((feature, i) => ({
    label: feature,
    data: fullDatasets[i].slice(),
    borderColor: PALETTE[i % PALETTE.length],
    backgroundColor: rgba(PALETTE[i % PALETTE.length], 0.1),
    borderWidth: 2,
    tension: 0.3,
    fill: true,
    pointRadius: 2,
  }));

  createChart({
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: { backgroundColor: 'rgba(0,0,0,0.8)' },
      },
      scales: {
        x: { type: 'linear', min: 0, max: maxSecond, title: { display: true, text: 'Time (seconds)' } },
        y: { title: { display: true, text: 'Share (%)' }, beginAtZero: true, max: 100 },
      },
    },
  });

  initAnimation(maxSecond, (second) => {
    if (!chartInstance) return;
    chartInstance.data.datasets.forEach((dataset, i) => {
      dataset.data = fullDatasets[i].filter(pt => pt.x <= second);
    });
    chartInstance.update('none');
  });
}

// ─── Chart 7: Pupil Dilation Table ────────────────────────────────────────────

function buildPupilTableHtml(pupilData) {
  const products = Object.entries(pupilData)
    .filter(([, info]) => info && typeof info.avg === 'number')
    .map(([product, info]) => ({ product, avg: info.avg, duration: info.totalDuration }))
    .sort((a, b) => b.avg - a.avg);

  if (!products.length) {
    return '<thead><tr><th>Rank</th><th>Product</th><th>Weighted Avg Pupil Diameter (mm)</th><th>Total Dwell Time (ms)</th></tr></thead><tbody><tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No data yet</td></tr></tbody>';
  }

  let html = '<thead><tr><th>Rank</th><th>Product</th><th>Weighted Avg Pupil Diameter (mm)</th><th>Total Dwell Time (ms)</th></tr></thead><tbody>';
  products.forEach((p, i) => {
    const highlight = i < 3 ? ' class="highlight-row"' : '';
    html += `<tr${highlight}><td>${i + 1}</td><td>${escapeHtml(p.product)}</td><td>${p.avg.toFixed(3)}</td><td>${Math.round(p.duration)}</td></tr>`;
  });
  return html + '</tbody>';
}

function renderPupilDilationTable(data) {
  const pupilData = data.pupilDilation || {};
  const pupilOT = data.pupilDilationOverTime || {};

  chartCanvasWrapper.hidden = true;
  chartTableWrapper.hidden = false;
  chartTable.innerHTML = buildPupilTableHtml(pupilData);

  const { frameBySecond, maxSecond } = buildBarFrames(pupilOT);
  initAnimation(maxSecond, (second) => {
    chartTable.innerHTML = buildPupilTableHtml(frameBySecond[second] || {});
  });
}

// ─── Chart 8: Product Comparison Table ────────────────────────────────────────

function buildComparisonTableHtml(compData) {
  const pairs = (compData.pairs || []).filter(p => p.pair);
  const total = compData.total || 0;

  if (!pairs.length) {
    return '<thead><tr><th>Rank</th><th>Product Pair</th><th>Comparisons</th><th>Share</th></tr></thead><tbody><tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No comparisons yet</td></tr></tbody>';
  }

  let html = '<thead><tr><th>Rank</th><th>Product Pair</th><th>Comparisons</th><th>Share</th></tr></thead><tbody>';
  pairs.forEach((p, i) => {
    const highlight = i < 3 ? ' class="highlight-row"' : '';
    const pct = total > 0 ? ((p.count / total) * 100).toFixed(1) : '0';
    html += `<tr${highlight}><td>${i + 1}</td><td>${escapeHtml(p.pair)}</td><td>${p.count}</td><td>${pct}%</td></tr>`;
  });
  html += `</tbody><tfoot><tr><td colspan="4">Total A→B→A comparison events: ${total}</td></tr></tfoot>`;
  return html;
}

function renderProductComparisonTable(data) {
  const compData = data.productComparisons || {};
  const compOT = data.productComparisonsOverTime || {};

  chartCanvasWrapper.hidden = true;
  chartTableWrapper.hidden = false;
  chartTable.innerHTML = buildComparisonTableHtml(compData);

  const { frameBySecond, maxSecond } = buildBarFrames(compOT);
  initAnimation(maxSecond, (second) => {
    chartTable.innerHTML = buildComparisonTableHtml(frameBySecond[second] || {});
  });
}

// ─── Chart 9: Unique Products over Time ───────────────────────────────────────

function renderUniqueProductsOverTime(data) {
  const series = data.uniqueProductsOverTime || {};
  renderSingleTimeSeries(series, 'Unique Products', '#4F81BD');
}

// ─── Chart 10: Total Product Views over Time ──────────────────────────────────

function renderTotalProductViewsOverTime(data) {
  const series = data.totalProductViewsOverTime || {};
  renderSingleTimeSeries(series, 'Total Views', '#9BBB59');
}

// ─── Chart 11: Saccade Speed over Time ────────────────────────────────────────

function renderSaccadeSpeedOverTime(data) {
  const series = data.saccadeSpeedOverTime || {};
  renderSingleTimeSeries(series, 'Mean Saccade Speed', '#F79646');
}

// ─── Helper: Single Time Series ───────────────────────────────────────────────

function renderSingleTimeSeries(series, yLabel, color) {
  const times = Object.keys(series).map(Number).sort((a, b) => a - b);
  const fullPoints = times.map(t => ({ x: t / 1000, y: series[t] }));
  const maxSecond = times.length > 0 ? Math.ceil(times[times.length - 1] / 1000) : 60;

  createChart({
    type: 'line',
    data: {
      datasets: [{
        label: yLabel,
        data: fullPoints.slice(),
        borderColor: color,
        backgroundColor: rgba(color, 0.1),
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        pointRadius: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: { backgroundColor: 'rgba(0,0,0,0.8)' },
      },
      scales: {
        x: { type: 'linear', min: 0, max: maxSecond, title: { display: true, text: 'Time (seconds)' } },
        y: { title: { display: true, text: yLabel }, beginAtZero: true },
      },
    },
  });

  initAnimation(maxSecond, (second) => {
    if (!chartInstance) return;
    chartInstance.data.datasets[0].data = fullPoints.filter(pt => pt.x <= second);
    chartInstance.update('none');
  });
}

// ─── Chart 12: Avg Fixation Duration over Time ────────────────────────────────

function renderAvgFixationDurationOverTime(data) {
  const series = data.avgFixationDurationOverTime || {};
  renderDualTimeSeries(series, 'Average Fixation Duration (ms)', '#4F81BD', '#F79646');
}

// ─── Chart 13: Fixation Variance over Time ────────────────────────────────────

function renderFixationVarianceOverTime(data) {
  const series = data.fixationVarianceOverTime || {};
  renderDualTimeSeries(series, 'Fixation Duration Variance (ms²)', '#4F81BD', '#F79646');
}

// ─── Chart 14: Visit Variance over Time ───────────────────────────────────────

function renderVisitVarianceOverTime(data) {
  const series = data.visitVarianceOverTime || {};
  renderDualTimeSeries(series, 'Visit Duration Variance (ms²)', '#4F81BD', '#F79646');
}

// ─── Helper: Dual Time Series ─────────────────────────────────────────────────

function renderDualTimeSeries(series, yLabel, color1, color2) {
  const cumulative = series.cumulative || {};
  const rolling = series.rolling || {};

  const timesCum = Object.keys(cumulative).map(Number).sort((a, b) => a - b);
  const timesRoll = Object.keys(rolling).map(Number).sort((a, b) => a - b);

  const fullCum = timesCum.map(t => ({ x: t / 1000, y: cumulative[t] }));
  const fullRoll = timesRoll.map(t => ({ x: t / 1000, y: rolling[t] }));
  const maxSecond = Math.max(
    timesCum.length > 0 ? Math.ceil(timesCum[timesCum.length - 1] / 1000) : 0,
    timesRoll.length > 0 ? Math.ceil(timesRoll[timesRoll.length - 1] / 1000) : 0,
  ) || 60;

  const datasets = [
    {
      label: 'Cumulative',
      data: fullCum.slice(),
      borderColor: color1,
      backgroundColor: rgba(color1, 0.1),
      borderWidth: 2,
      tension: 0.3,
      pointRadius: 2,
    },
    {
      label: 'Rolling 10s Window',
      data: fullRoll.slice(),
      borderColor: color2,
      backgroundColor: rgba(color2, 0.1),
      borderWidth: 2,
      tension: 0.3,
      pointRadius: 2,
    },
  ];

  createChart({
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: { backgroundColor: 'rgba(0,0,0,0.8)' },
      },
      scales: {
        x: { type: 'linear', min: 0, max: maxSecond, title: { display: true, text: 'Time (seconds)' } },
        y: { title: { display: true, text: yLabel }, beginAtZero: true },
      },
    },
  });

  initAnimation(maxSecond, (second) => {
    if (!chartInstance) return;
    chartInstance.data.datasets[0].data = fullCum.filter(pt => pt.x <= second);
    chartInstance.data.datasets[1].data = fullRoll.filter(pt => pt.x <= second);
    chartInstance.update('none');
  });
}

// ─── Chart 15: Max Revisit per Product ────────────────────────────────────────

function renderMaxRevisitPerProduct(data) {
  const revisits = data.maxRevisitPerProduct || {};
  const revisitsOT = data.revisitsOverTime || {};
  const products = Object.entries(revisits)
    .map(([product, count]) => ({ product, count }))
    .sort((a, b) => b.count - a.count);

  const labels = products.map(p => p.product);
  const values = products.map(p => p.count);
  const maxCount = Math.max(...values, 0);

  createChart({
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Revisit Count',
        data: values,
        backgroundColor: values.map(v => v === maxCount && v > 0 ? '#FFD700' : rgba('#4F81BD', 0.82)),
        borderColor: values.map(v => v === maxCount && v > 0 ? '#DAA520' : '#4F81BD'),
        borderWidth: 2,
        borderRadius: 6,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: 'rgba(0,0,0,0.8)' },
      },
      scales: {
        x: { title: { display: true, text: 'Number of Revisits' }, beginAtZero: true, max: maxCount || 1 },
        y: { title: { display: true, text: 'Product' } },
      },
    },
  });

  const { frameBySecond, maxSecond } = buildBarFrames(revisitsOT);
  initAnimation(maxSecond, (second) => {
    if (!chartInstance) return;
    const frame = frameBySecond[second] || {};
    const frameValues = labels.map(l => frame[l] || 0);
    const frameMax = Math.max(...frameValues, 0);
    chartInstance.data.datasets[0].data = frameValues;
    chartInstance.data.datasets[0].backgroundColor = frameValues.map(v => v === frameMax && v > 0 ? '#FFD700' : rgba('#4F81BD', 0.82));
    chartInstance.data.datasets[0].borderColor = frameValues.map(v => v === frameMax && v > 0 ? '#DAA520' : '#4F81BD');
    chartInstance.update('none');
  });
}

// ─── Utility: Build per-second frame lookup from ms-keyed object ──────────────

function buildBarFrames(msKeyedData) {
  const times = Object.keys(msKeyedData).map(Number).sort((a, b) => a - b);
  const frameBySecond = {};
  times.forEach(ms => {
    frameBySecond[Math.round(ms / 1000)] = msKeyedData[ms];
  });
  const maxSecond = times.length > 0 ? Math.ceil(times[times.length - 1] / 1000) : 60;
  return { frameBySecond, maxSecond };
}

// ─── Create Chart ─────────────────────────────────────────────────────────────

function createChart(config) {
  if (chartInstance) {
    chartInstance.destroy();
  }
  chartCanvasWrapper.hidden = false;
  chartTableWrapper.hidden = true;
  chartInstance = new Chart(chartCanvas, config);
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Playback Animation ───────────────────────────────────────────────────────

function initAnimation(maxSecond, applyFn) {
  if (animState.timerId) {
    clearInterval(animState.timerId);
    animState.timerId = null;
  }
  animState.playing = false;
  animState.applyFn = applyFn;
  animState.maxSecond = maxSecond;
  animState.currentSecond = maxSecond; // Start showing full chart

  const scrubber = document.getElementById('playbackScrubber');
  scrubber.max = maxSecond;
  scrubber.value = maxSecond;
  document.getElementById('playbackSpeed').value = '1';
  animState.speed = 1;

  document.getElementById('playbackControls').hidden = false;
  updatePlaybackUI();
}

function updatePlaybackUI() {
  const { currentSecond, maxSecond, playing } = animState;
  document.getElementById('playbackTime').textContent = currentSecond + 's';
  document.getElementById('playbackDuration').textContent = maxSecond + 's';
  document.getElementById('playbackScrubber').value = currentSecond;

  const icon = document.getElementById('playbackPlayIcon');
  const label = document.getElementById('playbackPlayLabel');
  if (playing) {
    icon.innerHTML = '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>';
    icon.setAttribute('fill', 'currentColor');
    icon.setAttribute('stroke', 'none');
    label.textContent = 'Pause';
  } else {
    icon.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
    icon.setAttribute('fill', 'currentColor');
    icon.setAttribute('stroke', 'none');
    label.textContent = 'Play';
  }
}

function applyFrame(second) {
  if (animState.applyFn) animState.applyFn(second);
}

function tick() {
  animState.currentSecond++;
  applyFrame(animState.currentSecond);
  updatePlaybackUI();
  if (animState.currentSecond >= animState.maxSecond) {
    pauseAnimation();
  }
}

function playAnimation() {
  if (animState.currentSecond >= animState.maxSecond) {
    // Restart from beginning
    animState.currentSecond = 0;
    applyFrame(0);
    updatePlaybackUI();
  }
  animState.playing = true;
  updatePlaybackUI();
  animState.timerId = setInterval(tick, 1000 / animState.speed);
}

function pauseAnimation() {
  animState.playing = false;
  if (animState.timerId) {
    clearInterval(animState.timerId);
    animState.timerId = null;
  }
  updatePlaybackUI();
}

function resetAnimation() {
  pauseAnimation();
  animState.currentSecond = 0;
  applyFrame(0);
  updatePlaybackUI();
}

function setupPlaybackListeners() {
  document.getElementById('playbackPlayBtn').addEventListener('click', () => {
    if (animState.playing) {
      pauseAnimation();
    } else {
      playAnimation();
    }
  });

  document.getElementById('playbackReset').addEventListener('click', () => {
    resetAnimation();
  });

  document.getElementById('playbackScrubber').addEventListener('input', (e) => {
    const second = parseInt(e.target.value, 10);
    animState.currentSecond = second;
    if (animState.playing) {
      pauseAnimation();
    }
    applyFrame(second);
    updatePlaybackUI();
  });

  document.getElementById('playbackSpeed').addEventListener('change', (e) => {
    animState.speed = parseFloat(e.target.value);
    if (animState.playing) {
      clearInterval(animState.timerId);
      animState.timerId = setInterval(tick, 1000 / animState.speed);
    }
  });
}

// ─── Run ──────────────────────────────────────────────────────────────────────

setupPlaybackListeners();
init();
