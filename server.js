'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const DataProcessor = require('./src/DataProcessor');
const ChartGenerator = require('./src/ChartGenerator');
const PDFGenerator = require('./src/PDFGenerator');

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

      const fixDist = processor.getFixationDurationDistribution();
      const gazePoints = processor.getGazeScatterData();
      const aoiDwell = processor.getAOIDwellTime();
      const timeSeries = processor.getTimeSeriesData();
      const comparison = processor.getComparisonData();
      const fixCount = processor.getFixationCountPerCategory();

      // ── 2. Render charts ───────────────────────────────────────────────────
      const chartGen = new ChartGenerator();

      const [
        fixDurBuf,
        scatterBuf,
        doughnutBuf,
        timeSeriesBuf,
        compBuf,
        fixCountBuf,
      ] = await Promise.all([
        chartGen.renderFixationDurationBar(fixDist),
        chartGen.renderGazeScatter(gazePoints.length ? gazePoints : [{ x: 0, y: 0 }]),
        chartGen.renderAOIDoughnut(
          aoiDwell.labels.length ? aoiDwell : { labels: ['No Data'], values: [1] },
        ),
        chartGen.renderTimeSeries(
          timeSeries.labels.length ? timeSeries : { labels: ['–'], values: [0] },
        ),
        chartGen.renderComparison(
          comparison.labels.length
            ? comparison
            : { labels: ['–'], rawAvg: [0], cumAvg: [0] },
        ),
        chartGen.renderFixationCountBar(
          fixCount.labels.length ? fixCount : { labels: ['No Data'], counts: [0] },
        ),
      ]);

      // ── 3. Build PDF ───────────────────────────────────────────────────────
      const ts = Date.now();
      const pdfName = `eyetracking_report_${ts}.pdf`;
      const pdfPath = path.join(OUTPUT_DIR, pdfName);

      const pdfGen = new PDFGenerator(pdfPath);

      // Summary stats
      const rawRows = processor.rawData?.length ?? 0;
      const cumRows = processor.cumulatedData?.length ?? 0;
      const rawHeaders = processor.getHeaders('raw');
      const cumHeaders = processor.getHeaders('cumulated');

      const stats = {
        'Raw File': rawFile.originalname,
        'Cumulated File': cumFile.originalname,
        'Raw Rows': rawRows,
        'Cumulated Rows': cumRows,
        'Raw Columns': rawHeaders.length,
        'Cumulated Columns': cumHeaders.length,
        'Raw Column Names': rawHeaders.slice(0, 6).join(', ') + (rawHeaders.length > 6 ? ' …' : ''),
        'Cumulated Column Names': cumHeaders.slice(0, 6).join(', ') + (cumHeaders.length > 6 ? ' …' : ''),
        'Gaze Points Plotted': Math.min(gazePoints.length, 500),
        'Generated At': new Date().toLocaleString('de-DE'),
      };

      pdfGen.addCoverPage(rawFile.originalname, cumFile.originalname);

      pdfGen.addChartPage(
        fixDurBuf,
        'Fixation Duration Distribution',
        'Distribution of fixation durations (ms) across all recorded gaze events in the raw data.',
        'raw',
      );

      pdfGen.addChartPage(
        scatterBuf,
        'Gaze Point Distribution',
        'Scatter plot of raw gaze coordinates (up to 500 points). Clusters indicate areas of high visual attention.',
        'raw',
      );

      pdfGen.addChartPage(
        doughnutBuf,
        'AOI Dwell Time Distribution',
        'Proportion of total dwell time spent on each Area of Interest (AOI) from the cumulated data.',
        'cumulated',
      );

      pdfGen.addChartPage(
        timeSeriesBuf,
        'Time Series – Raw Data',
        'Sampled time-series view of a key metric over the recording session.',
        'raw',
      );

      pdfGen.addChartPage(
        compBuf,
        'Raw vs. Cumulated Comparison',
        'Side-by-side comparison of average column values between raw and cumulated datasets.',
        'both',
      );

      pdfGen.addChartPage(
        fixCountBuf,
        'Fixation Count per Category',
        'Number of fixations recorded per category or participant from the cumulated data.',
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