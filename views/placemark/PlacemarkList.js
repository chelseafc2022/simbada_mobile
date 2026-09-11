/**
 * PlacemarkList.js — Modul 5: Daftar Semua Placemark
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { useDispatch } from 'react-redux';
import PlacemarkDB from '../library/PlacemarkDB';

const SYMBOL_EMOJI = {
  pin_merah:'📍', pin_biru:'📌', bangunan:'🏠', pohon:'🌳', air:'💧',
  jalan:'🛤', bahaya:'⚠️', temuan:'🔍', sampel:'🧪', fotografi:'📷',
  bintang:'⭐', titik:'●',
};

const PlacemarkItem = React.memo(({ item, onPress, onLongPress }) => (
  <TouchableOpacity style={styles.card} onPress={() => onPress(item)} onLongPress={() => onLongPress(item)}>
    <View style={styles.symbolBox}>
      <Text style={styles.symbolEmoji}>{SYMBOL_EMOJI[item.simbol] ?? '●'}</Text>
    </View>
    <View style={styles.cardBody}>
      <Text style={styles.cardTitle} numberOfLines={1}>{item.judul}</Text>
      <Text style={styles.cardCoord}>
        {item.lat.toFixed(5)}°, {item.lon.toFixed(5)}°
      </Text>
      <Text style={styles.cardAcc}>±{Math.round(item.accH)} m  ·  {item.foto?.length ?? 0} foto</Text>
    </View>
    <Text style={styles.cardArrow}>›</Text>
  </TouchableOpacity>
));

const PlacemarkList = ({ navigation }) => {
  const dispatch = useDispatch();
  const [all, setAll] = useState([]);
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    PlacemarkDB.getAll().then(list => {
      setAll(list);
      dispatch({ type: 'SET_PLACEMARK_COUNT', payload: list.length });
    });
  }, []);

  useFocusEffect(load);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? all.filter(p => p.judul.toLowerCase().includes(q) || p.deskripsi?.toLowerCase().includes(q)) : all;
  }, [search, all]);

  const handleDelete = (item) => {
    Alert.alert('Hapus Placemark?', `"${item.judul}" akan dihapus permanen.`, [
      { text: 'Hapus', style: 'destructive', onPress: async () => {
        await PlacemarkDB.delete(item.id);
        load();
      }},
      { text: 'Batal', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Placemark</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => navigation.navigate('PlacemarkMap', { placemarks: all })}>
            <Text style={styles.mapBtn}>🗺 Peta</Text>
          </TouchableOpacity>
          <View style={styles.badge}><Text style={styles.badgeTxt}>{all.length}</Text></View>
        </View>
      </LinearGradient>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Cari nama atau deskripsi..."
          placeholderTextColor="#94A3B8"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <PlacemarkItem
            item={item}
            onPress={pm => navigation.navigate('PlacemarkForm', { placemark: pm })}
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
            <Text style={styles.emptyIcon}>📍</Text>
            <Text style={styles.emptyText}>
              {search ? 'Tidak ada hasil pencarian' : 'Belum ada placemark.\nKetuk tombol + untuk menambahkan.'}
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('PlacemarkForm', {})}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center',
  },
  back: { color: '#208DC0', fontSize: 16, fontWeight: '700', marginRight: 12 },
  title: { color: '#fff', fontSize: 20, fontWeight: '800', flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mapBtn: { color: '#fff', fontSize: 13, fontWeight: '700' },
  badge: {
    backgroundColor: '#208DC0', borderRadius: 12, minWidth: 24,
    height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  badgeTxt: { color: '#fff', fontSize: 11, fontWeight: '800' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    margin: 16, backgroundColor: '#fff', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 6,
  },
  searchIcon: { fontSize: 16, marginRight: 10 },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A' },
  clearBtn: { color: '#94A3B8', fontSize: 16, paddingLeft: 8 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 20, padding: 14, marginBottom: 10,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 6,
  },
  symbolBox: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  symbolEmoji: { fontSize: 22 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  cardCoord: { fontSize: 11, color: '#64748B', marginTop: 3, fontFamily: 'monospace' },
  cardAcc: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  cardArrow: { color: '#CBD5E1', fontSize: 20 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 60, marginBottom: 16 },
  emptyText: { color: '#94A3B8', fontSize: 15, textAlign: 'center', lineHeight: 24 },
  fab: {
    position: 'absolute', right: 20, bottom: 30,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#208DC0', alignItems: 'center', justifyContent: 'center',
    elevation: 10, shadowColor: '#208DC0', shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 16,
  },
  fabText: { color: '#fff', fontSize: 30, lineHeight: 34 },
});

export default PlacemarkList;
