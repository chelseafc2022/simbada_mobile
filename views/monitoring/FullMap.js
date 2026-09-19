// FullMap.js
import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Modal, Dimensions } from 'react-native';
import MapView, { Polygon, Polyline } from 'react-native-maps';
import { useRoute, useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const FullMap = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const mapRef = useRef(null);

  const { petaPengajuan = [], petaDasar = [], region, mapType: initialMapType } = route.params || {};
  const [mapType, setMapType] = useState(initialMapType || 'hybrid');
  const [showLayerModal, setShowLayerModal] = useState(false);

  // Zoom controls
  const handleZoomIn = async () => {
    if (!mapRef.current) return;
    try {
      const camera = await mapRef.current.getCamera();
      if (camera) {
        camera.zoom = (camera.zoom || 15) + 1;
        mapRef.current.animateCamera(camera, { duration: 300 });
      }
    } catch (e) {}
  };

  const handleZoomOut = async () => {
    if (!mapRef.current) return;
    try {
      const camera = await mapRef.current.getCamera();
      if (camera) {
        camera.zoom = Math.max(1, (camera.zoom || 15) - 1);
        mapRef.current.animateCamera(camera, { duration: 300 });
      }
    } catch (e) {}
  };

  const handleResetCenter = () => {
    if (!mapRef.current || !region) return;
    mapRef.current.animateToRegion(region, 500);
  };

  return (
    <View style={styles.container}>
      {/* Map View */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        mapType={mapType}
      >
        {/* Gambar polygon atau polyline pengajuan */}
        {petaPengajuan.map((item, index) => {
          const key = `pengajuan-${index}`;
          return item.tipe === 'polyline' ? (
            <Polyline
              key={key}
              coordinates={item.coordinates}
              strokeColor="#0284C7"
              strokeWidth={3}
            />
          ) : (
            <Polygon
              key={key}
              coordinates={item.coordinates}
              strokeColor="#0284C7"
              fillColor="rgba(2, 132, 199, 0.35)"
            />
          );
        })}

        {/* Gambar polygon untuk peta dasar */}
        {petaDasar.map((item, index) => (
          <Polygon
            key={`dasar-${index}`}
            coordinates={item.coordinates}
            strokeColor="#EF4444"
            fillColor="rgba(239, 68, 68, 0.25)"
          />
        ))}
      </MapView>

      {/* Top Bar Actions */}
      <View style={styles.topBar}>
        {/* Tombol kembali */}
        <TouchableOpacity style={styles.circleBtn} onPress={() => navigation.goBack()}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>✕</Text>
        </TouchableOpacity>

        {/* Tombol Layer Selector */}
        <TouchableOpacity style={styles.layerSelectorBtn} onPress={() => setShowLayerModal(true)}>
          <Text style={styles.layerSelectorText}>
            {mapType === 'hybrid' ? '🛰️ Hybrid' : mapType === 'satellite' ? '🌍 Satelit' : mapType === 'terrain' ? '⛰️ Terrain' : '🗺️ Standar'} ⌵
          </Text>
        </TouchableOpacity>
      </View>

      {/* Floating Zoom & Center Controls */}
      <View style={styles.floatingControls}>
        <TouchableOpacity style={styles.controlBtn} onPress={handleZoomIn} activeOpacity={0.75}>
          <Text style={styles.controlBtnText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={handleZoomOut} activeOpacity={0.75}>
          <Text style={styles.controlBtnText}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={handleResetCenter} activeOpacity={0.75}>
          <Text style={{ fontSize: 15 }}>🎯</Text>
        </TouchableOpacity>
      </View>

      {/* Modal Pilihan Layer Basemap */}
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
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🗺️ Pilih Tipe Layer Peta</Text>
              <TouchableOpacity onPress={() => setShowLayerModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: 18, color: '#64748B', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.layerRow, mapType === 'hybrid' && styles.layerRowActive]}
              onPress={() => { setMapType('hybrid'); setShowLayerModal(false); }}
            >
              <Text style={styles.layerIcon}>🛰️</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.layerName, mapType === 'hybrid' && styles.layerTextActive]}>Citra Satelit & Jalan (Hybrid)</Text>
                <Text style={styles.layerDesc}>Foto satelit lengkap dengan label nama jalan & batas wilayah</Text>
              </View>
              {mapType === 'hybrid' && <Text style={styles.checkIcon}>✓</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.layerRow, mapType === 'satellite' && styles.layerRowActive]}
              onPress={() => { setMapType('satellite'); setShowLayerModal(false); }}
            >
              <Text style={styles.layerIcon}>🌍</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.layerName, mapType === 'satellite' && styles.layerTextActive]}>Citra Satelit Murni</Text>
                <Text style={styles.layerDesc}>Foto udara resolusi tinggi tanpa overlay teks/vektor</Text>
              </View>
              {mapType === 'satellite' && <Text style={styles.checkIcon}>✓</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.layerRow, mapType === 'standard' && styles.layerRowActive]}
              onPress={() => { setMapType('standard'); setShowLayerModal(false); }}
            >
              <Text style={styles.layerIcon}>🗺️</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.layerName, mapType === 'standard' && styles.layerTextActive]}>Peta Jalan Vektor (Standar)</Text>
                <Text style={styles.layerDesc}>Peta skematik jalan Google Maps, hemat kuota data</Text>
              </View>
              {mapType === 'standard' && <Text style={styles.checkIcon}>✓</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.layerRow, mapType === 'terrain' && styles.layerRowActive]}
              onPress={() => { setMapType('terrain'); setShowLayerModal(false); }}
            >
              <Text style={styles.layerIcon}>⛰️</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.layerName, mapType === 'terrain' && styles.layerTextActive]}>Kontur Medan (Terrain)</Text>
                <Text style={styles.layerDesc}>Menampilkan kontur elevasi, pegunungan, dan perbukitan</Text>
              </View>
              {mapType === 'terrain' && <Text style={styles.checkIcon}>✓</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default FullMap;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  map: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 40,
    left: 15,
    right: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 999,
  },
  circleBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  layerSelectorBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  layerSelectorText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0284C7',
  },
  floatingControls: {
    position: 'absolute',
    right: 16,
    bottom: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 10,
    padding: 4,
    elevation: 6,
    alignItems: 'center',
  },
  controlBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E2E8F0',
  },
  controlBtnText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#334155',
    lineHeight: 22,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  layerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  layerRowActive: {
    backgroundColor: '#F0F9FF',
    borderColor: '#0284C7',
  },
  layerIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  layerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  layerTextActive: {
    color: '#0284C7',
    fontWeight: 'bold',
  },
  layerDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  checkIcon: {
    fontSize: 16,
    color: '#0284C7',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
