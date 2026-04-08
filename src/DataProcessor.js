'use strict';

const fs = require('fs');
const { parse } = require('csv-parse/sync');
const CumulativeStatsCalculator = require('./CumulativeStatsCalculator');

/**
 * DataProcessor
 * Parses raw and cumulated CSV files and exposes structured data
 * for chart generation.
 */
class DataProcessor {
  constructor() {
    this.rawData = null;
    this.cumulatedData = null;
  }

  // ─── helpers ────────────────────────────────────────────────────────────────

  _readCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: true, // auto-cast numbers
    });
  }

  _numericCol(rows, col) {
    return rows
      .map((r) => parseFloat(r[col]))
      .filter((v) => !isNaN(v));
  }

  _firstNumericCols(rows, max = 6) {
    if (!rows || rows.length === 0) return [];
    return Object.keys(rows[0])
      .filter((k) => !isNaN(parseFloat(rows[0][k])))
      .slice(0, max);
  }

  // ─── public API ─────────────────────────────────────────────────────────────

  loadRaw(filePath) {
    this.rawData = this._readCSV(filePath);
    return this;
  }

  loadCumulated(filePath) {
    this.cumulatedData = this._readCSV(filePath);
    return this;
  }

  /**
   * Generate cumulated data from raw fixation data.
   * Computes metrics for each second from 1 to the last second in the data.
   * @returns {DataProcessor} this
   */
  generateCumulatedData() {
    if (!this.rawData || this.rawData.length === 0) {
      this.cumulatedData = [];
      return this;
    }

    const calculator = new CumulativeStatsCalculator();
    
    // Find the last timestamp in milliseconds
    const lastTimestamp = Math.max(...this.rawData.map(f => f.End_ts || 0));
    const lastSecond = Math.ceil(lastTimestamp / 1000);
    
    // Generate cumulative data for each second
    const cumulatedRows = [];
    for (let second = 1; second <= lastSecond; second++) {
      cumulatedRows.push(calculator.computeAll(this.rawData, second));
    }
    
    this.cumulatedData = cumulatedRows;
    return this;
  }

  getHeaders(type = 'raw') {
    const rows = type === 'raw' ? this.rawData : this.cumulatedData;
    if (!rows || rows.length === 0) return [];
    return Object.keys(rows[0]);
  }

  /**
   * Returns data for a fixation-duration bar chart.
   * Buckets fixation durations (ms) into ranges.
   */
  getFixationDurationDistribution() {
    const rows = this.rawData || [];
    const durationCol = this._findCol(rows, [
      'fixation_duration', 'duration', 'Duration', 'FixationDuration',
      'Fixation Duration', 'fixation duration', 'GazeEventDuration',
    ]);

    const values = durationCol ? this._numericCol(rows, durationCol) : [];

    if (values.length === 0) {
      // fallback: use first numeric column
      const cols = this._firstNumericCols(rows, 1);
      if (cols.length) values.push(...this._numericCol(rows, cols[0]));
    }

    const buckets = [0, 100, 200, 300, 500, 750, 1000, 1500, 2000];
    const labels = buckets.slice(0, -1).map((b, i) => `${b}–${buckets[i + 1]} ms`);
    labels.push(`>${buckets[buckets.length - 1]} ms`);

    const counts = new Array(labels.length).fill(0);
    values.forEach((v) => {
      let placed = false;
      for (let i = 0; i < buckets.length - 1; i++) {
        if (v >= buckets[i] && v < buckets[i + 1]) {
          counts[i]++;
          placed = true;
          break;
        }
      }
      if (!placed) counts[counts.length - 1]++;
    });

    return { labels, counts };
  }

  /**
   * Returns gaze scatter data (x, y coordinates).
   */
  getGazeScatterData() {
    const rows = this.rawData || [];
    const xCol = this._findCol(rows, ['x', 'X', 'GazeX', 'gaze_x', 'FixationX', 'MappedFixationPointX']);
    const yCol = this._findCol(rows, ['y', 'Y', 'GazeY', 'gaze_y', 'FixationY', 'MappedFixationPointY']);

    if (!xCol || !yCol) {
      const cols = this._firstNumericCols(rows, 2);
      if (cols.length >= 2) {
        return rows.slice(0, 500).map((r) => ({
          x: parseFloat(r[cols[0]]),
          y: parseFloat(r[cols[1]]),
        })).filter((p) => !isNaN(p.x) && !isNaN(p.y));
      }
      return [];
    }

    return rows.slice(0, 500).map((r) => ({
      x: parseFloat(r[xCol]),
      y: parseFloat(r[yCol]),
    })).filter((p) => !isNaN(p.x) && !isNaN(p.y));
  }

  /**
   * Returns AOI (Area of Interest) dwell time from cumulated data.
   */
  getAOIDwellTime() {
    const rows = this.cumulatedData || [];
    const aoiCol = this._findCol(rows, ['aoi', 'AOI', 'area', 'Area', 'Zone', 'zone', 'Segment', 'segment', 'Category']);
    const timeCol = this._findCol(rows, [
      'dwell_time', 'DwellTime', 'dwell', 'time', 'Time', 'Duration',
      'duration', 'TotalDuration', 'total_duration',
    ]);

    if (!aoiCol || !timeCol) {
      // fallback: first string col as label, first numeric col as value
      const headers = this.getHeaders('cumulated');
      const strCol = headers.find((h) => isNaN(parseFloat(rows[0]?.[h])));
      const numCol = headers.find((h) => !isNaN(parseFloat(rows[0]?.[h])));
      if (strCol && numCol) {
        return {
          labels: rows.map((r) => String(r[strCol])),
          values: rows.map((r) => parseFloat(r[numCol])).filter((v) => !isNaN(v)),
        };
      }
      return { labels: [], values: [] };
    }

    return {
      labels: rows.map((r) => String(r[aoiCol])),
      values: rows.map((r) => parseFloat(r[timeCol])).filter((v) => !isNaN(v)),
    };
  }

  /**
   * Returns a time-series line chart from raw data (first numeric col over row index).
   */
  getTimeSeriesData() {
    const rows = this.rawData || [];
    const timeCol = this._findCol(rows, [
      'timestamp', 'Timestamp', 'time', 'Time', 'RecordingTimestamp',
    ]);
    const valueCol = this._findCol(rows, [
      'fixation_duration', 'duration', 'Duration', 'GazeEventDuration',
      'pupil', 'Pupil', 'PupilLeft', 'PupilRight',
    ]);

    const tCol = timeCol || (this._firstNumericCols(rows, 1)[0] ?? null);
    const vCol = valueCol || (this._firstNumericCols(rows, 2)[1] ?? null);

    if (!tCol || !vCol) return { labels: [], values: [] };

    const sample = rows.filter((_, i) => i % Math.max(1, Math.floor(rows.length / 100)) === 0);
    return {
      labels: sample.map((r) => String(r[tCol])),
      values: sample.map((r) => parseFloat(r[vCol])).filter((v) => !isNaN(v)),
    };
  }

  /**
   * Returns a comparison bar chart: avg values per column for raw vs cumulated.
   */
  getComparisonData() {
    const rawCols = this._firstNumericCols(this.rawData || [], 5);
    const cumCols = this._firstNumericCols(this.cumulatedData || [], 5);

    const avg = (rows, col) => {
      const vals = this._numericCol(rows, col);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };

    const labels = [...new Set([...rawCols, ...cumCols])].slice(0, 6);
    return {
      labels,
      rawAvg: labels.map((c) => avg(this.rawData || [], c)),
      cumAvg: labels.map((c) => avg(this.cumulatedData || [], c)),
    };
  }

  /**
   * Returns fixation count per participant / per category from cumulated data.
   */
  getFixationCountPerCategory() {
    const rows = this.cumulatedData || [];
    const catCol = this._findCol(rows, [
      'participant', 'Participant', 'category', 'Category', 'aoi', 'AOI',
      'name', 'Name', 'label', 'Label',
    ]);
    const countCol = this._findCol(rows, [
      'fixation_count', 'FixationCount', 'count', 'Count', 'Fixations',
      'fixations', 'NumberOfFixations',
    ]);

    if (!catCol || !countCol) {
      const headers = this.getHeaders('cumulated');
      const strCol = headers.find((h) => isNaN(parseFloat(rows[0]?.[h])));
      const numCols = headers.filter((h) => !isNaN(parseFloat(rows[0]?.[h])));
      if (strCol && numCols.length) {
        return {
          labels: rows.map((r) => String(r[strCol])),
          counts: rows.map((r) => parseFloat(r[numCols[0]])).filter((v) => !isNaN(v)),
        };
      }
      return { labels: [], counts: [] };
    }

    return {
      labels: rows.map((r) => String(r[catCol])),
      counts: rows.map((r) => parseFloat(r[countCol])).filter((v) => !isNaN(v)),
    };
  }

  // ─── private ────────────────────────────────────────────────────────────────

  _findCol(rows, candidates) {
    if (!rows || rows.length === 0) return null;
    const keys = Object.keys(rows[0]);
    for (const c of candidates) {
      const found = keys.find((k) => k.toLowerCase() === c.toLowerCase());
      if (found) return found;
    }
    return null;
  }
}

module.exports = DataProcessor;