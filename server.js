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
app.use(express.json());

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

function computeFeatureAbsoluteOverTime(rawData, calculator) {
  if (!rawData.length) return {};
  const lastSecond = Math.ceil(Math.max(...rawData.map(r => r.End_ts || 0)) / 1000);
  const result = {};
  for (let s = 1; s <= lastSecond; s++) {
    result[s * 1000] = calculator.dwellTimePerAOI(rawData, s * 1000);
  }
  return result;
}

function computePupilDilationOverTime(rawData, calculator) {
  if (!rawData.length) return {};
  const lastSecond = Math.ceil(Math.max(...rawData.map(r => r.End_ts || 0)) / 1000);
  const result = {};
  for (let s = 1; s <= lastSecond; s++) {
    result[s * 1000] = calculator.pupilDilationPerProduct(rawData, s * 1000);
  }
  return result;
}

function computeProductComparisonsOverTime(rawData, calculator) {
  if (!rawData.length) return {};
  const lastSecond = Math.ceil(Math.max(...rawData.map(r => r.End_ts || 0)) / 1000);
  const result = {};
  for (let s = 1; s <= lastSecond; s++) {
    result[s * 1000] = {
      pairs: calculator.topProductComparisons(rawData, s * 1000, 10),
      total: calculator.productComparisons(rawData, s * 1000),
    };
  }
  return result;
}

function computeRevisitsOverTime(rawData, calculator) {
  if (!rawData.length) return {};
  const lastSecond = Math.ceil(Math.max(...rawData.map(r => r.End_ts || 0)) / 1000);
  const result = {};
  for (let s = 1; s <= lastSecond; s++) {
    result[s * 1000] = calculator.revisitsPerProduct(rawData, s * 1000);
  }
  return result;
}

// ─── Shared processing helpers ────────────────────────────────────────────────

async function buildChartData(rawFilePath) {
  const processor = new DataProcessor();
  processor.loadRaw(rawFilePath);
  const rawData = processor.rawData || [];
  const calculator = new CumulativeStatsCalculator();

  return {
    fixationsPerProduct:         calculator.fixationsPerProduct(rawData),
    dwellTimePerProduct:         calculator.dwellTimePerProduct(rawData),
    fixationsOverTime:           computeFixationsOverTime(rawData),
    dwellTimeOverTime:           computeDwellTimeOverTime(rawData),
    featureDistribution:         calculator.dwellTimePerAOI(rawData),
    featureDistributionOverTime: computeFeatureOverTime(rawData, calculator),
    pupilDilation:               calculator.pupilDilationPerProduct(rawData),
    productComparisons: {
      pairs: calculator.topProductComparisons(rawData, Infinity, 10),
      total: calculator.productComparisons(rawData),
    },
    uniqueProductsOverTime:      computeUniqueProductsOverTime(rawData, calculator),
    totalProductViewsOverTime:   computeTotalViewsOverTime(rawData, calculator),
    saccadeSpeedOverTime:        computeSaccadeSpeedOverTime(rawData, calculator),
    avgFixationDurationOverTime: computeAvgFixationOverTime(rawData, calculator),
    fixationVarianceOverTime:    computeFixationVarianceOverTime(rawData, calculator),
    visitVarianceOverTime:       computeVisitVarianceOverTime(rawData, calculator),
    maxRevisitPerProduct:        calculator.revisitsPerProduct(rawData),
    featureAbsoluteOverTime:     computeFeatureAbsoluteOverTime(rawData, calculator),
    pupilDilationOverTime:       computePupilDilationOverTime(rawData, calculator),
    productComparisonsOverTime:  computeProductComparisonsOverTime(rawData, calculator),
    revisitsOverTime:            computeRevisitsOverTime(rawData, calculator),
  };
}

async function buildPDF(rawFilePath, originalName) {
  const processor = new DataProcessor();
  processor.loadRaw(rawFilePath);
  processor.generateCumulatedData();

  const rawRows = processor.rawData?.length ?? 0;
  const cumRows = processor.cumulatedData?.length ?? 0;

  const fixPerProductBuf    = await new FixationsPerProductChart().render(processor.rawData || []);
  const dwellPerProductBuf  = await new DwellTimePerProductChart().render(processor.rawData || []);
  const fixOverTimeBuf      = await new FixationsOverTimeChart().render(processor.rawData || []);
  const dwellOverTimeBuf    = await new DwellTimeOverTimeChart().render(processor.rawData || []);
  const featureDistBuf      = await new FeatureDistributionPieChart().render(processor.rawData || []);
  const featureOverTimeBuf  = await new FeatureDistributionOverTimeChart().render(processor.rawData || []);
  const pupilTableData      = new PupilDilationTable().compute(processor.rawData || []);
  const comparisonTableData = new ProductComparisonTable().compute(processor.rawData || []);
  const uniqueProdsBuf      = await new UniqueProductsOverTimeChart().render(processor.rawData || []);
  const totalViewsBuf       = await new TotalProductViewsOverTimeChart().render(processor.rawData || []);
  const saccadeBuf          = await new SaccadeSpeedChart().render(processor.rawData || []);
  const avgFixDurBuf        = await new AverageFixationDurationChart().render(processor.rawData || []);
  const varianceBuf         = await new FixationVarianceChart().render(processor.rawData || []);
  const visitVarBuf         = await new VisitDurationVarianceChart().render(processor.rawData || []);
  const maxRevisitBuf       = await new MaxRevisitChart().render(processor.rawData || []);

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
    'Raw File':              originalName,
    'Cumulated Data':        'Auto-generated from raw data',
    'Total Fixations':       rawRows,
    'Cumulated Rows':        cumRows,
    'Products Observed':     Object.keys(fixCounts).length,
    'Most Fixated Product':  Object.entries(fixCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '–',
    'Fixations per Product': fixCountSummary,
    'Generated At':          new Date().toLocaleString('de-DE'),
  };

  const ts      = Date.now();
  const pdfName = `eyetracking_report_${ts}.pdf`;
  const pdfPath = path.join(OUTPUT_DIR, pdfName);
  const pdfGen  = new PDFGenerator(pdfPath);

  pdfGen.addCoverPage(originalName, 'Auto-generated');
  pdfGen.addChartPage(fixPerProductBuf,   'Intra-Product: Number of Fixations per Product',    'Tab A · Total fixation count per product across the entire session. Source: raw fixation data (Target_Product column).', 'raw');
  pdfGen.addChartPage(dwellPerProductBuf, 'Intra-Product: Dwell Time per Product',              'Tab A · Total dwell time (sum of fixation durations in ms) per product. Source: raw fixation data (Duration column).', 'raw');
  pdfGen.addChartPage(fixOverTimeBuf,     'Intra-Product: Fixations per Product over Time',     'Tab B · Fixation counts per product in 10-second time buckets. Each line represents one product.', 'raw');
  pdfGen.addChartPage(dwellOverTimeBuf,   'Intra-Product: Dwell Time per Product over Time',    'Tab B · Total dwell time (ms) per product in 10-second time buckets. Each line represents one product.', 'raw');
  pdfGen.addChartPage(featureDistBuf,     'Inter-Product: Percentage Looked at Product Features','One pie chart showing the share of fixations on each product feature: Price · Brand · Details.', 'raw');
  pdfGen.addChartPage(featureOverTimeBuf, 'Inter-Product: Feature Attention Distribution over Time', 'Cumulative dwell-time share (%) per product feature over the session. Each line represents one feature (Price · Brand · Details).', 'raw');
  pdfGen.addTablePage(pupilTableData);
  pdfGen.addTablePage(comparisonTableData);
  pdfGen.addChartPage(uniqueProdsBuf,  'Inter-Product: Cumulative Unique Products Viewed over Time', 'Cumulative count of distinct products seen from session start. Computed from raw fixation data.', 'raw');
  pdfGen.addChartPage(totalViewsBuf,   'Inter-Product: Cumulative Total Product Views over Time',    'Cumulative total product views (including revisits) from session start. Computed from raw fixation data.', 'raw');
  pdfGen.addChartPage(saccadeBuf,      'Inter-Product: Rolling Mean Saccade Speed over Time',        'Rolling mean saccade speed using a 10-second sliding window. Orange dots = last 10 seconds. Computed from raw fixation data.', 'raw');
  pdfGen.addChartPage(avgFixDurBuf,    'Inter-Product: Average Fixation Duration over Time',          'Cumulative mean and rolling 10-second window average fixation duration (ms). Computed from raw fixation data.', 'raw');
  pdfGen.addChartPage(varianceBuf,     'Inter-Product: Variance of Fixation Duration over Time',      'Cumulative variance and rolling 10-second window variance of fixation duration (ms²). Computed from raw fixation data.', 'raw');
  pdfGen.addChartPage(visitVarBuf,     'Inter-Product: Variance of Total Visit Duration per Product over Time', 'Cumulative variance and rolling 10-second window variance of total visit duration (ms²) per product. Computed from raw fixation data.', 'raw');
  pdfGen.addChartPage(maxRevisitBuf,   'Inter-Product: Max Revisit per Product',                     'Number of times each product was revisited (returned to after switching away). Gold bar = most revisited product.', 'raw');
  pdfGen.addSummaryPage(stats);

  await pdfGen.finalize();

  return { pdfName, pdfUrl: `/output/${pdfName}`, stats };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Process uploaded CSV → chart data JSON (file is kept in library)
app.post('/api/process', upload.single('raw'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Raw CSV file is required.' });
    const chartData = await buildChartData(req.file.path);
    res.json({ success: true, data: chartData, storedFilename: req.file.filename });
  } catch (err) {
    console.error('Processing error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Generate PDF from uploaded CSV (file is kept in library)
app.post('/api/generate', upload.single('raw'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Raw CSV file is required.' });
    const result = await buildPDF(req.file.path, req.file.originalname);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Generation error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// List all stored CSV files in the library
app.get('/api/files', (_req, res) => {
  try {
    const files = fs.readdirSync(UPLOADS_DIR)
      .filter(f => f.endsWith('.csv'))
      .map(f => {
        const stat = fs.statSync(path.join(UPLOADS_DIR, f));
        const match = f.match(/^(\d+)_(.+)$/);
        return {
          filename:   f,
          name:       match ? match[2] : f,
          size:       stat.size,
          uploadedAt: match ? parseInt(match[1]) : stat.mtimeMs,
        };
      })
      .sort((a, b) => b.uploadedAt - a.uploadedAt);
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Process a stored file → chart data JSON
app.post('/api/process-stored', async (req, res) => {
  try {
    const { filename } = req.body || {};
    if (!filename) return res.status(400).json({ error: 'filename is required.' });
    const safeName = path.basename(filename);
    const filePath = path.join(UPLOADS_DIR, safeName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found.' });
    const chartData = await buildChartData(filePath);
    res.json({ success: true, data: chartData });
  } catch (err) {
    console.error('Processing error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Generate PDF from a stored file
app.post('/api/generate-stored', async (req, res) => {
  try {
    const { filename } = req.body || {};
    if (!filename) return res.status(400).json({ error: 'filename is required.' });
    const safeName = path.basename(filename);
    const filePath = path.join(UPLOADS_DIR, safeName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found.' });
    const match = safeName.match(/^(\d+)_(.+)$/);
    const originalName = match ? match[2] : safeName;
    const result = await buildPDF(filePath, originalName);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Generation error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Delete a stored file from the library
app.delete('/api/files/:filename', (req, res) => {
  const safeName = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, safeName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found.' });
  fs.unlink(filePath, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

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
