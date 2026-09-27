// views/home/components/ConnectionStatus.js
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useSelector } from 'react-redux';
import GpsService from '../../library/GpsService';

/**
 * ConnectionStatus SIMBADA V2
 * Status indicator modern untuk kondisi Jaringan (Online/Offline), Sensor GPS, dan Status Peta Final Desa.
 */
const ConnectionStatus = ({
  isOnline = true,
  isGpsActive: propGpsActive,
  activePolygon = null,
  petaFinalAll = [],
  navigation = null,
}) => {
  const globalPos = useSelector((s) => s.CURRENT_POSITION);
  const globalGpsStatus = useSelector((s) => s.GPS_STATUS);
  const PROFILE = useSelector((s) => s.PROFILE);

  const isGpsActive =
    propGpsActive ||
    !!globalPos ||
    globalGpsStatus === 'active' ||
    GpsService.hasAcquired();

  // Tentukan desa target yang sedang dilihat / milik user
  const desaInfo = useMemo(() => {
    // 1. Poligon aktif yang sedang diklik user di peta
    if (activePolygon) {
      const name =
        activePolygon.lokasi?.nama_desa ||
        activePolygon.nama_desa ||
        activePolygon.nama ||
        '';
      const kode =
        activePolygon.lokasi?.kode_desa ||
        activePolygon.kode_desa ||
        activePolygon.id_desa ||
        '';
      if (name || kode) {
        return { name, kode, source: 'polygon' };
      }
    }

    // 2. Profil operator desa jika login sebagai aparat/admin desa
    const profileName =
      PROFILE?.profile?.nama_desa ||
      PROFILE?.profile?.nama_kelurahan ||
      '';
    const profileKode =
      PROFILE?.profile?.id_desa ||
      PROFILE?.profile?.id_kelurahan ||
      PROFILE?.profile?.des_kel_id ||
      '';

    if (profileName || profileKode) {
      return { name: profileName, kode: profileKode, source: 'profile' };
    }

    return null;
  }, [activePolygon, PROFILE]);

  // Cek apakah desa tersebut memiliki Peta Final
  const finalStatus = useMemo(() => {
    if (!Array.isArray(petaFinalAll) || petaFinalAll.length === 0) {
      if (!desaInfo) return { hasFinal: null, count: 0 };
      return { hasFinal: false, count: 0 };
    }

    if (!desaInfo) {
      return { hasFinal: null, count: petaFinalAll.length };
    }

    const normTargetKode = desaInfo.kode
      ? String(desaInfo.kode).replace(/[^0-9]/g, '')
      : '';
    const normTargetName = desaInfo.name
      ? String(desaInfo.name).toLowerCase().replace(/^(desa|kelurahan)\s+/i, '').trim()
      : '';

    const matched = petaFinalAll.find((pf) => {
      // Cek kecocokan kode desa
      if (normTargetKode && pf.kode_desa) {
        const pfKode = String(pf.kode_desa).replace(/[^0-9]/g, '');
        if (
          pfKode === normTargetKode ||
          (normTargetKode.length >= 6 && pfKode.endsWith(normTargetKode)) ||
          (pfKode.length >= 6 && normTargetKode.endsWith(pfKode))
        ) {
          return true;
        }
      }
      // Cek kecocokan nama desa
      if (normTargetName && pf.nama_desa) {
        const pfName = String(pf.nama_desa)
          .toLowerCase()
          .replace(/^(desa|kelurahan)\s+/i, '')
          .trim();
        if (pfName === normTargetName) {
          return true;
        }
      }
      return false;
    });

    return {
      hasFinal: Boolean(matched),
      matchedItem: matched || null,
      count: petaFinalAll.length,
    };
  }, [petaFinalAll, desaInfo]);

  const handlePressPetaFinal = () => {
    if (finalStatus.hasFinal === true) {
      Alert.alert(
        '✅ Peta Final Ditemukan',
        `Desa ${desaInfo?.name || ''} telah memiliki Peta Batas Definitif (Peta Final) yang sah.`,
        [
          {
            text: 'Lihat Peta Final',
            onPress: () => {
              if (navigation && typeof navigation.navigate === 'function') {
                navigation.navigate('PetaFinal');
              }
            },
          },
          { text: 'Tutup', style: 'cancel' },
        ]
      );
    } else if (finalStatus.hasFinal === false) {
      Alert.alert(
        'ℹ️ Belum Ada Peta Final',
        `Desa ${desaInfo?.name || ''} saat ini belum memiliki Peta Batas Definitif (Peta Final). Anda dapat mengajukan batas wilayah melalui menu Usulan Peta.`,
        [
          {
            text: 'Ajukan Usulan Peta',
            onPress: () => {
              if (navigation && typeof navigation.navigate === 'function') {
                navigation.navigate('Usulan');
              }
            },
          },
          { text: 'Tutup', style: 'cancel' },
        ]
      );
    } else {
      Alert.alert(
        '🗺️ Peta Final Konawe Selatan',
        `Terdapat ${finalStatus.count} desa yang telah memiliki Peta Final definitif. Ketuk salah satu batas desa di peta untuk mengecek status per desa.`,
        [
          {
            text: 'Buka Peta Final',
            onPress: () => {
              if (navigation && typeof navigation.navigate === 'function') {
                navigation.navigate('PetaFinal');
              }
            },
          },
          { text: 'Tutup', style: 'cancel' },
        ]
      );
    }
  };

  return (
    <View style={styles.outerContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {/* Network Status */}
        <View
          style={[
            styles.statusPill,
            isOnline ? styles.onlinePill : styles.offlinePill,
          ]}
        >
          <View
            style={[
              styles.dot,
              isOnline ? styles.dotOnline : styles.dotOffline,
            ]}
          />
          <Text
            style={[
              styles.statusText,
              isOnline ? styles.textOnline : styles.textOffline,
            ]}
          >
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>

        {/* GPS Status */}
        <View
          style={[
            styles.statusPill,
            isGpsActive ? styles.gpsActivePill : styles.gpsInactivePill,
          ]}
        >
          <View
            style={[
              styles.dot,
              isGpsActive ? styles.dotGpsActive : styles.dotGpsInactive,
            ]}
          />
          <Text
            style={[
              styles.statusText,
              isGpsActive ? styles.textGpsActive : styles.textGpsInactive,
            ]}
          >
            {isGpsActive ? 'GPS Aktif' : 'GPS Tidak Aktif'}
          </Text>
        </View>

        {/* Badge Status Peta Final Desa */}
        <TouchableOpacity
          style={[
            styles.statusPill,
            finalStatus.hasFinal === true
              ? styles.finalAdaPill
              : finalStatus.hasFinal === false
              ? styles.finalBelumPill
              : styles.finalNeutralPill,
          ]}
          onPress={handlePressPetaFinal}
          activeOpacity={0.75}
        >
          <View
            style={[
              styles.dot,
              finalStatus.hasFinal === true
                ? styles.dotFinalAda
                : finalStatus.hasFinal === false
                ? styles.dotFinalBelum
                : styles.dotFinalNeutral,
            ]}
          />
          <Text
            style={[
              styles.statusText,
              finalStatus.hasFinal === true
                ? styles.textFinalAda
                : finalStatus.hasFinal === false
                ? styles.textFinalBelum
                : styles.textFinalNeutral,
            ]}
            numberOfLines={1}
          >
            {finalStatus.hasFinal === true
              ? `Peta Final: Ada${desaInfo?.name ? ` (${desaInfo.name})` : ''}`
              : finalStatus.hasFinal === false
              ? `Peta Final: Belum Ada${desaInfo?.name ? ` (${desaInfo.name})` : ''}`
              : `Peta Final: ${finalStatus.count} Desa`}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: '#F5F7FA',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Online / Offline styles
  onlinePill: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  dotOnline: {
    backgroundColor: '#16A36A',
  },
  textOnline: {
    color: '#065F46',
  },

  offlinePill: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  dotOffline: {
    backgroundColor: '#F59E0B',
  },
  textOffline: {
    color: '#92400E',
  },

  // GPS styles
  gpsActivePill: {
    backgroundColor: '#EBF6FC',
    borderColor: '#BAE6FD',
  },
  dotGpsActive: {
    backgroundColor: '#087FC1',
  },
  textGpsActive: {
    color: '#075985',
  },

  gpsInactivePill: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  dotGpsInactive: {
    backgroundColor: '#DC4C4C',
  },
  textGpsInactive: {
    color: '#991B1B',
  },

  // Peta Final: Ada (Hijau Zamrud)
  finalAdaPill: {
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7',
  },
  dotFinalAda: {
    backgroundColor: '#059669',
  },
  textFinalAda: {
    color: '#065F46',
  },

  // Peta Final: Belum Ada (Amber / Orange)
  finalBelumPill: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
  },
  dotFinalBelum: {
    backgroundColor: '#EA580C',
  },
  textFinalBelum: {
    color: '#C2410C',
  },

  // Peta Final: Netral / Ringkasan (Biru / Indigo)
  finalNeutralPill: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  dotFinalNeutral: {
    backgroundColor: '#6366F1',
  },
  textFinalNeutral: {
    color: '#4338CA',
  },
});

export default ConnectionStatus;
