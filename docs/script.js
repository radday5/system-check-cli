/**
 * Winslopr Showcase Site JS
 * Custom Interactive Logic & Terminal Simulation
 */

document.addEventListener('DOMContentLoaded', () => {
  initNavbarScroll();
  initCopyInstaller();
  initTableSearch();
  initTabs();
  initTerminalSimulation();
});

// --- Scroll Styling for Navbar ---
function initNavbarScroll() {
  const header = document.getElementById('site-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
}

// --- Copy Installer Command ---
function initCopyInstaller() {
  const copyBtn = document.getElementById('copy-installer-btn');
  const copyText = document.getElementById('copy-btn-text');
  const cmdText = document.getElementById('cmd-text').textContent;

  if (!copyBtn) return;

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(cmdText);
      
      // Visual Feedback state
      copyBtn.classList.add('copied');
      copyText.textContent = 'Copied!';
      
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyText.textContent = 'Copy';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  });
}

// --- Smart-Throttle Table Filter/Search ---
function initTableSearch() {
  const searchInput = document.getElementById('throttle-search');
  const tableRows = document.querySelectorAll('#tasks-table-body tr');

  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();

    tableRows.forEach(row => {
      const rowText = row.textContent.toLowerCase();
      const rowKeys = row.getAttribute('data-keys').toLowerCase();
      
      if (rowText.includes(query) || rowKeys.includes(query)) {
        row.classList.remove('hidden');
      } else {
        row.classList.add('hidden');
      }
    });
  });
}

// --- Tabs Management ---
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-nav-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  if (tabButtons.length === 0) return;

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // 1. Remove active state from all buttons
      tabButtons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });

      // 2. Hide all panels
      tabPanels.forEach(p => p.classList.remove('active'));

      // 3. Set current button as active
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      // 4. Reveal target panel
      const targetId = btn.getAttribute('aria-controls');
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
    });
  });
}

// --- Terminal Simulator Playback ---
function initTerminalSimulation() {
  const playbackContainer = document.getElementById('terminal-playback');
  if (!playbackContainer) return;

  // Configuration for script lines
  // types: 'type' (typed out), 'log' (instant line), 'spinner' (animates a spinner for a duration), 'clear' (clears the body)
  const sequence = [
    { type: 'type', content: 'npx winslopr', speed: 100 },
    { type: 'wait', duration: 600 },
    
    { type: 'log', style: 'log-bold', content: ' Winslopr v26.6.0' },
    { type: 'log', style: 'log-subtle', content: '==================================================' },
    { type: 'wait', duration: 400 },
    
    { type: 'log', style: 'log-info', content: '🔍 Verifying Administrator privileges...' },
    { type: 'wait', duration: 600 },
    { type: 'log', style: 'log-success', content: '   ✔ Checked: Elevated administrator shell confirmed.' },
    { type: 'wait', duration: 400 },
    
    { type: 'log', style: 'log-info', content: '🖥️ Gathering Hardware & OS Information...' },
    { type: 'wait', duration: 800 },
    { type: 'log', style: 'log-subtle', content: '   • CPU:   Intel(R) Core(TM) i7-13700K (24 Threads)' },
    { type: 'log', style: 'log-subtle', content: '   • GPU:   NVIDIA GeForce RTX 4070 (12GB VRAM)' },
    { type: 'log', style: 'log-subtle', content: '   • RAM:   32.00 GB DDR5 System Memory' },
    { type: 'log', style: 'log-subtle', content: '   • OS:    Windows 11 Pro 64-bit (Build 22631)' },
    { type: 'wait', duration: 500 },
    
    { type: 'log', style: 'log-info', content: '⚙️ State loaded from %LOCALAPPDATA%\\winslopr-state.json' },
    { type: 'wait', duration: 400 },
    
    { type: 'log', style: 'log-bold', content: '✨ Smart-Throttling Checklist (Silent Startup Mode):' },
    { type: 'log', style: 'log-success', content: '   [✔] slop        (Remove Windows Slop)  -> RUNNING (Instant)' },
    { type: 'log', style: 'log-success', content: '   [✔] cleanup     (Clean Temp Folders)   -> RUNNING (1 day elapsed)' },
    { type: 'log', style: 'log-success', content: '   [✔] dns         (Flush Cache)          -> RUNNING (Instant)' },
    { type: 'log', style: 'log-subtle', content: '   [⚙] sfc         (System Scan)          -> SKIPPED (Last run 3d ago)' },
    { type: 'log', style: 'log-subtle', content: '   [⚙] dism        (Health Repair)        -> SKIPPED (Last run 3d ago)' },
    { type: 'log', style: 'log-subtle', content: '   [⚙] optimize    (Trim/Defrag Drives)   -> SKIPPED (Last run 8d ago)' },
    { type: 'wait', duration: 800 },
    
    { type: 'spinner', content: '🧹 Cleaning Windows Slop (Removing telemetry, Recall, search highlights & widgets)...', duration: 1500 },
    { type: 'log', style: 'log-success', content: '   ✔ Disabled Microsoft Recall & Copilot background agents.' },
    { type: 'log', style: 'log-success', content: '   ✔ Disabled Bing search highlights & Start menu web search.' },
    { type: 'log', style: 'log-success', content: '   ✔ Hidden taskbar Chat & Widgets shortcuts.' },
    { type: 'log', style: 'log-success', content: '   ✔ Registry tracking telemetry pipelines disabled.' },
    { type: 'wait', duration: 600 },
    
    { type: 'spinner', content: '🧼 Safely clearing junk temporary folders & DNS caches...', duration: 1200 },
    { type: 'log', style: 'log-success', content: '   ✔ Cleared Windows Temp & User Temp caches.' },
    { type: 'log', style: 'log-success', content: '   ✔ Flushed DNS Resolver Cache.' },
    { type: 'log', style: 'log-success', content: '   ✔ Emptied Recycle Bin (Freed up 8.42 GB disk space).' },
    { type: 'wait', duration: 700 },
    
    { type: 'log', style: 'log-success', content: '🎉 Success: Windows Slop check and system maintenance completed!' },
    { type: 'log', style: 'log-bold', content: '⏳ Total Execution Time: 3.82 seconds' },
    { type: 'wait', duration: 8000 }, // long pause to let visitors read
    
    { type: 'clear' }
  ];

  let currentStep = 0;
  
  // Creates cursor element
  const cursor = document.createElement('span');
  cursor.className = 'terminal-cursor';
  cursor.textContent = '█';

  // Run the sequence loop
  async function runSequence() {
    playbackContainer.innerHTML = '';
    playbackContainer.appendChild(cursor);
    currentStep = 0;
    
    while (currentStep < sequence.length) {
      const step = sequence[currentStep];
      
      if (step.type === 'type') {
        await typeText(step.content, step.speed);
      } else if (step.type === 'log') {
        writeLine(step.content, step.style);
      } else if (step.type === 'spinner') {
        await runSpinner(step.content, step.duration);
      } else if (step.type === 'wait') {
        await wait(step.duration);
      } else if (step.type === 'clear') {
        playbackContainer.innerHTML = '';
        playbackContainer.appendChild(cursor);
        // Add default command prompt line
        const parent = playbackContainer.parentNode;
        if (parent) {
          const body = document.getElementById('terminal-body-stream');
          body.innerHTML = '<div class="terminal-line"><span class="term-prompt">PS C:\\Windows\\system32&gt;</span> <span class="term-typed">npx winslopr</span></div><div class="terminal-loader" id="terminal-playback"></div>';
          initTerminalSimulation(); // restart simulation completely
          return;
        }
      }
      
      currentStep++;
    }
  }

  // Type out characters simulating real user input
  function typeText(text, speed) {
    return new Promise((resolve) => {
      // Find or create input prompt line
      const typeSpan = document.querySelector('.term-typed');
      if (typeSpan) {
        typeSpan.textContent = '';
      }
      
      let charIndex = 0;
      function nextChar() {
        if (charIndex < text.length) {
          if (typeSpan) {
            typeSpan.textContent += text[charIndex];
          }
          charIndex++;
          setTimeout(nextChar, speed);
        } else {
          resolve();
        }
      }
      nextChar();
    });
  }

  // Print text line directly in terminal
  function writeLine(text, styleClass = '') {
    const line = document.createElement('div');
    line.className = `terminal-line ${styleClass}`;
    line.textContent = text;
    // Insert line before the cursor
    playbackContainer.insertBefore(line, cursor);
    // Auto-scroll terminal
    const body = document.getElementById('terminal-body-stream');
    body.scrollTop = body.scrollHeight;
  }

  // Spinner animation for scanning/loading indicators
  function runSpinner(text, duration) {
    return new Promise((resolve) => {
      const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
      let charIdx = 0;
      
      const line = document.createElement('div');
      line.className = 'terminal-line log-info';
      playbackContainer.insertBefore(line, cursor);
      
      const intervalId = setInterval(() => {
        line.textContent = `${spinnerChars[charIdx]} ${text}`;
        charIdx = (charIdx + 1) % spinnerChars.length;
      }, 80);

      setTimeout(() => {
        clearInterval(intervalId);
        line.remove(); // remove spinner line so we can replace with success checklist item
        resolve();
      }, duration);
    });
  }

  // Helper wait promise
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Start initial playback run
  runSequence();
}
