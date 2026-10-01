// views/peta_tematik/PetaTematik.js
/**
 * PetaTematik.js — Modul Peta Tematik SIMBADA Mobile
 * Menampilkan 1.238 fitur Nama Rupabumi (Toponim) & Fasilitas Wilayah Kab. Konawe Selatan
 * Bersumber dari data geospasial resmi Badan Informasi Geospasial (SINAR BIG)
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Linking,
  Alert,
  FlatList,
  InteractionManager,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Icon from 'react-native-vector-icons/Ionicons';
import MapView, { Marker, Polygon, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const windowDims = Dimensions.get('window') || {};
const SCREEN_WIDTH = windowDims.width || 360;
const SCREEN_HEIGHT = windowDims.height || 740;

// ─── PUSAT WILAYAH KAB. KONAWE SELATAN ─────────────────────────────────────
const INITIAL_REGION = {
  latitude: -4.2021418,
  longitude: 122.4819808,
  latitudeDelta: 0.85,
  longitudeDelta: 0.85,
};

// ─── KONFIGURASI KATEGORI TOPONIM ──────────────────────────────────────────
const CATEGORIES = [
  { id: 'ALL', label: 'Semua', icon: 'grid-outline', color: '#0284C7' },
  { id: 'PEMERINTAHAN', label: 'Pemerintahan', icon: 'business-outline', color: '#2563EB', keyMatch: 'Pemerintahan' },
  { id: 'PENDIDIKAN', label: 'Pendidikan', icon: 'school-outline', color: '#16A36A', keyMatch: 'Pendidikan' },
  { id: 'IBADAH', label: 'Ibadah', icon: 'star-outline', color: '#8B5CF6', keyMatch: 'Peribadatan' },
  { id: 'KESEHATAN', label: 'Kesehatan', icon: 'medkit-outline', color: '#EF4444', keyMatch: 'Kesehatan' },
  { id: 'EKONOMI', label: 'Perekonomian', icon: 'cart-outline', color: '#D97706', keyMatch: 'Perekonomian' },
  { id: 'PERAIRAN', label: 'Perairan & Area', icon: 'water-outline', color: '#06B6D4', keyMatch: ['Perairan', 'Relief'] },
  { id: 'LAINNYA', label: 'Fasilitas Lain', icon: 'location-outline', color: '#64748B', isOther: true },
];

const getCategoryColor = (klstpn = '') => {
  if (klstpn.includes('Pemerintahan')) return '#2563EB';
  if (klstpn.includes('Pendidikan')) return '#16A36A';
  if (klstpn.includes('Peribadatan')) return '#8B5CF6';
  if (klstpn.includes('Kesehatan')) return '#EF4444';
  if (klstpn.includes('Perekonomian')) return '#D97706';
  if (klstpn.includes('Perairan') || klstpn.includes('Relief')) return '#06B6D4';
  return '#64748B';
};

const getCategoryIcon = (klstpn = '') => {
  if (klstpn.includes('Pemerintahan')) return 'business';
  if (klstpn.includes('Pendidikan')) return 'school';
  if (klstpn.includes('Peribadatan')) return 'star';
  if (klstpn.includes('Kesehatan')) return 'medkit';
  if (klstpn.includes('Perekonomian')) return 'cart';
  if (klstpn.includes('Perairan') || klstpn.includes('Relief')) return 'water';
  return 'location';
};

// ─── IN-MEMORY MODULE CACHE ─────────────────────────────────────────────────
// Data diparsing sekali saja & disimpan di memori RAM.
// Saat navigasi kembali ke layar ini (kunjungan kedua dst), pembacaan JSON tidak
// akan diulang sama sekali (0ms instantaneous render).
let cachedParsedFeatures = null;

const parseToponimDataset = () => {
  if (cachedParsedFeatures) return cachedParsedFeatures;

  const rawDataset = require('../assets/data/peta_tematik_toponim.json');
  if (!rawDataset || !Array.isArray(rawDataset.features)) return [];

  const parsed = rawDataset.features.map((f, idx) => {
    const p = f.properties || {};
    const g = f.geometry || {};
    const geomType = g.type;

    let coordinate = null;
    let polygonCoords = null;

    if (geomType === 'Point' && Array.isArray(g.coordinates)) {
      coordinate = {
        latitude: parseFloat(g.coordinates[1]),
        longitude: parseFloat(g.coordinates[0]),
      };
    } else if (geomType === 'Polygon' && Array.isArray(g.coordinates)) {
      // Multi-ring polygon (ring 0)
      const ring = g.coordinates[0] || [];
      polygonCoords = ring.map((c) => ({
        latitude: parseFloat(c[1]),
        longitude: parseFloat(c[0]),
      }));
      if (polygonCoords.length > 0) {
        coordinate = polygonCoords[0];
      }
    } else if (geomType === 'LineString' && Array.isArray(g.coordinates)) {
      polygonCoords = g.coordinates.map((c) => ({
        latitude: parseFloat(c[1]),
        longitude: parseFloat(c[0]),
      }));
      if (polygonCoords.length > 0) {
        coordinate = polygonCoords[0];
      }
    }

    // Validasi foto (abaikan placeholder blank.png)
    const validPhotos = [p.foto1, p.foto2, p.foto3, p.foto4].filter(
      (url) => url && typeof url === 'string' && url.startsWith('http') && !url.includes('blank.png')
    );

    return {
      id: p.id_toponim || `feat-${idx}`,
      name: p.nammap || p.namspe || p.namlok || 'Tanpa Nama',
      genericName: p.namlok || '',
      specificName: p.namspe || '',
      category: p.klstpn || 'Lainnya',
      featureClass: p.ftype || '',
      dmsCoord: p.koordinat1 || '',
      kecamatan: p.wadmkc || '',
      desa: p.wadmkd || '',
      kabupaten: p.wadmkk || 'Konawe Selatan',
      elevation: p.elevasi || '0',
      accuracy: p.akurasi || '0',
      surveyor: p.nsurveyor || 'Surveyor BIG',
      surveyDate: p.tglsurvei || '-',
      source: p.sumber || 'SINAR BIG',
      geomType,
      coordinate,
      polygonCoords,
      photos: validPhotos,
      color: getCategoryColor(p.klstpn),
      iconName: getCategoryIcon(p.klstpn),
    };
  });

  cachedParsedFeatures = parsed;
  return parsed;
};

const PetaTematik = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);

  // Data & Cache State (Jika sudah ada di memori RAM, langsung pakai 0ms)
  const [allFeatures, setAllFeatures] = useState(() => cachedParsedFeatures || []);
  const [isLoadingData, setIsLoadingData] = useState(() => !cachedParsedFeatures);

  useEffect(() => {
    // Jika cache sudah tersedia, tidak perlu parsing ulang sama sekali
    if (cachedParsedFeatures) {
      if (allFeatures.length === 0) setAllFeatures(cachedParsedFeatures);
      if (isLoadingData) setIsLoadingData(false);
      return;
    }

    // Eksekusi parsing setelah animasi transisi layar selesai (UI tetap mulus 60 FPS)
    const task = InteractionManager.runAfterInteractions(() => {
      try {
        const data = parseToponimDataset();
        setAllFeatures(data);
      } catch (err) {
        console.warn('Gagal memuat dataset toponim:', err);
      } finally {
        setIsLoadingData(false);
      }
    });

    return () => task.cancel();
  }, []);

  // Filter & Search State
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [mapType, setMapType] = useState('hybrid'); // 'hybrid' | 'satellite' | 'standard'

  // Modal Detail State
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  // Region Viewport State untuk optimasi render pin di layar
  const [currentRegion, setCurrentRegion] = useState(INITIAL_REGION);

  // Filter fitur berdasarkan kategori dan pencarian
  const filteredFeatures = useMemo(() => {
    let result = allFeatures;

    // Filter Kategori
    if (selectedCategory !== 'ALL') {
      const catConfig = CATEGORIES.find((c) => c.id === selectedCategory);
      if (catConfig) {
        if (catConfig.keyMatch) {
          if (Array.isArray(catConfig.keyMatch)) {
            result = result.filter((f) =>
              catConfig.keyMatch.some((k) => f.category.includes(k))
            );
          } else {
            result = result.filter((f) => f.category.includes(catConfig.keyMatch));
          }
        } else if (catConfig.isOther) {
          const mainKeys = ['Pemerintahan', 'Pendidikan', 'Peribadatan', 'Kesehatan', 'Perekonomian', 'Perairan', 'Relief'];
          result = result.filter((f) => !mainKeys.some((k) => f.category.includes(k)));
        }
      }
    }

    // Filter Search Query
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.featureClass.toLowerCase().includes(q) ||
          f.kecamatan.toLowerCase().includes(q) ||
          f.desa.toLowerCase().includes(q) ||
          f.category.toLowerCase().includes(q)
      );
    }

    return result;
  }, [allFeatures, selectedCategory, searchQuery]);

  // Optimasi Marker: Tampilkan pin yang berada di dalam bounds layar atau batasi hingga 150 pin terdekat
  const visibleMarkers = useMemo(() => {
    if (!currentRegion) return filteredFeatures.slice(0, 100);

    const latMin = currentRegion.latitude - currentRegion.latitudeDelta * 0.7;
    const latMax = currentRegion.latitude + currentRegion.latitudeDelta * 0.7;
    const lonMin = currentRegion.longitude - currentRegion.longitudeDelta * 0.7;
    const lonMax = currentRegion.longitude + currentRegion.longitudeDelta * 0.7;

    const inBounds = filteredFeatures.filter((f) => {
      if (!f.coordinate) return false;
      return (
        f.coordinate.latitude >= latMin &&
        f.coordinate.latitude <= latMax &&
        f.coordinate.longitude >= lonMin &&
        f.coordinate.longitude <= lonMax
      );
    });

    // Jika pengguna zoom-out sangat jauh, batasi agar tidak lag
    return inBounds.slice(0, 150);
  }, [filteredFeatures, currentRegion]);

  // Hitung jumlah objek per kategori
  const categoryCounts = useMemo(() => {
    const counts = { ALL: allFeatures.length };
    CATEGORIES.forEach((cat) => {
      if (cat.id === 'ALL') return;
      if (cat.keyMatch) {
        if (Array.isArray(cat.keyMatch)) {
          counts[cat.id] = allFeatures.filter((f) =>
            cat.keyMatch.some((k) => f.category.includes(k))
          ).length;
        } else {
          counts[cat.id] = allFeatures.filter((f) => f.category.includes(cat.keyMatch)).length;
        }
      } else if (cat.isOther) {
        const mainKeys = ['Pemerintahan', 'Pendidikan', 'Peribadatan', 'Kesehatan', 'Perekonomian', 'Perairan', 'Relief'];
        counts[cat.id] = allFeatures.filter((f) => !mainKeys.some((k) => f.category.includes(k))).length;
      }
    });
    return counts;
  }, [allFeatures]);

  // Buka detail modal
  const handleSelectFeature = useCallback((feature) => {
    setSelectedFeature(feature);
    setActivePhotoIndex(0);
    setModalVisible(true);
  }, []);

  // Fokuskan peta ke objek
  const handleFocusFeature = useCallback((feature) => {
    if (feature && feature.coordinate && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: feature.coordinate.latitude,
          longitude: feature.coordinate.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        700
      );
    }
  }, []);

  // Buka petunjuk arah via Google Maps
  const handleOpenGoogleMaps = (feat) => {
    if (!feat || !feat.coordinate) return;
    const { latitude, longitude } = feat.coordinate;
    const label = encodeURIComponent(feat.name);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${label}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert('Gagal Membuka Peta', 'Tidak dapat membuka aplikasi peta di perangkat.');
        }
      })
      .catch(() => {
        Alert.alert('Error', 'Gagal memproses tautan navigasi.');
      });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* ─── 1. HEADER UTAMA ─────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Icon name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <View style={styles.badgeRow}>
              <View style={styles.dotPulse} />
              <Text style={styles.badgeText}>SINAR BIG • TOPONIM</Text>
            </View>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Peta Tematik & Fasilitas
            </Text>
          </View>
        </View>

        {/* Toggle Tipe Peta */}
        <TouchableOpacity
          style={styles.mapTypeToggleBtn}
          onPress={() =>
            setMapType((prev) =>
              prev === 'hybrid' ? 'standard' : prev === 'standard' ? 'satellite' : 'hybrid'
            )
          }
          activeOpacity={0.8}
        >
          <Icon name="layers" size={17} color="#FFFFFF" />
          <Text style={styles.mapTypeText}>
            {mapType === 'hybrid' ? 'Hibrida' : mapType === 'standard' ? 'Jalan' : 'Satelit'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ─── 2. SEARCH BAR ────────────────────────────────────────── */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Icon name="search-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari fasilitas, sekolah, kantor desa, teluk..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ─── 3. HORIZONTAL CATEGORY PILLS ─────────────────────────── */}
      <View style={styles.categoryBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            const count = categoryCounts[cat.id] || 0;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryPill,
                  isActive && { backgroundColor: cat.color, borderColor: cat.color },
                ]}
                onPress={() => setSelectedCategory(cat.id)}
                activeOpacity={0.75}
              >
                <Icon
                  name={cat.icon}
                  size={14}
                  color={isActive ? '#FFFFFF' : cat.color}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={[
                    styles.categoryPillText,
                    isActive && styles.categoryPillTextActive,
                  ]}
                >
                  {cat.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ─── 4. MAP VIEW CONTAINER ────────────────────────────────── */}
      <View style={styles.mapContainer}>
        {/* Loading Banner Latar Belakang (Hanya tampil sejenak pada parsing awal) */}
        {isLoadingData && (
          <View style={styles.dataLoadingBanner}>
            <ActivityIndicator size="small" color="#38BDF8" style={{ marginRight: 8 }} />
            <Text style={styles.dataLoadingText}>Menyiapkan 1.238 titik toponim...</Text>
          </View>
        )}

        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={INITIAL_REGION}
          mapType={mapType}
          showsUserLocation
          showsMyLocationButton={false}
          onRegionChangeComplete={(reg) => setCurrentRegion(reg)}
        >
          {/* Render Polygon Area (Kawasan/Teluk) */}
          {filteredFeatures
            .filter((f) => f.geomType === 'Polygon' && f.polygonCoords)
            .map((poly) => (
              <Polygon
                key={`poly-${poly.id}`}
                coordinates={poly.polygonCoords}
                strokeColor={poly.color}
                fillColor={poly.color + '33'} // Transparansi 20%
                strokeWidth={2}
                tappable
                onPress={() => {
                  handleSelectFeature(poly);
                  handleFocusFeature(poly);
                }}
              />
            ))}

          {/* Render Polyline (Garis Toponim) */}
          {filteredFeatures
            .filter((f) => f.geomType === 'LineString' && f.polygonCoords)
            .map((line) => (
              <Polyline
                key={`line-${line.id}`}
                coordinates={line.polygonCoords}
                strokeColor={line.color}
                strokeWidth={3}
                tappable
                onPress={() => {
                  handleSelectFeature(line);
                  handleFocusFeature(line);
                }}
              />
            ))}

          {/* Render Markers Pin (Hanya yang tampak / dioptimasi) */}
          {visibleMarkers.map((feat) => {
            if (!feat.coordinate) return null;
            return (
              <Marker
                key={`mark-${feat.id}`}
                coordinate={feat.coordinate}
                tracksViewChanges={false} // Tingkatkan performa render marker
                onPress={() => {
                  handleSelectFeature(feat);
                  handleFocusFeature(feat);
                }}
              >
                <View style={[styles.markerPin, { backgroundColor: feat.color }]}>
                  <Icon name={feat.iconName} size={13} color="#FFFFFF" />
                </View>
              </Marker>
            );
          })}
        </MapView>

        {/* Floating Quick Action: Reset Konawe Selatan & Zoom */}
        <View style={styles.mapFabContainer}>
          <TouchableOpacity
            style={styles.fabBtn}
            onPress={() => {
              if (mapRef.current) {
                mapRef.current.animateToRegion(INITIAL_REGION, 800);
              }
            }}
            activeOpacity={0.8}
          >
            <Icon name="compass-outline" size={20} color="#0F172A" />
          </TouchableOpacity>
        </View>

        {/* Indikator Jumlah Fitur & Status */}
        <View style={styles.floatingStatsBar}>
          <Icon name="stats-chart-outline" size={14} color="#087FC1" style={{ marginRight: 6 }} />
          <Text style={styles.floatingStatsText}>
            Menampilkan <Text style={styles.boldText}>{visibleMarkers.length}</Text> dari{' '}
            <Text style={styles.boldText}>{filteredFeatures.length}</Text> objek
          </Text>
        </View>
      </View>

      {/* ─── 5. MODAL DETAIL OBJEK & FOTO LAPANGAN ─────────────────── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />

          <View style={styles.modalCard}>
            <View style={styles.modalHandleBar} />

            {selectedFeature && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                {/* Header Modal Objek */}
                <View style={styles.modalHeaderRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={[styles.modalCatBadge, { backgroundColor: selectedFeature.color + '1A' }]}>
                      <Icon
                        name={selectedFeature.iconName}
                        size={12}
                        color={selectedFeature.color}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.modalCatBadgeText, { color: selectedFeature.color }]}>
                        {selectedFeature.category}
                      </Text>
                    </View>
                    <Text style={styles.modalObjName}>{selectedFeature.name}</Text>
                    <Text style={styles.modalObjSub}>
                      {selectedFeature.featureClass || 'Fasilitas Daerah'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseCircle}
                    onPress={() => setModalVisible(false)}
                  >
                    <Icon name="close" size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Galeri Foto Lapangan (Jika Tersedia) */}
                {selectedFeature.photos && selectedFeature.photos.length > 0 ? (
                  <View style={styles.photoSection}>
                    <Text style={styles.sectionLabel}>
                      DOKUMENTASI FOTO LAPANGAN ({selectedFeature.photos.length})
                    </Text>
                    <View style={styles.photoContainer}>
                      <FastImage
                        source={{ uri: selectedFeature.photos[activePhotoIndex] }}
                        style={styles.photoViewer}
                        resizeMode={FastImage.resizeMode.cover}
                      />
                      <View style={styles.photoSourceWatermark}>
                        <Icon name="shield-checkmark" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.photoWatermarkText}>Dokumentasi SINAR BIG</Text>
                      </View>
                    </View>

                    {/* Thumbnail Foto Slider jika lebih dari 1 foto */}
                    {selectedFeature.photos.length > 1 && (
                      <View style={styles.thumbRow}>
                        {selectedFeature.photos.map((pUrl, idx) => (
                          <TouchableOpacity
                            key={`thumb-${idx}`}
                            style={[
                              styles.thumbItem,
                              activePhotoIndex === idx && styles.thumbItemActive,
                            ]}
                            onPress={() => setActivePhotoIndex(idx)}
                          >
                            <FastImage
                              source={{ uri: pUrl }}
                              style={styles.thumbImage}
                              resizeMode={FastImage.resizeMode.cover}
                            />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.noPhotoBox}>
                    <Icon name="image-outline" size={24} color="#94A3B8" />
                    <Text style={styles.noPhotoText}>Tidak ada foto lapangan resmi untuk objek ini</Text>
                  </View>
                )}

                {/* Data Teknis & Administrasi */}
                <View style={styles.specGrid}>
                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>Kecamatan</Text>
                    <Text style={styles.specValue}>{selectedFeature.kecamatan || '-'}</Text>
                  </View>
                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>Desa / Kelurahan</Text>
                    <Text style={styles.specValue}>{selectedFeature.desa || '-'}</Text>
                  </View>
                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>Koordinat (DMS)</Text>
                    <Text style={styles.specValue} numberOfLines={1}>
                      {selectedFeature.dmsCoord || '-'}
                    </Text>
                  </View>
                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>Elevasi / Akurasi</Text>
                    <Text style={styles.specValue}>
                      {selectedFeature.elevation} m dpl • ±{selectedFeature.accuracy} m
                    </Text>
                  </View>
                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>Surveyor BIG</Text>
                    <Text style={styles.specValue}>{selectedFeature.surveyor}</Text>
                  </View>
                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>Tanggal Survei</Text>
                    <Text style={styles.specValue}>{selectedFeature.surveyDate}</Text>
                  </View>
                </View>

                {/* Tombol Tindakan Arahkan Navigasi */}
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity
                    style={styles.routeActionBtn}
                    onPress={() => handleOpenGoogleMaps(selectedFeature)}
                    activeOpacity={0.8}
                  >
                    <Icon name="navigate-circle" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.routeActionText}>Arahkan Navigasi (Google Maps)</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── STYLES ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitleWrap: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  dotPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  mapTypeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  mapTypeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 5,
  },
  searchContainer: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  categoryBarWrap: {
    backgroundColor: '#0F172A',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  categoryScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  markerPin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  mapFabContainer: {
    position: 'absolute',
    right: 16,
    bottom: 45,
  },
  fabBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  floatingStatsBar: {
    position: 'absolute',
    left: 16,
    bottom: 45,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  floatingStatsText: {
    color: '#CBD5E1',
    fontSize: 11,
  },
  boldText: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: SCREEN_HEIGHT * 0.78,
  },
  modalHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  modalCatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  modalCatBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalObjName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 24,
  },
  modalObjSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  photoContainer: {
    width: '100%',
    height: 190,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F1F5F9',
  },
  photoViewer: {
    width: '100%',
    height: '100%',
  },
  photoSourceWatermark: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoWatermarkText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  thumbRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  thumbItem: {
    width: 52,
    height: 52,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbItemActive: {
    borderColor: '#0284C7',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  noPhotoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    gap: 10,
  },
  noPhotoText: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },
  specGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  specItem: {
    width: '47.5%',
  },
  specLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  specValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
  },
  actionButtonsRow: {
    marginTop: 4,
  },
  routeActionBtn: {
    backgroundColor: '#0284C7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  routeActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dataLoadingBanner: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    zIndex: 99,
  },
  dataLoadingText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default PetaTematik;
