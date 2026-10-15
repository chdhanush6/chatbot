require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { parseFile, formatBytes } = require('./utils/parser');
const { validateApiKey, generateDocumentResponse, streamDocumentResponse, DEFAULT_MODELS } = require('./services/gemini');
const { indexDocument, searchCourse, extractCoursePdf } = require('./services/courseExtractorBridge');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup upload folder
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // Up to 100MB
});

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// In-memory document storage (per-session or global active doc)
let currentDocument = null;

// Helper: Scan project workspace for local documents
function getLocalDocuments() {
  const allowedExtensions = ['.pdf', '.txt', '.docx', '.md', '.csv'];
  const excludedFiles = ['package.json', 'package-lock.json'];
  try {
    const files = fs.readdirSync(__dirname);
    return files
      .filter(f => allowedExtensions.includes(path.extname(f).toLowerCase()) && !excludedFiles.includes(f.toLowerCase()))
      .map(f => {
        const stats = fs.statSync(path.join(__dirname, f));
        return {
          filename: f,
          sizeFormatted: formatBytes(stats.size),
          sizeBytes: stats.size,
          isLocal: true
        };
      });
  } catch (e) {
    return [];
  }
}

// Auto-load default PDF if available in workspace and none loaded yet
(async function initDefaultDoc() {
  const defaultPdfName = 'R25 C25 CSE Course Structure & Syllabus.pdf';
  const defaultPdfPath = path.join(__dirname, defaultPdfName);
  if (fs.existsSync(defaultPdfPath)) {
    try {
      console.log(`Auto-indexing workspace document: ${defaultPdfName}...`);
      const parsed = await parseFile(defaultPdfPath, defaultPdfName);
      currentDocument = parsed;
      console.log(`Indexed successfully: ${parsed.pageCount} pages, ${parsed.wordCount} words.`);
    } catch (err) {
      console.warn(`Could not auto-index default file:`, err.message);
    }
  }
})();

// API Endpoints

/**
 * Get current system status & active document info
 */
app.get('/api/status', (req, res) => {
  const hasEnvKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  res.json({
    status: 'online',
    hasEnvKey,
    models: DEFAULT_MODELS,
    document: currentDocument ? {
      filename: currentDocument.filename,
      extension: currentDocument.extension,
      sizeFormatted: currentDocument.sizeFormatted,
      pageCount: currentDocument.pageCount,
      wordCount: currentDocument.wordCount,
      charCount: currentDocument.charCount,
      preview: currentDocument.preview
    } : null
  });
});

/**
 * List local project documents available to select immediately
 */
app.get('/api/local-files', (req, res) => {
  res.json({ files: getLocalDocuments() });
});

/**
 * Load a local document from the workspace directly
 */
app.post('/api/load-local', async (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required.' });
    }

    const safeFilename = path.basename(filename);
    const filePath = path.join(__dirname, safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `File "${safeFilename}" not found in project workspace.` });
    }

    const parsed = await parseFile(filePath, safeFilename);
    currentDocument = parsed;

    res.json({
      message: 'Document loaded successfully',
      document: {
        filename: parsed.filename,
        extension: parsed.extension,
        sizeFormatted: parsed.sizeFormatted,
        pageCount: parsed.pageCount,
        wordCount: parsed.wordCount,
        charCount: parsed.charCount,
        preview: parsed.preview
      }
    });
  } catch (err) {
    console.error('Error loading local document:', err);
    res.status(500).json({ error: err.message || 'Failed to parse document.' });
  }
});

/**
 * Upload a document (PDF, DOCX, TXT, MD, CSV, JSON)
 */
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const originalName = req.file.originalname;
    const tempPath = req.file.path;

    const parsed = await parseFile(tempPath, originalName, req.file.mimetype);
    currentDocument = parsed;

    res.json({
      message: 'File processed and indexed successfully!',
      document: {
        filename: parsed.filename,
        extension: parsed.extension,
        sizeFormatted: parsed.sizeFormatted,
        pageCount: parsed.pageCount,
        wordCount: parsed.wordCount,
        charCount: parsed.charCount,
        preview: parsed.preview
      }
    });
  } catch (err) {
    console.error('Upload parsing error:', err);
    res.status(500).json({ error: err.message || 'Error parsing uploaded file.' });
  }
});

/**
 * Clear the current document
 */
app.post('/api/clear-document', (req, res) => {
  currentDocument = null;
  res.json({ message: 'Active document removed successfully.' });
});

/**
 * Get courses detected dynamically in current active syllabus PDF
 */
app.get('/api/courses', async (req, res) => {
  try {
    if (!currentDocument || !currentDocument.filePath) {
      return res.json({
        available: false,
        totalCourses: 0,
        courses: [],
        message: 'No document currently loaded.'
      });
    }

    if (currentDocument.extension !== '.pdf') {
      return res.json({
        available: false,
        totalCourses: 0,
        courses: [],
        message: 'Active document is not a PDF.'
      });
    }

    const indexData = await indexDocument(currentDocument.filePath);
    res.json({
      available: true,
      filename: indexData.filename,
      totalPages: indexData.total_pages,
      isScanned: indexData.is_scanned,
      totalCourses: indexData.courses_count,
      courses: indexData.courses
    });
  } catch (err) {
    console.error('Error indexing courses:', err);
    res.status(500).json({ error: err.message || 'Failed to detect courses in syllabus.' });
  }
});

/**
 * Search course in active syllabus by code or title
 */
app.post('/api/courses/search', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Search query is required.' });
    }

    if (!currentDocument || !currentDocument.filePath || currentDocument.extension !== '.pdf') {
      return res.status(400).json({ error: 'No active PDF document loaded to search.' });
    }

    const searchResult = await searchCourse(currentDocument.filePath, query.trim());
    res.json(searchResult);
  } catch (err) {
    console.error('Course search error:', err);
    res.status(500).json({ error: err.message || 'Course search failed.' });
  }
});

/**
 * Download isolated standalone course syllabus PDF
 */
app.get(['/api/courses/:courseCode/download', '/api/courses/download'], async (req, res) => {
  try {
    const courseCode = req.params.courseCode || req.query.courseCode || req.query.q;
    if (!courseCode || !courseCode.trim()) {
      return res.status(400).json({ error: 'Course code or title is required.' });
    }

    if (!currentDocument || !currentDocument.filePath || currentDocument.extension !== '.pdf') {
      return res.status(400).json({ error: 'No active PDF syllabus loaded.' });
    }

    const result = await extractCoursePdf(currentDocument.filePath, courseCode.trim());

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    res.send(result.pdfBuffer);
  } catch (err) {
    console.error('Course PDF extraction error:', err.message);
    const statusCode = err.status === 'NOT_FOUND' ? 404 : (err.status === 'MULTIPLE_MATCHES' ? 409 : 400);
    res.status(statusCode).json({
      error: err.message,
      status: err.status || 'ERROR',
      suggestions: err.suggestions || []
    });
  }
});

/**
 * Validate an API key
 */
app.post('/api/validate-key', async (req, res) => {
  const { apiKey } = req.body;
  const keyToTest = apiKey || process.env.GEMINI_API_KEY;

  if (!keyToTest) {
    return res.status(400).json({ valid: false, error: 'No API Key provided to validate.' });
  }

  const result = await validateApiKey(keyToTest);
  res.json(result);
});

/**
 * Real-time SSE Streaming Chat Endpoint
 */
app.post('/api/chat/stream', async (req, res) => {
  const { prompt, apiKey, model, language = 'en', chatHistory = [] } = req.body;

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'Please enter a question.' });
  }

  const effectiveApiKey = (apiKey && apiKey.trim()) || process.env.GEMINI_API_KEY;
  if (!effectiveApiKey || !effectiveApiKey.trim()) {
    return res.status(400).json({
      error: 'API Key is missing. Please provide your API Key in the UI settings or in the .env file.'
    });
  }

  if (!currentDocument || !currentDocument.text || currentDocument.text.trim().length === 0) {
    return res.status(400).json({
      error: 'No document loaded. Please upload a file (PDF, TXT, DOCX) or select an existing document first.'
    });
  }

  // Set SSE response headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const abortController = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  try {
    const stream = streamDocumentResponse({
      apiKey: effectiveApiKey,
      model: model || 'gemini-3.1-flash-lite',
      documentInfo: {
        filename: currentDocument.filename,
        pageCount: currentDocument.pageCount,
        wordCount: currentDocument.wordCount
      },
      documentText: currentDocument.text,
      pagesData: currentDocument.pagesData,
      userQuery: prompt.trim(),
      chatHistory,
      languagePref: language,
      signal: abortController.signal
    });

    for await (const chunk of stream) {
      if (abortController.signal.aborted) break;
      res.write(`data: ${JSON.stringify({ text: chunk.text, model: chunk.model })}\n\n`);
    }

    if (!abortController.signal.aborted) {
      res.write(`data: ${JSON.stringify({ done: true, documentName: currentDocument.filename })}\n\n`);
      res.end();
    }
  } catch (err) {
    if (!abortController.signal.aborted) {
      console.error('Streaming error in /api/chat/stream:', err.message);
      res.write(`data: ${JSON.stringify({ error: err.message || 'Stream generation failed' })}\n\n`);
      res.end();
    }
  }
});

/**
 * Chat with the document strictly using Gemini (non-streaming fallback)
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { prompt, apiKey, model, language = 'en', chatHistory = [] } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Please enter a question.' });
    }

    // Determine API Key: from client request, or server .env
    const effectiveApiKey = (apiKey && apiKey.trim()) || process.env.GEMINI_API_KEY;
    if (!effectiveApiKey || !effectiveApiKey.trim()) {
      return res.status(400).json({
        error: 'API Key is missing. Please provide your API Key in the UI settings or in the .env file.'
      });
    }

    if (!currentDocument || !currentDocument.text || currentDocument.text.trim().length === 0) {
      return res.status(400).json({
        error: 'No document loaded. Please upload a file (PDF, TXT, DOCX) or select an existing document first.'
      });
    }

    const response = await generateDocumentResponse({
      apiKey: effectiveApiKey,
      model: model || 'gemini-3.1-flash-lite',
      documentInfo: {
        filename: currentDocument.filename,
        pageCount: currentDocument.pageCount,
        wordCount: currentDocument.wordCount
      },
      documentText: currentDocument.text,
      pagesData: currentDocument.pagesData,
      userQuery: prompt.trim(),
      chatHistory,
      languagePref: language
    });

    res.json({
      answer: response.answer,
      documentName: currentDocument.filename,
      usage: response.usage
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({
      error: err.message || 'An error occurred while generating response.'
    });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 DocuMind Document AI Chatbot is running!`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`===============================================`);
});
