// Interactive Sandbox script logic

document.addEventListener('DOMContentLoaded', () => {
  // Creator elements
  const tplAesthetics = document.getElementById('tpl-aesthetics');
  const tplLogger = document.getElementById('tpl-logger');
  const tplTable = document.getElementById('tpl-table');
  
  const form = document.getElementById('creator-form');
  const scriptTitle = document.getElementById('script-title');
  const scriptContext = document.getElementById('script-context');
  const scriptPattern = document.getElementById('script-pattern');
  const scriptCode = document.getElementById('script-code');
  const scriptJson = document.getElementById('script-json');
  const jsonErrorMsg = document.getElementById('json-error-msg');
  const btnShare = document.getElementById('btn-share-script');

  // Testbed elements
  const consoleOutput = document.getElementById('demo-console-output');
  const btnClearConsole = document.getElementById('btn-clear-console-el');

  // Template contents
  const templates = {
    aesthetics: {
      title: 'Modify Target Box Aesthetics',
      context: 'isolated',
      pattern: '*',
      code: `// Modify styling of target box
const box = document.getElementById('demo-target-box');
if (box) {
  box.style.background = contextData.gradient || 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
  box.style.borderColor = contextData.borderColor || '#34d399';
  box.style.borderRadius = contextData.borderRadius || '20px';
  box.style.transform = 'scale(1.02)';
  
  const text = box.querySelector('p');
  if (text) {
    text.textContent = 'Styled by injected script with data!';
    text.style.color = '#ffffff';
  }
  
  console.log('[Demo Script] Updated target box styling successfully!');
} else {
  console.error('[Demo Script] Target box #demo-target-box not found.');
}`,
      json: {
        gradient: 'linear-gradient(135deg, #818cf8 0%, #c084fc 100%)',
        borderColor: '#a78bfa',
        borderRadius: '24px'
      }
    },
    
    logger: {
      title: 'Render Message in Logger Console',
      context: 'isolated',
      pattern: '*',
      code: `// Grab target logger console
const consoleEl = document.getElementById('demo-console-output');
if (consoleEl) {
  // Clear placeholder if it's there
  const placeholder = consoleEl.querySelector('.console-placeholder');
  if (placeholder) placeholder.remove();

  const msgDiv = document.createElement('div');
  msgDiv.style.padding = '8px 12px';
  msgDiv.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
  msgDiv.style.animation = 'fadeIn 0.3s ease';
  
  const time = new Date().toLocaleTimeString();
  const levelColor = contextData.level === 'WARNING' ? '#f59e0b' : '#38bdf8';
  
  msgDiv.innerHTML = \`
    <span style="color: #64748b;">[\${time}]</span> 
    <span style="color: \${levelColor}; font-weight: bold;">[\${contextData.level}]</span> 
    <span style="color: #cbd5e1;">\${contextData.message}</span>
  \`;
  
  consoleEl.appendChild(msgDiv);
  consoleEl.scrollTop = consoleEl.scrollHeight;
  console.log('[Demo Script] Added custom logs to target output!');
} else {
  console.error('[Demo Script] Console container not found.');
}`,
      json: {
        level: 'WARNING',
        message: 'This is a warning log injected dynamically from a saved script!'
      }
    },
    
    table: {
      title: 'Highlight Premium Prices (> $100)',
      context: 'isolated',
      pattern: '*',
      code: `// Iterate over rows in the target table and highlight expensive items
const rows = document.querySelectorAll('#demo-table tbody tr');
let count = 0;
const threshold = contextData.thresholdPrice || 100;

rows.forEach(row => {
  const priceCell = row.cells[2];
  if (priceCell) {
    // Extract numerical price
    const price = parseFloat(priceCell.textContent.replace('$', ''));
    if (price > threshold) {
      row.style.backgroundColor = 'rgba(245, 158, 11, 0.12)';
      row.style.borderLeft = '3px solid #f59e0b';
      
      const badge = row.querySelector('.status-pill');
      if (badge) {
        badge.textContent = '★ Premium';
        badge.style.background = 'rgba(245, 158, 11, 0.25)';
        badge.style.color = '#fbbf24';
      }
      count++;
    } else {
      row.style.backgroundColor = '';
      row.style.borderLeft = '';
    }
  }
});

console.log(\`[Demo Script] Done! Highlighted \${count} items with price above $\${threshold}.\`);`,
      json: {
        thresholdPrice: 100
      }
    }
  };

  // Select templates
  tplAesthetics.addEventListener('click', () => loadTemplate('aesthetics'));
  tplLogger.addEventListener('click', () => loadTemplate('logger'));
  tplTable.addEventListener('click', () => loadTemplate('table'));

  // Live JSON validation
  scriptJson.addEventListener('input', validateJson);

  // Form submit (Share event)
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const title = scriptTitle.value.trim();
    const context = scriptContext.value;
    const pattern = scriptPattern.value.trim();
    const code = scriptCode.value.trim();
    const jsonText = scriptJson.value.trim();

    if (!title || !code || !pattern) return;

    let parsedJson = {};
    if (jsonText) {
      try {
        parsedJson = JSON.parse(jsonText);
      } catch (err) {
        validateJson();
        return;
      }
    }

    // Dispatch the custom event that the extension's content script listens to
    const captureEvent = new CustomEvent('chrome-script-executor:capture', {
      detail: {
        title,
        code,
        data: parsedJson,
        targetUrlPattern: pattern,
        context
      }
    });

    window.dispatchEvent(captureEvent);
  });

  // Clear testbed console logs
  btnClearConsole.addEventListener('click', () => {
    consoleOutput.innerHTML = '<div class="console-placeholder">Logs from executed scripts will render here...</div>';
  });

  function loadTemplate(key) {
    const tpl = templates[key];
    if (!tpl) return;

    scriptTitle.value = tpl.title;
    scriptContext.value = tpl.context;
    scriptPattern.value = tpl.pattern;
    scriptCode.value = tpl.code;
    scriptJson.value = JSON.stringify(tpl.json, null, 2);

    validateJson();
  }

  function validateJson() {
    const val = scriptJson.value.trim();
    if (!val) {
      jsonErrorMsg.style.display = 'none';
      btnShare.disabled = false;
      return;
    }

    try {
      JSON.parse(val);
      jsonErrorMsg.style.display = 'none';
      btnShare.disabled = false;
    } catch (e) {
      jsonErrorMsg.style.display = 'block';
      jsonErrorMsg.textContent = '✗ Invalid JSON: ' + e.message;
      btnShare.disabled = true;
    }
  }

  // Load first template by default
  loadTemplate('aesthetics');
});
