'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const DataProcessor = require('./src/DataProcessor');
const CumulativeStatsCalculator = require('./src/CumulativeStatsCalculator');
const PDFGenerator = require('./src/PDFGenerator');
const FixationsPerProductChart = require('./src/FixationsPerProductChart');
const DwellTimePerProductChart = require('./src/DwellTimePerProductChart');
const FixationsOverTimeChart   = require('./src/FixationsOverTimeChart');
const DwellTimeOverTimeChart        = require('./src/DwellTimeOverTimeChart');
const FeatureDistributionPieChart        = require('./src/FeatureDistributionPieChart');
const FeatureDistributionOverTimeChart   = require('./src/FeatureDistributionOverTimeChart');
const PupilDilationTable            = require('./src/PupilDilationTable');
const ProductComparisonTable        = require('./src/ProductComparisonTable');
const UniqueProductsOverTimeChart   = require('./src/UniqueProductsOverTimeChart');
const TotalProductViewsOverTimeChart = require('./src/TotalProductViewsOverTimeChart');
const SaccadeSpeedChart             = require('./src/SaccadeSpeedChart');
const AverageFixationDurationChart  = require('./src/AverageFixationDurationChart');
const FixationVarianceChart         = require('./src/FixationVarianceChart');
const VisitDurationVarianceChart    = require('./src/VisitDurationVarianceChart');
const MaxRevisitChart               = require('./src/MaxRevisitChart');

const app = express();
const PORT = 3000;

// ─── Directories ─────────────────────────────────────────────────────────────

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const OUTPUT_DIR = path.join(__dirname, 'output');

[UPLOADS_DIR, OUTPUT_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─── Multer (file upload) ─────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${ts}_${safe}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// ─── Static files ─────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'public')));
app.use('/output', express.static(OUTPUT_DIR));

// ─── Helper functions for time-series computations ───────────────────────────

function computeFixationsOverTime(rawData) {
  if (!rawData.length) return {};
  
  const calculator = new CumulativeStatsCalculator();
  const lastSecond = Math.ceil(Math.max(...rawData.map(r => r.End_ts || 0)) / 1000);
  const products = [...new Set(rawData.map(r => r.Target_Product).filter(Boolean))].sort();
  
  const result = {};
  for (let s = 1; s <= lastSecond; s++) {
    const secondMs = s * 1000;
    result[secondMs] = {};
    const counts = calculator.fixationsPerProduct(rawData, secondMs);
    products.forEach(p => {
      result[secondMs][p] = counts[p] || 0;
    });
  }
  
  return result;
}

function computeDwellTimeOverTime(rawData) {
  if (!rawData.length) return {};
  
  const calculator = new CumulativeStatsCalculator();
  const lastSecond = Math.ceil(Math.max(...rawData.map(r => r.End_ts || 0)) / 1000);
  const products = [...new Set(rawData.map(r => r.Target_Product).filter(Boolean))].sort();
  
  const result = {};
  for (let s = 1; s <= lastSecond; s++) {
    const secondMs = s * 1000;
    result[secondMs] = {};
    const dwells = calculator.dwellTimePerProduct(rawData, secondMs);
    products.forEach(p => {
      result[secondMs][p] = dwells[p] || 0;
    });
  }
  
  return result;
}

function computeFeatureOverTime(rawData, calculator) {
  const buckets = {};
  const bucketSize = 1000; // 1 second
  
  if (!rawData.length) return buckets;
  
  const lastTs = Math.max(...rawData.map(r => r.End_ts || 0));
  
  for (let t = 0; t <= lastTs; t += bucketSize) {
    const aoi = calculator.dwellTimePerAOI(rawData, t);
    const total = Object.values(aoi).reduce((s, v) => s + v, 0);
    buckets[t] = {};
    Object.entries(aoi).forEach(([key, val]) => {
      buckets[t][key] = total > 0 ? (val / total) * 100 : 0;
    });
  }
  
  return buckets;
}

function computeUniqueProductsOverTime(rawData, calculator) {
  const result = {};
  const bucketSize = 1000;
  
  if (!rawData.length) return result;
  
  const lastTs = Math.max(...rawData.map(r => r.End_ts || 0));
  
  for (let t = 0; t <= lastTs; t += bucketSize) {
    result[t] = calculator.numberOfDifferentProducts(rawData, t);
  }
  
  return result;
}

function computeTotalViewsOverTime(rawData, calculator) {
  const result = {};
  const bucketSize = 1000;
  
  if (!rawData.length) return result;
  
  const lastTs = Math.max(...rawData.map(r => r.End_ts || 0));
  
  for (let t = 0; t <= lastTs; t += bucketSize) {
    result[t] = calculator.numberOfProducts(rawData, t);
  }
  
  return result;
}

function computeSaccadeSpeedOverTime(rawData, calculator) {
  const result = {};
  const bucketSize = 1000;
  const windowSize = 10000; // 10-second rolling window
  
  if (!rawData.length) return result;
  
  const lastTs = Math.max(...rawData.map(r => r.End_ts || 0));
  
  for (let t = windowSize; t <= lastTs; t += bucketSize) {
    const window = calculator.getFixationsInWindow(rawData, t - windowSize, t);
    result[t] = calculator.meanSaccadeSpeed(window);
  }
  
  return result;
}

function computeAvgFixationOverTime(rawData, calculator) {
  const result = { cumulative: {}, rolling: {} };
  const bucketSize = 1000;
  const windowSize = 10000;
  
  if (!rawData.length) return result;
  
  const lastTs = Math.max(...rawData.map(r => r.End_ts || 0));
  
  for (let t = 0; t <= lastTs; t += bucketSize) {
    result.cumulative[t] = calculator.averageFixationDuration(rawData, t);
    if (t >= windowSize) {
      result.rolling[t] = calculator.rollingAverageFixationDuration(rawData, t, windowSize);
    }
  }
  
  return result;
}

function computeFixationVarianceOverTime(rawData, calculator) {
  const result = { cumulative: {}, rolling: {} };
  const bucketSize = 1000;
  const windowSize = 10000;
  
  if (!rawData.length) return result;
  
  const lastTs = Math.max(...rawData.map(r => r.End_ts || 0));
  
  for (let t = 0; t <= lastTs; t += bucketSize) {
    result.cumulative[t] = calculator.varianceFixationDuration(rawData, t);
    if (t >= windowSize) {
      result.rolling[t] = calculator.rollingVarianceFixationDuration(rawData, t, windowSize);
    }
  }
  
  return result;
}

function computeVisitVarianceOverTime(rawData, calculator) {
  const result = { cumulative: {}, rolling: {} };
  const bucketSize = 1000;
  const windowSize = 10000;
  
  if (!rawData.length) return result;
  
  const lastTs = Math.max(...rawData.map(r => r.End_ts || 0));
  
  for (let t = 0; t <= lastTs; t += bucketSize) {
    result.cumulative[t] = calculator.varianceTotalVisitDuration(rawData, t);
    if (t >= windowSize) {
      result.rolling[t] = calculator.rollingVarianceTotalVisitDuration(rawData, t, windowSize);
    }
  }
  
  return result;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Process CSV and return chart data as JSON (for interactive chart viewer)
app.post(
  '/api/process',
  upload.single('raw'),
  async (req, res) => {
    try {
      const rawFile = req.file;

      if (!rawFile) {
        return res.status(400).json({ error: 'Raw CSV file is required.' });
      }

      // Parse CSV
      const processor = new DataProcessor();
      processor.loadRaw(rawFile.path);
      const rawData = processor.rawData || [];

      const calculator = new CumulativeStatsCalculator();

      // Compute all chart datasets
      const chartData = {
        // Chart 1: Fixations per Product
        fixationsPerProduct: calculator.fixationsPerProduct(rawData),
        
        // Chart 2: Dwell Time per Product
        dwellTimePerProduct: calculator.dwellTimePerProduct(rawData),
        
        // Chart 3 & 4: Time series data (need to compute per time bucket)
        fixationsOverTime: computeFixationsOverTime(rawData),
        dwellTimeOverTime: computeDwellTimeOverTime(rawData),
        
        // Chart 5: Feature Distribution (AOI)
        featureDistribution: calculator.dwellTimePerAOI(rawData),
        
        // Chart 6: Feature Distribution over Time
        featureDistributionOverTime: computeFeatureOverTime(rawData, calculator),
        
        // Chart 7: Pupil Dilation Table
        pupilDilation: calculator.pupilDilationPerProduct(rawData),
        
        // Chart 8: Product Comparison Table
        productComparisons: {
          pairs: calculator.topProductComparisons(rawData, Infinity, 10),
          total: calculator.productComparisons(rawData),
        },
        
        // Chart 9: Unique Products Over Time
        uniqueProductsOverTime: computeUniqueProductsOverTime(rawData, calculator),
        
        // Chart 10: Total Product Views Over Time
        totalProductViewsOverTime: computeTotalViewsOverTime(rawData, calculator),
        
        // Chart 11: Saccade Speed Over Time
        saccadeSpeedOverTime: computeSaccadeSpeedOverTime(rawData, calculator),
        
        // Chart 12: Average Fixation Duration Over Time
        avgFixationDurationOverTime: computeAvgFixationOverTime(rawData, calculator),
        
        // Chart 13: Fixation Variance Over Time
        fixationVarianceOverTime: computeFixationVarianceOverTime(rawData, calculator),
        
        // Chart 14: Visit Duration Variance Over Time
        visitVarianceOverTime: computeVisitVarianceOverTime(rawData, calculator),
        
        // Chart 15: Max Revisit per Product
        maxRevisitPerProduct: calculator.revisitsPerProduct(rawData),
      };

      // Clean up uploaded file
      fs.unlink(rawFile.path, () => {});

      res.json({ success: true, data: chartData });
    } catch (err) {
      console.error('Processing error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  }
);

// Upload raw CSV and generate PDF - cumulated data is automatically computed
app.post(
  '/api/generate',
  upload.single('raw'),
  async (req, res) => {
    try {
      const rawFile = req.file;

      if (!rawFile) {
        return res.status(400).json({ error: 'Raw CSV file is required.' });
      }

      // ── 1. Parse CSV and generate cumulated data ──────────────────────────
      const processor = new DataProcessor();
      processor.loadRaw(rawFile.path);
      processor.generateCumulatedData();

      const rawRows = processor.rawData?.length ?? 0;
      const cumRows = processor.cumulatedData?.length ?? 0;

      // ── 2. Render charts ───────────────────────────────────────────────────

      // Chart 1: Number of fixations per product
      const fixPerProductChart = new FixationsPerProductChart();
      const fixPerProductBuf   = await fixPerProductChart.render(processor.rawData || []);

      // Chart 2: Dwell time per product
      const dwellPerProductChart = new DwellTimePerProductChart();
      const dwellPerProductBuf   = await dwellPerProductChart.render(processor.rawData || []);

      // Chart 3: Number of fixations per product over time (line chart)
      const fixOverTimeChart = new FixationsOverTimeChart();
      const fixOverTimeBuf   = await fixOverTimeChart.render(processor.rawData || []);

      // Chart 4: Dwell time per product over time (line chart)
      const dwellOverTimeChart = new DwellTimeOverTimeChart();
      const dwellOverTimeBuf   = await dwellOverTimeChart.render(processor.rawData || []);

      // Chart 5: Inter-Product – one pie chart for all features (price, brand, details)
      const featureDistChart = new FeatureDistributionPieChart();
      const featureDistBuf   = await featureDistChart.render(processor.rawData || []);

      // Chart 5b: Inter-Product – feature attention share over time (line chart)
      const featureOverTimeChart = new FeatureDistributionOverTimeChart();
      const featureOverTimeBuf   = await featureOverTimeChart.render(processor.rawData || []);

      // Table 6: Inter-Product – pupil dilation per product
      const pupilTable     = new PupilDilationTable();
      const pupilTableData = pupilTable.compute(processor.rawData || []);

      // Table 7: Inter-Product – most compared product pairs (A→B→A)
      const comparisonTable     = new ProductComparisonTable();
      const comparisonTableData = comparisonTable.compute(processor.rawData || []);

      // Chart 8: Inter-Product – cumulative unique products over time
      const uniqueProdsChart = new UniqueProductsOverTimeChart();
      const uniqueProdsBuf   = await uniqueProdsChart.render(processor.rawData || []);

      // Chart 9: Inter-Product – cumulative total product views over time
      const totalViewsChart = new TotalProductViewsOverTimeChart();
      const totalViewsBuf   = await totalViewsChart.render(processor.rawData || []);

      // Chart 10: Inter-Product – mean saccade speed (trend last 10s)
      const saccadeChart = new SaccadeSpeedChart();
      const saccadeBuf   = await saccadeChart.render(processor.rawData || []);

      // Chart 11: Inter-Product – average fixation duration (trend last 10s)
      const avgFixDurChart = new AverageFixationDurationChart();
      const avgFixDurBuf   = await avgFixDurChart.render(processor.rawData || []);

      // Chart 10: Inter-Product – variance of avg fixation duration (trend last 10s)
      const varianceChart = new FixationVarianceChart();
      const varianceBuf   = await varianceChart.render(processor.rawData || []);

      // Chart 11: Inter-Product – variance of total visit duration (trend last 10s)
      const visitVarChart = new VisitDurationVarianceChart();
      const visitVarBuf   = await visitVarChart.render(processor.rawData || []);

      // Chart 12: Inter-Product – max revisit per product (horizontal bar, gold = max)
      const maxRevisitChart = new MaxRevisitChart();
      const maxRevisitBuf   = await maxRevisitChart.render(processor.rawData || []);


      // ── 3. Build PDF ───────────────────────────────────────────────────────
      const ts      = Date.now();
      const pdfName = `eyetracking_report_${ts}.pdf`;
      const pdfPath = path.join(OUTPUT_DIR, pdfName);

      const pdfGen = new PDFGenerator(pdfPath);

      // Count fixations per product for summary stats (consecutive runs only)
      const fixCounts = {};
      let prevProduct = null;
      (processor.rawData || []).forEach((r) => {
        const p = r['Target_Product'];
        if (!p) return;
        if (p !== prevProduct) {
          fixCounts[p] = (fixCounts[p] || 0) + 1;
          prevProduct = p;
        }
      });
      const fixCountSummary = Object.entries(fixCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([p, n]) => `${p}: ${n}`)
        .join(', ');

      const stats = {
        'Raw File':              rawFile.originalname,
        'Cumulated Data':        'Auto-generated from raw data',
        'Total Fixations':       rawRows,
        'Cumulated Rows':        cumRows,
        'Products Observed':     Object.keys(fixCounts).length,
        'Most Fixated Product':  Object.entries(fixCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '–',
        'Fixations per Product': fixCountSummary,
        'Generated At':          new Date().toLocaleString('de-DE'),
      };

      pdfGen.addCoverPage(rawFile.originalname, 'Auto-generated');

      // ── Intra-Product Specific ─────────────────────────────────────────────
      pdfGen.addChartPage(
        fixPerProductBuf,
        'Intra-Product: Number of Fixations per Product',
        'Tab A · Total fixation count per product across the entire session. Source: raw fixation data (Target_Product column).',
        'raw',
      );

      pdfGen.addChartPage(
        dwellPerProductBuf,
        'Intra-Product: Dwell Time per Product',
        'Tab A · Total dwell time (sum of fixation durations in ms) per product. Source: raw fixation data (Duration column).',
        'raw',
      );

      pdfGen.addChartPage(
        fixOverTimeBuf,
        'Intra-Product: Fixations per Product over Time',
        'Tab B · Fixation counts per product in 10-second time buckets. Each line represents one product.',
        'raw',
      );

      pdfGen.addChartPage(
        dwellOverTimeBuf,
        'Intra-Product: Dwell Time per Product over Time',
        'Tab B · Total dwell time (ms) per product in 10-second time buckets. Each line represents one product.',
        'raw',
      );

      // ── Inter-Product Specific ─────────────────────────────────────────────
      pdfGen.addChartPage(
        featureDistBuf,
        'Inter-Product: Percentage Looked at Product Features',
        'One pie chart showing the share of fixations on each product feature: Price · Brand · Details.',
        'raw',
      );

      pdfGen.addChartPage(
        featureOverTimeBuf,
        'Inter-Product: Feature Attention Distribution over Time',
        'Cumulative dwell-time share (%) per product feature over the session. Each line represents one feature (Price · Brand · Details).',
        'raw',
      );

      pdfGen.addTablePage(pupilTableData);

      pdfGen.addTablePage(comparisonTableData);

      pdfGen.addChartPage(
        uniqueProdsBuf,
        'Inter-Product: Cumulative Unique Products Viewed over Time',
        'Cumulative count of distinct products seen from session start. Computed from raw fixation data.',
        'raw',
      );

      pdfGen.addChartPage(
        totalViewsBuf,
        'Inter-Product: Cumulative Total Product Views over Time',
        'Cumulative total product views (including revisits) from session start. Computed from raw fixation data.',
        'raw',
      );

      pdfGen.addChartPage(
        saccadeBuf,
        'Inter-Product: Rolling Mean Saccade Speed over Time',
        'Rolling mean saccade speed using a 10-second sliding window. Orange dots = last 10 seconds. Computed from raw fixation data.',
        'raw',
      );

      pdfGen.addChartPage(
        avgFixDurBuf,
        'Inter-Product: Average Fixation Duration over Time',
        'Cumulative mean and rolling 10-second window average fixation duration (ms). Computed from raw fixation data.',
        'raw',
      );

      pdfGen.addChartPage(
        varianceBuf,
        'Inter-Product: Variance of Fixation Duration over Time',
        'Cumulative variance and rolling 10-second window variance of fixation duration (ms²). Computed from raw fixation data.',
        'raw',
      );

      pdfGen.addChartPage(
        visitVarBuf,
        'Inter-Product: Variance of Total Visit Duration per Product over Time',
        'Cumulative variance and rolling 10-second window variance of total visit duration (ms²) per product. Computed from raw fixation data.',
        'raw',
      );

      pdfGen.addChartPage(
        maxRevisitBuf,
        'Inter-Product: Max Revisit per Product',
        'Number of times each product was revisited (returned to after switching away). Gold bar = most revisited product.',
        'raw',
      );

      pdfGen.addSummaryPage(stats);

      const finalPath = await pdfGen.finalize();

      // ── 4. Clean up uploads ────────────────────────────────────────────────
      fs.unlink(rawFile.path, () => {});

      res.json({
        success: true,
        pdfUrl: `/output/${pdfName}`,
        pdfName,
        stats,
      });
    } catch (err) {
      console.error('Generation error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  },
);

// ─── Error handler ────────────────────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════════════════╗`);
  console.log(`  ║  EyeTracking Dashboard for Shopping Advisors     ║`);
  console.log(`  ║  http://localhost:${PORT}                           ║`);
  console.log(`  ╚══════════════════════════════════════════════════╝\n`);
});