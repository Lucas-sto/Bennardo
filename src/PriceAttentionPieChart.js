'use strict';

const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

const WIDTH  = 800;
const HEIGHT = 500;

const rgba = (hex, a) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

/**
 * PriceAttentionPieChart
 * ──────────────────────
 * Inter-Product Specific
 *
 * Reads raw fixation rows (table1_fixations.csv) and renders a pie chart
 * showing the percentage of fixations directed at the price AOI vs. all
 * other AOIs combined.
 *
 * Usage:
 *   const chart = new PriceAttentionPieChart();
 *   const buffer = await chart.render(rows);
 *
 * Expected row shape:
 *   { Target_AOI: 'price' | 'brand' | 'details', … }
 */
class PriceAttentionPieChart {
  constructor(width = WIDTH, height = HEIGHT) {
    this._canvas = new ChartJSNodeCanvas({
      width,
      height,
      backgroundColour: '#ffffff',
    });
  }

  /**
   * @param {object[]} rows  Parsed rows from table1_fixations.csv
   * @returns {Promise<Buffer>}  PNG image buffer
   */
  async render(rows) {
    let priceCount    = 0;
    let nonPriceCount = 0;

    for (const row of rows) {
      const aoi = (row['Target_AOI'] || '').trim().toLowerCase();
      if (!aoi) continue;
      if (aoi === 'price') priceCount++;
      else                 nonPriceCount++;
    }

    const total = priceCount + nonPriceCount;
    const pricePct    = total > 0 ? ((priceCount    / total) * 100).toFixed(1) : '0.0';
    const nonPricePct = total > 0 ? ((nonPriceCount / total) * 100).toFixed(1) : '0.0';

    return this._canvas.renderToBuffer({
      type: 'pie',
      data: {
        labels: [
          `Price (${pricePct}%)`,
          `Other Features (${nonPricePct}%)`,
        ],
        datasets: [{
          data: [priceCount, nonPriceCount],
          backgroundColor: [
            rgba('#C0504D', 0.88),   // red  → price
            rgba('#4F81BD', 0.88),   // blue → other
          ],
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverOffset: 12,
        }],
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Percentage of Fixations on Price',
            font: { size: 20, weight: 'bold' },
            color: '#1a1a2e',
            padding: { top: 10, bottom: 6 },
          },
          subtitle: {
            display: true,
            text: 'Inter-Product Analysis  ·  Source: Raw Fixation Data  ·  AOI: price vs. all other features',
            font: { size: 11 },
            color: '#4F81BD',
            padding: { bottom: 14 },
          },
          legend: {
            display: true,
            position: 'right',
            labels: { font: { size: 13 }, padding: 18, boxWidth: 18 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0';
                return `  ${ctx.label.split(' (')[0]}: ${ctx.parsed} fixations (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }
}

module.exports = PriceAttentionPieChart;