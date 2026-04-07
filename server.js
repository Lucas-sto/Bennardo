'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const DataProcessor = require('./src/DataProcessor');
const PDFGenerator = require('./src/PDFGenerator');
const FixationsPerProductChart = require('./src/FixationsPerProductChart');
const DwellTimePerProductChart = require('./src/DwellTimePerProductChart');
const FixationsOverTimeChart   = require('./src/FixationsOverTimeChart');
const DwellTimeOverTimeChart        = require('./src/DwellTimeOverTimeChart');
const FeatureDistributionPieChart   = require('./src/FeatureDistributionPieChart');
const PupilDilationTable            = require('./src/PupilDilationTable');
const ProductComparisonTable        = require('./src/ProductComparisonTable');
const UniqueProductsOverTimeChart   = require('./src/UniqueProductsOverTimeChart');
const SaccadeSpeedChart             = require('./src/SaccadeSpeedChart');
const FixationVarianceChart         = require('./src/FixationVarianceChart');
const VisitDurationVarianceChart    = require('./src/VisitDurationVarianceChart');
const MaxRevisitChart               = require('./src/MaxRevisitChart');
const ShoppingCartChart             = require('./src/ShoppingCartChart');

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

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Upload both CSVs and generate PDF
app.post(
  '/api/generate',
  upload.fields([
    { name: 'raw', maxCount: 1 },
    { name: 'cumulated', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const rawFile = req.files?.raw?.[0];
      const cumFile = req.files?.cumulated?.[0];

      if (!rawFile || !cumFile) {
        return res.status(400).json({ error: 'Both raw and cumulated CSV files are required.' });
      }

      // ── 1. Parse CSVs ──────────────────────────────────────────────────────
      const processor = new DataProcessor();
      processor.loadRaw(rawFile.path).loadCumulated(cumFile.path);

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

      // Table 6: Inter-Product – pupil dilation per product
      const pupilTable     = new PupilDilationTable();
      const pupilTableData = pupilTable.compute(processor.rawData || []);

      // Table 7: Inter-Product – most compared product pairs (A→B→A)
      const comparisonTable     = new ProductComparisonTable();
      const comparisonTableData = comparisonTable.compute(processor.rawData || []);

      // Chart 8: Inter-Product – unique products + total views over time (line)
      const uniqueProdsChart = new UniqueProductsOverTimeChart();
      const uniqueProdsBuf   = await uniqueProdsChart.render(processor.cumulatedData || []);

      // Chart 9: Inter-Product – mean saccade speed + avg fixation duration (trend last 10s)
      const saccadeChart = new SaccadeSpeedChart();
      const saccadeBuf   = await saccadeChart.render(processor.cumulatedData || []);

      // Chart 10: Inter-Product – variance of avg fixation duration (trend last 10s)
      const varianceChart = new FixationVarianceChart();
      const varianceBuf   = await varianceChart.render(processor.cumulatedData || []);

      // Chart 11: Inter-Product – variance of total visit duration (trend last 10s)
      const visitVarChart = new VisitDurationVarianceChart();
      const visitVarBuf   = await visitVarChart.render(processor.cumulatedData || []);

      // Chart 12: Inter-Product – max revisit per product (horizontal bar, gold = max)
      const maxRevisitChart = new MaxRevisitChart();
      const maxRevisitBuf   = await maxRevisitChart.render(processor.rawData || []);

      // Chart 13: Inter-Product – shopping cart additions over time
      const shoppingCartChart = new ShoppingCartChart();
      const shoppingCartBuf   = await shoppingCartChart.render(processor.cumulatedData || []);

      // ── 3. Build PDF ───────────────────────────────────────────────────────
      const ts      = Date.now();
      const pdfName = `eyetracking_report_${ts}.pdf`;
      const pdfPath = path.join(OUTPUT_DIR, pdfName);

      const pdfGen = new PDFGenerator(pdfPath);

      // Count fixations per product for summary stats
      const fixCounts = {};
      (processor.rawData || []).forEach((r) => {
        const p = r['Target_Product'];
        if (p) fixCounts[p] = (fixCounts[p] || 0) + 1;
      });
      const fixCountSummary = Object.entries(fixCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([p, n]) => `${p}: ${n}`)
        .join(', ');

      const stats = {
        'Raw File':              rawFile.originalname,
        'Cumulated File':        cumFile.originalname,
        'Total Fixations':       rawRows,
        'Cumulated Rows':        cumRows,
        'Products Observed':     Object.keys(fixCounts).length,
        'Most Fixated Product':  Object.entries(fixCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '–',
        'Fixations per Product': fixCountSummary,
        'Generated At':          new Date().toLocaleString('de-DE'),
      };

      pdfGen.addCoverPage(rawFile.originalname, cumFile.originalname);

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

      pdfGen.addTablePage(pupilTableData);

      pdfGen.addTablePage(comparisonTableData);

      pdfGen.addChartPage(
        uniqueProdsBuf,
        'Inter-Product: Unique Products Viewed over Time',
        'Cumulative unique products and total product views per second. Source: cumulative data.',
        'cumulated',
      );

      pdfGen.addChartPage(
        saccadeBuf,
        'Inter-Product: Mean Saccade Speed & Fixation Duration',
        'Mean saccade speed (left axis) and average fixation duration (right axis) over time. Orange dots = last 10 seconds. Trend shown in subtitle.',
        'cumulated',
      );

      pdfGen.addChartPage(
        varianceBuf,
        'Inter-Product: Variance of Average Fixation Duration',
        'Variance of average fixation duration (ms²) over time. Orange dots = last 10 seconds. Current value and trend shown in subtitle.',
        'cumulated',
      );

      pdfGen.addChartPage(
        visitVarBuf,
        'Inter-Product: Variance across Total Visit Duration per Product',
        'Variance of total visit duration (ms²) per visited product over time. Orange dots = last 10 seconds. Current value and trend shown in subtitle.',
        'cumulated',
      );

      pdfGen.addChartPage(
        maxRevisitBuf,
        'Inter-Product: Max Revisit per Product',
        'Number of times each product was revisited (returned to after switching away). Gold bar = most revisited product.',
        'raw',
      );

      pdfGen.addChartPage(
        shoppingCartBuf,
        'Inter-Product: Times Item Saved to Shopping Cart',
        'Cumulative add-to-cart events over time. Total shown in title. Orange dots = last 10 seconds.',
        'cumulated',
      );

      pdfGen.addSummaryPage(stats);

      const finalPath = await pdfGen.finalize();

      // ── 4. Clean up uploads ────────────────────────────────────────────────
      fs.unlink(rawFile.path, () => {});
      fs.unlink(cumFile.path, () => {});

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