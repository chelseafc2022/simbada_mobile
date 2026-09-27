import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    StyleSheet,
    ActivityIndicator,
    Linking,
    Platform
} from 'react-native';
import { WebView } from 'react-native-webview';
import MapView, { Polygon, Polyline, Marker } from 'react-native-maps';

// Kunci Google Maps Web API (terbukti aktif & valid untuk Maps JavaScript API)
const GOOGLE_MAPS_KEY = 'AIzaSyAgEwZSNR9oh4m67MnAUobk03LVF6rK6C8';

/**
 * StreetViewModal
 * Komponen modal canggih untuk menampilkan citra 360° Google Street View
 * sekaligus menampilkan polygon batas spasial desa, garis boundary, titik koordinat,
 * dan sinkronisasi live antara panorama 360° dan peta native 2D (Split Screen).
 */
const StreetViewModal = ({
    visible,
    onClose,
    coordinate,
    polygonCoords = [],
    petaDasarCoords = [],
    isPolyline = false,
    lineColor = '#0284C7',
    fillColor = 'rgba(2, 132, 199, 0.28)',
    title = 'Street View Batas Wilayah',
}) => {
    const [viewLayout, setViewLayout] = useState('split'); // 'split' | 'pano' | 'map'
    const [nativeMapType, setNativeMapType] = useState('hybrid'); // 'hybrid' | 'standard' | 'satellite'
    const [cameraHeading, setCameraHeading] = useState(0);
    const [webViewError, setWebViewError] = useState(null);

    const webViewRef = useRef(null);
    const mapRef = useRef(null);

    // Normalisasi koordinat polygon usulan
    const normalizedPolygon = useMemo(() => {
        if (!Array.isArray(polygonCoords)) return [];
        return polygonCoords
            .map((item, idx) => {
                if (!item) return null;
                const pLat = parseFloat(item.latitude ?? item.lat);
                const pLng = parseFloat(item.longitude ?? item.lng);
                if (isNaN(pLat) || isNaN(pLng)) return null;
                return {
                    lat: pLat,
                    lng: pLng,
                    index: idx + 1,
                    label: `Titik ${idx + 1}`
                };
            })
            .filter(Boolean);
    }, [polygonCoords]);

    // Format array coordinates untuk native MapView
    const polygonPoints = useMemo(() => {
        return normalizedPolygon.map(p => ({
            latitude: p.lat,
            longitude: p.lng
        }));
    }, [normalizedPolygon]);

    // Normalisasi koordinat polygon peta dasar (referensi samar)
    const petaDasarPoints = useMemo(() => {
        if (!Array.isArray(petaDasarCoords)) return [];
        return petaDasarCoords
            .map((item) => {
                if (!item) return null;
                const lat = parseFloat(item.latitude ?? item.lat);
                const lng = parseFloat(item.longitude ?? item.lng);
                if (isNaN(lat) || isNaN(lng)) return null;
                return { latitude: lat, longitude: lng };
            })
            .filter(Boolean);
    }, [petaDasarCoords]);

    // Koordinat fokus utama
    const centerLat = useMemo(() => {
        const val = parseFloat(coordinate?.latitude ?? coordinate?.lat);
        if (!isNaN(val)) return val;
        if (normalizedPolygon.length > 0) return normalizedPolygon[0].lat;
        return -4.011816;
    }, [coordinate, normalizedPolygon]);

    const centerLng = useMemo(() => {
        const val = parseFloat(coordinate?.longitude ?? coordinate?.lng);
        if (!isNaN(val)) return val;
        if (normalizedPolygon.length > 0) return normalizedPolygon[0].lng;
        return 122.439933;
    }, [coordinate, normalizedPolygon]);

    const [panoPos, setPanoPos] = useState({ latitude: centerLat, longitude: centerLng });

    // HTML untuk Citra 360° Street View di WebView dengan proyeksi garis & pin polygon
    const panoHtml = useMemo(() => {
        const polygonJson = JSON.stringify(normalizedPolygon);
        const petaDasarJson = JSON.stringify(petaDasarPoints.map((p, idx) => ({ lat: p.latitude, lng: p.longitude, index: idx + 1 })));
        return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body { height: 100%; margin: 0; padding: 0; background: #0F172A; overflow: hidden; font-family: -apple-system, sans-serif; }
    #pano { width: 100%; height: 100%; }
    
    #loading {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      color: #38BDF8; font-size: 13px; background: #0F172A; z-index: 50;
    }
    .spinner {
      width: 32px; height: 32px; border: 3px solid rgba(56, 189, 248, 0.2);
      border-top-color: #38BDF8; border-radius: 50%;
      animation: spin 0.8s linear infinite; margin-bottom: 12px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    #notice-box {
      display: none; position: absolute; top: 10px; left: 10px; right: 10px;
      background: rgba(30, 41, 59, 0.95); border: 1px solid #F59E0B;
      padding: 10px 14px; border-radius: 10px; color: #F1F5F9; z-index: 40;
      font-size: 11px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    }

    #vertex-bar {
      position: absolute; top: 10px; left: 10px; right: 10px;
      display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; z-index: 25;
      scrollbar-width: none;
    }
    #vertex-bar::-webkit-scrollbar { display: none; }
    .v-pill {
      background: rgba(15, 23, 42, 0.88); backdrop-filter: blur(4px);
      border: 1px solid #0284C7; color: #FFFFFF; font-size: 11px; font-weight: bold;
      padding: 5px 10px; border-radius: 16px; white-space: nowrap; cursor: pointer;
    }
    .v-pill:active { background: #0284C7; }
  </style>
</head>
<body>
  <div id="loading">
    <div class="spinner"></div>
    <div>Menghubungkan Citra 360° Street View...</div>
  </div>

  <div id="notice-box">
    <strong style="color: #F59E0B; display: block; margin-bottom: 3px;">📍 Informasi Jangkauan Street View</strong>
    <span id="notice-desc">Mencari rekaman foto 360° di sekitar koordinat ini...</span>
  </div>

  <div id="vertex-bar"></div>
  <div id="pano"></div>

  <script>
    var polygonData = ${polygonJson};
    var petaDasarData = ${petaDasarJson};
    var centerLat = ${centerLat};
    var centerLng = ${centerLng};
    var isPolyline = ${isPolyline ? 'true' : 'false'};
    var strokeHex = "${lineColor || '#0284C7'}";
    var panorama = null;
    var svService = null;

    function postToRN(data) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    }

    function initApp() {
      try {
        var pos = new google.maps.LatLng(centerLat, centerLng);
        svService = new google.maps.StreetViewService();
        panorama = new google.maps.StreetViewPanorama(document.getElementById('pano'), {
          pov: { heading: 0, pitch: 0 },
          zoom: 1,
          addressControl: true,
          linksControl: true,
          panControl: true,
          enableCloseButton: false,
          fullscreenControl: false,
          motionTracking: false
        });

        // Cari panorama terdekat dalam radius 2 km
        svService.getPanorama({ location: pos, radius: 2000, preference: 'nearest' }, function(data, status) {
          var loader = document.getElementById('loading');
          if (loader) loader.style.display = 'none';

          if (status === google.maps.StreetViewStatus.OK && data && data.location) {
            panorama.setPano(data.location.pano);
            var panoLoc = data.location.latLng;
            postToRN({ type: 'PANO_LOADED', lat: panoLoc.lat(), lng: panoLoc.lng() });

            // Gambar titik dan garis polygon di 360°!
            drawPolygonInPano(panorama, panoLoc);
            autoOrientToPolygon(panoLoc);
          } else {
            postToRN({ type: 'PANO_NOT_FOUND' });
            var box = document.getElementById('notice-box');
            var desc = document.getElementById('notice-desc');
            if (box && desc) {
              desc.innerText = 'Mobil Street View belum merekam jalan persis di titik ini. Silakan lihat bentuk polygon di peta bawah atau ketuk jalan lain di peta.';
              box.style.display = 'block';
            }
          }
        });

        panorama.addListener('pov_changed', function() {
          var pov = panorama.getPov();
          postToRN({ type: 'POV_CHANGED', heading: pov.heading });
        });

        panorama.addListener('position_changed', function() {
          var p = panorama.getPosition();
          if (p) postToRN({ type: 'POS_CHANGED', lat: p.lat(), lng: p.lng() });
        });

        // Quick vertex buttons
        var vBar = document.getElementById('vertex-bar');
        if (polygonData.length > 0 && vBar) {
          var hint = document.createElement('div');
          hint.className = 'v-pill';
          hint.style.borderColor = '#F59E0B';
          hint.style.color = '#FCD34D';
          hint.innerText = '🎯 Fokus:';
          vBar.appendChild(hint);

          polygonData.forEach(function(v) {
            var btn = document.createElement('div');
            btn.className = 'v-pill';
            btn.innerText = 'Titik ' + v.index;
            btn.onclick = function() {
              focusOnPoint(v);
            };
            vBar.appendChild(btn);
          });
        }
      } catch (err) {
        postToRN({ type: 'ERROR', message: err.message });
      }
    }

    function drawPolygonInPano(pano, panoPos) {
      if (!polygonData || polygonData.length === 0) return;

      // 1. Pin Vertex Tiap Titik di Panorama 360°
      polygonData.forEach(function(v) {
        new google.maps.Marker({
          position: { lat: v.lat, lng: v.lng },
          map: pano,
          label: {
            text: String(v.index),
            color: '#FFFFFF',
            fontWeight: 'bold',
            fontSize: '12px'
          },
          icon: {
            path: 'M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 Z',
            fillColor: '#F59E0B',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
            scale: 1.15,
            labelOrigin: new google.maps.Point(0, -30)
          },
          title: 'Titik Batas ' + v.index
        });
      });

      // 2. Garis Batas Polygon / Polyline (Interpolasi Geodesic Padat Tanpa Putus di 360°)
      if (polygonData.length >= 2 && window.google.maps.geometry) {
        var numEdges = isPolyline ? polygonData.length - 1 : polygonData.length;
        for (var i = 0; i < numEdges; i++) {
          var start = polygonData[i];
          var end = polygonData[(i + 1) % polygonData.length];
          if (!isPolyline && polygonData.length === 2 && i === 1) break;

          var p1 = new google.maps.LatLng(start.lat, start.lng);
          var p2 = new google.maps.LatLng(end.lat, end.lng);
          var dist = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
          
          // Interval rapat agar lingkaran saling bertumpuk (overlap) membentuk garis solid tanpa putus
          var stepMeters = Math.max(0.7, Math.min(2.5, dist / 140));
          var steps = Math.min(240, Math.max(2, Math.round(dist / stepMeters)));

          for (var s = 0; s <= steps; s++) {
            var interp = (s === 0) ? p1 : ((s === steps) ? p2 : google.maps.geometry.spherical.interpolate(p1, p2, s / steps));
            new google.maps.Marker({
              position: interp,
              map: pano,
              optimized: true,
              clickable: false,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 5.5,
                fillColor: strokeHex,
                fillOpacity: 1,
                strokeColor: strokeHex,
                strokeWeight: 0
              },
              title: isPolyline ? 'Garis Batas' : 'Garis Batas Spasial'
            });
          }
        }
      }

      // 3. Garis Batas Peta Dasar Desa (Garis Padat Berkelanjutan Samar Emas)
      if (petaDasarData && petaDasarData.length >= 2 && window.google.maps.geometry) {
        for (var pd = 0; pd < petaDasarData.length; pd++) {
          var sPd = petaDasarData[pd];
          var ePd = petaDasarData[(pd + 1) % petaDasarData.length];
          if (petaDasarData.length === 2 && pd === 1) break;

          var p1Pd = new google.maps.LatLng(sPd.lat, sPd.lng);
          var p2Pd = new google.maps.LatLng(ePd.lat, ePd.lng);
          var distPd = google.maps.geometry.spherical.computeDistanceBetween(p1Pd, p2Pd);
          var stepMetersPd = Math.max(1.0, Math.min(3.0, distPd / 120));
          var stepsPd = Math.min(200, Math.max(2, Math.round(distPd / stepMetersPd)));

          for (var sp = 0; sp <= stepsPd; sp++) {
            var interpPd = (sp === 0) ? p1Pd : ((sp === stepsPd) ? p2Pd : google.maps.geometry.spherical.interpolate(p1Pd, p2Pd, sp / stepsPd));
            new google.maps.Marker({
              position: interpPd,
              map: pano,
              optimized: true,
              clickable: false,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 3.5,
                fillColor: '#F59E0B',
                fillOpacity: 0.65,
                strokeColor: '#F59E0B',
                strokeWeight: 0
              },
              title: 'Peta Dasar Desa (Samar)'
            });
          }
        }
      }
    }

    function autoOrientToPolygon(panoLoc) {
      if (!polygonData || polygonData.length === 0 || !window.google.maps.geometry) return;
      var closest = polygonData[0];
      var minDist = 99999999;
      polygonData.forEach(function(v) {
        var vPos = new google.maps.LatLng(v.lat, v.lng);
        var d = google.maps.geometry.spherical.computeDistanceBetween(panoLoc, vPos);
        if (d < minDist) {
          minDist = d;
          closest = v;
        }
      });
      var target = new google.maps.LatLng(closest.lat, closest.lng);
      var head = google.maps.geometry.spherical.computeHeading(panoLoc, target);
      panorama.setPov({ heading: head, pitch: 0 });
    }

    function focusOnPoint(v) {
      if (!panorama || !window.google.maps.geometry) return;
      var currentPos = panorama.getPosition();
      var target = new google.maps.LatLng(v.lat, v.lng);
      if (currentPos) {
        var head = google.maps.geometry.spherical.computeHeading(currentPos, target);
        panorama.setPov({ heading: head, pitch: 0 });
      }
    }

    // Terima instruksi perpindahan posisi dari React Native
    function receiveFromRN(raw) {
      try {
        var msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (msg.type === 'MOVE_TO' && svService && panorama) {
          var targetPos = new google.maps.LatLng(msg.lat, msg.lng);
          svService.getPanorama({ location: targetPos, radius: 1500, preference: 'nearest' }, function(data, status) {
            if (status === google.maps.StreetViewStatus.OK && data) {
              panorama.setPano(data.location.pano);
              autoOrientToPolygon(data.location.latLng);
            }
          });
        }
      } catch(err) {}
    }

    window.addEventListener('message', function(e) { receiveFromRN(e.data); });
    document.addEventListener('message', function(e) { receiveFromRN(e.data); });
  </script>
  <script src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=geometry&callback=initApp" async defer></script>
</body>
</html>`;
    }, [normalizedPolygon, petaDasarPoints, centerLat, centerLng, isPolyline, lineColor]);

    // Handle pesan dari WebView ke React Native
    const handleWebViewMessage = useCallback((event) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'POV_CHANGED') {
                setCameraHeading(data.heading || 0);
            } else if (data.type === 'POS_CHANGED' || data.type === 'PANO_LOADED') {
                setPanoPos({ latitude: data.lat, longitude: data.lng });
                if (mapRef.current) {
                    mapRef.current.animateToRegion({
                        latitude: data.lat,
                        longitude: data.lng,
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005,
                    }, 500);
                }
            }
        } catch (e) {
            // Ignore parse errors
        }
    }, []);

    // Buka aplikasi native Google Maps
    const handleOpenInGoogleMaps = async () => {
        const nativeUrl = Platform.OS === 'android'
            ? `google.streetview:cbll=${centerLat},${centerLng}&cbp=1,0,,0,1.0`
            : `comgooglemaps://?center=${centerLat},${centerLng}&mapmode=streetview`;

        const fallbackUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${centerLat},${centerLng}`;

        try {
            const canOpen = await Linking.canOpenURL(nativeUrl);
            if (canOpen) {
                await Linking.openURL(nativeUrl);
            } else {
                await Linking.openURL(fallbackUrl);
            }
        } catch (e) {
            await Linking.openURL(fallbackUrl);
        }
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
            <View style={localStyles.container}>
                {/* HEADER */}
                <View style={localStyles.header}>
                    <View style={localStyles.headerLeft}>
                        <View style={localStyles.pegmanIconBadge}>
                            <Text style={{ fontSize: 16 }}>🚶‍♂️</Text>
                        </View>
                        <View style={{ marginLeft: 10, flex: 1 }}>
                            <Text style={localStyles.headerTitle} numberOfLines={1}>
                                {title || 'Street View Batas Wilayah'}
                            </Text>
                            <Text style={localStyles.headerSub}>
                                {centerLat.toFixed(6)}, {centerLng.toFixed(6)} • {normalizedPolygon.length} Titik Batas
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={localStyles.btnClose}
                        onPress={onClose}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Text style={localStyles.btnCloseText}>✕</Text>
                    </TouchableOpacity>
                </View>

                {/* SEGMENTED LAYOUT BAR */}
                <View style={localStyles.layoutToggleBar}>
                    <TouchableOpacity
                        style={[localStyles.layoutBtn, viewLayout === 'split' && localStyles.layoutBtnActive]}
                        onPress={() => setViewLayout('split')}
                    >
                        <Text style={[localStyles.layoutBtnText, viewLayout === 'split' && localStyles.layoutBtnTextActive]}>
                            🔄 Belah Layar (Peta + 360°)
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[localStyles.layoutBtn, viewLayout === 'pano' && localStyles.layoutBtnActive]}
                        onPress={() => setViewLayout('pano')}
                    >
                        <Text style={[localStyles.layoutBtnText, viewLayout === 'pano' && localStyles.layoutBtnTextActive]}>
                            🌐 360° Saja
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[localStyles.layoutBtn, viewLayout === 'map' && localStyles.layoutBtnActive]}
                        onPress={() => setViewLayout('map')}
                    >
                        <Text style={[localStyles.layoutBtnText, viewLayout === 'map' && localStyles.layoutBtnTextActive]}>
                            🗺️ Peta Saja
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* MAIN CONTENT AREA */}
                <View style={localStyles.contentContainer}>
                    {/* PANE 1: CITRA STREET VIEW 360° */}
                    {(viewLayout === 'split' || viewLayout === 'pano') && (
                        <View style={[localStyles.paneWrap, viewLayout === 'split' ? { flex: 1 } : { flex: 1 }]}>
                            {webViewError ? (
                                <View style={localStyles.errorContainer}>
                                    <Text style={{ fontSize: 32, marginBottom: 8 }}>📍</Text>
                                    <Text style={localStyles.errorTitle}>Street View Belum Mencakup Titik Ini</Text>
                                    <Text style={localStyles.errorSub}>
                                        Mobil Google Street View belum merekam foto 360° di titik koordinat ini. Anda dapat memeriksa bentuk polygon pada peta atau membuka Google Maps.
                                    </Text>
                                    <TouchableOpacity
                                        style={localStyles.btnOpenMapsFromError}
                                        onPress={handleOpenInGoogleMaps}
                                    >
                                        <Text style={localStyles.btnOpenMapsFromErrorText}>📱 Buka Aplikasi Google Maps</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <WebView
                                    ref={webViewRef}
                                    key={`pano-${centerLat}-${centerLng}`}
                                    originWhitelist={['*']}
                                    source={{
                                        html: panoHtml,
                                        baseUrl: 'https://maps.googleapis.com'
                                    }}
                                    style={{ flex: 1, backgroundColor: '#0F172A' }}
                                    javaScriptEnabled={true}
                                    domStorageEnabled={true}
                                    allowFileAccess={true}
                                    allowUniversalAccessFromFileURLs={true}
                                    allowFileAccessFromFileURLs={true}
                                    mixedContentMode="always"
                                    androidHardwareAccelerationDisabled={false}
                                    androidLayerType="hardware"
                                    onMessage={handleWebViewMessage}
                                    onError={(e) => {
                                        setWebViewError(e.nativeEvent?.description || 'Gagal memuat citra Street View');
                                    }}
                                    startInLoadingState={true}
                                    renderLoading={() => (
                                        <View style={localStyles.loadingCenter}>
                                            <ActivityIndicator size="large" color="#38BDF8" />
                                            <Text style={localStyles.loadingText}>Memuat Geospasial Street View 360°...</Text>
                                        </View>
                                    )}
                                />
                            )}
                        </View>
                    )}

                    {/* PANE 2: PETA NATIVE DENGAN POLYGON & PEGMAN SYNC */}
                    {(viewLayout === 'split' || viewLayout === 'map') && (
                        <View style={[localStyles.paneWrap, viewLayout === 'split' ? { flex: 1, borderTopWidth: 2, borderTopColor: '#334155' } : { flex: 1 }]}>
                            <MapView
                                ref={mapRef}
                                style={StyleSheet.absoluteFillObject}
                                provider="google"
                                initialRegion={{
                                    latitude: centerLat,
                                    longitude: centerLng,
                                    latitudeDelta: 0.008,
                                    longitudeDelta: 0.008,
                                }}
                                mapType={nativeMapType}
                                showsCompass={false}
                                showsMyLocationButton={false}
                                toolbarEnabled={false}
                                onPress={(e) => {
                                    const coord = e.nativeEvent.coordinate;
                                    if (coord) {
                                        setPanoPos(coord);
                                        if (webViewRef.current) {
                                            webViewRef.current.injectJavaScript(`receiveFromRN(${JSON.stringify({
                                                type: 'MOVE_TO',
                                                lat: coord.latitude,
                                                lng: coord.longitude
                                            })}); true;`);
                                        }
                                    }
                                }}
                            >
                                {/* Area Polygon Peta Dasar Desa (Samar sebagai Referensi/Perbandingan) */}
                                {petaDasarPoints.length >= 3 && (
                                    <Polygon
                                        coordinates={petaDasarPoints}
                                        strokeColor="rgba(245, 158, 11, 0.7)"
                                        fillColor="rgba(245, 158, 11, 0.08)"
                                        strokeWidth={2}
                                    />
                                )}
                                {petaDasarPoints.length >= 2 && (
                                    <Polyline
                                        coordinates={petaDasarPoints}
                                        strokeColor="rgba(245, 158, 11, 0.7)"
                                        strokeWidth={2}
                                    />
                                )}

                                {/* Area Polygon / Garis Batas Desa */}
                                {!isPolyline && polygonPoints.length >= 3 && (
                                    <Polygon
                                        coordinates={polygonPoints}
                                        strokeColor={lineColor || "#0284C7"}
                                        fillColor={fillColor || "rgba(2, 132, 199, 0.28)"}
                                        strokeWidth={3}
                                    />
                                )}
                                {polygonPoints.length >= 2 && (
                                    <Polyline
                                        coordinates={polygonPoints}
                                        strokeColor={lineColor || "#0284C7"}
                                        strokeWidth={3}
                                    />
                                )}

                                {/* Marker Titik Polygon Bernomor */}
                                {polygonPoints.map((pt, i) => (
                                    <Marker
                                        key={`sv-pt-${i}`}
                                        coordinate={pt}
                                        anchor={{ x: 0.5, y: 0.5 }}
                                    >
                                        <View style={localStyles.nativeMarkerPin}>
                                            <Text style={localStyles.nativeMarkerText}>{i + 1}</Text>
                                        </View>
                                    </Marker>
                                ))}

                                {/* Marker Pegman / Kamera Street View */}
                                {panoPos && (
                                    <Marker
                                        coordinate={panoPos}
                                        anchor={{ x: 0.5, y: 0.5 }}
                                        rotation={cameraHeading}
                                        flat={true}
                                    >
                                        <View style={localStyles.pegmanMarkerWrap}>
                                            <View style={localStyles.pegmanRadarCone} />
                                            <Text style={{ fontSize: 22 }}>🚶‍♂️</Text>
                                        </View>
                                    </Marker>
                                )}
                            </MapView>

                            {/* Tombol Ganti Layer Peta di Pojok Kanan Atas Peta */}
                            <TouchableOpacity
                                style={localStyles.btnLayerNative}
                                onPress={() => setNativeMapType(prev => prev === 'hybrid' ? 'standard' : prev === 'standard' ? 'satellite' : 'hybrid')}
                                activeOpacity={0.8}
                            >
                                <Text style={localStyles.btnLayerNativeIcon}>
                                    {nativeMapType === 'hybrid' ? '🛰️' : nativeMapType === 'satellite' ? '🏔️' : '🗺️'}
                                </Text>
                            </TouchableOpacity>

                            {/* Petunjuk Ketuk di Peta */}
                            <View style={localStyles.mapHintOverlay} pointerEvents="none">
                                <Text style={localStyles.mapHintText}>📍 Ketuk jalan di peta untuk pindah posisi Street View</Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* FOOTER TOOLBAR */}
                <View style={localStyles.footer}>
                    <TouchableOpacity
                        style={localStyles.btnOpenApp}
                        onPress={handleOpenInGoogleMaps}
                        activeOpacity={0.8}
                    >
                        <Text style={localStyles.btnOpenAppText}>
                            📱 Buka di Aplikasi Google Maps
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={localStyles.btnTutup}
                        onPress={onClose}
                        activeOpacity={0.8}
                    >
                        <Text style={localStyles.btnTutupText}>Tutup</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const localStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 48 : 16,
        paddingBottom: 12,
        backgroundColor: '#1E293B',
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    pegmanIconBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#0284C7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
    headerSub: {
        color: '#94A3B8',
        fontSize: 11,
        marginTop: 1,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    btnClose: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    btnCloseText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    layoutToggleBar: {
        flexDirection: 'row',
        backgroundColor: '#0F172A',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    layoutBtn: {
        flex: 1,
        paddingVertical: 7,
        alignItems: 'center',
        borderRadius: 6,
        marginHorizontal: 3,
        backgroundColor: '#1E293B',
    },
    layoutBtnActive: {
        backgroundColor: '#0284C7',
    },
    layoutBtnText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#94A3B8',
    },
    layoutBtnTextActive: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    contentContainer: {
        flex: 1,
    },
    paneWrap: {
        position: 'relative',
    },
    loadingCenter: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#0F172A',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
    },
    loadingText: {
        color: '#94A3B8',
        fontSize: 12,
        marginTop: 10,
    },
    errorContainer: {
        flex: 1,
        backgroundColor: '#0F172A',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    errorTitle: {
        color: '#F1F5F9',
        fontSize: 15,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8,
    },
    errorSub: {
        color: '#94A3B8',
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 16,
    },
    btnOpenMapsFromError: {
        backgroundColor: '#0284C7',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
    },
    btnOpenMapsFromErrorText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    nativeMarkerPin: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#0284C7',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
    },
    nativeMarkerText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    pegmanMarkerWrap: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    pegmanRadarCone: {
        position: 'absolute',
        top: -6,
        width: 0,
        height: 0,
        borderLeftWidth: 10,
        borderRightWidth: 10,
        borderBottomWidth: 18,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: 'rgba(245, 158, 11, 0.45)',
    },
    btnLayerNative: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
    },
    btnLayerNativeIcon: {
        fontSize: 16,
    },
    mapHintOverlay: {
        position: 'absolute',
        bottom: 10,
        left: 10,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    mapHintText: {
        color: '#CBD5E1',
        fontSize: 10,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: '#1E293B',
        borderTopWidth: 1,
        borderTopColor: '#334155',
    },
    btnOpenApp: {
        flex: 1,
        backgroundColor: '#0284C7',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
        marginRight: 8,
    },
    btnOpenAppText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    btnTutup: {
        backgroundColor: '#475569',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    btnTutupText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
});

export default StreetViewModal;
