// views/guest/GuestMap.js — Halaman Khusus Mode Tamu / Publik SIMBADA Mobile
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Animated,
  StatusBar,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MapView, { Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import { Picker } from '@react-native-picker/picker';
import * as turf from '@turf/turf';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Geolocation from '@react-native-community/geolocation';
import {
  usePetaDasarAllQuery,
  usePetaFinalAllQuery,
  useKecamatanQuery,
  useDesaQuery,
} from '../library/queries';

// ─── PALET WARNA (GEO-SAPPHIRE & EMERALD FIELD) ──────────────────────────────
const PRIMARY      = '#0284C7';
const PRIMARY_DARK = '#0369A1';
const DARK_NAVY    = '#0F172A';
const BORDER_COLOR = '#E2E8F0';
const TEXT_DARK    = '#0F172A';
const TEXT_MID     = '#64748B';

// Warna Poligon
const FINAL_STROKE = '#00E5FF';
const FINAL_FILL   = 'rgba(0, 229, 255, 0.28)';
const DASAR_STROKE = '#F59E0B';
const DASAR_FILL   = 'rgba(245, 158, 11, 0.24)';

// Pusat Wilayah Kab. Konawe Selatan
const KONAWE_SELATAN = {
  latitude: -4.2021418,
  longitude: 122.4819808,
  latitudeDelta: 0.85,
  longitudeDelta: 0.85,
};

const calculateArea = (coordinates) => {
  try {
    const geo = coordinates
      .map((c) => (c.latitude && c.longitude ? [c.longitude, c.latitude] : null))
      .filter(Boolean);
    if (geo.length < 3) return '0.00';
    if (
      geo[0][0] !== geo[geo.length - 1][0] ||
      geo[0][1] !== geo[geo.length - 1][1]
    ) {
      geo.push(geo[0]);
    }
    const poly = turf.polygon([geo]);
    return (turf.area(poly) / 1e6).toFixed(2);
  } catch {
    return '0.00';
  }
};

const GuestMap = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);

  const TOKEN = useSelector((s) => s.TOKEN);
  const URL   = useSelector((s) => s.URL);

  // Map state
  const [mapType, setMapType] = useState('hybrid'); // 'hybrid' | 'satellite' | 'standard' | 'terrain'
  const [activeLayerFilter, setActiveLayerFilter] = useState('ALL'); // 'ALL' | 'FINAL' | 'DASAR'
  const [showLayerModal, setShowLayerModal] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKecamatan, setSelectedKecamatan] = useState('');
  const [selectedDesa, setSelectedDesa] = useState('');

  // Modals
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedPolygon, setSelectedPolygon] = useState(null);
  const [restrictedModalVisible, setRestrictedModalVisible] = useState(false);
  const [restrictedFeatureName, setRestrictedFeatureName] = useState('');

  // Bottom panel expand/collapse
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const panelAnim = useRef(new Animated.Value(1)).current;

  const togglePanel = () => {
    Animated.spring(panelAnim, {
      toValue: isPanelOpen ? 0 : 1,
      useNativeDriver: false,
      bounciness: 4,
    }).start();
    setIsPanelOpen(!isPanelOpen);
  };

  // Queries
  const { data: rawPetaFinal = [], isLoading: isFinalLoading } = usePetaFinalAllQuery(TOKEN, URL);
  const { data: rawPetaDasar = [], isLoading: isDasarLoading } = usePetaDasarAllQuery(TOKEN, URL);
  const { data: kecamatanList = [] } = useKecamatanQuery(TOKEN, URL);
  const { data: desaList = [] } = useDesaQuery(TOKEN, URL, selectedKecamatan);

  // Fit bounds helper
  const fitPolygons = useCallback((polygonList) => {
    if (!polygonList || polygonList.length === 0 || !mapRef.current) return;
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    let hasValid = false;

    polygonList.forEach((p) => {
      const coords = p.coordinates || [];
      coords.forEach((c) => {
        const lat = parseFloat(c.latitude);
        const lng = parseFloat(c.longitude);
        if (isFinite(lat) && isFinite(lng)) {
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
          hasValid = true;
        }
      });
    });

    if (hasValid && minLat <= maxLat && minLng <= maxLng) {
      const midLat = (minLat + maxLat) / 2;
      const midLng = (minLng + maxLng) / 2;
      const deltaLat = Math.max((maxLat - minLat) * 1.35, 0.04);
      const deltaLng = Math.max((maxLng - minLng) * 1.35, 0.04);
      mapRef.current.animateToRegion(
        {
          latitude: midLat,
          longitude: midLng,
          latitudeDelta: deltaLat,
          longitudeDelta: deltaLng,
        },
        700
      );
    }
  }, []);

  // Filtered Polygons
  // catatan: usePetaDasarAllQuery & usePetaFinalAllQuery hanya map kode_desa, nama_desa, coordinates
  // Kecamatan difilter lewat prefix kode_desa (74.05.01 = kecamatan 74.05.01, dst)
  const filteredFinal = useMemo(() => {
    if (activeLayerFilter === 'DASAR') return [];
    return rawPetaFinal.filter((p) => {
      // Filter desa
      if (selectedDesa && p.kode_desa !== selectedDesa) return false;
      // Filter kecamatan: kode_kecamatan = 6 karakter pertama kode_desa (misal 74.05.08)
      if (selectedKecamatan && p.kode_desa) {
        const desaPrefix = p.kode_desa.slice(0, selectedKecamatan.length);
        if (desaPrefix !== selectedKecamatan) return false;
      }
      // Filter pencarian teks
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          p.nama_desa?.toLowerCase().includes(q) ||
          p.nama_kecamatan?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rawPetaFinal, activeLayerFilter, selectedKecamatan, selectedDesa, searchQuery]);

  const filteredDasar = useMemo(() => {
    if (activeLayerFilter === 'FINAL') return [];
    return rawPetaDasar.filter((p) => {
      // Filter desa
      if (selectedDesa && p.kode_desa !== selectedDesa) return false;
      // Filter kecamatan: kode_kecamatan = prefix kode_desa
      if (selectedKecamatan && p.kode_desa) {
        const desaPrefix = p.kode_desa.slice(0, selectedKecamatan.length);
        if (desaPrefix !== selectedKecamatan) return false;
      }
      // Filter pencarian teks
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          p.nama_desa?.toLowerCase().includes(q) ||
          p.nama_kecamatan?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rawPetaDasar, activeLayerFilter, selectedKecamatan, selectedDesa, searchQuery]);

  // Efek zoom saat filter kecamatan/desa berubah
  useEffect(() => {
    const list = [...filteredFinal, ...filteredDasar];
    if (list.length > 0 && (selectedKecamatan || selectedDesa || searchQuery)) {
      fitPolygons(list);
    }
  }, [selectedKecamatan, selectedDesa, filteredFinal, filteredDasar, fitPolygons, searchQuery]);

  // Zoom controls
  const handleZoom = (zoomIn) => {
    if (!mapRef.current) return;
    mapRef.current.getCamera().then((cam) => {
      if (cam && cam.altitude) {
        cam.altitude = zoomIn ? cam.altitude * 0.5 : cam.altitude * 2;
        mapRef.current.animateCamera(cam, { duration: 300 });
      }
    }).catch(() => {});
  };

  const handleCenterKonawe = () => {
    if (mapRef.current) {
      mapRef.current.animateToRegion(KONAWE_SELATAN, 600);
    }
  };

  const handleMyLocation = () => {
    Geolocation.getCurrentPosition(
      (pos) => {
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }, 600);
        }
      },
      () => {
        Alert.alert('GPS', 'Gagal mendapatkan lokasi perangkat. Pastikan GPS aktif.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Handler untuk fitur yang dibatasi (Guest restriction prompt)
  const handleRestrictedAccess = (featureName) => {
    setRestrictedFeatureName(featureName);
    setRestrictedModalVisible(true);
  };

  const navigateToLogin = () => {
    setRestrictedModalVisible(false);
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={DARK_NAVY} />

      {/* ─── 1. HEADER KHUSUS MODE TAMU ─────────────────────────── */}
      <View style={[s.header, { paddingTop: Math.max(insets.top, 12) + 4 }]}>
        <View style={s.headerLeft}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.7}
          >
            <Icon name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={s.headerTitleWrap}>
            <View style={s.guestBadgeRow}>
              <View style={s.guestPulseDot} />
              <Text style={s.guestBadgeText}>MODE TAMU (GUEST)</Text>
            </View>
            <Text style={s.headerTitle} numberOfLines={1}>Peta Dasar & Peta Final</Text>
          </View>
        </View>

        {/* Tombol CTA Masuk / Login di Header */}
        <TouchableOpacity
          style={s.loginCtaBtn}
          onPress={navigateToLogin}
          activeOpacity={0.85}
        >
          <Icon name="log-in-outline" size={17} color="#FFFFFF" style={{ marginRight: 5 }} />
          <Text style={s.loginCtaText}>Masuk</Text>
        </TouchableOpacity>
      </View>

      {/* ─── 2. PILIHAN LAYER CEPAT (DASAR vs FINAL) ─────────────── */}
      <View style={s.quickLayerBar}>
        <TouchableOpacity
          style={[s.layerPill, activeLayerFilter === 'ALL' && s.layerPillActive]}
          onPress={() => setActiveLayerFilter('ALL')}
          activeOpacity={0.75}
        >
          <Text style={[s.layerPillText, activeLayerFilter === 'ALL' && s.layerPillTextActive]}>
            Semua ({filteredFinal.length + filteredDasar.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.layerPill, activeLayerFilter === 'FINAL' && s.layerPillActiveFinal]}
          onPress={() => setActiveLayerFilter('FINAL')}
          activeOpacity={0.75}
        >
          <View style={[s.legendColorDot, { backgroundColor: FINAL_STROKE }]} />
          <Text style={[s.layerPillText, activeLayerFilter === 'FINAL' && s.layerPillTextActiveFinal]}>
            Peta Final ({rawPetaFinal.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.layerPill, activeLayerFilter === 'DASAR' && s.layerPillActiveDasar]}
          onPress={() => setActiveLayerFilter('DASAR')}
          activeOpacity={0.75}
        >
          <View style={[s.legendColorDot, { backgroundColor: DASAR_STROKE }]} />
          <Text style={[s.layerPillText, activeLayerFilter === 'DASAR' && s.layerPillTextActiveDasar]}>
            Peta Dasar ({rawPetaDasar.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.layerTypeBtn}
          onPress={() => setShowLayerModal(true)}
          activeOpacity={0.75}
        >
          <Icon name="layers-outline" size={17} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      {/* ─── 3. PETA MAPVIEW ──────────────────────────────────────── */}
      <View style={s.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFillObject}
          initialRegion={KONAWE_SELATAN}
          mapType={mapType}
          showsUserLocation
          showsCompass={false}
          showsMyLocationButton={false}
          toolbarEnabled={false}
        >
          {/* Poligon Peta Final (Disahkan - Cyan) */}
          {filteredFinal.map((p, idx) => {
            const coords = p.coordinates || [];
            if (coords.length < 3) return null;
            return (
              <Polygon
                key={`final-${p.kode_desa || 'x'}-${idx}`}
                coordinates={coords}
                strokeColor={FINAL_STROKE}
                strokeWidth={2}
                fillColor={FINAL_FILL}
                tappable
                onPress={() => {
                  setSelectedPolygon({ ...p, type: 'Peta Final (Disahkan)' });
                  setDetailModalVisible(true);
                }}
              />
            );
          })}

          {/* Poligon Peta Dasar (Batas Awal - Amber) */}
          {filteredDasar.map((p, idx) => {
            const coords = p.coordinates || [];
            if (coords.length < 3) return null;
            return (
              <Polygon
                key={`dasar-${p.kode_desa || 'x'}-${idx}`}
                coordinates={coords}
                strokeColor={DASAR_STROKE}
                strokeWidth={1.8}
                fillColor={DASAR_FILL}
                tappable
                onPress={() => {
                  setSelectedPolygon({ ...p, type: 'Peta Dasar' });
                  setDetailModalVisible(true);
                }}
              />
            );
          })}
        </MapView>

        {/* Loading Spinner */}
        {(isFinalLoading || isDasarLoading) && (
          <View style={s.loadingBadge}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={s.loadingText}>Memuat batas peta...</Text>
          </View>
        )}

        {/* KONTROL MAP KANAN */}
        <View style={s.rightControls}>
          <TouchableOpacity style={s.controlBtn} onPress={() => handleZoom(true)} activeOpacity={0.8}>
            <Icon name="add" size={20} color={DARK_NAVY} />
          </TouchableOpacity>
          <TouchableOpacity style={s.controlBtn} onPress={() => handleZoom(false)} activeOpacity={0.8}>
            <Icon name="remove" size={20} color={DARK_NAVY} />
          </TouchableOpacity>
          <TouchableOpacity style={s.controlBtn} onPress={handleMyLocation} activeOpacity={0.8}>
            <Icon name="locate" size={18} color={PRIMARY} />
          </TouchableOpacity>
          <TouchableOpacity style={s.controlBtn} onPress={handleCenterKonawe} activeOpacity={0.8}>
            <Icon name="scan-outline" size={18} color="#0D9488" />
          </TouchableOpacity>
        </View>

        {/* LEGENDA KECIL DI POJOK KANAN BAWAH */}
        <View style={s.mapLegendBadge}>
          <View style={s.legendRow}>
            <View style={[s.legendSquare, { borderColor: FINAL_STROKE, backgroundColor: FINAL_FILL }]} />
            <Text style={s.legendLbl}>Final</Text>
          </View>
          <View style={s.legendRow}>
            <View style={[s.legendSquare, { borderColor: DASAR_STROKE, backgroundColor: DASAR_FILL }]} />
            <Text style={s.legendLbl}>Dasar</Text>
          </View>
        </View>
      </View>

      {/* ─── 4. PANEL FILTER & FITUR TERBATAS ─────────────────────── */}
      <Animated.View
        style={[
          s.bottomPanel,
          {
            paddingBottom: Math.max(insets.bottom, 12),
            maxHeight: panelAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [48, 310],
            }),
          },
        ]}
      >
        {/* Toggle Panel Handle */}
        <TouchableOpacity style={s.panelHandleWrap} onPress={togglePanel} activeOpacity={0.8}>
          <View style={s.panelHandleBar} />
          <View style={s.panelHeaderRow}>
            <Text style={s.panelTitle}>
              {isPanelOpen ? 'Filter Wilayah & Navigasi' : 'Buka Filter & Menu Wilayah'}
            </Text>
            <Icon
              name={isPanelOpen ? 'chevron-down' : 'chevron-up'}
              size={18}
              color={TEXT_MID}
            />
          </View>
        </TouchableOpacity>

        {isPanelOpen && (
          <ScrollView style={s.panelBody} showsVerticalScrollIndicator={false}>
            {/* Input Pencarian Desa */}
            <View style={s.searchBox}>
              <Icon name="search-outline" size={18} color="#94A3B8" style={{ marginRight: 6 }} />
              <TextInput
                style={s.searchInput}
                placeholder="Cari nama desa di Konawe Selatan..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Icon name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Filter Kecamatan & Desa */}
            <View style={s.filterRow}>
              <View style={[s.pickerWrap, { flex: 1, marginRight: 6 }]}>
                <Picker
                  selectedValue={selectedKecamatan}
                  style={s.picker}
                  dropdownIconColor={TEXT_MID}
                  onValueChange={(val) => {
                    setSelectedKecamatan(val);
                    setSelectedDesa('');
                  }}
                >
                  <Picker.Item label="-- Semua Kecamatan --" value="" />
                  {kecamatanList.map((k) => (
                    <Picker.Item key={k.id} label={k.name} value={k.id} />
                  ))}
                </Picker>
              </View>

              <View style={[s.pickerWrap, { flex: 1, marginLeft: 6 }]}>
                <Picker
                  selectedValue={selectedDesa}
                  style={s.picker}
                  dropdownIconColor={TEXT_MID}
                  enabled={Boolean(selectedKecamatan)}
                  onValueChange={(val) => setSelectedDesa(val)}
                >
                  <Picker.Item label="-- Semua Desa --" value="" />
                  {desaList.map((d) => (
                    <Picker.Item key={d.id} label={d.name} value={d.id} />
                  ))}
                </Picker>
              </View>
            </View>

            {/* BARIS MENU / FITUR TERBATAS (JIKA DIKLIK ARAHKAN KE LOGIN) */}
            <View style={s.restrictedSection}>
              <Text style={s.restrictedSectionTitle}>Fitur Khusus Petugas (Perlu Login):</Text>
              <View style={s.restrictedGrid}>
                <TouchableOpacity
                  style={s.restrictedCard}
                  onPress={() => handleRestrictedAccess('Usulan Batas Desa')}
                  activeOpacity={0.7}
                >
                  <View style={[s.restrictedIconCircle, { backgroundColor: '#E0F2FE' }]}>
                    <Icon name="git-pull-request-outline" size={18} color={PRIMARY} />
                  </View>
                  <Text style={s.restrictedCardText}>Usulan Peta</Text>
                  <Icon name="lock-closed" size={10} color="#DC2626" style={s.lockIcon} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.restrictedCard}
                  onPress={() => handleRestrictedAccess('GPS Track Recorder')}
                  activeOpacity={0.7}
                >
                  <View style={[s.restrictedIconCircle, { backgroundColor: '#FEF3C7' }]}>
                    <Icon name="footsteps-outline" size={18} color="#D97706" />
                  </View>
                  <Text style={s.restrictedCardText}>Rekam Jejak</Text>
                  <Icon name="lock-closed" size={10} color="#DC2626" style={s.lockIcon} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.restrictedCard}
                  onPress={() => handleRestrictedAccess('Titik Patok Batas (Placemark)')}
                  activeOpacity={0.7}
                >
                  <View style={[s.restrictedIconCircle, { backgroundColor: '#DCFCE7' }]}>
                    <Icon name="location-outline" size={18} color="#15803D" />
                  </View>
                  <Text style={s.restrictedCardText}>Titik Patok</Text>
                  <Icon name="lock-closed" size={10} color="#DC2626" style={s.lockIcon} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.restrictedCard}
                  onPress={() => handleRestrictedAccess('Geotag Kamera Lapangan')}
                  activeOpacity={0.7}
                >
                  <View style={[s.restrictedIconCircle, { backgroundColor: '#F3E8FF' }]}>
                    <Icon name="camera-outline" size={18} color="#7E22CE" />
                  </View>
                  <Text style={s.restrictedCardText}>Geotag Foto</Text>
                  <Icon name="lock-closed" size={10} color="#DC2626" style={s.lockIcon} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.restrictedCard}
                  onPress={() => handleRestrictedAccess('Monitoring Verifikasi Wilayah')}
                  activeOpacity={0.7}
                >
                  <View style={[s.restrictedIconCircle, { backgroundColor: '#FEE2E2' }]}>
                    <Icon name="analytics-outline" size={18} color="#B91C1C" />
                  </View>
                  <Text style={s.restrictedCardText}>Monitoring</Text>
                  <Icon name="lock-closed" size={10} color="#DC2626" style={s.lockIcon} />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        )}
      </Animated.View>

      {/* ─── 5. MODAL DETAIL DESA SAAT POLIGON DIKLIK ────────────── */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.detailCard}>
            <View style={s.detailHeaderRow}>
              <View style={{ flex: 1 }}>
                <View style={s.badgeTypeRow}>
                  <View
                    style={[
                      s.typeDot,
                      {
                        backgroundColor:
                          selectedPolygon?.type?.includes('Final')
                            ? FINAL_STROKE
                            : DASAR_STROKE,
                      },
                    ]}
                  />
                  <Text style={s.typeLabel}>{selectedPolygon?.type || 'Batas Wilayah'}</Text>
                </View>
                <Text style={s.detailTitle}>{selectedPolygon?.nama_desa || 'Desa'}</Text>
                <Text style={s.detailSubtitle}>
                  Kecamatan: {selectedPolygon?.nama_kecamatan || 'Konawe Selatan'}
                </Text>
              </View>
              <TouchableOpacity
                style={s.closeCircleBtn}
                onPress={() => setDetailModalVisible(false)}
              >
                <Icon name="close" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={s.detailDivider} />

            <View style={s.detailStatsRow}>
              <View style={s.statCol}>
                <Text style={s.statLbl}>Kode Desa</Text>
                <Text style={s.statVal}>{selectedPolygon?.kode_desa || '-'}</Text>
              </View>
              <View style={s.statCol}>
                <Text style={s.statLbl}>Estimasi Luas</Text>
                <Text style={s.statVal}>
                  {selectedPolygon?.coordinates ? `${calculateArea(selectedPolygon.coordinates)} km²` : '-'}
                </Text>
              </View>
              <View style={s.statCol}>
                <Text style={s.statLbl}>Jumlah Titik</Text>
                <Text style={s.statVal}>{selectedPolygon?.coordinates?.length || 0}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={s.detailCloseBtn}
              onPress={() => setDetailModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={s.detailCloseBtnText}>Tutup Info</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── 6. MODAL RESTRICTION (ARAHKAN KE LOGIN) ─────────────── */}
      <Modal
        visible={restrictedModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRestrictedModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.restrictedModalCard}>
            <View style={s.restrictedHeaderIcon}>
              <Icon name="lock-closed" size={32} color="#0284C7" />
            </View>
            <Text style={s.restrictedModalTitle}>Fitur Khusus Petugas</Text>
            <Text style={s.restrictedModalDesc}>
              Akses ke fitur{' '}
              <Text style={{ fontWeight: '800', color: DARK_NAVY }}>
                "{restrictedFeatureName}"
              </Text>{' '}
              memerlukan akun terdaftar (Petugas Survei, Admin Kecamatan, atau Operator Desa).
            </Text>
            <Text style={s.restrictedModalSubDesc}>
              Dalam mode tamu, Anda hanya dapat melihat Peta Dasar dan Peta Final Kabupaten Konawe Selatan.
            </Text>

            <View style={s.restrictedBtnRow}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => setRestrictedModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={s.cancelBtnText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.confirmLoginBtn}
                onPress={navigateToLogin}
                activeOpacity={0.85}
              >
                <Icon name="log-in-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={s.confirmLoginBtnText}>Masuk Akun</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── 7. MODAL PILIHAN BASEMAP LAYER ───────────────────────── */}
      <Modal
        visible={showLayerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLayerModal(false)}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLayerModal(false)}
        >
          <View style={s.layerModalCard}>
            <Text style={s.layerModalTitle}>Pilih Tampilan Peta</Text>
            {[
              { id: 'hybrid', label: 'Hybrid (Satelit + Jalan)', icon: 'earth-outline' },
              { id: 'satellite', label: 'Satelit Murni', icon: 'globe-outline' },
              { id: 'standard', label: 'Peta Standar (Vektor)', icon: 'map-outline' },
              { id: 'terrain', label: 'Topografi / Terrain', icon: 'trail-sign-outline' },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[s.layerOptItem, mapType === opt.id && s.layerOptItemActive]}
                onPress={() => {
                  setMapType(opt.id);
                  setShowLayerModal(false);
                }}
              >
                <Icon
                  name={opt.icon}
                  size={20}
                  color={mapType === opt.id ? PRIMARY : TEXT_MID}
                  style={{ marginRight: 10 }}
                />
                <Text
                  style={[s.layerOptLabel, mapType === opt.id && s.layerOptLabelActive]}
                >
                  {opt.label}
                </Text>
                {mapType === opt.id && (
                  <Icon name="checkmark-circle" size={18} color={PRIMARY} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// ─── STYLESHEET ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_NAVY,
  },
  header: {
    backgroundColor: DARK_NAVY,
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerTitleWrap: {
    flex: 1,
  },
  guestBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  guestPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#38BDF8',
    marginRight: 5,
  },
  guestBadgeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  loginCtaBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  loginCtaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  quickLayerBar: {
    backgroundColor: '#0B1528',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
  },
  layerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
  },
  layerPillActive: {
    backgroundColor: 'rgba(2,132,199,0.3)',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  layerPillActiveFinal: {
    backgroundColor: 'rgba(0,229,255,0.2)',
    borderWidth: 1,
    borderColor: FINAL_STROKE,
  },
  layerPillActiveDasar: {
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderWidth: 1,
    borderColor: DASAR_STROKE,
  },
  legendColorDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 5,
  },
  layerPillText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  layerPillTextActive: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  layerPillTextActiveFinal: {
    color: FINAL_STROKE,
    fontWeight: '800',
  },
  layerPillTextActiveDasar: {
    color: DASAR_STROKE,
    fontWeight: '800',
  },
  layerTypeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  loadingBadge: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(15,23,42,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  rightControls: {
    position: 'absolute',
    top: 12,
    right: 12,
    gap: 6,
  },
  controlBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 3,
  },
  mapLegendBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 3,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 3,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendSquare: {
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 1.5,
  },
  legendLbl: {
    fontSize: 9.5,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  bottomPanel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 10,
  },
  panelHandleWrap: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  panelHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginBottom: 6,
  },
  panelHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  panelTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: TEXT_DARK,
  },
  panelBody: {
    marginTop: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: TEXT_DARK,
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  pickerWrap: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    height: 40,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  picker: {
    fontSize: 12,
    color: TEXT_DARK,
    height: 40,
  },
  restrictedSection: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  restrictedSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_MID,
    marginBottom: 8,
  },
  restrictedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  restrictedCard: {
    width: '31%',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  restrictedIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  restrictedCardText: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT_DARK,
    textAlign: 'center',
  },
  lockIcon: {
    position: 'absolute',
    top: 5,
    right: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  detailCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  badgeTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  typeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: PRIMARY_DARK,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: TEXT_DARK,
  },
  detailSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_MID,
    marginTop: 2,
  },
  closeCircleBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 14,
  },
  detailStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  statCol: {
    alignItems: 'center',
  },
  statLbl: {
    fontSize: 10,
    color: TEXT_MID,
    fontWeight: '600',
    marginBottom: 3,
  },
  statVal: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_DARK,
  },
  detailCloseBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  detailCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  restrictedModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 12,
    elevation: 10,
  },
  restrictedHeaderIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  restrictedModalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: DARK_NAVY,
    marginBottom: 8,
  },
  restrictedModalDesc: {
    fontSize: 13,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 8,
  },
  restrictedModalSubDesc: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 20,
  },
  restrictedBtnRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  confirmLoginBtn: {
    flex: 1.3,
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  confirmLoginBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  layerModalCard: {
    width: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  layerModalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: DARK_NAVY,
    marginBottom: 10,
    paddingHorizontal: 6,
  },
  layerOptItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  layerOptItemActive: {
    backgroundColor: '#E0F2FE',
  },
  layerOptLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_DARK,
  },
  layerOptLabelActive: {
    color: PRIMARY,
    fontWeight: '800',
  },
});

export default GuestMap;
