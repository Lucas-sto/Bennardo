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
 * FeatureDistributionOverTimeChart
 * ────────────────────────────────
 * Inter-Product Specific
 *
 * Renders a multi-line chart showing the cumulative percentage share of dwell
 * time per product feature (AOI) over the course of the session.
 * One line per AOI (e.g. Price, Brand, Details); y-axis is 0–100%.
 *
 * Usage:
 *   const chart = new FeatureDistributionOverTimeChart();
 *   const buffer = await chart.render(rows);
 *
 * Expected row shape:
 *   { Target_AOI: 'price' | 'brand' | 'details', End_ts: 1234, Duration: 274, … }
 */
class FeatureDistributionOverTimeChart {
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
    const { timeLabels, series } = this._buildSeries(rows);

    const datasets = series.map((s, i) => ({
      label: s.aoi,
      data: s.values,
      borderColor:     PALETTE[i % PALETTE.length],
      backgroundColor: rgba(PALETTE[i % PALETTE.length], 0.10),
      borderWidth: 2.5,
      pointRadius: 3,
      pointHoverRadius: 5,
      fill: false,
      tension: 0.35,
    }));

    return this._canvas.renderToBuffer({
      type: 'line',
      data: { labels: timeLabels, datasets },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Feature Attention Distribution over Time',
            font: { size: 20, weight: 'bold' },
            color: '#1a1a2e',
            padding: { top: 10, bottom: 6 },
          },
          subtitle: {
            display: true,
            text: 'Inter-Product Analysis  ·  Source: Raw Fixation Data  ·  Cumulative dwell-time share per AOI',
            font: { size: 11 },
            color: '#4F81BD',
            padding: { bottom: 14 },
          },
          legend: {
            display: true,
            position: 'top',
            labels: { font: { size: 11 }, boxWidth: 14, padding: 12 },
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
            ticks: { font: { size: 10 }, color: '#333', maxTicksLimit: 15 },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
          y: {
            title: {
              display: true,
              text: 'Share of Dwell Time (%)',
              font: { size: 13, weight: '600' },
              color: '#333',
            },
            min: 0,
            max: 100,
            ticks: {
              font: { size: 11 },
              color: '#555',
              callback: (v) => `${v}%`,
            },
            grid: { color: 'rgba(0,0,0,0.06)' },
          },
        },
      },
    });
  }

  /**
   * For each second of the session, computes the cumulative dwell-time
   * percentage per AOI and builds one series per AOI.
   *
   * @param {object[]} rows
   * @returns {{ timeLabels: string[], series: { aoi: string, values: number[] }[] }}
   */
  _buildSeries(rows) {
    if (!rows.length) return { timeLabels: [], series: [] };

    const calculator = new CumulativeStatsCalculator();
    const lastSecond = Math.ceil(Math.max(...rows.map((r) => parseFloat(r['End_ts']) || 0)) / 1000);

    // Collect all AOI keys present in the data
    const aoiSet = new Set();
    rows.forEach((r) => {
      const raw = (r['Target_AOI'] || '').trim();
      if (raw) aoiSet.add(raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase());
    });
    const aois = [...aoiSet].sort();

    const series = aois.map((aoi) => ({ aoi, values: [] }));

    for (let s = 1; s <= lastSecond; s++) {
      const dwell = calculator.dwellTimePerAOI(rows, s * 1000);
      const total = Object.values(dwell).reduce((sum, v) => sum + v, 0);

      series.forEach((s_) => {
        const pct = total > 0 ? ((dwell[s_.aoi] || 0) / total) * 100 : 0;
        s_.values.push(parseFloat(pct.toFixed(2)));
      });
    }

    const timeLabels = Array.from({ length: lastSecond }, (_, i) => `${i + 1}s`);

    return { timeLabels, series };
  }
}

module.exports = FeatureDistributionOverTimeChart;
