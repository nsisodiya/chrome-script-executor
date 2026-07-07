// Content script to handle secure script capturing from pages
// Uses a Shadow DOM to isolate styles and block page script access to user actions

(function() {
  // Guard against multiple injections
  if (window.chromeScriptExecutorCaptureLoaded) return;
  window.chromeScriptExecutorCaptureLoaded = true;

  // Listen for the custom DOM event dispatched by the page
  window.addEventListener('chrome-script-executor:capture', (event) => {
    const detail = event.detail;
    if (!detail) return;

    // Extract details and validate
    const scriptTitle = detail.title || 'Untitled Script';
    const scriptCode = detail.code || '';
    const scriptData = detail.data || {};
    const targetUrlPattern = detail.targetUrlPattern || window.location.origin + '/*';
    const context = detail.context || 'isolated'; // Default to isolated

    if (!scriptCode) {
      console.warn('[Chrome Script Executor] Capture ignored: Script code is empty.');
      return;
    }

    createCaptureModal({
      title: scriptTitle,
      code: scriptCode,
      data: scriptData,
      targetUrlPattern,
      context,
      sourceOrigin: window.location.origin
    });
  });

  function createCaptureModal(scriptInfo) {
    // Check if modal already exists
    const existing = document.getElementById('chrome-script-executor-capture-host');
    if (existing) {
      existing.remove();
    }

    // Create host element
    const host = document.createElement('div');
    host.id = 'chrome-script-executor-capture-host';
    host.style.position = 'fixed';
    host.style.bottom = '20px';
    host.style.right = '20px';
    host.style.width = '380px';
    host.style.maxHeight = '85vh';
    host.style.zIndex = '999999999';
    host.style.overflow = 'visible';
    document.body.appendChild(host);

    // Create closed shadow root so parent window scripts cannot inspect/manipulate the approval buttons
    const shadow = host.attachShadow({ mode: 'closed' });

    // Styles for the capture modal
    const style = document.createElement('style');
    style.textContent = `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }

      .backdrop {
        background: rgba(15, 23, 42, 0.85);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.1);
        color: #f8fafc;
        display: flex;
        flex-direction: column;
        width: 100%;
        max-height: 80vh;
        overflow: hidden;
        transform: translateY(20px) scale(0.95);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      .backdrop.active {
        transform: translateY(0) scale(1);
        opacity: 1;
      }

      .header {
        padding: 16px;
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .header-title {
        font-size: 16px;
        font-weight: 700;
        background: linear-gradient(90deg, #818cf8, #c084fc);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .close-btn {
        background: none;
        border: none;
        color: #94a3b8;
        font-size: 18px;
        cursor: pointer;
        transition: color 0.2s;
        line-height: 1;
      }

      .close-btn:hover {
        color: #f1f5f9;
      }

      .content {
        padding: 16px;
        overflow-y: auto;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .info-text {
        font-size: 13px;
        color: #94a3b8;
        line-height: 1.4;
      }

      .source-badge {
        font-weight: 500;
        color: #a78bfa;
      }

      .field-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .field-label {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        color: #64748b;
        letter-spacing: 0.05em;
      }

      .input-text {
        background: rgba(30, 41, 59, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 8px 12px;
        color: #f8fafc;
        font-size: 13px;
        transition: border-color 0.2s;
        width: 100%;
      }

      .input-text:focus {
        border-color: #6366f1;
        outline: none;
      }

      .code-container {
        position: relative;
        background: #0f172a;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.05);
        padding: 8px;
        max-height: 120px;
        overflow-y: auto;
      }

      .code-preview {
        font-family: "Fira Code", "Courier New", Courier, monospace;
        font-size: 11px;
        color: #cbd5e1;
        white-space: pre-wrap;
        word-break: break-all;
        line-height: 1.5;
      }

      .json-container {
        position: relative;
        background: #0f172a;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.05);
        padding: 8px;
        max-height: 100px;
        overflow-y: auto;
      }

      .json-preview {
        font-family: "Fira Code", "Courier New", Courier, monospace;
        font-size: 11px;
        color: #38bdf8;
        white-space: pre-wrap;
        word-break: break-all;
      }

      .toggle-group {
        display: flex;
        background: rgba(30, 41, 59, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 2px;
      }

      .toggle-option {
        flex: 1;
        text-align: center;
        padding: 6px 0;
        font-size: 11px;
        font-weight: 600;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        color: #64748b;
      }

      .toggle-option.selected {
        background: #6366f1;
        color: #ffffff;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      .footer {
        padding: 16px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        gap: 12px;
        background: rgba(15, 23, 42, 0.4);
      }

      .btn {
        flex: 1;
        padding: 10px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        text-align: center;
        border: none;
      }

      .btn-cancel {
        background: rgba(255, 255, 255, 0.05);
        color: #cbd5e1;
        border: 1px solid rgba(255, 255, 255, 0.05);
      }

      .btn-cancel:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
      }

      .btn-confirm {
        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
      }

      .btn-confirm:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(79, 70, 229, 0.4);
      }

      .btn-confirm:active {
        transform: translateY(0);
      }

      .toast {
        background: #10b981;
        color: #ffffff;
        border-radius: 8px;
        padding: 12px 16px;
        font-size: 13px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
        transform: translateY(20px);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
      }

      .toast.active {
        transform: translateY(0);
        opacity: 1;
      }
    `;

    // Create elements
    const container = document.createElement('div');
    container.className = 'backdrop';

    // JSON formatted string
    let jsonStr = '';
    try {
      jsonStr = typeof scriptInfo.data === 'string'
        ? JSON.stringify(JSON.parse(scriptInfo.data), null, 2)
        : JSON.stringify(scriptInfo.data, null, 2);
    } catch (e) {
      jsonStr = String(scriptInfo.data);
    }

    container.innerHTML = `
      <div class="header">
        <span class="header-title">Capture User Script</span>
        <button class="close-btn" id="cls-btn">&times;</button>
      </div>
      <div class="content">
        <p class="info-text">
          This website wants to share a script with you. Verify details below before saving. Captured from <span class="source-badge">${scriptInfo.sourceOrigin}</span>.
        </p>

        <div class="field-group">
          <label class="field-label">Script Title</label>
          <input type="text" class="input-text" id="script-title" value="${escapeHtml(scriptInfo.title)}">
        </div>

        <div class="field-group">
          <label class="field-label">Target URL Pattern</label>
          <input type="text" class="input-text" id="target-pattern" value="${escapeHtml(scriptInfo.targetUrlPattern)}">
        </div>

        <div class="field-group">
          <label class="field-label">Execution Context</label>
          <div class="toggle-group">
            <div class="toggle-option ${scriptInfo.context === 'isolated' ? 'selected' : ''}" id="ctx-isolated" data-value="isolated">Isolated (Secure)</div>
            <div class="toggle-option ${scriptInfo.context === 'main' ? 'selected' : ''}" id="ctx-main" data-value="main">Page (Advanced)</div>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">Code Preview</label>
          <div class="code-container">
            <pre class="code-preview" id="code-preview-el"><code>${escapeHtml(scriptInfo.code)}</code></pre>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">JSON Data Payload</label>
          <div class="json-container">
            <pre class="json-preview" id="json-preview-el"><code>${escapeHtml(jsonStr)}</code></pre>
          </div>
        </div>
      </div>
      <div class="footer">
        <button class="btn btn-cancel" id="btn-decline">Decline</button>
        <button class="btn btn-confirm" id="btn-save">Approve & Save</button>
      </div>
      <div class="toast" id="toast-el">
        ✓ Script saved successfully!
      </div>
    `;

    shadow.appendChild(style);
    shadow.appendChild(container);

    // Setup interactions
    const clsBtn = shadow.getElementById('cls-btn');
    const declineBtn = shadow.getElementById('btn-decline');
    const saveBtn = shadow.getElementById('btn-save');
    const titleInput = shadow.getElementById('script-title');
    const patternInput = shadow.getElementById('target-pattern');
    const ctxIsolated = shadow.getElementById('ctx-isolated');
    const ctxMain = shadow.getElementById('ctx-main');
    const toastEl = shadow.getElementById('toast-el');

    let selectedContext = scriptInfo.context;

    // Slide-in animation
    setTimeout(() => {
      container.classList.add('active');
    }, 50);

    const closeHandler = () => {
      container.classList.remove('active');
      setTimeout(() => {
        host.remove();
      }, 300);
    };

    clsBtn.addEventListener('click', closeHandler);
    declineBtn.addEventListener('click', closeHandler);

    ctxIsolated.addEventListener('click', () => {
      ctxIsolated.classList.add('selected');
      ctxMain.classList.remove('selected');
      selectedContext = 'isolated';
    });

    ctxMain.addEventListener('click', () => {
      ctxMain.classList.add('selected');
      ctxIsolated.classList.remove('selected');
      selectedContext = 'main';
    });

    saveBtn.addEventListener('click', async () => {
      const finalTitle = titleInput.value.trim() || 'Untitled Script';
      const finalPattern = patternInput.value.trim() || '*';
      
      let finalData = {};
      try {
        finalData = JSON.parse(jsonStr);
      } catch (e) {
        finalData = scriptInfo.data;
      }

      const scriptToSave = {
        title: finalTitle,
        code: scriptInfo.code,
        data: finalData,
        targetUrlPattern: finalPattern,
        context: selectedContext,
        sourceOrigin: scriptInfo.sourceOrigin
      };

      // Disable actions
      saveBtn.disabled = true;
      declineBtn.disabled = true;
      titleInput.disabled = true;
      patternInput.disabled = true;

      // Send to background service worker
      chrome.runtime.sendMessage({
        action: 'saveScript',
        scriptData: scriptToSave
      }, (response) => {
        if (response && response.success) {
          // Show toast
          toastEl.classList.add('active');
          setTimeout(() => {
            closeHandler();
          }, 1500);
        } else {
          console.error('[Chrome Script Executor] Save failed:', response?.error);
          alert('Failed to save script: ' + (response?.error || 'Unknown error'));
          saveBtn.disabled = false;
          declineBtn.disabled = false;
          titleInput.disabled = false;
          patternInput.disabled = false;
        }
      });
    });
  }

  function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
