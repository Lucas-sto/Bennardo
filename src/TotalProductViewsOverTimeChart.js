'use strict';

const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const CumulativeStatsCalculator = require('./CumulativeStatsCalculator');

const WIDTH  = 900;
const HEIGHT = 500;

const rgba = (hex, a) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

/**
 * TotalProductViewsOverTimeChart
 * ──────────────────────────────
 * Inter-Product Specific
 *
 * Cumulative total product views (including revisits) over time.
 */
class TotalProductViewsOverTimeChart {
  constructor(width = WIDTH, height = HEIGHT) {
    this._canvas = new ChartJSNodeCanvas({ width, height, backgroundColour: '#ffffff' });
  }

  async render(fixations) {
    if (!fixations || fixations.length === 0) return this._renderEmpty();

    const calculator = new CumulativeStatsCalculator();
    const lastSecond = Math.ceil(Math.max(...fixations.map(f => f.End_ts || 0)) / 1000);
    const labels     = [];
    const values     = [];

    for (let s = 1; s <= lastSecond; s++) {
      labels.push(`${s}s`);
      values.push(calculator.numberOfProducts(fixations, s * 1000));
    }

    return this._canvas.renderToBuffer({
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Total Product Views',
          data: values,
          borderColor:     '#C0504D',
          backgroundColor: rgba('#C0504D', 0.10),
          borderWidth: 2.5,
          pointRadius: 3,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.3,
        }],
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Cumulative Total Product Views over Time',
            font: { size: 20, weight: 'bold' },
            color: '#1a1a2e',
            padding: { top: 10, bottom: 6 },
          },
          subtitle: {
            display: true,
            text: 'Inter-Product Analysis  ·  Source: Raw Fixation Data  ·  Cumulative product views including revisits',
            font: { size: 11 },
            color: '#4F81BD',
            padding: { bottom: 14 },
          },
          legend: { display: false },
        },
        scales: {
          x: {
            title: { display: true, text: 'Time (s)', font: { size: 13, weight: '600' }, color: '#333' },
            ticks: { font: { size: 9 }, color: '#333', maxTicksLimit: 20 },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
          y: {
            title: { display: true, text: 'Total Views', font: { size: 13, weight: '600' }, color: '#333' },
            beginAtZero: true,
            ticks: { font: { size: 11 }, color: '#555', precision: 0 },
            grid: { color: 'rgba(0,0,0,0.06)' },
          },
        },
      },
    });
  }

  async _renderEmpty() {
    return this._canvas.renderToBuffer({
      type: 'line',
      data: { labels: ['No data'], datasets: [] },
      options: { responsive: false, plugins: { title: { display: true, text: 'Cumulative Total Product Views over Time', font: { size: 20, weight: 'bold' } } } },
    });
  }
}

module.exports = TotalProductViewsOverTimeChart;
