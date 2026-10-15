const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');

async function parseFile(filePath, originalFilename, mimeType) {
  const ext = path.extname(originalFilename || filePath).toLowerCase();
  const buffer = fs.readFileSync(filePath);
  const sizeBytes = buffer.length;

  let text = '';
  let pageCount = 1;
  let pagesData = [];

  if (ext === '.pdf') {
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      text = parsed.text || '';
      pageCount = parsed.total || (parsed.pages ? parsed.pages.length : 1);
      if (parsed.pages && Array.isArray(parsed.pages)) {
        pagesData = parsed.pages.map((p, idx) => ({
          pageNumber: idx + 1,
          text: p.text || ''
        }));
      }
    } finally {
      await parser.destroy();
    }
  } else if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value || '';
  } else if (['.txt', '.md', '.csv', '.json', '.log', '.yaml', '.yml'].includes(ext)) {
    text = buffer.toString('utf-8');
  } else {
    // Try utf8 fallback
    text = buffer.toString('utf-8');
  }

  // Calculate statistics
  const wordCount = (text.match(/\S+/g) || []).length;
  const charCount = text.length;

  return {
    filePath,
    filename: path.basename(originalFilename || filePath),
    extension: ext,
    sizeBytes,
    sizeFormatted: formatBytes(sizeBytes),
    pageCount,
    wordCount,
    charCount,
    text,
    pagesData: pagesData.length > 0 ? pagesData : null,
    preview: text.slice(0, 1000)
  };
}

function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

module.exports = { parseFile, formatBytes };
