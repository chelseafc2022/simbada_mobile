// views/home/components/DetailDesaModal.js
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TextInput,
} from 'react-native';
import * as turf from '@turf/turf';

/**
 * Menghitung luas poligon dalam km² dengan Turf.js
 */
export const calculatePolygonArea = (coordinates) => {
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 3) {
    return '0.00';
  }
  try {
    const geoJSONCoordinates = coordinates
      .map((coord) => {
        if (Array.isArray(coord) && coord.length >= 2) {
          const lng = parseFloat(coord[0]);
          const lat = parseFloat(coord[1]);
          if (!isNaN(lat) && !isNaN(lng)) return [lng, lat];
        } else if (coord && typeof coord === 'object') {
          const lat =
            coord.latitude != null
              ? parseFloat(coord.latitude)
              : coord.lat != null
              ? parseFloat(coord.lat)
              : NaN;
          const lng =
            coord.longitude != null
              ? parseFloat(coord.longitude)
              : coord.lng != null
              ? parseFloat(coord.lng)
              : NaN;
          if (!isNaN(lat) && !isNaN(lng)) return [lng, lat];
        }
        return null;
      })
      .filter((coord) => coord !== null);

    if (geoJSONCoordinates.length < 3) return '0.00';

    // Pastikan poligon tertutup untuk GeoJSON Turf
    const first = geoJSONCoordinates[0];
    const last = geoJSONCoordinates[geoJSONCoordinates.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      geoJSONCoordinates.push([first[0], first[1]]);
    }

    const poly = turf.polygon([geoJSONCoordinates]);
    const area = turf.area(poly) / 1e6; // Konversi m² ke km²
    return area.toFixed(4);
  } catch (error) {
    return '0.00';
  }
};

/**
 * DetailDesaModal
 * Modal pop-up lengkap yang muncul ketika pengguna menekan kartu info wilayah di pojok kiri bawah peta
 * atau memilih detail kecamatan. Menampilkan tabel Data Desa Per Kecamatan (No, Desa, Luas, UUPP, METADATA)
 * serta ringkasan geospasial.
 */
const DetailDesaModal = ({
  visible,
  onClose,
  kecamatanName = '',
  desaList = [],
  activeDesa = null,
  onSelectDesa,
}) => {
  const [searchFilter, setSearchFilter] = useState('');

  const filteredDesa = useMemo(() => {
    if (!searchFilter.trim()) return desaList;
    const q = searchFilter.toLowerCase().trim();
    return desaList.filter((item) => {
      const nama = item.lokasi?.nama_desa || item.nama_desa || item.nama || '';
      const uupp = item.lokasi?.uupp || '';
      const metadata = item.lokasi?.metadata || '';
      return (
        nama.toLowerCase().includes(q) ||
        uupp.toLowerCase().includes(q) ||
        metadata.toLowerCase().includes(q)
      );
    });
  }, [desaList, searchFilter]);

  // Hitung total luas
  const totalLuas = useMemo(() => {
    let sum = 0;
    desaList.forEach((item) => {
      const areaVal = parseFloat(
        item.calculatedArea || calculatePolygonArea(item.lokasi?.coordinat)
      );
      if (!isNaN(areaVal)) sum += areaVal;
    });
    return sum.toFixed(2);
  }, [desaList]);

  const activeNamaDesa =
    activeDesa?.lokasi?.nama_desa || activeDesa?.nama_desa || activeDesa?.nama;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.modalContainer}>
            {/* 1. MODAL TOP BAR */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Text style={styles.headerTitle}>Data Desa Per Kecamatan</Text>
                <Text style={styles.headerSubtitle}>
                  Kec. {kecamatanName || 'Konawe Selatan'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* 2. STATS OVERVIEW CARDS */}
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Kecamatan</Text>
                  <Text style={styles.statVal} numberOfLines={1}>
                    {kecamatanName || '-'}
                  </Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Total Desa</Text>
                  <Text style={[styles.statVal, { color: '#0284C7' }]}>
                    {desaList.length} Desa
                  </Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Total Luas</Text>
                  <Text style={[styles.statVal, { color: '#059669' }]}>
                    {totalLuas} km²
                  </Text>
                </View>
              </View>

              {/* 3. ACTIVE DESA CARD (JIKA PENGGUNA TAP POLIGON TERTENTU) */}
              {activeNamaDesa && (
                <View style={styles.activeHighlightCard}>
                  <View style={styles.activeCardBadge}>
                    <Text style={styles.activeCardBadgeText}>
                      Desa Terpilih di Peta
                    </Text>
                  </View>
                  <Text style={styles.activeDesaTitle}>{activeNamaDesa}</Text>
                  <View style={styles.activeDesaMetaRow}>
                    <Text style={styles.activeDesaMetaText}>
                      Luas:{' '}
                      <Text style={{ fontWeight: 'bold' }}>
                        {activeDesa.calculatedArea ||
                          calculatePolygonArea(activeDesa.lokasi?.coordinat)}{' '}
                        km²
                      </Text>
                    </Text>
                    <Text style={styles.activeDesaMetaText}>
                      UUPP:{' '}
                      <Text style={{ fontWeight: 'bold' }}>
                        {activeDesa.lokasi?.uupp || 'Hasil Delineasi Batas Desa 2019'}
                      </Text>
                    </Text>
                  </View>
                </View>
              )}

              {/* 4. SEARCH FILTER */}
              <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Filter nama desa, UUPP, atau metadata..."
                  placeholderTextColor="#94A3B8"
                  value={searchFilter}
                  onChangeText={setSearchFilter}
                />
                {searchFilter.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchFilter('')}>
                    <Text style={styles.clearSearchText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* 5. TABEL LENGKAP PERSIS WEB SIMBADA */}
              <View style={styles.tableCard}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={true}
                  contentContainerStyle={styles.tableScrollContent}
                >
                  <View>
                    {/* Header bg-blue-2 Quasar (#DBEAFE) */}
                    <View style={styles.tableHeaderRow}>
                      <View style={[styles.thCell, styles.colNo]}>
                        <Text style={styles.thTextCenter}>No</Text>
                      </View>
                      <View style={[styles.thCell, styles.colDesa]}>
                        <Text style={styles.thText}>Desa</Text>
                      </View>
                      <View style={[styles.thCell, styles.colLuas]}>
                        <Text style={styles.thText}>Luas</Text>
                      </View>
                      <View style={[styles.thCell, styles.colUupp]}>
                        <Text style={styles.thText}>UUPP</Text>
                      </View>
                      <View style={[styles.thCell, styles.colMetadata]}>
                        <Text style={styles.thText}>METADATA</Text>
                      </View>
                    </View>

                    {/* Rows */}
                    {filteredDesa.length === 0 ? (
                      <View style={styles.noMatchRow}>
                        <Text style={styles.noMatchText}>
                          {desaList.length === 0
                            ? 'Silakan pilih kecamatan terlebih dahulu untuk melihat data desa'
                            : `Tidak ada desa yang cocok dengan pencarian "${searchFilter}"`}
                        </Text>
                      </View>
                    ) : (
                      filteredDesa.map((item, index) => {
                        const nama =
                          item.lokasi?.nama_desa ||
                          item.nama_desa ||
                          item.nama ||
                          '-';
                        const luas =
                          item.calculatedArea ||
                          calculatePolygonArea(item.lokasi?.coordinat) ||
                          '0';
                        const uupp =
                          item.lokasi?.uupp ||
                          'Hasil Delineasi Batas Desa 2019';
                        const metadata =
                          item.lokasi?.metadata ||
                          'TASWIL1000020210531_DATA_BATAS_DESA_KELURAHAN';

                        const isSelected = activeNamaDesa && activeNamaDesa === nama;
                        const isEven = index % 2 === 1;

                        return (
                          <TouchableOpacity
                            key={`modal-desa-${item.des_kel_id || index}`}
                            style={[
                              styles.tableBodyRow,
                              isSelected
                                ? styles.rowSelected
                                : isEven
                                ? styles.rowEven
                                : styles.rowOdd,
                            ]}
                            onPress={() => {
                              if (onSelectDesa) {
                                onSelectDesa(item);
                                onClose();
                              }
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.tdCell, styles.colNo]}>
                              <Text style={styles.tdTextCenter}>
                                {index + 1}
                              </Text>
                            </View>
                            <View style={[styles.tdCell, styles.colDesa]}>
                              <Text
                                style={[
                                  styles.tdDesaName,
                                  isSelected && styles.textSelected,
                                ]}
                                numberOfLines={1}
                              >
                                {nama}
                              </Text>
                            </View>
                            <View style={[styles.tdCell, styles.colLuas]}>
                              <Text style={styles.tdLuasText}>
                                {luas} km²
                              </Text>
                            </View>
                            <View style={[styles.tdCell, styles.colUupp]}>
                              <Text style={styles.tdSubText} numberOfLines={2}>
                                {uupp}
                              </Text>
                            </View>
                            <View style={[styles.tdCell, styles.colMetadata]}>
                              <Text
                                style={styles.tdMetadataText}
                                numberOfLines={2}
                              >
                                {metadata}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.footerNote}>
                <Text style={styles.footerNoteText}>
                  💡 Klik salah satu baris desa untuk memfokuskan poligon batas wilayah di peta.
                </Text>
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '88%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalHeaderLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#0284C7',
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  activeHighlightCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
  },
  activeCardBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  activeCardBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  activeDesaTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  activeDesaMetaRow: {
    marginTop: 6,
    gap: 4,
  },
  activeDesaMetaText: {
    fontSize: 12,
    color: '#334155',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 14,
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
  clearSearchText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: 'bold',
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
  },
  tableScrollContent: {
    minWidth: '100%',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#DBEAFE', // bg-blue-2 Quasar
    borderBottomWidth: 1,
    borderBottomColor: '#93C5FD',
    alignItems: 'center',
    minHeight: 40,
  },
  thCell: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  thText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
  },
  thTextCenter: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
    textAlign: 'center',
  },
  tableBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    minHeight: 46,
  },
  rowOdd: {
    backgroundColor: '#FFFFFF',
  },
  rowEven: {
    backgroundColor: '#F8FAFC',
  },
  rowSelected: {
    backgroundColor: '#E0F2FE',
  },
  textSelected: {
    color: '#0284C7',
  },
  tdCell: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  tdTextCenter: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    fontWeight: '600',
  },
  tdDesaName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  tdLuasText: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
  },
  tdSubText: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 15,
  },
  tdMetadataText: {
    fontSize: 10,
    color: '#64748B',
    fontFamily: 'monospace',
  },
  colNo: {
    width: 44,
  },
  colDesa: {
    width: 140,
  },
  colLuas: {
    width: 110,
  },
  colUupp: {
    width: 200,
  },
  colMetadata: {
    width: 260,
  },
  noMatchRow: {
    padding: 24,
    alignItems: 'center',
  },
  noMatchText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  footerNote: {
    marginTop: 12,
    paddingHorizontal: 4,
  },
  footerNoteText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
});

export default DetailDesaModal;
