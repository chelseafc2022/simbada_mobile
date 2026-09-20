import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';
import FastImage from 'react-native-fast-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ================================================================
// KOMPONEN BOTTOM NAVIGATION (TabBar)
// Sesuai Spesifikasi Blueprint Bagian 1.8.A & Bagian 4
// ================================================================
const TabBar = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const currentRoute = route.name;
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 0);

  const NOTIFICATION_COUNT = useSelector((state) => state.NOTIFICATION_COUNT);
  const IS_ONLINE = useSelector((state) => state.IS_ONLINE);
  const OFFLINE_QUEUE_COUNT = useSelector((state) => state.OFFLINE_QUEUE_COUNT);

  const isActive = (screenName) => currentRoute === screenName;

  // Token Warna Design System Geo-Sapphire & Emerald Field
  const getTintColor = (screenName) => (isActive(screenName) ? '#0284C7' : '#94A3B8');

  return (
    <View style={[
      tabStyles.container,
      {
        height: 65 + bottomInset,
        paddingBottom: bottomInset > 0 ? bottomInset : 0,
      }
    ]}>
      {/* Indikator Mode Offline di tengah atas TabBar */}
      {IS_ONLINE === false && <View style={tabStyles.offlineDot} />}

      {/* 1. Tab Beranda */}
      <TouchableOpacity
        style={tabStyles.navCol}
        onPress={() => navigation.navigate('Home')}
        activeOpacity={0.8}
      >
        <FastImage
          style={tabStyles.icon}
          source={require('../assets/img/home.png')}
          resizeMode={FastImage.resizeMode.contain}
          tintColor={getTintColor('Home')}
        />
        {isActive('Home') && <View style={tabStyles.activeDot} />}
      </TouchableOpacity>

      {/* 2. Tab Monitoring */}
      <TouchableOpacity
        style={tabStyles.navCol}
        onPress={() => navigation.navigate('Monitoring')}
        activeOpacity={0.8}
      >
        <FastImage
          style={tabStyles.icon}
          source={require('../assets/img/map.png')}
          resizeMode={FastImage.resizeMode.contain}
          tintColor={getTintColor('Monitoring')}
        />
        {isActive('Monitoring') && <View style={tabStyles.activeDot} />}
      </TouchableOpacity>

      {/* 3. Tab Usulan (Badge Antrean Offline) */}
      <TouchableOpacity
        style={tabStyles.navCol}
        onPress={() => navigation.navigate('Usulan')}
        activeOpacity={0.8}
      >
        <View style={tabStyles.iconContainer}>
          <FastImage
            style={tabStyles.icon}
            source={require('../assets/img/titik.png')}
            resizeMode={FastImage.resizeMode.contain}
            tintColor={getTintColor('Usulan')}
          />
          {OFFLINE_QUEUE_COUNT > 0 && (
            <View style={tabStyles.badge}>
              <Text style={tabStyles.badgeText}>
                {OFFLINE_QUEUE_COUNT > 9 ? '9+' : OFFLINE_QUEUE_COUNT}
              </Text>
            </View>
          )}
        </View>
        {isActive('Usulan') && <View style={tabStyles.activeDot} />}
      </TouchableOpacity>

      {/* 4. Tab Peta Dasar */}
      <TouchableOpacity
        style={tabStyles.navCol}
        onPress={() => navigation.navigate('PetaDasar')}
        activeOpacity={0.8}
      >
        <FastImage
          style={tabStyles.icon}
          source={require('../assets/img/tanah.png')}
          resizeMode={FastImage.resizeMode.contain}
          tintColor={getTintColor('PetaDasar')}
        />
        {isActive('PetaDasar') && <View style={tabStyles.activeDot} />}
      </TouchableOpacity>

      {/* 5. Tab Profil (Badge Notifikasi) */}
      <TouchableOpacity
        style={tabStyles.navCol}
        onPress={() => navigation.navigate('User')}
        activeOpacity={0.8}
      >
        <View style={tabStyles.iconContainer}>
          <FastImage
            style={tabStyles.icon}
            source={require('../assets/img/user.png')}
            resizeMode={FastImage.resizeMode.contain}
            tintColor={getTintColor('User')}
          />
          {NOTIFICATION_COUNT > 0 && (
            <View style={tabStyles.badge}>
              <Text style={tabStyles.badgeText}>
                {NOTIFICATION_COUNT > 9 ? '9+' : NOTIFICATION_COUNT}
              </Text>
            </View>
          )}
        </View>
        {isActive('User') && <View style={tabStyles.activeDot} />}
      </TouchableOpacity>
    </View>
  );
};

// Styling spesifik sesuai spesifikasi visual Blueprint
const tabStyles = StyleSheet.create({
  container: {
    height: 65,
    backgroundColor: '#FFFFFF', // Token: --color-bg-card
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 15,
    borderTopWidth: 0,
  },
  navCol: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 24,
    height: 24,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0284C7', // Token: --color-primary (Sapphire Core)
    marginTop: 6,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: '#DC2626', // Token: --color-accent-red
    borderRadius: 9,
    minWidth: 17,
    height: 17,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    zIndex: 10,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  offlineDot: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D97706', // Token: --color-accent-amber
    zIndex: 10,
  },
});

export default TabBar;
