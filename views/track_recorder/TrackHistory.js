/**
 * TrackHistory.js — Modul 3: Riwayat Trek Lapangan
 * Daftar semua trek yang telah selesai direkam.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, Modal, ScrollView,
} from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { useFocusEffect } from '@react-navigation/native';
import FastImage from 'react-native-fast-image';
import moment from 'moment';
import TrackDB from '../library/TrackDB';

const fmtDist = (m) => m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m || 0)} m`;
const fmtDur = (s) => {
  if (!s) return '0m';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
};

const TrackItem = React.memo(({ item, onPress, onDelete }) => (
  <TouchableOpacity
    style={styles.card}
    onPress={() => onPress(item)}
    onLongPress={() => onDelete(item)}
    activeOpacity={0.8}
  >
    <View style={styles.cardLeft}>
      <Text style={styles.cardTitle} numberOfLines={1}>{item.label}</Text>
      <Text style={styles.cardDate}>{moment(item.startTime).format('DD MMM YYYY, HH:mm')}</Text>
    </View>
    <View style={styles.cardRight}>
      <Text style={styles.cardDist}>{fmtDist(item.metrics?.totalDistance)}</Text>
      <Text style={styles.cardDur}>{fmtDur(item.metrics?.duration)}</Text>
    </View>
    <TouchableOpacity
      style={styles.deleteCardBtn}
      onPress={(e) => {
        e.stopPropagation?.();
        onDelete(item);
      }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Text style={styles.deleteCardIcon}>🗑️</Text>
    </TouchableOpacity>
  </TouchableOpacity>
));

const TrackHistory = ({ navigation }) => {
  const [tracks, setTracks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useFocusEffect(useCallback(() => {
    TrackDB.getAllTracks().then(setTracks);
  }, []));

  const handleDelete = (item) => {
    Alert.alert('Hapus Trek?', `"${item.label}" akan dihapus permanen.`, [
      { text: 'Hapus', style: 'destructive', onPress: async () => {
        await TrackDB.deleteTrack(item.id);
        setTracks(prev => prev.filter(t => t.id !== item.id));
      }},
      { text: 'Batal', style: 'cancel' },
    ]);
  };

  const handleDeleteAll = () => {
    Alert.alert(
      'Hapus Semua Riwayat?',
      `Seluruh (${tracks.length}) data trek survei akan dihapus permanen.`,
      [
        {
          text: 'Hapus Semua',
          style: 'destructive',
          onPress: async () => {
            for (const t of tracks) {
              await TrackDB.deleteTrack(t.id);
            }
            setTracks([]);
          },
        },
        { text: 'Batal', style: 'cancel' },
      ]
    );
  };

  const handlePress = (item) => {
    setSelected(item);
    setModalVisible(true);
  };

  const mapRegion = useMemo(() => {
    if (!selected?.waypoints?.length) return null;
    const lats = selected.waypoints.map(w => w.lat);
    const lons = selected.waypoints.map(w => w.lon);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.max(maxLat - minLat, 0.005) * 1.5,
      longitudeDelta: Math.max(maxLon - minLon, 0.005) * 1.5,
    };
  }, [selected]);

  const previewCoords = useMemo(() =>
    (selected?.waypoints || []).map(w => ({ latitude: w.lat, longitude: w.lon })),
  [selected]);

  return (
    <View style={styles.screen}>
      {/* Header — Style sama dengan NavigasiKoordinat */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <FastImage
            style={{ width: 20, height: 20 }}
            source={require('../assets/img/chevron-left.png')}
            resizeMode={FastImage.resizeMode.contain}
          />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Riwayat Trek</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.count}>{tracks.length} trek</Text>
        </View>
      </View>

      {tracks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🛤</Text>
          <Text style={styles.emptyText}>Belum ada trek yang direkam</Text>
        </View>
      ) : (
        <>
          <View style={styles.listHintRow}>
            <Text style={styles.listHintText}>💡 Ketuk untuk detail atau tekan 🗑️ untuk hapus</Text>
            <TouchableOpacity onPress={handleDeleteAll}>
              <Text style={styles.clearAllLink}>Hapus Semua</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={tracks}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TrackItem item={item} onPress={handlePress} onDelete={handleDelete} />
            )}
            contentContainerStyle={{ padding: 16 }}
            getItemLayout={(_, index) => ({ length: 80, offset: 80 * index, index })}
            maxToRenderPerBatch={15}
            windowSize={5}
            removeClippedSubviews
          />
        </>
      )}

      {/* Modal Detail */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.backButton}>
              <FastImage
                style={{ width: 20, height: 20 }}
                source={require('../assets/img/chevron-left.png')}
                resizeMode={FastImage.resizeMode.contain}
              />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle} numberOfLines={1}>{selected?.label}</Text>
            </View>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.headerRight}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {mapRegion && previewCoords.length > 1 && (
            <MapView style={styles.modalMap} region={mapRegion} scrollEnabled={false}>
              <Polyline coordinates={previewCoords} strokeColor="#EF4444" strokeWidth={3} geodesic />
            </MapView>
          )}

          <ScrollView style={styles.modalBody}>
            <View style={styles.statGrid}>
              {[
                { l: 'Jarak Total', v: fmtDist(selected?.metrics?.totalDistance) },
                { l: 'Durasi', v: fmtDur(selected?.metrics?.duration) },
                { l: 'Kec. Rata-Rata', v: `${(selected?.metrics?.avgSpeed || 0).toFixed(1)} km/h` },
                { l: 'Kec. Maksimum', v: `${(selected?.metrics?.maxSpeed || 0).toFixed(1)} km/h` },
                { l: 'Titik Waypoint', v: `${selected?.waypoints?.length || 0} titik` },
                { l: 'Mulai', v: moment(selected?.startTime).format('DD MMM YYYY HH:mm') },
              ].map((s, i) => (
                <View key={i} style={styles.statCard}>
                  <Text style={styles.statLabel}>{s.l}</Text>
                  <Text style={styles.statValue}>{s.v}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={styles.exportBtn}
              onPress={() => { setModalVisible(false); navigation.navigate('EksporData'); }}
            >
              <Text style={styles.exportBtnText}>📤 Ekspor Trek Ini</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteModalBtn}
              onPress={() => {
                const target = selected;
                setModalVisible(false);
                setTimeout(() => handleDelete(target), 200);
              }}
            >
              <Text style={styles.deleteModalBtnText}>🗑 Hapus Trek Ini</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#fff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  backButton: { flex: 1, justifyContent: 'center' },
  headerCenter: { flex: 3, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#208DC0' },
  headerRight: { flex: 1, alignItems: 'flex-end', justifyContent: 'center' },
  count: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginBottom: 10, elevation: 3,
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6,
  },
  cardLeft: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  cardDate: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
  cardRight: { alignItems: 'flex-end', marginRight: 8 },
  cardDist: { fontSize: 16, fontWeight: '800', color: '#22C55E' },
  cardDur: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  cardArrow: { color: '#CBD5E1', fontSize: 20 },
  deleteCardBtn: {
    padding: 7,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteCardIcon: {
    fontSize: 14,
  },
  listHintRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 2,
  },
  listHintText: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
  },
  clearAllLink: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '700',
    marginLeft: 8,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 60, marginBottom: 16 },
  emptyText: { color: '#94A3B8', fontSize: 16 },
  modal: { flex: 1, backgroundColor: '#F8FAFC' },
  modalHeader: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#fff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  modalClose: { color: '#E74C3C', fontSize: 18, fontWeight: 'bold' },
  modalMap: { height: 220 },
  modalBody: { flex: 1, padding: 16 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statCard: {
    width: '48%', margin: '1%', backgroundColor: '#fff',
    borderRadius: 16, padding: 14,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 6,
  },
  statLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' },
  statValue: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  exportBtn: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: '#208DC0',
    borderRadius: 16,
    padding: 15,
    alignItems: 'center',
  },
  exportBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  deleteModalBtn: {
    marginHorizontal: 16,
    marginBottom: 30,
    marginTop: 4,
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
    padding: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  deleteModalBtnText: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 14,
  },
});

export default TrackHistory;
