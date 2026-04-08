'use strict';

const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const CumulativeStatsCalculator = require('./CumulativeStatsCalculator');

const WIDTH  = 900;
const HEIGHT = 500;

// One distinct colour per product slot (up to 10)
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
 * FixationsPerProductChart
 * ────────────────────────
 * Intra-Product · Tab A
 *
 * Reads raw fixation rows (from table1_fixations.csv) and renders a
 * bar chart showing the total number of fixations per product.
 *
 * Usage:
 *   const chart = new FixationsPerProductChart();
 *   const buffer = await chart.render(rows);   // rows = parsed CSV array
 *
 * Expected row shape (from DataProcessor):
 *   { Target_Product: 'Product_C', Target_AOI: 'price', Duration: 274, … }
 */
class FixationsPerProductChart {
  constructor(width = WIDTH, height = HEIGHT) {
    this._canvas = new ChartJSNodeCanvas({
      width,
      height,
      backgroundColour: '#ffffff',
    });
  }

  /**
   * Counts fixations per product and renders the bar chart.
   *
   * @param {object[]} rows  Parsed rows from table1_fixations.csv
   * @returns {Promise<Buffer>}  PNG image buffer
   */
  async render(rows) {
    const calculator = new CumulativeStatsCalculator();
    const counts = calculator.fixationsPerProduct(rows);
    const products = Object.keys(counts).sort();
    const values   = products.map((p) => counts[p]);

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
          borderRadius: 5,
        }],
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Number of Fixations per Product',
            font: { size: 20, weight: 'bold' },
            color: '#1a1a2e',
            padding: { top: 10, bottom: 6 },
          },
          subtitle: {
            display: true,
            text: 'Intra-Product Analysis  ·  Source: Raw Fixation Data',
            font: { size: 11 },
            color: '#4F81BD',
            padding: { bottom: 14 },
          },
          legend: { display: false },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Product',
              font: { size: 13, weight: '600' },
              color: '#333',
            },
            ticks: { font: { size: 12 }, color: '#333' },
            grid: { display: false },
          },
          y: {
            title: {
              display: true,
              text: 'Fixation Count',
              font: { size: 13, weight: '600' },
              color: '#333',
            },
            beginAtZero: true,
            ticks: { font: { size: 11 }, precision: 0, color: '#555' },
            grid: { color: 'rgba(0,0,0,0.06)' },
          },
        },
      },
    });
  }

}

module.exports = FixationsPerProductChart;