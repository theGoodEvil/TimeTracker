/** EvilTime dashboard timers, notification permissions, and weekly edit overlay. */
(function () {
  'use strict';

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function formatElapsed(value) {
    var seconds = Math.max(0, Math.floor(Number(value) || 0));
    var hours = Math.floor(seconds / 3600);
    var minutes = Math.floor((seconds % 3600) / 60);
    var remainder = seconds % 60;
    return [hours, minutes, remainder].map(function (part) {
      return String(part).padStart(2, '0');
    }).join(':');
  }

  function initDashboard() {
    var root = document.getElementById('eviltime-dashboard');
    if (!root) return;

    var work = document.getElementById('eviltime-today-work');
    var breakTime = document.getElementById('eviltime-today-break');
    var timer = document.getElementById('eviltime-active-timer');
    var baseWork = Number(work && work.dataset.seconds) || 0;
    var baseBreak = Number(breakTime && breakTime.dataset.seconds) || 0;
    var baseTimer = Number(timer && timer.dataset.seconds) || 0;
    var running = root.dataset.timerRunning === 'true';
    var paused = root.dataset.timerPaused === 'true';
    var loadedAt = Date.now();

    function elapsedSinceLoad() {
      return Math.max(0, Math.floor((Date.now() - loadedAt) / 1000));
    }

    function drawTimers() {
      var elapsed = elapsedSinceLoad();
      if (work) work.textContent = formatElapsed(baseWork + (running ? elapsed : 0));
      if (breakTime) breakTime.textContent = formatElapsed(baseBreak + (paused ? elapsed : 0));
      if (timer) timer.textContent = formatElapsed(baseTimer + (running ? elapsed : 0));
    }

    drawTimers();
    window.setInterval(drawTimers, 1000);

    var notificationButton = document.getElementById('enableBrowserNotifications');
    var notificationStatus = document.getElementById('browserNotificationStatus');
    if (notificationButton) {
      var enableLabel = notificationButton.textContent;

      function setNotificationState(label, message, disabled) {
        notificationButton.textContent = label;
        notificationButton.disabled = disabled;
        if (notificationStatus) notificationStatus.textContent = message || '';
      }

      function syncNotificationState(showDefaultMessage) {
        if (!window.isSecureContext || !('Notification' in window)) {
          setNotificationState(
            root.dataset.notificationUnavailable,
            root.dataset.notificationUnavailable,
            true
          );
          return;
        }
        if (Notification.permission === 'granted') {
          setNotificationState(root.dataset.notificationEnabled, root.dataset.notificationReady, true);
        } else if (Notification.permission === 'denied') {
          setNotificationState(root.dataset.notificationBlocked, root.dataset.notificationDenied, true);
        } else {
          setNotificationState(enableLabel, showDefaultMessage ? root.dataset.notificationNotGranted : '', false);
        }
      }

      notificationButton.addEventListener('click', function () {
        if (!window.isSecureContext || !('Notification' in window)) {
          syncNotificationState();
          return;
        }
        notificationButton.disabled = true;
        if (notificationStatus) notificationStatus.textContent = root.dataset.notificationRequesting;
        try {
          var permissionRequest = Notification.requestPermission();
          if (permissionRequest && typeof permissionRequest.then === 'function') {
            permissionRequest.then(function () { syncNotificationState(true); }).catch(function () {
              setNotificationState(enableLabel, root.dataset.notificationFailed, false);
            });
          } else {
            window.setTimeout(function () { syncNotificationState(true); }, 500);
          }
        } catch (_) {
          setNotificationState(enableLabel, root.dataset.notificationFailed, false);
        }
      });
      syncNotificationState(false);
    }

    if (typeof window.io !== 'undefined') {
      try {
        var socket = window.io();
        var userId = Number(root.dataset.userId);
        socket.on('connect', function () {
          socket.emit('join_user_room', { user_id: userId });
        });
        ['timer_started', 'timer_stopped', 'timer_paused', 'timer_resumed'].forEach(function (eventName) {
          socket.on(eventName, function (data) {
            if (!data || Number(data.user_id) === userId) window.location.reload();
          });
        });
      } catch (_) {}
    }
  }

  function initWeeklyEditModal() {
    var modal = document.getElementById('weeklyEditModal');
    if (!modal) return;
    var label = document.getElementById('weeklyEditModalLabel');
    var start = document.getElementById('weeklyEditStart');
    var expected = document.getElementById('weeklyEditExpected');
    var actual = document.getElementById('weeklyEditActual');
    var notes = document.getElementById('weeklyEditNotes');
    var lastTrigger = null;

    function openModal(trigger) {
      lastTrigger = trigger;
      label.textContent = trigger.dataset.weekLabel || '';
      start.value = trigger.dataset.weekStart || '';
      expected.value = trigger.dataset.expectedHours || '';
      actual.value = trigger.dataset.actualHours || '';
      notes.value = trigger.dataset.notes || '';
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      document.body.classList.add('overflow-hidden');
      window.setTimeout(function () { expected.focus(); expected.select(); }, 0);
    }

    function closeModal() {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      document.body.classList.remove('overflow-hidden');
      if (lastTrigger) lastTrigger.focus();
    }

    document.querySelectorAll('[data-week-edit]').forEach(function (trigger) {
      trigger.addEventListener('click', function () { openModal(trigger); });
    });
    modal.querySelectorAll('[data-week-modal-close]').forEach(function (button) {
      button.addEventListener('click', closeModal);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
    });
  }

  onReady(function () {
    initDashboard();
    initWeeklyEditModal();
  });
})();
