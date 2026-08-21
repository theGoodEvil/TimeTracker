import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:timetracker_mobile/core/services/notification_service.dart';
import 'package:timetracker_mobile/domain/repositories/time_tracking_repository.dart';

/// Client-side idle detection for the mobile app.
///
/// While a timer is active and the app is in the foreground, sends a heartbeat
/// every 60 seconds. Device idleness or lost connectivity never stops a timer;
/// the persisted server state changes only after an explicit user action.
class IdleDetectionService with WidgetsBindingObserver {
  IdleDetectionService._();

  static final IdleDetectionService instance = IdleDetectionService._();

  static const Duration heartbeatInterval = Duration(seconds: 60);

  TimeTrackingRepository? _repository;
  Timer? _heartbeatTimer;
  bool _started = false;
  bool _timerActive = false;
  bool _inForeground = true;

  bool get isRunning => _started;

  Future<void> start(TimeTrackingRepository? repository) async {
    _repository = repository;
    if (_started) return;
    _started = true;
    WidgetsBinding.instance.addObserver(this);
    await NotificationService.instance.cancelIdlePrompt();
    NotificationService.instance.onIdleAction = null;
    _heartbeatTimer =
        Timer.periodic(heartbeatInterval, (_) => _sendHeartbeat());
  }

  void stop() {
    if (!_started) return;
    _started = false;
    WidgetsBinding.instance.removeObserver(this);
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
    NotificationService.instance.onIdleAction = null;
  }

  void setRepository(TimeTrackingRepository? repository) {
    _repository = repository;
  }

  Future<void> updateFromTimerStatus({
    required bool active,
    int? idleTimeoutMinutes,
    bool idleNotified = false,
  }) async {
    _timerActive = active;
    if (!active) {
      await NotificationService.instance.cancelIdlePrompt();
    }
  }

  void markActive() {
    _sendHeartbeat();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _inForeground = true;
      markActive();
      _sendHeartbeat();
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.hidden ||
        state == AppLifecycleState.detached) {
      _inForeground = false;
    }
  }

  Future<void> _sendHeartbeat() async {
    if (!_timerActive || _repository == null || !_inForeground) {
      return;
    }
    await _sendHeartbeatForced();
  }

  Future<void> _sendHeartbeatForced() async {
    if (_repository == null) return;
    try {
      await _repository!.sendHeartbeat();
    } catch (e) {
      debugPrint('IdleDetectionService heartbeat failed: $e');
    }
  }
}
