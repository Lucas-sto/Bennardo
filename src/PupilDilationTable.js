'use strict';

const CumulativeStatsCalculator = require('./CumulativeStatsCalculator');

/**
 * PupilDilationTable
 * ──────────────────
 * Inter-Product Specific
 *
 * Computes average Pupil_Diameter_Mean per product from raw fixation rows,
 * returns structured data ready for PDFGenerator.addTablePage().
 *
 * Usage:
 *   const table = new PupilDilationTable();
 *   const data  = table.compute(rows);
 *   pdfGen.addTablePage(data);
 *
 * Expected row shape:
 *   { Target_Product: 'Product_C', Pupil_Diameter_Mean: 3.84, … }
 */
class PupilDilationTable {
  /**
   * @param {object[]} rows  Parsed rows from table1_fixations.csv
   * @returns {{
   *   title:   string,
   *   subtitle: string,
   *   columns: string[],
   *   rows:    (string|number)[][],
   *   topN:    number,
   *   footer:  string
   * }}
   */
  compute(rows) {
    const calculator = new CumulativeStatsCalculator();
    const perProduct = calculator.pupilDilationPerProduct(rows);

    // Sort descending by weighted average
    const products = Object.entries(perProduct)
      .map(([product, { avg, totalDuration }]) => ({ product, avg, totalDuration }))
      .sort((a, b) => b.avg - a.avg);

    // Overall duration-weighted average across all fixations
    const { totalWeighted, totalDuration } = rows.reduce((acc, r) => {
      const diam     = parseFloat(r['Pupil_Diameter_Mean']);
      const duration = parseFloat(r['Duration']);
      if (!isNaN(diam) && !isNaN(duration) && duration > 0) {
        acc.totalWeighted  += diam * duration;
        acc.totalDuration  += duration;
      }
      return acc;
    }, { totalWeighted: 0, totalDuration: 0 });
    const overallAvg = totalDuration > 0 ? totalWeighted / totalDuration : 0;

    // Table rows: Rank | Product | Weighted Avg Pupil Diam | Total Dwell Time (ms)
    const tableRows = products.map((p, i) => [
      i + 1,
      p.product,
      p.avg.toFixed(3),
      Math.round(p.totalDuration),
    ]);

    return {
      title:    'Inter-Product: Pupil Dilation per Product',
      subtitle: 'Duration-weighted average pupil diameter (mm) per product · Top 3 highlighted · Source: Raw Fixation Data',
      columns:  ['Rank', 'Product', 'Weighted Avg Pupil Diameter (mm)', 'Total Dwell Time (ms)'],
      rows:     tableRows,
      topN:     3,
      footer:   `Overall duration-weighted average pupil diameter: ${overallAvg.toFixed(3)} mm`,
    };
  }
}

module.exports = PupilDilationTable;