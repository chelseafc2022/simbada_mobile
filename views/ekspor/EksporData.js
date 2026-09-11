/**
 * EksporData.js — Modul 6: Kelola Lapisan & Ekspor Data
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ScrollView, ActivityIndicator, Switch,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { useSelector } from 'react-redux';
import PlacemarkDB from '../library/PlacemarkDB';
import TrackDB from '../library/TrackDB';
import GeoExporter from '../library/GeoExporter';

const FORMAT_OPTIONS = [
  { id: 'kmz', label: 'KMZ', desc: 'Google Earth, QGIS, ArcGIS', icon: '🌍' },
  { id: 'gpx', label: 'GPX', desc: 'Garmin, OSMAnd, AllTrails', icon: '🧭' },
  { id: 'csv', label: 'CSV', desc: 'Excel, Spreadsheet', icon: '📊' },
];

const EksporData = ({ navigation }) => {
  const isOnline = useSelector(s => s.IS_ONLINE);

  const [placemarks, setPlacemarks] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [usePlacemarks, setUsePlacemarks] = useState(true);
  const [useTracks, setUseTracks] = useState(true);
  const [format, setFormat] = useState('kmz');
  const [isExporting, setIsExporting] = useState(false);
  const [lastExportPath, setLastExportPath] = useState(null);

  useFocusEffect(useCallback(() => {
    PlacemarkDB.getAll().then(setPlacemarks);
    TrackDB.getAllTracks().then(setTracks);
  }, []));

  const selectedCount = (usePlacemarks ? placemarks.length : 0) + (useTracks ? tracks.length : 0);

  const doExport = async () => {
    if (selectedCount === 0) { Alert.alert('Tidak Ada Data', 'Pilih minimal satu layer untuk diekspor.'); return; }
    const selectedPm = usePlacemarks ? placemarks : [];
    const selectedTr = useTracks ? tracks : [];

    // Peringatan ukuran besar
    const totalPts = selectedPm.length + selectedTr.reduce((a, t) => a + (t.waypoints?.length ?? 0), 0);
    if (totalPts > 10000) {
      const cont = await new Promise(r => Alert.alert(
        'Data Besar', `Total ${totalPts.toLocaleString()} titik. Ekspor mungkin memakan waktu. Lanjutkan?`,
        [{ text: 'Ya', onPress: () => r(true) }, { text: 'Batal', onPress: () => r(false), style: 'cancel' }]
      ));
      if (!cont) return;
    }

    setIsExporting(true);
    setLastExportPath(null);
    try {
      let filePath;
      if (format === 'kmz') filePath = await GeoExporter.exportKMZ(selectedPm, selectedTr);
      else if (format === 'gpx') filePath = await GeoExporter.exportGPX(selectedPm, selectedTr);
      else filePath = await GeoExporter.exportCSV(selectedPm, selectedTr);
      setLastExportPath(filePath);
      const parts = filePath.split('/');
      const fname = parts[parts.length - 1];
      Alert.alert(
        '✅ Ekspor Berhasil',
        `File disimpan:\n${fname}`,
        [
          { text: 'Bagikan', onPress: () => shareFile(filePath) },
          { text: 'OK', style: 'cancel' },
        ]
      );
    } catch (e) {
      Alert.alert('Gagal Ekspor', e.message);
    } finally {
      setIsExporting(false);
    }
  };

  const shareFile = async (filePath) => {
    try {
      const mimeMap = { kmz: 'application/vnd.google-earth.kmz', gpx: 'application/gpx+xml', csv: 'text/csv' };
      await GeoExporter.shareFile(filePath, mimeMap[format]);
    } catch (e) { Alert.alert('Gagal Berbagi', e.message); }
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Ekspor Data</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>

        {/* Layer Selection */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pilih Layer</Text>
          <View style={styles.layerRow}>
            <View style={styles.layerInfo}>
              <Text style={styles.layerName}>📍 Placemark</Text>
              <Text style={styles.layerCount}>{placemarks.length} titik</Text>
            </View>
            <Switch
              value={usePlacemarks}
              onValueChange={setUsePlacemarks}
              trackColor={{ true: '#208DC0' }}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.layerRow, styles.layerRowBorder]}>
            <View style={styles.layerInfo}>
              <Text style={styles.layerName}>🛤 Trek Lapangan</Text>
              <Text style={styles.layerCount}>{tracks.length} jalur</Text>
            </View>
            <Switch
              value={useTracks}
              onValueChange={setUseTracks}
              trackColor={{ true: '#208DC0' }}
              thumbColor="#fff"
            />
          </View>
          <Text style={styles.selectedSummary}>Total: {selectedCount} entitas dipilih</Text>
        </View>

        {/* Format Selection */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Format Ekspor</Text>
          {FORMAT_OPTIONS.map(f => (
            <TouchableOpacity
              key={f.id}
              style={[styles.formatRow, format === f.id && styles.formatRowActive]}
              onPress={() => setFormat(f.id)}
            >
              <Text style={styles.formatIcon}>{f.icon}</Text>
              <View style={styles.formatInfo}>
                <Text style={styles.formatLabel}>{f.label}</Text>
                <Text style={styles.formatDesc}>{f.desc}</Text>
              </View>
              <View style={[styles.formatRadio, format === f.id && styles.formatRadioActive]}>
                {format === f.id && <View style={styles.formatRadioDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Export Button */}
        <TouchableOpacity
          style={[styles.exportBtn, isExporting && styles.exportBtnDisabled]}
          onPress={doExport} disabled={isExporting}
        >
          {isExporting ? (
            <View style={styles.exportingRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.exportBtnTxt}>Mengekspor...</Text>
            </View>
          ) : (
            <Text style={styles.exportBtnTxt}>
              📤 Ekspor {format.toUpperCase()} ({selectedCount} entitas)
            </Text>
          )}
        </TouchableOpacity>

        {/* Share last export */}
        {lastExportPath && !isExporting && (
          <TouchableOpacity style={styles.shareBtn} onPress={() => shareFile(lastExportPath)}>
            <Text style={styles.shareBtnTxt}>🔗 Bagikan File Terakhir</Text>
          </TouchableOpacity>
        )}

        {/* Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTxt}>
            📁 File disimpan di:{'\n'}
            /sdcard/simbada/ekspor/
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  back: { color: '#208DC0', fontSize: 16, fontWeight: '700' },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16,
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 10,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 16 },
  layerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  layerRowBorder: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  layerInfo: { flex: 1 },
  layerName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  layerCount: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  selectedSummary: {
    fontSize: 12, color: '#208DC0', fontWeight: '700',
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  formatRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12,
    marginBottom: 8, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC',
  },
  formatRowActive: { borderColor: '#208DC0', backgroundColor: 'rgba(32,141,192,0.08)' },
  formatIcon: { fontSize: 24, marginRight: 14 },
  formatInfo: { flex: 1 },
  formatLabel: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  formatDesc: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  formatRadio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center',
  },
  formatRadioActive: { borderColor: '#208DC0' },
  formatRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#208DC0' },
  exportBtn: {
    backgroundColor: '#208DC0', borderRadius: 16, padding: 18, alignItems: 'center',
    marginBottom: 12,
    elevation: 6, shadowColor: '#208DC0', shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 12,
  },
  exportBtnDisabled: { backgroundColor: '#94A3B8' },
  exportBtnTxt: { color: '#fff', fontWeight: '900', fontSize: 15 },
  exportingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shareBtn: {
    backgroundColor: '#F1F5F9', borderRadius: 16, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16,
  },
  shareBtnTxt: { color: '#208DC0', fontWeight: '700', fontSize: 14 },
  infoBox: {
    backgroundColor: 'rgba(32,141,192,0.08)', borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: 'rgba(32,141,192,0.3)',
  },
  infoTxt: { color: '#64748B', fontSize: 12, lineHeight: 20 },
});

export default EksporData;
