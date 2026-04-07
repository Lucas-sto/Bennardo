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
 * IntraProductCharts
 * ──────────────────
 * Renders all Intra-Product specific charts.
 *
 * Tab group A (interchangeable):
 *   renderFixationsPerProduct(data)   → bar chart
 *   renderDwellTimePerProduct(data)   → bar chart
 *
 * Tab group B (interchangeable):
 *   renderFixationsOverTime(data)     → multi-line chart
 *   renderDwellTimeOverTime(data)     → multi-line chart
 *
 * All methods return Promise<Buffer> (PNG).
 *
 * Expected data shapes:
 *   PerProduct:   { products: string[], values: number[] }
 *   OverTime:     { timeLabels: string[], series: { product: string, values: number[] }[] }
 */
class IntraProductCharts {
  constructor(width = WIDTH, height = HEIGHT) {
    this.width  = width;
    this.height = height;
    this._canvas = new ChartJSNodeCanvas({
      width,
      height,
      backgroundColour: '#ffffff',
    });
  }

  // ── Tab Group A ─────────────────────────────────────────────────────────────

  /**
   * Bar chart: Number of fixations per product.
   * @param {{ products: string[], values: number[] }} data
   * @returns {Promise<Buffer>}
   */
  async renderFixationsPerProduct({ products, values }) {
    return this._canvas.renderToBuffer({
      type: 'bar',
      data: {
        labels: products,
        datasets: [{
          label: 'Number of Fixations',
          data: values,
          backgroundColor: products.map((_, i) => rgba(PALETTE[i % PALETTE.length], 0.82)),
          borderColor:     products.map((_, i) => PALETTE[i % PALETTE.length]),
          borderWidth: 1.5,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Number of Fixations per Product',
            font: { size: 18, weight: 'bold' },
            color: '#1a1a2e',
            padding: { bottom: 16 },
          },
          legend: { display: false },
          subtitle: {
            display: true,
            text: 'Intra-Product · Tab A',
            font: { size: 11 },
            color: '#4F81BD',
            padding: { bottom: 8 },
          },
        },
        scales: {
          x: {
            title: { display: true, text: 'Product', font: { size: 13 } },
            ticks: { font: { size: 11 } },
          },
          y: {
            title: { display: true, text: 'Fixation Count', font: { size: 13 } },
            beginAtZero: true,
            ticks: { font: { size: 11 }, precision: 0 },
          },
        },
      },
    });
  }

  /**
   * Bar chart: Dwell time per product.
   * @param {{ products: string[], values: number[] }} data  (values in ms)
   * @returns {Promise<Buffer>}
   */
  async renderDwellTimePerProduct({ products, values }) {
    return this._canvas.renderToBuffer({
      type: 'bar',
      data: {
        labels: products,
        datasets: [{
          label: 'Dwell Time (ms)',
          data: values,
          backgroundColor: products.map((_, i) => rgba(PALETTE[i % PALETTE.length], 0.82)),
          borderColor:     products.map((_, i) => PALETTE[i % PALETTE.length]),
          borderWidth: 1.5,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Dwell Time per Product',
            font: { size: 18, weight: 'bold' },
            color: '#1a1a2e',
            padding: { bottom: 16 },
          },
          legend: { display: false },
          subtitle: {
            display: true,
            text: 'Intra-Product · Tab A',
            font: { size: 11 },
            color: '#4F81BD',
            padding: { bottom: 8 },
          },
        },
        scales: {
          x: {
            title: { display: true, text: 'Product', font: { size: 13 } },
            ticks: { font: { size: 11 } },
          },
          y: {
            title: { display: true, text: 'Dwell Time (ms)', font: { size: 13 } },
            beginAtZero: true,
            ticks: { font: { size: 11 } },
          },
        },
      },
    });
  }

  // ── Tab Group B ─────────────────────────────────────────────────────────────

  /**
   * Multi-line chart: Number of fixations per product over time.
   * @param {{ timeLabels: string[], series: { product: string, values: number[] }[] }} data
   * @returns {Promise<Buffer>}
   */
  async renderFixationsOverTime({ timeLabels, series }) {
    const datasets = series.map((s, i) => ({
      label: s.product,
      data: s.values,
      borderColor:     PALETTE[i % PALETTE.length],
      backgroundColor: rgba(PALETTE[i % PALETTE.length], 0.12),
      borderWidth: 2,
      pointRadius: 3,
      fill: false,
      tension: 0.3,
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
            font: { size: 18, weight: 'bold' },
            color: '#1a1a2e',
            padding: { bottom: 16 },
          },
          subtitle: {
            display: true,
            text: 'Intra-Product · Tab B',
            font: { size: 11 },
            color: '#4F81BD',
            padding: { bottom: 8 },
          },
          legend: {
            display: true,
            position: 'top',
            labels: { font: { size: 11 }, boxWidth: 14 },
          },
        },
        scales: {
          x: {
            title: { display: true, text: 'Time', font: { size: 13 } },
            ticks: { maxTicksLimit: 12, font: { size: 10 } },
          },
          y: {
            title: { display: true, text: 'Fixation Count', font: { size: 13 } },
            beginAtZero: true,
            ticks: { font: { size: 11 }, precision: 0 },
          },
        },
      },
    });
  }

  /**
   * Multi-line chart: Dwell time per product over time.
   * @param {{ timeLabels: string[], series: { product: string, values: number[] }[] }} data
   * @returns {Promise<Buffer>}
   */
  async renderDwellTimeOverTime({ timeLabels, series }) {
    const datasets = series.map((s, i) => ({
      label: s.product,
      data: s.values,
      borderColor:     PALETTE[i % PALETTE.length],
      backgroundColor: rgba(PALETTE[i % PALETTE.length], 0.12),
      borderWidth: 2,
      pointRadius: 3,
      fill: false,
      tension: 0.3,
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
            font: { size: 18, weight: 'bold' },
            color: '#1a1a2e',
            padding: { bottom: 16 },
          },
          subtitle: {
            display: true,
            text: 'Intra-Product · Tab B',
            font: { size: 11 },
            color: '#4F81BD',
            padding: { bottom: 8 },
          },
          legend: {
            display: true,
            position: 'top',
            labels: { font: { size: 11 }, boxWidth: 14 },
          },
        },
        scales: {
          x: {
            title: { display: true, text: 'Time', font: { size: 13 } },
            ticks: { maxTicksLimit: 12, font: { size: 10 } },
          },
          y: {
            title: { display: true, text: 'Dwell Time (ms)', font: { size: 13 } },
            beginAtZero: true,
            ticks: { font: { size: 11 } },
          },
        },
      },
    });
  }
}

module.exports = IntraProductCharts;