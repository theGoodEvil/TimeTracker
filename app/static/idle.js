// Client liveness and optional work reminders. Inactivity never stops a timer.
(function(){
  if (window.__ttIdleLoaded) return; window.__ttIdleLoaded = true;

  const CHECK_INTERVAL_MS = 60 * 1000; // 1 minute

  let lastHeartbeatSent = 0;
  let hasActiveTimer = false;
  const HEARTBEAT_THROTTLE_MS = 60 * 1000;

  function sendHeartbeat(){
    if (!hasActiveTimer) return;
    const now = Date.now();
    if (now - lastHeartbeatSent < HEARTBEAT_THROTTLE_MS) return;
    lastHeartbeatSent = now;
    try {
      fetch('/api/timer/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        __ttQuiet: true,
      }).catch(function(){});
    } catch(e) {}
  }

  function markActive(){
    sendHeartbeat();
  }

  ['mousemove','keydown','scroll','click','touchstart','visibilitychange'].forEach(evt =>
    document.addEventListener(evt, markActive, { passive: true })
  );

  async function getTimer(){
    try {
      const r = await fetch('/api/timer/status', { __ttQuiet: true });
      if (!r.ok) return null; const j = await r.json();
      return j && j.active ? j.timer : null;
    } catch(e){ return null; }
  }

  async function tick(){
    const active = await getTimer();
    hasActiveTimer = !!active;
    if (!active) return;
    // Browser inactivity is not clock-out evidence. A sleeping or throttled
    // tab must never stop a persisted EvilTime work session.
    // Break reminder follows the active timer state; check on every tick.
    try { checkBreakNudge(active); } catch(e) {}
    try { checkBreakFinished(active); } catch(e) {}
  }

  function checkBreakFinished(activeTimer){
    if (!activeTimer || !activeTimer.paused || !activeTimer.paused_at) return;
    if ((Number(activeTimer.paused_duration_seconds) || 0) < 30 * 60) return;
    const key = 'eviltime-break-finished:' + activeTimer.id + ':' + activeTimer.paused_at;
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, String(Date.now())); } catch(e) {}
    const title = window.i18n?.messages?.breakFinishedTitle || 'Break is over';
    const message = window.i18n?.messages?.breakFinishedMessage || 'Your 30-minute break is over.';
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(function(registration){
            registration.showNotification(title, { body: message, icon: '/static/images/timetracker-logo.svg', tag: key, data: { url: '/' } });
          }).catch(function(){ new Notification(title, { body: message, tag: key }); });
        } else {
          new Notification(title, { body: message, tag: key });
        }
      } catch(e) {}
    }
    if (!activeReminderToast) {
      buildReminderToast('purple', escapeHtml(message), [
        { label: (window.i18n?.messages?.endBreak || 'End break'), style: 'primary', onClick: function(){ window.floatingTimerBar?.resumeTimer(); } },
        { label: (window.i18n?.messages?.dismiss || 'Dismiss'), style: 'link' }
      ], 60000);
    }
  }

  // Prime active-timer flag soon after load so early activity can heartbeat.
  setTimeout(function(){ tick(); }, 2000);

  setInterval(tick, CHECK_INTERVAL_MS);

  // ---------------------------------------------------------------------------
  // Smart reminder toasts (no-timer nudge, break reminder, end-of-day reminder)
  // ---------------------------------------------------------------------------
  const REMINDER_POLL_MS = 5 * 60 * 1000; // 5 minutes

  let noTimerNudgeShown = false;
  let endOfDayNudgeShown = false;
  let breakNudgeShown = false;
  let activeReminderToast = null;
  let lastTimerIdForBreak = null;
  let lastNotificationsFetch = { at: 0, payload: null };
  let lastResetDay = new Date().toDateString();

  function resetReminderFlagsIfNewDay(){
    const today = new Date().toDateString();
    if (today !== lastResetDay){
      lastResetDay = today;
      noTimerNudgeShown = false;
      endOfDayNudgeShown = false;
      breakNudgeShown = false;
    }
  }

  function todayIsoLocal(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  async function fetchNotifications(forceRefresh){
    const now = Date.now();
    if (!forceRefresh && lastNotificationsFetch.payload && (now - lastNotificationsFetch.at) < REMINDER_POLL_MS){
      return lastNotificationsFetch.payload;
    }
    try {
      const r = await fetch('/api/notifications', {
        headers: { 'Accept': 'application/json' },
        __ttQuiet: true,
      });
      if (!r.ok) return null;
      const j = await r.json();
      lastNotificationsFetch = { at: now, payload: j };
      return j;
    } catch(e){ return null; }
  }

  function findNotification(payload, kind){
    if (!payload || !Array.isArray(payload.notifications)) return null;
    return payload.notifications.find(function(n){ return n && n.kind === kind; }) || null;
  }

  async function dismissNotification(kind, localDate){
    try {
      await fetch('/api/notifications/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: kind, local_date: localDate || todayIsoLocal() })
      });
    } catch(e) {}
  }

  function getToastContainer(){
    return document.getElementById('toast-notification-container') ||
      document.getElementById('flash-messages-container') || document.body;
  }

  // Pre-built class strings per color so Tailwind's content scan sees literal classes.
  // Keep complete literal class names so Tailwind can include every variant.
  const TOAST_CLASSES = {
    blue: {
      wrap: 'flex items-center gap-3 p-4 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg shadow-lg pointer-events-auto',
      body: 'flex-1 text-sm text-blue-900 dark:text-blue-100',
      primary: 'px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium',
      secondary: 'px-3 py-1.5 bg-blue-200 dark:bg-blue-800 hover:bg-blue-300 dark:hover:bg-blue-700 text-blue-900 dark:text-blue-100 rounded text-sm font-medium',
      link: 'px-3 py-1.5 text-blue-700 dark:text-blue-300 hover:underline text-sm'
    },
    purple: {
      wrap: 'flex items-center gap-3 p-4 bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700 rounded-lg shadow-lg pointer-events-auto',
      body: 'flex-1 text-sm text-purple-900 dark:text-purple-100',
      primary: 'px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium',
      secondary: 'px-3 py-1.5 bg-purple-200 dark:bg-purple-800 hover:bg-purple-300 dark:hover:bg-purple-700 text-purple-900 dark:text-purple-100 rounded text-sm font-medium',
      link: 'px-3 py-1.5 text-purple-700 dark:text-purple-300 hover:underline text-sm'
    },
    green: {
      wrap: 'flex items-center gap-3 p-4 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg shadow-lg pointer-events-auto',
      body: 'flex-1 text-sm text-green-900 dark:text-green-100',
      primary: 'px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium',
      secondary: 'px-3 py-1.5 bg-green-200 dark:bg-green-800 hover:bg-green-300 dark:hover:bg-green-700 text-green-900 dark:text-green-100 rounded text-sm font-medium',
      link: 'px-3 py-1.5 text-green-700 dark:text-green-300 hover:underline text-sm'
    }
  };

  function buildReminderToast(colorKey, message, buttons, autoDismissMs, onClose){
    const cls = TOAST_CLASSES[colorKey] || TOAST_CLASSES.blue;
    const toastEl = document.createElement('div');
    toastEl.className = cls.wrap;
    let html = '<div class="' + cls.body + '">' + message + '</div>';
    html += '<div class="flex gap-2">';
    buttons.forEach(function(b, idx){
      const klass = b.style === 'secondary' ? cls.secondary : (b.style === 'link' ? cls.link : cls.primary);
      html += '<button class="' + klass + '" data-act="' + idx + '">' + b.label + '</button>';
    });
    html += '</div>';
    toastEl.innerHTML = html;
    function close(){
      try { toastEl.remove(); } catch(e){}
      if (activeReminderToast === toastEl) activeReminderToast = null;
      if (typeof onClose === 'function') onClose();
    }
    buttons.forEach(function(b, idx){
      const btn = toastEl.querySelector('[data-act="' + idx + '"]');
      if (btn) btn.addEventListener('click', function(){
        close();
        try { if (typeof b.onClick === 'function') b.onClick(); } catch(e){}
      });
    });
    getToastContainer().appendChild(toastEl);
    activeReminderToast = toastEl;
    if (autoDismissMs > 0){
      setTimeout(function(){ if (document.body.contains(toastEl)) close(); }, autoDismissMs);
    }
    return toastEl;
  }

  function escapeHtml(s){
    return String(s || '').replace(/[&<>"']/g, function(c){
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
    });
  }

  async function checkNoTimerAndEndOfDayNudges(){
    resetReminderFlagsIfNewDay();
    if (noTimerNudgeShown && endOfDayNudgeShown) return;
    if (activeReminderToast) return;
    const payload = await fetchNotifications(false);
    if (!payload) return;

    // No-timer nudge
    if (!noTimerNudgeShown && !activeReminderToast){
      const note = findNotification(payload, 'no_tracking_today');
      if (note){
        noTimerNudgeShown = true;
        const msg = escapeHtml(note.message || 'You have not tracked anything today.');
        buildReminderToast(
          'blue',
          msg,
          [
            { label: (window.i18n?.messages?.startTimer || 'Start timer'), style: 'primary', onClick: function(){ window.location.href = '/'; } },
            { label: (window.i18n?.messages?.dismiss || 'Dismiss'), style: 'link', onClick: function(){ dismissNotification('no_tracking_today'); } }
          ],
          30000
        );
      }
    }

    // End-of-day reminder
    if (!endOfDayNudgeShown && !activeReminderToast){
      const note = findNotification(payload, 'end_of_day_reminder');
      if (note){
        endOfDayNudgeShown = true;
        const msg = escapeHtml(note.message || "It's nearly end of day.");
        buildReminderToast(
          'green',
          msg,
          [
            { label: (window.i18n?.messages?.viewEntries || 'View entries'), style: 'primary', onClick: function(){ window.location.href = '/time-entries'; } },
            { label: (window.i18n?.messages?.dismiss || 'Dismiss'), style: 'link', onClick: function(){ dismissNotification('end_of_day_reminder'); } }
          ],
          60000
        );
      }
    }
  }

  async function checkBreakNudge(activeTimer){
    resetReminderFlagsIfNewDay();
    // Reset the per-timer flag whenever the active timer changes (new session = new reminders).
    const tid = activeTimer && activeTimer.id;
    if (tid !== lastTimerIdForBreak){
      lastTimerIdForBreak = tid;
      breakNudgeShown = false;
    }
    if (breakNudgeShown || activeReminderToast || !activeTimer) return;
    const payload = await fetchNotifications(false);
    if (!payload) return;
    const note = findNotification(payload, 'break_reminder');
    if (!note) return;
    breakNudgeShown = true;
    const msg = escapeHtml(note.message || 'Time for a break.');
    buildReminderToast(
      'purple',
      msg,
      [
        {
          label: (window.i18n?.messages?.pauseTimer || 'Pause timer'),
          style: 'primary',
          onClick: async function(){
            try { await fetch('/timer/pause', { method: 'POST' }); } catch(e){}
            location.reload();
          }
        },
        {
          label: (window.i18n?.messages?.snooze15 || 'Snooze 15 min'),
          style: 'secondary',
          onClick: function(){
            // Client-side snooze: keep the per-timer flag set for 15 minutes so the
            // server-emitted notification is suppressed locally, then re-arm.
            breakNudgeShown = true;
            setTimeout(function(){ breakNudgeShown = false; }, 15 * 60 * 1000);
          }
        },
        { label: (window.i18n?.messages?.dismiss || 'Dismiss'), style: 'link', onClick: function(){ dismissNotification('break_reminder'); } }
      ],
      45000
    );
  }

  setInterval(checkNoTimerAndEndOfDayNudges, REMINDER_POLL_MS);
  setTimeout(checkNoTimerAndEndOfDayNudges, 5000);

})();
