'use strict';

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
    // Accumulate sum + count per product
    const acc = {};
    for (const row of rows) {
      const product = row['Target_Product'];
      const diam    = parseFloat(row['Pupil_Diameter_Mean']);
      if (!product || isNaN(diam)) continue;
      if (!acc[product]) acc[product] = { sum: 0, count: 0 };
      acc[product].sum   += diam;
      acc[product].count += 1;
    }

    // Compute averages and sort descending
    const products = Object.entries(acc)
      .map(([product, { sum, count }]) => ({
        product,
        avg: sum / count,
        count,
      }))
      .sort((a, b) => b.avg - a.avg);

    // Overall average across all fixations
    const allDiams = rows
      .map((r) => parseFloat(r['Pupil_Diameter_Mean']))
      .filter((v) => !isNaN(v));
    const overallAvg = allDiams.length
      ? allDiams.reduce((s, v) => s + v, 0) / allDiams.length
      : 0;

    // Table rows: Rank | Product | Avg Pupil Diam | Fixation Count
    const tableRows = products.map((p, i) => [
      i + 1,
      p.product,
      p.avg.toFixed(3),
      p.count,
    ]);

    return {
      title:    'Inter-Product: Pupil Dilation per Product',
      subtitle: 'Average Pupil Diameter (mm) per product · Top 3 highlighted · Source: Raw Fixation Data',
      columns:  ['Rank', 'Product', 'Avg Pupil Diameter (mm)', 'Fixation Count'],
      rows:     tableRows,
      topN:     3,
      footer:   `Overall average pupil diameter: ${overallAvg.toFixed(3)} mm  (across ${allDiams.length} fixations)`,
    };
  }
}

module.exports = PupilDilationTable;