// views/home/components/SyncStatus.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import FastImage from 'react-native-fast-image';

/**
 * SyncStatus SIMBADA V2 (Offline-First Data Synchronization)
 * Menampilkan status sinkronisasi data lapangan, jumlah antrean lokal,
 * dan tombol pemicu sinkronisasi ke server.
 */
const SyncStatus = ({
  isOnline = true,
  queueCount = 0,
  lastSyncTime = '12 September 2026, 09:14',
  onSyncPress,
}) => {
  const hasQueue = queueCount > 0;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.indicatorBar} />
        <Text style={styles.sectionTitle}>STATUS DATA & SINKRONISASI</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.mainInfoRow}>
          {/* Status Icon Indicator */}
          <View
            style={[
              styles.iconBox,
              hasQueue ? styles.iconBoxWarning : styles.iconBoxSuccess,
            ]}
          >
            <FastImage
              source={require('../../assets/img/upload.png')}
              style={styles.iconImage}
              resizeMode={FastImage.resizeMode.contain}
              tintColor={hasQueue ? '#D97706' : '#16A36A'}
            />
          </View>

          {/* Details */}
          <View style={styles.detailsCol}>
            <Text style={styles.primaryStatusText}>
              {!isOnline
                ? 'Anda sedang offline'
                : hasQueue
                ? `${queueCount} data menunggu sinkronisasi`
                : 'Semua data telah tersinkron'}
            </Text>
            <Text style={styles.subStatusText}>
              {hasQueue
                ? 'Data survei tersimpan aman di penyimpanan lokal'
                : 'Data spasial lokal sesuai dengan basis data server'}
            </Text>
            <Text style={styles.timestampText}>
              Terakhir sinkron: {lastSyncTime}
            </Text>
          </View>
        </View>

        {/* Sync Button */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.syncButton,
              (!isOnline && !hasQueue) && styles.syncButtonDisabled,
            ]}
            onPress={onSyncPress}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Sinkronkan data offline"
          >
            <Text style={styles.syncButtonText}>
              {hasQueue ? 'Sinkronkan Sekarang' : 'Periksa Pembaruan'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  indicatorBar: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: '#087FC1',
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0B3558',
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E9F0',
  },
  mainInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  iconBoxSuccess: {
    backgroundColor: '#ECFDF5',
  },
  iconBoxWarning: {
    backgroundColor: '#FFFBEB',
  },
  iconImage: {
    width: 20,
    height: 20,
  },
  detailsCol: {
    flex: 1,
  },
  primaryStatusText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#142033',
    marginBottom: 2,
  },
  subStatusText: {
    fontSize: 11,
    color: '#667A94',
    lineHeight: 16,
    marginBottom: 4,
  },
  timestampText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  actionRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  syncButton: {
    backgroundColor: '#087FC1',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default SyncStatus;
