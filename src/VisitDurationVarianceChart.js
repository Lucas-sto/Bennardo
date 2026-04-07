'use strict';

const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

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
 * Reads cumulative data (table2_cumulative.csv) and renders a line chart
 * showing Variance_TotalVisitDuration over time.
 *
 * The last 10 seconds are highlighted with orange dots.
 * Current value + trend (% change over last 10 s) are shown in the subtitle.
 *
 * Usage:
 *   const chart = new VisitDurationVarianceChart();
 *   const buffer = await chart.render(cumRows);
 *
 * Expected row shape:
 *   { Second: 95, Variance_TotalVisitDuration: 116918152.57, … }
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
   * @param {object[]} rows  Parsed rows from table2_cumulative.csv
   * @returns {Promise<Buffer>}  PNG image buffer
   */
  async render(rows) {
    const sorted = [...rows].sort(
      (a, b) => parseFloat(a['Second']) - parseFloat(b['Second']),
    );

    const LAST_N = 10;
    const n      = sorted.length;
    const cutoff = n - LAST_N;

    const labels   = sorted.map((r) => `${r['Second']}s`);
    const variance = sorted.map((r) => parseFloat(r['Variance_TotalVisitDuration']) || 0);

    // Trend: % change over last 10 s
    const valNow    = variance[n - 1]              ?? 0;
    const val10sAgo = variance[Math.max(0, cutoff)] ?? valNow;
    const trendPct  = val10sAgo !== 0
      ? (((valNow - val10sAgo) / val10sAgo) * 100).toFixed(1)
      : '0.0';
    const trendArrow = parseFloat(trendPct) > 0 ? '▲' : parseFloat(trendPct) < 0 ? '▼' : '→';

    // Format large numbers for display (millions → M)
    const fmt = (v) => {
      if (v >= 1e6)  return `${(v / 1e6).toFixed(2)} M`;
      if (v >= 1e3)  return `${(v / 1e3).toFixed(1)} k`;
      return v.toFixed(2);
    };
    const trendLabel = `Current: ${fmt(valNow)}  ${trendArrow} ${trendPct}% vs. 10 s ago`;

    // Highlight last LAST_N points in orange
    const pointColors = variance.map((_, i) =>
      i >= cutoff ? '#F79646' : rgba('#4BACC6', 0.7),
    );
    const pointRadius = variance.map((_, i) => (i >= cutoff ? 5 : 2));

    return this._canvas.renderToBuffer({
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Variance of Total Visit Duration',
          data: variance,
          borderColor:     '#4BACC6',
          backgroundColor: rgba('#4BACC6', 0.10),
          borderWidth: 2.5,
          pointRadius,
          pointBackgroundColor: pointColors,
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
            text: 'Variance across Total Visit Duration per Product over Time',
            font: { size: 20, weight: 'bold' },
            color: '#1a1a2e',
            padding: { top: 10, bottom: 4 },
          },
          subtitle: {
            display: true,
            text: `Inter-Product  ·  Source: Cumulative Data  ·  ${trendLabel}  ·  Orange dots = last 10 s`,
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
            title: {
              display: true,
              text: 'Time (s)',
              font: { size: 13, weight: '600' },
              color: '#333',
            },
            ticks: { font: { size: 9 }, color: '#333', maxTicksLimit: 20 },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
          y: {
            title: {
              display: true,
              text: 'Variance (ms²)',
              font: { size: 13, weight: '600' },
              color: '#4BACC6',
            },
            beginAtZero: true,
            ticks: {
              font: { size: 10 },
              color: '#4BACC6',
              callback: (v) => {
                if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
                if (v >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
                return v;
              },
            },
            grid: { color: 'rgba(0,0,0,0.06)' },
          },
        },
      },
    });
  }
}

module.exports = VisitDurationVarianceChart;