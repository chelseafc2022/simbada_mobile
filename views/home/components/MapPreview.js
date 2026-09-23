// views/home/components/MapPreview.js
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
} from 'react-native';
import MapView, { Polygon, Marker, Circle } from 'react-native-maps';
import FastImage from 'react-native-fast-image';

/**
 * MapPreview SIMBADA V2 (Sesuai Desain Modern Government GIS & Citra Satelit)
 * Menampilkan:
 * 1. Peta Satelit / Hybrid interaktif
 * 2. Top-Left: Card "Peta Batas Desa - Kab. Konawe Selatan" dengan Icon Peta Biru
 * 3. Top-Right: Dropdown "Pilih Layer ⌵" (Hybrid, Standard, Terrain)
 * 4. Right Controls: Stack 4 tombol vertikal (Kompas, Zoom In, Zoom Out, Lokasi Saya)
 * 5. Center Callout: Marker lokasi berdenyut dengan dark tag "[ Ranomeeto ]"
 * 6. Bottom-Left: Interactive Info Card (Thumbnail, Nama Wilayah, "12 Desa • 2.91 km²", Chevron ›)
 * 7. Bottom-Right: GIS Graphic Scale Bar (0  5  10 km)
 */
const MapPreview = ({
  mapRef,
  polygons = [],
  isLoading = false,
  selectedKecamatanName = '',
  userLocation = null,
  activePolygon: propActivePolygon,
  onActivePolygonChange,
  onCenterLocation,
  onZoomIn,
  onZoomOut,
  onSelectKecamatanPress,
  onDetailPolygonPress,
}) => {
  const [mapType, setMapType] = useState('hybrid'); // 'hybrid' | 'standard' | 'terrain'
  const [showLayerModal, setShowLayerModal] = useState(false);
  const [internalActivePolygon, setInternalActivePolygon] = useState(null);
  const activePolygon =
    propActivePolygon !== undefined
      ? propActivePolygon
      : internalActivePolygon;

  const handlePolygonPress = (polygon) => {
    if (onActivePolygonChange) {
      onActivePolygonChange(polygon);
    } else {
      setInternalActivePolygon(polygon);
    }
  };

  // Helper validasi koordinat numerik aman
  const isValidCoord = (coord) => {
    return (
      coord != null &&
      typeof coord === 'object' &&
      typeof coord.latitude === 'number' &&
      typeof coord.longitude === 'number' &&
      isFinite(coord.latitude) &&
      isFinite(coord.longitude) &&
      !isNaN(coord.latitude) &&
      !isNaN(coord.longitude)
    );
  };

  // Hitung titik pusat poligon untuk callout marker tag
  const getCentroid = (coords) => {
    if (!coords || !Array.isArray(coords) || coords.length === 0) return null;
    let sumLat = 0;
    let sumLng = 0;
    let validCount = 0;

    coords.forEach((c) => {
      if (!c) return;
      const lat =
        c.latitude != null ? parseFloat(c.latitude) : parseFloat(c.lat);
      const lng =
        c.longitude != null ? parseFloat(c.longitude) : parseFloat(c.lng);

      if (isFinite(lat) && isFinite(lng) && !isNaN(lat) && !isNaN(lng)) {
        sumLat += lat;
        sumLng += lng;
        validCount++;
      }
    });

    if (validCount === 0) return null;
    const center = {
      latitude: sumLat / validCount,
      longitude: sumLng / validCount,
    };
    return isValidCoord(center) ? center : null;
  };

  // Cari koordinat callout: jika ada polygon aktif, gunakan polygon aktif;
  // jika ada daftar polygon, gunakan polygon pertama;
  // jika tidak ada, gunakan koordinat Ranomeeto Konawe Selatan
  const targetPolygon =
    activePolygon || (polygons.length > 0 ? polygons[0] : null);
  const rawCalloutCoord = targetPolygon?.lokasi?.coordinat
    ? getCentroid(targetPolygon.lokasi.coordinat)
    : userLocation || {
        latitude: -4.032,
        longitude: 122.455,
      };

  const calloutCoord = isValidCoord(rawCalloutCoord) ? rawCalloutCoord : null;

  const calloutLabel =
    activePolygon?.lokasi?.nama_desa ||
    selectedKecamatanName ||
    'Ranomeeto';

  const bottomCardTitle =
    activePolygon?.lokasi?.nama_desa ||
    (selectedKecamatanName ? `Kec. ${selectedKecamatanName}` : 'Ranomeeto');

  const bottomCardSub = activePolygon?.calculatedArea
    ? `${activePolygon.calculatedArea} km² • ${activePolygon.status === '1' ? 'Disahkan' : 'Peta Dasar'}`
    : selectedKecamatanName
    ? `${polygons.length} Desa Terpetakan`
    : '12 Desa • 2.91 km²';

  // Memoize polygon parsing so rawCoords coordinate parsing doesn't run on every parent render or GPS tick
  const parsedPolygons = useMemo(() => {
    if (!Array.isArray(polygons)) return [];
    return polygons
      .map((polygon, index) => {
        const rawCoords = polygon?.lokasi?.coordinat;
        if (!Array.isArray(rawCoords) || rawCoords.length < 3) return null;

        const coords = rawCoords
          .map((c) => {
            if (!c) return null;
            const lat =
              c.latitude != null ? parseFloat(c.latitude) : parseFloat(c.lat);
            const lng =
              c.longitude != null ? parseFloat(c.longitude) : parseFloat(c.lng);
            if (
              isFinite(lat) &&
              isFinite(lng) &&
              !isNaN(lat) &&
              !isNaN(lng)
            ) {
              return { latitude: lat, longitude: lng };
            }
            return null;
          })
          .filter(Boolean);

        if (coords.length < 3) return null;

        return {
          polygon,
          index,
          id: polygon.des_kel_id || `idx-${index}`,
          nama_desa: polygon.lokasi?.nama_desa || '',
          coords,
        };
      })
      .filter(Boolean);
  }, [polygons]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.mapContainer}>
        {/* 1. MAP CANVAS GOOGLE MAPS DENGAN MAP TYPE SATELIT / HYBRID */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#087FC1" />
            <Text style={styles.loadingText}>Memuat Koordinat Geospasial...</Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={styles.mapCanvas}
            provider="google"
            mapType={mapType}
            initialRegion={{
              latitude: -4.08,
              longitude: 122.42,
              latitudeDelta: 0.35,
              longitudeDelta: 0.35,
            }}
            showsCompass={false}
            toolbarEnabled={false}
          >
            {/* Poligon Batas Wilayah Desa / Kecamatan (Memoized) */}
            {parsedPolygons.map(({ polygon, index, id, nama_desa, coords }) => {
              const isSelected =
                activePolygon &&
                ((activePolygon.des_kel_id &&
                  activePolygon.des_kel_id === polygon.des_kel_id) ||
                  (activePolygon.lokasi?.nama_desa &&
                    activePolygon.lokasi?.nama_desa === nama_desa));

              return (
                <Polygon
                  key={`poly-${id}-${isSelected ? 'sel' : 'unsel'}`}
                  coordinates={coords}
                  strokeColor={isSelected ? '#00E5FF' : '#FBBF24'} // Highlight Cyan atau Garis Batas Emas/Kuning
                  fillColor={
                    isSelected
                      ? 'rgba(0, 229, 255, 0.32)'
                      : 'rgba(251, 191, 36, 0.12)'
                  }
                  strokeWidth={isSelected ? 3 : 1.8}
                  tappable
                  onPress={() => handlePolygonPress(polygon)}
                />
              );
            })}

            {/* Marker Lokasi Pengguna (GPS) */}
            {isValidCoord(userLocation) && (
              <>
                <Circle
                  center={{
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                  }}
                  radius={
                    isFinite(userLocation.accuracy) && userLocation.accuracy > 0
                      ? userLocation.accuracy
                      : 30
                  }
                  fillColor="rgba(8, 127, 193, 0.2)"
                  strokeColor="rgba(8, 127, 193, 0.6)"
                  strokeWidth={1}
                />
                <Marker
                  coordinate={{
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                  }}
                  title="Posisi Anda"
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.gpsMarkerCircle}>
                    <View style={styles.gpsMarkerInner} />
                  </View>
                </Marker>
              </>
            )}

            {/* Center Tag Marker & Dark Callout Pin (Persis di Desain Acuan) */}
            {calloutCoord && (
              <Marker
                coordinate={calloutCoord}
                anchor={{ x: 0.2, y: 0.5 }}
                tracksViewChanges={false}
              >
                <View style={styles.markerWithCalloutRow}>
                  {/* Glowing Blue Pin Dot */}
                  <View style={styles.glowPinCircle}>
                    <View style={styles.glowPinDot} />
                  </View>

                  {/* Dark Navy Tag Callout */}
                  <View style={styles.darkCalloutPill}>
                    <View style={styles.darkCalloutArrow} />
                    <Text style={styles.darkCalloutText} numberOfLines={1}>
                      {calloutLabel}
                    </Text>
                  </View>
                </View>
              </Marker>
            )}
          </MapView>
        )}

        {/* 2. TOP-LEFT OVERLAY: PETA BATAS DESA CARD */}
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

        {/* 3. TOP-RIGHT OVERLAY: PILIH LAYER BUTTON */}
        <TouchableOpacity
          style={styles.layerSelectorBtn}
          onPress={() => setShowLayerModal(true)}
          activeOpacity={0.8}
        >
          <FastImage
            source={require('../../assets/img/gis_pirate-map.png')}
            style={styles.layerIcon}
            resizeMode={FastImage.resizeMode.contain}
            tintColor="#0284C7"
          />
          <Text style={styles.layerText}>Pilih Layer</Text>
          <Text style={styles.layerChevron}>⌵</Text>
        </TouchableOpacity>

        {/* 4. RIGHT CONTROLS: 4 VERTICAL FLOATING BUTTONS */}
        <View style={styles.rightControlsStack}>
          {/* A. Kompas / Arah Utara */}
          <TouchableOpacity
            style={styles.controlCircleBtn}
            onPress={() => {
              if (mapRef.current && mapRef.current.animateCamera) {
                mapRef.current.animateCamera({ heading: 0, pitch: 0 });
              }
            }}
            activeOpacity={0.75}
            accessibilityLabel="Reset Kompas Utara"
          >
            <Text style={styles.compassIcon}>🧭</Text>
          </TouchableOpacity>

          {/* B. Zoom In */}
          <TouchableOpacity
            style={styles.controlCircleBtn}
            onPress={onZoomIn}
            activeOpacity={0.75}
            accessibilityLabel="Perbesar Peta"
          >
            <Text style={styles.zoomIconText}>＋</Text>
          </TouchableOpacity>

          {/* C. Zoom Out */}
          <TouchableOpacity
            style={styles.controlCircleBtn}
            onPress={onZoomOut}
            activeOpacity={0.75}
            accessibilityLabel="Perkecil Peta"
          >
            <Text style={styles.zoomIconText}>−</Text>
          </TouchableOpacity>

          {/* D. Center to Current Location */}
          <TouchableOpacity
            style={[styles.controlCircleBtn, styles.controlCircleAccent]}
            onPress={onCenterLocation}
            activeOpacity={0.75}
            accessibilityLabel="Pusatkan ke Lokasi Saya"
          >
            <Text style={styles.targetIcon}>🎯</Text>
          </TouchableOpacity>
        </View>

        {/* 5. BOTTOM-LEFT: INTERACTIVE REGION INFO CARD */}
        <TouchableOpacity
          style={styles.bottomLeftCard}
          onPress={() => {
            if (onDetailPolygonPress) {
              onDetailPolygonPress(activePolygon || { nama: bottomCardTitle });
            }
          }}
          activeOpacity={0.88}
        >
          <View style={styles.bottomCardContent}>
            <Text style={styles.bottomCardTitle} numberOfLines={1}>
              {bottomCardTitle}
            </Text>
            <Text style={styles.bottomCardSubtitle} numberOfLines={1}>
              {bottomCardSub}
            </Text>
          </View>
          <View style={styles.chevronWrap}>
            <Text style={styles.bottomCardChevron}>›</Text>
          </View>
        </TouchableOpacity>

        {/* 6. BOTTOM-RIGHT: GIS GRAPHIC SCALE BAR */}
        <View style={styles.scaleBarContainer}>
          <Text style={styles.scaleText}>0      5      10 km</Text>
          <View style={styles.scaleRuler}>
            <View style={styles.rulerSegmentWhite} />
            <View style={styles.rulerSegmentBlack} />
            <View style={styles.rulerSegmentWhite} />
          </View>
        </View>
      </View>

      {/* MODAL PILIH LAYER BASEMAP */}
      <Modal
        visible={showLayerModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLayerModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowLayerModal(false)}
        >
          <View style={styles.layerModalCard}>
            <Text style={styles.layerModalTitle}>Tipe Peta Dasar (Basemap)</Text>

            <TouchableOpacity
              style={[
                styles.layerOptionRow,
                mapType === 'hybrid' && styles.layerOptionActive,
              ]}
              onPress={() => {
                setMapType('hybrid');
                setShowLayerModal(false);
              }}
            >
              <Text style={styles.layerOptionIcon}>🛰️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.layerOptionText}>Citra Satelit & Jalan (Hybrid)</Text>
                <Text style={styles.layerOptionSub}>Rekomendasi survei spasial batas</Text>
              </View>
              {mapType === 'hybrid' && <Text style={styles.checkIcon}>✓</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.layerOptionRow,
                mapType === 'satellite' && styles.layerOptionActive,
              ]}
              onPress={() => {
                setMapType('satellite');
                setShowLayerModal(false);
              }}
            >
              <Text style={styles.layerOptionIcon}>🌍</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.layerOptionText}>Satelit Murni</Text>
                <Text style={styles.layerOptionSub}>Foto udara resolusi tinggi</Text>
              </View>
              {mapType === 'satellite' && <Text style={styles.checkIcon}>✓</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.layerOptionRow,
                mapType === 'standard' && styles.layerOptionActive,
              ]}
              onPress={() => {
                setMapType('standard');
                setShowLayerModal(false);
              }}
            >
              <Text style={styles.layerOptionIcon}>🗺️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.layerOptionText}>Peta Jalan Vektor (Standar)</Text>
                <Text style={styles.layerOptionSub}>Hemat kuota & cepat dimuat</Text>
              </View>
              {mapType === 'standard' && <Text style={styles.checkIcon}>✓</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.layerOptionRow,
                mapType === 'terrain' && styles.layerOptionActive,
              ]}
              onPress={() => {
                setMapType('terrain');
                setShowLayerModal(false);
              }}
            >
              <Text style={styles.layerOptionIcon}>⛰️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.layerOptionText}>Kontur Medan (Terrain)</Text>
                <Text style={styles.layerOptionSub}>Elevasi topografi pegunungan</Text>
              </View>
              {mapType === 'terrain' && <Text style={styles.checkIcon}>✓</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 10,
    backgroundColor: '#F5F7FA',
  },
  mapContainer: {
    height: 310,
    backgroundColor: '#0F172A',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  mapCanvas: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38BDF8',
    marginTop: 8,
  },

  // 1. TOP-LEFT CARD
  topLeftCard: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 15,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mapIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  mapIconImg: {
    width: 18,
    height: 18,
  },
  topLeftTextCol: {
    justifyContent: 'center',
  },
  mapTitleHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  mapSubHeader: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },

  // 2. TOP-RIGHT LAYER SELECTOR
  layerSelectorBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 15,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  layerIcon: {
    width: 16,
    height: 16,
    marginRight: 6,
  },
  layerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  layerChevron: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '800',
    marginLeft: 6,
    marginTop: -1,
  },

  // 3. RIGHT VERTICAL CONTROLS
  rightControlsStack: {
    position: 'absolute',
    top: 60,
    right: 12,
    zIndex: 15,
    gap: 7,
  },
  controlCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  controlCircleAccent: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  compassIcon: {
    fontSize: 18,
  },
  zoomIconText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 22,
  },
  targetIcon: {
    fontSize: 16,
  },

  // 4. CENTER GLOWING PIN & DARK CALLOUT
  markerWithCalloutRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  glowPinCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(14, 165, 233, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowPinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#0284C7',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  darkCalloutPill: {
    backgroundColor: '#0B192C',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 5,
  },
  darkCalloutArrow: {
    position: 'absolute',
    left: -5,
    top: 8,
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#0B192C',
  },
  darkCalloutText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // 5. BOTTOM-LEFT INTERACTIVE CARD
  bottomLeftCard: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 15,
    maxWidth: '68%',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bottomCardThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 9,
    backgroundColor: '#E2E8F0',
    marginRight: 10,
  },
  bottomCardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  bottomCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  bottomCardSubtitle: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  chevronWrap: {
    paddingLeft: 6,
    paddingRight: 4,
  },
  bottomCardChevron: {
    fontSize: 18,
    color: '#94A3B8',
    fontWeight: '700',
  },

  // 6. BOTTOM-RIGHT GRAPHIC SCALE BAR
  scaleBarContainer: {
    position: 'absolute',
    bottom: 12,
    right: 14,
    alignItems: 'center',
    zIndex: 10,
  },
  scaleText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  scaleRuler: {
    flexDirection: 'row',
    width: 66,
    height: 4,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  rulerSegmentWhite: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  rulerSegmentBlack: {
    flex: 1,
    backgroundColor: '#0F172A',
  },

  // GPS User Marker
  gpsMarkerCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(2, 132, 199, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gpsMarkerInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0284C7',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  // MODAL LAYER SELECTOR
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  layerModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 8,
  },
  layerModalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
    textAlign: 'center',
  },
  layerOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  layerOptionActive: {
    backgroundColor: '#F0F9FF',
    borderColor: '#0284C7',
  },
  layerOptionIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  layerOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  layerOptionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  checkIcon: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0284C7',
    marginLeft: 8,
  },
});

export default React.memo(MapPreview);
