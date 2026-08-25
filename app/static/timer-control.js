(function () {
  'use strict';

  var modal;
  var currentTimer = null;
  var projects = [];
  var ticker = null;

  function label(name, fallback) {
    return modal && modal.dataset[name] ? modal.dataset[name] : fallback;
  }

  function escapeHtml(value) {
    var node = document.createElement('div');
    node.textContent = String(value || '');
    return node.innerHTML;
  }

  function csrfToken() {
    var meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.content || '' : '';
  }

  function formatElapsed(seconds) {
    seconds = Math.max(0, Math.floor(Number(seconds) || 0));
    var hours = Math.floor(seconds / 3600);
    var minutes = Math.floor((seconds % 3600) / 60);
    var secs = seconds % 60;
    return [hours, minutes, secs].map(function (value) { return String(value).padStart(2, '0'); }).join(':');
  }

  async function jsonRequest(url, options) {
    var response = await fetch(url, Object.assign({ credentials: 'same-origin' }, options || {}));
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok || data.success === false) throw new Error(data.error || data.message || 'Action failed');
    return data;
  }

  function setStatus(message, danger) {
    var node = document.getElementById('eviltimeTimerControlStatus');
    if (!node) return;
    node.textContent = message || '';
    node.classList.toggle('text-red-600', Boolean(danger));
    node.classList.toggle('text-slate-500', !danger);
  }

  function elapsedSeconds() {
    if (!currentTimer) return 0;
    if (currentTimer.paused) return Number(currentTimer.current_duration || 0);
    var start = new Date(currentTimer.start_time);
    if (Number.isNaN(start.getTime())) return Number(currentTimer.current_duration || 0);
    return Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000) - Number(currentTimer.break_seconds || 0));
  }

  function renderCurrent() {
    var state = document.getElementById('eviltimeTimerState');
    var project = document.getElementById('eviltimeTimerProject');
    var elapsed = document.getElementById('eviltimeTimerElapsed');
    var actions = document.getElementById('eviltimeTimerActions');
    var pauseButton = actions && actions.querySelector('[data-timer-action="pause"], [data-timer-action="resume"]');
    if (!state || !project || !elapsed || !actions) return;
    window.clearInterval(ticker);
    if (!currentTimer) {
      state.textContent = label('readyLabel', 'Ready to clock in');
      project.textContent = label('selectLabel', 'Select a project below');
      elapsed.textContent = '00:00:00';
      actions.classList.add('hidden');
      actions.classList.remove('flex');
      return;
    }
    state.textContent = currentTimer.paused ? label('breakLabel', 'On break') : label('clockedInLabel', 'Clocked in');
    project.textContent = currentTimer.project_name || 'Project';
    actions.classList.remove('hidden');
    actions.classList.add('flex');
    if (pauseButton) {
      pauseButton.dataset.timerAction = currentTimer.paused ? 'resume' : 'pause';
      pauseButton.innerHTML = currentTimer.paused
        ? '<i class="fas fa-play"></i><span>' + label('endBreakLabel', 'End break') + '</span>'
        : '<i class="fas fa-mug-hot"></i><span>' + label('startBreakLabel', 'Start break') + '</span>';
    }
    var tick = function () { elapsed.textContent = formatElapsed(elapsedSeconds()); };
    tick();
    if (!currentTimer.paused) ticker = window.setInterval(tick, 1000);
  }

  function projectIcon(item) {
    if (item.icon_emoji) return '<span class="text-xl">' + escapeHtml(item.icon_emoji) + '</span>';
    var code = String(item.code || item.name || 'P').slice(0, 3).toUpperCase();
    return '<span class="text-[10px] font-bold text-white">' + escapeHtml(code) + '</span>';
  }

  function renderProjects(query) {
    var list = document.getElementById('eviltimeTimerProjects');
    if (!list) return;
    var normalized = String(query || '').trim().toLowerCase();
    var visible = projects.filter(function (item) {
      return !normalized || (String(item.name || '') + ' ' + String(item.code || '')).toLowerCase().includes(normalized);
    });
    list.innerHTML = '';
    visible.forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'group flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-primary/50 hover:bg-primary/5 dark:border-slate-700 dark:hover:bg-primary/10';
      button.innerHTML = '<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style="background:' + (item.color || '#64748b') + '">' + projectIcon(item) + '</span><span class="min-w-0"><span class="block truncate text-sm font-semibold text-slate-900 dark:text-white">' + escapeHtml(item.name || 'Project') + '</span><span class="block text-xs text-slate-500">' + escapeHtml(currentTimer ? label('switchLabel', 'Switch project') : label('clockInLabel', 'Clock in')) + '</span></span><i class="fas fa-arrow-right ml-auto text-xs text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-primary"></i>';
      button.addEventListener('click', function () { chooseProject(item.id); });
      list.appendChild(button);
    });
    if (!visible.length) list.innerHTML = '<p class="col-span-full py-6 text-center text-sm text-slate-500">' + label('noProjectsLabel', 'No projects found.') + '</p>';
  }

  async function refresh() {
    var results = await Promise.all([
      jsonRequest('/api/timer/status'),
      projects.length ? Promise.resolve({ projects: projects }) : jsonRequest('/api/projects'),
    ]);
    currentTimer = results[0].active ? results[0].timer : null;
    projects = Array.isArray(results[1].projects) ? results[1].projects : [];
    renderCurrent();
    renderProjects(document.getElementById('eviltimeTimerProjectSearch')?.value || '');
  }

  async function chooseProject(projectId) {
    var wasActive = Boolean(currentTimer);
    setStatus(wasActive ? label('switchingLabel', 'Switching project…') : label('clockingInLabel', 'Clocking in…'));
    try {
      await jsonRequest(wasActive ? '/api/timer/switch' : '/api/timer/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
        body: JSON.stringify({ project_id: projectId }),
      });
      await refresh();
      setStatus(wasActive ? label('switchedLabel', 'Project switched.') : label('clockedInLabel', 'Clocked in.'));
      document.dispatchEvent(new CustomEvent('eviltime:timer-changed'));
    } catch (error) { setStatus(error.message, true); }
  }

  async function timerAction(action) {
    var endpoint = action === 'stop' ? '/api/timer/stop' : '/api/timer/' + action + '-current';
    setStatus(action === 'stop' ? label('clockingOutLabel', 'Clocking out…') : label('updatingBreakLabel', 'Updating break…'));
    try {
      await jsonRequest(endpoint, { method: 'POST', headers: { 'X-CSRFToken': csrfToken() } });
      await refresh();
      setStatus(action === 'stop' ? label('clockedOutLabel', 'Clocked out.') : label('timerUpdatedLabel', 'Timer updated.'));
      document.dispatchEvent(new CustomEvent('eviltime:timer-changed'));
    } catch (error) { setStatus(error.message, true); }
  }

  function open() {
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.classList.add('overflow-hidden');
    setStatus('');
    refresh().then(function () {
      document.getElementById('eviltimeTimerProjectSearch')?.focus();
    }).catch(function (error) { setStatus(error.message, true); });
  }

  function close() {
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.classList.remove('overflow-hidden');
    window.clearInterval(ticker);
  }

  document.addEventListener('DOMContentLoaded', function () {
    modal = document.getElementById('eviltimeTimerControl');
    if (!modal) return;
    modal.querySelectorAll('[data-timer-control-close]').forEach(function (button) { button.addEventListener('click', close); });
    modal.addEventListener('click', function (event) {
      var action = event.target.closest('[data-timer-action]');
      if (action) timerAction(action.dataset.timerAction);
    });
    document.getElementById('eviltimeTimerProjectSearch')?.addEventListener('input', function (event) { renderProjects(event.target.value); });
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
  });

  window.evilTimeTimerControl = { open: open, close: close, refresh: refresh, action: timerAction };
})();
