import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Linking,
  StatusBar,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import TabBar from '../components/TabBar';
import { useSelector, useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────────────────
// Design System Tokens — Geo-Sapphire
// ─────────────────────────────────────────────────────────
const C = {
  PRIMARY: '#0284C7',
  PRIMARY_DARK: '#0369A1',
  PRIMARY_LIGHT: '#BAE6FD',
  PRIMARY_BG: '#EBF6FC',
  DARK_NAVY: '#0F172A',
  SLATE_700: '#334155',
  SLATE_500: '#64748B',
  SLATE_400: '#94A3B8',
  SLATE_200: '#E2E8F0',
  SURFACE: '#F8FAFC',
  WHITE: '#FFFFFF',
  RED: '#DC2626',
  RED_BG: '#FEF2F2',
  GREEN: '#16A34A',
  GREEN_BG: '#F0FDF4',
  AMBER: '#D97706',
  AMBER_BG: '#FFFBEB',
  CARD_SHADOW: '#0F172A',
};

const statusMapping = {
  1: { label: 'Administrator', color: '#7C3AED', bg: '#F5F3FF', icon: '🛡️' },
  2: { label: 'Operator Desa', color: '#0284C7', bg: '#EBF6FC', icon: '🏘️' },
  3: { label: 'Operator Kecamatan', color: '#0369A1', bg: '#E0F2FE', icon: '🏛️' },
  4: { label: 'Operator Kabupaten', color: '#1D4ED8', bg: '#EFF6FF', icon: '🏢' },
  5: { label: 'Pimpinan', color: '#B45309', bg: '#FFFBEB', icon: '⭐' },
  6: { label: 'Stakeholder', color: '#059669', bg: '#ECFDF5', icon: '🤝' },
  7: { label: 'Stakeholder Home', color: '#059669', bg: '#ECFDF5', icon: '🏠' },
};

const getDriveLink = (userStatus) => {
  switch (parseInt(userStatus)) {
    case 1:
      return 'https://drive.google.com/drive/u/9/folders/1I11vcZ5EJw7yKeancH8wSkEopTq7Ncsq';
    case 2:
      return 'https://drive.google.com/file/d/1kquuuYuPkpOpZstnFyGO_sjHyv70uUXQ/view?usp=sharing';
    case 3:
      return 'https://drive.google.com/file/d/10xnnShnsb4n5VdKLuTHC2DNmuhJHpMxb/view?usp=sharing';
    case 4:
    case 5:
    case 6:
      return 'https://drive.google.com/file/d/1kuDZwXheQwQWSWs0I9rjztAcKS__ae2N/view?usp=sharing';
    default:
      return 'https://drive.google.com/default-link';
  }
};

// ─────────────────────────────────────────────────────────
// Component: ProfileHeader
// ─────────────────────────────────────────────────────────
const ProfileHeader = ({ user, statusCode }) => {
  const role = statusMapping[statusCode] || statusMapping[2];
  const displayName = statusCode === 1 ? 'Administrator' : (user?.nama || 'Pengguna');
  const locationInfo = [
    user?.des_kel_id?.text,
    user?.kecamatan?.text ? `Kecamatan ${user.kecamatan.text}` : null,
    'Kab. Konawe Selatan',
  ].filter(Boolean).join(' • ');

  return (
    <View style={styles.headerCard}>
      <View style={[styles.headerLeftAccent, { backgroundColor: role.color }]} />
      <View style={styles.headerBody}>
        <Text style={[styles.roleKicker, { color: role.color }]}>
          {role.label.toUpperCase()}
        </Text>
        <Text style={styles.userName}>{displayName}</Text>
        <Text style={styles.userLocation}>{locationInfo}</Text>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────
// Component: InfoCard
// ─────────────────────────────────────────────────────────
const InfoCard = ({ user, statusCode }) => {
  if (statusCode === 1) {
    return (
      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>Informasi Kontak</Text>
        <View style={styles.infoDivider} />
        <InfoRow icon="📞" label="Telepon" value={user?.no_telp || 'Tidak tersedia'} />
      </View>
    );
  }

  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoCardTitle}>Informasi Pengguna</Text>
      <View style={styles.infoDivider} />
      <InfoRow icon="🏛️" label="Kecamatan" value={user?.kecamatan?.text || 'Tidak tersedia'} />
      <InfoRow icon="🏘️" label="Desa/Kelurahan" value={user?.des_kel_id?.text || 'Tidak tersedia'} />
      <InfoRow icon="📞" label="Telepon" value={user?.no_telp || 'Tidak tersedia'} />
      <InfoRow
        icon="🔑"
        label="Hak Akses"
        value={statusMapping[statusCode]?.label || 'Tidak diketahui'}
        valueColor={statusMapping[statusCode]?.color}
      />
    </View>
  );
};

const InfoRow = ({ icon, label, value, valueColor }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoRowIcon}>{icon}</Text>
    <View style={styles.infoRowContent}>
      <Text style={styles.infoRowLabel}>{label}</Text>
      <Text style={[styles.infoRowValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────
// Component: DesaTable (Operator Kecamatan)
// ─────────────────────────────────────────────────────────
const DesaTable = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <View style={styles.tableCard}>
      <View style={styles.tableCardHeader}>
        <Text style={styles.tableCardIcon}>📋</Text>
        <View>
          <Text style={styles.tableCardTitle}>Daftar Operator Desa</Text>
          <Text style={styles.tableCardSub}>{data.length} operator terdaftar</Text>
        </View>
      </View>
      <View style={styles.infoDivider} />

      {/* Table Header */}
      <View style={styles.tableRowHeader}>
        <Text style={[styles.tableCellHeader, { flex: 0.4 }]}>No</Text>
        <Text style={[styles.tableCellHeader, { flex: 1.5 }]}>Nama</Text>
        <Text style={[styles.tableCellHeader, { flex: 1 }]}>No. HP</Text>
      </View>

      {/* Table Rows */}
      {data.map((user, index) => (
        <View key={index} style={[styles.tableRow, index % 2 === 0 && styles.tableRowAlt]}>
          <Text style={[styles.tableCell, { flex: 0.4 }]}>{index + 1}</Text>
          <Text style={[styles.tableCell, { flex: 1.5, fontWeight: '600', color: C.DARK_NAVY }]}>
            {user.nama}
          </Text>
          <Text style={[styles.tableCell, { flex: 1 }]}>{user.no_telp || '-'}</Text>
        </View>
      ))}
    </View>
  );
};

// ─────────────────────────────────────────────────────────
// Component: MenuItem
// ─────────────────────────────────────────────────────────
const MenuItem = ({ icon, label, subtitle, onPress, variant = 'default', isLast = false }) => (
  <TouchableOpacity
    style={[
      styles.menuItem,
      !isLast && styles.menuItemBorder,
      variant === 'danger' && styles.menuItemDanger,
    ]}
    onPress={onPress}
    activeOpacity={0.6}
  >
    <View style={[
      styles.menuIconContainer,
      variant === 'danger' ? styles.menuIconDanger : styles.menuIconDefault,
    ]}>
      <Text style={styles.menuIconText}>{icon}</Text>
    </View>
    <View style={styles.menuLabelContainer}>
      <Text style={[
        styles.menuLabel,
        variant === 'danger' && styles.menuLabelDanger,
      ]}>{label}</Text>
      {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
    </View>
    <Text style={[styles.menuChevron, variant === 'danger' && { color: C.RED }]}>›</Text>
  </TouchableOpacity>
);

// ─────────────────────────────────────────────────────────
// Component: AboutModal
// ─────────────────────────────────────────────────────────
const AboutModal = ({ visible, onClose }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalLogoContainer}>
          <FastImage
            source={require('../assets/img/logo.png')}
            style={styles.modalLogo}
            resizeMode={FastImage.resizeMode.contain}
          />
        </View>
        <Text style={styles.modalTitle}>SIMBADA Mobile</Text>
        <Text style={styles.modalSubtitle}>Sistem Informasi Batas Desa</Text>
        <View style={styles.modalDivider} />
        <Text style={styles.modalVersion}>Versi 2.0.0 (2026)</Text>
        <Text style={styles.modalDesc}>
          Aplikasi mobile untuk pengelolaan dan penetapan batas desa di wilayah Kabupaten Konawe Selatan.
        </Text>
        <View style={styles.modalDivider} />
        <Text style={styles.modalDev}>Sekretariat Daerah</Text>
        <Text style={styles.modalSubDev}>Bagian Tata Pemerintahan</Text>
        <Text style={styles.modalCopy}>© 2026 Pemerintah Kabupaten Konawe Selatan</Text>

        <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.modalCloseBtnText}>Tutup</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

// ═════════════════════════════════════════════════════════
// MAIN COMPONENT: User / Profile
// ═════════════════════════════════════════════════════════
const User = ({ navigation }) => {
  const dispatch = useDispatch();
  const [selectedUser, setSelectedUser] = useState(null);
  const [userInfo, setUserInfo] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAbout, setShowAbout] = useState(false);

  const PROFILE = useSelector((state) => state.PROFILE);
  const URL = useSelector((state) => state.URL);
  const statusCode = parseInt(PROFILE?.profile?.status) || 0;

  // ── Fetch User Profile ──
  const fetchUserProfile = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('TOKEN');
      const cacheKey = `@profile_cache_${PROFILE?.id}`;

      // Stale-While-Revalidate Cache
      if (!selectedUser && userInfo.length === 0) {
        try {
          const cachedStr = await AsyncStorage.getItem(cacheKey);
          if (cachedStr) {
            const cachedResult = JSON.parse(cachedStr);
            if (statusCode === 1) {
              setSelectedUser(cachedResult[0]?.data1[0] || null);
            } else {
              setUserInfo(cachedResult[0]?.data1 || []);
            }
            setIsLoading(false);
          } else {
            setIsLoading(true);
          }
        } catch (e) {
          setIsLoading(true);
        }
      }

      const response = await fetch(URL.URL_PENGGUNA + 'view', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: 'kikensbatara ' + token,
        },
        body: JSON.stringify({
          data_ke: 1,
          cari_value: '',
          id: PROFILE?.id || '',
          status: PROFILE?.profile?.status || 1,
          id_kecamatan: PROFILE?.profile?.id_kecamatan || '',
        }),
      });

      const result = await response.json();

      if (response.ok && Array.isArray(result) && result.length > 0) {
        if (statusCode === 1) {
          setSelectedUser(result[0]?.data1[0] || null);
        } else {
          setUserInfo(result[0]?.data1 || []);
        }
        await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
      } else {
        console.error('Error fetching user info: Data kosong atau struktur tidak sesuai.');
        setSelectedUser(null);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [PROFILE, URL, statusCode]);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  // ── Logout ──
  const logOut = async () => {
    Alert.alert(
      'Konfirmasi Keluar',
      'Apakah Anda yakin ingin keluar dari aplikasi?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Keluar',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                'TOKEN',
                'PROFILE',
                'LAST_LOGIN',
                'lokasiPolylineData',
                'lokasiData',
              ]);
              dispatch({ type: 'RESET_AUTH' });
              navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            } catch (error) {
              console.error('Error saat logout:', error);
              Alert.alert('Error', 'Gagal melakukan logout. Silakan coba lagi.');
            }
          },
        },
      ],
    );
  };

  // ── Loading State ──
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={C.SURFACE} />
        <View style={styles.loadingSpinnerWrap}>
          <ActivityIndicator size="large" color={C.PRIMARY} />
          <Text style={styles.loadingText}>Memuat profil...</Text>
        </View>
      </View>
    );
  }

  // ── Error State ──
  if (!selectedUser && userInfo.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={C.SURFACE} />
        <View style={styles.errorInner}>
          <Text style={styles.errorEmoji}>😔</Text>
          <Text style={styles.errorTitle}>Gagal Memuat Data</Text>
          <Text style={styles.errorDesc}>Data profil pengguna tidak dapat dimuat. Pastikan koneksi internet Anda stabil.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchUserProfile} activeOpacity={0.7}>
            <Text style={styles.retryBtnText}>🔄 Coba Lagi</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtnAlt} onPress={logOut} activeOpacity={0.7}>
            <Text style={styles.logoutBtnAltText}>Keluar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Determine which user data to use
  const displayUser =
    statusCode === 1
      ? selectedUser
      : userInfo.length > 0
      ? userInfo[0]
      : null;

  // ── Main Render ──
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={C.WHITE} />

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarBack} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <FastImage
            style={styles.topBarBackIcon}
            source={require('../assets/img/chevron-left.png')}
            resizeMode="contain"
            tintColor={C.DARK_NAVY}
          />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Profil</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header Card */}
        <ProfileHeader user={displayUser} statusCode={statusCode} />

        {/* User Info Card */}
        {displayUser && <InfoCard user={displayUser} statusCode={statusCode} />}

        {/* Operator Kecamatan Table */}
        {statusCode === 3 && <DesaTable data={userInfo} />}

        {/* Menu Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pengaturan</Text>
        </View>

        <View style={styles.menuCard}>
          <MenuItem
            icon="📘"
            label="Buku Panduan"
            subtitle="Unduh panduan penggunaan aplikasi"
            onPress={() => {
              const driveLink = getDriveLink(statusCode);
              Linking.openURL(driveLink);
            }}
          />
          <MenuItem
            icon="ℹ️"
            label="Tentang Aplikasi"
            subtitle="SIMBADA Mobile v2.0.0"
            onPress={() => setShowAbout(true)}
          />
          <MenuItem
            icon="🛡️"
            label="Kebijakan Privasi"
            subtitle="Ketentuan pelindungan data pribadi (UU PDP)"
            onPress={() => navigation.navigate('KebijakanPrivasi')}
          />
          <MenuItem
            icon="📞"
            label="Hubungi Bantuan"
            subtitle="Laporkan masalah atau saran"
            onPress={() => {
              Linking.openURL('https://wa.me/6281234567890?text=Halo%20Admin%20SIMBADA');
            }}
          />
          <MenuItem
            icon="🚪"
            label="Keluar"
            subtitle="Logout dari akun Anda"
            onPress={logOut}
            variant="danger"
            isLast
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <FastImage
            source={require('../assets/img/logo.png')}
            style={styles.footerLogo}
            resizeMode={FastImage.resizeMode.contain}
          />
          <Text style={styles.footerText}>SIMBADA Mobile v2.0.0 (2026)</Text>
          <Text style={styles.footerCopy}>© 2026 Pemkab Konawe Selatan</Text>
        </View>
      </ScrollView>

      <TabBar />
      <AboutModal visible={showAbout} onClose={() => setShowAbout(false)} />
    </View>
  );
};

// ═════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.SURFACE,
  },

  // ── Top Bar ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 14,
    paddingBottom: 12,
    backgroundColor: C.WHITE,
    borderBottomWidth: 1,
    borderBottomColor: C.SLATE_200,
  },
  topBarBack: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.SURFACE,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.SLATE_200,
  },
  topBarBackIcon: { width: 18, height: 18 },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: C.DARK_NAVY,
    letterSpacing: 0.3,
  },
  topBarSpacer: { width: 38 },

  // ── Scroll ──
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 30 },

  // ── Header Card ──
  // ── Header Card ──
  headerCard: {
    backgroundColor: C.WHITE,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 14,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: C.SLATE_200,
    shadowColor: C.CARD_SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  headerLeftAccent: {
    width: 4.5,
  },
  headerBody: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  roleKicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: C.DARK_NAVY,
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  userLocation: {
    fontSize: 13,
    fontWeight: '500',
    color: C.SLATE_500,
  },

  // ── Info Card ──
  infoCard: {
    backgroundColor: C.WHITE,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    padding: 18,
    shadowColor: C.CARD_SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  infoCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.DARK_NAVY,
    letterSpacing: 0.2,
  },
  infoDivider: {
    height: 1,
    backgroundColor: C.SLATE_200,
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoRowIcon: {
    fontSize: 18,
    width: 30,
    textAlign: 'center',
  },
  infoRowContent: {
    flex: 1,
    marginLeft: 10,
  },
  infoRowLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.SLATE_400,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  infoRowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: C.DARK_NAVY,
  },

  // ── Section Header ──
  sectionHeader: {
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.SLATE_500,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  // ── Menu Card ──
  menuCard: {
    backgroundColor: C.WHITE,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: C.CARD_SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  menuItemDanger: {},
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuIconDefault: {
    backgroundColor: C.PRIMARY_BG,
  },
  menuIconDanger: {
    backgroundColor: C.RED_BG,
  },
  menuIconText: {
    fontSize: 18,
  },
  menuLabelContainer: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: C.DARK_NAVY,
  },
  menuLabelDanger: {
    color: C.RED,
  },
  menuSubtitle: {
    fontSize: 11,
    color: C.SLATE_400,
    marginTop: 2,
  },
  menuChevron: {
    fontSize: 22,
    color: C.SLATE_400,
    fontWeight: '300',
  },

  // ── Table Card ──
  tableCard: {
    backgroundColor: C.WHITE,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    padding: 18,
    shadowColor: C.CARD_SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  tableCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tableCardIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  tableCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.DARK_NAVY,
  },
  tableCardSub: {
    fontSize: 11,
    color: C.SLATE_400,
    marginTop: 2,
  },
  tableRowHeader: {
    flexDirection: 'row',
    backgroundColor: C.PRIMARY,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  tableCellHeader: {
    color: C.WHITE,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  tableRowAlt: {
    backgroundColor: '#F8FAFC',
  },
  tableCell: {
    fontSize: 13,
    color: C.SLATE_500,
    textAlign: 'center',
  },

  // ── Footer ──
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
    marginTop: 12,
  },
  footerLogo: {
    width: 36,
    height: 36,
    opacity: 0.4,
    marginBottom: 8,
  },
  footerText: {
    fontSize: 11,
    color: C.SLATE_400,
    fontWeight: '600',
  },
  footerCopy: {
    fontSize: 10,
    color: C.SLATE_400,
    marginTop: 2,
  },

  // ── Loading / Error ──
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.SURFACE,
  },
  loadingSpinnerWrap: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    color: C.SLATE_500,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.SURFACE,
    paddingHorizontal: 30,
  },
  errorInner: {
    alignItems: 'center',
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.DARK_NAVY,
    marginBottom: 8,
  },
  errorDesc: {
    fontSize: 13,
    color: C.SLATE_500,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: C.PRIMARY,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  retryBtnText: {
    color: C.WHITE,
    fontSize: 14,
    fontWeight: '700',
  },
  logoutBtnAlt: {
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  logoutBtnAltText: {
    color: C.RED,
    fontSize: 14,
    fontWeight: '600',
  },

  // ── About Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  modalContent: {
    backgroundColor: C.WHITE,
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalLogoContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: C.PRIMARY_BG,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: C.PRIMARY_LIGHT,
  },
  modalLogo: {
    width: 52,
    height: 52,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.DARK_NAVY,
    letterSpacing: 0.3,
  },
  modalSubtitle: {
    fontSize: 13,
    color: C.SLATE_500,
    marginTop: 4,
  },
  modalDivider: {
    width: '80%',
    height: 1,
    backgroundColor: C.SLATE_200,
    marginVertical: 16,
  },
  modalVersion: {
    fontSize: 13,
    fontWeight: '700',
    color: C.PRIMARY,
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 12,
    color: C.SLATE_500,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  modalDev: {
    fontSize: 12,
    fontWeight: '700',
    color: C.DARK_NAVY,
  },
  modalSubDev: {
    fontSize: 11,
    color: C.SLATE_500,
    marginTop: 2,
    marginBottom: 8,
  },
  modalCopy: {
    fontSize: 11,
    color: C.SLATE_400,
    fontWeight: '500',
  },
  modalCloseBtn: {
    marginTop: 20,
    backgroundColor: C.PRIMARY,
    paddingHorizontal: 36,
    paddingVertical: 11,
    borderRadius: 12,
  },
  modalCloseBtnText: {
    color: C.WHITE,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default User;
