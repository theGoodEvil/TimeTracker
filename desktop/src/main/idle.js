/**
 * System idle detection for the Electron desktop app.
 *
 * Sends best-effort heartbeats while a timer is active. OS idleness and
 * connectivity are never treated as clock-out actions.
 */

const { net } = require('electron');

const CHECK_INTERVAL_MS = 60 * 1000;

function createIdleMonitor({ store, sendToMainWindow }) {
  let checkInterval = null;
  let timerActive = false;

  async function apiRequest(method, path, body) {
    if (!store) return null;
    const serverUrl = store.get('server_url');
    const apiToken = store.get('api_token');
    if (!serverUrl || !apiToken) return null;

    let base = String(serverUrl).replace(/\/+$/, '');
    const url = `${base}${path}`;

    return new Promise((resolve) => {
      try {
        const request = net.request({ method, url });
        request.setHeader('Authorization', `Bearer ${apiToken}`);
        request.setHeader('Content-Type', 'application/json');
        request.setHeader('Accept', 'application/json');
        let raw = '';
        request.on('response', (response) => {
          response.on('data', (chunk) => {
            raw += chunk.toString();
          });
          response.on('end', () => {
            resolve({ status: response.statusCode, body: raw });
          });
        });
        request.on('error', (err) => {
          console.debug('[IdleMonitor] request failed:', err.message);
          resolve(null);
        });
        if (body !== undefined) {
          request.write(JSON.stringify(body));
        }
        request.end();
      } catch (e) {
        console.debug('[IdleMonitor] request error:', e.message);
        resolve(null);
      }
    });
  }

  async function sendHeartbeat() {
    await apiRequest('POST', '/api/v1/timer/heartbeat');
  }

  async function confirmStillWorking() {
    await sendHeartbeat();
    sendToMainWindow('idle:dismissed', {});
  }

  async function confirmStop() {
    // Kept for compatibility with older renderer bundles. An idle IPC action
    // is never treated as an explicit clock-out in EvilTime.
    await confirmStillWorking();
  }

  function onTimerStatusUpdate(data) {
    const active = Boolean(data && data.active && !data.paused);
    timerActive = active;
  }

  function tick() {
    if (!timerActive) return;
    sendHeartbeat().catch(() => {});
  }

  function start() {
    if (checkInterval) return;
    checkInterval = setInterval(tick, CHECK_INTERVAL_MS);
    // First check shortly after start
    setTimeout(tick, 5000);
  }

  function stop() {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
  }

  return {
    start,
    stop,
    onTimerStatusUpdate,
    confirmStillWorking,
    confirmStop,
    sendHeartbeat,
  };
}

module.exports = { createIdleMonitor };
