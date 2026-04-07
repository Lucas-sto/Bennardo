'use strict';

const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

const CHART_WIDTH = 900;
const CHART_HEIGHT = 500;

// Colour palette
const PALETTE = [
  '#4F81BD', '#C0504D', '#9BBB59', '#8064A2',
  '#4BACC6', '#F79646', '#2C4770', '#A31515',
];

const PALETTE_ALPHA = (hex, a) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

/**
 * ChartGenerator
 * Renders Chart.js charts to PNG Buffers using chartjs-node-canvas.
 * Each method returns a Promise<Buffer>.
 */
class ChartGenerator {
  constructor(width = CHART_WIDTH, height = CHART_HEIGHT) {
    this.width = width;
    this.height = height;
    this._canvas = new ChartJSNodeCanvas({
      width,
      height,
      backgroundColour: '#ffffff',
    });
  }

  // ─── 1. Fixation Duration Distribution (Bar) ────────────────────────────────

  async renderFixationDurationBar({ labels, counts }) {
    const config = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Fixation Count',
            data: counts,
            backgroundColor: labels.map((_, i) => PALETTE_ALPHA(PALETTE[i % PALETTE.length], 0.8)),
            borderColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
            borderWidth: 1.5,
          },
        ],
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Fixation Duration Distribution',
            font: { size: 18, weight: 'bold' },
            color: '#1a1a2e',
          },
          legend: { display: false },
        },
        scales: {
          x: {
            title: { display: true, text: 'Duration Range', font: { size: 13 } },
            ticks: { font: { size: 11 } },
          },
          y: {
            title: { display: true, text: 'Number of Fixations', font: { size: 13 } },
            beginAtZero: true,
            ticks: { font: { size: 11 } },
          },
        },
      },
    };
    return this._canvas.renderToBuffer(config);
  }

  // ─── 2. Gaze Scatter Plot ────────────────────────────────────────────────────

  async renderGazeScatter(points) {
    const config = {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Gaze Points',
            data: points,
            backgroundColor: PALETTE_ALPHA(PALETTE[0], 0.4),
            borderColor: PALETTE_ALPHA(PALETTE[0], 0.7),
            pointRadius: 3,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Gaze Point Distribution (Raw Data)',
            font: { size: 18, weight: 'bold' },
            color: '#1a1a2e',
          },
          legend: { display: false },
        },
        scales: {
          x: {
            title: { display: true, text: 'X Coordinate', font: { size: 13 } },
            ticks: { font: { size: 11 } },
          },
          y: {
            title: { display: true, text: 'Y Coordinate', font: { size: 13 } },
            ticks: { font: { size: 11 } },
          },
        },
      },
    };
    return this._canvas.renderToBuffer(config);
  }

  // ─── 3. AOI Dwell Time (Doughnut) ───────────────────────────────────────────

  async renderAOIDoughnut({ labels, values }) {
    const config = {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            label: 'Dwell Time (ms)',
            data: values,
            backgroundColor: PALETTE.slice(0, labels.length).map((c) => PALETTE_ALPHA(c, 0.85)),
            borderColor: '#ffffff',
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'AOI Dwell Time Distribution (Cumulated)',
            font: { size: 18, weight: 'bold' },
            color: '#1a1a2e',
          },
          legend: {
            display: true,
            position: 'right',
            labels: { font: { size: 12 }, padding: 16 },
          },
        },
      },
    };
    return this._canvas.renderToBuffer(config);
  }

  // ─── 4. Time Series Line Chart ───────────────────────────────────────────────

  async renderTimeSeries({ labels, values }) {
    const config = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Value over Time',
            data: values,
            borderColor: PALETTE[1],
            backgroundColor: PALETTE_ALPHA(PALETTE[1], 0.15),
            borderWidth: 2,
            pointRadius: 2,
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Time Series – Raw Data',
            font: { size: 18, weight: 'bold' },
            color: '#1a1a2e',
          },
          legend: { display: false },
        },
        scales: {
          x: {
            title: { display: true, text: 'Timestamp', font: { size: 13 } },
            ticks: { maxTicksLimit: 12, font: { size: 10 } },
          },
          y: {
            title: { display: true, text: 'Value', font: { size: 13 } },
            beginAtZero: false,
            ticks: { font: { size: 11 } },
          },
        },
      },
    };
    return this._canvas.renderToBuffer(config);
  }

  // ─── 5. Raw vs Cumulated Comparison (Grouped Bar) ───────────────────────────

  async renderComparison({ labels, rawAvg, cumAvg }) {
    const config = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Raw (avg)',
            data: rawAvg,
            backgroundColor: PALETTE_ALPHA(PALETTE[0], 0.8),
            borderColor: PALETTE[0],
            borderWidth: 1.5,
          },
          {
            label: 'Cumulated (avg)',
            data: cumAvg,
            backgroundColor: PALETTE_ALPHA(PALETTE[2], 0.8),
            borderColor: PALETTE[2],
            borderWidth: 1.5,
          },
        ],
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Raw vs. Cumulated – Average Column Values',
            font: { size: 18, weight: 'bold' },
            color: '#1a1a2e',
          },
          legend: {
            display: true,
            labels: { font: { size: 12 } },
          },
        },
        scales: {
          x: {
            title: { display: true, text: 'Column', font: { size: 13 } },
            ticks: { font: { size: 11 } },
          },
          y: {
            title: { display: true, text: 'Average Value', font: { size: 13 } },
            beginAtZero: true,
            ticks: { font: { size: 11 } },
          },
        },
      },
    };
    return this._canvas.renderToBuffer(config);
  }

  // ─── 6. Fixation Count per Category (Horizontal Bar) ────────────────────────

  async renderFixationCountBar({ labels, counts }) {
    const config = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Fixation Count',
            data: counts,
            backgroundColor: labels.map((_, i) => PALETTE_ALPHA(PALETTE[i % PALETTE.length], 0.8)),
            borderColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
            borderWidth: 1.5,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Fixation Count per Category (Cumulated)',
            font: { size: 18, weight: 'bold' },
            color: '#1a1a2e',
          },
          legend: { display: false },
        },
        scales: {
          x: {
            title: { display: true, text: 'Fixation Count', font: { size: 13 } },
            beginAtZero: true,
            ticks: { font: { size: 11 } },
          },
          y: {
            ticks: { font: { size: 11 } },
          },
        },
      },
    };
    return this._canvas.renderToBuffer(config);
  }
}

module.exports = ChartGenerator;