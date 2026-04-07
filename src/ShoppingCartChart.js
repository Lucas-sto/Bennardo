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
 * ShoppingCartChart
 * ─────────────────
 * Inter-Product Specific
 *
 * Reads cumulative data (table2_cumulative.csv) and renders a stepped line
 * chart showing ShoppingCart_times (cumulative add-to-cart events) over time.
 *
 * The final (total) value is shown prominently in the chart title.
 * The last 10 seconds are highlighted with orange dots.
 *
 * Usage:
 *   const chart = new ShoppingCartChart();
 *   const buffer = await chart.render(cumRows);
 *
 * Expected row shape:
 *   { Second: 95, ShoppingCart_times: 3, … }
 */
class ShoppingCartChart {
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

    const labels  = sorted.map((r) => `${r['Second']}s`);
    const values  = sorted.map((r) => parseFloat(r['ShoppingCart_times']) || 0);

    const totalNow  = values[n - 1] ?? 0;
    const val10sAgo = values[Math.max(0, cutoff)] ?? totalNow;
    const addedLast10 = totalNow - val10sAgo;

    const trendLabel = addedLast10 > 0
      ? `+${addedLast10} in last 10 s`
      : 'no new additions in last 10 s';

    // Highlight last LAST_N points in orange
    const pointColors = values.map((_, i) =>
      i >= cutoff ? '#F79646' : rgba('#00B050', 0.8),
    );
    const pointRadius = values.map((_, i) => (i >= cutoff ? 5 : 2));

    return this._canvas.renderToBuffer({
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Shopping Cart Additions (cumulative)',
          data: values,
          borderColor:     '#00B050',
          backgroundColor: rgba('#00B050', 0.12),
          borderWidth: 2.5,
          pointRadius,
          pointBackgroundColor: pointColors,
          pointHoverRadius: 6,
          fill: true,
          tension: 0,        // stepped look — cart additions are discrete events
          stepped: 'before',
        }],
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: `Times Item Saved to Shopping Cart: ${totalNow}`,
            font: { size: 22, weight: 'bold' },
            color: '#00B050',
            padding: { top: 10, bottom: 4 },
          },
          subtitle: {
            display: true,
            text: `Inter-Product  ·  Source: Cumulative Data  ·  Total: ${totalNow} add-to-cart event${totalNow !== 1 ? 's' : ''}  ·  ${trendLabel}  ·  Orange dots = last 10 s`,
            font: { size: 11 },
            color: '#555',
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
              text: 'Cumulative Cart Additions',
              font: { size: 13, weight: '600' },
              color: '#00B050',
            },
            beginAtZero: true,
            ticks: { font: { size: 11 }, color: '#00B050', precision: 0 },
            grid: { color: 'rgba(0,0,0,0.06)' },
          },
        },
      },
    });
  }
}

module.exports = ShoppingCartChart;