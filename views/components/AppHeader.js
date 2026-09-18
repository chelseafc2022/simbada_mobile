import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import FastImage from 'react-native-fast-image';

/**
 * AppHeader — Komponen Header Reusable Standar Aplikasi
 * 
 * Props:
 * - title: string / ReactNode (judul header)
 * - navigation: object navigation (opsional jika onBack tidak diberikan)
 * - onBack: function callback saat tombol kembali ditekan
 * - showBack: boolean (default true)
 * - rightComponent: ReactNode (komponen sisi kanan, misal tombol peta/aksi)
 * - subtitle: string / ReactNode (opsional info di bawah judul)
 * - containerStyle: ViewStyle override untuk header
 * - titleStyle: TextStyle override untuk judul
 */
const AppHeader = ({
  title,
  navigation,
  onBack,
  showBack = true,
  rightComponent = null,
  subtitle = null,
  containerStyle,
  titleStyle,
}) => {
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (navigation && navigation.goBack) {
      navigation.goBack();
    }
  };

  return (
    <View style={[styles.header, containerStyle]}>
      {/* Sisi Kiri: Tombol Back */}
      <View style={styles.leftContainer}>
        {showBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <FastImage
              style={styles.backIcon}
              source={require('../assets/img/chevron-left.png')}
              resizeMode={FastImage.resizeMode.contain}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Sisi Tengah: Judul & Subtitle */}
      <View style={styles.centerContainer}>
        {typeof title === 'string' ? (
          <Text style={[styles.headerTitle, titleStyle]} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          title
        )}
        {subtitle}
      </View>

      {/* Sisi Kanan: Aksi / Kosong agar Center tetap seimbang */}
      <View style={styles.rightContainer}>
        {rightComponent}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
  leftContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backButton: {
    padding: 2,
    justifyContent: 'center',
  },
  backIcon: {
    width: 20,
    height: 20,
  },
  centerContainer: {
    flex: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#208DC0',
    textAlign: 'center',
  },
  rightContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});

export default React.memo(AppHeader);
