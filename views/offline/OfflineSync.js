/**
 * OfflineSync.js
 * Screen untuk melihat dan manage antrian data offline
 * 
 * Fitur:
 * - List data yang belum ter-sync
 * - Status indicator per item
 * - Manual sync trigger
 * - Delete item dari antrian
 * - Connection status bar
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  Alert, ActivityIndicator, ImageBackground, RefreshControl,
  Modal, ScrollView
} from 'react-native';
import MapView, { Polygon, Polyline, Marker } from 'react-native-maps';
import FastImage from 'react-native-fast-image';
import { useSelector, useDispatch } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import NetInfo from '@react-native-community/netinfo';
import AppHeader from '../components/AppHeader';
import OfflineManager from '../library/OfflineManager';
import moment from 'moment';

const OfflineSync = ({ navigation }) => {
  const dispatch = useDispatch();
  const IS_ONLINE = useSelector(state => state.IS_ONLINE);

  // State
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, syncing: 0, failed: 0, synced: 0 });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Load data saat screen focus
  useFocusEffect(
    useCallback(() => {
      loadQueue();
      checkConnection();
    }, [])
  );

  // NetInfo listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  const checkConnection = async () => {
    const state = await NetInfo.fetch();
    setIsOnline(state.isConnected);
  };

  const loadQueue = async () => {
    const data = await OfflineManager.getQueue();
    const queueStats = await OfflineManager.getQueueStats();
    setQueue(data);
    setStats(queueStats);
    dispatch({ type: 'SET_OFFLINE_QUEUE_COUNT', payload: queueStats.pending + queueStats.failed });
  };

  /**
   * Manual sync semua item
   */
  const handleSyncAll = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Tidak ada koneksi internet. Coba lagi nanti.');
      return;
    }

    const pendingItems = queue.filter(i => i.status === 'pending' || i.status === 'failed');
    if (pendingItems.length === 0) {
      Alert.alert('Info', 'Tidak ada data yang perlu disinkronkan.');
      return;
    }

    setIsSyncing(true);
    
    const result = await OfflineManager.syncAll((current, total) => {
      console.log(`[OfflineSync] Progress: ${current}/${total}`);
    });

    setIsSyncing(false);
    await loadQueue();

    Alert.alert(
      'Sinkronisasi Selesai',
      `✅ Berhasil: ${result.synced}\n❌ Gagal: ${result.failed}\n📊 Total: ${result.total}`
    );
  };

  /**
   * Hapus item dari queue
   */
  const handleDeleteItem = (item) => {
    Alert.alert(
      'Hapus Data',
      `Hapus data "${item.data?.nama || 'tanpa nama'}" dari antrian?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            await OfflineManager.removeFromQueue(item.id);
            await loadQueue();
          },
        },
      ]
    );
  };

  /**
   * Sync satu item
   */
  const handleSyncItem = async (item) => {
    if (!isOnline) {
      Alert.alert('Offline', 'Tidak ada koneksi internet.');
      return;
    }

    const success = await OfflineManager.syncItem(item);
    await loadQueue();

    if (success) {
      Alert.alert('Berhasil', 'Data berhasil disinkronkan!');
    } else {
      Alert.alert('Gagal', 'Gagal mengirim data. Coba lagi nanti.');
    }
  };

  /**
   * Lihat detail offline
   */
  const handleViewDetails = (item) => {
    setSelectedItem(item);
    setModalVisible(true);
  };

  /**
   * Refresh handler
   */
  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadQueue();
    await checkConnection();
    setIsRefreshing(false);
  };

  /**
   * Get status icon & color
   */
  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending':
        return { icon: '⏳', color: '#FF9800', label: 'Menunggu' };
      case 'syncing':
        return { icon: '🔄', color: '#2196F3', label: 'Sinkron...' };
      case 'failed':
        return { icon: '❌', color: '#F44336', label: 'Gagal' };
      case 'synced':
        return { icon: '✅', color: '#4CAF50', label: 'Terkirim' };
      default:
        return { icon: '❓', color: '#9E9E9E', label: status };
    }
  };

  /**
   * Render item
   */
  const renderItem = ({ item, index }) => {
    const statusInfo = getStatusInfo(item.status);
    const createdDate = moment(item.createdAt).format('DD/MM/YYYY HH:mm');

    return (
      <View style={styles.queueItem}>
        <View style={styles.queueItemLeft}>
          <Text style={styles.queueItemNumber}>{index + 1}</Text>
        </View>

        <View style={styles.queueItemCenter}>
          <Text style={styles.queueItemTitle} numberOfLines={1}>
            {item.data?.nama || item.data?.nik || 'Data Pengajuan'}
          </Text>
          <Text style={styles.queueItemSubtitle}>
            {item.data?.nama_des_kel || 'Desa tidak diketahui'}
          </Text>
          <Text style={styles.queueItemDate}>
            {createdDate} • Retry: {item.retryCount}
          </Text>
          {item.errorMessage && (
            <Text style={styles.queueItemError} numberOfLines={2}>
              ⚠️ {item.errorMessage}
            </Text>
          )}
        </View>

        <View style={styles.queueItemRight}>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
            <Text style={{ fontSize: 14 }}>{statusInfo.icon}</Text>
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>

          <View style={styles.itemActions}>
            <TouchableOpacity
              style={styles.detailItemButton}
              onPress={() => handleViewDetails(item)}
            >
              <Text style={styles.detailItemButtonText}>👁</Text>
            </TouchableOpacity>

            {(item.status === 'pending' || item.status === 'failed') && (
              <TouchableOpacity
                style={styles.syncItemButton}
                onPress={() => handleSyncItem(item)}
              >
                <Text style={styles.syncItemButtonText}>🔄</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.deleteItemButton}
              onPress={() => handleDeleteItem(item)}
            >
              <Text style={styles.deleteItemButtonText}>🗑</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Header Reusable */}
      <AppHeader
        title="Sinkronisasi Offline"
        navigation={navigation}
      />

      {/* Connection Status Banner */}
      <View style={[
        styles.connectionBanner,
        { backgroundColor: isOnline ? '#E8F5E9' : '#FFEBEE' }
      ]}>
        <View style={[
          styles.connectionDot,
          { backgroundColor: isOnline ? '#4CAF50' : '#F44336' }
        ]} />
        <Text style={[
          styles.connectionText,
          { color: isOnline ? '#2E7D32' : '#C62828' }
        ]}>
          {isOnline ? '🌐 Online — Data siap disinkronkan' : '📴 Offline — Data disimpan lokal'}
        </Text>
      </View>

      <ImageBackground
        source={require('../assets/img/bgbg.jpg')}
        style={{ flex: 1, width: '100%' }}
        resizeMode="cover"
      >
        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#FF9800' }]}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Menunggu</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#F44336' }]}>{stats.failed}</Text>
            <Text style={styles.statLabel}>Gagal</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#4CAF50' }]}>{stats.synced}</Text>
            <Text style={styles.statLabel}>Terkirim</Text>
          </View>
        </View>

        {/* Sync All Button */}
        {(stats.pending > 0 || stats.failed > 0) && (
          <TouchableOpacity
            style={[
              styles.syncAllButton,
              !isOnline && styles.syncAllButtonDisabled,
            ]}
            onPress={handleSyncAll}
            disabled={isSyncing || !isOnline}
          >
            {isSyncing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.syncAllButtonText}>
                🔄 Sinkronkan Semua ({stats.pending + stats.failed} item)
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Queue List */}
        <FlatList
          data={queue}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 20 }}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#208DC0']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>Tidak ada data di antrian offline</Text>
              <Text style={styles.emptySubtext}>
                Data yang dikirim saat offline akan muncul di sini
              </Text>
            </View>
          }
        />
      </ImageBackground>

      {/* Modal Detail Usulan */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detail Usulan Offline</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 5 }}>
                <Text style={styles.modalCloseBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 15, paddingBottom: 30 }}>
              {selectedItem && (() => {
                const d = selectedItem.data;
                const coords = Array.isArray(d?.lokasi) ? d.lokasi : [];
                return (
                  <View style={{ paddingBottom: 30 }}>
                    <Text style={styles.detailLabel}>Nama Pemohon: <Text style={styles.detailValue}>{d?.nama || '-'}</Text></Text>
                    <Text style={styles.detailLabel}>NIK: <Text style={styles.detailValue}>{d?.nik || '-'}</Text></Text>
                    {d?.nama_kec && d.nama_kec !== '-' && <Text style={styles.detailLabel}>Kecamatan: <Text style={styles.detailValue}>{d.nama_kec}</Text></Text>}
                    <Text style={styles.detailLabel}>Desa: <Text style={styles.detailValue}>{d?.nama_des_kel || '-'}</Text></Text>
                    <Text style={styles.detailLabel}>RT/RW: <Text style={styles.detailValue}>{d?.rwrt || '-'}</Text></Text>
                    <Text style={styles.detailLabel}>Alamat: <Text style={styles.detailValue}>{d?.alamat || '-'}</Text></Text>
                    
                    <Text style={[styles.detailLabel, { marginTop: 15 }]}>
                      Jumlah Titik Koordinat: <Text style={styles.detailValue}>{coords.length}</Text>
                    </Text>

                    {coords.length > 0 && (
                      <View style={styles.mapPreviewContainer}>
                        <MapView
                          style={{ flex: 1 }}
                          provider="google"
                          initialRegion={{
                            latitude: coords[0].latitude,
                            longitude: coords[0].longitude,
                            latitudeDelta: 0.01,
                            longitudeDelta: 0.01,
                          }}
                        >
                          {(!d.tipe || d.tipe === 'polygon') && coords.length >= 3 && (
                            <Polygon
                              coordinates={coords}
                              strokeColor="#EF4444"
                              fillColor="rgba(239, 68, 68, 0.2)"
                              strokeWidth={2}
                            />
                          )}
                          {d.tipe === 'polyline' && coords.length >= 2 && (
                            <Polyline
                              coordinates={coords}
                              strokeColor="#3B82F6"
                              strokeWidth={3}
                            />
                          )}
                          {coords.map((c, i) => (
                            <Marker key={i} coordinate={c} />
                          ))}
                        </MapView>
                      </View>
                    )}
                  </View>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  connectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  connectionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    margin: 15,
    padding: 15,
    borderRadius: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#208DC0',
  },
  statLabel: {
    fontSize: 10,
    color: '#98A9B9',
    fontWeight: '600',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E0E8EF',
  },
  syncAllButton: {
    backgroundColor: '#208DC0',
    marginHorizontal: 15,
    marginBottom: 10,
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: 'center',
    elevation: 3,
  },
  syncAllButtonDisabled: {
    backgroundColor: '#B0BEC5',
  },
  syncAllButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  queueItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  queueItemLeft: {
    width: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  queueItemNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#208DC0',
  },
  queueItemCenter: {
    flex: 1,
    paddingHorizontal: 10,
  },
  queueItemTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  queueItemSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  queueItemDate: {
    fontSize: 10,
    color: '#98A9B9',
    marginTop: 3,
  },
  queueItemError: {
    fontSize: 10,
    color: '#F44336',
    marginTop: 3,
    fontStyle: 'italic',
  },
  queueItemRight: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 5,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 3,
  },
  itemActions: {
    flexDirection: 'row',
  },
  detailItemButton: {
    padding: 5,
    marginRight: 5,
  },
  detailItemButtonText: {
    fontSize: 16,
  },
  syncItemButton: {
    padding: 5,
  },
  syncItemButtonText: {
    fontSize: 16,
  },
  deleteItemButton: {
    padding: 5,
    marginLeft: 5,
  },
  deleteItemButtonText: {
    fontSize: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyIcon: {
    fontSize: 50,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#208DC0',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#98A9B9',
    marginTop: 5,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 15,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#F8FAFC',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalCloseBtn: {
    fontSize: 20,
    color: '#64748B',
    fontWeight: 'bold',
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 6,
  },
  detailValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  mapPreviewContainer: {
    height: 300,
    marginTop: 10,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
});

export default OfflineSync;
