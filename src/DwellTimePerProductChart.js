'use strict';

const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const CumulativeStatsCalculator = require('./CumulativeStatsCalculator');

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
 * DwellTimePerProductChart
 * ────────────────────────
 * Intra-Product · Tab A  (interchangeable with FixationsPerProductChart)
 *
 * Reads raw fixation rows (table1_fixations.csv) and renders a bar chart
 * showing the total dwell time (sum of Duration in ms) per product.
 *
 * Usage:
 *   const chart = new DwellTimePerProductChart();
 *   const buffer = await chart.render(rows);   // rows = parsed CSV array
 *
 * Expected row shape:
 *   { Target_Product: 'Product_C', Duration: 274, … }
 */
class DwellTimePerProductChart {
  constructor(width = WIDTH, height = HEIGHT) {
    this._canvas = new ChartJSNodeCanvas({
      width,
      height,
      backgroundColour: '#ffffff',
    });
  }

  /**
   * Sums Duration per product and renders the bar chart.
   *
   * @param {object[]} rows  Parsed rows from table1_fixations.csv
   * @returns {Promise<Buffer>}  PNG image buffer
   */
  async render(rows) {
    const calculator = new CumulativeStatsCalculator();
    const dwellMap = calculator.dwellTimePerProduct(rows);
    const products = Object.keys(dwellMap).sort();
    const values   = products.map((p) => dwellMap[p]);

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
          borderRadius: 5,
        }],
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Dwell Time per Product',
            font: { size: 20, weight: 'bold' },
            color: '#1a1a2e',
            padding: { top: 10, bottom: 6 },
          },
          subtitle: {
            display: true,
            text: 'Intra-Product Analysis  ·  Source: Raw Fixation Data  ·  Sum of fixation durations (ms)',
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
              text: 'Total Dwell Time (ms)',
              font: { size: 13, weight: '600' },
              color: '#333',
            },
            beginAtZero: true,
            ticks: { font: { size: 11 }, color: '#555' },
            grid: { color: 'rgba(0,0,0,0.06)' },
          },
        },
      },
    });
  }

}

module.exports = DwellTimePerProductChart;