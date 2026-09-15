// views/home/components/RegionSummary.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * RegionSummary SIMBADA V2 (Modern Government GIS)
 * Ringkasan statistik kompak 4 metrik wilayah Kabupaten Konawe Selatan:
 * Desa, Polygon Wilayah, Terverifikasi (Peta Final), dan Kecamatan.
 */
const RegionSummary = ({
  desaCount = 351,
  polygonCount = 351,
  verifiedCount = 0,
  kecamatanCount = 25,
  isLoading = false,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.indicatorBar} />
        <Text style={styles.sectionTitle}>DATA WILAYAH</Text>
        <Text style={styles.badgeInfo}>Konawe Selatan</Text>
      </View>

      <View style={styles.gridContainer}>
        {/* 1. Total Desa */}
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{isLoading ? '...' : desaCount}</Text>
          <Text style={styles.statLabel}>Desa</Text>
        </View>

        {/* 2. Total Polygon */}
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#087FC1' }]}>
            {isLoading ? '...' : polygonCount}
          </Text>
          <Text style={styles.statLabel}>Polygon</Text>
        </View>

        {/* 3. Terverifikasi / Peta Final */}
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#16A36A' }]}>
            {isLoading ? '...' : verifiedCount}
          </Text>
          <Text style={styles.statLabel}>Disahkan</Text>
        </View>

        {/* 4. Kecamatan */}
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#0B3558' }]}>
            {isLoading ? '...' : kecamatanCount}
          </Text>
          <Text style={styles.statLabel}>Kecamatan</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E9F0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
    flex: 1,
  },
  badgeInfo: {
    fontSize: 11,
    fontWeight: '600',
    color: '#667A94',
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  gridContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#142033',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#667A94',
    textAlign: 'center',
  },
});

export default RegionSummary;
