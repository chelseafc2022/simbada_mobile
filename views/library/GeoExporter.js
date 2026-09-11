/**
 * GeoExporter.js — Modul 6: Generator Format Ekspor GIS
 *
 * Menghasilkan file KML/KMZ, GPX, dan CSV dari data Placemark dan Trek.
 * File disimpan ke storage lokal dan/atau dibagikan via Android Share.
 *
 * Bergantung pada: react-native-fs, jszip, react-native-share
 */

import RNFS from 'react-native-fs';
import moment from 'moment';

// Sanitasi nama file: hapus karakter ilegal
const sanitizeFilename = (name) =>
  name.replace(/[:\\/*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 60);

// Timestamp untuk nama file
const fileTimestamp = () => moment().format('YYYYMMDD_HHmmss');

// Direktori ekspor
const EXPORT_DIR = `${RNFS.ExternalStorageDirectoryPath}/simbada/ekspor`;

// Pastikan direktori ada
const ensureDir = async () => {
  const exists = await RNFS.exists(EXPORT_DIR);
  if (!exists) await RNFS.mkdir(EXPORT_DIR);
};

// ─── KML Generator ────────────────────────────────────────────────────────────
const toKML = (placemarks = [], tracks = []) => {
  const pmNodes = placemarks.map(pm => `
    <Placemark>
      <name><![CDATA[${pm.judul}]]></name>
      <description><![CDATA[${pm.deskripsi || ''}]]></description>
      <TimeStamp><when>${pm.createdAt}</when></TimeStamp>
      <Point>
        <coordinates>${pm.lon},${pm.lat},${pm.alt || 0}</coordinates>
      </Point>
      <ExtendedData>
        <Data name="accuracy_h"><value>${pm.accH}</value></Data>
        <Data name="symbol"><value>${pm.simbol}</value></Data>
      </ExtendedData>
    </Placemark>`).join('\n');

  const trackNodes = tracks.map(tr => {
    const coords = (tr.waypoints || [])
      .map(w => `${w.lon},${w.lat},${w.alt || 0}`)
      .join('\n          ');
    return `
    <Placemark>
      <name><![CDATA[${tr.label || 'Trek Lapangan'}]]></name>
      <description><![CDATA[Jarak: ${(tr.metrics?.totalDistance / 1000).toFixed(2)} km | Durasi: ${Math.round((tr.metrics?.duration || 0) / 60)} menit]]></description>
      <TimeStamp><when>${tr.startTime}</when></TimeStamp>
      <Style>
        <LineStyle><color>ff0000ff</color><width>3</width></LineStyle>
      </Style>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${coords}</coordinates>
      </LineString>
    </Placemark>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Simbada Ekspor - ${moment().format('DD MMM YYYY')}</name>
    <description>Ekspor data lapangan dari aplikasi Simbada Mobile v0.0.5</description>
    <Folder>
      <name>Placemark (${placemarks.length} titik)</name>
      ${pmNodes}
    </Folder>
    <Folder>
      <name>Trek Lapangan (${tracks.length} jalur)</name>
      ${trackNodes}
    </Folder>
  </Document>
</kml>`;
};

// ─── GPX Generator ────────────────────────────────────────────────────────────
const toGPX = (placemarks = [], tracks = []) => {
  const wpts = placemarks.map(pm => `
  <wpt lat="${pm.lat}" lon="${pm.lon}">
    <ele>${pm.alt || 0}</ele>
    <time>${pm.createdAt}</time>
    <name><![CDATA[${pm.judul}]]></name>
    <desc><![CDATA[${pm.deskripsi || ''}]]></desc>
    <sym>${pm.simbol}</sym>
  </wpt>`).join('');

  const trks = tracks.map(tr => {
    const trkpts = (tr.waypoints || []).map(w => `
      <trkpt lat="${w.lat}" lon="${w.lon}">
        <ele>${w.alt || 0}</ele>
        <time>${new Date(w.ts).toISOString()}</time>
        <extensions><speed>${(w.speed * 3.6).toFixed(1)}</speed></extensions>
      </trkpt>`).join('');
    return `
  <trk>
    <name><![CDATA[${tr.label || 'Trek Lapangan'}]]></name>
    <trkseg>${trkpts}
    </trkseg>
  </trk>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Simbada Mobile v0.0.5"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <metadata>
    <name>Simbada Ekspor</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
${wpts}
${trks}
</gpx>`;
};

// ─── CSV Generator ────────────────────────────────────────────────────────────
const toCSV = (placemarks = [], tracks = []) => {
  const pmRows = placemarks.map(pm =>
    `"${pm.id}","${pm.judul.replace(/"/g, '""')}","${pm.lat}","${pm.lon}","${pm.alt || 0}","${pm.accH || 0}","${pm.createdAt}","placemark","${(pm.deskripsi || '').replace(/"/g, '""')}"`
  );

  const trkRows = tracks.flatMap(tr =>
    (tr.waypoints || []).map((w, i) =>
      `"${tr.id}_${i}","${tr.label || 'Trek'} WP${i + 1}","${w.lat}","${w.lon}","${w.alt || 0}","${w.acc || 0}","${new Date(w.ts).toISOString()}","waypoint",""`
    )
  );

  const header = 'ID,Judul,Latitude,Longitude,Elevasi_m,Akurasi_H_m,Waktu_UTC,Tipe,Deskripsi';
  return [header, ...pmRows, ...trkRows].join('\n');
};

// ─── SAVE & SHARE ─────────────────────────────────────────────────────────────
const GeoExporter = {
  exportKMZ: async (placemarks, tracks) => {
    await ensureDir();
    const kml = toKML(placemarks, tracks);
    const filename = `simbada_${fileTimestamp()}.kmz`;
    const filePath = `${EXPORT_DIR}/${filename}`;

    const JSZip = require('jszip');
    const zip = new JSZip();
    zip.file('doc.kml', kml);
    const content = await zip.generateAsync({ type: 'base64' });
    await RNFS.writeFile(filePath, content, 'base64');
    console.log(`[GeoExporter] KMZ saved: ${filePath}`);
    return filePath;
  },

  exportGPX: async (placemarks, tracks) => {
    await ensureDir();
    const gpx = toGPX(placemarks, tracks);
    const filename = `simbada_${fileTimestamp()}.gpx`;
    const filePath = `${EXPORT_DIR}/${filename}`;
    await RNFS.writeFile(filePath, gpx, 'utf8');
    return filePath;
  },

  exportCSV: async (placemarks, tracks) => {
    await ensureDir();
    const csv = toCSV(placemarks, tracks);
    const filename = `simbada_${fileTimestamp()}.csv`;
    const filePath = `${EXPORT_DIR}/${filename}`;
    await RNFS.writeFile(filePath, csv, 'utf8');
    return filePath;
  },

  shareFile: async (filePath, mimeType = 'application/octet-stream') => {
    const Share = require('react-native-share').default;
    await Share.open({
      url: `file://${filePath}`,
      type: mimeType,
      title: 'Bagikan Data Lapangan Simbada',
      subject: 'Data GIS Simbada Mobile',
      failOnCancel: false,
    });
  },

  getExportDir: () => EXPORT_DIR,
};

export default GeoExporter;
