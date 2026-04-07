'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const PAGE_MARGIN = 50;
const PAGE_WIDTH = 842;   // A4 landscape
const PAGE_HEIGHT = 595;

const BRAND_DARK = '#1a1a2e';
const BRAND_MID = '#16213e';
const BRAND_ACCENT = '#4F81BD';
const BRAND_LIGHT = '#e8f0fe';
const TEXT_GREY = '#555555';

/**
 * PDFGenerator
 * Builds a multi-page A4-landscape PDF report.
 * Call addCoverPage(), then addChartPage() for each chart,
 * then addSummaryPage(), then finalize().
 */
class PDFGenerator {
  /**
   * @param {string} outputPath  Absolute path for the output PDF file.
   */
  constructor(outputPath) {
    this.outputPath = outputPath;
    this.doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
      info: {
        Title: 'EyeTracking Dashboard – Shopping Advisors',
        Author: 'EyeTracking Dashboard',
        Subject: 'Eye-Tracking Analysis Report',
      },
    });

    this._stream = fs.createWriteStream(outputPath);
    this.doc.pipe(this._stream);
    this._pageCount = 0;
  }

  // ─── Cover Page ──────────────────────────────────────────────────────────────

  addCoverPage(rawFileName = '', cumulatedFileName = '', generatedAt = new Date()) {
    this._pageCount++;

    const doc = this.doc;
    const W = PAGE_WIDTH;
    const H = PAGE_HEIGHT;

    // Background gradient simulation via rectangles
    doc.rect(0, 0, W, H).fill(BRAND_DARK);
    doc.rect(0, H * 0.6, W, H * 0.4).fill(BRAND_MID);

    // Decorative accent bar
    doc.rect(0, H * 0.72, W, 4).fill(BRAND_ACCENT);

    // Eye icon placeholder (circle + inner circle)
    const cx = W / 2;
    const cy = H * 0.28;
    doc.circle(cx, cy, 60).lineWidth(3).strokeColor(BRAND_ACCENT).stroke();
    doc.circle(cx, cy, 22).fill(BRAND_ACCENT);
    doc.circle(cx - 8, cy - 8, 7).fill('#ffffff');

    // Title
    doc
      .font('Helvetica-Bold')
      .fontSize(28)
      .fillColor('#ffffff')
      .text('EyeTracking Dashboard', 0, H * 0.46, { align: 'center', width: W });

    doc
      .font('Helvetica')
      .fontSize(16)
      .fillColor(BRAND_ACCENT)
      .text('for Shopping Advisors', 0, H * 0.46 + 38, { align: 'center', width: W });

    // Divider
    doc
      .moveTo(W * 0.3, H * 0.62)
      .lineTo(W * 0.7, H * 0.62)
      .lineWidth(1)
      .strokeColor(BRAND_ACCENT)
      .stroke();

    // Meta info
    const metaY = H * 0.65;
    doc.font('Helvetica').fontSize(11).fillColor('#aaaacc');

    if (rawFileName) {
      doc.text(`Raw Data:        ${rawFileName}`, PAGE_MARGIN + 20, metaY, { width: W - PAGE_MARGIN * 2 - 40 });
    }
    if (cumulatedFileName) {
      doc.text(`Cumulated Data:  ${cumulatedFileName}`, PAGE_MARGIN + 20, metaY + 18, { width: W - PAGE_MARGIN * 2 - 40 });
    }

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#888899')
      .text(
        `Generated: ${generatedAt.toLocaleString('de-DE')}`,
        0,
        H - PAGE_MARGIN - 14,
        { align: 'center', width: W },
      );

    return this;
  }

  // ─── Chart Page ──────────────────────────────────────────────────────────────

  /**
   * @param {Buffer}  imageBuffer  PNG buffer from ChartGenerator
   * @param {string}  title        Chart title shown in header
   * @param {string}  description  Short description shown below header
   * @param {string}  source       'raw' | 'cumulated' | 'both'
   */
  addChartPage(imageBuffer, title, description = '', source = 'raw') {
    this.doc.addPage();
    this._pageCount++;

    const doc = this.doc;
    const W = PAGE_WIDTH;
    const H = PAGE_HEIGHT;

    // Header bar
    doc.rect(0, 0, W, 52).fill(BRAND_DARK);

    // Source badge
    const badgeColor = source === 'raw' ? '#4BACC6' : source === 'cumulated' ? '#9BBB59' : BRAND_ACCENT;
    const badgeLabel = source === 'raw' ? 'RAW' : source === 'cumulated' ? 'CUMULATED' : 'RAW + CUM';
    doc.roundedRect(W - PAGE_MARGIN - 90, 12, 80, 26, 5).fill(badgeColor);
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#ffffff')
      .text(badgeLabel, W - PAGE_MARGIN - 90, 20, { width: 80, align: 'center' });

    // Page title
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor('#ffffff')
      .text(title, PAGE_MARGIN, 16, { width: W - PAGE_MARGIN * 2 - 100 });

    // Description
    if (description) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(TEXT_GREY)
        .text(description, PAGE_MARGIN, 60, { width: W - PAGE_MARGIN * 2 });
    }

    // Chart image – centred, fills available space
    const imgY = description ? 82 : 62;
    const imgH = H - imgY - PAGE_MARGIN - 20;
    const imgW = W - PAGE_MARGIN * 2;

    doc.image(imageBuffer, PAGE_MARGIN, imgY, {
      fit: [imgW, imgH],
      align: 'center',
      valign: 'center',
    });

    // Footer
    this._drawFooter(doc, W, H);

    return this;
  }

  // ─── Summary / Stats Page ────────────────────────────────────────────────────

  addSummaryPage(stats = {}) {
    this.doc.addPage();
    this._pageCount++;

    const doc = this.doc;
    const W = PAGE_WIDTH;
    const H = PAGE_HEIGHT;

    // Header
    doc.rect(0, 0, W, 52).fill(BRAND_DARK);
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor('#ffffff')
      .text('Analysis Summary', PAGE_MARGIN, 16);

    // Background card
    doc.rect(PAGE_MARGIN, 62, W - PAGE_MARGIN * 2, H - 62 - PAGE_MARGIN - 20)
      .fill(BRAND_LIGHT);

    // Stats grid
    const entries = Object.entries(stats);
    const colW = (W - PAGE_MARGIN * 2 - 40) / 2;
    const startY = 80;
    const rowH = 36;

    entries.forEach(([key, value], idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = PAGE_MARGIN + 20 + col * (colW + 20);
      const y = startY + row * rowH;

      doc.rect(x, y, colW, rowH - 4).fill('#ffffff');
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(BRAND_ACCENT)
        .text(key, x + 8, y + 5, { width: colW - 16 });
      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor(BRAND_DARK)
        .text(String(value), x + 8, y + 18, { width: colW - 16 });
    });

    if (entries.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(13)
        .fillColor(TEXT_GREY)
        .text('No summary statistics available.', PAGE_MARGIN + 20, 90);
    }

    this._drawFooter(doc, W, H);
    return this;
  }

  // ─── Finalize ────────────────────────────────────────────────────────────────

  /**
   * Finalizes the PDF and returns a Promise that resolves with the output path.
   */
  finalize() {
    return new Promise((resolve, reject) => {
      this._stream.on('finish', () => resolve(this.outputPath));
      this._stream.on('error', reject);
      this.doc.end();
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  _drawFooter(doc, W, H) {
    doc
      .rect(0, H - 22, W, 22)
      .fill(BRAND_MID);

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#888899')
      .text(
        'EyeTracking Dashboard for Shopping Advisors  •  Confidential',
        PAGE_MARGIN,
        H - 15,
        { width: W / 2 },
      );

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#888899')
      .text(
        `Page ${this._pageCount}`,
        W / 2,
        H - 15,
        { width: W / 2 - PAGE_MARGIN, align: 'right' },
      );
  }
}

module.exports = PDFGenerator;