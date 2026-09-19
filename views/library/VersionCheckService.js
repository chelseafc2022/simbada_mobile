// views/library/VersionCheckService.js
import { Platform } from 'react-native';

export const APP_VERSION_CODE = 7;
export const APP_VERSION_NAME = '2.0.0';

/**
 * Service untuk memeriksa versi aplikasi ke server
 * Memastikan aplikasi selalu memenuhi regulasi Google Play (Android 16 / API 36)
 */
export const checkAppVersion = async (baseUrl) => {
  try {
    if (!baseUrl) return null;

    // Normalisasi url agar berakhiran slash
    const formattedUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const endpoint = `${formattedUrl}api/v1/app_version/check?version_code=${APP_VERSION_CODE}&version_name=${APP_VERSION_NAME}&platform=${Platform.OS}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      return json?.data || null;
    }
  } catch (error) {
    console.log('[VersionCheckService] Gagal memeriksa versi:', error.message);
  }
  return null;
};

export default {
  APP_VERSION_CODE,
  APP_VERSION_NAME,
  checkAppVersion,
};
