/**
 * OfflineManager.js
 * Utility untuk manajemen data offline & auto-sync
 * 
 * Fitur:
 * - Simpan data pengajuan ke queue saat offline
 * - Auto-sync saat koneksi kembali
 * - Retry dengan exponential backoff
 * - Status tracking per item (pending/syncing/failed/synced)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const STORAGE_KEY = 'OFFLINE_QUEUE';
const MAX_RETRY = 3;
const BATCH_SIZE = 5;

/**
 * Generate unique ID untuk setiap item queue
 */
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
};

/**
 * Ambil seluruh queue dari AsyncStorage
 */
const getQueue = async () => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[OfflineManager] Error getting queue:', error);
    return [];
  }
};

/**
 * Simpan queue ke AsyncStorage
 */
const saveQueue = async (queue) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('[OfflineManager] Error saving queue:', error);
  }
};

/**
 * Tambah item baru ke antrian offline
 * @param {object} data - Data yang akan di-submit (form data)
 * @param {string} endpoint - URL endpoint tujuan
 * @param {string} token - Auth token
 * @returns {object} - Item yang ditambahkan
 */
const addToQueue = async (data, endpoint, token) => {
  const queue = await getQueue();
  const item = {
    id: generateId(),
    data,
    endpoint,
    token,
    status: 'pending', // pending | syncing | failed | synced
    retryCount: 0,
    createdAt: new Date().toISOString(),
    lastAttempt: null,
    errorMessage: null,
  };
  queue.push(item);
  await saveQueue(queue);
  console.log('[OfflineManager] Item added to queue:', item.id);
  return item;
};

/**
 * Update status item di queue
 */
const updateItemStatus = async (itemId, status, errorMessage = null) => {
  const queue = await getQueue();
  const index = queue.findIndex(item => item.id === itemId);
  if (index !== -1) {
    queue[index].status = status;
    queue[index].lastAttempt = new Date().toISOString();
    if (errorMessage) {
      queue[index].errorMessage = errorMessage;
    }
    if (status === 'failed') {
      queue[index].retryCount += 1;
    }
    await saveQueue(queue);
  }
};

/**
 * Hapus item dari queue
 */
const removeFromQueue = async (itemId) => {
  let queue = await getQueue();
  queue = queue.filter(item => item.id !== itemId);
  await saveQueue(queue);
  console.log('[OfflineManager] Item removed:', itemId);
};

/**
 * Hapus semua item yang sudah synced
 */
const clearSyncedItems = async () => {
  let queue = await getQueue();
  queue = queue.filter(item => item.status !== 'synced');
  await saveQueue(queue);
};

/**
 * Hitung jumlah item per status
 */
const getQueueStats = async () => {
  const queue = await getQueue();
  return {
    total: queue.length,
    pending: queue.filter(i => i.status === 'pending').length,
    syncing: queue.filter(i => i.status === 'syncing').length,
    failed: queue.filter(i => i.status === 'failed').length,
    synced: queue.filter(i => i.status === 'synced').length,
  };
};

/**
 * Submit satu item ke server
 */
const syncItem = async (item) => {
  try {
    await updateItemStatus(item.id, 'syncing');

    // Build FormData dari data yang disimpan
    const formData = new FormData();
    Object.keys(item.data).forEach(key => {
      if (key === 'lokasi' || key === 'marker') {
        formData.append(key, JSON.stringify(item.data[key]));
      } else if (key === 'file' && item.data[key] && typeof item.data[key] === 'object') {
        // File object perlu di-handle khusus
        formData.append(key, item.data[key]);
      } else {
        formData.append(key, item.data[key]);
      }
    });

    const response = await fetch(item.endpoint, {
      method: 'POST',
      headers: {
        Authorization: 'kikensbatara ' + item.token,
      },
      body: formData,
    });

    if (response.ok) {
      await updateItemStatus(item.id, 'synced');
      console.log('[OfflineManager] Item synced successfully:', item.id);
      return true;
    } else {
      const errorText = await response.text();
      await updateItemStatus(item.id, 'failed', `Server error: ${response.status} - ${errorText}`);
      return false;
    }
  } catch (error) {
    await updateItemStatus(item.id, 'failed', error.message);
    console.error('[OfflineManager] Sync failed for item:', item.id, error.message);
    return false;
  }
};

/**
 * Sync semua item pending/failed (batch)
 * @param {function} onProgress - Callback (syncedCount, totalCount)
 * @returns {object} - {synced, failed, total}
 */
const syncAll = async (onProgress = null) => {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    console.log('[OfflineManager] No connection, skipping sync');
    return { synced: 0, failed: 0, total: 0 };
  }

  const queue = await getQueue();
  const toSync = queue.filter(
    item => (item.status === 'pending' || item.status === 'failed') && item.retryCount < MAX_RETRY
  );

  let synced = 0;
  let failed = 0;

  // Proses per batch
  for (let i = 0; i < toSync.length; i += BATCH_SIZE) {
    const batch = toSync.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(item => syncItem(item)));
    
    results.forEach(success => {
      if (success) synced++;
      else failed++;
    });

    if (onProgress) {
      onProgress(synced + failed, toSync.length);
    }
  }

  // Bersihkan item yang sudah synced
  await clearSyncedItems();

  console.log(`[OfflineManager] Sync complete: ${synced} synced, ${failed} failed out of ${toSync.length}`);
  return { synced, failed, total: toSync.length };
};

/**
 * Cek apakah device online
 */
const isOnline = async () => {
  const state = await NetInfo.fetch();
  return state.isConnected;
};

/**
 * Setup NetInfo listener untuk auto-sync
 * @param {function} onStatusChange - Callback saat status berubah (isOnline)
 * @param {function} dispatch - Redux dispatch untuk update state
 * @returns {function} - Unsubscribe function
 */
const setupAutoSync = (onStatusChange, dispatch = null) => {
  const unsubscribe = NetInfo.addEventListener(async (state) => {
    const online = state.isConnected;
    
    if (onStatusChange) {
      onStatusChange(online);
    }

    if (dispatch) {
      dispatch({ type: 'SET_ONLINE_STATUS', payload: online });
    }

    // Auto-sync saat kembali online
    if (online) {
      console.log('[OfflineManager] Connection restored, starting auto-sync...');
      const result = await syncAll();
      
      if (dispatch && result.total > 0) {
        const stats = await getQueueStats();
        dispatch({ type: 'SET_OFFLINE_QUEUE_COUNT', payload: stats.pending + stats.failed });
      }
    }
  });

  return unsubscribe;
};

export default {
  addToQueue,
  getQueue,
  removeFromQueue,
  clearSyncedItems,
  getQueueStats,
  syncItem,
  syncAll,
  isOnline,
  setupAutoSync,
  updateItemStatus,
};
