// FullMap.js
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import MapView, { Polygon, Polyline } from 'react-native-maps';
import FastImage from 'react-native-fast-image';
import { useRoute, useNavigation } from '@react-navigation/native';

const FullMap = () => {
  const route = useRoute();
  const navigation = useNavigation();

  const { petaPengajuan = [], petaDasar = [], region } = route.params;

  return (
    <View style={styles.container}>
      {/* Map View */}
      <MapView style={styles.map} initialRegion={region}>
        {/* Gambar polygon atau polyline pengajuan */}
        {petaPengajuan.map((item, index) => {
          const key = `pengajuan-${index}`;
          return item.tipe === 'polyline' ? (
            <Polyline
              key={key}
              coordinates={item.coordinates}
              strokeColor="blue"
              strokeWidth={3}
            />
          ) : (
            <Polygon
              key={key}
              coordinates={item.coordinates}
              strokeColor="blue"
              fillColor="rgba(0,0,255,0.3)"
            />
          );
        })}

        {/* Gambar polygon untuk peta dasar */}
        {petaDasar.map((item, index) => (
          <Polygon
            key={`dasar-${index}`}
            coordinates={item.coordinates}
            strokeColor="red"
            fillColor="rgba(255,0,0,0.3)"
          />
        ))}
      </MapView>

      {/* Tombol kembali */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={{ color: 'white', fontSize: 16 }}>❌</Text>
        </TouchableOpacity>
    </View>
  );
};

export default FullMap;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: 20,
    zIndex: 999,
  },
});
