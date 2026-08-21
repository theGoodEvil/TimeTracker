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

  function formatHoursMinutes(value) {
    var totalMinutes = Math.max(0, Math.round((Number(value) || 0) / 60));
    return Math.floor(totalMinutes / 60) + ':' + String(totalMinutes % 60).padStart(2, '0') + 'h';
  }

  function formatSignedHoursMinutes(value) {
    var seconds = Number(value) || 0;
    var sign = seconds > 0 ? '+' : (seconds < 0 ? '-' : '');
    var totalMinutes = Math.round(Math.abs(seconds) / 60);
    return sign + Math.floor(totalMinutes / 60) + ':' + String(totalMinutes % 60).padStart(2, '0') + 'h';
  }

  function initDashboard() {
    var root = document.getElementById('eviltime-dashboard');
    if (!root) return;

    var work = document.getElementById('eviltime-today-work');
    var breakTime = document.getElementById('eviltime-today-break');
    var timer = document.getElementById('eviltime-active-timer');
    var weekActual = document.getElementById('eviltime-week-actual');
    var weekToday = document.getElementById('eviltime-week-today');
    var weekProgress = document.getElementById('eviltime-week-progress');
    var timeBalance = document.getElementById('eviltime-time-balance');
    var balanceIcon = document.getElementById('eviltime-balance-icon');
    var baseWork = Number(work && work.dataset.seconds) || 0;
    var baseBreak = Number(breakTime && breakTime.dataset.seconds) || 0;
    var baseTimer = Number(timer && timer.dataset.seconds) || 0;
    var baseWeekActual = Number(weekActual && weekActual.dataset.seconds) || 0;
    var baseWeekToday = Number(weekToday && weekToday.dataset.seconds) || 0;
    var expectedWeekSeconds = Number(weekProgress && weekProgress.dataset.expectedSeconds) || 0;
    var baseTimeBalance = Number(timeBalance && timeBalance.dataset.seconds) || 0;
    var balanceLive = !timeBalance || timeBalance.dataset.live !== 'false';
    var weekLive = !weekActual || weekActual.dataset.live !== 'false';
    var running = root.dataset.timerRunning === 'true';
    var paused = root.dataset.timerPaused === 'true';
    var timerDisplay = root.dataset.timerDisplay || 'work';
    var loadedAt = Date.now();

    function elapsedSinceLoad() {
      return Math.max(0, Math.floor((Date.now() - loadedAt) / 1000));
    }

    function drawTimers() {
      var elapsed = elapsedSinceLoad();
      if (work) work.textContent = formatElapsed(baseWork + (running ? elapsed : 0));
      if (breakTime) breakTime.textContent = formatElapsed(baseBreak + (paused ? elapsed : 0));
      if (timer) timer.textContent = formatElapsed(baseTimer + (timerDisplay === 'break' ? (paused ? elapsed : 0) : (running ? elapsed : 0)));
      var liveWeekSeconds = baseWeekActual + (running && weekLive ? elapsed : 0);
      if (weekActual) weekActual.textContent = formatHoursMinutes(liveWeekSeconds);
      if (weekToday) weekToday.textContent = formatHoursMinutes(baseWeekToday + (running ? elapsed : 0));
      if (weekProgress) {
        var progress = expectedWeekSeconds > 0 ? Math.min(100, liveWeekSeconds / expectedWeekSeconds * 100) : 0;
        weekProgress.style.width = progress + '%';
      }
      if (timeBalance) {
        var liveBalance = baseTimeBalance + (running && balanceLive ? elapsed : 0);
        var isNegative = liveBalance < 0;
        timeBalance.textContent = formatSignedHoursMinutes(liveBalance);
        timeBalance.classList.toggle('text-red-600', isNegative);
        timeBalance.classList.toggle('dark:text-red-400', isNegative);
        timeBalance.classList.toggle('text-emerald-600', !isNegative);
        timeBalance.classList.toggle('dark:text-emerald-400', !isNegative);
        if (balanceIcon) {
          balanceIcon.classList.toggle('bg-red-500/10', isNegative);
          balanceIcon.classList.toggle('text-red-600', isNegative);
          balanceIcon.classList.toggle('dark:text-red-400', isNegative);
          balanceIcon.classList.toggle('bg-emerald-500/10', !isNegative);
          balanceIcon.classList.toggle('text-emerald-600', !isNegative);
          balanceIcon.classList.toggle('dark:text-emerald-400', !isNegative);
        }
      }
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

  function initTimelineEditModal() {
    var modal = document.getElementById('timelineEditModal');
    var addModal = document.getElementById('timelineAddModal');
    var confirmModal = document.getElementById('timelineConfirmModal');
    var track = document.querySelector('[data-timeline-track]');
    if (!modal || !track) return;
    var editForm = modal.querySelector('form');
    var label = document.getElementById('timelineEditLabel');
    var occurredAt = document.getElementById('timelineOccurredAt');
    var eventId = document.getElementById('timelineEventId');
    var entryId = document.getElementById('timelineEntryId');
    var relatedEntryId = document.getElementById('timelineRelatedEntryId');
    var eventType = document.getElementById('timelineEventType');
    var addKind = document.getElementById('timelineEventKind');
    var addStart = document.getElementById('timelineStartAt');
    var addEnd = document.getElementById('timelineEndAt');
    var projectWrap = document.getElementById('timelineProjectWrap');
    var projectSelect = document.getElementById('timelineProjectId');
    var confirmEventLabel = document.getElementById('timelineConfirmEventLabel');
    var confirmOldTime = document.getElementById('timelineConfirmOldTime');
    var confirmNewTime = document.getElementById('timelineConfirmNewTime');
    var confirmSubmitBtn = document.getElementById('timelineConfirmSubmit');
    var lastTrigger = null;
    var suppressClick = false;
    var pendingMove = null;
    var startMinute = Number(track.dataset.startMinute || 480);
    var endMinute = Number(track.dataset.endMinute || 1200);
    var spanMinutes = endMinute - startMinute;

    function pad(value) { return String(value).padStart(2, '0'); }
    function dateTimeValue(minutes, step) {
      step = step || 5;
      var clamped = Math.max(0, Math.min(1439, Math.round(minutes / step) * step));
      return track.dataset.date + 'T' + pad(Math.floor(clamped / 60)) + ':' + pad(clamped % 60);
    }
    function snappedMinute(minutes, step) {
      step = step || 5;
      return Math.max(0, Math.min(1439, Math.round(minutes / step) * step));
    }
    function minutesFromPointer(clientX) {
      var bounds = track.getBoundingClientRect();
      var ratio = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width));
      return startMinute + ratio * spanMinutes;
    }
    function setBodyLocked(locked) {
      document.body.classList.toggle('overflow-hidden', locked);
    }
    function openEdit(trigger) {
      lastTrigger = trigger;
      label.textContent = trigger.dataset.eventLabel || '';
      occurredAt.value = trigger.dataset.occurredAt || '';
      eventId.value = trigger.dataset.eventId || '';
      entryId.value = trigger.dataset.entryId || '';
      relatedEntryId.value = trigger.dataset.relatedEntryId || '';
      eventType.value = trigger.dataset.eventType || '';
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      setBodyLocked(true);
      window.setTimeout(function () { occurredAt.focus(); }, 0);
    }
    function closeEdit() {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      setBodyLocked(false);
      if (lastTrigger) lastTrigger.focus();
    }
    function openConfirm(trigger, oldDateTime, newDateTime, originalLeft, originalTimeText) {
      if (!confirmModal) return;
      pendingMove = {
        trigger: trigger,
        oldDateTime: oldDateTime,
        newDateTime: newDateTime,
        originalLeft: originalLeft,
        originalTimeText: originalTimeText
      };
      if (confirmEventLabel) confirmEventLabel.textContent = trigger.dataset.eventLabel || '';
      if (confirmOldTime) confirmOldTime.textContent = oldDateTime ? oldDateTime.slice(-5) : '';
      if (confirmNewTime) confirmNewTime.textContent = newDateTime ? newDateTime.slice(-5) : '';
      confirmModal.classList.remove('hidden');
      confirmModal.classList.add('flex');
      setBodyLocked(true);
      if (confirmSubmitBtn) {
        window.setTimeout(function () { confirmSubmitBtn.focus(); }, 0);
      }
    }
    function closeConfirm(revert) {
      if (!confirmModal) return;
      if (revert && pendingMove) {
        pendingMove.trigger.style.left = pendingMove.originalLeft;
        var timeLabel = pendingMove.trigger.querySelector('[data-timeline-time]');
        if (timeLabel) timeLabel.textContent = pendingMove.originalTimeText;
      }
      pendingMove = null;
      confirmModal.classList.add('hidden');
      confirmModal.classList.remove('flex');
      setBodyLocked(false);
      if (lastTrigger) lastTrigger.focus();
    }
    function updateAddKind() {
      if (!addKind || !projectWrap || !projectSelect) return;
      var needsProject = addKind.value === 'work_session';
      projectWrap.classList.toggle('hidden', !needsProject);
      projectSelect.required = needsProject;
    }
    function openAdd(minutes) {
      if (!addModal || !addStart || !addEnd) return;
      var rounded = Math.round(minutes / 5) * 5;
      addStart.value = dateTimeValue(rounded, 5);
      addEnd.value = dateTimeValue(Math.min(rounded + 30, endMinute), 5);
      addModal.classList.remove('hidden');
      addModal.classList.add('flex');
      setBodyLocked(true);
      updateAddKind();
      window.setTimeout(function () { addKind.focus(); }, 0);
    }
    function closeAdd() {
      if (!addModal) return;
      addModal.classList.add('hidden');
      addModal.classList.remove('flex');
      setBodyLocked(false);
    }
    function currentMinute() {
      var now = new Date();
      return Math.max(startMinute, Math.min(endMinute - 30, now.getHours() * 60 + now.getMinutes()));
    }

    document.querySelectorAll('[data-timeline-edit]').forEach(function (trigger) {
      trigger.addEventListener('click', function (event) {
        event.stopPropagation();
        if (suppressClick) {
          suppressClick = false;
          return;
        }
        openEdit(trigger);
      });
      trigger.addEventListener('pointerdown', function (downEvent) {
        if (downEvent.button !== 0) return;
        var startX = downEvent.clientX;
        var triggerRect = trigger.getBoundingClientRect();
        var grabOffset = downEvent.clientX - (triggerRect.left + triggerRect.width / 2);
        var dragging = false;
        var lastMinutes = null;
        var lastStep = 5;
        var originalLeft = trigger.style.left;
        var timeLabel = trigger.querySelector('[data-timeline-time]');
        var originalTimeText = timeLabel ? timeLabel.textContent : '';
        var originalOccurredAt = trigger.dataset.occurredAt || '';
        trigger.setPointerCapture(downEvent.pointerId);

        function move(moveEvent) {
          if (Math.abs(moveEvent.clientX - startX) < 4 && !dragging) return;
          dragging = true;
          var fineGrained = moveEvent.shiftKey || moveEvent.ctrlKey || moveEvent.metaKey || moveEvent.altKey;
          lastStep = fineGrained ? 1 : 5;
          var rawMinutes = minutesFromPointer(moveEvent.clientX - grabOffset);
          var snapped = snappedMinute(rawMinutes, lastStep);
          lastMinutes = snapped;
          var percent = Math.max(0, Math.min(100, (snapped - startMinute) / spanMinutes * 100));
          trigger.style.left = percent + '%';
          if (timeLabel) timeLabel.textContent = dateTimeValue(snapped, lastStep).slice(-5);
        }
        function finish(upEvent) {
          trigger.removeEventListener('pointermove', move);
          trigger.removeEventListener('pointerup', finish);
          trigger.removeEventListener('pointercancel', finish);
          if (!dragging || lastMinutes === null) return;
          suppressClick = true;
          var fineGrained = (upEvent && (upEvent.shiftKey || upEvent.ctrlKey || upEvent.metaKey || upEvent.altKey)) || lastStep === 1;
          var finalStep = fineGrained ? 1 : 5;
          var newTimeStr = dateTimeValue(lastMinutes, finalStep);
          if (newTimeStr === originalOccurredAt) {
            trigger.style.left = originalLeft;
            if (timeLabel) timeLabel.textContent = originalTimeText;
            return;
          }
          if (confirmModal) {
            lastTrigger = trigger;
            openConfirm(trigger, originalOccurredAt, newTimeStr, originalLeft, originalTimeText);
          } else {
            occurredAt.value = newTimeStr;
            eventId.value = trigger.dataset.eventId || '';
            entryId.value = trigger.dataset.entryId || '';
            relatedEntryId.value = trigger.dataset.relatedEntryId || '';
            eventType.value = trigger.dataset.eventType || '';
            editForm.requestSubmit();
          }
        }
        trigger.addEventListener('pointermove', move);
        trigger.addEventListener('pointerup', finish);
        trigger.addEventListener('pointercancel', finish);
      });
      trigger.addEventListener('contextmenu', function (ev) {
        ev.preventDefault();
        var ctxMenu = document.getElementById('timelineContextMenu');
        var ctxEdit = document.getElementById('ctxEditEntry');
        var ctxDelete = document.getElementById('ctxDeleteForm');
        var ctxDeleteText = document.getElementById('ctxDeleteText');
        var ctxEventId = document.getElementById('ctxEventId');
        
        if (ctxMenu && ctxEdit && ctxDelete) {
          var entryId = trigger.dataset.entryId;
          var eventId = trigger.dataset.eventId;
          
          ctxEdit.onclick = function() {
            window.location.href = '/timer/edit/' + entryId;
          };
          
          if (eventId) {
            ctxDelete.action = '/dashboard/timeline/delete_event';
            if (ctxEventId) ctxEventId.value = eventId;
            if (ctxDeleteText) ctxDeleteText.textContent = 'Delete break';
          } else {
            ctxDelete.action = '/timer/delete/' + entryId;
            if (ctxEventId) ctxEventId.value = '';
            if (ctxDeleteText) ctxDeleteText.textContent = 'Delete entry';
          }
          
          ctxMenu.style.left = ev.clientX + 'px';
          ctxMenu.style.top = ev.clientY + 'px';
          ctxMenu.classList.remove('hidden');
        }
      });
    });
    
    document.addEventListener('click', function(ev) {
      var ctxMenu = document.getElementById('timelineContextMenu');
      if (ctxMenu && !ctxMenu.contains(ev.target)) {
        ctxMenu.classList.add('hidden');
      }
    });

    track.addEventListener('click', function (event) {
      if (event.target.closest('[data-timeline-edit]')) return;
      openAdd(minutesFromPointer(event.clientX));
    });
    track.addEventListener('keydown', function (event) {
      if ((event.key === 'Enter' || event.key === ' ') && event.target === track) {
        event.preventDefault();
        openAdd(currentMinute());
      }
    });
    document.querySelectorAll('[data-timeline-add-button]').forEach(function (button) {
      button.addEventListener('click', function () { lastTrigger = button; openAdd(currentMinute()); });
    });
    modal.querySelectorAll('[data-timeline-modal-close]').forEach(function (button) {
      button.addEventListener('click', closeEdit);
    });
    if (confirmModal) {
      confirmModal.querySelectorAll('[data-timeline-confirm-close]').forEach(function (button) {
        button.addEventListener('click', function () { closeConfirm(true); });
      });
      if (confirmSubmitBtn) {
        confirmSubmitBtn.addEventListener('click', function () {
          if (!pendingMove) return;
          var moveData = pendingMove;
          occurredAt.value = moveData.newDateTime;
          eventId.value = moveData.trigger.dataset.eventId || '';
          entryId.value = moveData.trigger.dataset.entryId || '';
          relatedEntryId.value = moveData.trigger.dataset.relatedEntryId || '';
          eventType.value = moveData.trigger.dataset.eventType || '';
          closeConfirm(false);
          editForm.requestSubmit();
        });
      }
    }
    if (addModal) {
      addModal.querySelectorAll('[data-timeline-add-close]').forEach(function (button) {
        button.addEventListener('click', closeAdd);
      });
    }
    if (addKind) addKind.addEventListener('change', updateAddKind);
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (confirmModal && !confirmModal.classList.contains('hidden')) closeConfirm(true);
      else if (!modal.classList.contains('hidden')) closeEdit();
      else if (addModal && !addModal.classList.contains('hidden')) closeAdd();
    });
  }

  onReady(function () {
    initDashboard();
    initWeeklyEditModal();
    initTimelineEditModal();
  });
})();
