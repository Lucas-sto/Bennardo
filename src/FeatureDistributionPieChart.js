'use strict';

const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const CumulativeStatsCalculator = require('./CumulativeStatsCalculator');

const WIDTH  = 800;
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
 * FeatureDistributionPieChart
 * ───────────────────────────
 * Inter-Product Specific
 *
 * Reads raw fixation rows (table1_fixations.csv) and renders a pie chart
 * showing the percentage of fixations per product feature (AOI):
 *   brand · price · details  (and any other AOI values present in the data)
 *
 * Usage:
 *   const chart = new FeatureDistributionPieChart();
 *   const buffer = await chart.render(rows);
 *
 * Expected row shape:
 *   { Target_AOI: 'price' | 'brand' | 'details', … }
 */
class FeatureDistributionPieChart {
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
    const calculator = new CumulativeStatsCalculator();
    const dwell = calculator.dwellTimePerAOI(rows);

    // Sort by dwell time descending for a cleaner pie
    const sorted  = Object.entries(dwell).sort((a, b) => b[1] - a[1]);
    const labels  = sorted.map(([k]) => k);
    const values  = sorted.map(([, v]) => v);
    const total   = values.reduce((s, v) => s + v, 0);

    const legendLabels = labels.map((l, i) => {
      const pct = total > 0 ? ((values[i] / total) * 100).toFixed(1) : '0';
      return `${l} (${pct}%)`;
    });

    return this._canvas.renderToBuffer({
      type: 'pie',
      data: {
        labels: legendLabels,
        datasets: [{
          data: values,
          backgroundColor: labels.map((_, i) => rgba(PALETTE[i % PALETTE.length], 0.88)),
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
            text: 'Percentage Looked at Different Product Features',
            font: { size: 20, weight: 'bold' },
            color: '#1a1a2e',
            padding: { top: 10, bottom: 6 },
          },
          subtitle: {
            display: true,
            text: 'Inter-Product Analysis  ·  Source: Raw Fixation Data  ·  Dwell time (ms) per AOI: brand · price · details',
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
                return `  ${ctx.label.split(' (')[0]}: ${ctx.parsed} ms (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }
}

module.exports = FeatureDistributionPieChart;