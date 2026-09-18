
import AsyncStorage from '@react-native-async-storage/async-storage';


var URL = 'https://server-simbada.konaweselatankab.go.id/'; 
var URLX = 'https://server-simbada.konaweselatankab.go.id/'; 





const initialState = {
    VERSI_APP : '0.0.5',

    URL: {
        URL_APP: URL,
        URL_APPX: URLX,
        LOGIN_URL: URL + "auth/login",
        URL_LIST_MONITORING : URL + "api/v1/monitoring/",
        URL_HOME : URL + "api/v1/web_home/",
        URL_KECAMATAN : URL + "api/v1/petadasarnew/",
        URL_ADD_ZONA : URL + "api/v1/web_zona_tanah/",
        URL_PENGGUNA : URL + "api/v1/pengguna/",
        URL_PETA_FINAL : URL + "api/v1/petafinal/"
        // URL_VIEW : URL + "api/v1/web_zona_tanah/",
        // URL_PETA_DASAR : URL + ""

    },


    AUTH_STAT : false,
    TOKEN   : '',
    PROFILE: null,

    // === State upgrade modul offline ===
    IS_ONLINE: true,
    OFFLINE_QUEUE_COUNT: 0,
    NOTIFICATION_COUNT: 0,

    // === Modul 1: Peta Offline ===
    ACTIVE_MAP: null,           // Metadata peta aktif { id, nama, path, bounds, format }

    // === Modul 2: Telemetri GPS ===
    GPS_STATUS: 'idle',         // 'idle' | 'acquiring' | 'active' | 'error'
    CURRENT_POSITION: null,     // { lat, lon, alt, speed, accH, accV, heading }

    // === Modul 3: Track Recorder ===
    TRACK_STATUS: 'idle',       // 'idle' | 'recording' | 'paused'
    TRACK_METRICS: null,        // { distance, avgSpeed, maxSpeed, duration }

    // === Modul 5: Placemark ===
    PLACEMARK_COUNT: 0,         // Jumlah placemark tersimpan (untuk badge)

    // === Modul Navigasi Background ===
    ACTIVE_NAVIGATION: null,    // State navigasi aktif { isNavigating, targetLat, targetLng, targetName, currentPos, distance, bearing, ... }
}


// state = initialState artinya jika state belumpunya nilai maka setup awalnya initialState,,, jadi boleh juga di tulis begini (state, action)
const reducer = (state = initialState, action = {}) => {
  switch (action.type) {
    case 'SET_TOKEN':
      return { ...state, TOKEN: action.payload, AUTH_STAT: true };
    case 'SET_PROFILE':
      return { ...state, PROFILE: action.payload };
    case 'RESET_AUTH':
      return { ...state, TOKEN: '', PROFILE: null, AUTH_STAT: false };
    // === Action baru untuk modul upgrade ===
    case 'SET_ONLINE_STATUS':
      return { ...state, IS_ONLINE: action.payload };
    case 'SET_OFFLINE_QUEUE_COUNT':
      return { ...state, OFFLINE_QUEUE_COUNT: action.payload };
    case 'SET_NOTIFICATION_COUNT':
      return { ...state, NOTIFICATION_COUNT: action.payload };
    // === Modul 1: Peta Offline ===
    case 'SET_ACTIVE_MAP':
      return { ...state, ACTIVE_MAP: action.payload };
    // === Modul 2: Telemetri GPS ===
    case 'SET_GPS_STATUS':
      return { ...state, GPS_STATUS: action.payload };
    case 'UPDATE_POSITION':
      return { ...state, CURRENT_POSITION: action.payload };
    // === Modul 3: Track Recorder ===
    case 'SET_TRACK_STATUS':
      return { ...state, TRACK_STATUS: action.payload };
    case 'UPDATE_TRACK_METRICS':
      return { ...state, TRACK_METRICS: action.payload };
    // === Modul 5: Placemark ===
    case 'SET_PLACEMARK_COUNT':
      return { ...state, PLACEMARK_COUNT: action.payload };
    // === Modul Navigasi Background ===
    case 'SET_ACTIVE_NAVIGATION':
      return { ...state, ACTIVE_NAVIGATION: action.payload };
    default:
      return state;
  }
};


// Simpan lokasi ke AsyncStorage
const saveLocations = async (locations) => {
  try {
      await AsyncStorage.setItem('locations', JSON.stringify(locations));
  } catch (error) {
      console.error("Error saving locations", error);
  }
};

// Ambil lokasi dari AsyncStorage
const getLocations = async () => {
  try {
      const locations = await AsyncStorage.getItem('locations');
      return locations != null ? JSON.parse(locations) : [];
  } catch (error) {
      console.error("Error getting locations", error);
      return [];
  }
};
const handleLogin = async (token, profile) => {
    try {
      await AsyncStorage.setItem('TOKEN', token);
      await AsyncStorage.setItem('PROFILE', JSON.stringify(profile));
  
      dispatch({ type: 'SET_TOKEN', payload: token });
      dispatch({ type: 'SET_PROFILE', payload: profile });
    } catch (error) {
      console.error('Gagal menyimpan data:', error);
    }
  };


export default reducer
