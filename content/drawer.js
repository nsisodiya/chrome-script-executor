// Content script to render the floating badge and slide-out script runner drawer

(function() {
  if (window.chromeScriptExecutorDrawerLoaded) return;
  window.chromeScriptExecutorDrawerLoaded = true;

  // DOM references within the shadow DOM
  let shadowRoot = null;
  let drawerPanel = null;
  let floatingBadge = null;
  let searchInput = null;
  let recommendedList = null;
  let allList = null;
  let toastEl = null;

  // State
  let allScripts = {};
  let currentSearch = '';

  init();

  async function init() {
    // 1. Fetch settings and scripts
    const data = await chrome.storage.local.get(['scripts', 'settings']);
    allScripts = data.scripts || {};
    const settings = data.settings || { showFloatingButton: true };

    // 2. Create the Shadow DOM elements
    createDOM(settings.showFloatingButton);

    // 3. Populate scripts
    renderScripts();

    // 4. Register listeners
    setupListeners();
  }

  function createDOM(showBadge) {
    const host = document.createElement('div');
    host.id = 'chrome-script-executor-drawer-host';
    host.style.position = 'fixed';
    host.style.top = '0';
    host.style.right = '0';
    host.style.width = '0';
    host.style.height = '0';
    host.style.zIndex = '999999990';
    host.style.overflow = 'visible';
    document.body.appendChild(host);

    shadowRoot = host.attachShadow({ mode: 'closed' });

    // Link web-accessible CSS file
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('content/drawer.css');
    shadowRoot.appendChild(link);

    // Create Floating Badge
    floatingBadge = document.createElement('div');
    floatingBadge.className = `floating-badge ${showBadge ? '' : 'hidden'}`;
    floatingBadge.innerHTML = '⚡';
    floatingBadge.title = 'Open Script Executor (Alt+Shift+S)';
    shadowRoot.appendChild(floatingBadge);

    // Create Drawer Panel
    drawerPanel = document.createElement('div');
    drawerPanel.className = 'drawer-panel';
    drawerPanel.innerHTML = `
      <div class="drawer-header">
        <span class="drawer-title">⚡ Script Executor</span>
        <button class="close-btn" id="drawer-close">&times;</button>
      </div>
      <div class="search-container">
        <input type="text" class="search-input" id="drawer-search" placeholder="Search scripts by title or origin...">
      </div>
      <div class="drawer-content">
        <div id="recommended-section">
          <h4 class="section-title">
            <span class="section-title-icon">●</span> Recommended for this page
          </h4>
          <div class="script-list" id="recommended-list"></div>
        </div>
        
        <div id="all-section" style="margin-top: 10px;">
          <h4 class="section-title">All Saved Scripts</h4>
          <div class="script-list" id="all-list"></div>
        </div>
      </div>
      <div class="drawer-footer">
        <span>Press <kbd style="background: rgba(255,255,255,0.1); padding: 2px 4px; border-radius: 4px;">Alt+Shift+S</kbd> to toggle</span>
        <label class="settings-label" id="badge-toggle-label">
          <input type="checkbox" id="badge-toggle-checkbox" ${showBadge ? 'checked' : ''}>
          Show badge
        </label>
      </div>
      <div class="drawer-toast" id="drawer-toast-el"></div>
    `;
    shadowRoot.appendChild(drawerPanel);

    // Get elements
    searchInput = shadowRoot.getElementById('drawer-search');
    recommendedList = shadowRoot.getElementById('recommended-list');
    allList = shadowRoot.getElementById('all-list');
    toastEl = shadowRoot.getElementById('drawer-toast-el');
  }

  function setupListeners() {
    // Floating badge click
    floatingBadge.addEventListener('click', toggleDrawer);

    // Close button click
    shadowRoot.getElementById('drawer-close').addEventListener('click', closeDrawer);

    // Search input
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value.toLowerCase().trim();
      renderScripts();
    });

    // Badge toggle checkbox
    const checkbox = shadowRoot.getElementById('badge-toggle-checkbox');
    checkbox.addEventListener('change', async (e) => {
      const showBadge = e.target.checked;
      if (showBadge) {
        floatingBadge.classList.remove('hidden');
      } else {
        floatingBadge.classList.add('hidden');
      }
      
      const { settings = {} } = await chrome.storage.local.get('settings');
      settings.showFloatingButton = showBadge;
      await chrome.storage.local.set({ settings });
    });

    // Toggle via Keyboard shortcut (Alt+Shift+S)
    window.addEventListener('keydown', (e) => {
      if (e.altKey && e.shiftKey && e.code === 'KeyS') {
        e.preventDefault();
        toggleDrawer();
      }
    });

    // Listen to storage changes to update list automatically
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        if (changes.scripts) {
          allScripts = changes.scripts.newValue || {};
          renderScripts();
        }
        if (changes.settings) {
          const showBadge = changes.settings.newValue?.showFloatingButton !== false;
          checkbox.checked = showBadge;
          if (showBadge) {
            floatingBadge.classList.remove('hidden');
          } else {
            floatingBadge.classList.add('hidden');
          }
        }
      }
    });
  }

  function toggleDrawer() {
    if (drawerPanel.classList.contains('open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  }

  function openDrawer() {
    drawerPanel.classList.add('open');
    searchInput.focus();
  }

  function closeDrawer() {
    drawerPanel.classList.remove('open');
  }

  function renderScripts() {
    // Clear lists
    recommendedList.innerHTML = '';
    allList.innerHTML = '';

    const currentUrl = window.location.href;
    const scriptsArray = Object.values(allScripts);

    let recommendedCount = 0;
    let allCount = 0;

    // Filter and sort scripts
    scriptsArray
      .filter(script => {
        if (!currentSearch) return true;
        return (
          script.title.toLowerCase().includes(currentSearch) ||
          script.sourceOrigin.toLowerCase().includes(currentSearch)
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .forEach(script => {
        const matches = urlMatchesPattern(currentUrl, script.targetUrlPattern);
        const card = createScriptCard(script, matches);

        if (matches) {
          recommendedList.appendChild(card);
          recommendedCount++;
        } else {
          allList.appendChild(card);
          allCount++;
        }
      });

    // Toggle sections visibility
    const recSection = shadowRoot.getElementById('recommended-section');
    if (recommendedCount === 0) {
      if (currentSearch) {
        recSection.style.display = 'none';
      } else {
        recSection.style.display = 'block';
        recommendedList.innerHTML = '<div class="no-scripts">No matching scripts for this site.</div>';
      }
    } else {
      recSection.style.display = 'block';
    }

    if (allCount === 0 && recommendedCount === 0) {
      allList.innerHTML = '<div class="no-scripts">No scripts found. Create or capture some!</div>';
    }
  }

  function createScriptCard(script, isRecommended) {
    const card = document.createElement('div');
    card.className = `script-card ${isRecommended ? 'recommended' : ''}`;
    
    // Format JSON snippet
    let jsonStr = '';
    try {
      jsonStr = JSON.stringify(script.data, null, 2);
    } catch (e) {
      jsonStr = String(script.data);
    }

    card.innerHTML = `
      <div class="card-header">
        <span class="card-title">${escapeHtml(script.title)}</span>
        ${isRecommended ? '<span class="badge badge-recommended">Match</span>' : ''}
        <span class="badge badge-context">${escapeHtml(script.context === 'main' ? 'Page' : 'Isolated')}</span>
      </div>
      <div class="card-meta">
        <span class="card-origin" title="Source: ${escapeHtml(script.sourceOrigin)}">from: ${escapeHtml(script.sourceOrigin)}</span>
      </div>
      <div class="card-details" id="details-${script.id}">
        <div class="card-details-label">Target URL Pattern</div>
        <div style="font-family:monospace; margin-bottom:8px; word-break:break-all; color:#94a3b8;">${escapeHtml(script.targetUrlPattern)}</div>
        
        <div class="card-details-label">Code</div>
        <pre class="card-details-code"><code>${escapeHtml(script.code)}</code></pre>
        
        <div class="card-details-label">JSON Context Data</div>
        <pre class="card-details-json"><code>${escapeHtml(jsonStr)}</code></pre>
      </div>
      <div class="card-actions">
        <button class="btn-icon btn-details" data-id="${script.id}">View Code</button>
        <button class="btn-icon btn-delete" data-id="${script.id}" title="Delete Script">🗑</button>
        <button class="btn-icon btn-run" data-id="${script.id}">▶ Run</button>
      </div>
    `;

    // Hook events inside card
    const detailsBtn = card.querySelector('.btn-details');
    const deleteBtn = card.querySelector('.btn-delete');
    const runBtn = card.querySelector('.btn-run');
    const detailsContainer = card.querySelector(`#details-${script.id}`);

    detailsBtn.addEventListener('click', () => {
      const isOpen = detailsContainer.classList.toggle('open');
      detailsBtn.textContent = isOpen ? 'Hide Code' : 'View Code';
    });

    deleteBtn.addEventListener('click', () => {
      if (confirm(`Are you sure you want to delete "${script.title}"?`)) {
        chrome.runtime.sendMessage({
          action: 'deleteScript',
          scriptId: script.id
        }, (response) => {
          if (response && response.success) {
            showToast('Script deleted successfully.', 'success');
          } else {
            showToast('Failed to delete script.', 'error');
          }
        });
      }
    });

    runBtn.addEventListener('click', () => {
      runBtn.disabled = true;
      runBtn.textContent = 'Running...';
      
      chrome.runtime.sendMessage({
        action: 'executeScript',
        scriptId: script.id
      }, (response) => {
        runBtn.disabled = false;
        runBtn.textContent = '▶ Run';
        
        if (response && response.success) {
          showToast(`"${script.title}" executed!`, 'success');
          // Close drawer after running so the user can see execution results
          setTimeout(closeDrawer, 500);
        } else {
          showToast(`Execution failed: ${response?.error || 'Unknown error'}`, 'error');
          console.error('[Chrome Script Executor] Execution error:', response?.error);
        }
      });
    });

    return card;
  }

  function showToast(message, type = 'success') {
    toastEl.textContent = message;
    toastEl.className = `drawer-toast active ${type}`;
    setTimeout(() => {
      toastEl.classList.remove('active');
    }, 3000);
  }

  function urlMatchesPattern(url, pattern) {
    if (pattern === '*' || pattern === '<all_urls>') return true;
    try {
      // Clean and build regex from glob pattern
      // E.g. *://*.google.com/* -> regex
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
})();
