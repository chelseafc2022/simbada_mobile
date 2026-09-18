/**
 * PlacemarkMap.js — Modul 5: Peta Semua Placemark (Redesign)
 *
 * Fitur:
 * - Header standar AppHeader
 * - Dukungan titik milik sendiri DAN titik publik dari user lain
 * - Tab Filter: Semua, Milik Saya, Publik
 * - Custom Marker Pin menampilkan gambar icon/simbol yang dipilih (misal: 🏠 Rumah, 🌳 Pohon, dll)
 * - Layer selector (satelit/jalan/medan)
 * - Callout info lengkap dengan status pemilik publik & navigasi
 */

import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
} from 'react-native';
import { useSelector } from 'react-redux';
import MapView, { Marker, Callout } from 'react-native-maps';
import AppHeader from '../components/AppHeader';
import PlacemarkDB from '../library/PlacemarkDB';

const SYMBOL_EMOJI = {
  pin_merah:'📍', pin_biru:'📌', bangunan:'🏠', pohon:'🌳', air:'💧',
  jalan:'🛤', bahaya:'⚠️', temuan:'🔍', sampel:'🧪', fotografi:'📷',
  bintang:'⭐', titik:'●',
};

const PIN_COLOR = {
  pin_merah:'#EF4444', pin_biru:'#0284C7', bangunan:'#F59E0B',
  pohon:'#22C55E', air:'#06B6D4', jalan:'#94A3B8', bahaya:'#F97316',
  temuan:'#8B5CF6', sampel:'#EC4899', fotografi:'#0EA5E9',
  bintang:'#EAB308', titik:'#64748B',
};

const MAP_TYPES = [
  { id: 'satellite', label: '🛰 Satelit' },
  { id: 'standard', label: '🗺 Jalan' },
  { id: 'terrain', label: '🏔 Medan' },
];

const PlacemarkMap = ({ navigation, route }) => {
  const profile = useSelector((state) => state.PROFILE);
  const token = useSelector((state) => state.TOKEN);
  const urlPlacemark = useSelector((state) => state.URL?.URL_PLACEMARK);
  const userId = profile?.id || null;

  const initialPlacemarks = route?.params?.placemarks ?? [];
  const initialMy = route?.params?.myPlacemarks ?? [];
  const initialPublic = route?.params?.publicPlacemarks ?? [];
  const initialFilter = route?.params?.initialFilter ?? 'SEMUA';

  const [myList, setMyList] = useState(initialMy.length ? initialMy : initialPlacemarks.filter(p => p.userId === userId));
  const [publicList, setPublicList] = useState(initialPublic.length ? initialPublic : initialPlacemarks.filter(p => p.userId !== userId && p.isPublic));
  const [filterTab, setFilterTab] = useState(initialFilter); // 'SEMUA' | 'SAYA' | 'PUBLIK'
  const [mapType, setMapType] = useState('satellite');
  const mapRef = useRef(null);

  // Selalu muat data terkini dari PlacemarkDB dan sinkronkan dengan server
  useEffect(() => {
    let isActive = true;
    (async () => {
      // 1. Tampilkan lokal instan
      const mine = await PlacemarkDB.getAll(userId);
      const pubs = await PlacemarkDB.getAllPublic();
      const otherPubs = pubs.filter(p => p.userId !== userId);
      if (isActive) {
        setMyList(mine);
        setPublicList(otherPubs);
      }

      // 2. Sinkronkan dengan server backend di background
      if (userId && token && urlPlacemark) {
        PlacemarkDB.syncWithServer(userId, token, urlPlacemark).then(async (res) => {
          if (res.success && isActive) {
            const refreshedMine = await PlacemarkDB.getAll(userId);
            const refreshedPubs = await PlacemarkDB.getAllPublic();
            setMyList(refreshedMine);
            setPublicList(refreshedPubs.filter(p => p.userId !== userId));
          }
        });
      }
    })();
    return () => { isActive = false; };
  }, [userId, token, urlPlacemark]);

  // Filter placemarks sesuai tab aktif
  const displayPlacemarks = useMemo(() => {
    if (filterTab === 'SAYA') return myList;
    if (filterTab === 'PUBLIK') return publicList;
    // 'SEMUA'
    const myIds = new Set(myList.map(p => p.id));
    return [...myList, ...publicList.filter(p => !myIds.has(p.id))];
  }, [filterTab, myList, publicList]);

  // Zoom region otomatis menyesuaikan titik yang tampil
  const region = useMemo(() => {
    if (!displayPlacemarks.length) {
      return { latitude: -4.2, longitude: 122.35, latitudeDelta: 0.5, longitudeDelta: 0.5 };
    }
    const lats = displayPlacemarks.map(p => p.lat);
    const lons = displayPlacemarks.map(p => p.lon);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.max(maxLat - minLat, 0.005) * 1.6,
      longitudeDelta: Math.max(maxLon - minLon, 0.005) * 1.6,
    };
  }, [displayPlacemarks]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header Reusable */}
      <AppHeader
        title="📍 Peta Placemark"
        navigation={navigation}
      />

      {/* TOOLBAR: LAYER & FILTER TABS */}
      <View style={styles.topControlContainer}>
        {/* Layer Selector */}
        <View style={styles.layerBar}>
          {MAP_TYPES.map(lt => (
            <TouchableOpacity
              key={lt.id}
              style={[styles.layerBtn, mapType === lt.id && styles.layerBtnActive]}
              onPress={() => setMapType(lt.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.layerBtnText, mapType === lt.id && styles.layerBtnTextActive]}>
                {lt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Filter Tab: Semua | Milik Saya | Publik */}
        <View style={styles.filterBar}>
          <TouchableOpacity
            style={[styles.filterBtn, filterTab === 'SEMUA' && styles.filterBtnActive]}
            onPress={() => setFilterTab('SEMUA')}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterBtnText, filterTab === 'SEMUA' && styles.filterBtnTextActive]}>
              Semua ({myList.length + publicList.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterBtn, filterTab === 'SAYA' && styles.filterBtnActive]}
            onPress={() => setFilterTab('SAYA')}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterBtnText, filterTab === 'SAYA' && styles.filterBtnTextActive]}>
              📍 Saya ({myList.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterBtn, filterTab === 'PUBLIK' && styles.filterBtnActive]}
            onPress={() => setFilterTab('PUBLIK')}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterBtnText, filterTab === 'PUBLIK' && styles.filterBtnTextActive]}>
              🌐 Publik ({publicList.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        provider="google"
        mapType={mapType}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton
      >
        {displayPlacemarks.map((pm) => {
          const pinColor = PIN_COLOR[pm.simbol] || '#208DC0';
          const emojiIcon = SYMBOL_EMOJI[pm.simbol] || '📍';
          const isOtherPublic = pm.userId !== userId && pm.isPublic;

          return (
            <Marker
              key={pm.id}
              coordinate={{ latitude: pm.lat, longitude: pm.lon }}
              title={pm.judul}
              anchor={{ x: 0.5, y: 1.0 }}
              calloutAnchor={{ x: 0.5, y: 0 }}
            >
              {/* Custom Pin Icon (Rumah 🏠, Batas 📍, dll) */}
              <View style={styles.markerWrapper}>
                <View style={[styles.markerBubble, { backgroundColor: pinColor }]}>
                  <Text style={styles.markerEmoji}>{emojiIcon}</Text>
                </View>
                <View style={[styles.markerArrow, { borderTopColor: pinColor }]} />
              </View>

              {/* Callout Info */}
              <Callout
                onPress={() => navigation.navigate('PlacemarkForm', {
                  placemark: pm,
                  readOnly: isOtherPublic,
                })}
              >
                <View style={styles.callout}>
                  <Text style={styles.calloutEmoji}>{emojiIcon}</Text>
                  <Text style={styles.calloutTitle} numberOfLines={2}>{pm.judul}</Text>
                  <Text style={styles.calloutCoord}>
                    {pm.lat.toFixed(5)}, {pm.lon.toFixed(5)}
                  </Text>
                  {pm.deskripsi ? (
                    <Text style={styles.calloutDesc} numberOfLines={2}>{pm.deskripsi}</Text>
                  ) : null}

                  {/* Info pemilik jika placemark publik */}
                  {pm.ownerInfo && isOtherPublic && (
                    <View style={styles.calloutOwner}>
                      <Text style={styles.calloutOwnerText}>
                        👤 {pm.ownerInfo.nama || 'Pengguna Lain'}
                        {pm.ownerInfo.desa ? `  ·  ${pm.ownerInfo.desa}` : ''}
                      </Text>
                    </View>
                  )}

                  {pm.isPublic && (
                    <Text style={styles.calloutPublic}>🌐 Placemark Publik</Text>
                  )}

                  <View style={styles.calloutActions}>
                    <Text style={styles.calloutEdit}>
                      {isOtherPublic ? '👁 Detail' : '✏️ Edit'}
                    </Text>
                    <Text style={styles.calloutNav}>🧭 Navigasi</Text>
                  </View>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {/* Empty Overlay */}
      {displayPlacemarks.length === 0 && (
        <View style={styles.emptyOverlay}>
          <Text style={styles.emptyText}>
            {filterTab === 'SAYA'
              ? '📍 Belum ada placemark milik Anda.'
              : filterTab === 'PUBLIK'
              ? '🌐 Belum ada placemark publik dari pengguna lain.'
              : '📍 Belum ada placemark yang tersedia.'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },

  // TOP CONTROL CONTAINER
  topControlContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },

  // LAYER BAR
  layerBar: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  layerBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  layerBtnActive: {
    backgroundColor: '#208DC0',
    borderColor: '#208DC0',
  },
  layerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  layerBtnTextActive: {
    color: '#FFFFFF',
  },

  // FILTER BAR
  filterBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#208DC0',
  },
  filterBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  filterBtnTextActive: {
    color: '#208DC0',
    fontWeight: '800',
  },

  map: { flex: 1 },

  // CUSTOM MARKER PIN DENGAN EMOJI / IKON
  markerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  markerEmoji: {
    fontSize: 19,
    textAlign: 'center',
  },
  markerArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    alignSelf: 'center',
    marginTop: -1,
  },

  // CALLOUT
  callout: { width: 210, padding: 12 },
  calloutEmoji: { fontSize: 24, textAlign: 'center' },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 4,
  },
  calloutCoord: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  calloutDesc: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  calloutOwner: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  calloutOwnerText: {
    fontSize: 10,
    color: '#208DC0',
    fontWeight: '600',
    textAlign: 'center',
  },
  calloutPublic: {
    fontSize: 10,
    color: '#3B82F6',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },
  calloutActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  calloutEdit: { fontSize: 13, color: '#208DC0', fontWeight: '700' },
  calloutNav: { fontSize: 13, color: '#22C55E', fontWeight: '700' },

  // EMPTY OVERLAY
  emptyOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  emptyText: { color: '#64748B', fontSize: 13, textAlign: 'center' },
});

export default PlacemarkMap;
