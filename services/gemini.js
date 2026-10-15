const DEFAULT_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.6-flash',
  'gemini-3.7-flash'
];

/**
 * Build conversational & document-grounded system instruction in English.
 */
function buildSystemInstruction(documentInfo, languagePref = 'en') {
  return `You are DocuMind AI, an intelligent, conversational, and highly comprehensive Document Assistant.

CORE OPERATIONAL BEHAVIORS:
1. GREETINGS & CASUAL INTERACTION:
   - When the user sends a friendly greeting (such as "hi", "hello", "hey", "good morning", "good evening", "namaste", "who are you", "what can you do"):
     * Respond warmly, naturally, and politely as DocuMind AI.
     * Tell the user that you are ready to help with their active document: "${documentInfo.filename}" (${documentInfo.pageCount || 'several'} pages).
     * Proactively suggest 3 to 4 specific, interesting questions they can ask about this document.

2. COURTESY & SMALL TALK:
   - When the user expresses gratitude (e.g., "thank you", "thanks", "great job", "ok", "cool", "bye"):
     * Acknowledge warmly and offer further assistance regarding the document.

3. COMPLETE COURSE DOSSIER (WHEN COURSE NUMBER/CODE OR FULL INFO IS ASKED):
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

4. STRICT YEAR-BY-YEAR SEPARATION (NEVER MIX YEARS TOGETHER):
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

5. STRICT FACTUAL GROUNDING ON OTHER DOCUMENT QUESTIONS:
   - For all other questions about regulations, credits, semester curriculum, or evaluations:
     * Provide exact details directly from the document text, with source page citations.

6. WHEN WRONG INFORMATION OR NON-EXISTENT COURSE IS GIVEN (CONCISE RELATED SUGGESTIONS ONLY):
   - CRITICAL REQUIREMENT: If the user provides an invalid, wrong, or non-existent course code, topic, or information not present in "${documentInfo.filename}":
     * DO NOT write a long essay, explanation, or dump a massive list of subjects or entire curriculum tables!
     * Keep your response BRIEF, CONCISE, and TO THE POINT (maximum 3 to 4 lines).
     * State simply that the requested item/code is not found in "${documentInfo.filename}".
     * Provide ONLY 2 or 3 closest related suggestions (e.g. "Did you mean: **25CS101: Programming in C** or **25CS102: Problem Solving through Python**?").
     * Do NOT dump all departments, all modules, or unrelated subjects. Just give short, helpful suggestions!

7. CONVERSATIONAL CONTINUITY & FOLLOW-UPS:
   - Maintain multi-turn context. If the user asks follow-up questions (e.g., "What are its units?", "Who wrote the textbooks for it?", "What about the lab?", "Tell me more about Semester 2"), use the previous conversation context to understand which subject or topic they are asking about.

8. FORMATTING & PRESENTATION:
   - Format responses cleanly with bold section headings, bullet points, and clean Markdown tables where appropriate.
   - Always communicate in clear, professional English.`;
}

/**
 * Select the most relevant sections of the document for the query and chat context.
 * Automatically expands course syllabus pages to include continuation pages (Module 2, COs, Textbooks).
 */
function getRelevantContext(documentInfo, documentText, pagesData, query = '', chatHistory = []) {
  // If the document is moderate size (<= 50,000 characters), send full text
  if (!documentText || documentText.length <= 50000) {
    return documentText;
  }

  // If page-level data is available (e.g., PDF)
  if (Array.isArray(pagesData) && pagesData.length > 0) {
    const courseCodeRegex = /\b([0-9]{2}[A-Za-z]{2,4}[0-9]{2,4}[A-Za-z]?)\b/g;
    const detectedCourseCodes = new Set();

    // Check query for course codes (e.g., 25CS101)
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

    // Identify must-include pages (course detail page + continuation pages)
    const mustIncludePageNumbers = new Set();

    // Always include first 2 pages (TOC / Overview)
    for (let i = 1; i <= Math.min(2, pagesData.length); i++) {
      mustIncludePageNumbers.add(i);
    }

    // If course codes are detected: find syllabus start pages AND continuation pages
    if (detectedCourseCodes.size > 0) {
      for (const code of detectedCourseCodes) {
        for (const p of pagesData) {
          const upperText = p.text.toUpperCase();
          if (upperText.includes(code)) {
            mustIncludePageNumbers.add(p.pageNumber);
            // If this is a course syllabus detail page (usually page >= 16)
            if (p.pageNumber >= 16) {
              // Always include continuation page p.pageNumber + 1 (contains Module 2, Outcomes, Textbooks)
              if (p.pageNumber + 1 <= pagesData.length) {
                mustIncludePageNumbers.add(p.pageNumber + 1);
              }
              // Check if continuation page starts next course; if not, include p.pageNumber + 2 as well
              if (p.pageNumber + 2 <= pagesData.length) {
                const nextPage = pagesData.find(pg => pg.pageNumber === p.pageNumber + 1);
                const startsNewCourse = /^[0-9]{2}[A-Z]{2}[0-9]{3}\s+[A-Z\s]+/m.test(nextPage?.text || '');
                if (!startsNewCourse) {
                  mustIncludePageNumbers.add(p.pageNumber + 2);
                }
              }
            }
          }
        }
      }
    }

    const stopWords = new Set([
      'the', 'and', 'for', 'with', 'what', 'give', 'tell', 'show', 'any', 'like',
      'this', 'that', 'there', 'is', 'are', 'was', 'were', 'course', 'title',
      'about', 'from', 'have', 'been', 'which', 'will', 'would', 'could', 'should',
      'can', 'please', 'help', 'know', 'want', 'motham', 'information', 'ivvu', 'details', 'full'
    ]);

    // Extract query tokens
    const rawTokens = (query || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1 && !stopWords.has(t));

    const allTokens = Array.from(new Set([...rawTokens, ...Array.from(detectedCourseCodes).map(c => c.toLowerCase())]));

    const scoredPages = pagesData.map(p => {
      const lower = p.text.toLowerCase();
      let score = 0;

      // Table of contents / curriculum structure pages (pages 1-12)
      if (p.pageNumber <= 12) {
        score += 8;
      }

      // Check tokens
      for (const token of allTokens) {
        if (lower.includes(token)) {
          const isCode = /^[0-9]{2}[a-z]{2,4}[0-9]{2,4}$/.test(token);
          const weight = isCode ? 60 : 25;
          score += weight;
          const matches = lower.split(token).length - 1;
          score += Math.min(matches * 5, 25);
        }
      }

      // Also check raw query string if alphanumeric
      const cleanRaw = (query || '').toLowerCase().trim();
      if (cleanRaw.length > 3 && lower.includes(cleanRaw)) {
        score += 40;
      }

      return { page: p, score };
    });

    scoredPages.sort((a, b) => b.score - a.score);

    const selected = [];
    let currentLength = 0;
    const maxChars = 75000;

    // 1. Add all must-include pages first (TOC, course start page, and continuation pages)
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

    // 2. Add other highest scoring relevant pages if capacity remains
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
      return selected.map(p => `--- PAGE ${p.pageNumber} ---\n${p.text}`).join('\n\n');
    }
  }

  // Fallback: first 50,000 characters
  return documentText.slice(0, 50000);
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
  model = 'gemini-3.1-flash-lite',
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

  const candidateModels = [
    model,
    ...DEFAULT_MODELS.filter(m => m !== model)
  ];

  let lastError = null;

  for (const currentModel of candidateModels) {
    if (signal?.aborted) return;
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
1. STRICT YEAR-BY-YEAR SEPARATION: Whenever listing courses, subjects, curriculum, or electives across multiple semesters or years, you MUST categorize and present them strictly Year-by-Year (I Year, II Year, III Year, IV Year) and Semester-by-Semester with clear headings. NEVER combine, mix, or lump different academic years together into an unorganized list!
2. COMPLETE COURSE DOSSIER: If the user message asks about a course or course number (or asks for "all information", "motham information", "full details", or mentions a course code like 25CS101), provide the COMPLETE, UNABRIDGED course dossier covering Course Metadata, Description & Objectives, All Modules & All Units with all detailed topics, Course Outcomes (COs) Table, Textbooks, Reference Books, Skills, and Page Citations. Do NOT truncate or omit any section.
3. WRONG INFORMATION / NOT FOUND: If the user provides a wrong, invalid, or non-existent course code (e.g. from another regulation) or information not in this document, DO NOT write a long explanation or dump a massive list of subjects! State simply in 1-2 lines that it was not found in this document, and provide ONLY 2 to 3 concise related suggestions. Keep the response under 4 lines total.`;

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
        signal
      });

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
              hasYieldedAny = true;
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
      if (signal?.aborted) return;
      lastError = err;
      const lower = (err.message || '').toLowerCase();
      if (lower.includes('404') ||
          lower.includes('503') ||
          lower.includes('429') ||
          lower.includes('quota') ||
          lower.includes('high demand') ||
          lower.includes('not found') ||
          lower.includes('no longer available') ||
          lower.includes('deprecated') ||
          lower.includes('unavailable')) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('Failed to stream response from Gemini API.');
}

/**
 * Query Gemini with strict grounding on the document context (non-streaming fallback)
 */
async function generateDocumentResponse({
  apiKey,
  model = 'gemini-3.1-flash-lite',
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
    ...DEFAULT_MODELS.filter(m => m !== model)
  ];

  let lastError = null;

  for (const currentModel of candidateModels) {
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
1. STRICT YEAR-BY-YEAR SEPARATION: Whenever listing courses, subjects, curriculum, or electives across multiple semesters or years, you MUST categorize and present them strictly Year-by-Year (I Year, II Year, III Year, IV Year) and Semester-by-Semester with clear headings. NEVER combine, mix, or lump different academic years together into an unorganized list!
2. COMPLETE COURSE DOSSIER: If the user message asks about a course or course number (or asks for "all information", "motham information", "full details", or mentions a course code like 25CS101), provide the COMPLETE, UNABRIDGED course dossier covering Course Metadata, Description & Objectives, All Modules & All Units with all detailed topics, Course Outcomes (COs) Table, Textbooks, Reference Books, Skills, and Page Citations. Do NOT truncate or omit any section.
3. WRONG INFORMATION / NOT FOUND: If the user provides a wrong, invalid, or non-existent course code (e.g. from another regulation) or information not in this document, DO NOT write a long explanation or dump a massive list of subjects! State simply in 1-2 lines that it was not found in this document, and provide ONLY 2 to 3 concise related suggestions. Keep the response under 4 lines total.`;

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
        body: JSON.stringify(payload)
      });

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

      return {
        answer: answerText,
        modelUsed: currentModel,
        usage: data.usageMetadata || null
      };
    } catch (err) {
      lastError = err;
      const lower = (err.message || '').toLowerCase();
      if (lower.includes('404') ||
          lower.includes('503') ||
          lower.includes('429') ||
          lower.includes('quota') ||
          lower.includes('high demand') ||
          lower.includes('not found') ||
          lower.includes('no longer available') ||
          lower.includes('deprecated') ||
          lower.includes('unavailable')) {
        continue;
      }
      throw err;
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
  getRelevantContext
};
