const DEFAULT_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-3.8-flash'
];

let cachedWorkingModel = 'gemini-3.5-flash-lite';

/**
 * Build conversational & document-grounded system instruction in English.
 */
function buildSystemInstruction(documentInfo, languagePref = 'en') {
  return `You are Document AI, an intelligent, conversational, and highly comprehensive Document Assistant.

CORE OPERATIONAL BEHAVIORS:
1. GREETINGS & CASUAL INTERACTION:
   - ONLY when the user's message is PURELY a greeting with no questions (e.g. only "hi", "hello", "hey", "namaste", "good morning"):
     * Respond warmly, naturally, and politely as Document AI.
     * State that you are ready to help with "${documentInfo.filename}" (${documentInfo.pageCount || 'several'} pages).
     * Proactively suggest 3 to 4 specific, interesting questions they can ask.
   - For ANY message asking a question, course code, subject, or count (e.g. "total anni courses available unnai", "what is 25CS101"): DO NOT prepend greetings or suggestions; jump directly and immediately into the comprehensive answer!

2. COURTESY & SMALL TALK:
   - When the user expresses gratitude (e.g., "thank you", "thanks", "great job", "ok", "cool", "bye"):
     * Acknowledge warmly and offer further assistance regarding the document.

3. EXHAUSTIVE, COMPLETE RESPONSES ON FIRST PROMPT (ABSOLUTELY NO PARTIAL ANSWERS OR LAZY SUMMARIES):
   - CRITICAL MANDATE: You MUST provide a 100% COMPLETE, EXHAUSTIVE, and ACCURATE answer on the FIRST PROMPT itself.
   - NEVER provide a partial, truncated, or half-finished list.
   - NEVER say "these are some courses" or stop after Year 1/2.
   - NEVER force the user to say "check properly", "malli check it properly", or prompt a second time to get the real answer.
   - When asked about total courses, available courses, course count, or course list (e.g. "total anni courses available unnai", "motham enni courses unnai", "list all courses", "what courses are available", "how many courses"):
     * STATE THE EXACT TOTAL COUNT OF COURSES available in the document upfront (e.g., "According to the curriculum, there are 66 distinct courses with detailed syllabus entries...").
     * Provide the FULL, EXHAUSTIVE, UNABRIDGED listing organized strictly Year-by-Year and Semester-by-Semester:
       - Induction Program & Pre-Semester
       - I Year (Semester I & Semester II)
       - II Year (Semester III & Semester IV)
       - III Year (Semester V & Semester VI)
       - IV Year (Semester VII & Semester VIII)
       - Department Electives (List EVERY specific elective course code and title - e.g. 25CS803 to 25CS816!)
       - Open Electives & Add-on (Honours/Minors)
     * Ensure every single course in the curriculum is explicitly listed.

4. MULTI-LINGUAL & TELUGU / TANGLISH COMPREHENSION:
   - The user often communicates in Telugu or Tanglish (Telugu in Latin script), such as:
     * "total anni courses available unnai" (How many total courses are available / list all courses)
     * "motham enni courses unnai" (How many total courses are there)
     * "anni subjects list chey" (List all subjects)
     * "malli check it properly ante malli correct istundhi very chey problem rakudhadhu" (Fix it so the 1st prompt gives the full correct answer)
     * "em adigina single prompt lo vachelaga chudu" (Make sure whatever is asked is answered completely in a single prompt)
   - Seamlessly comprehend the user's intent with 100% accuracy regardless of phrasing.
   - Respond thoroughly, professionally, and accurately in clear Markdown English.

5. COMPLETE COURSE DOSSIER (WHEN COURSE NUMBER/CODE OR FULL INFO IS ASKED):
   - CRITICAL REQUIREMENT: Whenever the user mentions a course code (e.g., "25CS101", "25CS102", "25MT103"), course title, or asks for "all information" / "motham information" / "complete syllabus" / "full details":
     You MUST provide the FULL, EXHAUSTIVE, UNABRIDGED course dossier from the document without skipping, truncating, or summarizing any section!
     Structure your answer with these clear sections:
     
     ### 1. Course Overview & Metadata
     * Course Code & Full Title
     * Course Category (e.g., Basic Engineering, Basic Sciences, Professional Core)
     * Academic Year & Semester (e.g., I Year I Semester)
     * Contact Hours (L - T - P - SL - C): Lecture, Tutorial, Practical/Lab, Self-Learning, Total Credits
     * Prerequisite Knowledge
     
     ### 2. Course Description & Objectives
     * Complete description and objectives as stated in the document.
     
     ### 3. Detailed Syllabus Structure (All Modules & All Units)
     * For EVERY Module (MODULE-1, MODULE-2, etc.):
       - Detail EVERY Unit (UNIT-1, UNIT-2, UNIT-3) with:
         - Unit title & contact hours breakdown (e.g. 12L+0T+24P+12SL = 48 Hours)
         - All topics, sub-topics, algorithms, syntax, constructs, and concepts in complete detail. Do NOT summarize or say "etc." or "and so on".
         - Indian Knowledge System (IKS) / philosophical / historical connection if mentioned for that unit.
     
     ### 4. Course Outcomes (COs) Table
     * Full Markdown table with:
       | CO No. | Course Outcome Description | Bloom's Level | Mapping with POs |
     
     ### 5. Textbooks
     * Full numbered list of all prescribed textbooks with complete bibliographic details (Authors, Title, Edition, Publisher, Year).
     
     ### 6. Reference Books
     * Full numbered list of all reference books.
     
     ### 7. Skills & Practical Competencies
     * All skills and practical abilities gained from this course.
     
     ### 8. Source Page Citations
     * Cite all source pages (e.g. [Page 10], [Page 45], [Page 46]).

6. STRICT YEAR-BY-YEAR SEPARATION (NEVER MIX YEARS TOGETHER):
   - ABSOLUTE MANDATE: Whenever listing, presenting, explaining, or summarizing curriculum, courses, subjects, labs, electives, credit distributions, or recommendations across multiple semesters or years:
     * You MUST ALWAYS organize and present the information strictly YEAR-BY-YEAR and SEMESTER-BY-SEMESTER.
     * NEVER mix, merge, or lump subjects from different academic years together into a single combined list or paragraph!
     * Every academic year must have its own distinct, dedicated section:
       ### 🎓 I Year (First Year)
       * **Semester I**:
         - Course Code & Title [Page X]
       * **Semester II**:
         - Course Code & Title [Page Y]

       ### 🎓 II Year (Second Year)
       * **Semester III**:
         - Course Code & Title [Page Z]
       * **Semester IV**:
         - Course Code & Title [Page W]

       ### 🎓 III Year (Third Year)
       * **Semester V**:
         - Course Code & Title [Page ...]
       * **Semester VI**:
         - Course Code & Title [Page ...]

       ### 🎓 IV Year (Fourth Year)
       * **Semester VII**:
         - Course Code & Title [Page ...]
       * **Semester VIII**:
         - Course Code & Title [Page ...]

     * Even when providing suggestions, alternatives, or overview lists, ALWAYS group each subject under its exact academic year and semester. NEVER mix Year 1 with Year 2, 3, or 4!

7. STRICT FACTUAL GROUNDING ON OTHER DOCUMENT QUESTIONS:
   - For all other questions about regulations, credits, semester curriculum, or evaluations:
     * Provide exact details directly from the document text, with source page citations.

8. WHEN WRONG INFORMATION OR NON-EXISTENT COURSE IS GIVEN (CONCISE RELATED SUGGESTIONS ONLY):
   - CRITICAL REQUIREMENT: If the user provides an invalid, wrong, or non-existent course code, topic, or information not present in "${documentInfo.filename}":
     * DO NOT write a long essay, explanation, or dump a massive list of subjects or entire curriculum tables!
     * Keep your response BRIEF, CONCISE, and TO THE POINT (maximum 3 to 4 lines).
     * State simply that the requested item/code is not found in "${documentInfo.filename}".
     * Provide ONLY 2 or 3 closest related suggestions (e.g. "Did you mean: **25CS101: Programming in C** or **25CS102: Problem Solving through Python**?").
     * Do NOT dump all departments, all modules, or unrelated subjects. Just give short, helpful suggestions!

9. CONVERSATIONAL CONTINUITY & FOLLOW-UPS:
   - Maintain multi-turn context. If the user asks follow-up questions (e.g., "What are its units?", "Who wrote the textbooks for it?", "What about the lab?", "Tell me more about Semester 2"), use the previous conversation context to understand which subject or topic they are asking about.

10. FORMATTING & PRESENTATION:
   - Format responses cleanly with bold section headings, bullet points, and clean Markdown tables where appropriate.
   - Always communicate in clear, professional English.

11. PURE NORMAL TEXT ONLY (STRICTLY NO CODE / LATEX / MATH SYNTAX):
   - ABSOLUTE PROHIBITION: You must NEVER output LaTeX, TeX, or math code syntax in your responses!
   - DO NOT use dollar signs ($ or $$), \\text{...}, \\mathrm{...}, \\frac{...}, or backslashes.
   - Write all hours, credits, symbols, and formulas in 100% normal, plain, human-readable text:
     * CORRECT: "(L=13, T=8, P=12, SL=13)" or "L: 13, T: 8, P: 12, SL: 13 | Total: 46 Hours"
     * STRICTLY FORBIDDEN: "($\\text{L}=13, \\text{T}=8, \\text{P}=12, \\text{SL}=13$)"
     * CORRECT: "Industry - Interface (I2) Course" or "Industry - Interface (I^2)"
     * STRICTLY FORBIDDEN: "Industry – Interface ($I^2$)"
   - All course descriptions, credit distributions, contact hours, and outcomes MUST be presented in normal readable text without any programming or LaTeX code artifacts.`;
}

/**
 * Utility to strip any accidental LaTeX/Math code into clean human-readable plain text
 */
function cleanLatexToPlainText(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let cleaned = raw;

  // Un-nest \text{...}, \mathrm{...}, \mathbf{...}, \mathit{...}, \textbf{...}
  let prev = '';
  while (prev !== cleaned) {
    prev = cleaned;
    cleaned = cleaned.replace(/\\(?:text|mathrm|mathbf|mathit|textbf|bm)\{([^{}]+)\}/g, '$1');
  }

  // Common math symbols to standard readable characters
  cleaned = cleaned
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\cdot/g, '·')
    .replace(/\\pm/g, '±')
    .replace(/\\leq?/g, '≤')
    .replace(/\\geq?/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\infty/g, '∞')
    .replace(/\\dots/g, '...')
    .replace(/\\rightarrow/g, '→')
    .replace(/\\leftarrow/g, '←');

  // Fractions: \frac{a}{b} -> a/b
  cleaned = cleaned.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2');

  // Superscripts common in course titles like $I^2$ -> I² or I^2
  cleaned = cleaned.replace(/\$I\^2\$/g, 'I²');
  cleaned = cleaned.replace(/I\^2/g, 'I²');

  // Remove block math $$...$$ and inline math $...$
  cleaned = cleaned.replace(/\$\$([^$]+)\$\$/g, '$1');
  cleaned = cleaned.replace(/\$([^$\n]+)\$/g, '$1');

  // Clean any lingering backslash LaTeX commands
  cleaned = cleaned.replace(/\\[,;!]/g, ' ');
  cleaned = cleaned.replace(/\\(?:quad|qquad)/g, '  ');
  cleaned = cleaned.replace(/\\(?:text|mathrm|mathbf)\b/g, '');

  return cleaned;
}

/**
 * Select the most relevant sections of the document for the query and chat context.
 * Optimized for lightning-fast sub-second responses without sacrificing accuracy.
 */
function getRelevantContext(documentInfo = {}, documentText = '', pagesData = [], query = '', chatHistory = []) {
  // Build master detected course directory header if available
  let masterCourseHeader = '';
  if (Array.isArray(documentInfo.courses) && documentInfo.courses.length > 0) {
    masterCourseHeader = `### MASTER DETECTED COURSE DIRECTORY (Total: ${documentInfo.courses.length} Courses Found in Document):\n` +
      documentInfo.courses.map((c, i) => `${i + 1}. [${c.code}] ${c.title} (Page ${c.start_page}${c.end_page > c.start_page ? '-' + c.end_page : ''})`).join('\n') + '\n\n';
  }

  const trimmedQuery = (query || '').trim().toLowerCase();

  // 1. LIGHTNING FAST PATH: Friendly greetings and polite pleasantries (< 1s response)
  const isGreetingOrCasual = /^(hi|hello|hey|greetings|namaste|good\s*(morning|afternoon|evening)|who\s+are\s+you|what\s+can\s+you\s+do|thanks|thank\s+you|ok|cool|bye|start)[\s!?.]*$/i.test(trimmedQuery);
  if (isGreetingOrCasual) {
    const totalPages = documentInfo.pageCount || (Array.isArray(pagesData) ? pagesData.length : 'several');
    const totalCourses = documentInfo.totalCourses || (documentInfo.courses ? documentInfo.courses.length : 0);
    return `${masterCourseHeader}DOCUMENT SUMMARY:
Filename: ${documentInfo.filename || 'Uploaded Document'}
Total Pages: ${totalPages}
Total Courses: ${totalCourses}
Ready to assist with questions about regulations, curriculum, course syllabi, credits, or textbooks.`;
  }

  // If document is small (< 50,000 characters), pass full document text
  if (!documentText || documentText.length <= 50000) {
    if (Array.isArray(pagesData) && pagesData.length > 0) {
      return masterCourseHeader + pagesData.map(p => `--- PAGE ${p.pageNumber} ---\n${p.text}`).join('\n\n');
    }
    return masterCourseHeader + (documentText || '');
  }

  // 2. CURRICULUM & TOTAL COURSES PATH: "how many courses", "list all courses", "anni subjects"
  const isAllCoursesQuery = /(total|anni|all|motham|list|how many|enni).*(courses|subjects|syllabus)/i.test(trimmedQuery) ||
    /courses?.*(available|list|details|structure|count)/i.test(trimmedQuery) ||
    /(curriculum|credit distribution|scheme of instruction)/i.test(trimmedQuery);

  if (isAllCoursesQuery && Array.isArray(pagesData) && pagesData.length > 0) {
    // Pages 1 to 20 contain the entire academic curriculum, semester tables, and elective categories
    const structurePages = pagesData.filter(p => p.pageNumber <= 20);
    return masterCourseHeader + structurePages.map(p => `--- PAGE ${p.pageNumber} ---\n${p.text}`).join('\n\n');
  }

  // 3. TARGETED COURSE SYLLABUS PATH: Specific Course Code (e.g. 25CS101) or Title
  if (Array.isArray(pagesData) && pagesData.length > 0) {
    const courseCodeRegex = /\b([0-9]{2}[A-Za-z]{2,4}[0-9]{2,4}[A-Za-z]?)\b/g;
    const detectedCourseCodes = new Set();
    const queryMatches = (query || '').match(courseCodeRegex);
    if (queryMatches) {
      queryMatches.forEach(c => detectedCourseCodes.add(c.toUpperCase()));
    }

    // Check recent turns in chat history
    if (Array.isArray(chatHistory) && chatHistory.length > 0) {
      const recentTurns = chatHistory.slice(-2);
      for (const turn of recentTurns) {
        const text = turn.content || turn.text || '';
        const historyMatches = text.match(courseCodeRegex);
        if (historyMatches) {
          historyMatches.forEach(c => detectedCourseCodes.add(c.toUpperCase()));
        }
      }
    }

    const mustIncludePageNumbers = new Set();

    // Include Table of Contents / Scheme overview (pages 1 to 14)
    for (let i = 1; i <= Math.min(14, pagesData.length); i++) {
      mustIncludePageNumbers.add(i);
    }

    // If specific course codes detected: include start page and continuation pages
    if (detectedCourseCodes.size > 0) {
      for (const code of detectedCourseCodes) {
        if (Array.isArray(documentInfo.courses)) {
          const matched = documentInfo.courses.find(c => c.code.toUpperCase() === code);
          if (matched) {
            const start = matched.start_page;
            const end = Math.max(matched.end_page || start, start + 3);
            for (let pg = start; pg <= Math.min(end, pagesData.length); pg++) {
              mustIncludePageNumbers.add(pg);
            }
          }
        }

        // Direct text scan fallback
        for (const p of pagesData) {
          if (p.text.toUpperCase().includes(code)) {
            mustIncludePageNumbers.add(p.pageNumber);
            if (p.pageNumber + 1 <= pagesData.length) mustIncludePageNumbers.add(p.pageNumber + 1);
            if (p.pageNumber + 2 <= pagesData.length) mustIncludePageNumbers.add(p.pageNumber + 2);
          }
        }
      }
    }

    // Keyword scoring for additional relevant pages
    const stopWords = new Set([
      'the', 'and', 'for', 'with', 'what', 'give', 'tell', 'show', 'any', 'like',
      'this', 'that', 'there', 'is', 'are', 'was', 'were',
      'about', 'from', 'have', 'been', 'which', 'will', 'would', 'could', 'should',
      'can', 'please', 'help', 'know', 'want', 'details', 'full'
    ]);

    const rawTokens = (query || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2 && !stopWords.has(t));

    const scoredPages = pagesData.map(p => {
      const lower = p.text.toLowerCase();
      let score = 0;
      if (mustIncludePageNumbers.has(p.pageNumber)) score += 60;
      for (const token of rawTokens) {
        if (lower.includes(token)) score += 15;
      }
      return { page: p, score };
    });

    scoredPages.sort((a, b) => b.score - a.score);

    const selected = [];
    let currentLength = 0;
    const maxChars = 55000; // Optimal context size for fast 1-2s inference

    const sortedMustNumbers = Array.from(mustIncludePageNumbers).sort((a, b) => a - b);
    for (const pageNum of sortedMustNumbers) {
      const p = pagesData.find(pg => pg.pageNumber === pageNum);
      if (p && !selected.some(s => s.pageNumber === p.pageNumber)) {
        if (currentLength + p.text.length <= maxChars) {
          selected.push(p);
          currentLength += p.text.length;
        }
      }
    }

    for (const item of scoredPages) {
      if (item.score > 0 && !selected.some(s => s.pageNumber === item.page.pageNumber)) {
        if (currentLength + item.page.text.length <= maxChars) {
          selected.push(item.page);
          currentLength += item.page.text.length;
        }
      }
    }

    selected.sort((a, b) => a.pageNumber - b.pageNumber);
    if (selected.length > 0) {
      return masterCourseHeader + selected.map(p => `--- PAGE ${p.pageNumber} ---\n${p.text}`).join('\n\n');
    }
  }

  // Fallback
  return masterCourseHeader + documentText.slice(0, 50000);
}

/**
 * Validate an API key by making a lightweight test call
 */
async function validateApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    return { valid: false, error: 'API Key is empty or missing.' };
  }

  const trimmedKey = apiKey.trim();
  const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${trimmedKey}`;

  try {
    const res = await fetch(testUrl);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const message = errData.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      return { valid: false, error: message };
    }
    const data = await res.json();
    const availableModels = (data.models || [])
      .map(m => m.name.replace('models/', ''))
      .filter(name => name.includes('flash') || name.includes('gemini'));

    return { valid: true, models: availableModels };
  } catch (err) {
    return { valid: false, error: err.message || 'Network error connecting to Gemini API.' };
  }
}

/**
 * Real-time SSE streaming generator for document-grounded responses
 */
async function* streamDocumentResponse({
  apiKey,
  model = 'gemini-3.5-flash-lite',
  documentInfo,
  documentText,
  pagesData,
  userQuery,
  chatHistory = [],
  languagePref = 'en',
  signal
}) {
  const systemInstructionText = buildSystemInstruction(documentInfo, languagePref);
  const contextText = getRelevantContext(documentInfo, documentText, pagesData, userQuery, chatHistory);

  // Fast prioritized models: Put cached working model and fastest lite models first
  const candidateModels = [
    model,
    cachedWorkingModel,
    ...DEFAULT_MODELS
  ].filter((m, idx, self) => self.indexOf(m) === idx);

  let lastError = null;

  for (const currentModel of candidateModels) {
    if (signal?.aborted) return;
    
    // 5-second connection timeout per model attempt to prevent hanging on congested models
    const attemptController = new AbortController();
    const parentAbortHandler = () => attemptController.abort();
    if (signal) signal.addEventListener('abort', parentAbortHandler);
    const timeoutTimer = setTimeout(() => {
      attemptController.abort(new Error(`Connection to model ${currentModel} timed out after 5s`));
    }, 5000);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:streamGenerateContent?alt=sse&key=${apiKey.trim()}`;

      const contextPrompt = `### UPLOADED DOCUMENT CONTENT:
Filename: ${documentInfo.filename}
Total Pages: ${documentInfo.pageCount || 'N/A'}
Total Words: ${documentInfo.wordCount || 'N/A'}

--- BEGIN DOCUMENT TEXT ---
${contextText}
--- END DOCUMENT TEXT ---

### USER MESSAGE:
${userQuery}

### RESPONSE INSTRUCTION:
1. FIRST PROMPT COMPLETENESS & ACCURACY: You MUST answer the user's question completely, exhaustively, and accurately on this VERY FIRST PROMPT. Do not provide a partial list or lazy summary. If asked about total courses, available courses, or curriculum (including queries in Tanglish such as "total anni courses available unnai"), state the exact total count of courses and provide the full unabridged list organized strictly Year-by-Year (Induction/Pre-Semester, Year 1, Year 2, Year 3, Year 4, Department Electives, Open Electives) without omitting any elective or course.
2. STRICT YEAR-BY-YEAR SEPARATION: Whenever listing courses, subjects, curriculum, or electives across multiple semesters or years, you MUST categorize and present them strictly Year-by-Year (I Year, II Year, III Year, IV Year) and Semester-by-Semester with clear headings. NEVER combine, mix, or lump different academic years together into an unorganized list!
3. COMPLETE COURSE DOSSIER: If the user message asks about a course or course number (or asks for "all information", "motham information", "full details", or mentions a course code like 25CS101), provide the COMPLETE, UNABRIDGED course dossier covering Course Metadata, Description & Objectives, All Modules & All Units with all detailed topics, Course Outcomes (COs) Table, Textbooks, Reference Books, Skills, and Page Citations. Do NOT truncate or omit any section.
4. WRONG INFORMATION / NOT FOUND: If the user provides a wrong, invalid, or non-existent course code (e.g. from another regulation) or information not in this document, DO NOT write a long explanation or dump a massive list of subjects! State simply in 1-2 lines that it was not found in this document, and provide ONLY 2 to 3 concise related suggestions. Keep the response under 4 lines total.
5. PURE NORMAL TEXT ONLY (STRICTLY NO LATEX OR CODE SYNTAX): Never use LaTeX code or math syntax like $\\text{L}=...$, $I^2$, or \\frac. Always write in simple, clean, normal plain text (e.g. write "(L=13, T=8, P=12, SL=13)" and "I^2" or "I2").`;

      const contents = [];

      // Add recent history if available (up to 6 turns)
      if (Array.isArray(chatHistory) && chatHistory.length > 0) {
        const recentHistory = chatHistory.slice(-6);
        for (const item of recentHistory) {
          if (item.role === 'user' || item.role === 'model') {
            contents.push({
              role: item.role,
              parts: [{ text: item.content || item.text || '' }]
            });
          }
        }
      }

      // Add current message
      contents.push({
        role: 'user',
        parts: [{ text: contextPrompt }]
      });

      const payload = {
        systemInstruction: {
          parts: [{ text: systemInstructionText }]
        },
        contents,
        generationConfig: {
          temperature: 0.1,
          topP: 0.85,
          maxOutputTokens: 8192
        }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: attemptController.signal
      });

      clearTimeout(timeoutTimer);
      if (signal) signal.removeEventListener('abort', parentAbortHandler);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const errMessage = errJson.error?.message || `HTTP ${res.status}: ${res.statusText}`;
        lastError = new Error(`Model ${currentModel}: ${errMessage}`);
        
        const lowerMsg = errMessage.toLowerCase();
        const isRetryable = res.status === 404 ||
          res.status === 400 ||
          res.status === 503 ||
          res.status === 429 ||
          lowerMsg.includes('high demand') ||
          lowerMsg.includes('quota') ||
          lowerMsg.includes('limit: 0') ||
          lowerMsg.includes('not found') ||
          lowerMsg.includes('no longer available') ||
          lowerMsg.includes('deprecated') ||
          lowerMsg.includes('unavailable');

        if (isRetryable) {
          console.warn(`[Gemini Stream Fallback] Model "${currentModel}" failed: ${errMessage}. Trying next model...`);
          continue;
        }
        throw lastError;
      }

      // Stream SSE chunks
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let hasYieldedAny = false;

      while (true) {
        if (signal?.aborted) {
          try { await reader.cancel(); } catch (e) {}
          return;
        }

        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep last incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const textChunk = parsed.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
            if (textChunk) {
              if (!hasYieldedAny) {
                // First successful chunk -> memorize this model as fastest working model
                cachedWorkingModel = currentModel;
                hasYieldedAny = true;
              }
              yield {
                text: textChunk,
                model: currentModel
              };
            }
          } catch (e) {
            // ignore partial json parsing error
          }
        }
      }

      if (hasYieldedAny) {
        return; // Success!
      }
    } catch (err) {
      clearTimeout(timeoutTimer);
      if (signal) signal.removeEventListener('abort', parentAbortHandler);
      if (signal?.aborted) return;
      
      lastError = err;
      const lower = (err.message || '').toLowerCase();
      console.warn(`[Gemini Stream] Model "${currentModel}" note: ${err.message}. Trying next candidate...`);
      continue;
    }
  }

  throw lastError || new Error('Failed to stream response from Gemini API.');
}

/**
 * Query Gemini with strict grounding on the document context (non-streaming fallback)
 */
async function generateDocumentResponse({
  apiKey,
  model = 'gemini-3.5-flash-lite',
  documentInfo,
  documentText,
  pagesData,
  userQuery,
  chatHistory = [],
  languagePref = 'en'
}) {
  const systemInstructionText = buildSystemInstruction(documentInfo, languagePref);
  const contextText = getRelevantContext(documentInfo, documentText, pagesData, userQuery, chatHistory);

  const candidateModels = [
    model,
    cachedWorkingModel,
    ...DEFAULT_MODELS
  ].filter((m, idx, self) => self.indexOf(m) === idx);

  let lastError = null;

  for (const currentModel of candidateModels) {
    const attemptController = new AbortController();
    const timeoutTimer = setTimeout(() => {
      attemptController.abort(new Error(`Model ${currentModel} timed out after 5s`));
    }, 5000);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey.trim()}`;

      const contextPrompt = `### UPLOADED DOCUMENT CONTENT:
Filename: ${documentInfo.filename}
Total Pages: ${documentInfo.pageCount || 'N/A'}
Total Words: ${documentInfo.wordCount || 'N/A'}

--- BEGIN DOCUMENT TEXT ---
${contextText}
--- END DOCUMENT TEXT ---

### USER MESSAGE:
${userQuery}

### RESPONSE INSTRUCTION:
1. FIRST PROMPT COMPLETENESS & ACCURACY: You MUST answer the user's question completely, exhaustively, and accurately on this VERY FIRST PROMPT. Do not provide a partial list or lazy summary. If asked about total courses, available courses, or curriculum (including queries in Tanglish such as "total anni courses available unnai"), state the exact total count of courses and provide the full unabridged list organized strictly Year-by-Year (Induction/Pre-Semester, Year 1, Year 2, Year 3, Year 4, Department Electives, Open Electives) without omitting any elective or course.
2. STRICT YEAR-BY-YEAR SEPARATION: Whenever listing courses, subjects, curriculum, or electives across multiple semesters or years, you MUST categorize and present them strictly Year-by-Year (I Year, II Year, III Year, IV Year) and Semester-by-Semester with clear headings. NEVER combine, mix, or lump different academic years together into an unorganized list!
3. COMPLETE COURSE DOSSIER: If the user message asks about a course or course number (or asks for "all information", "motham information", "full details", or mentions a course code like 25CS101), provide the COMPLETE, UNABRIDGED course dossier covering Course Metadata, Description & Objectives, All Modules & All Units with all detailed topics, Course Outcomes (COs) Table, Textbooks, Reference Books, Skills, and Page Citations. Do NOT truncate or omit any section.
4. WRONG INFORMATION / NOT FOUND: If the user provides a wrong, invalid, or non-existent course code (e.g. from another regulation) or information not in this document, DO NOT write a long explanation or dump a massive list of subjects! State simply in 1-2 lines that it was not found in this document, and provide ONLY 2 to 3 concise related suggestions. Keep the response under 4 lines total.
5. PURE NORMAL TEXT ONLY (STRICTLY NO LATEX OR CODE SYNTAX): Never use LaTeX code or math syntax like $\\text{L}=...$, $I^2$, or \\frac. Always write in simple, clean, normal plain text (e.g. write "(L=13, T=8, P=12, SL=13)" and "I^2" or "I2").`;

      const contents = [];

      if (Array.isArray(chatHistory) && chatHistory.length > 0) {
        const recentHistory = chatHistory.slice(-6);
        for (const item of recentHistory) {
          if (item.role === 'user' || item.role === 'model') {
            contents.push({
              role: item.role,
              parts: [{ text: item.content || item.text || '' }]
            });
          }
        }
      }

      contents.push({
        role: 'user',
        parts: [{ text: contextPrompt }]
      });

      const payload = {
        systemInstruction: {
          parts: [{ text: systemInstructionText }]
        },
        contents,
        generationConfig: {
          temperature: 0.1,
          topP: 0.85,
          maxOutputTokens: 8192
        }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: attemptController.signal
      });

      clearTimeout(timeoutTimer);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const errMessage = errJson.error?.message || `HTTP ${res.status}: ${res.statusText}`;
        lastError = new Error(`Model ${currentModel}: ${errMessage}`);
        
        const lowerMsg = errMessage.toLowerCase();
        const isRetryable = res.status === 404 ||
          res.status === 400 ||
          res.status === 503 ||
          res.status === 429 ||
          lowerMsg.includes('high demand') ||
          lowerMsg.includes('quota') ||
          lowerMsg.includes('limit: 0') ||
          lowerMsg.includes('not found') ||
          lowerMsg.includes('no longer available') ||
          lowerMsg.includes('deprecated') ||
          lowerMsg.includes('unavailable');

        if (isRetryable) {
          console.warn(`[Gemini Fallback] Model "${currentModel}" failed: ${errMessage}. Trying next model...`);
          continue;
        }
        throw lastError;
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      const answerText = candidate?.content?.parts?.map(p => p.text).join('\n') || '';

      if (!answerText) {
        throw new Error('Gemini returned an empty response. Please try rephrasing your question.');
      }

      cachedWorkingModel = currentModel;
      const cleanedAnswer = cleanLatexToPlainText(answerText);

      return {
        answer: cleanedAnswer,
        modelUsed: currentModel,
        usage: data.usageMetadata || null
      };
    } catch (err) {
      clearTimeout(timeoutTimer);
      lastError = err;
      console.warn(`[Gemini] Model "${currentModel}" note: ${err.message}. Trying next candidate...`);
      continue;
    }
  }

  throw lastError || new Error('Failed to generate response from Gemini API.');
}

module.exports = {
  DEFAULT_MODELS,
  validateApiKey,
  generateDocumentResponse,
  streamDocumentResponse,
  buildSystemInstruction,
  getRelevantContext,
  cleanLatexToPlainText
};
