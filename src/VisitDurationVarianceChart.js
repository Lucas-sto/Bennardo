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
 * VisitDurationVarianceChart
 * ──────────────────────────
 * Inter-Product Specific
 *
 * Computes and renders a line chart from raw fixation data
 * showing Variance_TotalVisitDuration over time.
 *
 * The last 10 seconds are highlighted with orange dots.
 * Current value + trend (% change over last 10 s) are shown in the subtitle.
 *
 * Usage:
 *   const chart = new VisitDurationVarianceChart();
 *   const buffer = await chart.render(rawFixations);
 *
 * Expected row shape (raw fixations):
 *   { Fixation_ID, Start_ts, End_ts, Duration, Target_Product, ... }
 */
class VisitDurationVarianceChart {
  constructor(width = WIDTH, height = HEIGHT) {
    this._canvas = new ChartJSNodeCanvas({
      width,
      height,
      backgroundColour: '#ffffff',
    });
  }

  /**
   * @param {object[]} fixations  Raw fixation data
   * @returns {Promise<Buffer>}  PNG image buffer
   */
  async render(fixations) {
    if (!fixations || fixations.length === 0) {
      return this._renderEmpty();
    }

    const calculator = new CumulativeStatsCalculator();
    const lastSecond = Math.ceil(Math.max(...fixations.map(f => f.End_ts || 0)) / 1000);
    const labels     = [];
    const cumulative = [];
    const rolling    = [];

    for (let s = 1; s <= lastSecond; s++) {
      labels.push(`${s}s`);
      cumulative.push(calculator.varianceTotalVisitDuration(fixations, s * 1000));
      rolling.push(calculator.rollingVarianceTotalVisitDuration(fixations, s * 1000));
    }

    const fmtTick = (v) => {
      if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
      if (v >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
      return v;
    };

    return this._canvas.renderToBuffer({
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Cumulative Variance (ms²)',
            data: cumulative,
            borderColor:     '#4BACC6',
            backgroundColor: rgba('#4BACC6', 0.06),
            borderWidth:     2,
            pointRadius:     2,
            pointHoverRadius: 5,
            fill:            false,
            tension:         0.3,
          },
          {
            label: 'Rolling 10 s Variance (ms²)',
            data: rolling,
            borderColor:     '#C0504D',
            backgroundColor: rgba('#C0504D', 0.08),
            borderWidth:     2,
            pointRadius:     2,
            pointHoverRadius: 5,
            fill:            false,
            tension:         0.3,
            borderDash:      [5, 3],
          },
        ],
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Variance of Total Visit Duration per Product over Time',
            font: { size: 20, weight: 'bold' },
            color: '#1a1a2e',
            padding: { top: 10, bottom: 4 },
          },
          subtitle: {
            display: true,
            text: 'Inter-Product  ·  Raw Fixation Data  ·  Blue: cumulative variance  ·  Red dashed: rolling 10 s window',
            font: { size: 11 },
            color: '#4BACC6',
            padding: { bottom: 12 },
          },
          legend: {
            display: true,
            position: 'top',
            labels: { font: { size: 11 }, boxWidth: 14, padding: 14 },
          },
        },
        scales: {
          x: {
            title: { display: true, text: 'Time (s)', font: { size: 13, weight: '600' }, color: '#333' },
            ticks: { font: { size: 9 }, color: '#333', maxTicksLimit: 20 },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
          y: {
            title: { display: true, text: 'Variance (ms²)', font: { size: 13, weight: '600' }, color: '#333' },
            beginAtZero: true,
            ticks: { font: { size: 10 }, color: '#555', callback: fmtTick },
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
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Variance across Total Visit Duration per Product over Time',
            font: { size: 20, weight: 'bold' },
          },
        },
      },
    });
  }
}

module.exports = VisitDurationVarianceChart;
