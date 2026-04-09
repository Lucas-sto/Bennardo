'use strict';

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
  const products = Object.keys(fixations).sort();
  const values = products.map(p => fixations[p]);

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
        y: { title: { display: true, text: 'Fixation Count' }, beginAtZero: true },
      },
    },
  });
}

// ─── Chart 2: Dwell Time per Product ──────────────────────────────────────────

function renderDwellTimePerProduct(data) {
  const dwellTime = data.dwellTimePerProduct || {};
  const products = Object.keys(dwellTime).sort();
  const values = products.map(p => dwellTime[p]);

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
        y: { title: { display: true, text: 'Total Dwell Time (ms)' }, beginAtZero: true },
      },
    },
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

  const datasets = productList.map((product, i) => ({
    label: product,
    data: times.map(t => ({ x: t / 1000, y: buckets[t][product] || 0 })),
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
        x: { type: 'linear', title: { display: true, text: 'Time (seconds)' } },
        y: { title: { display: true, text: yLabel }, beginAtZero: true },
      },
    },
  });
}

// ─── Chart 5: Feature Distribution ────────────────────────────────────────────

function renderFeatureDistribution(data) {
  const features = data.featureDistribution || {};
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
              const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0';
              return `  ${ctx.label.split(' (')[0]}: ${ctx.parsed} ms (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

// ─── Chart 6: Feature Distribution over Time ──────────────────────────────────

function renderFeatureDistributionOverTime(data) {
  const buckets = data.featureDistributionOverTime || {};
  const times = Object.keys(buckets).map(Number).sort((a, b) => a - b);
  const features = new Set();
  times.forEach(t => Object.keys(buckets[t]).forEach(f => features.add(f)));
  const featureList = Array.from(features).sort();

  const datasets = featureList.map((feature, i) => ({
    label: feature,
    data: times.map(t => ({ x: t / 1000, y: buckets[t][feature] || 0 })),
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
        x: { type: 'linear', title: { display: true, text: 'Time (seconds)' } },
        y: { title: { display: true, text: 'Share (%)' }, beginAtZero: true, max: 100 },
      },
    },
  });
}

// ─── Chart 7: Pupil Dilation Table ────────────────────────────────────────────

function renderPupilDilationTable(data) {
  const pupilData = data.pupilDilation || {};
  const products = Object.entries(pupilData)
    .map(([product, info]) => ({ product, avg: info.avg, duration: info.totalDuration }))
    .sort((a, b) => b.avg - a.avg);

  chartCanvasWrapper.hidden = true;
  chartTableWrapper.hidden = false;

  let html = '<thead><tr><th>Rank</th><th>Product</th><th>Weighted Avg Pupil Diameter (mm)</th><th>Total Dwell Time (ms)</th></tr></thead><tbody>';
  products.forEach((p, i) => {
    const highlight = i < 3 ? ' class="highlight-row"' : '';
    html += `<tr${highlight}><td>${i + 1}</td><td>${escapeHtml(p.product)}</td><td>${p.avg.toFixed(3)}</td><td>${Math.round(p.duration)}</td></tr>`;
  });
  html += '</tbody>';
  chartTable.innerHTML = html;
}

// ─── Chart 8: Product Comparison Table ────────────────────────────────────────

function renderProductComparisonTable(data) {
  const compData = data.productComparisons || {};
  const pairs = compData.pairs || [];
  const total = compData.total || 0;

  chartCanvasWrapper.hidden = true;
  chartTableWrapper.hidden = false;

  let html = '<thead><tr><th>Rank</th><th>Product Pair</th><th>Comparisons</th><th>Share</th></tr></thead><tbody>';
  pairs.filter(p => p.pair).forEach((p, i) => {
    const highlight = i < 3 ? ' class="highlight-row"' : '';
    const pct = total > 0 ? ((p.count / total) * 100).toFixed(1) : '0';
    html += `<tr${highlight}><td>${i + 1}</td><td>${escapeHtml(p.pair)}</td><td>${p.count}</td><td>${pct}%</td></tr>`;
  });
  html += '</tbody>';
  html += `<tfoot><tr><td colspan="4">Total A→B→A comparison events: ${total}</td></tr></tfoot>`;
  chartTable.innerHTML = html;
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
  const values = times.map(t => ({ x: t / 1000, y: series[t] }));

  createChart({
    type: 'line',
    data: {
      datasets: [{
        label: yLabel,
        data: values,
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
        x: { type: 'linear', title: { display: true, text: 'Time (seconds)' } },
        y: { title: { display: true, text: yLabel }, beginAtZero: true },
      },
    },
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

  const datasets = [
    {
      label: 'Cumulative',
      data: timesCum.map(t => ({ x: t / 1000, y: cumulative[t] })),
      borderColor: color1,
      backgroundColor: rgba(color1, 0.1),
      borderWidth: 2,
      tension: 0.3,
      pointRadius: 2,
    },
    {
      label: 'Rolling 10s Window',
      data: timesRoll.map(t => ({ x: t / 1000, y: rolling[t] })),
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
        x: { type: 'linear', title: { display: true, text: 'Time (seconds)' } },
        y: { title: { display: true, text: yLabel }, beginAtZero: true },
      },
    },
  });
}

// ─── Chart 15: Max Revisit per Product ────────────────────────────────────────

function renderMaxRevisitPerProduct(data) {
  const revisits = data.maxRevisitPerProduct || {};
  const products = Object.entries(revisits)
    .map(([product, count]) => ({ product, count }))
    .sort((a, b) => b.count - a.count);

  const labels = products.map(p => p.product);
  const values = products.map(p => p.count);
  const maxCount = Math.max(...values);

  createChart({
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Revisit Count',
        data: values,
        backgroundColor: values.map(v => v === maxCount ? '#FFD700' : rgba('#4F81BD', 0.82)),
        borderColor: values.map(v => v === maxCount ? '#DAA520' : '#4F81BD'),
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
        x: { title: { display: true, text: 'Number of Revisits' }, beginAtZero: true },
        y: { title: { display: true, text: 'Product' } },
      },
    },
  });
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

// ─── Run ──────────────────────────────────────────────────────────────────────

init();
