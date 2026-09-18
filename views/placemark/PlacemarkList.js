/**
 * PlacemarkList.js — Modul 5: Daftar Semua Placemark (Per-User)
 *
 * Perubahan:
 * - Header disamakan dengan halaman lain (blue appbar modern)
 * - Data per-user: setiap user hanya melihat placemark miliknya sendiri
 * - Tab "Publik" untuk melihat placemark dari user lain yang dibagikan
 * - Info pemilik ditampilkan di card placemark publik
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, StatusBar,
} from 'react-native';
import AppHeader from '../components/AppHeader';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import PlacemarkDB from '../library/PlacemarkDB';

const SYMBOL_EMOJI = {
  pin_merah:'📍', pin_biru:'📌', bangunan:'🏠', pohon:'🌳', air:'💧',
  jalan:'🛤', bahaya:'⚠️', temuan:'🔍', sampel:'🧪', fotografi:'📷',
  bintang:'⭐', titik:'●',
};

const PlacemarkItem = React.memo(({ item, onPress, onLongPress, isPublicItem }) => (
  <TouchableOpacity
    style={[styles.card, isPublicItem && styles.cardPublic]}
    onPress={() => onPress(item)}
    onLongPress={() => !isPublicItem && onLongPress(item)}
    activeOpacity={0.75}
  >
    <View style={[styles.symbolBox, isPublicItem && styles.symbolBoxPublic]}>
      <Text style={styles.symbolEmoji}>{SYMBOL_EMOJI[item.simbol] ?? '●'}</Text>
    </View>
    <View style={styles.cardBody}>
      <View style={styles.cardTitleRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.judul}</Text>
        {item.isPublic && (
          <View style={styles.publicBadge}>
            <Text style={styles.publicBadgeText}>🌐 Publik</Text>
          </View>
        )}
      </View>
      <Text style={styles.cardCoord}>
        {item.lat.toFixed(5)}°, {item.lon.toFixed(5)}°
      </Text>
      {isPublicItem && item.ownerInfo && (
        <Text style={styles.cardOwner} numberOfLines={1}>
          👤 {item.ownerInfo.nama || 'Pengguna Lain'}
          {item.ownerInfo.desa ? ` • ${item.ownerInfo.desa}` : ''}
        </Text>
      )}
      {!isPublicItem && (
        <Text style={styles.cardAcc}>±{Math.round(item.accH ?? 0)} m  ·  {item.foto?.length ?? 0} foto</Text>
      )}
    </View>
    <Text style={styles.cardArrow}>›</Text>
  </TouchableOpacity>
));

const PlacemarkList = ({ navigation }) => {
  const token = useSelector((state) => state.TOKEN);
  const urlPlacemark = useSelector((state) => state.URL?.URL_PLACEMARK);
  const profile = useSelector((state) => state.PROFILE);
  const userId = profile?.id || null;
  const ownerInfo = {
    userId,
    nama: profile?.profile?.nama || profile?.nama || 'Pengguna',
    desa: profile?.profile?.des_kel_id?.text || profile?.profile?.nama_desa || '',
    kecamatan: profile?.profile?.kecamatan?.text || profile?.profile?.nama_kecamatan || '',
  };

  const [all, setAll] = useState([]);
  const [publicList, setPublicList] = useState([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('SAYA'); // 'SAYA' | 'PUBLIK'

  const load = useCallback(async () => {
    // 1. Tampilkan data lokal secara instan (Offline-First)
    await PlacemarkDB.migrateOldData(userId);

    const myList = await PlacemarkDB.getAll(userId);
    setAll(myList);
    dispatch({ type: 'SET_PLACEMARK_COUNT', payload: myList.length });

    const pubList = await PlacemarkDB.getAllPublic();
    const otherPublic = pubList.filter(p => p.userId !== userId);
    setPublicList(otherPublic);

    // 2. Sinkronkan dengan server backend di background jika online
    if (userId && token && urlPlacemark) {
      PlacemarkDB.syncWithServer(userId, token, urlPlacemark).then(async (res) => {
        if (res.success) {
          const refreshedMy = await PlacemarkDB.getAll(userId);
          setAll(refreshedMy);
          dispatch({ type: 'SET_PLACEMARK_COUNT', payload: refreshedMy.length });

          const refreshedPub = await PlacemarkDB.getAllPublic();
          setPublicList(refreshedPub.filter(p => p.userId !== userId));
        }
      });
    }
  }, [userId, token, urlPlacemark, dispatch]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filteredMy = useMemo(() => {
    const q = search.toLowerCase();
    return q
      ? all.filter(p => p.judul.toLowerCase().includes(q) || p.deskripsi?.toLowerCase().includes(q))
      : all;
  }, [search, all]);

  const filteredPublic = useMemo(() => {
    const q = search.toLowerCase();
    return q
      ? publicList.filter(p =>
          p.judul.toLowerCase().includes(q) ||
          p.ownerInfo?.nama?.toLowerCase().includes(q) ||
          p.ownerInfo?.desa?.toLowerCase().includes(q)
        )
      : publicList;
  }, [search, publicList]);

  const handleDelete = (item) => {
    Alert.alert('Hapus Placemark?', `"${item.judul}" akan dihapus permanen.`, [
      { text: 'Hapus', style: 'destructive', onPress: async () => {
        await PlacemarkDB.delete(userId, item.id, { urlPlacemark, token });
        load();
      }},
      { text: 'Batal', style: 'cancel' },
    ]);
  };

  const displayData = activeTab === 'SAYA' ? filteredMy : filteredPublic;
  const isPublicTab = activeTab === 'PUBLIK';

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header Reusable */}
      <AppHeader
        title="📍 Daftar Placemark"
        navigation={navigation}
        rightComponent={
          <TouchableOpacity
            onPress={() => navigation.navigate('PlacemarkMap', {
              placemarks: [...all, ...publicList],
              myPlacemarks: all,
              publicPlacemarks: publicList,
              initialFilter: activeTab === 'PUBLIK' ? 'PUBLIK' : 'SEMUA',
            })}
            style={styles.headerMapBtn}
          >
            <Text style={styles.headerMapBtnText}>🗺 Peta</Text>
          </TouchableOpacity>
        }
      />

      {/* SEARCH BAR */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={isPublicTab ? 'Cari nama, pemilik, atau desa...' : 'Cari nama atau deskripsi...'}
          placeholderTextColor="#94A3B8"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* TAB: MILIK SAYA | PUBLIK */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'SAYA' && styles.tabBtnActive]}
          onPress={() => setActiveTab('SAYA')}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabBtnText, activeTab === 'SAYA' && styles.tabBtnTextActive]}>
            📍 Milik Saya ({all.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'PUBLIK' && styles.tabBtnActive]}
          onPress={() => setActiveTab('PUBLIK')}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabBtnText, activeTab === 'PUBLIK' && styles.tabBtnTextActive]}>
            🌐 Publik ({publicList.length})
          </Text>
        </TouchableOpacity>
      </View>

      {isPublicTab && (
        <View style={styles.publicInfoBanner}>
          <Text style={styles.publicInfoText}>
            📋 Placemark ini dibagikan oleh operator desa lain. Klik untuk melihat detail dan navigasi.
          </Text>
        </View>
      )}

      {/* LIST */}
      <FlatList
        data={displayData}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <PlacemarkItem
            item={item}
            isPublicItem={isPublicTab}
            onPress={pm => navigation.navigate('PlacemarkForm', { placemark: pm, readOnly: isPublicTab })}
            onLongPress={handleDelete}
          />
        )}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        getItemLayout={(_, i) => ({ length: 88, offset: 88 * i, index: i })}
        maxToRenderPerBatch={15}
        windowSize={5}
        removeClippedSubviews
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{isPublicTab ? '🌐' : '📍'}</Text>
            <Text style={styles.emptyText}>
              {search
                ? 'Tidak ada hasil pencarian'
                : isPublicTab
                ? 'Belum ada placemark publik dari pengguna lain.'
                : 'Belum ada placemark.\nKetuk tombol + untuk menambahkan.'}
            </Text>
          </View>
        }
      />

      {/* FAB — Tambah baru (hanya di tab "Milik Saya") */}
      {!isPublicTab && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('PlacemarkForm', { placemark: null, ownerInfo })}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },

  headerMapBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  headerMapBtnText: {
    color: '#208DC0',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // SEARCH BAR
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 14,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
  searchIcon: { fontSize: 15, marginRight: 10 },
  searchInput: { flex: 1, fontSize: 13, color: '#0F172A' },
  clearBtn: { color: '#94A3B8', fontSize: 16, paddingLeft: 8 },

  // TAB
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginBottom: 8,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },

  // INFO BANNER PUBLIK
  publicInfoBanner: {
    marginHorizontal: 14,
    marginBottom: 6,
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#0284C7',
  },
  publicInfoText: {
    fontSize: 11,
    color: '#0369A1',
    lineHeight: 16,
  },

  // CARD
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardPublic: {
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
  },
  symbolBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  symbolBoxPublic: {
    backgroundColor: '#E0F2FE',
  },
  symbolEmoji: { fontSize: 22 },
  cardBody: { flex: 1 },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  publicBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  publicBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#3B82F6',
  },
  cardCoord: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  cardOwner: {
    fontSize: 10,
    color: '#0369A1',
    marginTop: 3,
    fontWeight: '600',
  },
  cardAcc: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  cardArrow: { color: '#CBD5E1', fontSize: 20 },

  // EMPTY
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 60, marginBottom: 16 },
  emptyText: { color: '#94A3B8', fontSize: 14, textAlign: 'center', lineHeight: 22 },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#0284C7',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
  },
  fabText: { color: '#fff', fontSize: 30, lineHeight: 34 },
});

export default PlacemarkList;
