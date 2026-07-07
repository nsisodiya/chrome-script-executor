// Popup JavaScript logic for Chrome Script Executor

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const viewDashboard = document.getElementById('view-dashboard');
  const viewEditor = document.getElementById('view-editor');
  const btnAddTab = document.getElementById('btn-add-tab');
  const btnEditorBack = document.getElementById('btn-editor-back');
  const btnEditorCancel = document.getElementById('btn-editor-cancel');
  const btnOpenSandbox = document.getElementById('btn-open-sandbox');
  
  const searchInput = document.getElementById('search-input');
  const listRecommended = document.getElementById('list-recommended');
  const listAll = document.getElementById('list-all');
  const sectionRecommended = document.getElementById('section-recommended');
  
  const editorForm = document.getElementById('editor-form');
  const editorTitle = document.getElementById('editor-title');
  const editScriptId = document.getElementById('edit-script-id');
  const scriptTitleInput = document.getElementById('script-title-input');
  const scriptPatternInput = document.getElementById('script-pattern-input');
  const scriptCodeInput = document.getElementById('script-code-input');
  const scriptDataInput = document.getElementById('script-data-input');
  const jsonValidationMsg = document.getElementById('json-validation-msg');
  const btnEditorSave = document.getElementById('btn-editor-save');
  
  const ctxIsolated = document.getElementById('toggle-context-isolated');
  const ctxMain = document.getElementById('toggle-context-main');
  
  const settingFloatingBadge = document.getElementById('setting-floating-badge');
  const toastEl = document.getElementById('popup-toast-el');

  // State
  let allScripts = {};
  let currentSearch = '';
  let activeTab = null;
  let selectedContext = 'isolated';

  // Initialize
  init();

  async function init() {
    // 1. Get current active tab to recommend matching scripts
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      activeTab = tab;
    } catch (e) {
      console.error('Failed to query active tab:', e);
    }

    // 2. Load stored settings and scripts
    const data = await chrome.storage.local.get(['scripts', 'settings']);
    allScripts = data.scripts || {};
    
    const settings = data.settings || { showFloatingButton: true };
    settingFloatingBadge.checked = settings.showFloatingButton !== false;

    // 3. Render lists
    renderScripts();

    // 4. Register event listeners
    setupListeners();
  }

  function setupListeners() {
    // Navigation
    btnAddTab.addEventListener('click', () => showEditor());
    btnEditorBack.addEventListener('click', () => showDashboard());
    btnEditorCancel.addEventListener('click', () => showDashboard());
    
    btnOpenSandbox.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('demo/demo.html') });
    });

    // Search
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value.toLowerCase().trim();
      renderScripts();
    });

    // Toggle context selector
    ctxIsolated.addEventListener('click', () => selectContext('isolated'));
    ctxMain.addEventListener('click', () => selectContext('main'));

    // JSON live validation
    scriptDataInput.addEventListener('input', validateJsonInput);

    // Save Form
    editorForm.addEventListener('submit', handleSaveScript);

    // Settings checkbox
    settingFloatingBadge.addEventListener('change', async (e) => {
      const showBadge = e.target.checked;
      const { settings = {} } = await chrome.storage.local.get('settings');
      settings.showFloatingButton = showBadge;
      await chrome.storage.local.set({ settings });
      showToast('Badge settings updated.');
    });

    // Storage listener (sync view changes instantly)
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.scripts) {
        allScripts = changes.scripts.newValue || {};
        renderScripts();
      }
    });
  }

  function showDashboard() {
    viewEditor.classList.remove('active');
    viewDashboard.classList.add('active');
    btnAddTab.style.display = 'block';
    
    // Clear editor fields
    editScriptId.value = '';
    editorForm.reset();
    selectContext('isolated');
    jsonValidationMsg.className = 'json-validation';
    jsonValidationMsg.textContent = '';
  }

  function showEditor(scriptToEdit = null) {
    viewDashboard.classList.remove('active');
    viewEditor.classList.add('active');
    btnAddTab.style.display = 'none';

    if (scriptToEdit) {
      editorTitle.textContent = 'Edit Script';
      editScriptId.value = scriptToEdit.id;
      scriptTitleInput.value = scriptToEdit.title;
      scriptPatternInput.value = scriptToEdit.targetUrlPattern;
      scriptCodeInput.value = scriptToEdit.code;
      
      let dataStr = '';
      if (scriptToEdit.data && Object.keys(scriptToEdit.data).length > 0) {
        try {
          dataStr = JSON.stringify(scriptToEdit.data, null, 2);
        } catch (e) {
          dataStr = String(scriptToEdit.data);
        }
      }
      scriptDataInput.value = dataStr;
      selectContext(scriptToEdit.context || 'isolated');
      validateJsonInput();
    } else {
      editorTitle.textContent = 'Create Script';
      editScriptId.value = '';
      scriptTitleInput.value = '';
      scriptPatternInput.value = '*';
      scriptCodeInput.value = '';
      scriptDataInput.value = '';
      selectContext('isolated');
      jsonValidationMsg.className = 'json-validation';
      jsonValidationMsg.textContent = '';
    }
  }

  function selectContext(context) {
    selectedContext = context;
    if (context === 'isolated') {
      ctxIsolated.classList.add('selected');
      ctxMain.classList.remove('selected');
    } else {
      ctxMain.classList.add('selected');
      ctxIsolated.classList.remove('selected');
    }
  }

  function validateJsonInput() {
    const val = scriptDataInput.value.trim();
    if (!val) {
      jsonValidationMsg.className = 'json-validation';
      jsonValidationMsg.textContent = '';
      btnEditorSave.disabled = false;
      return true;
    }

    try {
      JSON.parse(val);
      jsonValidationMsg.className = 'json-validation valid';
      jsonValidationMsg.textContent = '✓ Valid JSON';
      btnEditorSave.disabled = false;
      return true;
    } catch (e) {
      jsonValidationMsg.className = 'json-validation invalid';
      jsonValidationMsg.textContent = '✗ Invalid JSON: ' + e.message;
      btnEditorSave.disabled = true; // Block save if invalid
      return false;
    }
  }

  function renderScripts() {
    listRecommended.innerHTML = '';
    listAll.innerHTML = '';

    const currentUrl = activeTab?.url || '';
    const scriptsArray = Object.values(allScripts);

    // Check if the current page can run scripts (blocked on chrome://, chrome-extension://, chrome web store)
    const isSystemPage = currentUrl.startsWith('chrome://') || 
                         currentUrl.startsWith('chrome-extension://') || 
                         currentUrl.startsWith('https://chrome.google.com/webstore') ||
                         currentUrl.startsWith('https://chromewebstore.google.com');

    let recommendedCount = 0;
    let allCount = 0;

    scriptsArray
      .filter(script => {
        if (!currentSearch) return true;
        return (
          script.title.toLowerCase().includes(currentSearch) ||
          script.targetUrlPattern.toLowerCase().includes(currentSearch) ||
          script.sourceOrigin.toLowerCase().includes(currentSearch)
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .forEach(script => {
        const matches = !isSystemPage && urlMatchesPattern(currentUrl, script.targetUrlPattern);
        const card = createScriptCard(script, matches, isSystemPage);

        if (matches) {
          listRecommended.appendChild(card);
          recommendedCount++;
        } else {
          listAll.appendChild(card);
          allCount++;
        }
      });

    // UI Adjustments
    if (isSystemPage) {
      sectionRecommended.style.display = 'block';
      listRecommended.innerHTML = `
        <div class="no-scripts" style="border-color: var(--error-color); color: var(--text-secondary);">
          ⚠️ Scripts cannot execute on Chrome system/store pages.
        </div>
      `;
    } else if (recommendedCount === 0) {
      if (currentSearch) {
        sectionRecommended.style.display = 'none';
      } else {
        sectionRecommended.style.display = 'block';
        listRecommended.innerHTML = '<div class="no-scripts">No recommended scripts for this website.</div>';
      }
    } else {
      sectionRecommended.style.display = 'block';
    }

    if (allCount === 0 && recommendedCount === 0) {
      listAll.innerHTML = '<div class="no-scripts">No scripts found. Click "Add Script" to build one!</div>';
    }
  }

  function createScriptCard(script, isRecommended, isSystemPage) {
    const card = document.createElement('div');
    card.className = `script-card ${isRecommended ? 'recommended' : ''}`;

    card.innerHTML = `
      <div class="card-header">
        <span class="card-title" title="${escapeHtml(script.title)}">${escapeHtml(script.title)}</span>
        ${isRecommended ? '<span class="badge badge-recommended">Match</span>' : ''}
        <span class="badge badge-context">${escapeHtml(script.context === 'main' ? 'Page' : 'Isolated')}</span>
      </div>
      <div class="card-meta">
        <span style="max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="Pattern: ${escapeHtml(script.targetUrlPattern)}">
          pat: ${escapeHtml(script.targetUrlPattern)}
        </span>
        <span style="font-size: 10px; color: var(--text-muted);">from: ${escapeHtml(script.sourceOrigin)}</span>
      </div>
      <div class="card-actions">
        <button class="btn-icon btn-edit-card" data-id="${script.id}" title="Edit script">✏️</button>
        <button class="btn-icon btn-delete-card" data-id="${script.id}" title="Delete script">🗑️</button>
        <button class="btn-primary btn-run-script" data-id="${script.id}" ${isSystemPage ? 'disabled title="Blocked on system pages"' : ''}>
          Run on Page
        </button>
      </div>
    `;

    // Hook events
    card.querySelector('.btn-edit-card').addEventListener('click', () => {
      showEditor(script);
    });

    card.querySelector('.btn-delete-card').addEventListener('click', () => {
      if (confirm(`Delete script "${script.title}"?`)) {
        chrome.runtime.sendMessage({
          action: 'deleteScript',
          scriptId: script.id
        }, (response) => {
          if (response && response.success) {
            showToast('Script deleted successfully.');
          } else {
            showToast('Failed to delete script.', true);
          }
        });
      }
    });

    const runBtn = card.querySelector('.btn-run-script');
    if (!isSystemPage) {
      runBtn.addEventListener('click', () => {
        if (!activeTab?.id) {
          showToast('No active tab to execute on.', true);
          return;
        }

        runBtn.disabled = true;
        runBtn.textContent = 'Running...';

        chrome.runtime.sendMessage({
          action: 'executeScript',
          scriptId: script.id,
          tabId: activeTab.id
        }, (response) => {
          runBtn.disabled = false;
          runBtn.textContent = 'Run on Page';

          if (response && response.success) {
            showToast(`Executed "${script.title}" successfully.`);
            // Automatically close popup after execution to view changes
            setTimeout(() => {
              window.close();
            }, 1000);
          } else {
            showToast('Execution failed: ' + (response?.error || 'Unknown error'), true);
          }
        });
      });
    }

    return card;
  }

  async function handleSaveScript(e) {
    e.preventDefault();

    const title = scriptTitleInput.value.trim();
    const pattern = scriptPatternInput.value.trim();
    const code = scriptCodeInput.value.trim();
    const dataStr = scriptDataInput.value.trim();
    const editId = editScriptId.value;

    if (!title || !pattern || !code) {
      showToast('Please fill out all required fields.', true);
      return;
    }

    let parsedData = {};
    if (dataStr) {
      try {
        parsedData = JSON.parse(dataStr);
      } catch (err) {
        showToast('JSON data is invalid.', true);
        return;
      }
    }

    const scriptData = {
      title,
      targetUrlPattern: pattern,
      code,
      data: parsedData,
      context: selectedContext,
      sourceOrigin: editId ? allScripts[editId]?.sourceOrigin || 'Manual Edit' : 'Manual Entry'
    };

    if (editId) {
      scriptData.id = editId;
      scriptData.createdAt = allScripts[editId]?.createdAt || Date.now();
    }

    chrome.runtime.sendMessage({
      action: 'saveScript',
      scriptData
    }, (response) => {
      if (response && response.success) {
        showToast(editId ? 'Script updated.' : 'Script created.');
        showDashboard();
      } else {
        showToast('Save failed: ' + (response?.error || 'Unknown error'), true);
      }
    });
  }

  function showToast(message, isError = false) {
    toastEl.textContent = message;
    toastEl.className = `popup-toast active ${isError ? 'error' : ''}`;
    setTimeout(() => {
      toastEl.classList.remove('active');
    }, 2500);
  }

  function urlMatchesPattern(url, pattern) {
    if (pattern === '*' || pattern === '<all_urls>') return true;
    try {
      let escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
      let regexStr = '^' + escaped.replace(/\*/g, '.*') + '$';
      const regex = new RegExp(regexStr);
      return regex.test(url);
    } catch (e) {
      return url.includes(pattern.replace(/\*/g, ''));
    }
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
});
