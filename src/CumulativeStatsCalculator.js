'use strict';

/**
 * CumulativeStatsCalculator
 * ─────────────────────────
 * Computes cumulative metrics from raw fixation data (table1_fixations.csv)
 * to generate cumulative data (table2_cumulative.csv).
 * 
 * Each metric is computed cumulatively from the start up to a given second.
 * 
 * Usage:
 *   const calc = new CumulativeStatsCalculator();
 *   const row = calc.computeAll(fixations, 5); // compute for second 5
 */
class CumulativeStatsCalculator {
  
  /**
   * Filter fixations up to (and including) the given timestamp.
   * @param {object[]} fixations - All fixation rows
   * @param {number} secondMs - Cutoff timestamp in milliseconds
   * @returns {object[]} Filtered fixations where End_ts <= secondMs
   */
  getFixationsUpTo(fixations, secondMs = Infinity) {
    return fixations.filter(f => (f.End_ts || 0) <= secondMs);
  }

  /**
   * Filter fixations whose End_ts falls within [fromMs, toMs].
   * @param {object[]} fixations
   * @param {number} fromMs
   * @param {number} [toMs=Infinity]
   * @returns {object[]}
   */
  getFixationsInWindow(fixations, fromMs, toMs = Infinity) {
    return fixations.filter(f => {
      const ts = f.End_ts || 0;
      return ts >= fromMs && ts <= toMs;
    });
  }

  /**
   * Count product comparisons (X→Y→X patterns).
   * A comparison occurs when fixation[i] and fixation[i+2] are on the same product,
   * but fixation[i+1] is on a different product.
   * 
   * @param {object[]} fixations
   * @param {number} secondMs
   * @returns {number} Total number of comparisons
   */
  productComparisons(fixations, secondMs = Infinity) {
    const filtered  = this.getFixationsUpTo(fixations, secondMs);
    const collapsed = this._collapseToVisits(filtered);
    let count = 0;

    for (let i = 0; i < collapsed.length - 2; i++) {
      const prod1 = collapsed[i];
      const prod2 = collapsed[i + 1];
      const prod3 = collapsed[i + 2];
      if (prod1 === prod3 && prod1 !== prod2) count++;
    }

    return count;
  }

  /**
   * Get top N product comparison pairs with their counts.
   * Returns array of {pair, count} sorted by count descending.
   * 
   * @param {object[]} fixations
   * @param {number} secondMs
   * @returns {Array<{pair: string, count: number}>}
   */
  topProductComparisons(fixations, secondMs = Infinity, topN = 3) {
    const filtered   = this.getFixationsUpTo(fixations, secondMs);
    const collapsed  = this._collapseToVisits(filtered);
    const pairCounts = {};

    for (let i = 0; i < collapsed.length - 2; i++) {
      const prod1 = collapsed[i];
      const prod2 = collapsed[i + 1];
      const prod3 = collapsed[i + 2];
      if (prod1 === prod3 && prod1 !== prod2) {
        const pair = [prod1, prod2].sort().join(' vs ');
        pairCounts[pair] = (pairCounts[pair] || 0) + 1;
      }
    }

    const sorted = Object.entries(pairCounts)
      .map(([pair, count]) => ({ pair, count }))
      .sort((a, b) => b.count - a.count);

    const result = [];
    for (let i = 0; i < topN; i++) {
      result.push(sorted[i] || { pair: '', count: 0 });
    }

    return result;
  }

  /**
   * Collapse consecutive rows with the same Target_Product into a single visit.
   * Returns an array of product name strings.
   *
   * @param {object[]} fixations
   * @returns {string[]}
   */
  _collapseToVisits(fixations) {
    const visits = [];
    let prev = null;
    for (const row of fixations) {
      const product = row['Target_Product'];
      if (!product) continue;
      if (product !== prev) {
        visits.push(product);
        prev = product;
      }
    }
    return visits;
  }

  /**
   * Count unique (different) products fixated.
   * 
   * @param {object[]} fixations
   * @param {number} secondMs
   * @returns {number}
   */
  numberOfDifferentProducts(fixations, secondMs = Infinity) {
    const filtered = this.getFixationsUpTo(fixations, secondMs);
    const uniqueProducts = new Set();
    
    filtered.forEach(f => {
      if (f.Target_Product) uniqueProducts.add(f.Target_Product);
    });
    
    return uniqueProducts.size;
  }

  /**
   * Count total product fixations (including refixations).
   * 
   * @param {object[]} fixations
   * @param {number} secondMs
   * @returns {number}
   */
  numberOfProducts(fixations, secondMs = Infinity) {
    const filtered = this.getFixationsUpTo(fixations, secondMs);
    return this._collapseToVisits(filtered).length;
  }

  /**
   * Calculate mean saccade speed (amplitude / duration).
   * 
   * @param {object[]} fixations
   * @param {number} secondMs
   * @returns {number}
   */
  meanSaccadeSpeed(fixations, secondMs = Infinity) {
    const filtered = this.getFixationsUpTo(fixations, secondMs);
    const speeds = [];
    
    filtered.forEach(f => {
      const dur = f.Preceding_saccade_duration;
      const amp = f.Preceding_saccade_amplitude;
      if (dur && dur > 0 && amp !== undefined && amp !== null) {
        speeds.push(amp / dur);
      }
    });
    
    if (speeds.length === 0) return 0;
    return speeds.reduce((sum, s) => sum + s, 0) / speeds.length;
  }

  /**
   * Calculate average fixation duration.
   * 
   * @param {object[]} fixations
   * @param {number} secondMs
   * @returns {number}
   */
  averageFixationDuration(fixations, secondMs = Infinity) {
    const filtered = this.getFixationsUpTo(fixations, secondMs);
    const durations = filtered.map(f => f.Duration || 0).filter(d => d > 0);
    
    if (durations.length === 0) return 0;
    return durations.reduce((sum, d) => sum + d, 0) / durations.length;
  }

  /**
   * Calculate average fixation duration over a rolling window ending at secondMs.
   *
   * @param {object[]} fixations
   * @param {number} secondMs  - end of the window
   * @param {number} [windowMs=10000] - size of the rolling window in ms
   * @returns {number}
   */
  rollingAverageFixationDuration(fixations, secondMs, windowMs = 10000) {
    const window = this.getFixationsInWindow(fixations, Math.max(0, secondMs - windowMs), secondMs);
    return this.averageFixationDuration(window);
  }

  /**
   * Calculate variance of fixation durations.
   * 
   * @param {object[]} fixations
   * @param {number} secondMs
   * @returns {number}
   */
  varianceFixationDuration(fixations, secondMs = Infinity) {
    const filtered = this.getFixationsUpTo(fixations, secondMs);
    const durations = filtered.map(f => f.Duration || 0).filter(d => d > 0);
    
    if (durations.length === 0) return 0;
    
    const mean = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / durations.length;
    
    return variance;
  }

  /**
   * Calculate variance of fixation durations over a rolling window ending at secondMs.
   *
   * @param {object[]} fixations
   * @param {number} secondMs
   * @param {number} [windowMs=10000]
   * @returns {number}
   */
  rollingVarianceFixationDuration(fixations, secondMs, windowMs = 10000) {
    const window = this.getFixationsInWindow(fixations, Math.max(0, secondMs - windowMs), secondMs);
    return this.varianceFixationDuration(window);
  }

  /**
   * Calculate variance of total visit duration across products.
   * Visit duration = sum of all fixation durations for each product.
   * 
   * @param {object[]} fixations
   * @param {number} secondMs
   * @returns {number}
   */
  varianceTotalVisitDuration(fixations, secondMs = Infinity) {
    const filtered = this.getFixationsUpTo(fixations, secondMs);
    
    // Calculate total visit duration per product
    const productDurations = {};
    filtered.forEach(f => {
      if (f.Target_Product && f.Duration) {
        productDurations[f.Target_Product] = (productDurations[f.Target_Product] || 0) + f.Duration;
      }
    });
    
    const durations = Object.values(productDurations);
    if (durations.length === 0) return 0;
    
    const mean = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / durations.length;
    
    return variance;
  }

  /**
   * Calculate variance of total visit duration across products over a rolling window.
   *
   * @param {object[]} fixations
   * @param {number} secondMs
   * @param {number} [windowMs=10000]
   * @returns {number}
   */
  rollingVarianceTotalVisitDuration(fixations, secondMs, windowMs = 10000) {
    const window = this.getFixationsInWindow(fixations, Math.max(0, secondMs - windowMs), secondMs);
    return this.varianceTotalVisitDuration(window);
  }

  /**
   * Find the product that was revisited most often.
   * A revisit occurs when we return to a product after looking at a different product.
   * 
   * @param {object[]} fixations
   * @param {number} secondMs
   * @returns {{product: string, count: number}}
   */
  /**
   * Count revisits per product up to a given timestamp.
   * A revisit = returning to a product after having switched away.
   *
   * @param {object[]} fixations
   * @param {number} [secondMs=Infinity]
   * @returns {{ [product: string]: number }}
   */
  revisitsPerProduct(fixations, secondMs = Infinity) {
    const filtered  = this.getFixationsUpTo(fixations, secondMs);
    const collapsed = this._collapseToVisits(filtered);
    const visited   = new Set();
    const counts    = {};

    for (const product of collapsed) {
      if (visited.has(product)) {
        counts[product] = (counts[product] || 0) + 1;
      } else {
        visited.add(product);
        counts[product] = 0;
      }
    }

    return counts;
  }

  maxRevisitProduct(fixations, secondMs = Infinity) {
    const counts = this.revisitsPerProduct(fixations, secondMs);
    let maxProduct = '';
    let maxCount   = 0;

    for (const [product, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount   = count;
        maxProduct = product;
      }
    }

    return { product: maxProduct, count: maxCount };
  }

  /**
   * Count fixations per product up to a given timestamp using consecutive-run logic.
   * Consecutive rows on the same product (different AOIs) count as one fixation.
   *
   * @param {object[]} fixations
   * @param {number} [secondMs=Infinity]
   * @returns {{ [product: string]: number }}
   */
  fixationsPerProduct(fixations, secondMs = Infinity) {
    const filtered = this.getFixationsUpTo(fixations, secondMs);
    const counts   = {};
    for (const product of this._collapseToVisits(filtered)) {
      counts[product] = (counts[product] || 0) + 1;
    }
    return counts;
  }

  /**
   * Sum dwell time (Duration) per product up to a given timestamp.
   *
   * @param {object[]} fixations
   * @param {number} [secondMs=Infinity]
   * @returns {{ [product: string]: number }}
   */
  dwellTimePerProduct(fixations, secondMs = Infinity) {
    const filtered = this.getFixationsUpTo(fixations, secondMs);
    const totals = {};
    for (const row of filtered) {
      const product  = row['Target_Product'];
      const duration = parseFloat(row['Duration']);
      if (!product || isNaN(duration)) continue;
      totals[product] = (totals[product] || 0) + duration;
    }
    return totals;
  }

  /**
   * Compute duration-weighted average pupil diameter per product up to a given timestamp.
   * Each fixation's pupil reading is weighted by its Duration so longer fixations
   * contribute proportionally more to the average.
   *
   * @param {object[]} fixations
   * @param {number} [secondMs=Infinity]
   * @returns {{ [product: string]: { avg: number, totalDuration: number } }}
   */
  pupilDilationPerProduct(fixations, secondMs = Infinity) {
    const filtered = this.getFixationsUpTo(fixations, secondMs);
    const acc = {};
    for (const row of filtered) {
      const product  = row['Target_Product'];
      const diam     = parseFloat(row['Pupil_Diameter_Mean']);
      const duration = parseFloat(row['Duration']);
      if (!product || isNaN(diam) || isNaN(duration) || duration <= 0) continue;
      if (!acc[product]) acc[product] = { weightedSum: 0, totalDuration: 0 };
      acc[product].weightedSum   += diam * duration;
      acc[product].totalDuration += duration;
    }
    const result = {};
    for (const [product, { weightedSum, totalDuration }] of Object.entries(acc)) {
      result[product] = { avg: weightedSum / totalDuration, totalDuration };
    }
    return result;
  }

  /**
   * Sum dwell time (Duration) per AOI up to a given timestamp.
   *
   * @param {object[]} fixations
   * @param {number} [secondMs=Infinity]
   * @returns {{ [aoi: string]: number }}
   */
  dwellTimePerAOI(fixations, secondMs = Infinity) {
    const filtered = this.getFixationsUpTo(fixations, secondMs);
    const totals = {};
    for (const row of filtered) {
      const raw      = (row['Target_AOI'] || '').trim();
      const duration = parseFloat(row['Duration']);
      if (!raw || isNaN(duration)) continue;
      const key = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
      totals[key] = (totals[key] || 0) + duration;
    }
    return totals;
  }

  /**
   * Calculate the ratio of fixations on "price" AOI vs all fixations.
   * 
   * @param {object[]} fixations
   * @param {number} secondMs
   * @returns {number} Ratio between 0 and 1
   */
  priceAttentionRatio(fixations, secondMs = Infinity) {
    const filtered = this.getFixationsUpTo(fixations, secondMs);
    
    let priceCount = 0;
    let totalCount = 0;
    
    filtered.forEach(f => {
      if (f.Target_AOI) {
        totalCount++;
        if (f.Target_AOI.toLowerCase() === 'price') {
          priceCount++;
        }
      }
    });
    
    return totalCount > 0 ? priceCount / totalCount : 0;
  }

  /**
   * Compute all metrics for a given second.
   * 
   * @param {object[]} fixations - All fixation data
   * @param {number} second - The second to compute metrics for (1, 2, 3, ...)
   * @returns {object} Row object with all computed metrics
   */
  computeAll(fixations, second) {
    const secondMs = second * 1000;
    
    const top3 = this.topProductComparisons(fixations, secondMs, 3);
    const maxRevisit = this.maxRevisitProduct(fixations, secondMs);
    
    return {
      Second: second,
      Product_comparisons: this.productComparisons(fixations, secondMs),
      Top1_ProductComparisons: top3[0].pair,
      Top1_ProductComparisons_number: top3[0].count,
      Top2_ProductComparisons: top3[1].pair,
      Top2_ProductComparisons_number: top3[1].count,
      Top3_ProductComparisons: top3[2].pair,
      Top3_ProductComparisons_number: top3[2].count,
      Number_DiffProducts: this.numberOfDifferentProducts(fixations, secondMs),
      Number_Products: this.numberOfProducts(fixations, secondMs),
      Speed_of_Saccades_Mean: this.meanSaccadeSpeed(fixations, secondMs),
      Variance_AverageFixationDuration: this.varianceFixationDuration(fixations, secondMs),
      AverageFixationDuration: this.averageFixationDuration(fixations, secondMs),
      Variance_TotalVisitDuration: this.varianceTotalVisitDuration(fixations, secondMs),
      MaxRevisitOfProduct: maxRevisit.product,
      MaxRevisitOfProduct_number: maxRevisit.count,
      ShoppingCart_times: 0, // Cannot be computed from fixation data
      PriceAttentionRatio: this.priceAttentionRatio(fixations, secondMs),
    };
  }
}

module.exports = CumulativeStatsCalculator;
