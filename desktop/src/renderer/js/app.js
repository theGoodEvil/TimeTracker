// Main application logic
// First-run depends on ../shared/config.js exposing window.config before this bundle (see index.html).
require('./utils/helpers');
const ApiClient = require('./api/client');
const { createConnectionManager } = require('./connection/connection_manager');
const { CONNECTION_STATE } = require('./connection/connection_state');
const { startTimerWithReconcile, stopTimerWithReconcile } = require('./connection/timer_operations');
const { classifyAxiosError } = require('./api/client');
const { showError, showSuccess } = require('./ui/notifications');
const state = require('./state');

const {
  formatDuration,
  formatDurationLong,
  formatDateTime,
  isValidUrl,
  normalizeServerUrlInput,
} = window.Helpers || {};

const { storeGet, storeSet, storeDelete, storeClear } = window.config || {};

/** @type {ReturnType<typeof createConnectionManager> | null} */
let connectionManager = null;

/** @type {'welcome'|'server'|'token'} */
let loginWizardStep = 'welcome';

function truncateUrl(url, maxLen) {
  const s = String(url || '');
  const m = maxLen || 42;
  if (s.length <= m) return s;
  return s.slice(0, m - 1) + '…';
}

// Initialize app
async function initApp() {
  if (
    typeof storeGet !== 'function' ||
    typeof storeSet !== 'function' ||
    typeof storeDelete !== 'function' ||
    typeof storeClear !== 'function'
  ) {
    throw new Error('Desktop configuration bridge is unavailable.');
  }

  connectionManager = createConnectionManager({
    storeGet,
    storeSet,
    storeDelete,
    storeClear,
    onCacheClear: () => {
      if (typeof state.clearViewCaches === 'function') state.clearViewCaches();
    },
  });

  connectionManager.subscribe(() => {
    state.apiClient = connectionManager.getClient();
    updateConnectionFromManager();
  });

  setupEventListeners();
  setupTrayListeners();

  const boot = await connectionManager.bootstrapFromStore();

  if (boot.ok) {
    state.authFailureStreak = 0;
    showMainScreen();
    await loadInitialData();
  } else if (boot.reason === 'offline' && boot.hadCredentials) {
    showLoginScreen({
      prefillServerUrl: connectionManager.getSnapshot().serverUrl || '',
      openTokenStep: true,
      bannerMessage: 'You appear to be offline. Reconnect to the network, then use Log in.',
    });
  } else if (boot.reason === 'session' && boot.session) {
    showLoginScreen({ prefillServerUrl: connectionManager.getSnapshot().serverUrl || '', sessionError: boot.session });
  } else if (boot.reason === 'token_server_mismatch') {
    showLoginScreen({
      prefillServerUrl: connectionManager.getSnapshot().serverUrl || '',
      bannerMessage: connectionManager.getSnapshot().lastError || 'Please sign in again.',
    });
  } else if (boot.reason === 'no_server') {
    showLoginScreen({ prefillServerUrl: '', startAtServer: true });
  } else if (boot.reason === 'no_token') {
    showLoginScreen({
      prefillServerUrl: connectionManager.getSnapshot().serverUrl || '',
      openTokenStep: true,
    });
  } else if (boot.reason === 'bootstrap_timeout') {
    showLoginScreen({
      prefillServerUrl: connectionManager.getSnapshot().serverUrl || '',
      openTokenStep: true,
      bannerMessage: boot.message || 'Server did not respond in time. Check the URL or network, then try signing in again.',
    });
  } else if (boot.reason === 'session_unreachable') {
    showLoginScreen({
      prefillServerUrl: connectionManager.getSnapshot().serverUrl || '',
      openTokenStep: true,
      bannerMessage: boot.message || 'Server is not reachable. Check the URL or network, then try signing in again.',
    });
  } else {
    showLoginScreen({ prefillServerUrl: connectionManager.getSnapshot().serverUrl || '' });
  }

  startConnectionCheck();

  window.addEventListener('online', async () => {
    if (!connectionManager.getClient()) {
      const retry = await connectionManager.bootstrapFromStore();
      if (retry.ok && document.getElementById('main-screen')?.classList.contains('active')) {
        state.authFailureStreak = 0;
        await loadInitialData();
      }
    }
    await checkConnection();
  });
}

async function loadInitialData() {
  try {
    await loadCurrentUserProfile();
  } catch (err) {
    console.error('Initial profile load failed:', err);
  }
  try {
    await loadDashboard();
  } catch (err) {
    console.error('Initial dashboard load failed:', err);
  }
}

function setupTrayListeners() {
  // Listen for tray timer actions
  if (window.electronAPI && window.electronAPI.onTrayAction) {
    window.electronAPI.onTrayAction((action) => {
      if (action === 'start-timer' && !state.isTimerRunning) {
        // Tray wants to start timer - show the start dialog
        handleStartTimer();
      } else if (action === 'stop-timer' && state.isTimerRunning) {
        // Tray wants to stop timer
        handleStopTimer();
      }
    });
  }
}

function startConnectionCheck() {
  // Check connection every 30 seconds
  state.connectionCheckInterval = setInterval(async () => {
    await checkConnection();
  }, 30000);
  
  // Initial check
  checkConnection();
}

async function checkConnection() {
  if (typeof navigator !== 'undefined' && navigator.onLine && !connectionManager.getClient()) {
    const snap = connectionManager.getSnapshot();
    if (snap.serverUrl && (await storeGet('api_token'))) {
      const boot = await connectionManager.bootstrapFromStore();
      if (boot.ok && document.getElementById('main-screen')?.classList.contains('active')) {
        state.authFailureStreak = 0;
        await loadCurrentUserProfile();
      }
    }
  }

  if (!state.apiClient) {
    updateConnectionFromManager();
    return;
  }

  const session = await connectionManager.validateSessionRefresh();
  if (session.ok) {
    state.authFailureStreak = 0;
    updateConnectionFromManager();
    return;
  }

  updateConnectionFromManager();
  if (session.code === 'UNAUTHORIZED') {
    state.authFailureStreak = (state.authFailureStreak || 0) + 1;
    if (state.authFailureStreak >= 2 && document.getElementById('main-screen')?.classList.contains('active')) {
      await forceRelogin(session.message || 'Your session is no longer valid. Please sign in again.');
    }
  } else {
    state.authFailureStreak = 0;
  }
}

async function loadCurrentUserProfile() {
  if (!state.apiClient) return;
  try {
    const me = await state.apiClient.getUsersMe();
    const user = me.user || {};
    const role = String(user.role || '').toLowerCase();
    const roleCanApprove = ['admin', 'owner', 'manager', 'approver'].includes(role);
    state.currentUserProfile = {
      id: user.id,
      is_admin: Boolean(user.is_admin),
      can_approve: Boolean(user.is_admin) || roleCanApprove,
    };
  } catch (err) {
    console.error('loadCurrentUserProfile failed:', err);
    if (err && err.stack) console.error(err.stack);
    state.currentUserProfile = { id: null, is_admin: false, can_approve: false };
    const { message } = classifyAxiosError(err);
    showError(message || 'Could not load your user profile. Some actions may be unavailable until the connection improves.');
  }
}

function updateConnectionFromManager() {
  if (!connectionManager) return;
  const snap = connectionManager.getSnapshot();
  const statusEl = document.getElementById('connection-status');
  const urlEl = document.getElementById('connection-url-label');
  const timeEl = document.getElementById('connection-last-ok');
  if (!statusEl) return;

  let cssSuffix = 'disconnected';
  let title = '';
  let label = 'Connection status: ';

  switch (snap.state) {
    case CONNECTION_STATE.CONNECTED:
      cssSuffix = 'connected';
      title = snap.serverUrl || 'Connected';
      label += 'Connected';
      statusEl.textContent = '●';
      break;
    case CONNECTION_STATE.OFFLINE:
      cssSuffix = 'offline';
      title = snap.lastError || 'Offline';
      label += 'Offline';
      statusEl.textContent = '●';
      break;
    case CONNECTION_STATE.CONNECTING:
      cssSuffix = 'connecting';
      title = snap.lastError || 'Connecting…';
      label += 'Connecting';
      statusEl.textContent = '◐';
      break;
    case CONNECTION_STATE.ERROR:
      cssSuffix = 'error';
      title = snap.lastError || 'Connection error';
      label += 'Error';
      statusEl.textContent = '●';
      break;
    default:
      title = snap.serverUrl || 'Not configured';
      label += 'Not configured';
      statusEl.textContent = '○';
  }

  statusEl.className = 'connection-status connection-' + cssSuffix;
  statusEl.title = title;
  statusEl.setAttribute('aria-label', label);

  if (urlEl) {
    urlEl.textContent = snap.serverUrl ? truncateUrl(snap.serverUrl) : '—';
    urlEl.title = snap.serverUrl || '';
  }
  if (timeEl) {
    timeEl.textContent = snap.lastConnectedAt ? formatDateTime(new Date(snap.lastConnectedAt)) : '—';
  }
}

async function forceRelogin(message) {
  state.authFailureStreak = 0;
  const url = await storeGet('server_url');
  if (state.isTimerRunning) {
    state.isTimerRunning = false;
    stopTimerPolling();
  }
  await connectionManager.logoutKeepServer();
  showLoginScreen({
    prefillServerUrl: url ? ApiClient.normalizeBaseUrl(String(url)) : '',
    openTokenStep: true,
    bannerMessage: message,
  });
}

function showWizardWelcomeStep() {
  loginWizardStep = 'welcome';
  const w = document.getElementById('wizard-step-welcome');
  const s1 = document.getElementById('wizard-step-server');
  const s2 = document.getElementById('wizard-step-token');
  if (w) w.style.display = '';
  if (s1) s1.style.display = 'none';
  if (s2) s2.style.display = 'none';
}

function showWizardServerStep() {
  loginWizardStep = 'server';
  const w = document.getElementById('wizard-step-welcome');
  const s1 = document.getElementById('wizard-step-server');
  const s2 = document.getElementById('wizard-step-token');
  if (w) w.style.display = 'none';
  if (s1) s1.style.display = '';
  if (s2) s2.style.display = 'none';
}

function showWizardTokenStep() {
  loginWizardStep = 'token';
  const w = document.getElementById('wizard-step-welcome');
  const s1 = document.getElementById('wizard-step-server');
  const s2 = document.getElementById('wizard-step-token');
  if (w) w.style.display = 'none';
  if (s1) s1.style.display = 'none';
  if (s2) s2.style.display = '';
}

function resetLoginWizard() {
  showWizardWelcomeStep();
  const contServer = document.getElementById('login-wizard-continue-server');
  if (contServer) contServer.disabled = true;
  const testBtn = document.getElementById('login-test-server-btn');
  if (testBtn) testBtn.disabled = false;
  clearLoginError();
}

function clearLoginError() {
  showLoginError('');
}

function setupEventListeners() {
  // Login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  const loginTestServerBtn = document.getElementById('login-test-server-btn');
  const loginWizardContinue = document.getElementById('login-wizard-continue');
  const loginWizardContinueServer = document.getElementById('login-wizard-continue-server');
  const loginWizardBack = document.getElementById('login-wizard-back');
  if (loginTestServerBtn) loginTestServerBtn.addEventListener('click', handleLoginTestServer);
  if (loginWizardContinue) loginWizardContinue.addEventListener('click', handleLoginWizardContinue);
  if (loginWizardContinueServer) loginWizardContinueServer.addEventListener('click', handleLoginWizardContinue);
  if (loginWizardBack) loginWizardBack.addEventListener('click', handleLoginWizardBack);
  
  // Navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const view = e.target.dataset.view;
      switchView(view);
    });
  });
  
  // Window controls
  const minimizeBtn = document.getElementById('minimize-btn');
  const maximizeBtn = document.getElementById('maximize-btn');
  const closeBtn = document.getElementById('close-btn');
  
  if (minimizeBtn) minimizeBtn.addEventListener('click', () => window.electronAPI?.minimizeWindow());
  if (maximizeBtn) maximizeBtn.addEventListener('click', () => window.electronAPI?.maximizeWindow());
  if (closeBtn) closeBtn.addEventListener('click', () => window.electronAPI?.closeWindow());
  
  // Timer controls
  const startTimerBtn = document.getElementById('start-timer-btn');
  const stopTimerBtn = document.getElementById('stop-timer-btn');
  
  if (startTimerBtn) startTimerBtn.addEventListener('click', handleStartTimer);
  if (stopTimerBtn) stopTimerBtn.addEventListener('click', handleStopTimer);
  
  // Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  
  // Settings
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const testConnectionBtn = document.getElementById('test-connection-btn');
  const autoSyncInput = document.getElementById('auto-sync');
  if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', handleSaveSettings);
  if (testConnectionBtn) testConnectionBtn.addEventListener('click', handleTestConnection);
  const resetConfigBtn = document.getElementById('reset-configuration-btn');
  if (resetConfigBtn) resetConfigBtn.addEventListener('click', handleResetConfiguration);
  if (autoSyncInput) {
    autoSyncInput.addEventListener('change', () => updateSyncIntervalState());
  }
  
  // Time entries
  const addEntryBtn = document.getElementById('add-entry-btn');
  const filterEntriesBtn = document.getElementById('filter-entries-btn');
  const applyFilterBtn = document.getElementById('apply-filter-btn');
  const clearFilterBtn = document.getElementById('clear-filter-btn');
  const addExpenseBtn = document.getElementById('add-expense-btn');
  const refreshPeriodsBtn = document.getElementById('refresh-periods-btn');
  const addInvoiceBtn = document.getElementById('add-invoice-btn');
  const addTimeoffBtn = document.getElementById('add-timeoff-btn');
  const invoiceSearchInput = document.getElementById('invoice-search');
  const expenseSearchInput = document.getElementById('expense-search');
  const timeoffSearchInput = document.getElementById('timeoff-search');
  const invoicePrevPageBtn = document.getElementById('invoice-prev-page-btn');
  const invoiceNextPageBtn = document.getElementById('invoice-next-page-btn');
  const expensePrevPageBtn = document.getElementById('expense-prev-page-btn');
  const expenseNextPageBtn = document.getElementById('expense-next-page-btn');
  
  if (addEntryBtn) addEntryBtn.addEventListener('click', () => showTimeEntryForm());
  if (filterEntriesBtn) filterEntriesBtn.addEventListener('click', toggleFilters);
  if (applyFilterBtn) applyFilterBtn.addEventListener('click', applyFilters);
  if (clearFilterBtn) clearFilterBtn.addEventListener('click', clearFilters);
  if (addExpenseBtn) addExpenseBtn.addEventListener('click', () => showCreateExpenseDialog());
  if (refreshPeriodsBtn) refreshPeriodsBtn.addEventListener('click', () => loadWorkforce());
  if (addInvoiceBtn) addInvoiceBtn.addEventListener('click', () => showCreateInvoiceDialog());
  if (addTimeoffBtn) addTimeoffBtn.addEventListener('click', () => showCreateTimeOffDialog());
  if (invoiceSearchInput) {
    invoiceSearchInput.addEventListener('input', (e) => {
      state.viewFilters.invoiceQuery = String(e.target.value || '').trim().toLowerCase();
      renderInvoices();
    });
  }
  if (expenseSearchInput) {
    expenseSearchInput.addEventListener('input', (e) => {
      state.viewFilters.expenseQuery = String(e.target.value || '').trim().toLowerCase();
      renderExpenses();
    });
  }
  if (timeoffSearchInput) {
    timeoffSearchInput.addEventListener('input', (e) => {
      state.viewFilters.timeoffQuery = String(e.target.value || '').trim().toLowerCase();
      renderTimeOffRequests();
    });
  }
  if (invoicePrevPageBtn) invoicePrevPageBtn.addEventListener('click', () => changeInvoicePage(-1));
  if (invoiceNextPageBtn) invoiceNextPageBtn.addEventListener('click', () => changeInvoicePage(1));
  if (expensePrevPageBtn) expensePrevPageBtn.addEventListener('click', () => changeExpensePage(-1));
  if (expenseNextPageBtn) expenseNextPageBtn.addEventListener('click', () => changeExpensePage(1));
}

async function handleLoginTestServer() {
  clearLoginError();
  const raw = document.getElementById('server-url')?.value.trim() || '';
  const normalizedInput = normalizeServerUrlInput(raw);
  if (!normalizedInput || !isValidUrl(normalizedInput)) {
    showLoginError('Enter a valid server URL (e.g. https://your-server.com or http://192.168.1.10:5000)');
    return;
  }
  const serverUrl = ApiClient.normalizeBaseUrl(normalizedInput);
  const testBtn = document.getElementById('login-test-server-btn');
  const contServer = document.getElementById('login-wizard-continue-server');
  if (testBtn) testBtn.disabled = true;
  if (contServer) contServer.disabled = true;
  const pub = await connectionManager.testServer(serverUrl);
  if (testBtn) testBtn.disabled = false;
  if (contServer) contServer.disabled = true;
  if (!pub.ok) {
    showLoginError(pub.message);
    return;
  }
  const ver = pub.app_version ? ` (server version ${pub.app_version})` : '';
  showSuccess(`EvilTime server detected${ver}. Continue to sign in.`);
  if (contServer) contServer.disabled = false;
}

async function handleLoginWizardContinue() {
  clearLoginError();
  if (loginWizardStep === 'welcome') {
    showWizardServerStep();
    return;
  }

  const raw = document.getElementById('server-url')?.value.trim() || '';
  const normalizedInput = normalizeServerUrlInput(raw);
  if (!normalizedInput || !isValidUrl(normalizedInput)) {
    showLoginError('Enter a valid server URL');
    return;
  }
  const serverUrl = ApiClient.normalizeBaseUrl(normalizedInput);
  const contServer = document.getElementById('login-wizard-continue-server');
  if (contServer) contServer.disabled = true;
  const pub = await connectionManager.testServer(serverUrl);
  if (!pub.ok) {
    if (contServer) contServer.disabled = true;
    showLoginError(pub.message);
    return;
  }
  if (contServer) contServer.disabled = false;
  showWizardTokenStep();
}

function handleLoginWizardBack() {
  clearLoginError();
  if (loginWizardStep === 'token') {
    showWizardServerStep();
    return;
  }
  if (loginWizardStep === 'server') {
    showWizardWelcomeStep();
    return;
  }
  showWizardWelcomeStep();
}

async function handleLogin(e) {
  e.preventDefault();

  const raw = document.getElementById('server-url')?.value.trim() || '';
  const normalizedInput = normalizeServerUrlInput(raw);
  if (!normalizedInput || !isValidUrl(normalizedInput)) {
    showLoginError('Please enter a valid server URL');
    return;
  }
  const serverUrl = ApiClient.normalizeBaseUrl(normalizedInput);

  const username = document.getElementById('login-username')?.value.trim() || '';
  const password = document.getElementById('login-password')?.value || '';
  if (!username || !password) {
    showLoginError('Please enter your username and password');
    return;
  }

  const result = await connectionManager.login(serverUrl, username, password);

  if (result.ok) {
    state.authFailureStreak = 0;
    showMainScreen();
    await loadInitialData();
  } else {
    const msg = result.session?.message || result.message || 'Login failed';
    showLoginError(msg);
    if (result.step === 'auth' && (result.session?.code === 'UNAUTHORIZED' || result.session?.code === 'FORBIDDEN')) {
      const contServer = document.getElementById('login-wizard-continue-server');
      if (contServer) contServer.disabled = false;
      showWizardTokenStep();
    } else if (result.step === 'server') {
      showWizardServerStep();
    } else {
      showWizardServerStep();
    }
  }
}

function showLoginError(message) {
  const errorDiv = document.getElementById('login-error');
  if (!errorDiv) return;
  errorDiv.textContent = message || '';
  if (message) {
    errorDiv.classList.add('show');
  } else {
    errorDiv.classList.remove('show');
  }
}

function showLoginScreen(options = {}) {
  document.getElementById('loading-screen').classList.remove('active');
  document.getElementById('login-screen').classList.add('active');
  document.getElementById('main-screen').classList.remove('active');
  state.authFailureStreak = 0;

  const su = document.getElementById('server-url');
  if (su && options.prefillServerUrl !== undefined && options.prefillServerUrl !== null) {
    su.value = String(options.prefillServerUrl || '');
  }

  if (options.openTokenStep) {
    const contServer = document.getElementById('login-wizard-continue-server');
    if (contServer) contServer.disabled = false;
    showWizardTokenStep();
    if (options.bannerMessage) {
      showLoginError(options.bannerMessage);
    } else {
      clearLoginError();
    }
    return;
  }

  if (options.startAtServer) {
    showWizardServerStep();
    if (options.bannerMessage) {
      showLoginError(options.bannerMessage);
    } else {
      clearLoginError();
    }
    return;
  }

  if (options.bannerMessage && !options.sessionError) {
    resetLoginWizard();
    showLoginError(options.bannerMessage);
    return;
  }

  if (options.sessionError) {
    const se = options.sessionError;
    if (se.code === 'UNAUTHORIZED' || se.code === 'FORBIDDEN') {
      const contServer = document.getElementById('login-wizard-continue-server');
      if (contServer) contServer.disabled = false;
      showWizardTokenStep();
      showLoginError(se.message || 'Authentication failed');
      return;
    }
    resetLoginWizard();
    showLoginError(se.message || 'Could not reach the server');
    return;
  }

  resetLoginWizard();
}

function showMainScreen() {
  document.getElementById('loading-screen').classList.remove('active');
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('main-screen').classList.add('active');
}

function switchView(view) {
  // Update navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-view="${view}"]`).classList.add('active');
  
  // Update views
  document.querySelectorAll('.view').forEach(v => {
    v.classList.remove('active');
  });
  document.getElementById(`${view}-view`).classList.add('active');
  
  state.currentView = view;
  
  // Load view data
  if (view === 'dashboard') {
    loadDashboard();
  } else if (view === 'projects') {
    loadProjects();
  } else if (view === 'entries') {
    loadTimeEntries();
    loadProjectsForFilter();
  } else if (view === 'invoices') {
    loadInvoices();
  } else if (view === 'expenses') {
    loadExpenses();
  } else if (view === 'workforce') {
    loadWorkforce();
  } else if (view === 'settings') {
    loadSettings();
  }
}

async function loadDashboard() {
  if (!state.apiClient) return;
  
  try {
    // Get timer status
    const timerResponse = await state.apiClient.getTimerStatus();
    if (timerResponse.data.active) {
      state.isTimerRunning = true;
      updateTimerDisplay(timerResponse.data.timer);
      startTimerPolling();
    }
    
    // Get today's summary
    const today = new Date().toISOString().split('T')[0];
    const entriesResponse = await state.apiClient.getTimeEntries({ startDate: today, endDate: today });
    const totalSeconds = entriesResponse.data.time_entries?.reduce((sum, entry) => {
      return sum + (entry.duration_seconds || 0);
    }, 0) || 0;
    
    document.getElementById('today-summary').textContent = formatDuration(totalSeconds);
    
    // Load recent entries
    loadRecentEntries();
  } catch (error) {
    console.error('Error loading dashboard:', error);
    if (error && error.stack) console.error(error.stack);
    const { message } = classifyAxiosError(error);
    showError(message || 'Could not load the dashboard.');
  }
}

async function loadRecentEntries() {
  if (!state.apiClient) return;
  
  try {
    const response = await state.apiClient.getTimeEntries({ perPage: 5 });
    const entries = response.data.time_entries || [];
    const entriesList = document.getElementById('recent-entries');
    
    if (entries.length === 0) {
      entriesList.innerHTML = '<p class="empty-state">No recent entries</p>';
      return;
    }
    
    entriesList.innerHTML = entries.map(entry => `
      <div class="entry-item">
        <div class="entry-info">
          <h3>${entry.project?.name || 'Unknown Project'}</h3>
          <p>${formatDateTime(entry.start_time)}</p>
        </div>
        <div class="entry-time">${formatDuration(entry.duration_seconds || 0)}</div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading recent entries:', error);
    if (error && error.stack) console.error(error.stack);
    const { message } = classifyAxiosError(error);
    showError(message || 'Could not load recent entries.');
  }
}

async function loadProjects() {
  if (!state.apiClient) return;
  
  try {
    const response = await state.apiClient.getProjects({ status: 'active' });
    const projects = response.data.projects || [];
    const projectsList = document.getElementById('projects-list');
    
    if (projects.length === 0) {
      projectsList.innerHTML = '<p class="empty-state">No projects found</p>';
      return;
    }
    
    projectsList.innerHTML = projects.map(project => `
      <div class="project-card" onclick="selectProject(${project.id})">
        <h3>${project.name}</h3>
        <p>${project.client || 'No client'}</p>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading projects:', error);
    if (error && error.stack) console.error(error.stack);
    const { message } = classifyAxiosError(error);
    showError(message || 'Could not load projects.');
  }
}

function selectProject(projectId) {
  currentFilters = {
    ...currentFilters,
    projectId: projectId || null,
  };
  switchView('entries');
}

let currentFilters = {
  startDate: null,
  endDate: null,
  projectId: null,
};

async function loadTimeEntries() {
  if (!state.apiClient) return;
  
  try {
    const params = { perPage: 50 };
    if (currentFilters.startDate) params.startDate = currentFilters.startDate;
    if (currentFilters.endDate) params.endDate = currentFilters.endDate;
    if (currentFilters.projectId) params.projectId = currentFilters.projectId;
    
    const response = await state.apiClient.getTimeEntries(params);
    const entries = response.data.time_entries || [];
    const entriesList = document.getElementById('entries-list');
    
    if (entries.length === 0) {
      entriesList.innerHTML = '<p class="empty-state">No time entries</p>';
      return;
    }
    
    entriesList.innerHTML = entries.map(entry => `
      <div class="entry-item" data-entry-id="${entry.id}">
        <div class="entry-info">
          <h3>${entry.project?.name || 'Unknown Project'}</h3>
          ${entry.task ? `<p class="entry-task">${entry.task.name}</p>` : ''}
          <p class="entry-time-range">
            ${formatDateTime(entry.start_time)} - ${entry.end_time ? formatDateTime(entry.end_time) : 'Running'}
          </p>
          ${entry.notes ? `<p class="entry-notes">${entry.notes}</p>` : ''}
          ${entry.tags ? `<p class="entry-tags">Tags: ${entry.tags}</p>` : ''}
          ${entry.billable ? '<span class="badge badge-success">Billable</span>' : ''}
        </div>
        <div class="entry-actions">
          <div class="entry-time">${formatDuration(entry.duration_seconds || 0)}</div>
          <button class="btn btn-sm btn-secondary" onclick="editTimeEntry(${entry.id})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteTimeEntry(${entry.id})">Delete</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading time entries:', error);
    showError('Failed to load time entries: ' + (error.response?.data?.error || error.message));
  }
}

function editTimeEntry(entryId) {
  showTimeEntryForm(entryId);
}

async function deleteTimeEntry(entryId) {
  if (!confirm('Are you sure you want to delete this time entry?')) {
    return;
  }
  
  if (!state.apiClient) return;
  
  try {
    await state.apiClient.deleteTimeEntry(entryId);
    loadTimeEntries();
    showSuccess('Time entry deleted successfully');
  } catch (error) {
    showError('Failed to delete time entry: ' + (error.response?.data?.error || error.message));
  }
}

async function handleStartTimer() {
  if (!state.apiClient) return;
  
  // Show project selection dialog
  const result = await showStartTimerDialog();
  if (!result) return; // User cancelled
  
  try {
    const response = await startTimerWithReconcile(state.apiClient, {
      projectId: result.projectId,
      taskId: result.taskId,
      notes: result.notes,
    });
    if (response.data && response.data.timer) {
      state.isTimerRunning = true;
      updateTimerDisplay(response.data.timer);
      startTimerPolling();
      document.getElementById('start-timer-btn').style.display = 'none';
      document.getElementById('stop-timer-btn').style.display = 'block';
    }
  } catch (error) {
    console.error('Failed to start timer:', error);
    if (error && error.stack) console.error(error.stack);
    const { message } = classifyAxiosError(error);
    showError(message || 'Failed to start timer: ' + (error.response?.data?.error || error.message));
  }
}

async function showStartTimerDialog() {
  return new Promise(async (resolve) => {
    // Load projects and time entry requirements
    let projects = [];
    let requirements = { require_task: false, require_description: false, description_min_length: 20 };
    try {
      const projectsResponse = await state.apiClient.getProjects({ status: 'active' });
      projects = projectsResponse.data.projects || [];
      try {
        const usersMeResponse = await state.apiClient.getUsersMe();
        if (usersMeResponse && usersMeResponse.time_entry_requirements) {
          requirements = usersMeResponse.time_entry_requirements;
        }
      } catch (meErr) {
        console.error('getUsersMe for timer dialog:', meErr);
        if (meErr && meErr.stack) console.error(meErr.stack);
        const { message } = classifyAxiosError(meErr);
        showError(message || 'Could not load time entry rules; using defaults.');
      }
    } catch (error) {
      console.error('Failed to load projects for timer dialog:', error);
      if (error && error.stack) console.error(error.stack);
      const { message } = classifyAxiosError(error);
      showError(message || 'Failed to load projects');
      resolve(null);
      return;
    }
    
    if (projects.length === 0) {
      showError('No active projects found');
      resolve(null);
      return;
    }
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Start Timer</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="timer-project-select">Project *</label>
            <select id="timer-project-select" class="form-control" required>
              <option value="">Select a project...</option>
              ${projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="timer-task-select">${requirements.require_task ? 'Task *' : 'Task (Optional)'}</label>
            <select id="timer-task-select" class="form-control">
              <option value="">No task</option>
            </select>
          </div>
          <div class="form-group">
            <label for="timer-notes-input">${requirements.require_description ? 'Notes *' : 'Notes (Optional)'}</label>
            <textarea id="timer-notes-input" class="form-control" rows="3" placeholder="What are you working on?"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
          <button class="btn btn-primary" id="start-timer-confirm">Start</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const projectSelect = modal.querySelector('#timer-project-select');
    const taskSelect = modal.querySelector('#timer-task-select');
    const notesInput = modal.querySelector('#timer-notes-input');
    const confirmBtn = modal.querySelector('#start-timer-confirm');
    
    // Load tasks when project changes
    projectSelect.addEventListener('change', async (e) => {
      const projectId = parseInt(e.target.value);
      if (!projectId) {
        taskSelect.innerHTML = '<option value="">No task</option>';
        return;
      }
      
      try {
        const tasksResponse = await state.apiClient.getTasks({ projectId: projectId });
        const tasks = tasksResponse.data.tasks || [];
        taskSelect.innerHTML = '<option value="">No task</option>' +
          tasks.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
      } catch (error) {
        console.error('Failed to load tasks:', error);
      }
    });
    
    // Handle confirm
    confirmBtn.addEventListener('click', () => {
      const projectId = parseInt(projectSelect.value);
      if (!projectId) {
        showError('Please select a project');
        return;
      }

      const taskId = taskSelect.value ? parseInt(taskSelect.value) : null;
      if (requirements.require_task && !taskId) {
        showError('A task must be selected when logging time for a project');
        return;
      }

      const notes = notesInput.value.trim();
      if (requirements.require_description) {
        if (!notes) {
          showError('A description is required when logging time');
          return;
        }
        const minLen = requirements.description_min_length || 20;
        if (notes.length < minLen) {
          showError(`Description must be at least ${minLen} characters`);
          return;
        }
      }
      
      modal.remove();
      resolve({ projectId, taskId, notes: notes || null });
    });
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        resolve(null);
      }
    });
  });
}

async function handleStopTimer() {
  if (!state.apiClient) return;
  
  try {
    await stopTimerWithReconcile(state.apiClient);
    state.isTimerRunning = false;
    stopTimerPolling();
    document.getElementById('timer-display').textContent = '00:00:00';
    document.getElementById('timer-project').textContent = 'No active timer';
    document.getElementById('timer-task').style.display = 'none';
    document.getElementById('timer-notes').style.display = 'none';
    document.getElementById('start-timer-btn').style.display = 'block';
    document.getElementById('stop-timer-btn').style.display = 'none';
    // Notify tray
    updateTimerDisplay(null);
    // Refresh entries list
    loadTimeEntries();
    loadRecentEntries();
  } catch (error) {
    console.error('Error stopping timer:', error);
    if (error && error.stack) console.error(error.stack);
    const { message } = classifyAxiosError(error);
    showError(message || 'Failed to stop timer: ' + (error.response?.data?.error || error.message));
  }
}

function startTimerPolling() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  
  state.timerInterval = setInterval(async () => {
    if (!state.apiClient || !state.isTimerRunning) return;
    
    try {
      const response = await state.apiClient.getTimerStatus();
      if (response.data.active) {
        updateTimerDisplay(response.data.timer);
      } else {
        state.isTimerRunning = false;
        stopTimerPolling();
      }
    } catch (error) {
      console.error('Error polling timer:', error);
      if (error && error.stack) console.error(error.stack);
      const { message } = classifyAxiosError(error);
      connectionManager.signalError(message || 'Lost connection while syncing the active timer.');
      updateConnectionFromManager();
      const now = Date.now();
      if (!state.lastTimerPollUserMessageAt || now - state.lastTimerPollUserMessageAt > 60000) {
        state.lastTimerPollUserMessageAt = now;
        showError(
          'Lost connection while syncing the active timer. Check the connection indicator; polling will retry.',
        );
      }
    }
  }, 5000); // Poll every 5 seconds
}

function stopTimerPolling() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function updateTimerDisplay(timer) {
  if (!timer) {
    // Notify tray that timer is stopped
    if (window.electronAPI && window.electronAPI.sendTimerStatus) {
      window.electronAPI.sendTimerStatus({ active: false });
    }
    return;
  }
  
  const startTime = new Date(timer.start_time);
  const now = new Date();
  const seconds = Math.floor((now - startTime) / 1000);
  
  document.getElementById('timer-display').textContent = formatDurationLong(seconds);
  document.getElementById('timer-project').textContent = timer.project?.name || 'Unknown Project';
  
  // Show task if available
  const taskEl = document.getElementById('timer-task');
  if (timer.task) {
    taskEl.textContent = timer.task.name;
    taskEl.style.display = 'block';
  } else {
    taskEl.style.display = 'none';
  }
  
  // Show notes if available
  const notesEl = document.getElementById('timer-notes');
  if (timer.notes) {
    notesEl.textContent = timer.notes;
    notesEl.style.display = 'block';
  } else {
    notesEl.style.display = 'none';
  }
  
  // Notify tray that timer is running
  if (window.electronAPI && window.electronAPI.sendTimerStatus) {
    window.electronAPI.sendTimerStatus({ active: true, timer: timer });
  }
}


async function loadInvoices() {
  if (!state.apiClient) return;

  try {
    const response = await state.apiClient.getInvoices({
      page: state.pagination.invoices.page,
      perPage: state.pagination.invoices.perPage,
    });
    state.cachedInvoices = response.data.invoices || [];
    state.viewLimits.invoices = 20;
    const pagination = response.data.pagination || {};
    state.pagination.invoices.totalPages = Number(pagination.pages || pagination.total_pages || 1) || 1;
    state.pagination.invoices.total = Number(pagination.total || state.cachedInvoices.length) || state.cachedInvoices.length;
    renderInvoices();
    renderInvoicePager();
  } catch (error) {
    console.error('Error loading invoices:', error);
    showError('Failed to load invoices: ' + (error.response?.data?.error || error.message));
  }
}

function renderInvoicePager() {
  const indicator = document.getElementById('invoice-page-indicator');
  const prevBtn = document.getElementById('invoice-prev-page-btn');
  const nextBtn = document.getElementById('invoice-next-page-btn');
  if (indicator) {
    indicator.textContent = `Page ${state.pagination.invoices.page}/${state.pagination.invoices.totalPages}`;
  }
  if (prevBtn) {
    prevBtn.disabled = state.pagination.invoices.page <= 1;
  }
  if (nextBtn) {
    nextBtn.disabled = state.pagination.invoices.page >= state.pagination.invoices.totalPages;
  }
}

async function changeInvoicePage(delta) {
  const nextPage = state.pagination.invoices.page + delta;
  if (nextPage < 1 || nextPage > state.pagination.invoices.totalPages) {
    return;
  }
  state.pagination.invoices.page = nextPage;
  await loadInvoices();
}

function renderInvoices() {
  const list = document.getElementById('invoices-list');
  if (!list) return;
  const filtered = state.cachedInvoices.filter((invoice) => {
    const q = state.viewFilters.invoiceQuery;
    if (!q) return true;
    const haystack = `${invoice.invoice_number || ''} ${invoice.client_name || ''} ${invoice.status || ''}`.toLowerCase();
    return haystack.includes(q);
  });
  if (filtered.length === 0) {
    list.innerHTML = '<p class="empty-state">No invoices</p>';
    return;
  }
  const limited = filtered.slice(0, state.viewLimits.invoices);
  const rowsHtml = limited.map((invoice) => {
    const number = invoice.invoice_number || invoice.id || 'N/A';
    const status = invoice.status || 'unknown';
    const total = invoice.total_amount ?? invoice.total ?? '-';
    const totalNumber = Number(invoice.total_amount ?? invoice.total ?? 0) || 0;
    return `
      <div class="entry-item">
        <div class="entry-info">
          <h3>Invoice ${number}</h3>
          <p>Status: ${status}</p>
        </div>
        <div class="entry-actions">
          <div class="entry-time">${total}</div>
          <button class="btn btn-sm btn-secondary" onclick="updateInvoiceStatusAction(${invoice.id}, 'sent')">Mark Sent</button>
          <button class="btn btn-sm btn-secondary" onclick="markInvoicePaidAction(${invoice.id}, ${totalNumber})">Mark Paid</button>
          <button class="btn btn-sm btn-danger" onclick="updateInvoiceStatusAction(${invoice.id}, 'cancelled')">Cancel</button>
        </div>
      </div>
    `;
  }).join('');
  const hasMore = filtered.length > limited.length;
  list.innerHTML = rowsHtml + (
    hasMore
      ? `<div style="padding-top:8px;"><button class="btn btn-secondary" onclick="loadMoreInvoices()">Load More</button></div>`
      : ''
  );
}

function loadMoreInvoices() {
  state.viewLimits.invoices += 20;
  renderInvoices();
}

async function loadExpenses() {
  if (!state.apiClient) return;

  try {
    const response = await state.apiClient.getExpenses({
      page: state.pagination.expenses.page,
      perPage: state.pagination.expenses.perPage,
    });
    state.cachedExpenses = response.data.expenses || [];
    state.viewLimits.expenses = 20;
    const pagination = response.data.pagination || {};
    state.pagination.expenses.totalPages = Number(pagination.pages || pagination.total_pages || 1) || 1;
    state.pagination.expenses.total = Number(pagination.total || state.cachedExpenses.length) || state.cachedExpenses.length;
    renderExpenses();
    renderExpensePager();
  } catch (error) {
    console.error('Error loading expenses:', error);
    showError('Failed to load expenses: ' + (error.response?.data?.error || error.message));
  }
}

function renderExpensePager() {
  const indicator = document.getElementById('expense-page-indicator');
  const prevBtn = document.getElementById('expense-prev-page-btn');
  const nextBtn = document.getElementById('expense-next-page-btn');
  if (indicator) {
    indicator.textContent = `Page ${state.pagination.expenses.page}/${state.pagination.expenses.totalPages}`;
  }
  if (prevBtn) {
    prevBtn.disabled = state.pagination.expenses.page <= 1;
  }
  if (nextBtn) {
    nextBtn.disabled = state.pagination.expenses.page >= state.pagination.expenses.totalPages;
  }
}

async function changeExpensePage(delta) {
  const nextPage = state.pagination.expenses.page + delta;
  if (nextPage < 1 || nextPage > state.pagination.expenses.totalPages) {
    return;
  }
  state.pagination.expenses.page = nextPage;
  await loadExpenses();
}

function renderExpenses() {
  const list = document.getElementById('expenses-list');
  if (!list) return;
  const filtered = state.cachedExpenses.filter((expense) => {
    const q = state.viewFilters.expenseQuery;
    if (!q) return true;
    const haystack = `${expense.title || ''} ${expense.category || ''} ${expense.expense_date || ''}`.toLowerCase();
    return haystack.includes(q);
  });
  if (filtered.length === 0) {
    list.innerHTML = '<p class="empty-state">No expenses</p>';
    return;
  }
  const limited = filtered.slice(0, state.viewLimits.expenses);
  const rowsHtml = limited.map((expense) => {
    const category = expense.category || 'General';
    const amount = expense.amount ?? '-';
    const date = expense.expense_date || expense.date || '';
    return `
      <div class="entry-item">
        <div class="entry-info">
          <h3>${category}</h3>
          <p>${date}</p>
        </div>
        <div class="entry-time">${amount}</div>
      </div>
    `;
  }).join('');
  const hasMore = filtered.length > limited.length;
  list.innerHTML = rowsHtml + (
    hasMore
      ? `<div style="padding-top:8px;"><button class="btn btn-secondary" onclick="loadMoreExpenses()">Load More</button></div>`
      : ''
  );
}

function loadMoreExpenses() {
  state.viewLimits.expenses += 20;
  renderExpenses();
}

async function loadWorkforce() {
  if (!state.apiClient) return;

  try {
    const start = new Date();
    start.setDate(start.getDate() - start.getDay() + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const startDate = start.toISOString().split('T')[0];
    const endDate = end.toISOString().split('T')[0];

    const [periodsResponse, capacityResponse, requestsResponse, balancesResponse] = await Promise.all([
      state.apiClient.getTimesheetPeriods({ startDate, endDate }),
      state.apiClient.getCapacityReport({ startDate, endDate }),
      state.apiClient.getTimeOffRequests({}),
      state.apiClient.getTimeOffBalances({}),
    ]);

    state.cachedWorkforce = {
      periods: periodsResponse.data.timesheet_periods || [],
      capacity: capacityResponse.data.capacity || [],
      timeOffRequests: requestsResponse.data.time_off_requests || [],
      balances: balancesResponse.data.balances || [],
    };
    state.viewLimits.timeoff = 20;
    renderWorkforce();
  } catch (error) {
    console.error('Error loading workforce view:', error);
    showError('Failed to load workforce data: ' + (error.response?.data?.error || error.message));
  }
}

function renderWorkforce() {
  renderPeriods();
  renderCapacity();
  renderTimeOffRequests();
  renderBalances();
}

function renderPeriods() {
  const periods = state.cachedWorkforce.periods || [];
  const periodsList = document.getElementById('periods-list');
  if (!periodsList) return;
  if (periods.length === 0) {
    periodsList.innerHTML = '<p class="empty-state">No periods</p>';
    return;
  }
  periodsList.innerHTML = periods.map((period) => `
    <div class="entry-item">
      <div class="entry-info">
        <h3>${period.period_start} - ${period.period_end}</h3>
        <p>Status: ${period.status}</p>
      </div>
      <div class="entry-actions">
        ${String(period.status || '').toLowerCase() === 'draft'
          ? `<button class="btn btn-sm btn-primary" onclick="submitTimesheetPeriodAction(${period.id})">Submit</button>`
          : ''}
        ${(String(period.status || '').toLowerCase() === 'submitted' && state.currentUserProfile.can_approve)
          ? `<button class="btn btn-sm btn-primary" onclick="reviewTimesheetPeriodAction(${period.id}, true)">Approve</button>`
          : ''}
        ${(String(period.status || '').toLowerCase() === 'submitted' && state.currentUserProfile.can_approve)
          ? `<button class="btn btn-sm btn-danger" onclick="reviewTimesheetPeriodAction(${period.id}, false)">Reject</button>`
          : ''}
        ${['draft', 'rejected'].includes(String(period.status || '').toLowerCase())
          ? `<button class="btn btn-sm btn-danger" onclick="deleteTimesheetPeriodAction(${period.id})">Delete</button>`
          : ''}
      </div>
    </div>
  `).join('');
}

function renderCapacity() {
  const capacity = state.cachedWorkforce.capacity || [];
  const capacityList = document.getElementById('capacity-list');
  if (!capacityList) return;
  if (capacity.length === 0) {
    capacityList.innerHTML = '<p class="empty-state">No capacity rows</p>';
    return;
  }
  capacityList.innerHTML = capacity.map((row) => {
    const username = row.username || row.user_id || 'User';
    const expected = row.expected_hours ?? 0;
    const allocated = row.allocated_hours ?? 0;
    const util = row.utilization_pct ?? 0;
    return `
      <div class="entry-item">
        <div class="entry-info">
          <h3>${username}</h3>
          <p>Expected ${expected}h | Allocated ${allocated}h</p>
        </div>
        <div class="entry-time">${util}%</div>
      </div>
    `;
  }).join('');
}

function renderTimeOffRequests() {
  const requests = state.cachedWorkforce.timeOffRequests || [];
  const timeoffList = document.getElementById('timeoff-list');
  if (!timeoffList) return;
  const filtered = requests.filter((req) => {
    const q = state.viewFilters.timeoffQuery;
    if (!q) return true;
    const haystack = `${req.leave_type_name || ''} ${req.status || ''} ${req.start_date || ''} ${req.end_date || ''}`.toLowerCase();
    return haystack.includes(q);
  });
  if (filtered.length === 0) {
    timeoffList.innerHTML = '<p class="empty-state">No time-off requests</p>';
    return;
  }
  const limited = filtered.slice(0, state.viewLimits.timeoff);
  const rowsHtml = limited.map((req) => {
    const leaveType = req.leave_type_name || 'Leave';
    const status = req.status || '';
    const pending = String(status).toLowerCase() === 'submitted';
    const canReview = pending && state.currentUserProfile.can_approve;
    return `
      <div class="entry-item">
        <div class="entry-info">
          <h3>${leaveType}</h3>
          <p>${req.start_date} - ${req.end_date}</p>
        </div>
        <div class="entry-actions">
          <div class="entry-time">${status}</div>
          ${canReview ? `<button class="btn btn-sm btn-primary" onclick="reviewTimeOffRequestAction(${req.id}, true)">Approve</button>` : ''}
          ${canReview ? `<button class="btn btn-sm btn-danger" onclick="reviewTimeOffRequestAction(${req.id}, false)">Reject</button>` : ''}
          ${['draft', 'submitted', 'cancelled'].includes(String(status).toLowerCase()) && (req.user_id === state.currentUserProfile.id || state.currentUserProfile.can_approve)
            ? `<button class="btn btn-sm btn-danger" onclick="deleteTimeOffRequestAction(${req.id})">Delete</button>`
            : ''}
        </div>
      </div>
    `;
  }).join('');
  const hasMore = filtered.length > limited.length;
  timeoffList.innerHTML = rowsHtml + (
    hasMore
      ? `<div style="padding-top:8px;"><button class="btn btn-secondary" onclick="loadMoreTimeOffRequests()">Load More</button></div>`
      : ''
  );
}

function loadMoreTimeOffRequests() {
  state.viewLimits.timeoff += 20;
  renderTimeOffRequests();
}

function renderBalances() {
  const balances = state.cachedWorkforce.balances || [];
  const balancesList = document.getElementById('balances-list');
  if (!balancesList) return;
  if (balances.length === 0) {
    balancesList.innerHTML = '<p class="empty-state">No leave balances</p>';
    return;
  }
  balancesList.innerHTML = balances.map((bal) => {
    const leaveType = bal.leave_type_name || 'Leave';
    const remaining = bal.remaining_hours ?? bal.balance_hours ?? 0;
    return `
      <div class="entry-item">
        <div class="entry-info">
          <h3>${leaveType}</h3>
        </div>
        <div class="entry-time">${remaining}h</div>
      </div>
    `;
  }).join('');
}

async function showCreateInvoiceDialog() {
  if (!state.apiClient) return;

  try {
    const [projectsResponse, clientsResponse] = await Promise.all([
      state.apiClient.getProjects({ status: 'active', perPage: 100 }),
      state.apiClient.getClients({ status: 'active', perPage: 100 }),
    ]);
    const projects = projectsResponse.data.projects || [];
    const clients = clientsResponse.data.clients || [];
    if (projects.length === 0 || clients.length === 0) {
      showError('Need at least one active project and client to create an invoice');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 560px;">
        <div class="modal-header">
          <h3>Create Invoice</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="invoice-project-select">Project *</label>
            <select id="invoice-project-select" class="form-control">
              ${projects.map((p) => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="invoice-client-select">Client *</label>
            <select id="invoice-client-select" class="form-control">
              ${clients.map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="invoice-due-date">Due date *</label>
            <input type="date" id="invoice-due-date" class="form-control" value="${new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
          <button class="btn btn-primary" id="invoice-create-btn">Create</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const createBtn = modal.querySelector('#invoice-create-btn');
    createBtn.addEventListener('click', async () => {
      const projectId = Number(modal.querySelector('#invoice-project-select').value);
      const clientId = Number(modal.querySelector('#invoice-client-select').value);
      const dueDate = modal.querySelector('#invoice-due-date').value;
      const client = clients.find((c) => Number(c.id) === clientId);
      if (!projectId || !clientId || !client || !dueDate) {
        showError('Please provide all required fields');
        return;
      }
      await state.apiClient.createInvoice({
        project_id: projectId,
        client_id: clientId,
        client_name: client.name,
        due_date: dueDate,
      });
      modal.remove();
      showSuccess('Invoice created successfully');
      await loadInvoices();
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  } catch (error) {
    showError('Failed to create invoice: ' + (error.response?.data?.error || error.message));
  }
}

async function submitTimesheetPeriodAction(periodId) {
  if (!state.apiClient) return;

  try {
    await state.apiClient.submitTimesheetPeriod(periodId);
    showSuccess('Timesheet period submitted');
    await loadWorkforce();
  } catch (error) {
    showError('Failed to submit period: ' + (error.response?.data?.error || error.message));
  }
}

async function reviewTimesheetPeriodAction(periodId, approve) {
  if (!state.apiClient) return;
  try {
    if (approve) {
      await state.apiClient.approveTimesheetPeriod(periodId, {});
      showSuccess('Timesheet period approved');
    } else {
      await state.apiClient.rejectTimesheetPeriod(periodId, {});
      showSuccess('Timesheet period rejected');
    }
    await loadWorkforce();
  } catch (error) {
    showError('Failed to review period: ' + (error.response?.data?.error || error.message));
  }
}

async function deleteTimesheetPeriodAction(periodId) {
  if (!state.apiClient) return;
  if (!confirm('Are you sure you want to delete this timesheet period?')) return;
  try {
    await state.apiClient.deleteTimesheetPeriod(periodId);
    showSuccess('Timesheet period deleted');
    await loadWorkforce();
  } catch (error) {
    showError('Failed to delete period: ' + (error.response?.data?.error || error.message));
  }
}

async function showCreateTimeOffDialog() {
  if (!state.apiClient) return;

  try {
    const leaveTypesResponse = await state.apiClient.getLeaveTypes();
    const leaveTypes = leaveTypesResponse.data.leave_types || [];
    if (leaveTypes.length === 0) {
      showError('No leave types available');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal';
    const today = new Date().toISOString().split('T')[0];
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 560px;">
        <div class="modal-header">
          <h3>Create Time-Off Request</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="timeoff-leave-type">Leave type *</label>
            <select id="timeoff-leave-type" class="form-control">
              ${leaveTypes.map((lt) => `<option value="${lt.id}">${lt.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="timeoff-start-date">Start date *</label>
            <input type="date" id="timeoff-start-date" class="form-control" value="${today}">
          </div>
          <div class="form-group">
            <label for="timeoff-end-date">End date *</label>
            <input type="date" id="timeoff-end-date" class="form-control" value="${today}">
          </div>
          <div class="form-group">
            <label for="timeoff-hours">Requested hours (optional)</label>
            <input type="number" step="0.25" id="timeoff-hours" class="form-control">
          </div>
          <div class="form-group">
            <label for="timeoff-comment">Comment (optional)</label>
            <textarea id="timeoff-comment" class="form-control" rows="2"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
          <button class="btn btn-primary" id="timeoff-create-btn">Create</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#timeoff-create-btn').addEventListener('click', async () => {
      const leaveTypeId = Number(modal.querySelector('#timeoff-leave-type').value);
      const startDate = modal.querySelector('#timeoff-start-date').value;
      const endDate = modal.querySelector('#timeoff-end-date').value;
      const hoursValue = modal.querySelector('#timeoff-hours').value.trim();
      const requestedHours = hoursValue ? Number(hoursValue) : null;
      const comment = modal.querySelector('#timeoff-comment').value.trim();
      if (!leaveTypeId || !startDate || !endDate) {
        showError('Please provide leave type and dates');
        return;
      }
      if (hoursValue && !Number.isFinite(requestedHours)) {
        showError('requested_hours must be numeric');
        return;
      }
      await state.apiClient.createTimeOffRequest({
        leaveTypeId,
        startDate,
        endDate,
        requestedHours,
        comment,
        submit: true,
      });
      modal.remove();
      showSuccess('Time-off request created');
      await loadWorkforce();
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  } catch (error) {
    showError('Failed to create time-off request: ' + (error.response?.data?.error || error.message));
  }
}

async function showCreateExpenseDialog() {
  if (!state.apiClient) return;
  try {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 560px;">
        <div class="modal-header">
          <h3>Create Expense</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="expense-title">Title *</label>
            <input type="text" id="expense-title" class="form-control" placeholder="Taxi to client office">
          </div>
          <div class="form-group">
            <label for="expense-category">Category *</label>
            <input type="text" id="expense-category" class="form-control" value="travel">
          </div>
          <div class="form-group">
            <label for="expense-amount">Amount *</label>
            <input type="number" step="0.01" id="expense-amount" class="form-control">
          </div>
          <div class="form-group">
            <label for="expense-date">Expense date *</label>
            <input type="date" id="expense-date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
          <button class="btn btn-primary" id="expense-create-btn">Create</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#expense-create-btn').addEventListener('click', async () => {
      const title = modal.querySelector('#expense-title').value.trim();
      const category = modal.querySelector('#expense-category').value.trim();
      const amount = Number(modal.querySelector('#expense-amount').value);
      const expenseDate = modal.querySelector('#expense-date').value;
      if (!title || !category || !expenseDate || !Number.isFinite(amount) || amount <= 0) {
        showError('Please provide valid title/category/amount/date');
        return;
      }
      await state.apiClient.createExpense({
        title,
        category,
        amount,
        expense_date: expenseDate,
      });
      modal.remove();
      showSuccess('Expense created successfully');
      await loadExpenses();
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  } catch (error) {
    showError('Failed to create expense: ' + (error.response?.data?.error || error.message));
  }
}

async function updateInvoiceStatusAction(invoiceId, status) {
  if (!state.apiClient) return;
  try {
    await state.apiClient.updateInvoice(invoiceId, { status });
    showSuccess(`Invoice marked ${status}`);
    await loadInvoices();
  } catch (error) {
    showError('Failed to update invoice: ' + (error.response?.data?.error || error.message));
  }
}

async function markInvoicePaidAction(invoiceId, totalAmount) {
  if (!state.apiClient) return;
  const amountPaid = Number(totalAmount || 0);
  if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
    showError('Invoice total is invalid; cannot mark paid');
    return;
  }
  try {
    await state.apiClient.updateInvoice(invoiceId, { amount_paid: amountPaid });
    showSuccess('Invoice marked paid');
    await loadInvoices();
  } catch (error) {
    showError('Failed to mark paid: ' + (error.response?.data?.error || error.message));
  }
}

async function reviewTimeOffRequestAction(requestId, approve) {
  if (!state.apiClient) return;
  try {
    if (approve) {
      await state.apiClient.approveTimeOffRequest(requestId, {});
      showSuccess('Time-off request approved');
    } else {
      await state.apiClient.rejectTimeOffRequest(requestId, {});
      showSuccess('Time-off request rejected');
    }
    await loadWorkforce();
  } catch (error) {
    showError('Failed to review time-off request: ' + (error.response?.data?.error || error.message));
  }
}

async function deleteTimeOffRequestAction(requestId) {
  if (!state.apiClient) return;
  if (!confirm('Are you sure you want to delete this time-off request?')) return;
  try {
    await state.apiClient.deleteTimeOffRequest(requestId);
    showSuccess('Time-off request deleted');
    await loadWorkforce();
  } catch (error) {
    showError('Failed to delete time-off request: ' + (error.response?.data?.error || error.message));
  }
}

async function loadSettings() {
  // Load current settings
  const serverUrl = await storeGet('server_url') || '';
  const username = await storeGet('username') || '';
  const autoSync = await storeGet('auto_sync');
  const syncInterval = await storeGet('sync_interval');
  
  const serverUrlInput = document.getElementById('settings-server-url');
  const usernameInput = document.getElementById('settings-username');
  const passwordInput = document.getElementById('settings-password');
  const autoSyncInput = document.getElementById('auto-sync');
  const syncIntervalInput = document.getElementById('sync-interval');
  
  if (serverUrlInput) {
    serverUrlInput.value = serverUrl ? ApiClient.normalizeBaseUrl(String(serverUrl)) : '';
  }
  if (usernameInput) {
    usernameInput.value = username ? String(username) : '';
  }
  if (passwordInput) {
    passwordInput.value = '';
  }
  if (autoSyncInput) {
    autoSyncInput.checked = autoSync !== null ? Boolean(autoSync) : true;
  }
  if (syncIntervalInput) {
    syncIntervalInput.value = (syncInterval || 60).toString();
  }
  updateSyncIntervalState();
}

function updateSyncIntervalState() {
  const autoSyncInput = document.getElementById('auto-sync');
  const syncIntervalInput = document.getElementById('sync-interval');
  if (!autoSyncInput || !syncIntervalInput) return;
  syncIntervalInput.disabled = !autoSyncInput.checked;
}

async function handleSaveSettings() {
  const serverUrlInput = document.getElementById('settings-server-url');
  const usernameInput = document.getElementById('settings-username');
  const passwordInput = document.getElementById('settings-password');
  const autoSyncInput = document.getElementById('auto-sync');
  const syncIntervalInput = document.getElementById('sync-interval');
  const messageDiv = document.getElementById('settings-message');
  
  if (!serverUrlInput || !usernameInput || !passwordInput || !autoSyncInput || !syncIntervalInput) return;
  
  const rawServer = serverUrlInput.value.trim();
  const normalizedInput = normalizeServerUrlInput(rawServer);
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const autoSync = autoSyncInput.checked;
  const syncInterval = parseInt(syncIntervalInput.value, 10);

  if (!normalizedInput || !isValidUrl(normalizedInput)) {
    showSettingsMessage('Please enter a valid server URL', 'error');
    return;
  }
  const serverUrl = ApiClient.normalizeBaseUrl(normalizedInput);

  if (!username || !password) {
    showSettingsMessage('Please enter your username and password to save settings', 'error');
    return;
  }

  if (Number.isNaN(syncInterval) || syncInterval < 10) {
    showSettingsMessage('Sync interval must be at least 10 seconds', 'error');
    return;
  }

  try {
    const saved = await connectionManager.saveServerAndCredentials(serverUrl, username, password, {
      auto_sync: autoSync,
      sync_interval: syncInterval,
    });
    if (!saved.ok) {
      showSettingsMessage(saved.message || saved.session?.message || 'Could not save settings.', 'error');
      updateConnectionFromManager();
      return;
    }
    state.authFailureStreak = 0;
    await loadCurrentUserProfile();
    updateConnectionFromManager();
    showSettingsMessage('Settings saved successfully!', 'success');
    passwordInput.value = '';
    serverUrlInput.value = serverUrl;
  } catch (error) {
    console.error('Error saving settings:', error);
    if (error && error.stack) console.error(error.stack);
    showSettingsMessage('Error saving settings: ' + (error.message || String(error)), 'error');
  }
}

async function handleTestConnection() {
  const serverUrlInput = document.getElementById('settings-server-url');
  const usernameInput = document.getElementById('settings-username');
  const passwordInput = document.getElementById('settings-password');
  const messageDiv = document.getElementById('settings-message');
  
  if (!serverUrlInput || !usernameInput || !passwordInput) return;
  
  const rawServer = serverUrlInput.value.trim();
  const normalizedInput = normalizeServerUrlInput(rawServer);
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!normalizedInput || !isValidUrl(normalizedInput)) {
    showSettingsMessage('Please enter a valid server URL', 'error');
    return;
  }
  const serverUrl = ApiClient.normalizeBaseUrl(normalizedInput);

  if (!username || !password) {
    showSettingsMessage('Please enter your username and password to test connection', 'error');
    return;
  }

  try {
    showSettingsMessage('Testing connection...', 'info');
    const r = await connectionManager.testServerAndCredentials(serverUrl, username, password);
    if (!r.ok) {
      showSettingsMessage(r.message || 'Connection test failed.', 'error');
      updateConnectionFromManager();
      return;
    }
    const snap = connectionManager.getSnapshot();
    if (snap.serverUrl === serverUrl && connectionManager.getClient()) {
      await connectionManager.validateSessionRefresh();
    }
    updateConnectionFromManager();
    const ver = r.app_version ? ` (${r.app_version})` : '';
    showSettingsMessage(`Connection successful: credentials are valid${ver}.`, 'success');
  } catch (error) {
    console.error('Error testing connection:', error);
    if (error && error.stack) console.error(error.stack);
    const { message } = classifyAxiosError(error);
    showSettingsMessage(message || 'Connection error: ' + error.message, 'error');
  }
}

function showSettingsMessage(message, type = 'info') {
  const messageDiv = document.getElementById('settings-message');
  if (!messageDiv) return;
  
  messageDiv.textContent = message;
  messageDiv.className = `message message-${type}`;
  messageDiv.style.display = 'block';
  
  // Auto-hide after 5 seconds for success/info messages
  if (type === 'success' || type === 'info') {
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 5000);
  }
}

async function handleLogout() {
  if (!confirm('Sign out of this desktop app? Your server URL will be kept.')) return;
  if (state.isTimerRunning) {
    state.isTimerRunning = false;
    stopTimerPolling();
  }
  await connectionManager.logoutKeepServer();
  showLoginScreen({ prefillServerUrl: connectionManager.getSnapshot().serverUrl || '' });
}

async function handleResetConfiguration() {
  if (
    !confirm(
      'Reset all app configuration (server URL, token, sync settings)? This cannot be undone.',
    )
  ) {
    return;
  }
  if (state.isTimerRunning) {
    state.isTimerRunning = false;
    stopTimerPolling();
  }
  await connectionManager.fullStoreReset();
  showLoginScreen({ prefillServerUrl: '', startAtServer: true });
}

// Initialize when DOM is ready
async function safeInitApp() {
  try {
    await initApp();
  } catch (err) {
    console.error('initApp failed:', err);
    try {
      showLoginScreen({
        prefillServerUrl: '',
        startAtServer: true,
        bannerMessage:
          'Startup failed. Please re-enter your server URL and sign in again.',
      });
    } catch (e) {
      console.error('Failed to show login screen after init failure:', e);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', safeInitApp);
} else {
  safeInitApp();
}

// Filter functions
function toggleFilters() {
  const filtersEl = document.getElementById('entries-filters');
  if (filtersEl) {
    filtersEl.style.display = filtersEl.style.display === 'none' ? 'block' : 'none';
  }
}

async function applyFilters() {
  const startDate = document.getElementById('filter-start-date')?.value || null;
  const endDate = document.getElementById('filter-end-date')?.value || null;
  const projectId = document.getElementById('filter-project')?.value 
    ? parseInt(document.getElementById('filter-project').value) 
    : null;
  
  currentFilters = { startDate, endDate, projectId };
  await loadTimeEntries();
}

function clearFilters() {
  currentFilters = { startDate: null, endDate: null, projectId: null };
  document.getElementById('filter-start-date').value = '';
  document.getElementById('filter-end-date').value = '';
  document.getElementById('filter-project').value = '';
  loadTimeEntries();
}

// Load projects for filter dropdown
async function loadProjectsForFilter() {
  if (!state.apiClient) return;
  
  try {
    const response = await state.apiClient.getProjects({ status: 'active' });
    const projects = response.data.projects || [];
    const select = document.getElementById('filter-project');
    if (select) {
      select.innerHTML = '<option value="">All Projects</option>' +
        projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
      if (currentFilters.projectId) {
        select.value = String(currentFilters.projectId);
      }
    }
  } catch (error) {
    console.error('Error loading projects for filter:', error);
    if (error && error.stack) console.error(error.stack);
    const { message } = classifyAxiosError(error);
    showError(message || 'Could not load projects for filter.');
  }
}

// Time entry form
async function showTimeEntryForm(entryId = null) {
  if (!state.apiClient) return;
  // Load projects and time entry requirements
  let projects = [];
  let requirements = { require_task: false, require_description: false, description_min_length: 20 };
  try {
    const projectsResponse = await state.apiClient.getProjects({ status: 'active' });
    projects = projectsResponse.data.projects || [];
    try {
      const usersMeResponse = await state.apiClient.getUsersMe();
      if (usersMeResponse && usersMeResponse.time_entry_requirements) {
        requirements = usersMeResponse.time_entry_requirements;
      }
    } catch (meErr) {
      console.error('getUsersMe for time entry form:', meErr);
      if (meErr && meErr.stack) console.error(meErr.stack);
      const { message } = classifyAxiosError(meErr);
      showError(message || 'Could not load time entry rules; using defaults.');
    }
  } catch (error) {
    console.error('Failed to load projects for time entry form:', error);
    if (error && error.stack) console.error(error.stack);
    const { message } = classifyAxiosError(error);
    showError(message || 'Failed to load projects');
    return;
  }
  
  // Load entry if editing
  let entry = null;
  if (entryId) {
    try {
      const entryResponse = await state.apiClient.getTimeEntry(entryId);
      entry = entryResponse.data.time_entry;
    } catch (error) {
      showError('Failed to load time entry');
      return;
    }
  }
  
  // Load tasks if project is selected
  let tasks = [];
  const projectId = entry ? entry.project_id : null;
  if (projectId) {
    try {
      const tasksResponse = await state.apiClient.getTasks({ projectId: projectId });
      tasks = tasksResponse.data.tasks || [];
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  }
  
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'modal';
  
  const startDate = entry 
    ? new Date(entry.start_time).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  const startTime = entry
    ? new Date(entry.start_time).toTimeString().slice(0, 5)
    : new Date().toTimeString().slice(0, 5);
  const endDate = entry && entry.end_time
    ? new Date(entry.end_time).toISOString().split('T')[0]
    : '';
  const endTime = entry && entry.end_time
    ? new Date(entry.end_time).toTimeString().slice(0, 5)
    : '';
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 600px;">
      <div class="modal-header">
        <h3>${entryId ? 'Edit' : 'Add'} Time Entry</h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="entry-project-select">Project *</label>
          <select id="entry-project-select" class="form-control" required>
            <option value="">Select a project...</option>
            ${projects.map(p => `<option value="${p.id}" ${entry && entry.project_id === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="entry-task-select">${requirements.require_task ? 'Task *' : 'Task (Optional)'}</label>
          <select id="entry-task-select" class="form-control">
            <option value="">No task</option>
            ${tasks.map(t => `<option value="${t.id}" ${entry && entry.task_id === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="entry-start-date">Start Date *</label>
            <input type="date" id="entry-start-date" class="form-control" value="${startDate}" required>
          </div>
          <div class="form-group">
            <label for="entry-start-time">Start Time *</label>
            <input type="time" id="entry-start-time" class="form-control" value="${startTime}" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="entry-end-date">End Date (Optional)</label>
            <input type="date" id="entry-end-date" class="form-control" value="${endDate}">
          </div>
          <div class="form-group">
            <label for="entry-end-time">End Time (Optional)</label>
            <input type="time" id="entry-end-time" class="form-control" value="${endTime}">
          </div>
        </div>
        <div class="form-group">
          <label for="entry-notes">${requirements.require_description ? 'Notes *' : 'Notes'}</label>
          <textarea id="entry-notes" class="form-control" rows="3">${entry?.notes || ''}</textarea>
        </div>
        <div class="form-group">
          <label for="entry-tags">Tags (comma-separated)</label>
          <input type="text" id="entry-tags" class="form-control" value="${entry?.tags || ''}">
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" id="entry-billable" ${entry ? (entry.billable ? 'checked' : '') : 'checked'}>
            Billable
          </label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
        <button class="btn btn-primary" id="save-entry-btn">${entryId ? 'Update' : 'Create'}</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const projectSelect = modal.querySelector('#entry-project-select');
  const taskSelect = modal.querySelector('#entry-task-select');
  const saveBtn = modal.querySelector('#save-entry-btn');
  
  // Load tasks when project changes
  projectSelect.addEventListener('change', async (e) => {
    const projectId = parseInt(e.target.value);
    if (!projectId) {
      taskSelect.innerHTML = '<option value="">No task</option>';
      return;
    }
    
    try {
      const tasksResponse = await state.apiClient.getTasks({ projectId: projectId });
      const tasks = tasksResponse.data.tasks || [];
      taskSelect.innerHTML = '<option value="">No task</option>' +
        tasks.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  });
  
  // Handle save
  saveBtn.addEventListener('click', async () => {
    const projectId = parseInt(projectSelect.value);
    if (!projectId) {
      showError('Please select a project');
      return;
    }

    const taskId = taskSelect.value ? parseInt(taskSelect.value) : null;
    if (requirements.require_task && !taskId) {
      showError('A task must be selected when logging time for a project');
      return;
    }

    const notesEl = document.getElementById('entry-notes');
    const notes = notesEl ? notesEl.value.trim() : '';
    if (requirements.require_description) {
      if (!notes) {
        showError('A description is required when logging time');
        return;
      }
      const minLen = requirements.description_min_length || 20;
      if (notes.length < minLen) {
        showError(`Description must be at least ${minLen} characters`);
        return;
      }
    }
    const startDate = document.getElementById('entry-start-date').value;
    const startTime = document.getElementById('entry-start-time').value;
    const endDate = document.getElementById('entry-end-date').value;
    const endTime = document.getElementById('entry-end-time').value;
    const notesForApi = notes || null;
    const tags = document.getElementById('entry-tags').value.trim() || null;
    const billable = document.getElementById('entry-billable').checked;
    
    const startDateTime = new Date(`${startDate}T${startTime}`).toISOString();
    const endDateTime = (endDate && endTime) 
      ? new Date(`${endDate}T${endTime}`).toISOString()
      : null;
    
    try {
      if (entryId) {
        await state.apiClient.updateTimeEntry(entryId, {
          project_id: projectId,
          task_id: taskId,
          start_time: startDateTime,
          end_time: endDateTime,
          notes: notesForApi,
          tags: tags,
          billable: billable,
        });
        showSuccess('Time entry updated successfully');
      } else {
        await state.apiClient.createTimeEntry({
          project_id: projectId,
          task_id: taskId,
          start_time: startDateTime,
          end_time: endDateTime,
          notes: notesForApi,
          tags: tags,
          billable: billable,
        });
        showSuccess('Time entry created successfully');
      }
      
      modal.remove();
      loadTimeEntries();
    } catch (error) {
      showError('Failed to save time entry: ' + (error.response?.data?.error || error.message));
    }
  });
  
  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}
