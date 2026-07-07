// Background service worker for Chrome Script Executor
// Handle script execution and coordinate events securely

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'executeScript') {
    const tabId = message.tabId || sender.tab?.id;
    if (!tabId) {
      sendResponse({ success: false, error: 'No active tab context found.' });
      return true;
    }
    executeUserScript(message.scriptId, tabId)
      .then((result) => sendResponse({ success: true, result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }

  if (message.action === 'saveScript') {
    saveUserScript(message.scriptData)
      .then((scriptId) => sendResponse({ success: true, id: scriptId }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open
  }

  if (message.action === 'deleteScript') {
    deleteUserScript(message.scriptId)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Retrieve and execute a stored script on a specific tab
async function executeUserScript(scriptId, tabId) {
  // 1. Fetch script from storage
  const { scripts = {} } = await chrome.storage.local.get('scripts');
  const script = scripts[scriptId];
  if (!script) {
    throw new Error('Script not found in local storage.');
  }

  // 2. Validate tab existence and URL access
  const tab = await chrome.tabs.get(tabId);
  if (!tab) {
    throw new Error('Target tab does not exist.');
  }

  // 3. Inject the script into the tab
  const isMainWorld = script.context === 'main';

  // Inject using chrome.scripting.executeScript
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    world: isMainWorld ? 'MAIN' : 'ISOLATED',
    func: (scriptCode, jsonData, scriptTitle) => {
      console.log(`[Script Executor] Starting execution of "${scriptTitle}"...`);
      try {
        // Run code inside an IIFE wrapper with contextData
        const executor = new Function('contextData', `
          try {
            ${scriptCode}
          } catch (e) {
            console.error('[Script Executor] Script runtime error: ' + e.message, e);
            throw e;
          }
        `);
        executor(jsonData);
        console.log(`[Script Executor] Finished execution of "${scriptTitle}".`);
      } catch (err) {
        console.error(`[Script Executor] Injection compilation failed: ${err.message}`, err);
        throw err;
      }
    },
    args: [script.code, script.data, script.title]
  });

  return { title: script.title, context: script.context };
}

// Save a script to storage
async function saveUserScript(scriptData) {
  if (!scriptData.title || !scriptData.code) {
    throw new Error('Script title and code are required.');
  }

  const { scripts = {} } = await chrome.storage.local.get('scripts');
  
  const id = scriptData.id || `script_${Date.now()}`;
  
  // Format target URL pattern
  const targetPattern = scriptData.targetUrlPattern || '*';

  scripts[id] = {
    id,
    title: scriptData.title,
    code: scriptData.code,
    data: scriptData.data || {},
    targetUrlPattern: targetPattern,
    context: scriptData.context || 'isolated', // 'isolated' or 'main'
    sourceOrigin: scriptData.sourceOrigin || 'Manual Entry',
    createdAt: scriptData.createdAt || Date.now()
  };

  await chrome.storage.local.set({ scripts });

  // Visual confirmation - badge text flash
  chrome.action.setBadgeText({ text: 'NEW' });
  chrome.action.setBadgeBackgroundColor({ color: '#10B981' }); // Emerald Green
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
  }, 3000);

  return id;
}

// Delete a script from storage
async function deleteUserScript(scriptId) {
  const { scripts = {} } = await chrome.storage.local.get('scripts');
  if (scripts[scriptId]) {
    delete scripts[scriptId];
    await chrome.storage.local.set({ scripts });
  }
}
