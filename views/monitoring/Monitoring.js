// import pustaka
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  StatusBar,
  RefreshControl,
  StyleSheet as RNStyleSheet,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { useSelector } from 'react-redux';
import { useIsFocused } from '@react-navigation/native';
import moment from 'moment';
import TabBar from '../components/TabBar';

// Komponen Utama Monitoring (Flat & Minimalist)
const Monitoring = ({ navigation }) => {
  const isFocused = useIsFocused();
  const token = useSelector((state) => state.TOKEN);
  const profile = useSelector((state) => state.PROFILE);
  const url = useSelector((state) => state.URL);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataMonitoring, setDataMonitoring] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL'); // ALL, 1 (Menunggu), 2 (Ditolak), 3 (Disetujui)
  const [page, setPage] = useState(1);

  const userStatus = profile?.profile?.status || '1';

  // Fetch data dari API viewmonitornative
  const getView = async (refresh = false) => {
    if (!token) return;
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const idKecamatanUser = profile.profile?.id_kecamatan;
      const requestBody = {
        data_ke: page,
        cari_value: '',
        id: profile.id,
        status: userStatus,
        ...(userStatus === '3' && { id_kecamatan: idKecamatanUser }),
      };

      const response = await fetch(url.URL_LIST_MONITORING + 'viewmonitornative', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `kikensbatara ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (response.ok && Array.isArray(result) && result[0]?.data1) {
        const rawList = result[0].data1 || [];
        setDataMonitoring(rawList);
        applyFilterAndSearch(rawList, searchQuery, activeFilter);
      } else {
        setDataMonitoring([]);
        setFilteredData([]);
      }
    } catch (error) {
      console.error('Fetch Error Monitoring:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isFocused && userStatus !== '2') {
      getView();
    }
  }, [isFocused]);

  // Fungsi Filter Gabungan (Pencarian & Status Tab)
  const applyFilterAndSearch = (sourceData, query, statusFilter) => {
    let result = sourceData;

    // Filter berdasarkan status pengajuan
    if (statusFilter !== 'ALL') {
      result = result.filter((item) => String(item.status_pengajuan) === String(statusFilter));
    }

    // Filter berdasarkan kata kunci nama desa / kecamatan
    if (query.trim() !== '') {
      const q = query.toLowerCase().trim();
      result = result.filter(
        (item) =>
          (item.nama_des_kel && item.nama_des_kel.toLowerCase().includes(q)) ||
          (item.nama_kecamatan && item.nama_kecamatan.toLowerCase().includes(q))
      );
    }

    setFilteredData(result);
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    applyFilterAndSearch(dataMonitoring, text, activeFilter);
  };

  const handleFilterChange = (status) => {
    setActiveFilter(status);
    applyFilterAndSearch(dataMonitoring, searchQuery, status);
  };

  // Kalkulasi statistik status
  const countPending = dataMonitoring.filter((item) => String(item.status_pengajuan) === '1').length;
  const countRejected = dataMonitoring.filter((item) => String(item.status_pengajuan) === '2').length;
  const countApproved = dataMonitoring.filter((item) => String(item.status_pengajuan) === '3').length;

  const renderStatusBadge = (status) => {
    switch (String(status)) {
      case '1':
        return (
          <View style={[styles.badgePill, { backgroundColor: '#FEF3C7' }]}>
            <Text style={[styles.badgePillText, { color: '#B45309' }]}>⏳ Menunggu</Text>
          </View>
        );
      case '2':
        return (
          <View style={[styles.badgePill, { backgroundColor: '#FEE2E2' }]}>
            <Text style={[styles.badgePillText, { color: '#DC2626' }]}>✕ Ditolak</Text>
          </View>
        );
      case '3':
        return (
          <View style={[styles.badgePill, { backgroundColor: '#ECFDF5' }]}>
            <Text style={[styles.badgePillText, { color: '#059669' }]}>✓ Disetujui</Text>
          </View>
        );
      default:
        return (
          <View style={[styles.badgePill, { backgroundColor: '#F1F5F9' }]}>
            <Text style={[styles.badgePillText, { color: '#64748B' }]}>Draft</Text>
          </View>
        );
    }
  };

  return (
    <View style={styles.screenContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0284C7" />

      {/* 1. APPBAR FLAT & MINIMALIS */}
      <View style={styles.appBar}>
        <View style={styles.appBarTitleContainer}>
          <View style={styles.brandTag}>
            <View style={styles.brandDot} />
            <Text style={styles.brandTagText}>VERIFIKASI & MONITORING</Text>
          </View>
          <Text style={styles.appBarTitle}>Status Usulan Batas</Text>
        </View>

        <View style={styles.totalPill}>
          <Text style={styles.totalPillText}>{dataMonitoring.length} Data</Text>
        </View>
      </View>

      {/* 2. JIKA OPERATOR DESA (AKSES TERBATAS) */}
      {userStatus === '2' ? (
        <View style={styles.restrictedContainer}>
          <View style={styles.restrictedIconBox}>
            <FastImage
              style={{ width: 48, height: 48 }}
              source={require('../assets/img/error.png')}
              resizeMode={FastImage.resizeMode.contain}
            />
          </View>
          <Text style={styles.restrictedTitle}>Akses Monitoring Khusus</Text>
          <Text style={styles.restrictedDesc}>
            Halaman Monitoring ini dikhususkan untuk Administrator dan Tim Verifikasi Batas Kabupaten.
            Operator Desa dapat memantau usulan desa langsung melalui menu Usulan.
          </Text>
          <TouchableOpacity
            style={styles.restrictedBtn}
            onPress={() => navigation.navigate('Usulan')}
            activeOpacity={0.7}
          >
            <Text style={styles.restrictedBtnText}>Buka Menu Usulan Desa →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* 3. SEARCH BAR & FILTER PILLS */}
          <View style={styles.searchSection}>
            {/* Input Pencarian */}
            <View style={styles.searchInputContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Cari nama desa atau kecamatan..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={handleSearch}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => handleSearch('')}
                  style={styles.clearSearchBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.clearSearchText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Filter Tabs / Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipScroll}
            >
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  activeFilter === 'ALL' && styles.filterChipActive,
                ]}
                onPress={() => handleFilterChange('ALL')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    activeFilter === 'ALL' && styles.filterChipTextActive,
                  ]}
                >
                  Semua ({dataMonitoring.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterChip,
                  activeFilter === '1' && styles.filterChipActiveAmber,
                ]}
                onPress={() => handleFilterChange('1')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    activeFilter === '1' && styles.filterChipTextAmber,
                  ]}
                >
                  Menunggu ({countPending})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterChip,
                  activeFilter === '3' && styles.filterChipActiveGreen,
                ]}
                onPress={() => handleFilterChange('3')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    activeFilter === '3' && styles.filterChipTextGreen,
                  ]}
                >
                  Disetujui ({countApproved})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterChip,
                  activeFilter === '2' && styles.filterChipActiveRed,
                ]}
                onPress={() => handleFilterChange('2')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    activeFilter === '2' && styles.filterChipTextRed,
                  ]}
                >
                  Ditolak ({countRejected})
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* 4. CONTENT LIST */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0284C7" />
              <Text style={styles.loadingText}>Memuat data monitoring usulan...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.listContainer}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={() => getView(true)}
                  colors={['#0284C7']}
                  tintColor="#0284C7"
                />
              }
            >
              {filteredData.length > 0 ? (
                filteredData.map((item, index) => (
                  <TouchableOpacity
                    key={`monitoring-${index}-${item.id_usulan || index}`}
                    style={styles.cardItem}
                    activeOpacity={0.7}
                    onPress={() =>
                      navigation.navigate('Zona', {
                        ...item,
                        nama_kecamatan: item.nama_kecamatan,
                        nama_des_kel: item.nama_des_kel,
                        id_kecamatan: item.kecamatan_id,
                        id_des_kel: item.des_kel_id,
                        file: item.file,
                        status_pengajuan: item.status_pengajuan,
                      })
                    }
                  >
                    {/* Baris Atas: Nama Desa & Status Badge */}
                    <View style={styles.cardTopRow}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.cardVillageTitle} numberOfLines={1}>
                          {item.nama_des_kel || 'Desa Tanpa Nama'}
                        </Text>
                        <Text style={styles.cardDistrictSub}>
                          📍 Kecamatan {item.nama_kecamatan || '-'}
                        </Text>
                      </View>
                      {renderStatusBadge(item.status_pengajuan)}
                    </View>

                    <View style={styles.cardDivider} />

                    {/* Baris Bawah: Waktu Pengajuan & Aksi */}
                    <View style={styles.cardBottomRow}>
                      <Text style={styles.cardDateText}>
                        📅 Diajukan:{' '}
                        {item.createAt
                          ? moment(item.createAt).format('DD MMM YYYY')
                          : '-'}
                      </Text>
                      <View style={styles.cardActionLink}>
                        <Text style={styles.cardActionText}>Detail Peta</Text>
                        <Text style={styles.cardActionArrow}>›</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>📋</Text>
                  <Text style={styles.emptyTitle}>Tidak Ada Usulan Ditemukan</Text>
                  <Text style={styles.emptyDesc}>
                    {searchQuery.trim() !== ''
                      ? `Tidak ada hasil pencarian untuk "${searchQuery}"`
                      : 'Belum ada usulan batas dengan kriteria status yang dipilih.'}
                  </Text>
                  {(searchQuery !== '' || activeFilter !== 'ALL') && (
                    <TouchableOpacity
                      style={styles.resetFilterBtn}
                      onPress={() => {
                        setSearchQuery('');
                        setActiveFilter('ALL');
                        applyFilterAndSearch(dataMonitoring, '', 'ALL');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.resetFilterBtnText}>Reset Pencarian & Filter</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      )}

      {/* 5. TABBAR BAWAH */}
      <TabBar />
    </View>
  );
};

// ================================================================
// DESIGN SYSTEM STYLING — FLAT & MINIMALIST
// ================================================================
const styles = RNStyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC', // Slate 50 bersih
  },

  // APPBAR
  appBar: {
    paddingTop: 45,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0284C7',
    borderBottomWidth: 1,
    borderBottomColor: '#0369A1',
  },
  appBarTitleContainer: {
    flex: 1,
  },
  brandTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38BDF8',
    marginRight: 6,
  },
  brandTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#BAE6FD',
    letterSpacing: 1,
  },
  appBarTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  totalPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  totalPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // SEARCH & FILTER
  searchSection: {
    backgroundColor: '#FFFFFF',
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    fontSize: 15,
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
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },
  filterChipScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    gap: 8,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#0284C7',
  },
  filterChipActiveAmber: {
    backgroundColor: '#D97706',
  },
  filterChipActiveGreen: {
    backgroundColor: '#059669',
  },
  filterChipActiveRed: {
    backgroundColor: '#DC2626',
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

  // LIST & CARDS
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 30,
  },
  cardItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardVillageTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  cardDistrictSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },
  badgePill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDateText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  cardActionLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
    marginRight: 2,
  },
  cardActionArrow: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284C7',
  },

  // LOADING STATE
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
  },

  // EMPTY STATE
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  resetFilterBtn: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  resetFilterBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284C7',
  },

  // RESTRICTED
  restrictedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  restrictedIconBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  restrictedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  restrictedDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  restrictedBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  restrictedBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});

export default Monitoring;
