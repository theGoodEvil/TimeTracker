import Dexie from 'dexie';

const db = new Dexie('EvilTimeDesktop');

db.version(1).stores({
  projects: 'id,name,status,updated_at',
  tasks: 'id,project_id,name,status,updated_at',
  timeEntries: 'id,project_id,task_id,date,updated_at',
  queue: '++id,type,createdAt,status',
  meta: 'key',
});

async function getQueueDepth() {
  return db.queue.where('status').equals('pending').count();
}

export function createSyncEngine({ apiClient, settings, onStatus, onToast, onRefresh }) {
  let interval = null;
  let stopped = false;

  async function publish(partial = {}) {
    const [queueDepth, lastSyncAt, lastError] = await Promise.all([
      getQueueDepth(),
      db.meta.get('lastSyncAt'),
      db.meta.get('lastError'),
    ]);
    onStatus({
      queueDepth,
      syncing: false,
      lastSyncAt: lastSyncAt?.value || null,
      lastError: lastError?.value || '',
      ...partial,
    });
  }

  async function queueOperation(type, payload) {
    await db.queue.add({
      type,
      payload,
      status: 'pending',
      attempts: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await publish();
  }

  async function cacheReadData({ projects = [], tasks = [], timeEntries = [] }) {
    await db.transaction('rw', db.projects, db.tasks, db.timeEntries, async () => {
      if (projects.length) await db.projects.bulkPut(projects);
      if (tasks.length) await db.tasks.bulkPut(tasks);
      if (timeEntries.length) await db.timeEntries.bulkPut(timeEntries);
    });
    await publish();
  }

  async function processItem(item) {
    const payload = item.payload || {};
    if (item.type === 'time_entry_create') {
      await apiClient.createTimeEntry(payload);
    } else if (item.type === 'time_entry_update') {
      await apiClient.updateTimeEntry(payload.id, payload.data);
    } else if (item.type === 'time_entry_delete') {
      await apiClient.deleteTimeEntry(payload.id);
    } else if (item.type === 'timer_start') {
      await apiClient.startTimer(payload);
    } else if (item.type === 'timer_stop') {
      await apiClient.stopTimer();
    }
  }

  async function syncNow() {
    if (stopped || !navigator.onLine) {
      await publish({ syncing: false });
      return;
    }
    await publish({ syncing: true, lastError: '' });
    try {
      const items = await db.queue.where('status').equals('pending').sortBy('createdAt');
      for (const item of items) {
        await db.queue.update(item.id, { status: 'syncing', updatedAt: Date.now() });
        try {
          await processItem(item);
          await db.queue.delete(item.id);
        } catch (error) {
          await db.queue.update(item.id, {
            status: 'pending',
            attempts: (item.attempts || 0) + 1,
            lastError: error.message || String(error),
            updatedAt: Date.now(),
          });
          throw error;
        }
      }
      await db.meta.put({ key: 'lastSyncAt', value: Date.now() });
      await db.meta.put({ key: 'lastError', value: '' });
      await publish({ syncing: false });
      if (items.length) {
        onToast?.(`Synced ${items.length} queued change${items.length === 1 ? '' : 's'}`, 'success');
        await onRefresh?.();
      }
    } catch (error) {
      await db.meta.put({ key: 'lastError', value: error.message || String(error) });
      await publish({ syncing: false, lastError: error.message || String(error) });
      onToast?.('Sync failed. Changes remain queued.', 'error');
    }
  }

  function start() {
    stopped = false;
    publish();
    window.addEventListener('online', syncNow);
    if (settings.autoSync) {
      interval = window.setInterval(syncNow, Math.max(10, Number(settings.syncInterval || 60)) * 1000);
    }
    syncNow();
  }

  function stop() {
    stopped = true;
    window.removeEventListener('online', syncNow);
    if (interval) window.clearInterval(interval);
  }

  async function clearAll() {
    await db.transaction('rw', db.projects, db.tasks, db.timeEntries, db.queue, db.meta, async () => {
      await Promise.all([db.projects.clear(), db.tasks.clear(), db.timeEntries.clear(), db.queue.clear(), db.meta.clear()]);
    });
    await publish();
  }

  return {
    start,
    stop,
    syncNow,
    queueOperation,
    cacheReadData,
    clearAll,
  };
}
