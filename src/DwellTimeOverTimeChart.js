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
 * DwellTimeOverTimeChart
 * ──────────────────────
 * Intra-Product · Tab B  (interchangeable with FixationsOverTimeChart)
 *
 * Reads raw fixation rows (table1_fixations.csv) and renders a multi-line
 * chart showing the total dwell time (sum of Duration in ms) per product
 * across equal time buckets.
 *
 * Usage:
 *   const chart = new DwellTimeOverTimeChart();
 *   const buffer = await chart.render(rows, { bucketSizeMs: 10000 });
 *
 * Expected row shape:
 *   { Target_Product: 'Product_C', Start_ts: 1234, Duration: 274, … }
 */
class DwellTimeOverTimeChart {
  constructor(width = WIDTH, height = HEIGHT) {
    this._canvas = new ChartJSNodeCanvas({
      width,
      height,
      backgroundColour: '#ffffff',
    });
  }

  /**
   * Builds time-bucketed dwell time per product and renders the chart.
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
            text: 'Dwell Time per Product over Time',
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
              text: 'Total Dwell Time (ms)',
              font: { size: 13, weight: '600' },
              color: '#333',
            },
            beginAtZero: true,
            ticks: { font: { size: 11 }, color: '#555' },
            grid: { color: 'rgba(0,0,0,0.06)' },
          },
        },
      },
    });
  }

  /**
   * Divides the session into time buckets and sums Duration per product
   * per bucket.
   *
   * @param {object[]} rows
   * @param {number}   bucketSizeMs
   * @returns {{ timeLabels: string[], series: { product: string, values: number[] }[] }}
   */
  _buildSeries(rows, bucketSizeMs) {
    if (!rows.length) return { timeLabels: [], series: [] };

    const timestamps = rows.map((r) => parseFloat(r['Start_ts'])).filter((v) => !isNaN(v));
    const minTs = Math.min(...timestamps);
    const maxTs = Math.max(...timestamps);

    const numBuckets = Math.ceil((maxTs - minTs + 1) / bucketSizeMs);

    const products = [...new Set(rows.map((r) => r['Target_Product']).filter(Boolean))].sort();

    // Build bucket matrix: dwell[product][bucketIdx] = sum of Duration
    const dwell = {};
    products.forEach((p) => { dwell[p] = new Array(numBuckets).fill(0); });

    rows.forEach((row) => {
      const product  = row['Target_Product'];
      const ts       = parseFloat(row['Start_ts']);
      const duration = parseFloat(row['Duration']);
      if (!product || isNaN(ts) || isNaN(duration)) return;
      const bucketIdx = Math.min(Math.floor((ts - minTs) / bucketSizeMs), numBuckets - 1);
      dwell[product][bucketIdx] += duration;
    });

    const timeLabels = Array.from({ length: numBuckets }, (_, i) => {
      const secStart = Math.round((minTs + i * bucketSizeMs) / 1000);
      const secEnd   = Math.round((minTs + (i + 1) * bucketSizeMs) / 1000);
      return `${secStart}–${secEnd}s`;
    });

    const series = products.map((p) => ({ product: p, values: dwell[p] }));

    return { timeLabels, series };
  }
}

module.exports = DwellTimeOverTimeChart;