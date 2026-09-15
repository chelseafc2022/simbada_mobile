// views/home/components/PrimarySurveyAction.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import FastImage from 'react-native-fast-image';

/**
 * PrimarySurveyAction SIMBADA V2 (Action-First)
 * Tombol utama paling menonjol "MULAI SURVEI" berlatar Government Blue (#087FC1).
 * Mengarahkan petugas lapangan langsung ke perekaman jejak, titik patok, & batas desa.
 */
const PrimarySurveyAction = ({ onPress }) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel="Mulai Survei Batas Desa"
    >
      <View style={styles.contentRow}>
        {/* Icon Pin Lokasi Lapangan */}
        <View style={styles.iconCircle}>
          <FastImage
            source={require('../../assets/img/titik.png')}
            style={styles.actionIcon}
            resizeMode={FastImage.resizeMode.contain}
            tintColor="#FFFFFF"
          />
        </View>

        {/* Text Container */}
        <View style={styles.textContainer}>
          <View style={styles.badgeRow}>
            <Text style={styles.badgeLive}>SURVEI LAPANGAN</Text>
          </View>
          <Text style={styles.mainTitle}>Mulai Survei</Text>
          <Text style={styles.subtitle}>
            Rekam jejak GPS, titik patok batas & polygon desa
          </Text>
        </View>

        {/* Chevron Arrow */}
        <View style={styles.arrowCircle}>
          <Text style={styles.arrowText}>›</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: '#087FC1', // Government Blue
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#087FC1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  actionIcon: {
    width: 24,
    height: 24,
  },
  textContainer: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  badgeLive: {
    fontSize: 9,
    fontWeight: '800',
    color: '#BAE6FD',
    letterSpacing: 0.8,
  },
  mainTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 11,
    color: '#E0F2FE',
    fontWeight: '500',
    marginTop: 1,
  },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  arrowText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '700',
    marginTop: -2,
    marginLeft: 2,
  },
});

export default PrimarySurveyAction;
