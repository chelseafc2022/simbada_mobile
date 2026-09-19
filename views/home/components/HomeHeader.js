// views/home/components/HomeHeader.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import FastImage from 'react-native-fast-image';

/**
 * Header SIMBADA V2 (Compact, Modern Government GIS)
 * Menampilkan nama sistem, kabupaten, logo resmi, dan tombol aksi Notifikasi & Profil.
 */
const HomeHeader = ({ notificationCount = 0, onNotificationPress, onProfilePress }) => {
  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        {/* Logo Kabupaten Konawe Selatan / SIMBADA */}
        <View style={styles.logoContainer}>
          <FastImage
            source={require('../../assets/img/logo.png')}
            style={styles.logoImage}
            resizeMode={FastImage.resizeMode.contain}
          />
        </View>

        {/* Brand & Region Title */}
        <View style={styles.titleContainer}>
          <View style={styles.tagRow}>
            <View style={styles.tagDot} />
            <Text style={styles.tagText}>SIMBADA MOBILE</Text>
          </View>
          <Text style={styles.appName}>Sistem Informasi Batas Desa</Text>
          <Text style={styles.regionText}>Kabupaten Konawe Selatan</Text>
        </View>
      </View>

      {/* Action Buttons (Notification & Profile) */}
      <View style={styles.actionsRow}>
        {/* Notification Bell */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onNotificationPress}
          activeOpacity={0.7}
          accessibilityLabel="Daftar Notifikasi"
        >
          <FastImage
            source={require('../../assets/img/lampiran-icon.png')}
            style={styles.bellIcon}
            resizeMode={FastImage.resizeMode.contain}
            tintColor="#142033"
          />
          {notificationCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>
                {notificationCount > 9 ? '9+' : notificationCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* User Profile */}
        <TouchableOpacity
          style={styles.profileBtn}
          onPress={onProfilePress}
          activeOpacity={0.7}
          accessibilityLabel="Profil Pengguna"
        >
          <FastImage
            source={require('../../assets/img/user.png')}
            style={styles.profileIcon}
            resizeMode={FastImage.resizeMode.contain}
            tintColor="#087FC1"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E9F0',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  logoContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  logoImage: {
    width: 40,
    height: 40,
  },
  titleContainer: {
    flex: 1,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  tagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#087FC1',
    marginRight: 5,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#087FC1',
    letterSpacing: 0.8,
  },
  appName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#142033',
    lineHeight: 16,
  },
  regionText: {
    fontSize: 11,
    color: '#667A94',
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F5F7FA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    marginRight: 8,
  },
  bellIcon: {
    width: 18,
    height: 18,
  },
  notifBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#DC4C4C',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  profileBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EBF6FC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  profileIcon: {
    width: 18,
    height: 18,
  },
});

export default HomeHeader;
