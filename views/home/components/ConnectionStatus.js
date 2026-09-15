// views/home/components/ConnectionStatus.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * ConnectionStatus SIMBADA V2
 * Status indicator kecil & modern untuk kondisi Jaringan (Online/Offline) dan Sensor GPS.
 */
const ConnectionStatus = ({ isOnline = true, isGpsActive = false }) => {
  return (
    <View style={styles.container}>
      {/* Network Status */}
      <View
        style={[
          styles.statusPill,
          isOnline ? styles.onlinePill : styles.offlinePill,
        ]}
      >
        <View
          style={[
            styles.dot,
            isOnline ? styles.dotOnline : styles.dotOffline,
          ]}
        />
        <Text
          style={[
            styles.statusText,
            isOnline ? styles.textOnline : styles.textOffline,
          ]}
        >
          {isOnline ? 'Online' : 'Offline'}
        </Text>
      </View>

      {/* GPS Status */}
      <View
        style={[
          styles.statusPill,
          isGpsActive ? styles.gpsActivePill : styles.gpsInactivePill,
        ]}
      >
        <View
          style={[
            styles.dot,
            isGpsActive ? styles.dotGpsActive : styles.dotGpsInactive,
          ]}
        />
        <Text
          style={[
            styles.statusText,
            isGpsActive ? styles.textGpsActive : styles.textGpsInactive,
          ]}
        >
          {isGpsActive ? 'GPS Aktif' : 'GPS Tidak Aktif'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#F5F7FA',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Online / Offline styles
  onlinePill: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  dotOnline: {
    backgroundColor: '#16A36A',
  },
  textOnline: {
    color: '#065F46',
  },

  offlinePill: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  dotOffline: {
    backgroundColor: '#F59E0B',
  },
  textOffline: {
    color: '#92400E',
  },

  // GPS styles
  gpsActivePill: {
    backgroundColor: '#EBF6FC',
    borderColor: '#BAE6FD',
  },
  dotGpsActive: {
    backgroundColor: '#087FC1',
  },
  textGpsActive: {
    color: '#075985',
  },

  gpsInactivePill: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  dotGpsInactive: {
    backgroundColor: '#DC4C4C',
  },
  textGpsInactive: {
    color: '#991B1B',
  },
});

export default ConnectionStatus;
