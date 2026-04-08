'use strict';

const CumulativeStatsCalculator = require('./CumulativeStatsCalculator');

/**
 * ProductComparisonTable
 * ──────────────────────
 * Inter-Product Specific
 *
 * Detects product comparisons from the raw fixation sequence.
 *
 * A "comparison" is defined as:
 *   fixation[i]   → Product A
 *   fixation[i+1] → Product B  (B ≠ A)
 *   fixation[i+2] → Product A  (back to A)
 *
 * This A→B→A pattern means the participant looked at A, switched to B
 * to compare, then returned to A.  The pair (A, B) is normalised
 * alphabetically so (A,B) and (B,A) are counted together.
 *
 * Usage:
 *   const t    = new ProductComparisonTable();
 *   const data = t.compute(rows);
 *   pdfGen.addTablePage(data);
 *
 * Expected row shape (sorted by Start_ts / Fixation_ID):
 *   { Target_Product: 'Product_C', Start_ts: 1234, … }
 */
class ProductComparisonTable {
  /**
   * @param {object[]} rows  Parsed rows from table1_fixations.csv
   * @param {number}   topN  How many top pairs to show (default 10)
   * @returns {{
   *   title:    string,
   *   subtitle: string,
   *   columns:  string[],
   *   rows:     (string|number)[][],
   *   topN:     number,
   *   footer:   string,
   * }}
   */
  compute(rows, topN = 10) {
    const calculator = new CumulativeStatsCalculator();
    const pairs      = calculator.topProductComparisons(rows, Infinity, topN);
    const total      = calculator.productComparisons(rows);

    const tableRows = pairs
      .filter((p) => p.pair)
      .map((p, i) => [
        i + 1,
        p.pair,
        p.count,
        total > 0 ? `${((p.count / total) * 100).toFixed(1)}%` : '0%',
      ]);

    const uniquePairs = pairs.filter((p) => p.pair).length;

    return {
      title:    'Inter-Product: Most Compared Product Pairs',
      subtitle: 'A comparison = Product A → Product B → Product A (participant switches and returns). Pairs normalised alphabetically.',
      columns:  ['Rank', 'Product Pair', 'Comparisons', 'Share'],
      rows:     tableRows,
      topN:     3,
      footer:   `Total A→B→A comparison events detected: ${total}  ·  Unique pairs: ${uniquePairs}`,
    };
  }
}

module.exports = ProductComparisonTable;