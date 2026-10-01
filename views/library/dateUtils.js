/**
 * dateUtils.js — Utilitas Format Tanggal Native SIMBADA Mobile
 * Pengganti moment.js (230KB) menggunakan Intl.DateTimeFormat bawaan JS.
 * Zero dependencies, zero overhead.
 */

/**
 * Format: "01 Oktober 2026"
 * Pengganti: moment(date).format('DD MMMM YYYY')
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
};

/**
 * Format: "01 Okt 2026, 14:30"
 * Pengganti: moment(date).format('DD MMM YYYY, HH:mm')
 */
export const formatDateShort = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Format: "01 Okt 2026, 14:30"
 * Pengganti: moment(date).format('DD MMM YYYY, HH:mm')
 */
export const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const datePart = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  const timePart = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${datePart}, ${timePart}`;
};

/**
 * Format: "01/10/2026 14:30"
 * Pengganti: moment(date).format('DD/MM/YYYY HH:mm')
 */
export const formatDateSlash = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
};

/**
 * Format: "01 Okt 2026 14:30"
 * Pengganti: moment(date).format('DD MMM YYYY HH:mm')
 */
export const formatDateTimeFull = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const datePart = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  const timePart = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${datePart} ${timePart}`;
};

/**
 * Format: "20261001_143022"
 * Pengganti: moment().format('YYYYMMDD_HHmmss') — digunakan untuk nama file
 */
export const formatFileTimestamp = (date = new Date()) => {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
};

/**
 * Format: "01/10 14:30"
 * Pengganti: moment().format('DD/MM HH:mm')
 */
export const formatShortStamp = (date = new Date()) => {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${min}`;
};

/**
 * Format: "01/10/26 14:30"
 * Pengganti: moment().format('DD/MM/YY HH:mm')
 */
export const formatShortDate = (date = new Date()) => {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} ${hh}:${min}`;
};

/**
 * Format: "01-10-2026 14:30:22"
 * Pengganti: moment().format('DD-MM-YYYY HH:mm:ss')
 */
export const formatDateTimeSec = (date = new Date()) => {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${hh}:${min}:${ss}`;
};

/**
 * Format: "01 Okt 2026"
 * Pengganti: moment(date).format('DD MMM YYYY')
 */
export const formatDayMonthYear = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Hitung durasi antar dua tanggal, format: "2 hari 3 jam lalu"
 * Pengganti: moment(now).diff(date, 'days') + logika manual
 */
export const formatRelative = (dateStr) => {
  if (!dateStr) return '-';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (isNaN(diff)) return '-';
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'baru saja';
  if (secs < 3600) return `${Math.floor(secs / 60)} mnt lalu`;
  if (secs < 86400) return `${Math.floor(secs / 3600)} jam lalu`;
  return `${Math.floor(secs / 86400)} hari lalu`;
};

/**
 * Cek apakah dua tanggal dalam rentang (pengganti moment diff)
 * @param {string|Date} dateStr - tanggal yang dicek
 * @param {number} days - jumlah hari ke belakang
 */
export const isWithinDays = (dateStr, days) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return d >= cutoff;
};
