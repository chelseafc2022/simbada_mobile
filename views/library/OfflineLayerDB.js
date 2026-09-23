/**
 * OfflineLayerDB.js
 * Manajemen penyimpanan, ekspor, dan impor layer hasil digitasi peta offline (Polygon & Polyline).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import moment from 'moment';
import { uuidv4 } from './uuid';

const KEY_LAYERS = 'OFFLINE_DRAWING_LAYERS';

const sanitizeFilename = (name) =>
  (name || 'layer').replace(/[:\\/*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 50);

const OfflineLayerDB = {
  /**
   * Mengambil semua layer, bisa difilter per mapId
   */
  async getAll(mapId = null) {
    try {
      const raw = await AsyncStorage.getItem(KEY_LAYERS);
      if (!raw) return [];
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      if (!mapId) return list;
      return list.filter(l => !l.mapId || l.mapId === mapId);
    } catch (e) {
      console.warn('[OfflineLayerDB] getAll error:', e);
      return [];
    }
  },

  /**
   * Menyimpan layer baru atau mengupdate layer yang ada
   */
  async save(layerData) {
    try {
      const list = await this.getAll();
      const now = new Date().toISOString();
      const id = layerData.id || uuidv4();
      const newLayer = {
        id,
        mapId: layerData.mapId || null,
        mapName: layerData.mapName || 'Peta Offline',
        name: layerData.name || `Layer ${moment().format('DD/MM/YY HH:mm')}`,
        notes: layerData.notes || '',
        type: layerData.type || 'polygon', // 'polygon' | 'polyline'
        coordinates: layerData.coordinates || [], // array of { lat, lon }
        areaM2: layerData.areaM2 || 0,
        areaHa: layerData.areaHa || 0,
        perimeterM: layerData.perimeterM || 0,
        lengthM: layerData.lengthM || 0,
        color: layerData.color || (layerData.type === 'polyline' ? '#F59E0B' : '#06B6D4'),
        visible: layerData.visible !== false,
        createdAt: layerData.createdAt || now,
        updatedAt: now,
      };

      const existingIdx = list.findIndex(l => l.id === id);
      if (existingIdx >= 0) {
        list[existingIdx] = newLayer;
      } else {
        list.unshift(newLayer);
      }

      await AsyncStorage.setItem(KEY_LAYERS, JSON.stringify(list));
      return newLayer;
    } catch (e) {
      console.warn('[OfflineLayerDB] save error:', e);
      throw e;
    }
  },

  /**
   * Menghapus layer berdasarkan ID
   */
  async delete(id) {
    try {
      const list = await this.getAll();
      const filtered = list.filter(l => l.id !== id);
      await AsyncStorage.setItem(KEY_LAYERS, JSON.stringify(filtered));
      return true;
    } catch (e) {
      console.warn('[OfflineLayerDB] delete error:', e);
      return false;
    }
  },

  /**
   * Toggle status visibilitas layer
   */
  async toggleVisibility(id) {
    try {
      const list = await this.getAll();
      const idx = list.findIndex(l => l.id === id);
      if (idx >= 0) {
        list[idx].visible = !list[idx].visible;
        await AsyncStorage.setItem(KEY_LAYERS, JSON.stringify(list));
        return list[idx];
      }
      return null;
    } catch (e) {
      console.warn('[OfflineLayerDB] toggleVisibility error:', e);
      return null;
    }
  },

  /**
   * Ekspor layer tunggal atau semua layer ke file GeoJSON standar dan bagikan via Share
   */
  async exportToGeoJson(layerOrLayers) {
    try {
      const isArray = Array.isArray(layerOrLayers);
      const layers = isArray ? layerOrLayers : [layerOrLayers];
      if (!layers.length) throw new Error('Tidak ada data layer untuk diekspor');

      const features = layers.map(l => {
        let geometry;
        if (l.type === 'polygon') {
          // GeoJSON Polygon coordinates are [ [ [lon, lat], [lon, lat], ... closed ] ]
          const ring = (l.coordinates || []).map(pt => [pt.lon || pt[1], pt.lat || pt[0]]);
          if (ring.length > 2) {
            const first = ring[0];
            const last = ring[ring.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
              ring.push([first[0], first[1]]);
            }
          }
          geometry = {
            type: 'Polygon',
            coordinates: [ring],
          };
        } else {
          // LineString
          const line = (l.coordinates || []).map(pt => [pt.lon || pt[1], pt.lat || pt[0]]);
          geometry = {
            type: 'LineString',
            coordinates: line,
          };
        }

        return {
          type: 'Feature',
          properties: {
            id: l.id,
            name: l.name,
            notes: l.notes,
            type: l.type,
            areaM2: l.areaM2,
            areaHa: l.areaHa,
            perimeterM: l.perimeterM,
            lengthM: l.lengthM,
            mapName: l.mapName,
            createdAt: l.createdAt,
          },
          geometry,
        };
      });

      const geoJson = {
        type: 'FeatureCollection',
        name: isArray ? 'Simbada_Offline_Layers' : sanitizeFilename(layers[0].name),
        crs: {
          type: 'name',
          properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' },
        },
        features,
      };

      const outDir = `${RNFS.CachesDirectoryPath}/simbada_ekspor`;
      const exists = await RNFS.exists(outDir);
      if (!exists) await RNFS.mkdir(outDir);

      const fileName = `${sanitizeFilename(isArray ? 'Semua_Layer' : layers[0].name)}_${moment().format('YYYYMMDD_HHmmss')}.geojson`;
      const filePath = `${outDir}/${fileName}`;

      await RNFS.writeFile(filePath, JSON.stringify(geoJson, null, 2), 'utf8');

      // Bagikan via react-native-share
      const Share = require('react-native-share').default;
      await Share.open({
        url: `file://${filePath}`,
        type: 'application/geo+json',
        title: 'Ekspor Layer GeoJSON SIMBADA',
        subject: fileName,
      });

      return filePath;
    } catch (e) {
      if (e?.message !== 'User did not share') {
        console.warn('[OfflineLayerDB] exportToGeoJson error:', e);
        throw e;
      }
      return null;
    }
  },

  /**
   * Mengimpor teks GeoJSON ke dalam layer tersimpan
   */
  async importFromGeoJsonText(geoJsonText, mapId, mapName) {
    try {
      const data = JSON.parse(geoJsonText);
      const imported = [];

      const processFeature = (feature) => {
        if (!feature || !feature.geometry) return;
        const geom = feature.geometry;
        const props = feature.properties || {};
        const name = props.name || props.NAMOBJ || props.nama || `Import ${moment().format('DD/MM HH:mm')}`;
        const notes = props.notes || props.deskripsi || props.REMARK || '';

        if (geom.type === 'Polygon' && Array.isArray(geom.coordinates?.[0])) {
          const coords = geom.coordinates[0].map(c => ({ lat: c[1], lon: c[0] }));
          imported.push({
            name,
            notes,
            type: 'polygon',
            coordinates: coords,
            mapId,
            mapName,
            color: '#06B6D4',
          });
        } else if (geom.type === 'LineString' && Array.isArray(geom.coordinates)) {
          const coords = geom.coordinates.map(c => ({ lat: c[1], lon: c[0] }));
          imported.push({
            name,
            notes,
            type: 'polyline',
            coordinates: coords,
            mapId,
            mapName,
            color: '#F59E0B',
          });
        } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
          geom.coordinates.forEach((poly, idx) => {
            if (Array.isArray(poly?.[0])) {
              const coords = poly[0].map(c => ({ lat: c[1], lon: c[0] }));
              imported.push({
                name: `${name} Part ${idx + 1}`,
                notes,
                type: 'polygon',
                coordinates: coords,
                mapId,
                mapName,
                color: '#06B6D4',
              });
            }
          });
        }
      };

      if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
        data.features.forEach(processFeature);
      } else if (data.type === 'Feature') {
        processFeature(data);
      } else if (data.type === 'Polygon' || data.type === 'LineString') {
        processFeature({ geometry: data, properties: {} });
      }

      if (!imported.length) {
        throw new Error('Tidak ditemukan objek Polygon atau LineString di dalam file GeoJSON.');
      }

      const savedResults = [];
      for (const item of imported) {
        const saved = await this.save(item);
        savedResults.push(saved);
      }

      return savedResults;
    } catch (e) {
      console.warn('[OfflineLayerDB] importFromGeoJsonText error:', e);
      throw e;
    }
  },

  /**
   * Ekspor layer tunggal atau semua layer ke file KML (Google Earth / QGIS / ArcGIS)
   */
  async exportToKml(layerOrLayers) {
    try {
      const isArray = Array.isArray(layerOrLayers);
      const layers = isArray ? layerOrLayers : [layerOrLayers];
      if (!layers.length) throw new Error('Tidak ada data layer untuk diekspor');

      const placemarkNodes = layers.map(l => {
        const coords = (l.coordinates || []).map(pt => {
          const lon = pt.lon != null ? pt.lon : pt[1];
          const lat = pt.lat != null ? pt.lat : pt[0];
          return `${lon},${lat},0`;
        });

        if (l.type === 'polygon' && coords.length >= 3) {
          if (coords[0] !== coords[coords.length - 1]) {
            coords.push(coords[0]);
          }
          const coordStr = coords.join(' ');
          const desc = `Tipe: Poligon (Lahan)\nLuas: ${l.areaM2 ? l.areaM2.toLocaleString('id-ID') : 0} m² (${l.areaHa || 0} ha)\nKeliling: ${l.perimeterM ? l.perimeterM.toLocaleString('id-ID') : 0} m\n${l.notes || ''}`;

          return `    <Placemark>
      <name><![CDATA[${l.name || 'Bidang Lahan'}]]></name>
      <description><![CDATA[${desc}]]></description>
      <Style>
        <LineStyle>
          <color>ffffb606</color>
          <width>2.5</width>
        </LineStyle>
        <PolyStyle>
          <color>55ffb606</color>
        </PolyStyle>
      </Style>
      <Polygon>
        <extrude>1</extrude>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coordStr}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>`;
        } else if (coords.length >= 2) {
          const coordStr = coords.join(' ');
          const desc = `Tipe: Polyline (Garis/Rute)\nPanjang: ${l.lengthM >= 1000 ? (l.lengthM / 1000).toFixed(2) + ' km' : (l.lengthM || 0) + ' m'}\n${l.notes || ''}`;

          return `    <Placemark>
      <name><![CDATA[${l.name || 'Jalur Batas'}]]></name>
      <description><![CDATA[${desc}]]></description>
      <Style>
        <LineStyle>
          <color>ff0b9ef5</color>
          <width>3.5</width>
        </LineStyle>
      </Style>
      <LineString>
        <tessellate>1</tessellate>
        <altitudeMode>clampToGround</altitudeMode>
        <coordinates>${coordStr}</coordinates>
      </LineString>
    </Placemark>`;
        }
        return '';
      }).filter(Boolean).join('\n');

      const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${isArray ? 'Simbada_Offline_Layers' : sanitizeFilename(layers[0].name)}</name>
    <description>Hasil digitasi lapangan Peta Offline SIMBADA Mobile</description>
${placemarkNodes}
  </Document>
</kml>`;

      const outDir = `${RNFS.CachesDirectoryPath}/simbada_ekspor`;
      const exists = await RNFS.exists(outDir);
      if (!exists) await RNFS.mkdir(outDir);

      const fileName = `${sanitizeFilename(isArray ? 'Semua_Layer' : layers[0].name)}_${moment().format('YYYYMMDD_HHmmss')}.kml`;
      const filePath = `${outDir}/${fileName}`;

      await RNFS.writeFile(filePath, kmlContent, 'utf8');

      const Share = require('react-native-share').default;
      await Share.open({
        url: `file://${filePath}`,
        type: 'application/vnd.google-earth.kml+xml',
        title: 'Ekspor Layer KML SIMBADA',
        subject: fileName,
      });

      return filePath;
    } catch (e) {
      if (e?.message !== 'User did not share') {
        console.warn('[OfflineLayerDB] exportToKml error:', e);
        throw e;
      }
      return null;
    }
  },

  /**
   * Mengimpor teks KML ke dalam layer tersimpan
   */
  async importFromKmlText(kmlText, mapId, mapName) {
    try {
      const imported = [];
      const placemarkRegex = /<Placemark[\s\S]*?<\/Placemark>/gi;
      let pmMatch;

      while ((pmMatch = placemarkRegex.exec(kmlText)) !== null) {
        const pmBlock = pmMatch[0];
        const nameMatch = /<name>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/name>/i.exec(pmBlock);
        const name = (nameMatch && nameMatch[1].trim()) || `KML Import ${moment().format('DD/MM HH:mm')}`;
        const descMatch = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i.exec(pmBlock);
        const notes = (descMatch && descMatch[1].trim()) || '';

        const isPolygon = /<Polygon\b/i.test(pmBlock);
        const isLineString = /<LineString\b/i.test(pmBlock);

        const coordMatch = /<coordinates[\s\S]*?>([\s\S]*?)<\/coordinates>/i.exec(pmBlock);
        if (!coordMatch) continue;

        const rawCoords = coordMatch[1].trim();
        if (!rawCoords) continue;

        const tuples = rawCoords.split(/\s+/);
        const coords = [];
        tuples.forEach(t => {
          const parts = t.trim().split(',');
          if (parts.length >= 2) {
            const lon = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
              coords.push({ lat, lon });
            }
          }
        });

        if (isPolygon && coords.length >= 3) {
          imported.push({
            name,
            notes,
            type: 'polygon',
            coordinates: coords,
            mapId,
            mapName,
            color: '#06B6D4',
          });
        } else if (isLineString && coords.length >= 2) {
          imported.push({
            name,
            notes,
            type: 'polyline',
            coordinates: coords,
            mapId,
            mapName,
            color: '#F59E0B',
          });
        }
      }

      if (!imported.length) {
        throw new Error('Tidak ditemukan objek Polygon atau LineString di dalam file KML.');
      }

      const savedResults = [];
      for (const item of imported) {
        const saved = await this.save(item);
        savedResults.push(saved);
      }

      return savedResults;
    } catch (e) {
      console.warn('[OfflineLayerDB] importFromKmlText error:', e);
      throw e;
    }
  },
};

export default OfflineLayerDB;
