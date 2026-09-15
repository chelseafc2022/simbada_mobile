// views/home/components/QuickActions.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import FastImage from 'react-native-fast-image';

/**
 * QuickActions SIMBADA V2 (Field Survey Quick Access)
 * 2x2 grid menu lapangan: Tracking GPS, Navigasi Patok, Tambah Titik (Placemark), dan Peta Offline.
 */
const QuickActions = ({
  onTrackingGpsPress,
  onNavigasiPress,
  onTambahTitikPress,
  onPetaOfflinePress,
}) => {
  const actions = [
    {
      id: 'tracking',
      title: 'Tracking GPS',
      subtitle: 'Rekam Jejak',
      icon: require('../../assets/img/titik.png'),
      iconBg: '#EFF6FF',
      iconTint: '#087FC1',
      onPress: onTrackingGpsPress,
    },
    {
      id: 'navigasi',
      title: 'Navigasi',
      subtitle: 'Arah ke Lokasi',
      icon: require('../../assets/img/map.png'),
      iconBg: '#F0FDF4',
      iconTint: '#16A36A',
      onPress: onNavigasiPress,
    },
    {
      id: 'titik',
      title: 'Tambah Titik',
      subtitle: 'Placemark Patok',
      icon: require('../../assets/img/tanah.png'),
      iconBg: '#FFFBEB',
      iconTint: '#D97706',
      onPress: onTambahTitikPress,
    },
    {
      id: 'offline',
      title: 'Peta Offline',
      subtitle: 'Unduh Layer',
      icon: require('../../assets/img/gis_pirate-map.png'),
      iconBg: '#FAF5FF',
      iconTint: '#7C3AED',
      onPress: onPetaOfflinePress,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.indicatorBar} />
        <Text style={styles.sectionTitle}>AKSI CEPAT</Text>
      </View>

      <View style={styles.grid}>
        {actions.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.card}
            onPress={item.onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${item.title} - ${item.subtitle}`}
          >
            <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
              <FastImage
                source={item.icon}
                style={styles.iconImage}
                resizeMode={FastImage.resizeMode.contain}
                tintColor={item.iconTint}
              />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
            </View>
          </TouchableOpacity>
        ))}
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  card: {
    width: '48.2%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E9F0',
    minHeight: 64,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  iconImage: {
    width: 20,
    height: 20,
  },
  textWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#142033',
  },
  cardSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#667A94',
    marginTop: 2,
  },
});

export default QuickActions;
