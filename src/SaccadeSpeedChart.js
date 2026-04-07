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
 * SaccadeSpeedChart
 * ─────────────────
 * Inter-Product Specific
 *
 * Reads cumulative data (table2_cumulative.csv) and renders a line chart
 * showing:
 *   • Speed_of_Saccades_Mean      – mean saccade speed over time
 *   • AverageFixationDuration     – average fixation duration over time
 *
 * The last 10 seconds are highlighted with a different point colour.
 * Current value + trend (% change over last 10 s) are shown in the subtitle.
 *
 * Usage:
 *   const chart = new SaccadeSpeedChart();
 *   const buffer = await chart.render(cumRows);
 *
 * Expected row shape:
 *   { Second: 95, Speed_of_Saccades_Mean: 0.118, AverageFixationDuration: 275.42, … }
 */
class SaccadeSpeedChart {
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

    const labels    = sorted.map((r) => `${r['Second']}s`);
    const speeds    = sorted.map((r) => parseFloat(r['Speed_of_Saccades_Mean'])  || 0);
    const durations = sorted.map((r) => parseFloat(r['AverageFixationDuration']) || 0);

    // Trend: % change of Speed_of_Saccades_Mean over last 10 s
    const speedNow  = speeds[n - 1]      ?? 0;
    const speed10sAgo = speeds[Math.max(0, cutoff)] ?? speedNow;
    const trendPct  = speed10sAgo !== 0
      ? (((speedNow - speed10sAgo) / speed10sAgo) * 100).toFixed(1)
      : '0.0';
    const trendArrow = parseFloat(trendPct) > 0 ? '▲' : parseFloat(trendPct) < 0 ? '▼' : '→';
    const trendLabel = `Current: ${speedNow.toFixed(4)}  ${trendArrow} ${trendPct}% vs. 10 s ago`;

    // Point colours: last LAST_N points highlighted in orange
    const speedPointColors = speeds.map((_, i) =>
      i >= cutoff ? '#F79646' : rgba('#4F81BD', 0.6),
    );
    const speedPointRadius = speeds.map((_, i) => (i >= cutoff ? 5 : 2));

    return this._canvas.renderToBuffer({
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Mean Saccade Speed',
            data: speeds,
            borderColor:     '#4F81BD',
            backgroundColor: rgba('#4F81BD', 0.08),
            borderWidth: 2,
            pointRadius: speedPointRadius,
            pointBackgroundColor: speedPointColors,
            pointHoverRadius: 6,
            fill: false,
            tension: 0.3,
            yAxisID: 'yLeft',
          },
          {
            label: 'Avg Fixation Duration (ms)',
            data: durations,
            borderColor:     '#9BBB59',
            backgroundColor: rgba('#9BBB59', 0.08),
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 5,
            fill: false,
            tension: 0.3,
            borderDash: [5, 3],
            yAxisID: 'yRight',
          },
        ],
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Mean Saccade Speed & Avg Fixation Duration over Time',
            font: { size: 20, weight: 'bold' },
            color: '#1a1a2e',
            padding: { top: 10, bottom: 4 },
          },
          subtitle: {
            display: true,
            text: `Inter-Product  ·  Source: Cumulative Data  ·  ${trendLabel}  ·  Orange dots = last 10 s`,
            font: { size: 11 },
            color: '#4F81BD',
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
          yLeft: {
            type: 'linear',
            position: 'left',
            title: {
              display: true,
              text: 'Saccade Speed',
              font: { size: 12, weight: '600' },
              color: '#4F81BD',
            },
            ticks: { font: { size: 10 }, color: '#4F81BD' },
            grid: { color: 'rgba(0,0,0,0.06)' },
          },
          yRight: {
            type: 'linear',
            position: 'right',
            title: {
              display: true,
              text: 'Fixation Duration (ms)',
              font: { size: 12, weight: '600' },
              color: '#9BBB59',
            },
            ticks: { font: { size: 10 }, color: '#9BBB59' },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });
  }
}

module.exports = SaccadeSpeedChart;