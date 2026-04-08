'use strict';

const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const CumulativeStatsCalculator = require('./CumulativeStatsCalculator');

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
  async render(rows) {
    const { timeLabels, series } = this._buildSeries(rows);

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
            text: 'Cumulative Fixations per Product over Time',
            font: { size: 20, weight: 'bold' },
            color: '#1a1a2e',
            padding: { top: 10, bottom: 6 },
          },
          subtitle: {
            display: true,
            text: 'Intra-Product Analysis  ·  Source: Raw Fixation Data  ·  Cumulative from session start',
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
  _buildSeries(rows) {
    if (!rows.length) return { timeLabels: [], series: [] };

    const lastSecond = Math.ceil(Math.max(...rows.map((r) => parseFloat(r['End_ts']) || 0)) / 1000);
    const products   = [...new Set(rows.map((r) => r['Target_Product']).filter(Boolean))].sort();
    const calculator = new CumulativeStatsCalculator();

    const series = products.map((p) => {
      const values = [];
      for (let s = 1; s <= lastSecond; s++) {
        const counts = calculator.fixationsPerProduct(rows, s * 1000);
        values.push(counts[p] || 0);
      }
      return { product: p, values };
    });

    const timeLabels = Array.from({ length: lastSecond }, (_, i) => `${i + 1}s`);

    return { timeLabels, series };
  }
}

module.exports = FixationsOverTimeChart;