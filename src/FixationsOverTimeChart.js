'use strict';

const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

const WIDTH  = 900;
const HEIGHT = 500;

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

/**
 * FixationsOverTimeChart
 * ──────────────────────
 * Intra-Product · Tab B  (interchangeable with DwellTimeOverTimeChart)
 *
 * Reads raw fixation rows (table1_fixations.csv) and renders a multi-line
 * chart showing the cumulative number of fixations per product over time.
 *
 * The session is divided into equal time buckets (default: 10 s).
 * Each product gets its own line; the Y-axis shows the fixation count
 * within each bucket.
 *
 * Usage:
 *   const chart = new FixationsOverTimeChart();
 *   const buffer = await chart.render(rows, { bucketSizeMs: 10000 });
 *
 * Expected row shape:
 *   { Target_Product: 'Product_C', Start_ts: 1234, Duration: 274, … }
 */
class FixationsOverTimeChart {
  constructor(width = WIDTH, height = HEIGHT) {
    this._canvas = new ChartJSNodeCanvas({
      width,
      height,
      backgroundColour: '#ffffff',
    });
  }

  /**
   * Builds time-bucketed fixation counts per product and renders the chart.
   *
   * @param {object[]} rows          Parsed rows from table1_fixations.csv
   * @param {object}   [opts]
   * @param {number}   [opts.bucketSizeMs=10000]  Width of each time bucket in ms
   * @returns {Promise<Buffer>}  PNG image buffer
   */
  async render(rows, { bucketSizeMs = 10000 } = {}) {
    const { timeLabels, series } = this._buildSeries(rows, bucketSizeMs);

    const datasets = series.map((s, i) => ({
      label: s.product,
      data: s.values,
      borderColor:     PALETTE[i % PALETTE.length],
      backgroundColor: rgba(PALETTE[i % PALETTE.length], 0.10),
      borderWidth: 2.5,
      pointRadius: 4,
      pointHoverRadius: 6,
      fill: false,
      tension: 0.35,
    }));

    return this._canvas.renderToBuffer({
      type: 'line',
      data: { labels: timeLabels, datasets },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Number of Fixations per Product over Time',
            font: { size: 20, weight: 'bold' },
            color: '#1a1a2e',
            padding: { top: 10, bottom: 6 },
          },
          subtitle: {
            display: true,
            text: `Intra-Product Analysis  ·  Source: Raw Fixation Data  ·  Bucket size: ${bucketSizeMs / 1000} s`,
            font: { size: 11 },
            color: '#4F81BD',
            padding: { bottom: 14 },
          },
          legend: {
            display: true,
            position: 'top',
            labels: { font: { size: 11 }, boxWidth: 14, padding: 12 },
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Time (s)',
              font: { size: 13, weight: '600' },
              color: '#333',
            },
            ticks: { font: { size: 10 }, color: '#333', maxTicksLimit: 15 },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
          y: {
            title: {
              display: true,
              text: 'Fixation Count',
              font: { size: 13, weight: '600' },
              color: '#333',
            },
            beginAtZero: true,
            ticks: { font: { size: 11 }, color: '#555', precision: 0 },
            grid: { color: 'rgba(0,0,0,0.06)' },
          },
        },
      },
    });
  }

  /**
   * Divides the session into time buckets and counts fixations per product
   * per bucket.
   *
   * @param {object[]} rows
   * @param {number}   bucketSizeMs
   * @returns {{ timeLabels: string[], series: { product: string, values: number[] }[] }}
   */
  _buildSeries(rows, bucketSizeMs) {
    if (!rows.length) return { timeLabels: [], series: [] };

    // Determine session range
    const timestamps = rows.map((r) => parseFloat(r['Start_ts'])).filter((v) => !isNaN(v));
    const minTs = Math.min(...timestamps);
    const maxTs = Math.max(...timestamps);

    const numBuckets = Math.ceil((maxTs - minTs + 1) / bucketSizeMs);

    // Collect all products (sorted)
    const products = [...new Set(rows.map((r) => r['Target_Product']).filter(Boolean))].sort();

    // Build bucket matrix: counts[product][bucketIdx]
    const counts = {};
    products.forEach((p) => { counts[p] = new Array(numBuckets).fill(0); });

    rows.forEach((row) => {
      const product = row['Target_Product'];
      const ts      = parseFloat(row['Start_ts']);
      if (!product || isNaN(ts)) return;
      const bucketIdx = Math.min(Math.floor((ts - minTs) / bucketSizeMs), numBuckets - 1);
      counts[product][bucketIdx]++;
    });

    // Build time labels (start of each bucket in seconds, relative to session start)
    const timeLabels = Array.from({ length: numBuckets }, (_, i) => {
      const secStart = Math.round((minTs + i * bucketSizeMs) / 1000);
      const secEnd   = Math.round((minTs + (i + 1) * bucketSizeMs) / 1000);
      return `${secStart}–${secEnd}s`;
    });

    const series = products.map((p) => ({ product: p, values: counts[p] }));

    return { timeLabels, series };
  }
}

module.exports = FixationsOverTimeChart;