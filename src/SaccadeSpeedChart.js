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
 * SaccadeSpeedChart
 * ─────────────────
 * Inter-Product Specific
 *
 * Cumulative mean saccade speed over time.
 * Last 10 seconds highlighted in orange.
 */
class SaccadeSpeedChart {
  constructor(width = WIDTH, height = HEIGHT) {
    this._canvas = new ChartJSNodeCanvas({ width, height, backgroundColour: '#ffffff' });
  }

  async render(fixations) {
    if (!fixations || fixations.length === 0) return this._renderEmpty();

    const calculator = new CumulativeStatsCalculator();
    const lastSecond = Math.ceil(Math.max(...fixations.map(f => f.End_ts || 0)) / 1000);
    const WINDOW_S = 10;
    const labels   = [];
    const speeds   = [];

    for (let s = 1; s <= lastSecond; s++) {
      labels.push(`${s}s`);
      const window = calculator.getFixationsInWindow(fixations, Math.max(0, (s - WINDOW_S) * 1000), s * 1000);
      speeds.push(calculator.meanSaccadeSpeed(window));
    }

    const n   = labels.length;
    const now = speeds[n - 1] ?? 0;

    return this._canvas.renderToBuffer({
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Mean Saccade Speed',
          data: speeds,
          borderColor:     '#4F81BD',
          backgroundColor: rgba('#4F81BD', 0.08),
          borderWidth:     2,
          pointRadius:     2,
          pointHoverRadius: 5,
          fill:            false,
          tension:         0.3,
        }],
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Rolling Mean Saccade Speed over Time (10 s window)',
            font: { size: 20, weight: 'bold' },
            color: '#1a1a2e',
            padding: { top: 10, bottom: 4 },
          },
          subtitle: {
            display: true,
            text: `Inter-Product  ·  Raw Fixation Data  ·  Current: ${now.toFixed(4)}  ·  10-second rolling window`,
            font: { size: 11 },
            color: '#4F81BD',
            padding: { bottom: 12 },
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
            title: { display: true, text: 'Saccade Speed', font: { size: 13, weight: '600' }, color: '#333' },
            beginAtZero: true,
            ticks: { font: { size: 11 }, color: '#555' },
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
      options: { responsive: false, plugins: { title: { display: true, text: 'Cumulative Mean Saccade Speed over Time', font: { size: 20, weight: 'bold' } } } },
    });
  }
}

module.exports = SaccadeSpeedChart;
