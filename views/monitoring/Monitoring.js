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
  Alert,
  StyleSheet as RNStyleSheet,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { useSelector } from 'react-redux';
import { useIsFocused } from '@react-navigation/native';
import moment from 'moment';
import TabBar from '../components/TabBar';
import NavigasiService from '../library/NavigasiService';
import PlacemarkDB from '../library/PlacemarkDB';
import TrackDB from '../library/TrackDB';

// Helper format jarak ringkas
const formatDist = (meters) => {
  if (meters == null || isNaN(meters)) return '0 m';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
};

// Helper arah mata angin
const getCardinal = (deg) => {
  if (deg == null || isNaN(deg)) return '';
  const dirs = ['U', 'TL', 'T', 'TG', 'S', 'BD', 'B', 'BL'];
  return dirs[Math.round(deg / 45) % 8] || '';
};

// Komponen Utama Monitoring
const Monitoring = ({ navigation }) => {
  const isFocused = useIsFocused();
  const token = useSelector((state) => state.TOKEN);
  const profile = useSelector((state) => state.PROFILE);
  const url = useSelector((state) => state.URL);
  const activeNavigation = useSelector((state) => state.ACTIVE_NAVIGATION);
  const offlineQueueCount = useSelector((state) => state.OFFLINE_QUEUE_COUNT);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // State untuk Operator Kabupaten (Verifikasi & Monitoring Seluruh Wilayah)
  const [dataMonitoring, setDataMonitoring] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL'); // ALL, 1 (Menunggu), 2 (Ditolak), 3 (Disetujui)
  const [page, setPage] = useState(1);

  // State khusus Operator Desa (Aktivitas Lapangan & Usulan Desa Sendiri)
  const [placemarkCount, setPlacemarkCount] = useState(0);
  const [trackCount, setTrackCount] = useState(0);
  const [hasActiveTrack, setHasActiveTrack] = useState(false);
  const [desaUsulanList, setDesaUsulanList] = useState([]);
  const [filteredDesaUsulan, setFilteredDesaUsulan] = useState([]);
  const [desaUsulanLoading, setDesaUsulanLoading] = useState(false);
  const [desaActiveFilter, setDesaActiveFilter] = useState('ALL');

  const userStatus = profile?.profile?.status ? String(profile.profile.status) : '1';
  const isOperatorDesa = userStatus === '2';

  const desaName =
    profile?.profile?.des_kel_id?.text ||
    profile?.profile?.nama_desa ||
    profile?.profile?.nama_des_kel ||
    profile?.profile?.nama ||
    'Desa';

  const kecamatanName =
    profile?.profile?.kecamatan?.text ||
    profile?.profile?.nama_kecamatan ||
    '';

  // ================================================================
  // 1. DATA FETCHING UNTUK OPERATOR KABUPATEN
  // ================================================================
  const getView = async (refresh = false) => {
    if (!token) return;
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const idKecamatanUser = profile?.profile?.id_kecamatan;
      const requestBody = {
        data_ke: page,
        cari_value: '',
        id: profile?.id,
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

  // ================================================================
  // 2. DATA FETCHING UNTUK OPERATOR DESA
  // ================================================================
  const fetchDesaActivity = async (refresh = false) => {
    try {
      if (refresh) setIsRefreshing(true);
      else setDesaUsulanLoading(true);

      // 1. Ambil jumlah placemark & tracks offline lokal
      try {
        const pList = await PlacemarkDB.getAll();
        setPlacemarkCount(pList ? pList.length : 0);
      } catch (e) {}

      try {
        const tList = await TrackDB.getAllTracks();
        setTrackCount(tList ? tList.length : 0);
        setHasActiveTrack(TrackDB.hasActiveSession ? TrackDB.hasActiveSession() : false);
      } catch (e) {}

      // 2. Ambil riwayat usulan batas milik desa bersangkutan
      if (token && url?.URL_ADD_ZONA) {
        const idDesaUser = profile?.profile?.id_desa || profile?.profile?.id_des_kel;
        const requestBody = {
          data_ke: 1,
          cari_value: '',
          id: profile?.id,
          status: userStatus,
          ...(idDesaUser && { id_des_kel: idDesaUser }),
        };

        const response = await fetch(url.URL_ADD_ZONA + 'viewUsulanNative', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `kikensbatara ${token}`,
          },
          body: JSON.stringify(requestBody),
        });

        const result = await response.json();
        if (response.ok && Array.isArray(result) && result[0]?.data1) {
          const raw = result[0].data1 || [];
          setDesaUsulanList(raw);
          applyDesaFilter(raw, desaActiveFilter);
        } else {
          setDesaUsulanList([]);
          setFilteredDesaUsulan([]);
        }
      }
    } catch (err) {
      console.warn('[Monitoring] Error fetchDesaActivity:', err);
    } finally {
      setDesaUsulanLoading(false);
      setIsRefreshing(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      if (isOperatorDesa) {
        fetchDesaActivity();
      } else {
        getView();
      }
    }
  }, [isFocused, isOperatorDesa]);

  // ================================================================
  // 3. FILTER & SEARCH LOGIC
  // ================================================================
  const applyFilterAndSearch = (sourceData, query, statusFilter) => {
    let result = sourceData;
    if (statusFilter !== 'ALL') {
      result = result.filter((item) => String(item.status_pengajuan) === String(statusFilter));
    }
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

  const applyDesaFilter = (sourceData, statusFilter) => {
    let result = sourceData;
    if (statusFilter !== 'ALL') {
      result = result.filter((item) => String(item.status_pengajuan) === String(statusFilter));
    }
    setFilteredDesaUsulan(result);
  };

  const handleDesaFilterChange = (status) => {
    setDesaActiveFilter(status);
    applyDesaFilter(desaUsulanList, status);
  };

  // Hentikan navigasi latar belakang
  const handleStopNavigation = () => {
    Alert.alert(
      'Hentikan Navigasi?',
      'Apakah Anda yakin ingin menghentikan penjelajahan koordinat yang sedang aktif di latar belakang?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hentikan',
          style: 'destructive',
          onPress: async () => {
            await NavigasiService.stopNavigation();
          },
        },
      ]
    );
  };

  // Statistik Kabupaten
  const countPending = dataMonitoring.filter((item) => String(item.status_pengajuan) === '1').length;
  const countRejected = dataMonitoring.filter((item) => String(item.status_pengajuan) === '2').length;
  const countApproved = dataMonitoring.filter((item) => String(item.status_pengajuan) === '3').length;

  // Statistik Usulan Desa
  const countDesaPending = desaUsulanList.filter((item) => String(item.status_pengajuan) === '1').length;
  const countDesaRejected = desaUsulanList.filter((item) => String(item.status_pengajuan) === '2').length;
  const countDesaApproved = desaUsulanList.filter((item) => String(item.status_pengajuan) === '3').length;

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

      {/* 1. APPBAR DINAMIS (KABUPATEN VS OPERATOR DESA) */}
      <View style={styles.appBar}>
        <View style={styles.appBarTitleContainer}>
          <View style={styles.brandTag}>
            <View style={styles.brandDot} />
            <Text style={styles.brandTagText}>
              {isOperatorDesa ? 'AKTIVITAS OPERATOR DESA' : 'VERIFIKASI & MONITORING'}
            </Text>
          </View>
          <Text style={styles.appBarTitle}>
            {isOperatorDesa ? 'Monitoring Lapangan' : 'Status Usulan Batas'}
          </Text>
        </View>

        <View style={styles.totalPill}>
          <Text style={styles.totalPillText} numberOfLines={1}>
            {isOperatorDesa
              ? (desaName.length > 15 ? desaName.slice(0, 13) + '..' : desaName)
              : `${dataMonitoring.length} Data`}
          </Text>
        </View>
      </View>

      {/* ================================================================
          2. KONTEN TAMPILAN OPERATOR DESA (PUSAT AKTIVITAS LAPANGAN)
      ================================================================ */}
      {isOperatorDesa ? (
        <ScrollView
          style={styles.desaScroll}
          contentContainerStyle={styles.desaScrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchDesaActivity(true)}
              colors={['#0284C7']}
              tintColor="#0284C7"
            />
          }
        >
          {/* SECTION 1: STATUS NAVIGASI LAPANGAN (PINDAHAN DARI HOME) */}
          {activeNavigation && activeNavigation.isNavigating ? (
            <View style={styles.desaNavActiveCard}>
              <View style={styles.desaNavHeaderRow}>
                <View style={styles.desaNavBadge}>
                  <View style={styles.pulsingGreenDot} />
                  <Text style={styles.desaNavBadgeText}>NAVIGASI AKTIF (LATAR BELAKANG)</Text>
                </View>
                <TouchableOpacity
                  onPress={handleStopNavigation}
                  style={styles.desaNavStopBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.desaNavStopText}>⏹ Hentikan</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.desaNavTargetTitle} numberOfLines={1}>
                {activeNavigation.targetName || 'Titik Target'}
              </Text>
              {activeNavigation.targetLat != null && activeNavigation.targetLng != null && (
                <Text style={styles.desaNavCoordSub}>
                  📍 Lat: {activeNavigation.targetLat.toFixed(5)}, Lng: {activeNavigation.targetLng.toFixed(5)}
                </Text>
              )}

              {/* Strip Metrik Navigasi */}
              <View style={styles.desaNavMetricsStrip}>
                <View style={styles.desaNavMetricCol}>
                  <Text style={styles.desaNavMetricLabel}>JARAK TERSISA</Text>
                  <Text style={styles.desaNavMetricValueCyan}>{formatDist(activeNavigation.distance)}</Text>
                </View>
                <View style={styles.desaNavMetricDivider} />
                <View style={styles.desaNavMetricCol}>
                  <Text style={styles.desaNavMetricLabel}>ARAH TARGET</Text>
                  <Text style={styles.desaNavMetricValueWhite}>
                    {Math.round(activeNavigation.bearing || 0)}° {getCardinal(activeNavigation.bearing)}
                  </Text>
                </View>
                <View style={styles.desaNavMetricDivider} />
                <View style={styles.desaNavMetricCol}>
                  <Text style={styles.desaNavMetricLabel}>AKURASI GPS</Text>
                  <Text style={styles.desaNavMetricValueGreen}>
                    {activeNavigation.gpsAccuracy ? `±${Math.round(activeNavigation.gpsAccuracy)}m` : 'Tersambung'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.desaNavActionPrimary}
                onPress={() => navigation.navigate('NavigasiKoordinat')}
                activeOpacity={0.85}
              >
                <Text style={styles.desaNavActionPrimaryText}>🧭 Buka Layar Navigasi & Kompas ›</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.desaNavStandbyCard}>
              <View style={styles.desaNavStandbyLeft}>
                <View style={styles.desaNavStandbyIconBox}>
                  <Text style={{ fontSize: 22 }}>🧭</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.desaNavStandbyTitle}>Navigasi Titik Batas</Text>
                  <Text style={styles.desaNavStandbySub}>Siap menuntun pencarian titik patok GPS secara offline.</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.desaNavStandbyBtn}
                onPress={() => navigation.navigate('NavigasiKoordinat')}
                activeOpacity={0.8}
              >
                <Text style={styles.desaNavStandbyBtnText}>Mulai ›</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* SECTION 2: RINGKASAN METRIK AKTIVITAS LAPANGAN DESA */}
          <View style={styles.desaSectionContainer}>
            <Text style={styles.desaSectionTitle}>Aktivitas Lapangan Desa</Text>
            <Text style={styles.desaSectionSub}>
              {desaName} {kecamatanName ? `• Kec. ${kecamatanName}` : ''}
            </Text>

            <View style={styles.desaGrid}>
              {/* 1. Placemark Titik Patok */}
              <TouchableOpacity
                style={styles.desaGridCard}
                onPress={() => navigation.navigate('PlacemarkList')}
                activeOpacity={0.75}
              >
                <View style={[styles.desaGridIconBox, { backgroundColor: '#E0F2FE' }]}>
                  <Text style={{ fontSize: 20 }}>📍</Text>
                </View>
                <Text style={styles.desaGridCount}>{placemarkCount}</Text>
                <Text style={styles.desaGridLabel}>Titik Patok Batas</Text>
                <Text style={styles.desaGridAction}>Buka Patok ›</Text>
              </TouchableOpacity>

              {/* 2. Track Recorder */}
              <TouchableOpacity
                style={styles.desaGridCard}
                onPress={() => navigation.navigate('TrackRecorder')}
                activeOpacity={0.75}
              >
                <View style={[styles.desaGridIconBox, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={{ fontSize: 20 }}>🛤</Text>
                </View>
                <Text style={styles.desaGridCount}>
                  {trackCount} {hasActiveTrack ? '🔴' : ''}
                </Text>
                <Text style={styles.desaGridLabel}>Trek Jejak Rute</Text>
                <Text style={styles.desaGridAction}>Rekam Jejak ›</Text>
              </TouchableOpacity>

              {/* 3. Geotagging Foto */}
              <TouchableOpacity
                style={styles.desaGridCard}
                onPress={() => navigation.navigate('GeoTagCamera')}
                activeOpacity={0.75}
              >
                <View style={[styles.desaGridIconBox, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={{ fontSize: 20 }}>📷</Text>
                </View>
                <Text style={styles.desaGridCount}>Kamera</Text>
                <Text style={styles.desaGridLabel}>Foto Geotag Patok</Text>
                <Text style={styles.desaGridAction}>Ambil Foto ›</Text>
              </TouchableOpacity>

              {/* 4. Antrean Offline */}
              <TouchableOpacity
                style={styles.desaGridCard}
                onPress={() => navigation.navigate('OfflineSync')}
                activeOpacity={0.75}
              >
                <View style={[styles.desaGridIconBox, { backgroundColor: '#F3E8FF' }]}>
                  <Text style={{ fontSize: 20 }}>🔄</Text>
                </View>
                <Text style={styles.desaGridCount}>{offlineQueueCount || 0}</Text>
                <Text style={styles.desaGridLabel}>Antrean Offline</Text>
                <Text style={styles.desaGridAction}>Kelola Sinkron ›</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* SECTION 3: STATUS USULAN BATAS DESA SAYA */}
          <View style={styles.desaSectionContainer}>
            <View style={styles.desaUsulanHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.desaSectionTitle}>Status Usulan Batas Desa</Text>
                <Text style={styles.desaSectionSub}>Daftar pengajuan batas wilayah desa ke Kabupaten</Text>
              </View>
              <TouchableOpacity
                style={styles.desaAddUsulanBtn}
                onPress={() => navigation.navigate('AddUsulan')}
                activeOpacity={0.8}
              >
                <Text style={styles.desaAddUsulanText}>+ Buat Usulan</Text>
              </TouchableOpacity>
            </View>

            {/* Filter Chips Usulan Desa */}
            <View style={styles.desaFilterChipsRow}>
              <TouchableOpacity
                style={[styles.filterChip, desaActiveFilter === 'ALL' && styles.filterChipActive]}
                onPress={() => handleDesaFilterChange('ALL')}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, desaActiveFilter === 'ALL' && styles.filterChipTextActive]}>
                  Semua ({desaUsulanList.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterChip, desaActiveFilter === '1' && styles.filterChipActiveAmber]}
                onPress={() => handleDesaFilterChange('1')}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, desaActiveFilter === '1' && styles.filterChipTextAmber]}>
                  Menunggu ({countDesaPending})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterChip, desaActiveFilter === '3' && styles.filterChipActiveGreen]}
                onPress={() => handleDesaFilterChange('3')}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, desaActiveFilter === '3' && styles.filterChipTextGreen]}>
                  Disetujui ({countDesaApproved})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterChip, desaActiveFilter === '2' && styles.filterChipActiveRed]}
                onPress={() => handleDesaFilterChange('2')}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, desaActiveFilter === '2' && styles.filterChipTextRed]}>
                  Ditolak ({countDesaRejected})
                </Text>
              </TouchableOpacity>
            </View>

            {/* List Usulan Desa */}
            {desaUsulanLoading ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#0284C7" />
                <Text style={{ marginTop: 8, color: '#64748B', fontSize: 12 }}>Memuat data usulan desa...</Text>
              </View>
            ) : filteredDesaUsulan.length === 0 ? (
              <View style={styles.desaEmptyCard}>
                <Text style={{ fontSize: 28, marginBottom: 8 }}>📋</Text>
                <Text style={styles.desaEmptyTitle}>Belum Ada Usulan</Text>
                <Text style={styles.desaEmptySub}>
                  {desaActiveFilter === 'ALL'
                    ? 'Belum ada usulan batas yang diajukan oleh desa ini. Mulai dengan membuat usulan batas baru.'
                    : 'Tidak ada usulan batas dengan status filter yang dipilih.'}
                </Text>
                <TouchableOpacity
                  style={styles.desaEmptyAddBtn}
                  onPress={() => navigation.navigate('AddUsulan')}
                  activeOpacity={0.75}
                >
                  <Text style={styles.desaEmptyAddBtnText}>+ Buat Usulan Batas Baru</Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredDesaUsulan.map((item, idx) => (
                <TouchableOpacity
                  key={`desa-usulan-${item.id || idx}`}
                  style={styles.cardItem}
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
                  activeOpacity={0.75}
                >
                  <View style={styles.cardTopRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.cardVillageTitle} numberOfLines={1}>
                        {item.nama || 'Usulan Batas'}
                      </Text>
                      <Text style={styles.cardDistrictSub}>
                        {item.nama_des_kel || desaName} • {item.nama_kecamatan || kecamatanName}
                      </Text>
                    </View>
                    {renderStatusBadge(item.status_pengajuan)}
                  </View>

                  <View style={styles.cardDivider} />

                  <View style={styles.cardBottomRow}>
                    <Text style={styles.cardDateText}>
                      📅 {item.created_at ? moment(item.created_at).format('DD MMM YYYY, HH:mm') : '-'}
                    </Text>
                    <View style={styles.cardActionLink}>
                      <Text style={styles.cardActionText}>Lihat Detail</Text>
                      <Text style={styles.cardActionArrow}>›</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      ) : (
        /* ================================================================
            3. KONTEN OPERATOR KABUPATEN (VERIFIKASI & MONITORING REGIONAL)
        ================================================================ */
        <View style={{ flex: 1 }}>
          {/* SEARCH BAR & FILTER PILLS */}
          <View style={styles.searchSection}>
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

            {/* Status Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipScroll}
            >
              <TouchableOpacity
                style={[styles.filterChip, activeFilter === 'ALL' && styles.filterChipActive]}
                onPress={() => handleFilterChange('ALL')}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, activeFilter === 'ALL' && styles.filterChipTextActive]}>
                  Semua ({dataMonitoring.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, activeFilter === '1' && styles.filterChipActiveAmber]}
                onPress={() => handleFilterChange('1')}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, activeFilter === '1' && styles.filterChipTextAmber]}>
                  Menunggu ({countPending})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, activeFilter === '3' && styles.filterChipActiveGreen]}
                onPress={() => handleFilterChange('3')}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, activeFilter === '3' && styles.filterChipTextGreen]}>
                  Disetujui ({countApproved})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, activeFilter === '2' && styles.filterChipActiveRed]}
                onPress={() => handleFilterChange('2')}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, activeFilter === '2' && styles.filterChipTextRed]}>
                  Ditolak ({countRejected})
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* CONTENT LIST KABUPATEN */}
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
                    <View style={styles.cardTopRow}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.cardVillageTitle} numberOfLines={1}>
                          {item.nama_des_kel && item.nama_des_kel !== 'undefined'
                            ? item.nama_des_kel
                            : 'Batas Tanpa Nama'}
                        </Text>
                        <Text style={styles.cardDistrictSub}>
                          📍 Kecamatan{' '}
                          {item.nama_kecamatan && item.nama_kecamatan !== 'undefined'
                            ? item.nama_kecamatan
                            : '-'}
                        </Text>
                      </View>
                      {renderStatusBadge(item.status_pengajuan)}
                    </View>

                    <View style={styles.cardDivider} />

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

      {/* 4. TABBAR BAWAH */}
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
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
    maxWidth: 130,
  },
  totalPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // ==================== OPERATOR DESA STYLES ====================
  desaScroll: {
    flex: 1,
  },
  desaScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // CARD NAVIGASI AKTIF
  desaNavActiveCard: {
    backgroundColor: '#0F172A', // Slate 900
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    shadowColor: '#0284C7',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 16,
  },
  desaNavHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  desaNavBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulsingGreenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    marginRight: 6,
  },
  desaNavBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  desaNavStopBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  desaNavStopText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FCA5A5',
  },
  desaNavTargetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  desaNavCoordSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 12,
  },
  desaNavMetricsStrip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  desaNavMetricCol: {
    flex: 1,
    alignItems: 'center',
  },
  desaNavMetricDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  desaNavMetricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 2,
  },
  desaNavMetricValueCyan: {
    fontSize: 14,
    fontWeight: '800',
    color: '#38BDF8',
  },
  desaNavMetricValueWhite: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  desaNavMetricValueGreen: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4ADE80',
  },
  desaNavActionPrimary: {
    backgroundColor: '#0284C7',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desaNavActionPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  // CARD NAVIGASI STANDBY
  desaNavStandbyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  desaNavStandbyLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  desaNavStandbyIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  desaNavStandbyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  desaNavStandbySub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  desaNavStandbyBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  desaNavStandbyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // SECTION UMUM DESA
  desaSectionContainer: {
    marginBottom: 20,
  },
  desaSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  desaSectionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 12,
  },

  // GRID AKTIVITAS LAPANGAN 2x2
  desaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  desaGridCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  desaGridIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  desaGridCount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  desaGridLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 8,
  },
  desaGridAction: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },

  // USULAN DESA HEADER & ACTION
  desaUsulanHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  desaAddUsulanBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  desaAddUsulanText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  desaFilterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },

  // EMPTY STATE DESA
  desaEmptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  desaEmptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  desaEmptySub: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 14,
  },
  desaEmptyAddBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  desaEmptyAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },

  // ==================== OPERATOR KABUPATEN STYLES ====================
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
});

export default Monitoring;
