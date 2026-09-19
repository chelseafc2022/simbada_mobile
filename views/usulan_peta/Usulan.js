// import libraries
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  TextInput,
  Alert,
  StatusBar,
  StyleSheet as RNStyleSheet,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { useSelector } from 'react-redux';
import { useIsFocused } from '@react-navigation/native';
import moment from 'moment';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TabBar from '../components/TabBar';
import AppHeader from '../components/AppHeader';

const Usulan = ({ navigation, route }) => {
  const isFocused = useIsFocused();
  const TOKEN = useSelector((state) => state.TOKEN);
  const PROFILE = useSelector((state) => state.PROFILE);
  const URL = useSelector((state) => state.URL);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [DATA_USULAN, SET_USULAN] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL'); // ALL, '1', '3', '2'

  // Fetch data dari server
  const getView = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      }

      const userStatus = PROFILE?.profile?.status ? String(PROFILE.profile.status) : '1';
      const idDesaUser =
        (typeof PROFILE?.profile?.id_desa === 'object' ? PROFILE?.profile?.id_desa?.id : PROFILE?.profile?.id_desa) ||
        (typeof PROFILE?.profile?.des_kel_id === 'object' ? PROFILE?.profile?.des_kel_id?.id : PROFILE?.profile?.des_kel_id) ||
        (typeof PROFILE?.profile?.id_des_kel === 'object' ? PROFILE?.profile?.id_des_kel?.id : PROFILE?.profile?.id_des_kel);
      const idKecamatanUser =
        (typeof PROFILE?.profile?.id_kecamatan === 'object' ? PROFILE?.profile?.id_kecamatan?.id : PROFILE?.profile?.id_kecamatan) ||
        (typeof PROFILE?.profile?.kecamatan === 'object' ? PROFILE?.profile?.kecamatan?.id : PROFILE?.profile?.kecamatan);

      const cacheKey = `@usulan_cache_${PROFILE?.id || 'user'}`;

      // Cek Cache Lokal jika belum ada data dan bukan refresh manual
      if (DATA_USULAN.length === 0 && !isManualRefresh) {
        try {
          const cachedStr = await AsyncStorage.getItem(cacheKey);
          if (cachedStr) {
            SET_USULAN(JSON.parse(cachedStr));
            setIsLoading(false);
          } else {
            setIsLoading(true);
          }
        } catch (e) {
          setIsLoading(true);
        }
      }

      const requestBody = {
        data_ke: 1,
        cari_value: '',
        id: PROFILE?.id,
        status: userStatus,
        ...(userStatus === '2' && idDesaUser && { id_des_kel: idDesaUser }),
        ...(userStatus === '3' && idKecamatanUser && { id_kecamatan: idKecamatanUser }),
      };

      const response = await fetch(URL.URL_ADD_ZONA + 'viewUsulanNative', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'kikensbatara ' + TOKEN,
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (response.ok && Array.isArray(result) && result[0]?.data1) {
        const freshData = result[0].data1;
        SET_USULAN(freshData);
        await AsyncStorage.setItem(cacheKey, JSON.stringify(freshData));
      } else {
        console.error('Error fetching data:', result);
      }
    } catch (error) {
      console.error('Fetch Error:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleDeleteUsulan = (item) => {
    Alert.alert(
      'Hapus Pengajuan Usulan',
      `Apakah Anda yakin ingin menghapus pengajuan usulan "${item.nama}"? Tindakan ini tidak dapat dibatalkan.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(URL.URL_ADD_ZONA + 'removeData', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: 'kikensbatara ' + TOKEN,
                },
                body: JSON.stringify({
                  id: item.id,
                  file: item.file || '',
                }),
              });

              if (response.ok) {
                Alert.alert('Berhasil', 'Pengajuan usulan telah berhasil dihapus.');
                SET_USULAN((prev) => prev.filter((u) => u.id !== item.id));
                const cacheKey = `@usulan_cache_${PROFILE?.id || 'user'}`;
                await AsyncStorage.removeItem(cacheKey);
              } else {
                Alert.alert('Gagal', 'Tidak dapat menghapus data usulan dari server.');
              }
            } catch (err) {
              console.error('Error deleting usulan:', err);
              Alert.alert('Error', 'Terjadi kesalahan koneksi saat menghapus data.');
            }
          },
        },
      ]
    );
  };

  const handleEditUsulan = (item) => {
    navigation.navigate('EditUsulan', {
      id_usulan: item.id,
      nik: item.nik,
      nama: item.nama,
      alamat: item.alamat,
      id_kecamatan: item.kecamatan_id,
      nama_kecamatan: item.nama_kecamatan,
      id_des_kel: item.des_kel_id,
      nama_des_kel: item.nama_des_kel,
      rwrt: item.rwrt,
      no_telp: item.no_telp,
      catatan: item.catatan,
      lokasi: item.lokasi,
      file: item.file,
      status_pengajuan: item.status_pengajuan,
      tipe: item.tipe || 'polygon',
    });
  };

  const onRefresh = () => {
    getView(true);
  };

  useEffect(() => {
    getView();
  }, [isFocused]);

  // Statistik Ringkas
  const countPending = useMemo(
    () => DATA_USULAN.filter((item) => String(item.status_pengajuan || '1') === '1').length,
    [DATA_USULAN]
  );
  const countApproved = useMemo(
    () => DATA_USULAN.filter((item) => String(item.status_pengajuan) === '3').length,
    [DATA_USULAN]
  );
  const countRejected = useMemo(
    () => DATA_USULAN.filter((item) => String(item.status_pengajuan) === '2').length,
    [DATA_USULAN]
  );

  // Filter & Search Logic
  const filteredList = useMemo(() => {
    return DATA_USULAN.filter((item) => {
      const statusStr = String(item.status_pengajuan || '1');
      if (activeFilter !== 'ALL' && statusStr !== activeFilter) {
        return false;
      }
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase();
        const nama = (item.nama || '').toLowerCase();
        const desa = (item.nama_des_kel || '').toLowerCase();
        const kec = (item.nama_kecamatan || '').toLowerCase();
        const alamat = (item.alamat || '').toLowerCase();
        return (
          nama.includes(query) ||
          desa.includes(query) ||
          kec.includes(query) ||
          alamat.includes(query)
        );
      }
      return true;
    });
  }, [DATA_USULAN, activeFilter, searchQuery]);

  return (
    <View style={usulanStyles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header Standar Aplikasi */}
      <AppHeader
        title="Pengajuan Batas Desa"
        navigation={navigation}
        showBack={true}
        subtitle={
          <Text style={usulanStyles.headerSub}>
            Kelola berkas usulan penetapan batas wilayah
          </Text>
        }
      />

      {/* Filter & Search Bar */}
      <View style={usulanStyles.searchFilterSection}>
        {/* Search Input */}
        <View style={usulanStyles.searchInputContainer}>
          <Text style={usulanStyles.searchIcon}>🔍</Text>
          <TextInput
            style={usulanStyles.searchInput}
            placeholder="Cari pemohon, desa, atau alamat..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={usulanStyles.clearSearchBtn}
              activeOpacity={0.7}
            >
              <Text style={usulanStyles.clearSearchText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={usulanStyles.filterChipsScroll}
        >
          <TouchableOpacity
            style={[
              usulanStyles.filterChip,
              activeFilter === 'ALL' && usulanStyles.filterChipActive,
            ]}
            onPress={() => setActiveFilter('ALL')}
            activeOpacity={0.75}
          >
            <Text
              style={[
                usulanStyles.filterChipText,
                activeFilter === 'ALL' && usulanStyles.filterChipTextActive,
              ]}
            >
              Semua ({DATA_USULAN.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              usulanStyles.filterChip,
              activeFilter === '1' && usulanStyles.filterChipActiveAmber,
            ]}
            onPress={() => setActiveFilter('1')}
            activeOpacity={0.75}
          >
            <Text
              style={[
                usulanStyles.filterChipText,
                activeFilter === '1' && usulanStyles.filterChipTextAmber,
              ]}
            >
              ⏳ Menunggu ({countPending})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              usulanStyles.filterChip,
              activeFilter === '3' && usulanStyles.filterChipActiveGreen,
            ]}
            onPress={() => setActiveFilter('3')}
            activeOpacity={0.75}
          >
            <Text
              style={[
                usulanStyles.filterChipText,
                activeFilter === '3' && usulanStyles.filterChipTextGreen,
              ]}
            >
              ✅ Disetujui ({countApproved})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              usulanStyles.filterChip,
              activeFilter === '2' && usulanStyles.filterChipActiveRed,
            ]}
            onPress={() => setActiveFilter('2')}
            activeOpacity={0.75}
          >
            <Text
              style={[
                usulanStyles.filterChipText,
                activeFilter === '2' && usulanStyles.filterChipTextRed,
              ]}
            >
              🚫 Ditolak ({countRejected})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main List Content */}
      <View style={usulanStyles.contentArea}>
        {isLoading && !isRefreshing && DATA_USULAN.length === 0 ? (
          <View style={usulanStyles.loadingContainer}>
            <ActivityIndicator size="large" color="#0284C7" />
            <Text style={usulanStyles.loadingText}>Memuat data usulan...</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={usulanStyles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                colors={['#0284C7']}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {/* Tampilan bila hasil filter / list kosong */}
            {filteredList.length === 0 ? (
              <View style={usulanStyles.emptyCard}>
                <View style={usulanStyles.emptyIconBox}>
                  <Text style={{ fontSize: 32 }}>📋</Text>
                </View>
                <Text style={usulanStyles.emptyTitle}>
                  {searchQuery.trim().length > 0 || activeFilter !== 'ALL'
                    ? 'Tidak Ditemukan'
                    : 'Belum Ada Pengajuan'}
                </Text>
                <Text style={usulanStyles.emptySub}>
                  {searchQuery.trim().length > 0 || activeFilter !== 'ALL'
                    ? 'Tidak ada usulan yang sesuai dengan kata kunci pencarian atau filter yang dipilih.'
                    : 'Anda belum memiliki riwayat pengajuan batas desa. Mulai buat usulan baru sekarang.'}
                </Text>
                {DATA_USULAN.length === 0 && (
                  <TouchableOpacity
                    style={usulanStyles.emptyAddBtn}
                    onPress={() => navigation.navigate('AddUsulan')}
                    activeOpacity={0.8}
                  >
                    <Text style={usulanStyles.emptyAddBtnText}>+ Ajukan Batas Sekarang</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              filteredList.map((item, index) => {
                const statusStr = String(item.status_pengajuan || '1');
                const canEditOrDelete = statusStr === '1' || statusStr === '2';

                let statusBadgeStyle = usulanStyles.badgePending;
                let statusTextStyle = usulanStyles.badgeTextPending;
                let statusLabel = 'Menunggu';
                let statusIcon = '⏳';

                if (statusStr === '2') {
                  statusBadgeStyle = usulanStyles.badgeRejected;
                  statusTextStyle = usulanStyles.badgeTextRejected;
                  statusLabel = 'Ditolak';
                  statusIcon = '🚫';
                } else if (statusStr === '3') {
                  statusBadgeStyle = usulanStyles.badgeApproved;
                  statusTextStyle = usulanStyles.badgeTextApproved;
                  statusLabel = 'Disetujui';
                  statusIcon = '✅';
                }

                // Format metode
                const tipeMetode = (item.tipe || 'polygon').toLowerCase();
                let tipeLabel = '📐 Polygon';
                if (tipeMetode.includes('polyline') || tipeMetode.includes('garis')) {
                  tipeLabel = '〰️ Polyline';
                } else if (tipeMetode.includes('kml') || tipeMetode.includes('gpx')) {
                  tipeLabel = '📁 KML/GPX';
                } else if (tipeMetode.includes('marker') || tipeMetode.includes('titik')) {
                  tipeLabel = '📍 Titik';
                }

                return (
                  <TouchableOpacity
                    key={item.id || index}
                    style={usulanStyles.card}
                    activeOpacity={0.88}
                    onPress={() =>
                      navigation.navigate('Zona', {
                        id_usulan: item.id,
                        nik: item.nik,
                        nama: item.nama,
                        alamat: item.alamat,
                        id_kecamatan: item.kecamatan_id,
                        nama_kecamatan: item.nama_kecamatan,
                        id_des_kel: item.des_kel_id,
                        nama_des_kel: item.nama_des_kel,
                        rwrt: item.rwrt,
                        no_telp: item.no_telp,
                        catatan: item.catatan,
                        lokasi: item.lokasi,
                        file: item.file,
                        status_pengajuan: item.status_pengajuan,
                      })
                    }
                  >
                    {/* Baris Atas: Nama Pemohon & Badge Status */}
                    <View style={usulanStyles.cardHeaderRow}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={usulanStyles.cardTitle} numberOfLines={1}>
                          {item.nama || 'Usulan Batas'}
                        </Text>
                        <View style={usulanStyles.villageRow}>
                          <Text style={usulanStyles.villageText} numberOfLines={1}>
                            📍 {item.nama_des_kel || 'Desa'}{' '}
                            {item.nama_kecamatan ? `• Kec. ${item.nama_kecamatan}` : ''}
                          </Text>
                        </View>
                      </View>
                      <View style={[usulanStyles.statusBadge, statusBadgeStyle]}>
                        <Text style={statusTextStyle}>
                          {statusIcon} {statusLabel}
                        </Text>
                      </View>
                    </View>

                    {/* Badge Tipe Metode & RW/RT */}
                    <View style={usulanStyles.metaRow}>
                      <View style={usulanStyles.methodBadge}>
                        <Text style={usulanStyles.methodBadgeText}>{tipeLabel}</Text>
                      </View>
                      {item.rwrt ? (
                        <View style={usulanStyles.rwrtBadge}>
                          <Text style={usulanStyles.rwrtBadgeText}>RW/RT: {item.rwrt}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Alamat Ringkas */}
                    {item.alamat ? (
                      <Text style={usulanStyles.addressText} numberOfLines={2}>
                        {item.alamat}
                      </Text>
                    ) : null}

                    {/* Catatan Penolakan / Revisi Khusus jika Ditolak */}
                    {statusStr === '2' && item.catatan ? (
                      <View style={usulanStyles.rejectionBox}>
                        <Text style={usulanStyles.rejectionTitle}>⚠️ Catatan Perbaikan:</Text>
                        <Text style={usulanStyles.rejectionDesc} numberOfLines={2}>
                          {item.catatan}
                        </Text>
                      </View>
                    ) : null}

                    {/* Garis Pemisah Halus */}
                    <View style={usulanStyles.cardDivider} />

                    {/* Baris Bawah: Tanggal Pengajuan & Tombol Aksi */}
                    <View style={usulanStyles.cardFooterRow}>
                      <View style={usulanStyles.dateContainer}>
                        <Text style={usulanStyles.dateText}>
                          📅 {moment(item.createAt || item.created_at).format('DD MMM YYYY')}
                        </Text>
                      </View>

                      {canEditOrDelete ? (
                        <View style={usulanStyles.actionButtonsRow}>
                          <TouchableOpacity
                            style={usulanStyles.editBtn}
                            onPress={() => handleEditUsulan(item)}
                            activeOpacity={0.7}
                          >
                            <Text style={usulanStyles.editBtnText}>✏️ Edit</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={usulanStyles.deleteBtn}
                            onPress={() => handleDeleteUsulan(item)}
                            activeOpacity={0.7}
                          >
                            <Text style={usulanStyles.deleteBtnText}>🗑️ Hapus</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={usulanStyles.lockedBadge}>
                          <Text style={usulanStyles.lockedBadgeText}>🔒 Sah / Terverifikasi</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        )}
      </View>

      {/* Floating Action Button (+ Buat Usulan Baru) */}
      <TouchableOpacity
        onPress={() => navigation.navigate('AddUsulan')}
        style={usulanStyles.fab}
        activeOpacity={0.85}
      >
        <Text style={usulanStyles.fabPlusIcon}>+</Text>
        <Text style={usulanStyles.fabLabel}>Buat Usulan</Text>
      </TouchableOpacity>

      {/* Bottom Tab Bar */}
      <TabBar />
    </View>
  );
};

const usulanStyles = RNStyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  searchFilterSection: {
    backgroundColor: '#FFFFFF',
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: 'bold',
  },
  filterChipsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 2,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  filterChipActiveAmber: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  filterChipActiveGreen: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  filterChipActiveRed: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterChipTextAmber: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterChipTextGreen: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterChipTextRed: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  contentArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 150, // Space aman untuk FAB dan TabBar
  },

  // CARD USULAN MODERN
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 3,
  },
  villageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  villageText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  badgeRejected: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  badgeApproved: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  badgeTextPending: {
    color: '#B45309',
    fontSize: 10,
    fontWeight: '700',
  },
  badgeTextRejected: {
    color: '#B91C1C',
    fontSize: 10,
    fontWeight: '700',
  },
  badgeTextApproved: {
    color: '#15803D',
    fontSize: 10,
    fontWeight: '700',
  },

  // META BADGES (Metode, RW/RT)
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  methodBadge: {
    backgroundColor: '#F0F9FF',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  methodBadgeText: {
    fontSize: 10,
    color: '#0284C7',
    fontWeight: '600',
  },
  rwrtBadge: {
    backgroundColor: '#F8FAFC',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rwrtBadgeText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  addressText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 8,
  },

  // REJECTION NOTE
  rejectionBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
    marginBottom: 8,
  },
  rejectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 2,
  },
  rejectionDesc: {
    fontSize: 11,
    color: '#B91C1C',
    lineHeight: 15,
  },

  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editBtn: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  deleteBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  deleteBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  lockedBadge: {
    backgroundColor: '#F0FDF4',
    borderColor: '#DCFCE7',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  lockedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },

  // EMPTY STATE
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  emptyAddBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // FAB MODERN EXTENDED
  fab: {
    position: 'absolute',
    bottom: 95,
    right: 18,
    backgroundColor: '#0284C7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 24,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 7,
    zIndex: 99,
  },
  fabPlusIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 6,
    marginTop: -1,
  },
  fabLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default Usulan;
