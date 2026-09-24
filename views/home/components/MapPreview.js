// views/home/components/MapPreview.js — High Performance V5 (Fullscreen + Navigasi + Optimalisasi)
// Perbaikan Performa:
// 1. Single active MapView: ketika Layar Penuh aktif, inline MapView di-unmount agar GPU/RAM tidak overload
// 2. Hapus sensor magnetometer unthrottled di MapPreview (NavigasiService sudah kelola sensor secara efisien)
// 3. Deadband filtering pada update navigasi untuk mencegah render cascade terus menerus
// 4. MapContent di-memoize dengan React.memo dan tracksViewChanges={false} pada semua Marker
// 5. Mode 'Pilih dari Peta' berfungsi di peta normal maupun fullscreen
// 6. Menggunakan CompassView modular teroptimasi untuk kompas navigasi

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Alert,
  Platform,
  TextInput,
  Dimensions,
  ScrollView,
  StatusBar,
} from 'react-native';
import MapView, { Polygon, Polyline, Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import FastImage from 'react-native-fast-image';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { useSelector } from 'react-redux';
import NavigasiService from '../../library/NavigasiService';
import GpsService from '../../library/GpsService';
import CompassView from '../../navigasi/CompassView';

const { height: SCREEN_H } = Dimensions.get('window');

// ── SYMBOL EMOJI ─────────────────────────────────────────────────────────────
const SYMBOL_EMOJI = {
  pin_merah: '📍', pin_biru: '📌', bangunan: '🏠', pohon: '🌳',
  air: '💧', jalan: '🛤', bahaya: '⚠️', temuan: '🔍',
  sampel: '🧪', fotografi: '📷', bintang: '⭐', titik: '●',
};

// ── WARNA ────────────────────────────────────────────────────────────────────
const C_PRIMARY      = '#0284C7';
const C_DARK_NAVY    = '#0F172A';
const C_BORDER       = '#E2E8F0';
const C_TEXT         = '#0F172A';
const C_MID          = '#64748B';
const C_FINAL_STROKE = '#00E5FF';
const C_FINAL_FILL   = 'rgba(2, 132, 199, 0.32)';
const C_DASAR_STROKE = '#FBBF24';
const C_DASAR_FILL   = 'rgba(251, 191, 36, 0.12)';
const C_DRAW_STROKE  = '#F97316';
const C_DRAW_FILL    = 'rgba(249, 115, 22, 0.2)';
const C_PUBLIC_PM    = '#10B981';
const C_MINE_PM      = '#8B5CF6';
const C_NAV_ACCENT   = '#0EA5E9';

// ── KALKULASI ────────────────────────────────────────────────────────────────
const toRad = (deg) => (deg * Math.PI) / 180;

const calcGeodesicArea = (coords) => {
  if (!coords || coords.length < 3) return { m2: 0, ha: 0 };
  const R = 6371009;
  let area = 0;
  const n = coords.length;
  for (let i = 0; i < n; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % n];
    area += toRad(p2.longitude - p1.longitude) * (2 + Math.sin(toRad(p1.latitude)) + Math.sin(toRad(p2.latitude)));
  }
  const m2 = Math.abs((area * R * R) / 2);
  return { m2: Math.round(m2), ha: parseFloat((m2 / 10000).toFixed(4)) };
};

const calcPolylineLength = (coords) => {
  if (!coords || coords.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = coords[i]; const p2 = coords[i + 1];
    const R = 6371009;
    const dLat = toRad(p2.latitude - p1.latitude);
    const dLon = toRad(p2.longitude - p1.longitude);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(p1.latitude)) * Math.cos(toRad(p2.latitude)) * Math.sin(dLon / 2) ** 2;
    total += 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return Math.round(total);
};

const calcNavDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1); const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const calcNavBearing = (lat1, lon1, lat2, lon2) => {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
};

const fmtM = (m) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m} m`);

const COMPASS_DIRS = ['Utara', 'TL', 'Timur', 'TG', 'Selatan', 'BD', 'Barat', 'BL'];
const getDir = (b) => COMPASS_DIRS[Math.round(b / 45) % 8];

const isValidCoord = (coord) =>
  coord != null && typeof coord === 'object' &&
  typeof coord.latitude === 'number' && typeof coord.longitude === 'number' &&
  isFinite(coord.latitude) && isFinite(coord.longitude) &&
  !isNaN(coord.latitude) && !isNaN(coord.longitude);

// ── KML / CSV EXPORT BUILDER ──────────────────────────────────────────────────
const generateKml = (coords, mode, label) => {
  const s = coords.map((c) => `${c.longitude},${c.latitude},0`).join('\n');
  const cs = mode === 'POLYGON' ? s + `\n${coords[0].longitude},${coords[0].latitude},0` : s;
  const geo = mode === 'POLYGON'
    ? `<Polygon><outerBoundaryIs><LinearRing><coordinates>${cs}</coordinates></LinearRing></outerBoundaryIs></Polygon>`
    : `<LineString><coordinates>${cs}</coordinates></LineString>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document><name>${label}</name><Placemark><name>${label}</name>${geo}</Placemark></Document>
</kml>`;
};

const generateCsv = (coords, label) =>
  ['No,Label,Latitude,Longitude', ...coords.map((c, i) => `${i + 1},${label},${c.latitude.toFixed(8)},${c.longitude.toFixed(8)}`)].join('\n');

// ── MAP CONTENT (Komponen MapView tunggal yang di-memoize) ────────────────────
const MapContent = React.memo(({
  mapRef,
  mapType,
  initialRegion,
  onRegionChangeComplete,
  parsedDasarPolygons,
  parsedFinalPolygons,
  userLocation,
  calloutCoord,
  calloutLabel,
  drawMode,
  drawPoints,
  showPlacemarks,
  placemarks,
  navTarget,
  currentNavPos,
  handleMapPress,
  handlePolygonPress,
  activePolygon,
}) => {
  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFillObject}
      provider={PROVIDER_GOOGLE}
      mapType={mapType}
      initialRegion={initialRegion || { latitude: -4.08, longitude: 122.42, latitudeDelta: 0.35, longitudeDelta: 0.35 }}
      onRegionChangeComplete={onRegionChangeComplete}
      showsCompass={false}
      toolbarEnabled={false}
      onPress={handleMapPress}
    >
      {/* Peta Dasar */}
      {parsedDasarPolygons.map(({ polygon, id, nama_desa, coords }) => {
        const isSelected = activePolygon && (
          (activePolygon.des_kel_id && activePolygon.des_kel_id === polygon.des_kel_id) ||
          (activePolygon.lokasi?.nama_desa && activePolygon.lokasi?.nama_desa === nama_desa)
        );
        return (
          <Polygon
            key={`dasar-${id}`}
            coordinates={coords}
            strokeColor={isSelected ? C_FINAL_STROKE : C_DASAR_STROKE}
            fillColor={isSelected ? C_FINAL_FILL : C_DASAR_FILL}
            strokeWidth={isSelected ? 3 : 1.8}
            tappable
            onPress={() => handlePolygonPress(polygon)}
          />
        );
      })}

      {/* Peta Final */}
      {parsedFinalPolygons.map((p) => (
        <Polygon
          key={`final-${p.kode_desa}-${p.idx}`}
          coordinates={p.coordinates}
          strokeColor={C_FINAL_STROKE}
          fillColor={C_FINAL_FILL}
          strokeWidth={2.2}
          zIndex={2}
        />
      ))}

      {/* GPS User */}
      {isValidCoord(userLocation) && (
        <>
          <Circle
            center={{ latitude: userLocation.latitude, longitude: userLocation.longitude }}
            radius={isFinite(userLocation.accuracy) && userLocation.accuracy > 0 ? userLocation.accuracy : 30}
            fillColor="rgba(8,127,193,0.2)"
            strokeColor="rgba(8,127,193,0.6)"
            strokeWidth={1}
          />
          <Marker
            coordinate={{ latitude: userLocation.latitude, longitude: userLocation.longitude }}
            title="Posisi Anda"
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={styles.gpsMarkerCircle}><View style={styles.gpsMarkerInner} /></View>
          </Marker>
        </>
      )}

      {/* Callout label */}
      {calloutCoord && calloutLabel && (
        <Marker coordinate={calloutCoord} anchor={{ x: 0.2, y: 0.5 }} tracksViewChanges={false}>
          <View style={styles.markerWithCalloutRow}>
            <View style={styles.glowPinCircle}><View style={styles.glowPinDot} /></View>
            <View style={styles.darkCalloutPill}>
              <View style={styles.darkCalloutArrow} />
              <Text style={styles.darkCalloutText} numberOfLines={1}>{calloutLabel}</Text>
            </View>
          </View>
        </Marker>
      )}

      {/* Drawing: Polygon / Polyline */}
      {drawMode === 'POLYGON' && drawPoints.length >= 3 && (
        <Polygon coordinates={drawPoints} strokeColor={C_DRAW_STROKE} fillColor={C_DRAW_FILL} strokeWidth={2.5} zIndex={5} />
      )}
      {drawMode === 'POLYLINE' && drawPoints.length >= 2 && (
        <Polyline coordinates={drawPoints} strokeColor={C_DRAW_STROKE} strokeWidth={2.5} zIndex={5} />
      )}
      {drawPoints.map((pt, i) => (
        <Marker key={`dpt-${i}`} coordinate={pt} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <View style={styles.drawPointDot} />
        </Marker>
      ))}

      {/* Placemark Markers */}
      {showPlacemarks && placemarks.map((pm) => {
        if (!pm.lat || !pm.lon) return null;
        const pLat = parseFloat(pm.lat);
        const pLon = parseFloat(pm.lon);
        if (isNaN(pLat) || isNaN(pLon)) return null;
        const isPublic = pm.isPublic === true;
        return (
          <Marker
            key={`pm-${pm.id}`}
            coordinate={{ latitude: pLat, longitude: pLon }}
            title={pm.judul || 'Placemark'}
            description={pm.deskripsi || (isPublic ? `👤 ${pm.ownerInfo?.nama || 'Pengguna lain'}` : 'Placemark saya')}
            tracksViewChanges={false}
          >
            <View style={[styles.placemarkBubble, { borderColor: isPublic ? C_PUBLIC_PM : C_MINE_PM }]}>
              <Text style={styles.placemarkEmoji}>{SYMBOL_EMOJI[pm.simbol] ?? '●'}</Text>
            </View>
          </Marker>
        );
      })}

      {/* Navigasi: Rute Titik Putus-Putus & Marker Target 🎯 */}
      {navTarget && isValidCoord(navTarget) && (
        <>
          <Marker coordinate={navTarget} title="Target Navigasi" anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
            <View style={styles.navTargetPin}>
              <Text style={styles.navTargetEmoji}>🎯</Text>
            </View>
          </Marker>
          {currentNavPos && isValidCoord(currentNavPos) && (
            <Polyline
              coordinates={[currentNavPos, navTarget]}
              strokeColor={C_NAV_ACCENT}
              strokeWidth={3}
              lineDashPattern={[8, 6]}
              zIndex={6}
            />
          )}
        </>
      )}
    </MapView>
  );
});

// ── KOMPONEN UTAMA MAPPREVIEW ─────────────────────────────────────────────────
const MapPreview = ({
  mapRef,
  polygons = [],
  petaFinalAll = [],
  placemarks = [],
  isLoading = false,
  selectedKecamatanName = '',
  userLocation = null,
  activePolygon: propActivePolygon,
  onActivePolygonChange,
  onCenterLocation,
  onZoomIn,
  onZoomOut,
  onDetailPolygonPress,
}) => {
  const [mapType, setMapType] = useState('hybrid');
  const [showLayerModal, setShowLayerModal] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [internalActivePolygon, setInternalActivePolygon] = useState(null);
  const activePolygon = propActivePolygon !== undefined ? propActivePolygon : internalActivePolygon;

  // Region pelacak kamera agar posisi kamera tetap saat toggle fullscreen
  const [currentRegion, setCurrentRegion] = useState({
    latitude: -4.08,
    longitude: 122.42,
    latitudeDelta: 0.35,
    longitudeDelta: 0.35,
  });

  // State Pengukuran & Menggambar
  const [drawMode, setDrawMode] = useState('NONE');
  const [drawPoints, setDrawPoints] = useState([]);
  const [drawMetrics, setDrawMetrics] = useState({ m2: 0, ha: 0, lengthM: 0 });
  const [showDrawToolbar, setShowDrawToolbar] = useState(false);
  const [showPlacemarks, setShowPlacemarks] = useState(true);
  const [showFinal, setShowFinal] = useState(true);

  // State Navigasi
  const [showNavPanel, setShowNavPanel] = useState(false);
  const [navTargetLat, setNavTargetLat] = useState('');
  const [navTargetLng, setNavTargetLng] = useState('');
  const [navTargetName, setNavTargetName] = useState('');
  const [navIsTracking, setNavIsTracking] = useState(false);
  const [navDistance, setNavDistance] = useState(0);
  const [navBearing, setNavBearing] = useState(0);
  const [navHeading, setNavHeading] = useState(0);
  const [navCurrentPos, setNavCurrentPos] = useState(null);
  const [navPickMode, setNavPickMode] = useState(false); // Mode pilih titik target dari peta

  const fullMapRef = useRef(null);

  // Sync GPS dengan Redux
  const reduxPos = useSelector((s) => s.CURRENT_POSITION);

  useEffect(() => {
    if (reduxPos) {
      setNavCurrentPos({ latitude: reduxPos.lat, longitude: reduxPos.lon });
    }
  }, [reduxPos]);

  // Sync NavigasiService (Menggunakan Deadband Throttling untuk performa maksimal)
  useEffect(() => {
    const state = NavigasiService.getState();
    if (state.isNavigating && state.targetLat && state.targetLng) {
      setNavTargetLat(state.targetLat.toFixed(6));
      setNavTargetLng(state.targetLng.toFixed(6));
      setNavTargetName(state.targetName || '');
      setNavDistance(state.distance || 0);
      setNavBearing(state.bearing || 0);
      setNavHeading(state.heading || 0);
      if (state.currentPos) setNavCurrentPos(state.currentPos);
      setNavIsTracking(true);
    }

    const unsub = NavigasiService.addListener((s) => {
      if (s.isNavigating) {
        setNavIsTracking((prev) => (!prev ? true : prev));
        if (s.currentPos) {
          setNavCurrentPos((prev) => {
            if (!prev || prev.latitude !== s.currentPos.latitude || prev.longitude !== s.currentPos.longitude) {
              return s.currentPos;
            }
            return prev;
          });
        }
        // Filter deadband agar re-render tidak meledak
        setNavDistance((prev) => (Math.abs((prev || 0) - (s.distance || 0)) > 0.5 ? s.distance || 0 : prev));
        setNavBearing((prev) => (Math.abs((prev || 0) - (s.bearing || 0)) > 0.5 ? s.bearing || 0 : prev));
        setNavHeading((prev) => (Math.abs((prev || 0) - (s.heading || 0)) > 1.5 ? s.heading || 0 : prev));
      } else {
        setNavIsTracking((prev) => (prev ? false : prev));
      }
    });

    return () => {
      unsub();
    };
  }, []);

  // Update preview jarak & bearing jika user mengetik manual koordinat target
  useEffect(() => {
    const lat2 = parseFloat(navTargetLat);
    const lng2 = parseFloat(navTargetLng);
    const pos = navCurrentPos || userLocation;
    if (pos && !isNaN(lat2) && !isNaN(lng2) && isFinite(lat2) && isFinite(lng2)) {
      setNavDistance(calcNavDistance(pos.latitude, pos.longitude, lat2, lng2));
      setNavBearing(calcNavBearing(pos.latitude, pos.longitude, lat2, lng2));
    }
  }, [navTargetLat, navTargetLng, navCurrentPos?.latitude, navCurrentPos?.longitude, userLocation?.latitude, userLocation?.longitude]);

  const parsedNavTarget = useMemo(() => {
    const lat = parseFloat(navTargetLat);
    const lng = parseFloat(navTargetLng);
    if (!isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng };
    }
    return null;
  }, [navTargetLat, navTargetLng]);

  const startNavigation = async () => {
    if (!parsedNavTarget) {
      Alert.alert('Target belum ditentukan', 'Masukkan koordinat target atau tap peta untuk memilih titik tujuan.');
      return;
    }
    const success = await NavigasiService.startNavigation({
      targetLat: parsedNavTarget.latitude,
      targetLng: parsedNavTarget.longitude,
      targetName: navTargetName || `Titik (${parsedNavTarget.latitude.toFixed(4)}, ${parsedNavTarget.longitude.toFixed(4)})`,
      currentPos: navCurrentPos || userLocation,
    });
    if (success) {
      setNavIsTracking(true);
    } else {
      Alert.alert('Gagal', 'Navigasi tidak bisa dimulai.');
    }
  };

  const stopNavigation = async () => {
    await NavigasiService.stopNavigation();
    setNavIsTracking(false);
  };

  // Smart Overlay: Sembunyikan peta dasar jika desa tersebut sudah ada di peta final
  const finalDesaSet = useMemo(() => {
    const s = new Set();
    petaFinalAll.forEach((p) => { if (p.kode_desa) s.add(p.kode_desa); });
    return s;
  }, [petaFinalAll]);

  const smartDasarPolygons = useMemo(() =>
    polygons.filter((p) => !finalDesaSet.has(p.lokasi?.kode_desa || p.kode_desa)),
    [polygons, finalDesaSet]
  );

  const activeFinalPolygons = useMemo(() => {
    if (!showFinal || !petaFinalAll.length) return [];
    if (!selectedKecamatanName) return petaFinalAll;
    const sampleKode = polygons[0]?.lokasi?.kode_desa || '';
    if (!sampleKode) return petaFinalAll;
    const prefix = sampleKode.substring(0, 8);
    return petaFinalAll.filter((p) => p.kode_desa?.startsWith(prefix));
  }, [petaFinalAll, polygons, showFinal, selectedKecamatanName]);

  const handlePolygonPress = useCallback((polygon) => {
    if (onActivePolygonChange) onActivePolygonChange(polygon);
    else setInternalActivePolygon(polygon);
  }, [onActivePolygonChange]);

  const getCentroid = (coords) => {
    if (!coords || !Array.isArray(coords) || coords.length === 0) return null;
    let sumLat = 0, sumLng = 0, n = 0;
    coords.forEach((c) => {
      if (!c) return;
      const lat = c.latitude != null ? parseFloat(c.latitude) : parseFloat(c.lat);
      const lng = c.longitude != null ? parseFloat(c.longitude) : parseFloat(c.lng);
      if (isFinite(lat) && isFinite(lng) && !isNaN(lat) && !isNaN(lng)) { sumLat += lat; sumLng += lng; n++; }
    });
    if (n === 0) return null;
    const c = { latitude: sumLat / n, longitude: sumLng / n };
    return isValidCoord(c) ? c : null;
  };

  const targetPolygon = activePolygon || (polygons.length > 0 ? polygons[0] : null);
  const rawCalloutCoord = targetPolygon?.lokasi?.coordinat ? getCentroid(targetPolygon.lokasi.coordinat) : userLocation || null;
  const calloutCoord = isValidCoord(rawCalloutCoord) ? rawCalloutCoord : null;
  const calloutLabel = activePolygon?.lokasi?.nama_desa || selectedKecamatanName || null;

  const bottomCardTitle = activePolygon?.lokasi?.nama_desa || (selectedKecamatanName ? `Kec. ${selectedKecamatanName}` : null);
  const bottomCardSub = activePolygon?.calculatedArea
    ? `${activePolygon.calculatedArea} km² · ${activePolygon.status === '1' ? 'Disahkan' : 'Peta Dasar'}`
    : selectedKecamatanName ? `${polygons.length} Desa Terpetakan` : null;

  const parsedDasarPolygons = useMemo(() => {
    if (!Array.isArray(smartDasarPolygons)) return [];
    return smartDasarPolygons.map((polygon, index) => {
      const rawCoords = polygon?.lokasi?.coordinat;
      if (!Array.isArray(rawCoords) || rawCoords.length < 3) return null;
      const coords = rawCoords.map((c) => {
        if (!c) return null;
        const lat = c.latitude != null ? parseFloat(c.latitude) : parseFloat(c.lat);
        const lng = c.longitude != null ? parseFloat(c.longitude) : parseFloat(c.lng);
        if (isFinite(lat) && isFinite(lng) && !isNaN(lat) && !isNaN(lng)) return { latitude: lat, longitude: lng };
        return null;
      }).filter(Boolean);
      if (coords.length < 3) return null;
      return { polygon, index, id: polygon.des_kel_id || `idx-${index}`, nama_desa: polygon.lokasi?.nama_desa || '', coords };
    }).filter(Boolean);
  }, [smartDasarPolygons]);

  const parsedFinalPolygons = useMemo(() =>
    Array.isArray(activeFinalPolygons)
      ? activeFinalPolygons.map((p, i) => Array.isArray(p.coordinates) && p.coordinates.length >= 3 ? { ...p, idx: i } : null).filter(Boolean)
      : [],
    [activeFinalPolygons]
  );

  // Penanganan Tap pada Peta (Bekerja mulus untuk Mode Gambar & Mode Pilih Koordinat)
  const handleMapPress = useCallback((e) => {
    const coord = e.nativeEvent?.coordinate;
    if (!coord) return;

    // 1. Jika dalam mode memilih koordinat tujuan navigasi dari peta
    if (navPickMode) {
      setNavTargetLat(coord.latitude.toFixed(6));
      setNavTargetLng(coord.longitude.toFixed(6));
      setNavTargetName(`Titik (${coord.latitude.toFixed(4)}, ${coord.longitude.toFixed(4)})`);
      setNavPickMode(false);
      setShowNavPanel(true);
      return;
    }

    // 2. Jika dalam mode menggambar Polygon / Polyline
    if (drawMode !== 'NONE') {
      setDrawPoints((prev) => {
        const next = [...prev, coord];
        if (drawMode === 'POLYGON' && next.length >= 3) {
          const { m2, ha } = calcGeodesicArea(next);
          setDrawMetrics({ m2, ha, lengthM: 0 });
        } else if (drawMode === 'POLYLINE' && next.length >= 2) {
          setDrawMetrics({ m2: 0, ha: 0, lengthM: calcPolylineLength(next) });
        }
        return next;
      });
    }
  }, [navPickMode, drawMode]);

  const startDraw = (mode) => {
    setDrawMode(mode);
    setDrawPoints([]);
    setDrawMetrics({ m2: 0, ha: 0, lengthM: 0 });
    setShowDrawToolbar(true);
    setShowLayerModal(false);
  };

  const clearDraw = () => {
    setDrawMode('NONE');
    setDrawPoints([]);
    setDrawMetrics({ m2: 0, ha: 0, lengthM: 0 });
    setShowDrawToolbar(false);
  };

  const undoLastPoint = () => setDrawPoints((prev) => {
    const next = prev.slice(0, -1);
    if (drawMode === 'POLYGON' && next.length >= 3) {
      const { m2, ha } = calcGeodesicArea(next);
      setDrawMetrics({ m2, ha, lengthM: 0 });
    } else if (drawMode === 'POLYLINE' && next.length >= 2) {
      setDrawMetrics({ m2: 0, ha: 0, lengthM: calcPolylineLength(next) });
    } else {
      setDrawMetrics({ m2: 0, ha: 0, lengthM: 0 });
    }
    return next;
  });

  const handleDownloadKml = async () => {
    if (drawPoints.length < 2) {
      Alert.alert('Tidak ada gambar', 'Gambar polygon atau polyline terlebih dahulu.');
      return;
    }
    try {
      const label = `Gambar_${drawMode}_${Date.now()}`;
      const path = `${RNFS.CachesDirectoryPath}/${label}.kml`;
      await RNFS.writeFile(path, generateKml(drawPoints, drawMode, label), 'utf8');
      await Share.open({
        url: `file://${path}`,
        type: 'application/vnd.google-earth.kml+xml',
        title: 'Ekspor KML',
      });
    } catch (e) {
      if (e?.message && e.message !== 'User did not share') Alert.alert('Gagal', e.message);
    }
  };

  const handleDownloadExcel = async () => {
    if (drawPoints.length < 1) {
      Alert.alert('Tidak ada titik', 'Gambar titik koordinat terlebih dahulu.');
      return;
    }
    try {
      const label = `Koordinat_${drawMode}_${Date.now()}`;
      const path = `${RNFS.CachesDirectoryPath}/${label}.csv`;
      await RNFS.writeFile(path, generateCsv(drawPoints, label), 'utf8');
      await Share.open({
        url: `file://${path}`,
        type: 'text/csv',
        title: 'Ekspor Koordinat',
      });
    } catch (e) {
      if (e?.message && e.message !== 'User did not share') Alert.alert('Gagal', e.message);
    }
  };

  // Navigasi kontrol Fullscreen
  const handleFsZoomIn = () => {
    fullMapRef.current?.getCamera().then((c) => {
      if (c?.zoom != null) fullMapRef.current.animateCamera({ zoom: c.zoom + 1 });
    }).catch(() => {});
  };

  const handleFsZoomOut = () => {
    fullMapRef.current?.getCamera().then((c) => {
      if (c?.zoom != null) fullMapRef.current.animateCamera({ zoom: Math.max(c.zoom - 1, 1) });
    }).catch(() => {});
  };

  const handleFsCenterLocation = () => {
    const loc = userLocation || (reduxPos ? { latitude: reduxPos.lat, longitude: reduxPos.lon } : null);
    if (loc && fullMapRef.current) {
      fullMapRef.current.animateToRegion({
        latitude: loc.latitude,
        longitude: loc.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 700);
    } else {
      GpsService.startTracking();
      Alert.alert('GPS Belum Terkunci', 'Sedang mendeteksi sinyal GPS. Pastikan GPS aktif.');
    }
  };

  // Props bersama untuk MapContent
  const sharedMapProps = {
    mapType,
    initialRegion: currentRegion,
    onRegionChangeComplete: setCurrentRegion,
    parsedDasarPolygons,
    parsedFinalPolygons,
    userLocation,
    calloutCoord,
    calloutLabel,
    drawMode,
    drawPoints,
    showPlacemarks,
    placemarks,
    navTarget: parsedNavTarget,
    currentNavPos: navCurrentPos,
    handleMapPress,
    handlePolygonPress,
    activePolygon,
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.mapContainer}>
        {/* MAP CANVAS INLINE — HANYA DIRENDER JIKA TIDAK SEDANG FULLSCREEN
            Ini menjaga hanya ADA 1 INSTANCE MAPVIEW pada satu waktu! */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={C_PRIMARY} />
            <Text style={styles.loadingText}>Memuat Koordinat Geospasial...</Text>
          </View>
        ) : !showFullscreen ? (
          <MapContent
            {...sharedMapProps}
            mapRef={mapRef}
          />
        ) : (
          <View style={styles.mapPlaceholder} />
        )}

        {/* TOP-LEFT CARD */}
        <View style={styles.topLeftCard}>
          <View style={styles.mapIconBadge}>
            <FastImage
              source={require('../../assets/img/map.png')}
              style={styles.mapIconImg}
              resizeMode={FastImage.resizeMode.contain}
              tintColor="#FFFFFF"
            />
          </View>
          <View style={styles.topLeftTextCol}>
            <Text style={styles.mapTitleHeader}>Peta Batas Desa</Text>
            <Text style={styles.mapSubHeader}>Kab. Konawe Selatan</Text>
          </View>
        </View>

        {/* TOP-RIGHT: TOMBOL LAYER */}
        <TouchableOpacity style={styles.layerSelectorBtn} onPress={() => setShowLayerModal(true)} activeOpacity={0.8}>
          <FastImage
            source={require('../../assets/img/gis_pirate-map.png')}
            style={styles.layerIcon}
            resizeMode={FastImage.resizeMode.contain}
            tintColor={C_PRIMARY}
          />
          <Text style={styles.layerText}>Layer</Text>
          <Text style={styles.layerChevron}>⌵</Text>
        </TouchableOpacity>

        {/* TOMBOL LAYAR PENUH */}
        <TouchableOpacity
          style={styles.fullscreenBtn}
          onPress={() => setShowFullscreen(true)}
          activeOpacity={0.8}
          accessibilityLabel="Layar Penuh"
        >
          <Text style={styles.fullscreenIcon}>⛶</Text>
          <Text style={styles.fullscreenLabel}>Layar Penuh</Text>
        </TouchableOpacity>

        {/* RIGHT CONTROLS INLINE */}
        <View style={styles.rightControlsStack}>
          <TouchableOpacity
            style={styles.controlCircleBtn}
            onPress={() => mapRef.current?.animateCamera?.({ heading: 0, pitch: 0 })}
            activeOpacity={0.75}
            accessibilityLabel="Reset Arah Utara"
          >
            <View style={styles.northCompassWrap}>
              <Text style={styles.northArrowRed}>▲</Text>
              <Text style={styles.northLetterN}>N</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlCircleBtn} onPress={onZoomIn} activeOpacity={0.75} accessibilityLabel="Perbesar">
            <Text style={styles.zoomIconText}>＋</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlCircleBtn} onPress={onZoomOut} activeOpacity={0.75} accessibilityLabel="Perkecil">
            <Text style={styles.zoomIconText}>−</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.controlCircleBtn, styles.controlCircleAccent]} onPress={onCenterLocation} activeOpacity={0.75} accessibilityLabel="Lokasi Saya">
            <Text style={styles.targetIcon}>🎯</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlCircleBtn, showDrawToolbar && styles.controlCircleActive]}
            onPress={() => setShowDrawToolbar((v) => !v)}
            activeOpacity={0.75}
            accessibilityLabel="Gambar"
          >
            <Text style={styles.drawToolIcon}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlCircleBtn, !showPlacemarks && styles.controlCircleDim]}
            onPress={() => setShowPlacemarks((v) => !v)}
            activeOpacity={0.75}
            accessibilityLabel="Placemark"
          >
            <Text style={styles.targetIcon}>📌</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlCircleBtn, navIsTracking && styles.controlCircleNav]}
            onPress={() => { setShowNavPanel(true); setShowLayerModal(false); }}
            activeOpacity={0.75}
            accessibilityLabel="Navigasi Koordinat"
          >
            <Text style={styles.navToolIcon}>🧭</Text>
          </TouchableOpacity>
        </View>

        {/* TOOLBAR GAMBAR INLINE */}
        {showDrawToolbar && (
          <View style={styles.drawToolbar}>
            <TouchableOpacity style={[styles.drawBtn, drawMode === 'POLYGON' && styles.drawBtnActive]} onPress={() => startDraw('POLYGON')} activeOpacity={0.8}>
              <Text style={styles.drawBtnText}>⬡ Polygon</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.drawBtn, drawMode === 'POLYLINE' && styles.drawBtnActive]} onPress={() => startDraw('POLYLINE')} activeOpacity={0.8}>
              <Text style={styles.drawBtnText}>〰 Garis</Text>
            </TouchableOpacity>
            {drawPoints.length > 0 && (
              <>
                <TouchableOpacity style={styles.drawBtnUndo} onPress={undoLastPoint} activeOpacity={0.8}><Text style={styles.drawBtnText}>↩ Undo</Text></TouchableOpacity>
                <TouchableOpacity style={styles.drawBtnDownload} onPress={handleDownloadKml} activeOpacity={0.8}><Text style={styles.drawBtnText}>📥 KML</Text></TouchableOpacity>
                <TouchableOpacity style={styles.drawBtnDownload} onPress={handleDownloadExcel} activeOpacity={0.8}><Text style={styles.drawBtnText}>📊 Excel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.drawBtnClear} onPress={clearDraw} activeOpacity={0.8}><Text style={styles.drawBtnText}>✕ Hapus</Text></TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* METRIK GAMBAR INLINE */}
        {drawMode !== 'NONE' && drawPoints.length >= 2 && (
          <View style={styles.metricsCard}>
            {drawMode === 'POLYGON' && drawPoints.length >= 3 ? (
              <><Text style={styles.metricsValue}>{drawMetrics.m2.toLocaleString()} m²</Text><Text style={styles.metricsLabel}>{drawMetrics.ha} Ha</Text></>
            ) : (
              <><Text style={styles.metricsValue}>{fmtM(drawMetrics.lengthM)}</Text><Text style={styles.metricsLabel}>Panjang</Text></>
            )}
            <Text style={styles.metricsPoints}>{drawPoints.length} titik</Text>
          </View>
        )}

        {/* HINT DRAW INLINE */}
        {drawMode !== 'NONE' && (
          <View style={styles.drawHintBanner}>
            <Text style={styles.drawHintText}>{drawMode === 'POLYGON' ? '⬡ Tap peta untuk menambah titik polygon' : '〰 Tap peta untuk menambah titik garis'}</Text>
          </View>
        )}

        {/* HINT PILIH TARGET DARI PETA INLINE */}
        {navPickMode && (
          <View style={styles.navPickHint}>
            <Text style={styles.navPickHintText}>🎯 Tap peta untuk memilih titik tujuan navigasi</Text>
            <TouchableOpacity onPress={() => { setNavPickMode(false); setShowNavPanel(true); }} style={styles.navPickCancel}>
              <Text style={styles.navPickCancelTxt}>Batal</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* NAVIGASI MINI BADGE */}
        {navIsTracking && parsedNavTarget && (
          <TouchableOpacity style={styles.navBadge} onPress={() => setShowNavPanel(true)} activeOpacity={0.85}>
            <Text style={styles.navBadgeIcon}>🧭</Text>
            <View>
              <Text style={styles.navBadgeDist}>{fmtM(Math.round(navDistance))}</Text>
              <Text style={styles.navBadgeDir}>{getDir(navBearing)} · {Math.round(navBearing)}°</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* INFO WILAYAH (BOTTOM-LEFT) */}
        {bottomCardTitle && (
          <TouchableOpacity
            style={styles.bottomLeftCard}
            onPress={() => { if (onDetailPolygonPress) onDetailPolygonPress(activePolygon || { nama: bottomCardTitle }); }}
            activeOpacity={0.88}
          >
            <View style={styles.bottomCardContent}>
              <Text style={styles.bottomCardTitle} numberOfLines={1}>{bottomCardTitle}</Text>
              {bottomCardSub && <Text style={styles.bottomCardSubtitle} numberOfLines={1}>{bottomCardSub}</Text>}
            </View>
            <View style={styles.chevronWrap}><Text style={styles.bottomCardChevron}>›</Text></View>
          </TouchableOpacity>
        )}

        {/* LEGENDA */}
        {(parsedFinalPolygons.length > 0 || parsedDasarPolygons.length > 0) && (
          <View style={styles.legendCard}>
            {parsedFinalPolygons.length > 0 && (
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: C_FINAL_STROKE }]} /><Text style={styles.legendText}>Final ({parsedFinalPolygons.length})</Text></View>
            )}
            {parsedDasarPolygons.length > 0 && (
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: C_DASAR_STROKE }]} /><Text style={styles.legendText}>Dasar ({parsedDasarPolygons.length})</Text></View>
            )}
            {placemarks.length > 0 && showPlacemarks && (
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: C_MINE_PM }]} /><Text style={styles.legendText}>Patok ({placemarks.length})</Text></View>
            )}
          </View>
        )}

        {/* SCALE BAR */}
        <View style={styles.scaleBarContainer}>
          <Text style={styles.scaleText}>0      5      10 km</Text>
          <View style={styles.scaleRuler}>
            <View style={styles.rulerSegmentWhite} />
            <View style={styles.rulerSegmentBlack} />
            <View style={styles.rulerSegmentWhite} />
          </View>
        </View>
      </View>

      {/* ══════════════════════════════════════════════════════════════
          MODAL FULLSCREEN PETA (Hanya render MapContent saat visible)
      ══════════════════════════════════════════════════════════════ */}
      <Modal visible={showFullscreen} animationType="slide" statusBarTranslucent onRequestClose={() => setShowFullscreen(false)}>
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        <View style={styles.fsContainer}>
          {showFullscreen && (
            <MapContent
              {...sharedMapProps}
              mapRef={fullMapRef}
            />
          )}

          {/* Header Fullscreen */}
          <View style={styles.fsHeader}>
            <TouchableOpacity style={styles.fsBackBtn} onPress={() => setShowFullscreen(false)} activeOpacity={0.8}>
              <Text style={styles.fsBackIcon}>✕</Text>
            </TouchableOpacity>
            <View style={styles.fsHeaderTitle}>
              <Text style={styles.fsTitle}>Peta Batas Desa</Text>
              <Text style={styles.fsSub}>Kab. Konawe Selatan</Text>
            </View>
            {navIsTracking && (
              <TouchableOpacity style={styles.fsNavBadge} onPress={() => setShowNavPanel(true)} activeOpacity={0.85}>
                <Text style={styles.fsNavBadgeTxt}>🧭 {fmtM(Math.round(navDistance))}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Right Controls Fullscreen */}
          <View style={[styles.rightControlsStack, styles.fsRightControls]}>
            <TouchableOpacity
              style={styles.controlCircleBtn}
              onPress={() => fullMapRef.current?.animateCamera?.({ heading: 0, pitch: 0 })}
              activeOpacity={0.75}
              accessibilityLabel="Reset Arah Utara"
            >
              <View style={styles.northCompassWrap}>
                <Text style={styles.northArrowRed}>▲</Text>
                <Text style={styles.northLetterN}>N</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlCircleBtn} onPress={handleFsZoomIn} activeOpacity={0.75}>
              <Text style={styles.zoomIconText}>＋</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlCircleBtn} onPress={handleFsZoomOut} activeOpacity={0.75}>
              <Text style={styles.zoomIconText}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.controlCircleBtn, styles.controlCircleAccent]} onPress={handleFsCenterLocation} activeOpacity={0.75}>
              <Text style={styles.targetIcon}>🎯</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.controlCircleBtn, showDrawToolbar && styles.controlCircleActive]} onPress={() => setShowDrawToolbar((v) => !v)} activeOpacity={0.75}>
              <Text style={styles.drawToolIcon}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.controlCircleBtn, !showPlacemarks && styles.controlCircleDim]} onPress={() => setShowPlacemarks((v) => !v)} activeOpacity={0.75}>
              <Text style={styles.targetIcon}>📌</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.controlCircleBtn, navIsTracking && styles.controlCircleNav]} onPress={() => setShowNavPanel(true)} activeOpacity={0.75}>
              <Text style={styles.navToolIcon}>🧭</Text>
            </TouchableOpacity>
          </View>

          {/* Toolbar Gambar Fullscreen */}
          {showDrawToolbar && (
            <View style={styles.drawToolbar}>
              <TouchableOpacity style={[styles.drawBtn, drawMode === 'POLYGON' && styles.drawBtnActive]} onPress={() => startDraw('POLYGON')} activeOpacity={0.8}>
                <Text style={styles.drawBtnText}>⬡ Polygon</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.drawBtn, drawMode === 'POLYLINE' && styles.drawBtnActive]} onPress={() => startDraw('POLYLINE')} activeOpacity={0.8}>
                <Text style={styles.drawBtnText}>〰 Garis</Text>
              </TouchableOpacity>
              {drawPoints.length > 0 && (
                <>
                  <TouchableOpacity style={styles.drawBtnUndo} onPress={undoLastPoint} activeOpacity={0.8}><Text style={styles.drawBtnText}>↩ Undo</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.drawBtnDownload} onPress={handleDownloadKml} activeOpacity={0.8}><Text style={styles.drawBtnText}>📥 KML</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.drawBtnDownload} onPress={handleDownloadExcel} activeOpacity={0.8}><Text style={styles.drawBtnText}>📊 Excel</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.drawBtnClear} onPress={clearDraw} activeOpacity={0.8}><Text style={styles.drawBtnText}>✕ Hapus</Text></TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* Metrik Gambar Fullscreen */}
          {drawMode !== 'NONE' && drawPoints.length >= 2 && (
            <View style={styles.metricsCard}>
              {drawMode === 'POLYGON' && drawPoints.length >= 3 ? (
                <><Text style={styles.metricsValue}>{drawMetrics.m2.toLocaleString()} m²</Text><Text style={styles.metricsLabel}>{drawMetrics.ha} Ha</Text></>
              ) : (
                <><Text style={styles.metricsValue}>{fmtM(drawMetrics.lengthM)}</Text><Text style={styles.metricsLabel}>Panjang</Text></>
              )}
              <Text style={styles.metricsPoints}>{drawPoints.length} titik</Text>
            </View>
          )}

          {/* Hint Gambar Fullscreen */}
          {drawMode !== 'NONE' && (
            <View style={[styles.drawHintBanner, { bottom: 80 }]}>
              <Text style={styles.drawHintText}>{drawMode === 'POLYGON' ? '⬡ Tap peta untuk menambah titik polygon' : '〰 Tap peta untuk menambah titik garis'}</Text>
            </View>
          )}

          {/* Hint Pilih Target Dari Peta Fullscreen */}
          {navPickMode && (
            <View style={styles.navPickHint}>
              <Text style={styles.navPickHintText}>🎯 Tap peta untuk memilih titik tujuan navigasi</Text>
              <TouchableOpacity onPress={() => { setNavPickMode(false); setShowNavPanel(true); }} style={styles.navPickCancel}>
                <Text style={styles.navPickCancelTxt}>Batal</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Scale Bar Fullscreen */}
          <View style={[styles.scaleBarContainer, { bottom: 30 }]}>
            <Text style={styles.scaleText}>0      5      10 km</Text>
            <View style={styles.scaleRuler}>
              <View style={styles.rulerSegmentWhite} />
              <View style={styles.rulerSegmentBlack} />
              <View style={styles.rulerSegmentWhite} />
            </View>
          </View>

          {/* Bottom Card Fullscreen */}
          {bottomCardTitle && (
            <TouchableOpacity style={[styles.bottomLeftCard, { bottom: 30 }]} onPress={() => { if (onDetailPolygonPress) onDetailPolygonPress(activePolygon); }} activeOpacity={0.88}>
              <View style={styles.bottomCardContent}>
                <Text style={styles.bottomCardTitle} numberOfLines={1}>{bottomCardTitle}</Text>
                {bottomCardSub && <Text style={styles.bottomCardSubtitle} numberOfLines={1}>{bottomCardSub}</Text>}
              </View>
              <Text style={styles.bottomCardChevron}>›</Text>
            </TouchableOpacity>
          )}

          {/* Legenda Fullscreen */}
          {(parsedFinalPolygons.length > 0 || parsedDasarPolygons.length > 0) && (
            <View style={[styles.legendCard, { bottom: 30, right: 80 }]}>
              {parsedFinalPolygons.length > 0 && <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: C_FINAL_STROKE }]} /><Text style={styles.legendText}>Final ({parsedFinalPolygons.length})</Text></View>}
              {parsedDasarPolygons.length > 0 && <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: C_DASAR_STROKE }]} /><Text style={styles.legendText}>Dasar ({parsedDasarPolygons.length})</Text></View>}
              {placemarks.length > 0 && showPlacemarks && <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: C_MINE_PM }]} /><Text style={styles.legendText}>Patok ({placemarks.length})</Text></View>}
            </View>
          )}
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          MODAL NAVIGASI (Dengan CompassView Asli yang Ringan)
      ══════════════════════════════════════════════════════════════ */}
      <Modal visible={showNavPanel} transparent animationType="slide" onRequestClose={() => setShowNavPanel(false)}>
        <View style={styles.navModalBackdrop}>
          <View style={styles.navModalCard}>
            {/* Header Navigasi */}
            <View style={styles.navModalHeader}>
              <Text style={styles.navModalTitle}>🧭 Navigasi Koordinat</Text>
              <TouchableOpacity onPress={() => setShowNavPanel(false)} style={styles.navModalCloseBtn}>
                <Text style={styles.navModalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* KOMPAS ANIMASI TERINTEGRASI */}
              {navIsTracking && parsedNavTarget && (
                <View style={styles.navCompassSection}>
                  <CompassView heading={navHeading} bearing={navBearing} distance={navDistance} />
                  <View style={styles.navInfoRow}>
                    <View style={styles.navInfoCard}>
                      <Text style={styles.navInfoVal}>{fmtM(Math.round(navDistance))}</Text>
                      <Text style={styles.navInfoLbl}>Jarak</Text>
                    </View>
                    <View style={styles.navInfoCard}>
                      <Text style={styles.navInfoVal}>{Math.round(navBearing)}°</Text>
                      <Text style={styles.navInfoLbl}>Bearing</Text>
                    </View>
                    <View style={styles.navInfoCard}>
                      <Text style={styles.navInfoVal}>{getDir(navBearing)}</Text>
                      <Text style={styles.navInfoLbl}>Arah</Text>
                    </View>
                    <View style={styles.navInfoCard}>
                      <Text style={styles.navInfoVal}>{Math.round(navHeading)}°</Text>
                      <Text style={styles.navInfoLbl}>Heading</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* INPUT TARGET */}
              <Text style={styles.navSectionLabel}>TARGET NAVIGASI</Text>
              <TextInput
                style={styles.navInput}
                placeholder="Nama target (opsional)"
                placeholderTextColor={C_MID}
                value={navTargetName}
                onChangeText={setNavTargetName}
              />

              <View style={styles.navCoordRow}>
                <TextInput
                  style={[styles.navInput, { flex: 1, marginRight: 6 }]}
                  placeholder="Latitude (-90 s/d 90)"
                  placeholderTextColor={C_MID}
                  value={navTargetLat}
                  onChangeText={setNavTargetLat}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.navInput, { flex: 1 }]}
                  placeholder="Longitude (-180 s/d 180)"
                  placeholderTextColor={C_MID}
                  value={navTargetLng}
                  onChangeText={setNavTargetLng}
                  keyboardType="numeric"
                />
              </View>

              {/* PILIH DARI PETA */}
              <TouchableOpacity
                style={styles.navPickBtn}
                onPress={() => {
                  setNavPickMode(true);
                  setShowNavPanel(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.navPickBtnText}>🗺 Pilih dari Peta</Text>
              </TouchableOpacity>

              {/* POSISI GPS SAAT INI */}
              {navCurrentPos && (
                <View style={styles.navCurrentPosCard}>
                  <Text style={styles.navCurrentPosLabel}>📍 Posisi Anda Saat Ini</Text>
                  <Text style={styles.navCurrentPosCoord}>
                    {navCurrentPos.latitude.toFixed(6)}, {navCurrentPos.longitude.toFixed(6)}
                  </Text>
                </View>
              )}

              {/* PREVIEW JARAK & ARAH SEBELUM MEMULAI */}
              {parsedNavTarget && !navIsTracking && (
                <View style={styles.navPreviewCard}>
                  <Text style={styles.navPreviewTitle}>Preview Rute Menuju Target</Text>
                  <Text style={styles.navPreviewDist}>Jarak Garis Lurus: {fmtM(Math.round(navDistance))}</Text>
                  <Text style={styles.navPreviewBear}>Arah: {Math.round(navBearing)}° ({getDir(navBearing)})</Text>
                </View>
              )}

              {/* TOMBOL AKSI NAVIGASI */}
              <View style={styles.navActionRow}>
                {!navIsTracking ? (
                  <TouchableOpacity
                    style={[styles.navStartBtn, !parsedNavTarget && styles.navStartBtnDisabled]}
                    onPress={startNavigation}
                    activeOpacity={0.85}
                    disabled={!parsedNavTarget}
                  >
                    <Text style={styles.navStartBtnText}>🧭 Mulai Navigasi</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.navStopBtn} onPress={stopNavigation} activeOpacity={0.85}>
                    <Text style={styles.navStopBtnText}>⏹ Hentikan Navigasi</Text>
                  </TouchableOpacity>
                )}
              </View>

              {navTargetName && parsedNavTarget && (
                <Text style={styles.navTargetNameLabel}>🎯 Target: {navTargetName}</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          MODAL PILIH LAYER & OPSI PETA
      ══════════════════════════════════════════════════════════════ */}
      <Modal visible={showLayerModal} transparent animationType="fade" onRequestClose={() => setShowLayerModal(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowLayerModal(false)}>
          <View style={styles.layerModalCard}>
            <Text style={styles.layerModalTitle}>Opsi Peta</Text>

            <Text style={styles.layerSectionLabel}>TIPE BASEMAP</Text>
            {[
              { type: 'hybrid', icon: '🛰️', label: 'Citra Satelit & Jalan', sub: 'Rekomendasi survei spasial' },
              { type: 'satellite', icon: '🌍', label: 'Satelit Murni', sub: 'Foto udara resolusi tinggi' },
              { type: 'standard', icon: '🗺️', label: 'Peta Jalan Vektor', sub: 'Hemat kuota & cepat dimuat' },
              { type: 'terrain', icon: '⛰️', label: 'Kontur Medan', sub: 'Elevasi topografi pegunungan' },
            ].map((opt) => (
              <TouchableOpacity key={opt.type} style={[styles.layerOptionRow, mapType === opt.type && styles.layerOptionActive]} onPress={() => { setMapType(opt.type); setShowLayerModal(false); }}>
                <Text style={styles.layerOptionIcon}>{opt.icon}</Text>
                <View style={{ flex: 1 }}><Text style={styles.layerOptionText}>{opt.label}</Text><Text style={styles.layerOptionSub}>{opt.sub}</Text></View>
                {mapType === opt.type && <Text style={styles.checkIcon}>✓</Text>}
              </TouchableOpacity>
            ))}

            <Text style={[styles.layerSectionLabel, { marginTop: 10 }]}>ALAT GAMBAR</Text>
            <TouchableOpacity style={[styles.layerOptionRow, drawMode === 'POLYGON' && styles.layerOptionActive]} onPress={() => startDraw('POLYGON')}>
              <Text style={styles.layerOptionIcon}>⬡</Text>
              <View style={{ flex: 1 }}><Text style={styles.layerOptionText}>Gambar Polygon</Text><Text style={styles.layerOptionSub}>Hitung luas m² & Hektar</Text></View>
              {drawMode === 'POLYGON' && <Text style={styles.checkIcon}>✓</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.layerOptionRow, drawMode === 'POLYLINE' && styles.layerOptionActive]} onPress={() => startDraw('POLYLINE')}>
              <Text style={styles.layerOptionIcon}>〰</Text>
              <View style={{ flex: 1 }}><Text style={styles.layerOptionText}>Gambar Garis (Polyline)</Text><Text style={styles.layerOptionSub}>Hitung panjang meter / km</Text></View>
              {drawMode === 'POLYLINE' && <Text style={styles.checkIcon}>✓</Text>}
            </TouchableOpacity>
            {drawMode !== 'NONE' && drawPoints.length > 0 && (
              <View style={styles.downloadRow}>
                <TouchableOpacity style={styles.downloadBtn} onPress={() => { setShowLayerModal(false); setTimeout(handleDownloadKml, 300); }}>
                  <Text style={styles.downloadBtnText}>📥 Download KML</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.downloadBtn} onPress={() => { setShowLayerModal(false); setTimeout(handleDownloadExcel, 300); }}>
                  <Text style={styles.downloadBtnText}>📊 Download Excel</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={[styles.layerSectionLabel, { marginTop: 10 }]}>NAVIGASI</Text>
            <TouchableOpacity
              style={[styles.layerOptionRow, navIsTracking && styles.layerOptionActive]}
              onPress={() => { setShowLayerModal(false); setShowNavPanel(true); }}
            >
              <Text style={styles.layerOptionIcon}>🧭</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.layerOptionText}>{navIsTracking ? 'Navigasi Aktif' : 'Navigasi Koordinat'}</Text>
                <Text style={styles.layerOptionSub}>
                  {navIsTracking ? `Ke target · ${fmtM(Math.round(navDistance))} · ${getDir(navBearing)}` : 'Kompas + jarak real-time ke target'}
                </Text>
              </View>
              {navIsTracking && <Text style={styles.checkIcon}>✓</Text>}
            </TouchableOpacity>

            <Text style={[styles.layerSectionLabel, { marginTop: 10 }]}>LAYER DATA</Text>
            <TouchableOpacity style={[styles.layerOptionRow, showFinal && styles.layerOptionActive]} onPress={() => { setShowFinal((v) => !v); setShowLayerModal(false); }}>
              <Text style={styles.layerOptionIcon}>🗺</Text>
              <View style={{ flex: 1 }}><Text style={styles.layerOptionText}>Tampilkan Peta Final</Text><Text style={styles.layerOptionSub}>Sembunyikan peta dasar jika ada peta final</Text></View>
              {showFinal && <Text style={styles.checkIcon}>✓</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// ── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 10, backgroundColor: '#F5F7FA' },
  mapContainer: {
    height: 420, backgroundColor: C_DARK_NAVY, borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', overflow: 'hidden',
    position: 'relative', shadowColor: '#000', shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4,
  },
  mapPlaceholder: { flex: 1, backgroundColor: C_DARK_NAVY },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C_DARK_NAVY },
  loadingText: { fontSize: 12, fontWeight: '600', color: '#38BDF8', marginTop: 8 },

  topLeftCard: {
    position: 'absolute', top: 12, left: 12,
    backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', zIndex: 15,
    shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 2 }, shadowRadius: 5, elevation: 4,
    borderWidth: 1, borderColor: C_BORDER,
  },
  mapIconBadge: { width: 32, height: 32, borderRadius: 9, backgroundColor: C_PRIMARY, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  mapIconImg: { width: 18, height: 18 },
  topLeftTextCol: { justifyContent: 'center' },
  mapTitleHeader: { fontSize: 13, fontWeight: '800', color: C_TEXT, letterSpacing: -0.2 },
  mapSubHeader: { fontSize: 10, fontWeight: '500', color: C_MID, marginTop: 1 },

  layerSelectorBtn: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', zIndex: 15,
    shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 2 }, shadowRadius: 5, elevation: 4,
    borderWidth: 1, borderColor: C_BORDER,
  },
  layerIcon: { width: 16, height: 16, marginRight: 6 },
  layerText: { fontSize: 12, fontWeight: '700', color: C_TEXT },
  layerChevron: { fontSize: 11, color: C_PRIMARY, fontWeight: '800', marginLeft: 6, marginTop: -1 },

  // FULLSCREEN BUTTON
  fullscreenBtn: {
    position: 'absolute', top: 56, right: 12,
    backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 7, paddingHorizontal: 10,
    flexDirection: 'row', alignItems: 'center', zIndex: 15, gap: 5,
    shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 4,
    borderWidth: 1, borderColor: C_BORDER,
  },
  fullscreenIcon: { fontSize: 14, color: C_TEXT },
  fullscreenLabel: { fontSize: 11, fontWeight: '700', color: C_TEXT },

  rightControlsStack: { position: 'absolute', top: 100, right: 12, zIndex: 15, gap: 7 },
  fsRightControls: { top: 80 },
  controlCircleBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C_BORDER,
    shadowColor: '#000', shadowOpacity: 0.16, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 3,
  },
  controlCircleAccent: { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' },
  controlCircleActive: { backgroundColor: '#FFF7ED', borderColor: C_DRAW_STROKE },
  controlCircleDim: { opacity: 0.45 },
  controlCircleNav: { backgroundColor: '#F0F9FF', borderColor: C_NAV_ACCENT },
  northCompassWrap: { alignItems: 'center', justifyContent: 'center' },
  northArrowRed: { fontSize: 13, color: '#EF4444', lineHeight: 14, fontWeight: '900' },
  northLetterN: { fontSize: 10, color: '#475569', lineHeight: 11, fontWeight: '800', marginTop: -1 },
  navToolIcon: { fontSize: 16 },
  compassIcon: { fontSize: 18 },
  zoomIconText: { fontSize: 20, fontWeight: '700', color: C_TEXT, lineHeight: 22 },
  targetIcon: { fontSize: 16 },
  drawToolIcon: { fontSize: 16 },

  drawToolbar: { position: 'absolute', top: 100, left: 12, zIndex: 20, flexDirection: 'column', gap: 6 },
  drawBtn: {
    backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 12, borderWidth: 1, borderColor: C_BORDER, elevation: 3,
    shadowColor: '#000', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 1 }, shadowRadius: 3,
  },
  drawBtnActive: { backgroundColor: '#FFF7ED', borderColor: C_DRAW_STROKE },
  drawBtnUndo: { backgroundColor: '#F0F9FF', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: '#BAE6FD', elevation: 2 },
  drawBtnDownload: { backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: '#6EE7B7', elevation: 2 },
  drawBtnClear: { backgroundColor: '#FEF2F2', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: '#FCA5A5', elevation: 2 },
  drawBtnText: { fontSize: 11, fontWeight: '700', color: C_TEXT },

  metricsCard: {
    position: 'absolute', bottom: 70, left: 12,
    backgroundColor: 'rgba(15,23,42,0.85)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8, zIndex: 20, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  metricsValue: { color: '#00E5FF', fontSize: 14, fontWeight: '800' },
  metricsLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 1 },
  metricsPoints: { color: 'rgba(255,255,255,0.5)', fontSize: 9, marginTop: 2 },

  drawHintBanner: {
    position: 'absolute', bottom: 44, left: 12, right: 12,
    backgroundColor: 'rgba(249,115,22,0.9)', borderRadius: 10,
    paddingVertical: 5, paddingHorizontal: 12, zIndex: 18, alignItems: 'center',
  },
  drawHintText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  drawPointDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C_DRAW_STROKE, borderWidth: 2, borderColor: '#FFFFFF' },

  // NAV BADGE (mini indikator saat navigasi aktif di peta)
  navBadge: {
    position: 'absolute', bottom: 65, left: 12, zIndex: 20,
    backgroundColor: 'rgba(14,165,233,0.95)', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 7,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 4,
  },
  navBadgeIcon: { fontSize: 16 },
  navBadgeDist: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  navBadgeDir: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '600', marginTop: 1 },

  placemarkBubble: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: C_MINE_PM,
    shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 3,
  },
  placemarkEmoji: { fontSize: 14 },

  navTargetPin: { backgroundColor: 'rgba(14,165,233,0.2)', borderRadius: 20, padding: 4 },
  navTargetEmoji: { fontSize: 24 },

  markerWithCalloutRow: { flexDirection: 'row', alignItems: 'center' },
  glowPinCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(14,165,233,0.35)', justifyContent: 'center', alignItems: 'center' },
  glowPinDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: C_PRIMARY, borderWidth: 2.5, borderColor: '#FFFFFF' },
  darkCalloutPill: {
    backgroundColor: '#0B192C', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000', shadowOpacity: 0.35, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 5,
  },
  darkCalloutArrow: {
    position: 'absolute', left: -5, top: 8, width: 0, height: 0,
    borderTopWidth: 5, borderBottomWidth: 5, borderRightWidth: 5,
    borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: '#0B192C',
  },
  darkCalloutText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  bottomLeftCard: {
    position: 'absolute', bottom: 12, left: 12, backgroundColor: '#FFFFFF', borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center',
    zIndex: 15, maxWidth: '68%',
    shadowColor: '#000', shadowOpacity: 0.18, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6, elevation: 4,
    borderWidth: 1, borderColor: C_BORDER,
  },
  bottomCardContent: { flex: 1, justifyContent: 'center' },
  bottomCardTitle: { fontSize: 13, fontWeight: '800', color: C_TEXT },
  bottomCardSubtitle: { fontSize: 10, fontWeight: '500', color: C_MID, marginTop: 2 },
  chevronWrap: { paddingLeft: 6, paddingRight: 4 },
  bottomCardChevron: { fontSize: 18, color: '#94A3B8', fontWeight: '700' },

  legendCard: {
    position: 'absolute', bottom: 12, right: 80,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 6, zIndex: 10, gap: 3,
    borderWidth: 1, borderColor: C_BORDER,
    shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 2,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 2 },
  legendText: { fontSize: 9, fontWeight: '600', color: C_TEXT },

  scaleBarContainer: { position: 'absolute', bottom: 12, right: 14, alignItems: 'center', zIndex: 10 },
  scaleText: {
    color: '#FFFFFF', fontSize: 9, fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
    marginBottom: 2, letterSpacing: 0.5,
  },
  scaleRuler: { flexDirection: 'row', width: 66, height: 4, borderWidth: 1, borderColor: '#FFFFFF' },
  rulerSegmentWhite: { flex: 1, backgroundColor: '#FFFFFF' },
  rulerSegmentBlack: { flex: 1, backgroundColor: C_DARK_NAVY },

  gpsMarkerCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(2,132,199,0.3)', justifyContent: 'center', alignItems: 'center' },
  gpsMarkerInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: C_PRIMARY, borderWidth: 2, borderColor: '#FFFFFF' },

  // FULLSCREEN
  fsContainer: { flex: 1, backgroundColor: C_DARK_NAVY },
  fsHeader: {
    position: 'absolute', top: Platform.OS === 'android' ? 30 : 48, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, zIndex: 20,
  },
  fsBackBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(15,23,42,0.8)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  fsBackIcon: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  fsHeaderTitle: { flex: 1, marginLeft: 12 },
  fsTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  fsSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 1 },
  fsNavBadge: {
    backgroundColor: 'rgba(14,165,233,0.9)', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  fsNavBadgeTxt: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },

  navPickHint: {
    position: 'absolute', bottom: 100, left: 12, right: 12,
    backgroundColor: 'rgba(14,165,233,0.95)', borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 14, zIndex: 30,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 2 }, shadowRadius: 5, elevation: 6,
  },
  navPickHintText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', flex: 1 },
  navPickCancel: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 8 },
  navPickCancelTxt: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  // MODAL LAYER
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  layerModalCard: {
    width: '100%', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20,
    shadowColor: '#000', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 6 }, shadowRadius: 10, elevation: 8, maxHeight: '88%',
  },
  layerModalTitle: { fontSize: 15, fontWeight: '800', color: C_TEXT, marginBottom: 10, textAlign: 'center' },
  layerSectionLabel: { fontSize: 10, fontWeight: '800', color: C_PRIMARY, letterSpacing: 0.5, marginBottom: 6, marginTop: 4 },
  layerOptionRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 12, marginBottom: 6, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: C_BORDER,
  },
  layerOptionActive: { backgroundColor: '#F0F9FF', borderColor: C_PRIMARY },
  layerOptionIcon: { fontSize: 20, marginRight: 12 },
  layerOptionText: { fontSize: 12, fontWeight: '700', color: C_TEXT },
  layerOptionSub: { fontSize: 10, color: C_MID, marginTop: 1 },
  checkIcon: { fontSize: 14, fontWeight: '800', color: C_PRIMARY, marginLeft: 8 },
  downloadRow: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 2 },
  downloadBtn: { flex: 1, backgroundColor: '#ECFDF5', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#6EE7B7' },
  downloadBtnText: { fontSize: 12, fontWeight: '700', color: '#065F46' },

  // MODAL NAVIGASI
  navModalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  navModalCard: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 20, paddingTop: 20,
    maxHeight: SCREEN_H * 0.88,
    shadowColor: '#000', shadowOpacity: 0.3, shadowOffset: { width: 0, height: -4 }, shadowRadius: 12, elevation: 16,
  },
  navModalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  navModalTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: C_TEXT },
  navModalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  navModalCloseIcon: { fontSize: 14, color: C_MID, fontWeight: '700' },

  navCompassSection: { alignItems: 'center', marginBottom: 16 },
  navInfoRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
  navInfoCard: {
    backgroundColor: '#F0F9FF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8,
    alignItems: 'center', minWidth: 72, borderWidth: 1, borderColor: '#BAE6FD',
  },
  navInfoVal: { fontSize: 15, fontWeight: '800', color: C_NAV_ACCENT },
  navInfoLbl: { fontSize: 10, color: C_MID, marginTop: 2, fontWeight: '600' },

  navSectionLabel: { fontSize: 10, fontWeight: '800', color: C_PRIMARY, letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  navInput: {
    backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: C_BORDER,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: C_TEXT, marginBottom: 8,
  },
  navCoordRow: { flexDirection: 'row', marginBottom: 8 },

  navPickBtn: {
    backgroundColor: '#F0F9FF', borderRadius: 12, paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#BAE6FD', marginBottom: 10,
  },
  navPickBtnText: { fontSize: 13, fontWeight: '700', color: C_NAV_ACCENT },

  navCurrentPosCard: {
    backgroundColor: '#ECFDF5', borderRadius: 12, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: '#6EE7B7',
  },
  navCurrentPosLabel: { fontSize: 11, fontWeight: '700', color: '#065F46' },
  navCurrentPosCoord: { fontSize: 12, color: '#047857', marginTop: 3, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  navPreviewCard: {
    backgroundColor: '#FFF7ED', borderRadius: 12, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  navPreviewTitle: { fontSize: 11, fontWeight: '700', color: '#9A3412' },
  navPreviewDist: { fontSize: 14, fontWeight: '800', color: '#EA580C', marginTop: 4 },
  navPreviewBear: { fontSize: 12, color: '#C2410C', marginTop: 2 },

  navActionRow: { marginBottom: 10 },
  navStartBtn: {
    backgroundColor: C_NAV_ACCENT, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    shadowColor: C_NAV_ACCENT, shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 5,
  },
  navStartBtnDisabled: { backgroundColor: '#94A3B8', shadowOpacity: 0 },
  navStartBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  navStopBtn: {
    backgroundColor: '#EF4444', borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    shadowColor: '#EF4444', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6, elevation: 4,
  },
  navStopBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  navTargetNameLabel: { fontSize: 12, color: C_MID, textAlign: 'center', marginBottom: 6 },
});

export default React.memo(MapPreview);
