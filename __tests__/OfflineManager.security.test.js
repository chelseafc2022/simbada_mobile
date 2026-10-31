jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(), setItem: jest.fn(),
}));
jest.mock('@react-native-community/netinfo', () => ({ fetch: jest.fn(async () => ({ isConnected: true })) }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import OfflineManager from '../views/library/OfflineManager';

let storage;
beforeEach(() => {
  storage = { TOKEN: 'new-token-a', PROFILE: JSON.stringify({ id: 'a', profile: { status: 2 } }) };
  AsyncStorage.getItem.mockImplementation(async key => storage[key] || null);
  AsyncStorage.setItem.mockImplementation(async (key, value) => { storage[key] = value; });
  global.fetch = jest.fn(async () => ({ ok: true, status: 200 }));
  global.FormData = class { append() {} };
});

test('login ulang akun sama memakai token terbaru untuk data miliknya', async () => {
  const item = await OfflineManager.addToQueue({ nama: 'Uji' }, 'https://fixture.invalid/add', 'new-token-a');
  storage.TOKEN = 'renewed-token-a';
  expect(await OfflineManager.syncItem(item)).toBe(true);
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('kikensbatara renewed-token-a');
});

test('akun berbeda tidak mengirim data dan antrean tetap disimpan tanpa menghabiskan retry', async () => {
  const item = await OfflineManager.addToQueue({ nama: 'Uji' }, 'https://fixture.invalid/add', 'new-token-a');
  storage.TOKEN = 'token-b';
  storage.PROFILE = JSON.stringify({ id: 'b', profile: { status: 2 } });
  expect(await OfflineManager.syncItem(item)).toBe(false);
  expect(fetch).not.toHaveBeenCalled();
  const [saved] = await OfflineManager.getQueue();
  expect(saved.data.nama).toBe('Uji');
  expect(saved.retryCount).toBe(0);
});

test('401 menyimpan data, login ulang dan syncAll berhasil tanpa kehilangan item', async () => {
  const item = await OfflineManager.addToQueue({ nama: 'Uji' }, 'https://fixture.invalid/add', 'new-token-a');
  fetch.mockResolvedValueOnce({ ok: false, status: 401 });
  expect(await OfflineManager.syncItem(item)).toBe(false);
  let [saved] = await OfflineManager.getQueue();
  expect(saved.authRequired).toBe(true);
  expect(saved.retryCount).toBe(0);
  storage.TOKEN = 'renewed-token-a';
  expect(await OfflineManager.syncAll()).toEqual({ synced: 1, failed: 0, total: 1 });
  expect(await OfflineManager.getQueue()).toEqual([]);
});

test('legacy dengan token berubah ditahan karena kepemilikan belum dapat dipastikan', async () => {
  const legacy = { id: 'legacy', data: { nama: 'Legacy' }, token: 'old-token', status: 'pending', retryCount: 0 };
  storage.OFFLINE_QUEUE = JSON.stringify([legacy]);
  expect(await OfflineManager.syncItem(legacy)).toBe(false);
  expect(fetch).not.toHaveBeenCalled();
  expect((await OfflineManager.getQueue())[0].data.nama).toBe('Legacy');
});

test('legacy dengan token sesi yang sama dapat dikaitkan, lalu pulih setelah login ulang', async () => {
  const legacy = { id: 'legacy', data: {}, token: storage.TOKEN, endpoint: 'https://fixture.invalid/add', status: 'pending', retryCount: 0 };
  storage.OFFLINE_QUEUE = JSON.stringify([legacy]);
  fetch.mockResolvedValueOnce({ ok: false, status: 401 });
  await OfflineManager.syncItem(legacy);
  expect((await OfflineManager.getQueue())[0].ownerId).toBe('a');
  storage.TOKEN = 'renewed-token-a';
  expect((await OfflineManager.syncAll()).synced).toBe(1);
});

test('sync batch mempertahankan status setiap item yang gagal', async () => {
  await OfflineManager.addToQueue({ nama: 'A' }, 'https://fixture.invalid/add', storage.TOKEN);
  await OfflineManager.addToQueue({ nama: 'B' }, 'https://fixture.invalid/add', storage.TOKEN);
  fetch.mockResolvedValue({ ok: false, status: 403 });
  expect((await OfflineManager.syncAll()).failed).toBe(2);
  expect((await OfflineManager.getQueue()).every(item => item.authRequired && item.status === 'failed')).toBe(true);
});
