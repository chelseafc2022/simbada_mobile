// views/components/ForceUpdateModal.js
import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  BackHandler,
  ScrollView,
} from 'react-native';

/**
 * ForceUpdateModal
 * Dialog pembaruan wajib yang tidak dapat ditutup jika versi aplikasi di bawah batas minimum server
 */
const ForceUpdateModal = ({ visible, updateData }) => {
  // Cegah tombol back hardware Android menutup modal jika update wajib
  useEffect(() => {
    if (visible && updateData?.force_update) {
      const onBackPress = () => true; // Trap back press
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }
  }, [visible, updateData]);

  if (!visible || !updateData) return null;

  const handleOpenPlayStore = () => {
    const url =
      updateData.playstore_url ||
      'https://play.google.com/store/apps/details?id=com.simbadakonselv2';
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Linking.openURL(
            'https://play.google.com/store/apps/details?id=com.simbadakonselv2'
          );
        }
      })
      .catch(() => {
        Linking.openURL(
          'https://play.google.com/store/apps/details?id=com.simbadakonselv2'
        );
      });
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={styles.dialogCard}>
          {/* Header Icon */}
          <View style={styles.iconCircle}>
            <Text style={{ fontSize: 32 }}>🚀</Text>
          </View>

          {/* Title & Badge */}
          <View style={styles.badgeBox}>
            <Text style={styles.badgeText}>VERSI TERBARU TERSEDIA</Text>
          </View>

          <Text style={styles.title}>
            {updateData.title || 'Pembaruan Aplikasi Wajib'}
          </Text>

          {/* Version Info Chip */}
          <View style={styles.versionRow}>
            <Text style={styles.versionCurrent}>
              Versi Terpasang: v{updateData.client_version_name || '1.0.2'}
            </Text>
            <Text style={styles.arrowText}>➔</Text>
            <Text style={styles.versionLatest}>
              v{updateData.latest_version_name || '1.0.3'}
            </Text>
          </View>

          {/* Message */}
          <Text style={styles.message}>
            {updateData.message ||
              'Aplikasi SIMBADA Mobile memerlukan pembaruan untuk mematuhi regulasi Google Play terbaru (Android 16 / API 36) dan pelindungan data batas desa.'}
          </Text>

          {/* Changelog */}
          {Array.isArray(updateData.changelog) &&
            updateData.changelog.length > 0 && (
              <View style={styles.changelogBox}>
                <Text style={styles.changelogHeader}>Apa yang baru:</Text>
                <ScrollView style={{ maxHeight: 110 }} nestedScrollEnabled>
                  {updateData.changelog.map((item, idx) => (
                    <View key={idx} style={styles.changelogItem}>
                      <Text style={styles.bulletDot}>•</Text>
                      <Text style={styles.changelogText}>{item}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

          {/* Action Button */}
          <TouchableOpacity
            style={styles.btnPrimary}
            activeOpacity={0.85}
            onPress={handleOpenPlayStore}
          >
            <Text style={styles.btnPrimaryText}>
              Perbarui di Google Play Store
            </Text>
          </TouchableOpacity>

          <Text style={styles.policyNotice}>
            Pemerintah Kabupaten Konawe Selatan • SPBE 2026
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 37, 69, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#BAE6FD',
  },
  badgeBox: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  badgeText: {
    color: '#B45309',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0B3558',
    textAlign: 'center',
    marginBottom: 8,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  versionCurrent: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  arrowText: {
    marginHorizontal: 8,
    color: '#0284C7',
    fontSize: 12,
    fontWeight: '700',
  },
  versionLatest: {
    fontSize: 11.5,
    color: '#0284C7',
    fontWeight: '800',
  },
  message: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  changelogBox: {
    width: '100%',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
  },
  changelogHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  changelogItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  bulletDot: {
    fontSize: 12,
    color: '#0284C7',
    marginRight: 6,
    lineHeight: 16,
  },
  changelogText: {
    flex: 1,
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
  btnPrimary: {
    width: '100%',
    backgroundColor: '#0284C7',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  policyNotice: {
    fontSize: 9.5,
    color: '#94A3B8',
    marginTop: 12,
    fontWeight: '500',
  },
});

export default ForceUpdateModal;
