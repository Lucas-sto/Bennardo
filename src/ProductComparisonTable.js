'use strict';

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
    // Sort by Start_ts to ensure chronological order
    const sorted = [...rows].sort(
      (a, b) => parseFloat(a['Start_ts']) - parseFloat(b['Start_ts']),
    );

    const pairCounts = {};
    let totalComparisons = 0;

    for (let i = 0; i < sorted.length - 2; i++) {
      const pA1 = sorted[i]['Target_Product'];
      const pB  = sorted[i + 1]['Target_Product'];
      const pA2 = sorted[i + 2]['Target_Product'];

      if (!pA1 || !pB || !pA2) continue;
      if (pA1 !== pA2) continue;   // must return to same product
      if (pA1 === pB)  continue;   // must have switched to a different product

      // Normalise pair key (alphabetical order)
      const key = [pA1, pB].sort().join(' vs ');
      pairCounts[key] = (pairCounts[key] || 0) + 1;
      totalComparisons++;
    }

    // Sort by count descending, take topN
    const sorted_pairs = Object.entries(pairCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN);

    const tableRows = sorted_pairs.map(([pair, count], i) => [
      i + 1,
      pair,
      count,
      totalComparisons > 0 ? `${((count / totalComparisons) * 100).toFixed(1)}%` : '0%',
    ]);

    return {
      title:    'Inter-Product: Most Compared Product Pairs',
      subtitle: 'A comparison = Product A → Product B → Product A (participant switches and returns). Pairs normalised alphabetically.',
      columns:  ['Rank', 'Product Pair', 'Comparisons', 'Share'],
      rows:     tableRows,
      topN:     3,
      footer:   `Total A→B→A comparison events detected: ${totalComparisons}  ·  Unique pairs: ${Object.keys(pairCounts).length}`,
    };
  }
}

module.exports = ProductComparisonTable;