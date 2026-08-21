// Resolved at build time to node_modules/cmdk/dist/command-score.mjs via the `alias`
// map in scripts/build-js.mjs. cmdk's package exports only expose ".", and that entry
// pulls in React, so the deep path is aliased rather than imported directly.
// This was previously a bare `https://cdn.jsdelivr.net/...` import, which meant the
// command palette silently failed without internet access.
import { commandScore } from 'cmdk/command-score';

(() => {
  if (window.__ttCommandPaletteLoaded) return;

  const isMac = (() => {
    try {
      return /Mac|iPhone|iPad|iPod/i.test(navigator.platform) || /Mac OS X/i.test(navigator.userAgent);
    } catch (_) {
      return false;
    }
  })();

  // Swap Ctrl badge to ⌘ on macOS for the sidebar hint.
  try {
    if (isMac) {
      document.querySelectorAll('#sidebar kbd').forEach((kbd) => {
        if (kbd.textContent && kbd.textContent.trim().toLowerCase() === 'ctrl') kbd.textContent = '⌘';
      });
    }
  } catch (_) {}

  const sel = {
    root: '#ttCommandPalette',
    input: '#ttCommandPaletteInput',
    list: '#ttCommandPaletteList',
    close: '#ttCommandPaletteClose',
    subheader: '#ttCommandPaletteSubheader',
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $all = (s, r = document) => Array.from(r.querySelectorAll(s));

  const root = $(sel.root);
  // Only mark loaded after the palette DOM exists so an early script load can retry.
  if (!root) return;
  window.__ttCommandPaletteLoaded = true;

  const input = $(sel.input);
  const list = $(sel.list);
  const closeBtn = $(sel.close);
  const subheader = $(sel.subheader);

  const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.content || '';
  const tr = (name, fallback) => root.dataset[name] || fallback;

  const urls = {
    dashboard: root.dataset.dashboardUrl || '/',
    productivity: root.dataset.productivityUrl || '/dashboard/productivity',
    weeklyGoals: root.dataset.weeklyGoalsUrl || '/weekly-goals/',
    reports: root.dataset.reportsUrl || '/reports',
    calendar: root.dataset.calendarUrl || '/calendar',
    clients: root.dataset.clientsUrl || '/clients',
    newClient: root.dataset.newClientUrl || '/clients/create',
    projects: root.dataset.projectsUrl || '/projects',
    newProject: root.dataset.newProjectUrl || '/projects/create',
    tasks: root.dataset.tasksUrl || '/tasks',
    newTask: root.dataset.newTaskUrl || '/tasks/create',
    kanban: root.dataset.kanbanUrl || '/kanban',
    invoices: root.dataset.invoicesUrl || '/invoices',
    newInvoice: root.dataset.newInvoiceUrl || '/invoices/create',
    quotes: root.dataset.quotesUrl || '/quotes',
    newQuote: root.dataset.newQuoteUrl || '/quotes/create',
    expenses: root.dataset.expensesUrl || '/expenses',
    newExpense: root.dataset.newExpenseUrl || '/expenses/create',
    newTimeEntry: root.dataset.newTimeEntryUrl || '/timer/manual',
    timeEntries: root.dataset.timeEntriesUrl || '/timer/entries',
    settings: root.dataset.settingsUrl || '/user/settings',
    help: root.dataset.helpUrl || '/help',
  };

  const state = {
    open: false,
    mode: 'commands', // 'commands' | 'projects' | 'edit-project' | 'view-project'
    selected: 0,
    query: '',
    lastFocus: null,
    projects: null,
    commands: [],
    filtered: [],
  };

  function showToast(message, level = 'info') {
    try {
      if (typeof window.showToast === 'function') {
        window.showToast(message, level);
        return;
      }
    } catch (_) {}
    // Fallback: minimal alert-style feedback
    try {
      // eslint-disable-next-line no-alert
      alert(message);
    } catch (_) {}
  }

  function normalize(s) {
    return String(s || '').trim().toLowerCase();
  }

  function fuzzyRank(haystack, query) {
    const q = normalize(query);
    if (!q) return 0;
    const h = normalize(haystack);
    try {
      return commandScore(h, q);
    } catch (_) {
      // Very small fallback if commandScore import fails
      return h.includes(q) ? 1 : 0;
    }
  }

  function isTyping(ev) {
    return window.TimeTracker && window.TimeTracker.isTyping ? window.TimeTracker.isTyping(ev) : false;
  }

  function openPalette() {
    if (!root.classList.contains('hidden')) {
      setTimeout(() => input?.focus(), 10);
      return;
    }
    state.lastFocus = document.activeElement;
    state.open = true;
    state.mode = 'commands';
    state.query = '';
    state.selected = 0;
    if (input) input.value = '';
    if (subheader) subheader.classList.add('hidden');
    root.classList.remove('hidden');
    setTimeout(() => input?.focus(), 30);
    applyFilter();
    render();
  }

  function closePalette() {
    state.open = false;
    root.classList.add('hidden');
    state.query = '';
    state.selected = 0;
    state.mode = 'commands';
    if (input) input.value = '';
    if (subheader) {
      subheader.textContent = '';
      subheader.classList.add('hidden');
    }
    try {
      if (state.lastFocus && typeof state.lastFocus.focus === 'function') state.lastFocus.focus();
    } catch (_) {}
  }

  function nav(href) {
    window.location.href = href;
  }

  async function fetchProjects() {
    if (state.projects) return state.projects;
    const res = await fetch('/api/projects', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Failed to load projects');
    const json = await res.json();
    const projects = Array.isArray(json.projects) ? json.projects : [];
    state.projects = projects;
    return projects;
  }

  async function startTimerWithProject(projectId) {
    const status = await fetch('/api/timer/status', { credentials: 'same-origin' }).then((response) => response.json());
    const res = await fetch(status.active ? '/api/timer/switch' : '/api/timer/start', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken(),
      },
      body: JSON.stringify({ project_id: projectId }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      throw new Error(json.error || json.message || 'Failed to start timer');
    }
    return json;
  }

  async function toggleBreak() {
    const status = await fetch('/api/timer/status', { credentials: 'same-origin' }).then((response) => response.json());
    if (!status.active) throw new Error('No active timer');
    closePalette();
    window.evilTimeTimerControl?.action(status.timer.paused ? 'resume' : 'pause');
  }

  function setMode(mode, headerText = '') {
    state.mode = mode;
    state.selected = 0;
    state.query = '';
    if (input) input.value = '';
    if (subheader) {
      if (headerText) {
        subheader.textContent = headerText;
        subheader.classList.remove('hidden');
      } else {
        subheader.textContent = '';
        subheader.classList.add('hidden');
      }
    }
    applyFilter();
    render();
    setTimeout(() => input?.focus(), 10);
  }

  function buildCommands() {
    state.commands = [
      // --- Timer & Time Entries ---
      {
        id: 'start-timer',
        title: tr('clockCommand', 'Clock in or switch project'),
        description: tr('clockDescription', 'Choose a project without leaving this panel'),
        icon: 'fa-play',
        keywords: 'timer start track clock in switch project',
        hint: 'T S',
        action: async () => {
          try {
            await fetchProjects();
            setMode('projects', tr('selectProject', 'Timer / Select a project'));
          } catch (e) {
            showToast(e.message || 'Failed to load projects', 'danger');
          }
        },
      },
      {
        id: 'timer-controls',
        title: tr('timerCommand', 'Open timer controls'),
        description: tr('timerDescription', 'Pause, resume, clock out, or switch'),
        icon: 'fa-stopwatch',
        keywords: 'timer pause resume stop clock out controls modal',
        hint: 'T P',
        action: () => {
          closePalette();
          window.evilTimeTimerControl?.open();
        },
      },
      {
        id: 'toggle-break',
        title: tr('breakCommand', 'Start or end break'),
        description: tr('breakDescription', 'Toggle the break on your active timer'),
        icon: 'fa-mug-hot',
        keywords: 'pause resume break coffee rest',
        hint: 'T B',
        action: toggleBreak,
      },
      {
        id: 'clock-out',
        title: tr('clockOutCommand', 'Clock out'),
        description: tr('clockOutDescription', 'Stop the active project timer'),
        icon: 'fa-stop',
        keywords: 'timer stop clock out finish end session',
        hint: 'T O',
        action: () => {
          closePalette();
          window.evilTimeTimerControl?.action('stop');
        },
      },
      {
        id: 'new-time-entry',
        title: tr('logCommand', 'Log time manually'),
        description: tr('logDescription', 'Add a completed time entry'),
        icon: 'fa-clock',
        keywords: 'manual log add time entry record retroactive',
        hint: 'T L',
        action: () => nav(urls.newTimeEntry),
      },
      {
        id: 'goto-time-entries',
        title: tr('timeEntriesCommand', 'Time entries'),
        description: tr('timeEntriesDescription', 'Review all logged time entries'),
        icon: 'fa-list-check',
        keywords: 'time entries list history logs records overview',
        hint: 'G E',
        action: () => nav(urls.timeEntries),
      },

      // --- Projects ---
      {
        id: 'goto-projects',
        title: tr('projectsCommand', 'Projects'),
        description: tr('projectsDescription', 'View and manage all projects'),
        icon: 'fa-folder',
        keywords: 'projects list browse manage overview',
        hint: 'G P',
        action: () => nav(urls.projects),
      },
      {
        id: 'new-project',
        title: tr('newProjectCommand', 'Create project'),
        description: tr('newProjectDescription', 'Set up a new project'),
        icon: 'fa-folder-plus',
        keywords: 'project create add new setup',
        hint: 'C P',
        action: () => nav(urls.newProject),
      },
      {
        id: 'edit-project',
        title: tr('editProjectCommand', 'Edit project'),
        description: tr('editProjectDescription', 'Select a project to modify its settings'),
        icon: 'fa-pen-to-square',
        keywords: 'project edit modify update settings change rates icon',
        hint: 'E P',
        action: async () => {
          try {
            await fetchProjects();
            setMode('edit-project', tr('selectEditProject', 'Edit project / Select a project'));
          } catch (e) {
            showToast(e.message || 'Failed to load projects', 'danger');
          }
        },
      },
      {
        id: 'view-project',
        title: tr('viewProjectCommand', 'Open project'),
        description: tr('viewProjectDescription', 'Select a project to view its details'),
        icon: 'fa-folder-open',
        keywords: 'project open view details dashboard budget goods',
        hint: 'V P',
        action: async () => {
          try {
            await fetchProjects();
            setMode('view-project', tr('selectViewProject', 'Open project / Select a project'));
          } catch (e) {
            showToast(e.message || 'Failed to load projects', 'danger');
          }
        },
      },

      // --- Tasks & Kanban ---
      {
        id: 'goto-tasks',
        title: tr('tasksCommand', 'Tasks'),
        description: tr('tasksDescription', 'Manage project tasks and to-dos'),
        icon: 'fa-check-double',
        keywords: 'tasks list todos items to-do',
        hint: 'G T',
        action: () => nav(urls.tasks),
      },
      {
        id: 'new-task',
        title: tr('newTaskCommand', 'Create task'),
        description: tr('newTaskDescription', 'Create a new task item'),
        icon: 'fa-square-plus',
        keywords: 'task create add new todo item',
        hint: 'C T',
        action: () => nav(urls.newTask),
      },
      {
        id: 'goto-kanban',
        title: tr('kanbanCommand', 'Kanban board'),
        description: tr('kanbanDescription', 'Visual task status board'),
        icon: 'fa-table-columns',
        keywords: 'kanban board agile sprint workflow columns cards',
        hint: 'G K',
        action: () => nav(urls.kanban),
      },

      // --- Clients ---
      {
        id: 'goto-clients',
        title: tr('clientsCommand', 'Clients'),
        description: tr('clientsDescription', 'Open clients and companies'),
        icon: 'fa-building',
        keywords: 'crm customers companies clients accounts',
        hint: 'G C',
        action: () => nav(urls.clients),
      },
      {
        id: 'new-client',
        title: tr('newClientCommand', 'Create client'),
        description: tr('newClientDescription', 'Add a new client or company'),
        icon: 'fa-user-plus',
        keywords: 'client create add new customer company crm',
        hint: 'C C',
        action: () => nav(urls.newClient),
      },

      // --- Invoices & Quotes & Expenses ---
      {
        id: 'goto-invoices',
        title: tr('invoicesCommand', 'Invoices'),
        description: tr('invoicesDescription', 'Review billing and client invoices'),
        icon: 'fa-file-invoice-dollar',
        keywords: 'invoices billing payments accounts receivable',
        hint: 'G I',
        action: () => nav(urls.invoices),
      },
      {
        id: 'new-invoice',
        title: tr('newInvoiceCommand', 'Create invoice'),
        description: tr('newInvoiceDescription', 'Start a new client invoice'),
        icon: 'fa-file-circle-plus',
        keywords: 'invoice billing create new bill draft',
        hint: 'C I',
        action: () => nav(urls.newInvoice),
      },
      {
        id: 'goto-quotes',
        title: tr('quotesCommand', 'Quotes'),
        description: tr('quotesDescription', 'Review estimates and quotes'),
        icon: 'fa-file-lines',
        keywords: 'quotes estimates proposals offers bids',
        hint: 'G Q',
        action: () => nav(urls.quotes),
      },
      {
        id: 'new-quote',
        title: tr('newQuoteCommand', 'Create quote'),
        description: tr('newQuoteDescription', 'Start a new quote or proposal'),
        icon: 'fa-file-contract',
        keywords: 'quote create new estimate proposal offer',
        hint: 'C Q',
        action: () => nav(urls.newQuote),
      },
      {
        id: 'goto-expenses',
        title: tr('expensesCommand', 'Expenses'),
        description: tr('expensesDescription', 'Review tracked receipts and expenses'),
        icon: 'fa-receipt',
        keywords: 'expenses receipts spending costs purchases reimbursements',
        hint: 'G X',
        action: () => nav(urls.expenses),
      },
      {
        id: 'new-expense',
        title: tr('newExpenseCommand', 'Log expense'),
        description: tr('newExpenseDescription', 'Record a new receipt or expense'),
        icon: 'fa-money-bill-transfer',
        keywords: 'expense log create receipt spending cost add',
        hint: 'C X',
        action: () => nav(urls.newExpense),
      },

      // --- Overviews & Analytics ---
      {
        id: 'goto-dashboard',
        title: tr('dashboardCommand', 'Dashboard'),
        description: tr('dashboardDescription', 'Return to your work overview'),
        icon: 'fa-gauge-high',
        keywords: 'home overview main dashboard status live',
        hint: 'G D',
        action: () => nav(urls.dashboard),
      },
      {
        id: 'goto-productivity',
        title: tr('productivityCommand', 'My productivity'),
        description: tr('productivityDescription', 'View productivity metrics and streak'),
        icon: 'fa-fire',
        keywords: 'productivity metrics speed stats charts streak ranking',
        hint: 'G M',
        action: () => nav(urls.productivity),
      },
      {
        id: 'goto-weekly-goals',
        title: tr('weeklyGoalsCommand', 'Weekly overview'),
        description: tr('weeklyGoalsDescription', 'Calendar week targets and balance'),
        icon: 'fa-calendar-week',
        keywords: 'weekly overview goals targets kw overtime balance week hours',
        hint: 'G W',
        action: () => nav(urls.weeklyGoals),
      },
      {
        id: 'goto-calendar',
        title: tr('calendarCommand', 'Calendar'),
        description: tr('calendarDescription', 'View schedule and calendar events'),
        icon: 'fa-calendar-days',
        keywords: 'calendar schedule events meetings plan timeline',
        hint: 'G A',
        action: () => nav(urls.calendar),
      },
      {
        id: 'goto-reports',
        title: tr('reportsCommand', 'Reports'),
        description: tr('reportsDescription', 'Review tracked time and analytics'),
        icon: 'fa-chart-line',
        keywords: 'reports analytics insights graphs export summary',
        hint: 'G R',
        action: () => nav(urls.reports),
      },

      // --- System & Preferences ---
      {
        id: 'toggle-theme',
        title: tr('themeCommand', 'Toggle theme'),
        description: tr('themeDescription', 'Switch between light and dark theme'),
        icon: 'fa-circle-half-stroke',
        keywords: 'theme dark mode light mode switch appearance toggle colors',
        action: () => {
          const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
          const next = isDark ? 'light' : 'dark';
          const optionBtn = document.querySelector(`.theme-option[data-theme="${next}"]`);
          if (optionBtn) {
            optionBtn.click();
          } else {
            document.documentElement.classList.toggle('dark', !isDark);
            document.body.classList.toggle('dark', !isDark);
            localStorage.setItem('color-theme', next);
          }
          closePalette();
          showToast(`Switched to ${next} theme`, 'info');
        },
      },
      {
        id: 'goto-settings',
        title: tr('settingsCommand', 'Settings & profile'),
        description: tr('settingsDescription', 'Manage preferences, theme and account'),
        icon: 'fa-gear',
        keywords: 'settings preferences profile user password security account custom theme',
        hint: 'G S',
        action: () => nav(urls.settings),
      },
      {
        id: 'goto-help',
        title: tr('helpCommand', 'Help & shortcuts'),
        description: tr('helpDescription', 'View shortcuts and documentation'),
        icon: 'fa-circle-question',
        keywords: 'help docs shortcuts documentation guide support faq',
        hint: '?',
        action: () => nav(urls.help),
      },
    ];
  }

  function getActiveItems() {
    if (state.mode === 'projects' || state.mode === 'edit-project' || state.mode === 'view-project') {
      const projects = state.projects || [];
      return projects.map((p) => {
        let action;
        let desc = p.client_name ? String(p.client_name) : (p.code || '');
        if (state.mode === 'edit-project') {
          desc = p.client_name ? `Edit project for ${p.client_name}` : (p.code ? `Edit [${p.code}]` : 'Open project edit form');
          action = () => {
            closePalette();
            nav(`/projects/${p.id}/edit`);
          };
        } else if (state.mode === 'view-project') {
          desc = p.client_name ? `View project for ${p.client_name}` : (p.code ? `View [${p.code}]` : 'Open project details');
          action = () => {
            closePalette();
            nav(`/projects/${p.id}`);
          };
        } else {
          action = async () => {
            try {
              await startTimerWithProject(p.id);
              closePalette();
              showToast('Timer started', 'info');
            } catch (e) {
              showToast(e.message || 'Failed to start timer', 'danger');
            }
          };
        }
        return {
          id: `project:${state.mode}:${p.id}`,
          title: p.name || `Project #${p.id}`,
          description: desc,
          icon: state.mode === 'edit-project' ? 'fa-pen-to-square' : (state.mode === 'view-project' ? 'fa-folder-open' : 'fa-folder'),
          keywords: `${p.name || ''} ${p.client_name || ''} ${p.code || ''}`.trim(),
          hint: p.client_name ? String(p.client_name) : (p.code || ''),
          action: action,
        };
      });
    }
    return state.commands;
  }

  function applyFilter() {
    const items = getActiveItems();
    const q = state.query;

    if (!q) {
      state.filtered = items.slice();
      state.selected = Math.min(state.selected, Math.max(0, state.filtered.length - 1));
      return;
    }

    const scored = items
      .map((it) => {
        const haystack = `${it.title} ${it.keywords || ''}`;
        const score = fuzzyRank(haystack, q);
        return { it, score };
      })
      .filter((x) => x.score > 0);

    scored.sort((a, b) => b.score - a.score);
    state.filtered = scored.map((x) => x.it);
    state.selected = 0;
  }

  function highlightSelected() {
    $all('[data-tt-cp-idx]', list).forEach((el) => {
      const idx = Number(el.getAttribute('data-tt-cp-idx') || '0');
      const active = idx === state.selected;
      el.classList.toggle('bg-primary/10', active);
      el.classList.toggle('ring-1', active);
      el.classList.toggle('ring-primary/30', active);
    });
  }

  function renderEmpty(message) {
    list.innerHTML = `
      <div class="px-3 py-8 text-center text-sm text-text-muted-light dark:text-text-muted-dark">
        ${message}
      </div>
    `;
  }

  function render() {
    if (!list) return;

    const items = state.filtered || [];
    if (!items.length) {
      if (state.mode === 'projects') renderEmpty(tr('noProjects', 'No projects found.'));
      else renderEmpty('No commands found.');
      return;
    }

    list.innerHTML = '';
    items.forEach((cmd, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-tt-cp-idx', String(idx));
      btn.className =
        'mx-2 rounded-xl px-3 py-2.5 text-left flex items-center justify-between gap-3 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary';

      const left = document.createElement('div');
      left.className = 'min-w-0 flex flex-1 items-center gap-3';
      const icon = document.createElement('span');
      icon.className = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300';
      const iconGlyph = document.createElement('i');
      iconGlyph.className = `fas ${cmd.icon || 'fa-arrow-right'}`;
      icon.appendChild(iconGlyph);
      const copy = document.createElement('span');
      copy.className = 'min-w-0';
      const title = document.createElement('span');
      title.className = 'block truncate text-sm font-semibold';
      title.textContent = cmd.title || '';
      const description = document.createElement('span');
      description.className = 'block truncate text-xs text-text-muted-light dark:text-text-muted-dark';
      description.textContent = cmd.description || '';
      copy.appendChild(title);
      copy.appendChild(description);
      left.appendChild(icon);
      left.appendChild(copy);

      const right = document.createElement('div');
      right.className = 'shrink-0 text-xs text-text-muted-light dark:text-text-muted-dark flex items-center gap-2';
      if (cmd.hint) {
        const hint = document.createElement('span');
        hint.className = 'truncate';
        hint.textContent = cmd.hint;
        right.appendChild(hint);
      }

      btn.appendChild(left);
      btn.appendChild(right);
      btn.addEventListener('click', () => runCommand(cmd));

      list.appendChild(btn);
    });
    highlightSelected();
  }

  function onInput() {
    state.query = input?.value || '';
    applyFilter();
    render();
  }

  function onPaletteKeydown(ev) {
    if (!state.open) return;

    if (ev.key === 'Escape') {
      ev.preventDefault();
      if (state.mode !== 'commands') setMode('commands');
      else closePalette();
      return;
    }

    if (ev.key === 'Backspace' && state.mode !== 'commands' && !input?.value) {
      ev.preventDefault();
      setMode('commands');
      return;
    }

    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      state.selected = Math.min(state.selected + 1, Math.max(0, (state.filtered?.length || 1) - 1));
      highlightSelected();
      return;
    }

    if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      state.selected = Math.max(state.selected - 1, 0);
      highlightSelected();
      return;
    }

    if (ev.key === 'Enter') {
      ev.preventDefault();
      const cmd = state.filtered?.[state.selected];
      if (cmd) runCommand(cmd);
    }
  }

  async function runCommand(command) {
    if (!command || typeof command.action !== 'function') return;
    const modeBefore = state.mode;
    try {
      await command.action();
      if (state.open && state.mode === modeBefore && modeBefore === 'commands') closePalette();
    } catch (error) {
      showToast(error.message || 'Action failed', 'danger');
    }
  }

  function onGlobalKeydown(ev) {
    const combo = (ev.ctrlKey || ev.metaKey) && (ev.key === 'k' || ev.key === 'K');
    if (combo) {
      ev.preventDefault();
      openPalette();
      return;
    }

    if (!state.open) return;

    // When palette is open, keep focus in the input.
    if (ev.key === '/' && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault();
      setTimeout(() => input?.focus(), 10);
    }
  }

  function onBackdropClick(e) {
    const shouldClose = e.target?.hasAttribute?.('data-tt-cp-close');
    if (shouldClose) closePalette();
  }

  function onRootClick(e) {
    const btn = e.target.closest?.('#ttCommandPaletteClose');
    if (btn) {
      e.preventDefault();
      closePalette();
    }
  }

  function init() {
    buildCommands();
    state.filtered = state.commands.slice();

    document.addEventListener('keydown', onGlobalKeydown);
    document.addEventListener('keydown', (ev) => {
      if (!state.open) return;
      // Allow navigation even if the input isn't focused.
      if (!isTyping(ev)) onPaletteKeydown(ev);
    });

    root.addEventListener('click', onRootClick);
    root.addEventListener('click', onBackdropClick);
    input?.addEventListener('input', onInput);
    input?.addEventListener('keydown', onPaletteKeydown);
    closeBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      closePalette();
    });

    window.openCommandPalette = openPalette;
  }

  init();
})();
