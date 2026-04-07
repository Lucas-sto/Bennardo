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
 * UniqueProductsOverTimeChart
 * ───────────────────────────
 * Inter-Product Specific
 *
 * Reads cumulative data (table2_cumulative.csv) and renders a dual-line chart:
 *   • Number_DiffProducts  – cumulative count of unique products viewed
 *   • Number_Products      – cumulative total fixation/visit count
 *
 * X-axis: Second (time in seconds from session start)
 *
 * Usage:
 *   const chart = new UniqueProductsOverTimeChart();
 *   const buffer = await chart.render(cumRows);
 *
 * Expected row shape:
 *   { Second: 1, Number_DiffProducts: 4, Number_Products: 4, … }
 */
class UniqueProductsOverTimeChart {
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
    // Sort by Second ascending
    const sorted = [...rows].sort(
      (a, b) => parseFloat(a['Second']) - parseFloat(b['Second']),
    );

    const labels      = sorted.map((r) => `${r['Second']}s`);
    const diffProds   = sorted.map((r) => parseFloat(r['Number_DiffProducts']) || 0);
    const totalProds  = sorted.map((r) => parseFloat(r['Number_Products'])     || 0);

    return this._canvas.renderToBuffer({
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Unique Products Viewed (Number_DiffProducts)',
            data: diffProds,
            borderColor:     '#4F81BD',
            backgroundColor: rgba('#4F81BD', 0.10),
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.3,
          },
          {
            label: 'Total Product Views (Number_Products)',
            data: totalProds,
            borderColor:     '#C0504D',
            backgroundColor: rgba('#C0504D', 0.06),
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 6,
            fill: false,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Unique Products Viewed & Total Product Views over Time',
            font: { size: 20, weight: 'bold' },
            color: '#1a1a2e',
            padding: { top: 10, bottom: 6 },
          },
          subtitle: {
            display: true,
            text: 'Inter-Product Analysis  ·  Source: Cumulative Data  ·  Blue: unique products seen · Red: total product views',
            font: { size: 11 },
            color: '#4F81BD',
            padding: { bottom: 14 },
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
              text: 'Count',
              font: { size: 13, weight: '600' },
              color: '#333',
            },
            beginAtZero: true,
            ticks: { font: { size: 11 }, color: '#555', precision: 0 },
            grid: { color: 'rgba(0,0,0,0.06)' },
          },
        },
      },
    });
  }
}

module.exports = UniqueProductsOverTimeChart;