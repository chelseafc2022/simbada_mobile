import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';

export const fileSource = (uri, base, token) => {
  const prefix = `${String(base || '').replace(/\/$/, '')}/uploads/`;
  return uri?.startsWith(prefix) && token
    ? { uri, headers: { Authorization: `Bearer ${token}` }, cache: 'reload' }
    : { uri };
};

export async function downloadPrivateFile(uri, base, token) {
  const source = fileSource(uri, base, token);
  if (!source.headers) { throw new Error('Alamat dokumen tidak sesuai server yang digunakan.'); }
  const ext = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(uri)?.[1] || 'bin';
  const destination = `${RNFS.CachesDirectoryPath}/private_doc_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  let result;
  try {
    result = await RNFS.downloadFile({ fromUrl: uri, toFile: destination, headers: source.headers }).promise;
  } catch (error) {
    await RNFS.unlink(destination).catch(() => {});
    throw error;
  }
  if (result.statusCode !== 200) {
    await RNFS.unlink(destination).catch(() => {});
    throw new Error('Dokumen tidak dapat diakses. Periksa sesi dan izin akun.');
  }
  if (await AsyncStorage.getItem('TOKEN') !== token) {
    await RNFS.unlink(destination).catch(() => {});
    throw new Error('Sesi berubah. Buka kembali dokumen dengan akun yang benar.');
  }
  return destination;
}

export async function readPrivatePdf(uri, base, token) {
  const destination = await downloadPrivateFile(uri, base, token);
  try {
    const stat = await RNFS.stat(destination);
    if (Number(stat.size) > 20 * 1024 * 1024) { throw new Error('PDF melebihi batas preview 20 MB.'); }
    return await RNFS.readFile(destination, 'base64');
  } finally { await RNFS.unlink(destination).catch(() => {}); }
}

export async function openPrivateDocument(uri, base, token) {
  const destination = await downloadPrivateFile(uri, base, token);
  await Share.open({ url: `file://${destination}`, failOnCancel: false });
}

export async function clearPrivateFiles() {
  const items = await RNFS.readDir(RNFS.CachesDirectoryPath);
  await Promise.all(items.filter(item => item.name.startsWith('private_doc_')).map(item => RNFS.unlink(item.path).catch(() => {})));
}
