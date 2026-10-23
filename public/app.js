/**
 * DocuMind - Real AI Document Assistant Client Logic
 * Features:
 * 1. Live Real-Time Token Streaming (Typewriter effect)
 * 2. Stop Generating Button (AbortController)
 * 3. Multi-Turn Conversational Memory & Natural Greetings
 * 4. Regenerate Responses & Dynamic Suggested Follow-up Prompts
 * 5. Multi-Chat Sessions with Chrome LocalStorage Persistence
 * 6. Copy to Clipboard & Text-to-Speech Read Aloud
 */

document.addEventListener('DOMContentLoaded', () => {
  // Storage Keys
  const SESSIONS_STORAGE_KEY = 'documind_saved_chats_v1';
  const ACTIVE_SESSION_KEY = 'documind_active_session_id';

  // State
  let currentDoc = null;
  let sessions = [];
  let currentSessionId = null;
  let isGenerating = false;
  let currentAbortController = null;
  let fullDocText = '';

  // DOM Elements
  const messagesContainer = document.getElementById('messagesContainer');
  const welcomeContainer = document.getElementById('welcomeContainer');
  const chatForm = document.getElementById('chatForm');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const stopBtn = document.getElementById('stopBtn');
  const typingIndicator = document.getElementById('typingIndicator');
  const clearChatBtn = document.getElementById('clearChatBtn');
  const footerDocIndicator = document.getElementById('footerDocIndicator');
  const promptChips = document.getElementById('promptChips');

  // New Chat & History Elements
  const newChatSidebarBtn = document.getElementById('newChatSidebarBtn');
  const newChatHeaderBtn = document.getElementById('newChatHeaderBtn');
  const chatHistoryList = document.getElementById('chatHistoryList');
  const historyCount = document.getElementById('historyCount');

  // Sidebar Elements
  const noDocState = document.getElementById('noDocState');
  const activeDocDetails = document.getElementById('activeDocDetails');
  const docNameEl = document.getElementById('docName');
  const docSizeEl = document.getElementById('docSize');
  const docPagesEl = document.getElementById('docPages');
  const docWordsEl = document.getElementById('docWords');
  const docCharsEl = document.getElementById('docChars');
  const docTypeBadge = document.getElementById('docTypeBadge');
  const removeDocBtn = document.getElementById('removeDocBtn');
  const inspectDocBtn = document.getElementById('inspectDocBtn');
  const viewDocBtn = document.getElementById('viewDocBtn');

  // Upload Elements
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const attachBtn = document.getElementById('attachBtn');
  const uploadProgress = document.getElementById('uploadProgress');
  const progressBarFill = document.getElementById('progressBarFill');
  const progressText = document.getElementById('progressText');
  const localFilesList = document.getElementById('localFilesList');

  // API Key Modal Elements
  const apiKeyBtn = document.getElementById('apiKeyBtn');
  const apiKeyModal = document.getElementById('apiKeyModal');
  const closeApiKeyModal = document.getElementById('closeApiKeyModal');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveKeyBtn = document.getElementById('saveKeyBtn');
  const testKeyBtn = document.getElementById('testKeyBtn');
  const keyValidationResult = document.getElementById('keyValidationResult');
  const apiKeyStatusDot = document.getElementById('apiKeyStatusDot');
  const toggleKeyVisibility = document.getElementById('toggleKeyVisibility');

  // Document Inspect Modal Elements
  const inspectDocModal = document.getElementById('inspectDocModal');
  const closeInspectModal = document.getElementById('closeInspectModal');
  const closeInspectBtn = document.getElementById('closeInspectBtn');
  const inspectModalTitle = document.getElementById('inspectModalTitle');
  const inspectModalStats = document.getElementById('inspectModalStats');
  const docTextPreview = document.getElementById('docTextPreview');
  const inspectSearchInput = document.getElementById('inspectSearchInput');

  // Course Extractor Elements
  const courseExtractorCard = document.getElementById('courseExtractorCard');
  const detectedCoursesBadge = document.getElementById('detectedCoursesBadge');
  const courseSearchInput = document.getElementById('courseSearchInput');
  const courseSelectDropdown = document.getElementById('courseSelectDropdown');
  const courseInfoPill = document.getElementById('courseInfoPill');
  const courseInfoText = document.getElementById('courseInfoText');
  const downloadCoursePdfBtn = document.getElementById('downloadCoursePdfBtn');
  const extractorStatusMsg = document.getElementById('extractorStatusMsg');

  let detectedCourses = [];

  // Initialize
  initApp();

  async function initApp() {
    setupEventListeners();
    loadStoredApiKey();
    initSessions();
    await checkServerStatus();
    await loadLocalWorkspaceFiles();
    await fetchDetectedCourses();
  }

  // =========================================================
  // CHAT SESSIONS & LOCALSTORAGE PERSISTENCE
  // =========================================================
  function initSessions() {
    try {
      const stored = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (stored) {
        sessions = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse saved sessions from localStorage:', e);
      sessions = [];
    }

    if (!Array.isArray(sessions) || sessions.length === 0) {
      const initial = createSessionObject('New Chat');
      sessions = [initial];
      currentSessionId = initial.id;
      saveSessions();
    } else {
      const savedActiveId = localStorage.getItem(ACTIVE_SESSION_KEY);
      if (savedActiveId && sessions.some(s => s.id === savedActiveId)) {
        currentSessionId = savedActiveId;
      } else {
        currentSessionId = sessions[0].id;
      }
    }

    renderCurrentSession();
    renderHistoryList();
  }

  function createSessionObject(title = 'New Chat') {
    return {
      id: 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [] // Array of { sender: 'user' | 'bot', text: '...', meta: {...}, timestamp: ... }
    };
  }

  function getCurrentSession() {
    return sessions.find(s => s.id === currentSessionId) || sessions[0];
  }

  function saveSessions() {
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
      localStorage.setItem(ACTIVE_SESSION_KEY, currentSessionId);
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  function createNewChat() {
    if (isGenerating) {
      showToast('Please wait or click Stop before opening a new chat.', 'info');
      return;
    }

    const current = getCurrentSession();
    if (current && current.messages.length === 0) {
      messageInput.focus();
      showToast('Already on a new chat', 'info');
      return;
    }

    const newSession = createSessionObject('New Chat');
    sessions.unshift(newSession);
    currentSessionId = newSession.id;
    saveSessions();

    renderCurrentSession();
    renderHistoryList();
    messageInput.focus();
    showToast('New chat started!', 'success');
  }

  function switchSession(sessionId) {
    if (isGenerating) {
      showToast('Please stop or wait for the current answer to finish before switching chats.', 'info');
      return;
    }
    if (sessionId === currentSessionId) return;
    currentSessionId = sessionId;
    saveSessions();
    renderCurrentSession();
    renderHistoryList();
    messageInput.focus();
  }

  function deleteSession(sessionId, event) {
    if (event) event.stopPropagation();
    if (!confirm('Are you sure you want to delete this chat history?')) return;

    sessions = sessions.filter(s => s.id !== sessionId);

    if (sessions.length === 0) {
      const fresh = createSessionObject('New Chat');
      sessions = [fresh];
      currentSessionId = fresh.id;
    } else if (currentSessionId === sessionId) {
      currentSessionId = sessions[0].id;
    }

    saveSessions();
    renderCurrentSession();
    renderHistoryList();
    showToast('Conversation deleted', 'info');
  }

  function renderCurrentSession() {
    const messageRows = messagesContainer.querySelectorAll('.message-row');
    messageRows.forEach(row => row.remove());

    const session = getCurrentSession();
    if (!session || session.messages.length === 0) {
      welcomeContainer.style.display = 'block';
    } else {
      welcomeContainer.style.display = 'none';
      session.messages.forEach((msg, idx) => {
        if (msg.sender === 'user') {
          renderUserMessageDOM(msg.text, msg.timestamp);
        } else {
          // Find preceding query
          let prevQuery = '';
          for (let i = idx - 1; i >= 0; i--) {
            if (session.messages[i].sender === 'user') {
              prevQuery = session.messages[i].text;
              break;
            }
          }
          renderBotMessageDOM(msg.text, msg.meta || {}, msg.timestamp, prevQuery);
        }
      });
      autoScrollToBottom(true);
    }
  }

  function renderHistoryList() {
    if (historyCount) {
      historyCount.textContent = sessions.length;
    }

    if (!chatHistoryList) return;

    if (sessions.length === 0) {
      chatHistoryList.innerHTML = '<span class="empty-hint">No saved chats yet</span>';
      return;
    }

    chatHistoryList.innerHTML = sessions.map(s => {
      const isActive = s.id === currentSessionId;
      const count = s.messages ? s.messages.length : 0;
      return `
        <div class="chat-history-item ${isActive ? 'active' : ''}" data-session-id="${s.id}">
          <div class="chat-item-main">
            <span class="chat-item-icon">💬</span>
            <div class="chat-item-details">
              <div class="chat-item-title" title="${escapeHtml(s.title)}">${escapeHtml(s.title)}</div>
              <div class="chat-item-time">${formatTimeAgo(s.updatedAt)} &bull; ${count} msg${count === 1 ? '' : 's'}</div>
            </div>
          </div>
          <button type="button" class="chat-item-delete" title="Delete conversation" data-delete-id="${s.id}">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
      `;
    }).join('');

    chatHistoryList.querySelectorAll('.chat-history-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-session-id');
        switchSession(id);
      });
    });

    chatHistoryList.querySelectorAll('.chat-item-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-delete-id');
        deleteSession(id, e);
      });
    });
  }

  // =========================================================
  // SERVER STATUS & WORKSPACE FILES
  // =========================================================
  async function checkServerStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      
      if (data.hasEnvKey) {
        updateApiKeyStatus(true, 'Configured via .env');
      } else {
        const storedKey = getApiKey();
        updateApiKeyStatus(!!storedKey, storedKey ? 'Configured locally' : 'Not configured');
      }

      if (data.document) {
        setDocumentState(data.document);
      }
    } catch (err) {
      console.warn('Could not connect to server status endpoint:', err);
    }
  }

  async function loadLocalWorkspaceFiles() {
    try {
      const res = await fetch('/api/local-files');
      const data = await res.json();
      renderLocalFiles(data.files || []);
    } catch (err) {
      localFilesList.innerHTML = '<span class="empty-hint">None detected</span>';
    }
  }

  function renderLocalFiles(files) {
    if (!files || files.length === 0) {
      localFilesList.innerHTML = '<span class="empty-hint">No files in directory</span>';
      return;
    }

    localFilesList.innerHTML = files.map(file => `
      <div class="local-file-item ${currentDoc && currentDoc.filename === file.filename ? 'active' : ''}" data-filename="${file.filename}">
        <div class="local-file-info">
          <span class="file-icon-sm">📄</span>
          <div>
            <div class="local-file-title" title="${file.filename}">${file.filename}</div>
            <div class="local-file-size">${file.sizeFormatted}</div>
          </div>
        </div>
        <button type="button" class="load-btn-pill">
          ${currentDoc && currentDoc.filename === file.filename ? 'Active' : 'Load'}
        </button>
      </div>
    `).join('');

    localFilesList.querySelectorAll('.local-file-item').forEach(item => {
      item.addEventListener('click', async () => {
        const filename = item.getAttribute('data-filename');
        await loadLocalDocument(filename);
      });
    });
  }

  async function loadLocalDocument(filename) {
    showUploadProgress(true, `Reading and indexing ${filename}...`);
    try {
      const res = await fetch('/api/load-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load file');

      setDocumentState(data.document);
      showToast(`Indexed ${data.document.filename} (${data.document.pageCount} pages)`, 'success');
      await loadLocalWorkspaceFiles();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      showUploadProgress(false);
    }
  }

  // =========================================================
  // EVENT LISTENERS SETUP
  // =========================================================
  function setupEventListeners() {
    if (newChatSidebarBtn) newChatSidebarBtn.addEventListener('click', createNewChat);
    if (newChatHeaderBtn) newChatHeaderBtn.addEventListener('click', createNewChat);

    // Stop button
    if (stopBtn) {
      stopBtn.addEventListener('click', handleStopGenerating);
    }

    // Auto-resize textarea
    messageInput.addEventListener('input', () => {
      messageInput.style.height = 'auto';
      messageInput.style.height = Math.min(messageInput.scrollHeight, 160) + 'px';
    });

    // Enter to submit, Shift+Enter for newline
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
      }
    });

    // Submit Chat
    chatForm.addEventListener('submit', handleSendMessage);

    // Clear current chat
    clearChatBtn.addEventListener('click', () => {
      const session = getCurrentSession();
      if (!session || session.messages.length === 0) return;
      if (confirm('Clear messages in this chat?')) {
        session.messages = [];
        session.title = 'New Chat';
        session.updatedAt = Date.now();
        saveSessions();
        renderCurrentSession();
        renderHistoryList();
        showToast('Chat cleared', 'info');
      }
    });

    // Suggestion chips in welcome container
    promptChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.prompt-chip');
      if (chip) {
        const query = chip.getAttribute('data-query');
        triggerPromptDirectly(query);
      }
    });

    // File upload handlers
    dropzone.addEventListener('click', () => fileInput.click());
    attachBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFileUpload(e.target.files[0]);
      }
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        handleFileUpload(e.dataTransfer.files[0]);
      }
    });

    // Remove Document
    removeDocBtn.addEventListener('click', async () => {
      if (!confirm('Remove the currently loaded document?')) return;
      try {
        await fetch('/api/clear-document', { method: 'POST' });
        currentDoc = null;
        fullDocText = '';
        detectedCourses = [];
        updateCoursesUI();
        noDocState.style.display = 'block';
        activeDocDetails.style.display = 'none';
        docTypeBadge.textContent = 'None';
        footerDocIndicator.textContent = 'No file loaded';
        viewDocBtn.style.display = 'none';
        await loadLocalWorkspaceFiles();
        showToast('Active document removed', 'info');
      } catch (e) {
        console.error(e);
      }
    });

    // Course Extractor Event Listeners
    if (courseSearchInput) {
      courseSearchInput.addEventListener('input', () => {
        const q = courseSearchInput.value.trim().toLowerCase();
        if (!q) {
          if (courseInfoPill) courseInfoPill.style.display = 'none';
          return;
        }
        const matched = detectedCourses.find(c => 
          c.code.toLowerCase() === q || 
          c.code.toLowerCase().replace(/[^a-z0-9]/g, '') === q.replace(/[^a-z0-9]/g, '') ||
          c.title.toLowerCase().includes(q)
        );
        if (matched) {
          if (courseSelectDropdown) courseSelectDropdown.value = matched.code;
          if (courseInfoPill && courseInfoText) {
            courseInfoPill.style.display = 'flex';
            courseInfoText.textContent = `${matched.code}: ${matched.title} (p.${matched.start_page}${matched.end_page > matched.start_page ? '-' + matched.end_page : ''}, ${matched.page_count} pages)`;
          }
        }
      });

      courseSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          triggerCourseDownload(courseSearchInput.value);
        }
      });
    }

    if (courseSelectDropdown) {
      courseSelectDropdown.addEventListener('change', () => {
        const code = courseSelectDropdown.value;
        if (!code) {
          if (courseInfoPill) courseInfoPill.style.display = 'none';
          return;
        }
        if (courseSearchInput) courseSearchInput.value = code;
        const matched = detectedCourses.find(c => c.code === code);
        if (matched && courseInfoPill && courseInfoText) {
          courseInfoPill.style.display = 'flex';
          courseInfoText.textContent = `${matched.code}: ${matched.title} (p.${matched.start_page}${matched.end_page > matched.start_page ? '-' + matched.end_page : ''}, ${matched.page_count} pages)`;
        }
      });
    }

    if (downloadCoursePdfBtn) {
      downloadCoursePdfBtn.addEventListener('click', () => {
        const query = (courseSearchInput ? courseSearchInput.value : '') || (courseSelectDropdown ? courseSelectDropdown.value : '');
        triggerCourseDownload(query);
      });
    }

    // Document Inspector
    inspectDocBtn.addEventListener('click', openInspectModal);
    viewDocBtn.addEventListener('click', openInspectModal);
    closeInspectModal.addEventListener('click', () => inspectDocModal.style.display = 'none');
    closeInspectBtn.addEventListener('click', () => inspectDocModal.style.display = 'none');

    // Document Search in inspector
    inspectSearchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        docTextPreview.textContent = fullDocText;
        return;
      }
      docTextPreview.textContent = fullDocText;
    });

    // API Key Modal
    apiKeyBtn.addEventListener('click', () => {
      apiKeyModal.style.display = 'flex';
      keyValidationResult.style.display = 'none';
      apiKeyInput.focus();
    });

    closeApiKeyModal.addEventListener('click', () => apiKeyModal.style.display = 'none');
    apiKeyModal.addEventListener('click', (e) => {
      if (e.target === apiKeyModal) apiKeyModal.style.display = 'none';
    });

    toggleKeyVisibility.addEventListener('click', () => {
      apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
    });

    testKeyBtn.addEventListener('click', handleTestApiKey);
    saveKeyBtn.addEventListener('click', handleSaveApiKey);
  }

  function handleStopGenerating() {
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
  }

  function triggerPromptDirectly(promptText) {
    if (isGenerating) return;
    messageInput.value = promptText;
    handleSendMessage(null, promptText);
  }

  // =========================================================
  // FILE UPLOAD HANDLING
  // =========================================================
  async function handleFileUpload(file) {
    const formData = new FormData();
    formData.append('file', file);

    showUploadProgress(true, `Uploading & extracting "${file.name}"...`);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setDocumentState(data.document);
      showToast(`Successfully indexed "${data.document.filename}"!`, 'success');
      await loadLocalWorkspaceFiles();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      showUploadProgress(false);
      fileInput.value = '';
    }
  }

  function showUploadProgress(show, text = 'Processing...') {
    if (show) {
      uploadProgress.style.display = 'block';
      progressBarFill.style.width = '70%';
      progressText.textContent = text;
    } else {
      progressBarFill.style.width = '100%';
      setTimeout(() => {
        uploadProgress.style.display = 'none';
        progressBarFill.style.width = '0%';
      }, 400);
    }
  }

  function setDocumentState(doc) {
    currentDoc = doc;
    noDocState.style.display = 'none';
    activeDocDetails.style.display = 'block';

    docNameEl.textContent = doc.filename;
    docNameEl.title = doc.filename;
    docSizeEl.textContent = doc.sizeFormatted;
    docPagesEl.textContent = doc.pageCount || 1;
    docWordsEl.textContent = formatNumber(doc.wordCount || 0);
    docCharsEl.textContent = formatNumber(doc.charCount || 0);
    docTypeBadge.textContent = (doc.extension || 'DOC').replace('.', '').toUpperCase();

    footerDocIndicator.textContent = `Active: ${doc.filename} (${doc.pageCount} pages)`;
    viewDocBtn.style.display = 'inline-flex';

    fullDocText = doc.preview || '';
    customizeSuggestions(doc.filename);
    fetchDetectedCourses();
  }

  function customizeSuggestions(filename) {
    if (filename.toLowerCase().includes('syllabus') || filename.toLowerCase().includes('course')) {
      promptChips.innerHTML = `
        <button class="prompt-chip" data-query="Summarize the core syllabus and curriculum structure.">
          📄 Summarize curriculum structure
        </button>
        <button class="prompt-chip" data-query="What subjects and labs are taught in Semester 1 & Semester 2?">
          📚 Subjects & Labs in 1st Year
        </button>
        <button class="prompt-chip" data-query="What is the credit distribution and evaluation scheme mentioned?">
          🎓 Credit distribution & grading
        </button>
        <button class="prompt-chip" data-query="List all Elective and Advanced courses mentioned in this document.">
          🔬 Professional Electives list
        </button>
      `;
    }
  }

  // =========================================================
  // DYNAMIC SYLLABUS COURSE DETECTION & EXTRACTION
  // =========================================================
  async function fetchDetectedCourses() {
    try {
      if (!currentDoc || (currentDoc.extension && currentDoc.extension.toLowerCase() !== '.pdf')) {
        detectedCourses = [];
        updateCoursesUI();
        return;
      }

      if (detectedCoursesBadge) detectedCoursesBadge.textContent = 'Scanning...';
      const res = await fetch('/api/courses');
      const data = await res.json();

      if (data.courses && Array.isArray(data.courses)) {
        detectedCourses = data.courses;
      } else {
        detectedCourses = [];
      }
      updateCoursesUI();
    } catch (err) {
      console.warn('Failed to fetch syllabus courses:', err);
      detectedCourses = [];
      updateCoursesUI();
    }
  }

  function updateCoursesUI() {
    if (!detectedCoursesBadge || !courseSelectDropdown) return;

    if (detectedCourses.length === 0) {
      detectedCoursesBadge.textContent = '0 Courses';
      courseSelectDropdown.innerHTML = '<option value="">-- No courses detected --</option>';
      if (courseInfoPill) courseInfoPill.style.display = 'none';
      return;
    }

    detectedCoursesBadge.textContent = `${detectedCourses.length} Courses`;
    courseSelectDropdown.innerHTML = `
      <option value="">-- Choose detected course (${detectedCourses.length}) --</option>
      ${detectedCourses.map(c => `
        <option value="${escapeHtml(c.code)}">
          ${escapeHtml(c.code)}: ${escapeHtml(c.title)} (p.${c.start_page}${c.end_page > c.start_page ? '-' + c.end_page : ''})
        </option>
      `).join('')}
    `;
  }

  async function triggerCourseDownload(courseQuery) {
    if (!courseQuery || !courseQuery.trim()) {
      showExtractorStatus('Please enter a course code (e.g. 24CS101) or course title.', 'error');
      return;
    }

    const cleanQuery = courseQuery.trim();
    showExtractorStatus(`Extracting isolated syllabus for "${escapeHtml(cleanQuery)}"...`, 'info');
    
    if (downloadCoursePdfBtn) {
      downloadCoursePdfBtn.disabled = true;
      downloadCoursePdfBtn.innerHTML = `<span>Extracting...</span>`;
    }

    try {
      const res = await fetch(`/api/courses/download?courseCode=${encodeURIComponent(cleanQuery)}`);

      if (!res.ok) {
        let errData = {};
        try {
          errData = await res.json();
        } catch (e) {}

        const errMsg = errData.error || `Course "${cleanQuery}" could not be isolated.`;
        if (errData.suggestions && errData.suggestions.length > 0) {
          const suggHtml = errData.suggestions.map(s => 
            `<a href="#" class="status-suggestion" data-code="${escapeHtml(s.code)}" title="Click to download this suggested course">${escapeHtml(s.code)}: ${escapeHtml(s.title)}</a>`
          ).join('<br>');
          showExtractorStatus(`${errMsg}<br><strong>Did you mean:</strong><br>${suggHtml}`, 'error');
          attachSuggestionHandlers();
        } else {
          showExtractorStatus(errMsg, 'error');
        }
        showToast(errMsg, 'error');
        return;
      }

      // Read PDF blob
      const blob = await res.blob();
      const contentDisp = res.headers.get('Content-Disposition') || '';
      let filename = `${cleanQuery}_Syllabus.pdf`;
      const fnMatch = contentDisp.match(/filename="?([^";]+)"?/);
      if (fnMatch && fnMatch[1]) {
        filename = fnMatch[1].trim();
      }

      // Trigger browser download
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

      showExtractorStatus(`✓ Standalone PDF <strong>${escapeHtml(filename)}</strong> downloaded (${(blob.size / 1024).toFixed(1)} KB)`, 'success');
      showToast(`Downloaded ${filename} successfully!`, 'success');
    } catch (err) {
      showExtractorStatus(err.message || 'Error occurred while extracting course PDF.', 'error');
      showToast(err.message || 'Extraction failed', 'error');
    } finally {
      if (downloadCoursePdfBtn) {
        downloadCoursePdfBtn.disabled = false;
        downloadCoursePdfBtn.innerHTML = `
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
          <span>Download Course PDF</span>
        `;
      }
    }
  }

  function showExtractorStatus(html, type = 'info') {
    if (!extractorStatusMsg) return;
    extractorStatusMsg.innerHTML = html;
    extractorStatusMsg.className = `extractor-status-msg ${type}`;
    extractorStatusMsg.style.display = 'block';
  }

  function attachSuggestionHandlers() {
    if (!extractorStatusMsg) return;
    extractorStatusMsg.querySelectorAll('.status-suggestion').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const code = link.getAttribute('data-code');
        if (courseSearchInput) courseSearchInput.value = code;
        if (courseSelectDropdown) courseSelectDropdown.value = code;
        triggerCourseDownload(code);
      });
    });
  }

  // Strict Course Download Verification:
  // ONLY returns a course code if the USER specifically requested that exact course in their prompt,
  // the course strictly exists in this document, and the bot did NOT report that it's absent.
  function getStrictRequestedCourse(userQuery, botText) {
    if (!userQuery || !userQuery.trim()) return null;

    const lowerBot = (botText || '').toLowerCase();
    // If the bot clearly states the course is absent / not found / not present / different regulation:
    if (
      lowerBot.includes('not present') ||
      lowerBot.includes('not found') ||
      lowerBot.includes('does not exist') ||
      lowerBot.includes('is not available') ||
      lowerBot.includes('different regulation') ||
      lowerBot.includes('could not find')
    ) {
      return null;
    }

    // Match course code pattern in the USER's prompt ONLY (never from bot's incidental text)
    const regex = /\b(?:[0-9]{2}[A-Z]{2,5}[0-9]{2,4}[A-Z]?|[A-Z]{2,5}[0-9]{3,5}[A-Z]?|[0-9]{2}[A-Z]{1,3}-[0-9]{3,4})\b/gi;
    const userCodes = userQuery.match(regex) || [];

    for (const rawCode of userCodes) {
      const upper = rawCode.toUpperCase();
      // Must strictly exist in detectedCourses for this uploaded document
      const matched = detectedCourses.find(c => c.code === upper);
      if (matched) {
        return matched.code;
      }
    }

    // Match by exact course title in user's prompt
    const cleanUserQuery = userQuery.trim().toLowerCase();
    if (cleanUserQuery.length > 5) {
      const matchedByTitle = detectedCourses.find(c => 
        c.title.toLowerCase() === cleanUserQuery ||
        (cleanUserQuery.includes(c.title.toLowerCase()) && c.title.length > 6)
      );
      if (matchedByTitle) {
        return matchedByTitle.code;
      }
    }

    return null;
  }

  function openInspectModal() {
    if (!currentDoc) {
      showToast('No active document to inspect', 'info');
      return;
    }
    inspectModalTitle.textContent = currentDoc.filename;
    inspectModalStats.textContent = `${currentDoc.pageCount} Pages • ${currentDoc.wordCount.toLocaleString()} Words • ${currentDoc.sizeFormatted}`;
    docTextPreview.textContent = currentDoc.preview ? currentDoc.preview + '\n\n... (full document indexed in memory) ...' : 'No preview available.';
    inspectDocModal.style.display = 'flex';
  }

  // =========================================================
  // SEND MESSAGE & REAL-TIME STREAMING
  // =========================================================
  async function handleSendMessage(e, customPrompt = null) {
    if (e) e.preventDefault();
    if (isGenerating) return;

    const query = (customPrompt !== null ? customPrompt : messageInput.value).trim();
    if (!query) return;

    if (!currentDoc) {
      showToast('Please upload or select a document first!', 'error');
      return;
    }

    const apiKey = getApiKey();
    messageInput.value = '';
    messageInput.style.height = 'auto';

    // Hide welcome screen
    welcomeContainer.style.display = 'none';

    // Append User Message to DOM
    const userTimestamp = Date.now();
    renderUserMessageDOM(query, userTimestamp);

    // Save to current session
    const session = getCurrentSession();
    session.messages.push({
      sender: 'user',
      text: query,
      timestamp: userTimestamp
    });

    // Auto-title conversation from first user question
    if (session.title === 'New Chat') {
      session.title = query.length > 28 ? query.slice(0, 28) + '...' : query;
    }
    session.updatedAt = Date.now();
    saveSessions();
    renderHistoryList();

    // Set UI to streaming state
    isGenerating = true;
    sendBtn.style.display = 'none';
    stopBtn.style.display = 'flex';

    // Create live bot message bubble in DOM with blinking streaming cursor
    const botRow = document.createElement('div');
    botRow.className = 'message-row bot-row';
    botRow.innerHTML = `
      <div class="avatar-wrapper bot-avatar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="url(#bot-grad)"/>
          <defs>
            <linearGradient id="bot-grad" x1="2" y1="2" x2="22" y2="22">
              <stop stop-color="#2563EB"/>
              <stop offset="1" stop-color="#38BDF8"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div class="bubble-content">
        <div class="message-bubble"><span class="streaming-cursor"></span></div>
        <div class="bubble-meta">
          <span class="meta-source-pill">
            📚 ${escapeHtml(currentDoc.filename)}
          </span>
          <span class="msg-time">${formatClockTime(Date.now())}</span>
        </div>
      </div>
    `;

    messagesContainer.appendChild(botRow);
    const bubbleTextEl = botRow.querySelector('.message-bubble');
    const bubbleContentEl = botRow.querySelector('.bubble-content');
    autoScrollToBottom(true);

    currentAbortController = new AbortController();
    let accumulatedText = '';
    let docNameResult = currentDoc.filename;
    let wasAborted = false;

    try {
      // Build history payload for multi-turn context
      const chatHistoryPayload = session.messages.slice(-6).map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        content: m.text
      }));

      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          apiKey: apiKey || '',
          model: 'gemini-3.8-flash',
          language: 'en',
          chatHistory: chatHistoryPayload
        }),
        signal: currentAbortController.signal
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}: Failed to generate answer`);
      }

      // Read SSE Stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep last incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);
            if (data.error) {
              throw new Error(data.error);
            }
            if (data.text) {
              accumulatedText += data.text;
              bubbleTextEl.innerHTML = formatBotResponse(accumulatedText) + '<span class="streaming-cursor"></span>';
              autoScrollToBottom();
            }
            if (data.documentName) {
              docNameResult = data.documentName;
            }
          } catch (e) {
            if (e.name === 'AbortError') throw e;
          }
        }
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        wasAborted = true;
      } else {
        accumulatedText = `⚠️ **Error:** ${err.message}\n\n*Tip: Check that your API key is configured by clicking the "API Key" button above.*`;
        bubbleTextEl.innerHTML = formatBotResponse(accumulatedText);
        showToast(err.message, 'error');
      }
    } finally {
      // Remove streaming cursor and finalize
      if (wasAborted) {
        bubbleTextEl.innerHTML = formatBotResponse(accumulatedText) + '<br><span class="stopped-pill">⏹️ Stopped generating</span>';
      } else {
        bubbleTextEl.innerHTML = formatBotResponse(accumulatedText);
      }

      const botTimestamp = Date.now();
      const sanitizedText = cleanLatexToPlainText(accumulatedText);
      attachBotActions(botRow, sanitizedText, docNameResult, botTimestamp, query);

      // Save to session in localStorage
      if (sanitizedText.trim().length > 0) {
        session.messages.push({
          sender: 'bot',
          text: sanitizedText,
          meta: { documentName: docNameResult, stopped: wasAborted },
          timestamp: botTimestamp
        });
        session.updatedAt = Date.now();
        saveSessions();
        renderHistoryList();
      }

      // Reset state
      isGenerating = false;
      currentAbortController = null;
      stopBtn.style.display = 'none';
      sendBtn.style.display = 'flex';
      autoScrollToBottom(true);
      messageInput.focus();
    }
  }

  // Render a User message in the DOM
  function renderUserMessageDOM(text, timestamp) {
    const row = document.createElement('div');
    row.className = 'message-row user-row';
    row.innerHTML = `
      <div class="avatar-wrapper user-avatar">You</div>
      <div class="bubble-content">
        <div class="message-bubble">${escapeHtml(text)}</div>
        <span class="msg-time">${formatClockTime(timestamp)}</span>
      </div>
    `;
    messagesContainer.appendChild(row);
  }

  // Render a Bot message in the DOM (used when loading existing chats)
  function renderBotMessageDOM(text, meta = {}, timestamp, query = '') {
    const row = document.createElement('div');
    row.className = 'message-row bot-row';
    const parsedHtml = formatBotResponse(text);
    const stoppedNotice = meta.stopped ? '<br><span class="stopped-pill">⏹️ Stopped generating</span>' : '';

    row.innerHTML = `
      <div class="avatar-wrapper bot-avatar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="url(#bot-grad)"/>
        </svg>
      </div>
      <div class="bubble-content">
        <div class="message-bubble">${parsedHtml}${stoppedNotice}</div>
        <div class="bubble-meta">
          <span class="meta-source-pill">
            📚 ${meta.documentName ? escapeHtml(meta.documentName) : 'Document-Grounded'}
          </span>
          <span class="msg-time">${formatClockTime(timestamp)}</span>
          <div class="meta-actions">
            <button class="action-icon-btn copy-btn" title="Copy response">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
            </button>
            <button class="action-icon-btn speak-btn" title="Read Aloud">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/>
              </svg>
            </button>
            ${query ? `
            <button class="action-icon-btn regen-btn" title="Regenerate answer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </button>` : ''}
          </div>
        </div>
      </div>
    `;

    // Strict download button: ONLY if user specifically requested this exact verified course
    const strictCourseCode = getStrictRequestedCourse(query, text);
    if (strictCourseCode) {
      const bubbleContent = row.querySelector('.bubble-content');
      const downloadActionsRow = document.createElement('div');
      downloadActionsRow.className = 'course-downloads-row';
      downloadActionsRow.style.marginTop = '8px';
      downloadActionsRow.innerHTML = `
        <button type="button" class="course-download-pill" data-code="${escapeHtml(strictCourseCode)}" title="Download standalone syllabus PDF for ${escapeHtml(strictCourseCode)}">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
          <span>Download ${escapeHtml(strictCourseCode)} Syllabus PDF</span>
        </button>
      `;

      downloadActionsRow.querySelector('.course-download-pill').addEventListener('click', () => {
        if (courseSearchInput) courseSearchInput.value = strictCourseCode;
        triggerCourseDownload(strictCourseCode);
      });

      bubbleContent.appendChild(downloadActionsRow);
    }

    attachBotEventHandlers(row, text, query);
    messagesContainer.appendChild(row);
  }

  // Attach action bar & suggested chips to a completed streaming bot row
  function attachBotActions(row, text, docName, timestamp, originalQuery) {
    const bubbleContent = row.querySelector('.bubble-content');
    let metaEl = row.querySelector('.bubble-meta');
    
    if (!metaEl) {
      metaEl = document.createElement('div');
      metaEl.className = 'bubble-meta';
      bubbleContent.appendChild(metaEl);
    }

    metaEl.innerHTML = `
      <span class="meta-source-pill">
        📚 ${docName ? escapeHtml(docName) : 'Document-Grounded'}
      </span>
      <span class="msg-time">${formatClockTime(timestamp)}</span>
      <div class="meta-actions">
        <button class="action-icon-btn copy-btn" title="Copy response">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
          </svg>
        </button>
        <button class="action-icon-btn speak-btn" title="Read Aloud">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/>
          </svg>
        </button>
        ${originalQuery ? `
        <button class="action-icon-btn regen-btn" title="Regenerate answer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </button>` : ''}
      </div>
    `;

    // Strict download button: ONLY if user specifically requested this exact verified course
    const strictCourseCode = getStrictRequestedCourse(originalQuery, text);
    if (strictCourseCode) {
      const downloadActionsRow = document.createElement('div');
      downloadActionsRow.className = 'course-downloads-row';
      downloadActionsRow.style.marginTop = '8px';
      downloadActionsRow.innerHTML = `
        <button type="button" class="course-download-pill" data-code="${escapeHtml(strictCourseCode)}" title="Download standalone syllabus PDF for ${escapeHtml(strictCourseCode)}">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
          <span>Download ${escapeHtml(strictCourseCode)} Syllabus PDF</span>
        </button>
      `;

      downloadActionsRow.querySelector('.course-download-pill').addEventListener('click', () => {
        if (courseSearchInput) courseSearchInput.value = strictCourseCode;
        triggerCourseDownload(strictCourseCode);
      });

      bubbleContent.appendChild(downloadActionsRow);
    }

    attachBotEventHandlers(row, text, originalQuery);

    // Dynamic suggested follow-up chips
    const suggestions = extractSuggestedPrompts(text, originalQuery);
    if (suggestions.length > 0) {
      const suggestRow = document.createElement('div');
      suggestRow.className = 'bot-suggested-prompts';
      suggestRow.innerHTML = suggestions.map(s => `
        <button type="button" class="bot-suggested-chip" data-prompt="${escapeHtml(s)}">
          💡 ${escapeHtml(s)}
        </button>
      `).join('');

      suggestRow.querySelectorAll('.bot-suggested-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const p = btn.getAttribute('data-prompt');
          triggerPromptDirectly(p);
        });
      });

      bubbleContent.appendChild(suggestRow);
      autoScrollToBottom();
    }
  }

  function attachBotEventHandlers(row, text, originalQuery) {
    const copyBtn = row.querySelector('.copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(text).then(() => {
          showToast('Copied to clipboard!', 'success');
        });
      });
    }

    const speakBtn = row.querySelector('.speak-btn');
    if (speakBtn) {
      speakBtn.addEventListener('click', () => {
        speakText(text);
      });
    }

    const regenBtn = row.querySelector('.regen-btn');
    if (regenBtn && originalQuery) {
      regenBtn.addEventListener('click', () => {
        if (isGenerating) return;
        // Remove current bot message and re-run original query
        const session = getCurrentSession();
        if (session) {
          // Remove this bot message from session
          const lastIdx = session.messages.findIndex(m => m.sender === 'bot' && m.text === text);
          if (lastIdx !== -1) {
            session.messages.splice(lastIdx, 1);
          }
        }
        row.remove();
        triggerPromptDirectly(originalQuery);
      });
    }
  }

  // Extract smart follow-up suggestions from the response
  function extractSuggestedPrompts(botText, originalQuery = '') {
    const suggestions = [];
    const lowerText = botText.toLowerCase();

    // Only suggest course-specific questions if user asked for a valid course and it was verified
    const strictCode = getStrictRequestedCourse(originalQuery, botText);
    if (strictCode) {
      if (!originalQuery.toLowerCase().includes('lab')) {
        suggestions.push(`What is the laboratory syllabus for ${strictCode}?`);
      }
      if (!originalQuery.toLowerCase().includes('unit')) {
        suggestions.push(`Explain the units and topics for ${strictCode}`);
      }
      if (!originalQuery.toLowerCase().includes('textbook') && !originalQuery.toLowerCase().includes('author')) {
        suggestions.push(`What are the recommended textbooks for ${strictCode}?`);
      }
    }

    // Check for semester mentions
    if (lowerText.includes('semester 1') || lowerText.includes('first semester')) {
      if (!suggestions.some(s => s.includes('Semester 2'))) {
        suggestions.push('What subjects are in Semester 2?');
      }
    } else if (lowerText.includes('semester 2')) {
      if (!suggestions.some(s => s.includes('Semester 3'))) {
        suggestions.push('What subjects are in Semester 3?');
      }
    }

    // General follow-ups if few
    if (suggestions.length === 0) {
      if (!lowerText.includes('credit')) {
        suggestions.push('What is the total credit distribution?');
      }
      if (!lowerText.includes('elective')) {
        suggestions.push('List the professional electives in this syllabus.');
      }
    }

    return suggestions.slice(0, 3);
  }

  // Strip any accidental LaTeX/Math code into clean normal plain text
  function cleanLatexToPlainText(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let cleaned = raw;

    // 1. Un-nest \text{...}, \mathrm{...}, \mathbf{...}, \mathit{...}, \textbf{...}
    let prev = '';
    while (prev !== cleaned) {
      prev = cleaned;
      cleaned = cleaned.replace(/\\(?:text|mathrm|mathbf|mathit|textbf|bm)\{([^{}]+)\}/g, '$1');
    }

    // 2. Common math symbols to standard readable characters
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

    // 3. Fractions: \frac{a}{b} -> a/b
    cleaned = cleaned.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2');

    // 4. Superscripts common in course titles like $I^2$ -> I² or I^2
    cleaned = cleaned.replace(/\$I\^2\$/g, 'I²');
    cleaned = cleaned.replace(/I\^2/g, 'I²');

    // 5. Remove block math $$...$$ and inline math $...$
    cleaned = cleaned.replace(/\$\$([^$]+)\$\$/g, '$1');
    cleaned = cleaned.replace(/\$([^$\n]+)\$/g, '$1');

    // 6. Clean any lingering backslash LaTeX commands
    cleaned = cleaned.replace(/\\[,;!]/g, ' ');
    cleaned = cleaned.replace(/\\(?:quad|qquad)/g, '  ');
    cleaned = cleaned.replace(/\\(?:text|mathrm|mathbf)\b/g, '');

    return cleaned;
  }

  // Format markdown & citations
  function formatBotResponse(text) {
    const cleanText = cleanLatexToPlainText(text);
    if (typeof marked !== 'undefined') {
      let formatted = marked.parse(cleanText);
      formatted = formatted.replace(/\[Page\s*([^\]]+)\]/gi, '<span class="citation-tag">Page $1</span>');
      return formatted;
    }
    return escapeHtml(cleanText).replace(/\n/g, '<br>');
  }

  // Text-to-speech
  function speakText(text) {
    if (!('speechSynthesis' in window)) {
      showToast('Text-to-speech is not supported in this browser.', 'info');
      return;
    }
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      return;
    }
    const cleanText = text.replace(/[*#`_\[\]]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    window.speechSynthesis.speak(utterance);
  }

  // Auto-scroll to bottom smoothly
  function autoScrollToBottom(force = false) {
    if (!messagesContainer) return;
    const isNearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 220;
    if (force || isNearBottom) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  // =========================================================
  // API KEY MANAGEMENT
  // =========================================================
  function getApiKey() {
    return localStorage.getItem('gemini_api_key') || '';
  }

  function loadStoredApiKey() {
    const key = getApiKey();
    if (key) {
      apiKeyInput.value = key;
      updateApiKeyStatus(true, 'Configured locally');
    }
  }

  function updateApiKeyStatus(isConfigured, tooltip) {
    if (isConfigured) {
      apiKeyStatusDot.classList.add('configured');
      apiKeyBtn.title = tooltip || 'API Key is active';
    } else {
      apiKeyStatusDot.classList.remove('configured');
      apiKeyBtn.title = 'Configure API Key';
    }
  }

  async function handleTestApiKey() {
    const key = apiKeyInput.value.trim();
    if (!key) {
      showValidationMessage('Please type or paste an API key first.', false);
      return;
    }

    testKeyBtn.disabled = true;
    testKeyBtn.textContent = 'Testing...';

    try {
      const res = await fetch('/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key })
      });
      const data = await res.json();

      if (data.valid) {
        showValidationMessage('✅ API Key is valid and connected successfully.', true);
      } else {
        showValidationMessage(`❌ Invalid Key: ${data.error}`, false);
      }
    } catch (err) {
      showValidationMessage(`❌ Connection error: ${err.message}`, false);
    } finally {
      testKeyBtn.disabled = false;
      testKeyBtn.textContent = 'Test Connection';
    }
  }

  function handleSaveApiKey() {
    const key = apiKeyInput.value.trim();
    if (!key) {
      localStorage.removeItem('gemini_api_key');
      updateApiKeyStatus(false, 'Not configured');
      showToast('API Key removed', 'info');
      apiKeyModal.style.display = 'none';
      return;
    }

    localStorage.setItem('gemini_api_key', key);
    updateApiKeyStatus(true, 'Configured locally');
    showToast('API Key saved successfully!', 'success');
    apiKeyModal.style.display = 'none';
  }

  function showValidationMessage(msg, isSuccess) {
    keyValidationResult.style.display = 'block';
    keyValidationResult.className = `validation-message ${isSuccess ? 'success' : 'error'}`;
    keyValidationResult.textContent = msg;
  }

  // =========================================================
  // UTILITIES
  // =========================================================
  function formatClockTime(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
  }

  function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Just now';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function escapeHtml(string) {
    const entityMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return String(string).replace(/[&<>"']/g, s => entityMap[s]);
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
    const container = document.getElementById('toastContainer');
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
});
