// views/library/GeoFileParser.js
import RNFS from 'react-native-fs';
import JSZip from 'jszip';

/**
 * Downsampling titik koordinat jika terlalu banyak (> maxPoints)
 * agar performa rendering peta & transmisi jaringan tetap optimal.
 */
export const downsampleCoordinates = (points, maxPoints = 500) => {
  if (!Array.isArray(points) || points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const result = points.filter((_, i) => i % step === 0);
  // Pastikan titik pertama dan terakhir tetap ada jika poligon tertutup
  if (points.length > 1 && result[result.length - 1] !== points[points.length - 1]) {
    result.push(points[points.length - 1]);
  }
  return result;
};

/**
 * Parsing teks KML menjadi array koordinat [{ lat, lng }]
 */
export const parseKMLText = (kmlText) => {
  if (!kmlText || typeof kmlText !== 'string') return [];

  const points = [];
  // Regex mencari tag <coordinates>...</coordinates>
  const coordTagRegex = /<coordinates[\s\S]*?>([\s\S]*?)<\/coordinates>/gi;
  let match;

  while ((match = coordTagRegex.exec(kmlText)) !== null) {
    const rawCoords = match[1].trim();
    if (!rawCoords) continue;

    // Koordinat di KML biasanya dipisahkan oleh spasi, newline, atau tab
    // Format tiap titik: lon,lat[,alt]
    const tuples = rawCoords.split(/\s+/);
    tuples.forEach((t) => {
      const parts = t.trim().split(',');
      if (parts.length >= 2) {
        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          points.push({
            lat: lat.toFixed(7),
            lng: lng.toFixed(7),
            photo_uri: null,
            photo_file: null,
          });
        }
      }
    });
  }

  return points;
};

/**
 * Parsing teks GPX menjadi array koordinat [{ lat, lng }]
 */
export const parseGPXText = (gpxText) => {
  if (!gpxText || typeof gpxText !== 'string') return [];

  const points = [];
  // Regex mencari tag <trkpt>, <wpt>, atau <rtept>
  // Format: <trkpt lat="-4.123" lon="122.456"> atau <trkpt lon="122.456" lat="-4.123">
  const ptRegex = /<(?:trkpt|wpt|rtept)\b([^>]*?)>/gi;
  let match;

  while ((match = ptRegex.exec(gpxText)) !== null) {
    const attrs = match[1];
    const latMatch = /lat=["']([-0-9.]+)["']/i.exec(attrs);
    const lonMatch = /lon=["']([-0-9.]+)["']/i.exec(attrs);

    if (latMatch && lonMatch) {
      const lat = parseFloat(latMatch[1]);
      const lng = parseFloat(lonMatch[1]);
      if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        points.push({
          lat: lat.toFixed(7),
          lng: lng.toFixed(7),
          photo_uri: null,
          photo_file: null,
        });
      }
    }
  }

  return points;
};

/**
 * Parsing teks GeoJSON menjadi array koordinat [{ lat, lng }]
 */
export const parseGeoJSONText = (jsonText) => {
  if (!jsonText || typeof jsonText !== 'string') return [];

  try {
    const data = JSON.parse(jsonText);
    const points = [];

    const extractFromCoords = (coords) => {
      if (!Array.isArray(coords)) return;
      if (
        coords.length >= 2 &&
        typeof coords[0] === 'number' &&
        typeof coords[1] === 'number'
      ) {
        const lng = coords[0];
        const lat = coords[1];
        if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          points.push({
            lat: lat.toFixed(7),
            lng: lng.toFixed(7),
            photo_uri: null,
            photo_file: null,
          });
        }
      } else {
        coords.forEach(extractFromCoords);
      }
    };

    if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
      data.features.forEach((feat) => {
        if (feat.geometry?.coordinates) {
          extractFromCoords(feat.geometry.coordinates);
        }
      });
    } else if (data.type === 'Feature' && data.geometry?.coordinates) {
      extractFromCoords(data.geometry.coordinates);
    } else if (data.coordinates) {
      extractFromCoords(data.coordinates);
    }

    return points;
  } catch {
    return [];
  }
};

/**
 * Fungsi utama untuk membaca file (KML, KMZ, GPX, GeoJSON) dari URI
 */
export const parseGeoFileFromUri = async (fileUri, originalFileName = '') => {
  try {
    const cleanPath = fileUri.replace(/^file:\/\//, '');
    const lowerName = (originalFileName || cleanPath).toLowerCase();

    // 1. KMZ (Zipped KML)
    if (lowerName.endsWith('.kmz')) {
      const base64 = await RNFS.readFile(cleanPath, 'base64');
      const zip = await JSZip.loadAsync(base64, { base64: true });

      // Cari file .kml di dalam archive KMZ
      let kmlContent = null;
      for (const filename of Object.keys(zip.files)) {
        if (filename.toLowerCase().endsWith('.kml')) {
          kmlContent = await zip.files[filename].async('string');
          break;
        }
      }

      if (!kmlContent) {
        throw new Error('Tidak ditemukan file .kml di dalam arsip KMZ');
      }

      const points = parseKMLText(kmlContent);
      return {
        success: true,
        points: downsampleCoordinates(points),
        rawCount: points.length,
        format: 'KMZ',
      };
    }

    // 2. KML / GPX / GeoJSON / JSON teks biasa
    const content = await RNFS.readFile(cleanPath, 'utf8');

    let points = [];
    let format = 'UNKNOWN';

    if (lowerName.endsWith('.gpx') || content.includes('<gpx')) {
      points = parseGPXText(content);
      format = 'GPX';
    } else if (lowerName.endsWith('.geojson') || lowerName.endsWith('.json')) {
      points = parseGeoJSONText(content);
      format = 'GeoJSON';
    } else if (lowerName.endsWith('.kml') || content.includes('<kml')) {
      points = parseKMLText(content);
      format = 'KML';
    } else {
      // Coba parse KML dulu, lalu GPX, lalu GeoJSON
      points = parseKMLText(content);
      format = 'KML';
      if (points.length === 0) {
        points = parseGPXText(content);
        format = 'GPX';
      }
      if (points.length === 0) {
        points = parseGeoJSONText(content);
        format = 'GeoJSON';
      }
    }

    if (points.length === 0) {
      throw new Error(
        'Tidak ditemukan titik koordinat yang valid di dalam file ' + (originalFileName || '')
      );
    }

    return {
      success: true,
      points: downsampleCoordinates(points),
      rawCount: points.length,
      format,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Gagal membaca atau mem-parsing file geospasial.',
    };
  }
};
