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
 * MaxRevisitChart
 * ───────────────
 * Inter-Product Specific
 *
 * Detects product revisits from the raw fixation sequence.
 *
 * A "revisit" = returning to a product after having switched away to another.
 * Algorithm:
 *   - Walk fixations sorted by Start_ts
 *   - Track the last product seen
 *   - When the product changes, record the switch
 *   - When we return to a product we've already visited, increment its revisit count
 *
 * Renders a horizontal bar chart with:
 *   - All products' revisit counts
 *   - The product with the MAX revisit count highlighted in gold
 *   - Title annotation showing the winner + count
 *
 * Usage:
 *   const chart = new MaxRevisitChart();
 *   const buffer = await chart.render(rows);
 *
 * Expected row shape:
 *   { Target_Product: 'Product_C', Start_ts: 1234, … }
 */
class MaxRevisitChart {
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
    // Sort by Start_ts
    const sorted = [...rows].sort(
      (a, b) => parseFloat(a['Start_ts']) - parseFloat(b['Start_ts']),
    );

    // Count revisits per product
    const visited  = new Set();
    const revisits = {};
    let lastProduct = null;

    for (const row of sorted) {
      const product = (row['Target_Product'] || '').trim();
      if (!product) continue;
      if (product === lastProduct) continue; // still on same product

      if (visited.has(product)) {
        revisits[product] = (revisits[product] || 0) + 1;
      } else {
        visited.add(product);
        revisits[product] = 0;
      }
      lastProduct = product;
    }

    // Ensure all visited products appear (even with 0 revisits)
    for (const p of visited) {
      if (!(p in revisits)) revisits[p] = 0;
    }

    // Sort by revisit count descending
    const sorted_products = Object.entries(revisits).sort((a, b) => b[1] - a[1]);
    const labels  = sorted_products.map(([p]) => p);
    const values  = sorted_products.map(([, v]) => v);

    // Find max
    const maxVal     = Math.max(...values);
    const maxProduct = labels[values.indexOf(maxVal)];

    // Colours: gold for max, blue for others
    const bgColors = values.map((v) =>
      v === maxVal ? rgba('#FFD700', 0.9) : rgba('#4F81BD', 0.75),
    );
    const borderColors = values.map((v) =>
      v === maxVal ? '#B8860B' : '#2C4770',
    );

    return this._canvas.renderToBuffer({
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Revisit Count',
          data: values,
          backgroundColor: bgColors,
          borderColor: borderColors,
          borderWidth: 1.5,
          borderRadius: 4,
        }],
      },
      options: {
        indexAxis: 'y',   // horizontal bar chart
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: `Max Revisit: ${maxProduct}  (${maxVal} revisit${maxVal !== 1 ? 's' : ''})`,
            font: { size: 20, weight: 'bold' },
            color: '#1a1a2e',
            padding: { top: 10, bottom: 6 },
          },
          subtitle: {
            display: true,
            text: 'Inter-Product Analysis  ·  Source: Raw Fixation Data  ·  Gold bar = most revisited product  ·  Revisit = returning after switching away',
            font: { size: 11 },
            color: '#4F81BD',
            padding: { bottom: 14 },
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `  ${ctx.parsed.x} revisit${ctx.parsed.x !== 1 ? 's' : ''}`,
            },
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Number of Revisits',
              font: { size: 13, weight: '600' },
              color: '#333',
            },
            beginAtZero: true,
            ticks: { font: { size: 11 }, color: '#333', precision: 0 },
            grid: { color: 'rgba(0,0,0,0.06)' },
          },
          y: {
            ticks: { font: { size: 12 }, color: '#1a1a2e' },
            grid: { display: false },
          },
        },
      },
    });
  }
}

module.exports = MaxRevisitChart;