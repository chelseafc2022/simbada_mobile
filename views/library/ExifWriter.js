/**
 * ExifWriter.js — Modul 5: Injeksi Metadata GPS ke File JPEG
 *
 * Menggunakan piexifjs untuk menyisipkan koordinat GPS, ketinggian,
 * dan timestamp ke dalam segmen EXIF file JPEG.
 *
 * Bergantung pada: react-native-fs (baca/tulis file), piexifjs (EXIF).
 */

import RNFS from 'react-native-fs';

// Helper: konversi derajat desimal ke format DMS [derajat, menit, detik]
// dalam format [[d, 1], [m, 1], [s*100, 100]] yang digunakan EXIF
const toExifDMS = (decimal) => {
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = Math.round((minFloat - min) * 60 * 100);
  return [[deg, 1], [min, 1], [sec, 100]];
};

/**
 * Injeksi data GPS ke dalam file JPEG.
 *
 * @param {string} imagePath - Path absolut file JPEG di storage
 * @param {object} coords    - { lat, lon, alt, timestamp }
 * @returns {Promise<string>} - Path file yang sudah diinjeksi EXIF
 */
const injectExif = async (imagePath, coords) => {
  try {
    const { lat, lon, alt = 0, timestamp } = coords;

    // Validasi input
    if (lat == null || lon == null) throw new Error('Koordinat GPS null');
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new Error('Koordinat GPS tidak valid');
    }

    // Baca file JPEG sebagai base64
    const base64Data = await RNFS.readFile(imagePath, 'base64');

    // Load piexifjs (lazy import untuk performa startup)
    const piexif = require('piexifjs');

    // Buat EXIF object
    const now = timestamp ? new Date(timestamp) : new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ':');
    const timeStr = now.toISOString().slice(11, 19);
    const dateTimeStr = `${dateStr} ${timeStr}`;

    const exifObj = {
      '0th': {},
      'Exif': {
        [piexif.ExifIFD.DateTimeOriginal]: dateTimeStr,
        [piexif.ExifIFD.DateTimeDigitized]: dateTimeStr,
      },
      'GPS': {
        [piexif.GPSIFD.GPSLatitudeRef]: lat >= 0 ? 'N' : 'S',
        [piexif.GPSIFD.GPSLatitude]: toExifDMS(lat),
        [piexif.GPSIFD.GPSLongitudeRef]: lon >= 0 ? 'E' : 'W',
        [piexif.GPSIFD.GPSLongitude]: toExifDMS(lon),
        [piexif.GPSIFD.GPSAltitudeRef]: alt >= 0 ? 0 : 1,
        [piexif.GPSIFD.GPSAltitude]: [Math.round(Math.abs(alt) * 100), 100],
        [piexif.GPSIFD.GPSDateStamp]: dateStr,
        [piexif.GPSIFD.GPSTimeStamp]: [
          [now.getUTCHours(), 1],
          [now.getUTCMinutes(), 1],
          [now.getUTCSeconds(), 1],
        ],
        [piexif.GPSIFD.GPSMapDatum]: 'WGS-84',
      },
    };

    // Encode EXIF ke bytes
    const exifBytes = piexif.dump(exifObj);

    // Sisipkan EXIF ke dalam data JPEG
    const newBase64 = piexif.insert(exifBytes, `data:image/jpeg;base64,${base64Data}`);

    // Ekstrak pure base64 (tanpa prefix data:...)
    const pureBase64 = newBase64.split(',')[1];

    // Tulis kembali ke file yang sama
    await RNFS.writeFile(imagePath, pureBase64, 'base64');

    console.log(`[ExifWriter] EXIF injected: lat=${lat.toFixed(6)}, lon=${lon.toFixed(6)}, alt=${alt}m`);
    return imagePath;
  } catch (err) {
    console.error('[ExifWriter] Gagal injeksi EXIF:', err.message);
    throw err;
  }
};

/**
 * Verifikasi EXIF sudah ada di file JPEG
 * @returns {object|null} GPS data jika ada, null jika tidak
 */
const readGPSFromExif = async (imagePath) => {
  try {
    const piexif = require('piexifjs');
    const base64Data = await RNFS.readFile(imagePath, 'base64');
    const exifObj = piexif.load(`data:image/jpeg;base64,${base64Data}`);
    const gps = exifObj?.GPS;
    if (!gps) return null;
    return { gps };
  } catch {
    return null;
  }
};

export default { injectExif, readGPSFromExif, toExifDMS };
