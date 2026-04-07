'use strict';

const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

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
 * InterProductCharts
 * ──────────────────
 * Renders all Inter-Product specific charts.
 *
 * One combined pie chart:
 *   renderFeatureLookPieChart(data)
 *     → Shows percentage of fixations/dwell time on:
 *         • Price
 *         • Brand
 *         • Rating
 *         • Other product features
 *
 * All methods return Promise<Buffer> (PNG).
 *
 * Expected data shape:
 *   {
 *     features: string[],   // e.g. ['Price', 'Brand', 'Rating', 'Other']
 *     values:   number[],   // fixation counts or dwell times per feature
 *     metric:   string,     // 'fixations' | 'dwell_time'  (used for label)
 *   }
 */
class InterProductCharts {
  constructor(width = WIDTH, height = HEIGHT) {
    this.width  = width;
    this.height = height;
    this._canvas = new ChartJSNodeCanvas({
      width,
      height,
      backgroundColour: '#ffffff',
    });
  }

  /**
   * Pie chart: Percentage looked at price vs. product features.
   *
   * @param {{
   *   features: string[],
   *   values:   number[],
   *   metric?:  'fixations' | 'dwell_time'
   * }} data
   * @returns {Promise<Buffer>}
   */
  async renderFeatureLookPieChart({ features, values, metric = 'fixations' }) {
    const metricLabel = metric === 'dwell_time' ? 'Dwell Time' : 'Fixations';
    const total = values.reduce((s, v) => s + v, 0);

    // Compute percentage labels for the legend
    const percentages = values.map((v) =>
      total > 0 ? `${((v / total) * 100).toFixed(1)}%` : '0%',
    );
    const legendLabels = features.map((f, i) => `${f} (${percentages[i]})`);

    return this._canvas.renderToBuffer({
      type: 'pie',
      data: {
        labels: legendLabels,
        datasets: [{
          label: metricLabel,
          data: values,
          backgroundColor: PALETTE.slice(0, features.length).map((c) => rgba(c, 0.88)),
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverOffset: 10,
        }],
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: `Percentage Looked at Product Features (${metricLabel})`,
            font: { size: 18, weight: 'bold' },
            color: '#1a1a2e',
            padding: { bottom: 16 },
          },
          subtitle: {
            display: true,
            text: 'Inter-Product · Price · Brand · Rating · Other Features',
            font: { size: 11 },
            color: '#4F81BD',
            padding: { bottom: 8 },
          },
          legend: {
            display: true,
            position: 'right',
            labels: {
              font: { size: 12 },
              padding: 16,
              boxWidth: 16,
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const pct = total > 0
                  ? ((ctx.parsed / total) * 100).toFixed(1)
                  : '0';
                return ` ${ctx.label.split(' (')[0]}: ${ctx.parsed} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }

  /**
   * Convenience: render both fixation-based and dwell-time-based pie charts.
   * Returns an object with two PNG buffers.
   *
   * @param {{
   *   features:       string[],
   *   fixationValues: number[],
   *   dwellValues:    number[],
   * }} data
   * @returns {Promise<{ fixationsBuf: Buffer, dwellBuf: Buffer }>}
   */
  async renderBoth({ features, fixationValues, dwellValues }) {
    const [fixationsBuf, dwellBuf] = await Promise.all([
      this.renderFeatureLookPieChart({ features, values: fixationValues, metric: 'fixations' }),
      this.renderFeatureLookPieChart({ features, values: dwellValues,    metric: 'dwell_time' }),
    ]);
    return { fixationsBuf, dwellBuf };
  }
}

module.exports = InterProductCharts;