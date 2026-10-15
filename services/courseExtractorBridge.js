/**
 * Course Extractor Service Bridge
 * Interfaces with the dynamic syllabus extraction engine and generates standalone course PDFs.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { PDFDocument } = require('pdf-lib');

const PYTHON_BIN = process.env.PYTHON_PATH || 'python';
const CLI_PATH = path.join(__dirname, '..', 'backend', 'cli.py');

// In-memory cache keyed by document hash
const documentCache = new Map();

function computeFileHash(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Execute Python CLI command safely
 */
function runCli(command, args = []) {
  return new Promise((resolve, reject) => {
    const pythonExe = fs.existsSync(PYTHON_BIN) ? PYTHON_BIN : 'python';
    const procArgs = [CLI_PATH, command, ...args];

    const proc = spawn(pythonExe, procArgs, {
      cwd: path.join(__dirname, '..')
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', data => {
      stdout += data.toString();
    });

    proc.stderr.on('data', data => {
      stderr += data.toString();
    });

    proc.on('close', code => {
      if (stdout.trim().length > 0) {
        try {
          const parsed = JSON.parse(stdout.trim());
          if (parsed.error && code !== 0) {
            return reject(new Error(parsed.error));
          }
          return resolve(parsed);
        } catch (e) {
          // If stdout is not json
        }
      }

      if (code !== 0 && code !== 2) {
        return reject(new Error(stderr || `CLI process exited with code ${code}`));
      }

      try {
        resolve(JSON.parse(stdout.trim()));
      } catch (e) {
        reject(new Error(stderr || stdout || 'Unknown CLI execution failure'));
      }
    });

    proc.on('error', err => {
      reject(err);
    });
  });
}

/**
 * Index a syllabus document dynamically
 */
async function indexDocument(pdfPath) {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`File not found: ${pdfPath}`);
  }

  const hash = computeFileHash(pdfPath);
  if (documentCache.has(hash)) {
    return documentCache.get(hash);
  }

  const result = await runCli('index', [pdfPath]);
  result.docHash = hash;
  result.pdfPath = pdfPath;
  documentCache.set(hash, result);
  return result;
}

/**
 * Search for a course by code or title
 */
async function searchCourse(pdfPath, query) {
  if (!query || !query.trim()) {
    return { status: 'NOT_FOUND', course: null, suggestions: [] };
  }
  return await runCli('search', [pdfPath, query.trim()]);
}

/**
 * Extract standalone course PDF
 */
async function extractCoursePdf(pdfPath, courseQuery, outputFolder = null) {
  const targetFolder = outputFolder || path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  const safeQuery = courseQuery.replace(/[^a-zA-Z0-9_-]/g, '_');
  const tempOutput = path.join(targetFolder, `${safeQuery}_${Date.now()}_Syllabus.pdf`);

  const result = await runCli('extract', [pdfPath, courseQuery, tempOutput]);

  if (!result.success || !fs.existsSync(tempOutput)) {
    const errorMsg = result.error || 'Course not found or extraction failed.';
    const err = new Error(errorMsg);
    err.status = result.status;
    err.suggestions = result.suggestions || [];
    throw err;
  }

  const pdfBuffer = fs.readFileSync(tempOutput);
  
  // Cleanup temporary file after reading
  try {
    fs.unlinkSync(tempOutput);
  } catch (e) {}

  return {
    course: result.course,
    pdfBuffer,
    filename: `${result.course.code}_Syllabus.pdf`
  };
}

module.exports = {
  computeFileHash,
  indexDocument,
  searchCourse,
  extractCoursePdf
};
